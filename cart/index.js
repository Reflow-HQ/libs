import IntlMessageFormat from "intl-messageformat";
import debounce from "lodash.debounce";
import defaultLocalization from "./locales/locale_en-US";

// Cart Manager Class

export default class Cart {
  constructor({ storeID, apiBase = "https://api.reflowhq.com/v1", localization }) {
    this.storeID = storeID;
    this.apiBase = apiBase;
    this.localization = {
      ...defaultLocalization,
      ...localization,
    };

    this._listeners = {};

    this.state = {
      isLoaded: false,
      isLoading: false,
      isUnavailable: false,

      locale: this.localization.locale,

      errors: [],

      products: [],
      footerLinks: [],
      total: 0,
      subtotal: 0,
      taxes: {},
      locations: [],
      shippingMethods: [],
      shippableCountries: [],
      paymentProviders: [],
      signInProviders: [],

      selectedLocation: -1,
      selectedShippingMethod: -1,
    };

    this.localFormData = new LocalStorageFormData({ storeID });

    this.scheduleRefresh = debounce(this.refresh.bind(this), 250);

    this.bind();
  }

  translate(key, data) {
    if (!this.localization[key]) {
      throw new Error(`Reflow: Localization key "${key}" is not defined.`);
    }

    return new IntlMessageFormat(this.localization[key], this.localization.locale).format(data);
  }

  api(endpoint, options) {
    return fetch(this.apiBase + "/stores/" + this.storeID + endpoint, options).then(
      async (response) => {
        let data = await response.json();

        if (!response.ok) {
          let err = Error(data.error || "HTTP error");
          err.status = response.status;
          err.data = data;
          throw err;
        }

        return data;
      }
    );
  }

  on(event, cb) {
    event = event.toLowerCase();

    if (!(event in this._listeners)) {
      this._listeners[event] = [];
    }

    if (!this._listeners[event].includes(cb)) {
      this._listeners[event].push(cb);
    }
  }

  off(event, cb) {
    event = event.toLowerCase();

    if (!(event in this._listeners)) {
      throw new Error("Unrecognized event name.");
    }

    if (!this._listeners[event].includes(cb)) {
      throw new Error("Callback doesn't exist or has aleady been removed.");
    }

    this._listeners[event].splice(this._listeners[event].indexOf(cb), 1);

    if (!this._listeners[event].length) {
      delete this._listeners[event];
    }
  }

  trigger(event, data) {
    if (!(event in this._listeners)) {
      return;
    }

    for (let cb of this._listeners[event]) {
      cb(data);
    }
  }

  broadcast(event, passthrough) {
    if (this._broadcastChannel) {
      this._broadcastChannel.postMessage({
        type: event,
        ...passthrough,
      });
    }
  }

  bind() {
    if ("BroadcastChannel" in window) {
      this._broadcastChannel = new BroadcastChannel("reflow-cart");
      this._broadcastChannel.onmessage = (e) => {
        if (e.data.type !== "checkout-completed") {
          this.scheduleRefresh();
        }
      };
    }
  }

  get key() {
    return localStorage[`reflowCartKey${this.storeID}`];
  }

  set key(key) {
    localStorage[`reflowCartKey${this.storeID}`] = key;
  }

  get locale() {
    return this.localization.locale || "en-US";
  }

  get state() {
    return this._state;
  }

  set state(state) {
    this._state = state;
  }

  updateState(newState) {
    if (!newState) {
      this.state = {
        isUnavailable: true,
      };

      this.trigger("change", this.state);
      return;
    }

    const oldState = this.state;

    this.state = {
      ...oldState,
      ...newState,
      isLoaded: true,
      isUnavailable: false,
    };

    this.state.quantity = this.calculateTotalQuantity();

    if (!this.isDeliveryMethodValid(this.state.deliveryMethod)) {
      this.state.deliveryMethod = this.isDeliveryMethodValid(oldState.deliveryMethod)
        ? oldState.deliveryMethod
        : this.getDefaultDeliveryMethod();
    }

    if (newState.locations) {
      this.state.selectedLocation = this.state.locations.findIndex((l) => l.chosen);
    }

    if (newState.shipping) {
      this.state.shippingMethods = this.state.shipping || [];
      this.state.selectedShippingMethod = this.state.shipping.findIndex((s) => s.chosen);
    }

    if (newState.shipping) {
      this.state.paymentProviders = this.transformPaymentProviders(
        this.state.paymentProviders || []
      );
    }

    this.trigger("change", this.state);
  }

  isLoaded() {
    return !!this.state?.isLoaded;
  }

  isEmpty() {
    return !this.isLoaded() || !this.state.products.length;
  }

  isUnavailable() {
    return this.isUnavailable;
  }

  calculateTotalQuantity() {
    return this.state?.products
      ? this.state.products.reduce((prev, curr) => prev + curr.quantity, 0)
      : 0;
  }

  isDeliveryMethodValid(deliveryMethod) {
    if (!deliveryMethod) return false;

    if (!this.hasProducts()) return true;

    if (deliveryMethod === "digital") return !this.hasPhysicalProducts();
    if (deliveryMethod === "shipping" && !this.offersShipping()) return false;
    if (deliveryMethod === "pickup" && !this.offersLocalPickup()) return false;

    return true;
  }

  getDefaultDeliveryMethod() {
    if (this.hasProducts()) {
      if (!this.hasPhysicalProducts()) return "digital";

      if (this.offersLocalPickup()) return "pickup";
      if (this.offersShipping()) return "shipping";
    }

    return "pickup";
  }

  setDeliveryMethod(deliveryMethod) {
    this.updateState({ deliveryMethod, selectedLocation: -1, selectedShippingMethod: -1 });

    if (deliveryMethod === "shipping" && this.state.shippingAddress) {
      this.invalidateTaxExemption({ address: this.state.shippingAddress });
    } else {
      this.scheduleRefresh();
    }
  }

  setSelectedLocation(selectedLocation) {
    this.updateState({ selectedLocation });

    const location = this.state.locations[selectedLocation];
    if (!location) return;

    this.invalidateTaxExemption({ address: location.address });
  }

  setSelectedShippingMethod(selectedShippingMethod) {
    this.updateState({ selectedShippingMethod });
    this.scheduleRefresh();
  }

  getShippingAddress(address) {
    // Returns the address only if all fields are correctly filled.

    if (!address) {
      address = this.localFormData.get("shippingAddress") || {};
    }

    let ret = {};

    // Optional

    if (address.name) {
      ret.name = address.name;
    }

    if (address.address) {
      ret.address = address.address;
    }

    // Required

    if (!address.city) return;
    ret.city = address.city;

    let code = address.countryCode;
    if (!code) return;

    let country = this.getCountryByCode(code);
    if (!country) return;

    ret.country = code;

    // Conditionally required

    if (country.has_postcode) {
      if (!address.postcode) return;
      ret.postcode = address.postcode;
    }

    if (country.has_regions) {
      if (!address.state) return;
      ret.state = address.state;
    }

    return ret;
  }

  isShippingFilled() {
    return !!this.getShippingAddress();
  }

  getDigitalAddress(address) {
    // Returns the address for digital carts.

    if (!address) {
      address = this.localFormData.get("digitalAddress") || {};
    }

    let ret = {};

    // Required

    let code = address.countryCode;
    if (!code) return;

    let country = this.getCountryByCode(code);
    if (!country) return;

    ret.country = code;

    // State and zip required only for US

    if (code == "US") {
      if (!address.postcode) return;
      ret.postcode = address.postcode;

      if (!address.state) return;
      ret.state = address.state;
    }

    return ret;
  }

  transformPaymentProviders(paymentProviders) {
    return Object.entries(paymentProviders)
      .map((p) => p[1])
      .sort((a, b) => {
        return (
          (b.provider === "pay-in-store" || 0) - (a.provider === "pay-in-store" || 0) ||
          b.order - a.order
        );
      });
  }

  hasProducts() {
    return !!this.state?.products?.length;
  }

  hasPhysicalProducts() {
    return !!this.state?.products.find((p) => p.type == "physical" && p.inStock);
  }

  getShippableCountries() {
    return this.state?.shippableCountries || [];
  }

  offersShipping() {
    return !!this.getShippableCountries().length;
  }

  offersLocalPickup() {
    return !!this.state?.locations?.length;
  }

  getCountryByCode(code) {
    return this.getShippableCountries().find((c) => c.country_code == code);
  }

  getTaxPricingType() {
    return this.state?.taxes ? this.state?.taxes?.details.pricingType : null;
  }

  canDeliver() {
    return !this.state.errors.filter((e) => e.type == "delivery-unavailable").length;
  }

  canShip() {
    return (
      !!this.state.shipping.length &&
      !this.state.errors.filter((e) => e.type == "cannot-ship").length
    );
  }

  hasZeroValue() {
    return this.state.total == 0;
  }

  canFinish() {
    return !this.state.errors.filter((e) => e.severity == "fatal").length;
  }

  getErrorText(e, subject) {
    // Old format of passing errors from the server
    // ['errors' => ['system' => 'Some error message.']

    let errors = e?.data?.errors || {};
    let message = errors[subject] || "";

    if (e.data.errorCode) {
      // New way: passing an errorCode id that can be localized.
      // ['errorCode' => 'localization.id'] OR
      // ['errorCode' => ['code' => 'localization.id', 'formats' => ['name' => 'Joe']]

      if (typeof e.data.errorCode === "string") {
        message = this.translate(e.data.errorCode);
      } else {
        message = this.translate(e.data.errorCode.code, e.data.errorCode.formats);
      }
    }

    return message;
  }

  getStateErrorMessage(error = {}) {
    try {
      let errorCode = error.type.replaceAll("-", "_");
      let formats = error.formats || null;

      if (formats) {
        return this.translate("cart.errors." + errorCode, formats);
      } else {
        return this.translate("cart.errors." + errorCode);
      }
    } catch (e) {
      // Some errors are not localized. Show a predefined string from the server response.
      return error.message || "";
    }
  }

  getStateErrors() {
    let errors = this.state.errors || [];
    return errors.map(this.getStateErrorMessage.bind(this)).filter((message) => !!message);
  }

  getProductKey(product) {
    let key = product.id + (product.variant?.id || "");

    key += product.personalization.map((p) => {
      let personalization = p.id;

      if (p.inputText) personalization += p.inputText;
      if (p.selected) personalization += p.selected;
      if (p.filename) personalization += p.filename;
      if (p.filehash) personalization += p.filehash;

      return personalization;
    });

    return key;
  }

  formatProductPersonalization(personalization = []) {
    return personalization.map((p) => {
      let personalization = { id: p.id };

      if (p.inputText) personalization.inputText = p.inputText;
      if (p.selected) personalization.selected = p.selected;
      if (p.filename) personalization.filename = p.filename;
      if (p.filehash) personalization.filehash = p.filehash;

      return personalization;
    });
  }

  getDefaultCurrencyConfig() {
    return {
      code: "USD",
      hasDecimal: true,
    };
  }

  formatCurrency(money) {
    const currencyConfig = this.state?.currencyConfig || this.getDefaultCurrencyConfig();
    let fractionDigits = 0;

    if (currencyConfig.hasDecimal) {
      // Currencies with cents are kept in the smallest unit ($12.34 is 1234 in the DB)
      // Divide by 100 to get the proper float value.
      // For currencies without decimals, the money is already the correct int value.
      money = money / 100;
      fractionDigits = 2;
    }

    return new Intl.NumberFormat(this.localization.locale || "en-US", {
      style: "currency",
      currency: currencyConfig.code,
      maximumFractionDigits: fractionDigits,
    }).format(money);
  }

  getPaymentProvider(provider) {
    return this.getPaymentProvidersByType(provider)[0] || null;
  }

  getPaymentProvidersByType(provider) {
    return this.state.paymentProviders?.filter((p) => p.provider === provider) || [];
  }

  arePaymentProvidersAvailable() {
    return (
      this.isStripeSupported() ||
      this.isPaypalSupported() ||
      this.hasCustomPayments() ||
      this.hasPayInStorePayments()
    );
  }

  hasCustomPayments() {
    return !!this.getPaymentProvidersByType("custom").length;
  }

  hasPayInStorePayments() {
    return this.state.locations.some((loc) => !!loc.pay_in_store);
  }

  isStripeSupported() {
    return this.getPaymentProvider("stripe")?.supported;
  }

  // Paypal

  isPaypalSupported() {
    if (this.hasPhysicalProducts() && !this.offersShipping()) return false;
    return !!this.getPaymentProvider("paypal")?.supported;
  }

  onlyPaypalNoDelivery() {
    // PayPal shouldn't be used with local pickup because of buyer address protection.
    // If the only payment method defined is PayPal and the only delivery method defined is Local Pickup we show an error

    if (!this.hasPhysicalProducts()) return false; // Digital cart, doesn't apply

    if (!this.isPaypalSupported()) return false; // PayPal not supported

    if (this.offersShipping()) return false; // There are delivery zones available - everything is ok.

    if (this.isStripeSupported() || this.hasCustomPayments() || this.hasPayInStorePayments())
      return false; // Other payment options available

    return true; // PayPal only and no delivery zones.
  }

  async create() {
    let result = await this.api("/carts/", { method: "POST" }, false);
    return result.cartKey;
  }

  async fetch(key, additionalParams = {}) {
    let addon = "";
    let params = [];

    for (let param in additionalParams) {
      params.push(`${param}=${additionalParams[param]}`);
    }

    if (params.length) {
      addon = "?" + params.join("&");
    }

    return await this.api("/carts/" + key + addon, {}, false);
  }

  async refreshState(additionalParams = {}) {
    let newState;

    try {
      if (this.key) {
        newState = await this.fetch(this.key, additionalParams);
      } else {
        throw new Error("No Key");
      }
    } catch (e) {
      if (!e.status || e.status == 404) {
        // The key was either unset or invalid, create a new one
        this.key = await this.create();
        newState = await this.fetch(this.key, additionalParams);
        this.localFormData.clear();
      } else {
        // This is a server error, just log it for now
        console.error("Reflow:", e);
      }
    }

    this.updateState(newState);
  }

  async refresh() {
    // Fetches the state from the backend

    let queryParams = {};

    if (this.state.deliveryMethod) {
      queryParams.deliveryMethod = this.state.deliveryMethod;
    }

    if (this.state.selectedShippingMethod >= 0) {
      queryParams.chosenShippingMethod = this.state.selectedShippingMethod;
    }

    if (this.state.selectedLocation >= 0) {
      queryParams.chosenStoreLocation = this.state.selectedLocation;
    }

    await this.refreshState(queryParams);
  }

  async addProduct({ id, variantID, personalization = [], files = [] }, quantity = 1) {
    try {
      let body = new FormData();

      if (personalization && personalization.length) {
        for (const p of personalization) {
          if (p.filename && p.filehash) {
            if (!files.findIndex((f) => f.hash === p.filehash)) {
              throw new Error(`Reflow: File with hash ${p.filehash} not provided!`);
            }
          }
        }

        body.append("personalization", JSON.stringify(personalization));

        for (const { hash, file } of files) {
          body.append(`personalization_files[${hash}]`, file);
        }
      }

      let result = await this.api(
        `/add-to-cart/${id}/` +
          quantity +
          "/" +
          (variantID || "") +
          (this.key ? "?cartKey=" + this.key : ""),
        { method: "POST", body },
        false
      );

      if (result.cartKey) {
        this.key = result.cartKey;
      }

      // TODO: add query param for quantity
      // TODO: pass variant to channels

      this.updateState({ quantity: result.cartQuantity });

      this.trigger("product-added", { productID: id });
      this.broadcast("product-added", { productID: id });

      this.scheduleRefresh();

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async updateProductQuantity({ id, variantID, personalization = [] }, quantity = 1) {
    try {
      let body = new FormData();

      let formattedPersonalization = this.formatProductPersonalization(personalization);

      if (formattedPersonalization.length) {
        body.append("personalization", JSON.stringify(formattedPersonalization));
      }

      let result = await this.api(
        `/update-cart-product/${this.key}/${id}/` + quantity + "/" + (variantID || ""),
        { method: "POST", body },
        false
      );

      this.updateState({ quantity: result.cartQuantity });

      this.trigger("product-updated", { productID: id });
      this.broadcast("product-updated", { productID: id });

      this.scheduleRefresh();

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async removeProduct({ id, variantID, personalization = [] }) {
    try {
      let body = new FormData();

      let formattedPersonalization = this.formatProductPersonalization(personalization);

      if (formattedPersonalization.length) {
        body.append("personalization", JSON.stringify(formattedPersonalization));
      }

      let result = await this.api(
        `/remove-cart-product/${this.key}/${id}/` + (variantID || ""),
        { method: "POST", body },
        false
      );

      this.updateState({ quantity: result.cartQuantity });

      this.trigger("product-removed", { productID: id });
      this.broadcast("product-removed", { productID: id });

      this.scheduleRefresh();

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async updateAddress({ address, deliveryMethod }) {
    // Updates the shipping/digital address and fetches the contents of the Cart with updated
    // tax regions, shipping methods, etc. taking into account the new address.

    // Only goes through if all relevant address fields are filled.

    if (!address) return;

    try {
      let body = new FormData();
      body.append("address", JSON.stringify(address));
      body.append("delivery_method", deliveryMethod);

      let result = await this.api(
        `/update-address/${this.key}/`,
        {
          method: "POST",
          body,
        },
        false
      );

      if (result.taxExemptionRemoved) {
        this.trigger("tax-exemption-removed");
      }

      this.trigger("address-updated");
      this.broadcast("address-updated");

      this.scheduleRefresh();

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async updateTaxExemption({ address, deliveryMethod, exemptionType, exemptionValue }) {
    try {
      let body = new FormData();

      body.append("address", JSON.stringify(address));
      body.append("delivery-method", deliveryMethod);
      body.append(exemptionType, exemptionValue);

      let result = await this.api(
        `/update-tax-exemption/${this.key}/`,
        {
          method: "POST",
          body,
        },
        false
      );

      this.trigger("tax-exemption-updated");
      this.broadcast("tax-exemption-updated");

      this.scheduleRefresh();

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async invalidateTaxExemption({ address }) {
    try {
      let body = new FormData();
      body.append("address", JSON.stringify(address));

      let result = await this.api(
        `/invalidate-tax-exemption/${this.key}/`,
        {
          method: "POST",
          body,
        },
        false
      );

      this.scheduleRefresh();

      if (result.taxExemptionRemoved) {
        this.trigger("tax-exemption-removed");
      }

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async removeTaxExemptionFile() {
    try {
      let result = await this.api(
        `/remove-tax-exemption-file/${this.key}/`,
        {
          method: "POST",
        },
        false
      );

      this.trigger("tax-exemption-removed");
      this.broadcast("tax-exemption-removed");

      this.scheduleRefresh();

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async addCoupon({ code }) {
    try {
      let body = new FormData();
      body.append("code", code);

      let result = await this.api(
        `/add-coupon/${this.key}/`,
        {
          method: "POST",
          body,
        },
        false
      );

      this.trigger("coupon-added");
      this.broadcast("coupon-added");

      this.scheduleRefresh();

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async removeCoupon() {
    try {
      let result = await this.api(
        `/remove-coupon/${this.key}/`,
        {
          method: "POST",
        },
        false
      );

      this.trigger("coupon-removed");
      this.broadcast("coupon-removed");

      this.scheduleRefresh();

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async applyDiscountCode({ code }) {
    try {
      let body = new FormData();
      body.append("code", code);

      let result = await this.api(
        `/apply-discount-code/${this.key}/`,
        {
          method: "POST",
          body,
        },
        false
      );

      this.trigger("discount-code-added");
      this.broadcast("discount-code-added");

      this.scheduleRefresh();

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async applyGiftCard({ code }) {
    try {
      let body = new FormData();
      body.append("code", code);

      let result = await this.api(
        `/apply-gift-card/${this.key}/`,
        {
          method: "POST",
          body,
        },
        false
      );

      this.trigger("gift-card-added");
      this.broadcast("gift-card-added");

      this.scheduleRefresh();

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async removeGiftCard() {
    try {
      let result = await this.api(
        `/remove-gift-card/${this.key}/`,
        {
          method: "POST",
        },
        false
      );

      this.trigger("gift-card-removed");
      this.broadcast("gift-card-removed");

      this.scheduleRefresh();

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async checkout(formData) {
    try {
      const body = new FormData();

      for (const [key, value] of Object.entries(formData)) {
        body.append(key, value);
      }

      let result = await this.api(
        `/complete-checkout/${this.key}/`,
        {
          method: "POST",
          body,
        },
        false
      );

      this.trigger("checkout-completed");
      this.broadcast("checkout-completed");

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async paypalCreateOrder(formData) {
    await this.refreshState();

    if (!this.canFinish()) {
      throw new Error(this.getStateErrors()[0]);
    }

    const body = new FormData();

    for (const [key, value] of Object.entries(formData)) {
      body.append(key, value);
    }

    let result = await this.api(
      `/create-paypal-order/${this.key}/`,
      { method: "POST", body },
      false
    );

    if (result.error && result.error == "PAYEE_ACCOUNT_RESTRICTED") {
      throw new Error(
        "Transaction could not be processed. The PayPal account associated with this store is restricted.",
        { cause: result.error }
      );
    }

    if (result.error && result.error == "CUSTOMER_FORM_DATA") {
      throw new Error("Missing or incorrect data. Please review the checkout form.", {
        cause: result.error,
      });
      // this.showFormErrors(result.fields);
    }

    if (result.error && result.error == "VACATION_MODE") {
      throw new Error("Transaction could not be processed. The store is currently unavailable.", {
        cause: result.error,
      });
    }

    return result.orderID;
  }

  async paypalOnApprove({ orderID }, actions) {
    let body = new FormData();
    body.append("orderID", orderID);

    try {
      let result = await this.api(
        `/capture-paypal-order/${this.key}/`,
        {
          method: "POST",
          body,
        },
        false
      );

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async updatePaypalShipping({ orderID, address, selectedShippingOption = 0 }) {
    try {
      let body = new FormData();
      body.append("orderID", orderID);
      body.append("address", JSON.stringify(address));
      body.append("selectedShippingOption", selectedShippingOption);

      let result = await this.api(
        `/update-paypal-shipping/${this.key}/`,
        {
          method: "POST",
          body,
        },
        false
      );

      return result;
    } catch (e) {
      // showSystemError(getErrorText(e), "Couldn't update PayPal shipping");

      console.error("Reflow:", e);
      throw e;
      // return actions.reject();
    }
  }
}

class LocalStorageFormData {
  // Handles localStorage saving and retrieving form data for the Cart component.

  constructor({ storeID }) {
    this.formDataKey = `reflowFormData${storeID}`;
  }

  getAll() {
    return JSON.parse(localStorage.getItem(this.formDataKey) || "{}");
  }

  get(key) {
    return this.getAll()[key];
  }

  set(key, value) {
    let data = this.getAll();

    data[key] = value || "";

    localStorage.setItem(this.formDataKey, JSON.stringify(data));
  }

  isSet(key) {
    return this.get(key) !== undefined;
  }

  clear() {
    localStorage.setItem(this.formDataKey, "{}");
  }
}
