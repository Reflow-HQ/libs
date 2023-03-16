import IntlMessageFormat from "intl-messageformat";
import debounce from "lodash.debounce";
import defaultLocalization from "./locale_en-US";

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

      locale: localization.locale,

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

      deliveryMethod: "pickup",
      selectedLocation: -1,
      selectedShippingMethod: -1,
    };

    this.scheduleRefresh = debounce(this.refresh.bind(this), 250);
  }

  translate(key, data) {
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

  get key() {
    return localStorage.reflowCartKey;
  }

  set key(key) {
    localStorage.reflowCartKey = key;
  }

  get locale() {
    return this.localization.locale || 'en-US';
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
        isUnavailable: true
      };

      this.trigger('change', this.state);
      return;
    }

    const oldState = this.state;

    this.state = {
      ...oldState,
      ...newState,
      isLoaded: true,
      isUnavailable: false
    };

    this.state.quantity = this.calculateTotalQuantity();
    this.state.deliveryMethod = this.getDeliveryMethod();

    if (newState.locations) {
      this.state.selectedLocation = this.state.locations.findIndex(l => l.chosen);
    }

    if (newState.shipping) {
      this.state.shippingMethods = this.state.shipping || [];
      this.state.selectedShippingMethod = this.state.shipping.findIndex(s => s.chosen);
    }
    
    if (newState.shipping) {
      this.state.paymentProviders = this.transformPaymentProviders(this.state.paymentProviders || []);
    }

    this.trigger('change', this.state);
  }

  isLoaded() {
    return !!this.state;
  }

  isEmpty() {
    return !this.isLoaded() || !this.state.products.length;
  }

  isUnavailable() {
    return this.unavailable;
  }

  calculateTotalQuantity() {
    return this.state ? this.state.products.reduce((prev, curr) => prev + curr.quantity, 0) : 0;
  }

  getDeliveryMethod() {
    return this.hasPhysicalProducts() ? (this.state.deliveryMethod === 'digital' ? 'pickup' : this.state.deliveryMethod) : 'digital';
  }

  setDeliveryMethod(deliveryMethod) {
    this.updateState({ deliveryMethod });

    if (deliveryMethod === "shipping" && this.state.shippingAddress) {
      this.invalidateTaxExemption({ address: this.state.shippingAddress });
    }
    else {
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

  transformPaymentProviders(paymentProviders) {
    return Object.entries(paymentProviders).map(p => p[1]).sort((a, b) => {
      return ((b.provider === 'pay-in-store' || 0) - (a.provider === 'pay-in-store') || 0) || b.order - a.order;
    });
  }

  hasPhysicalProducts() {
    return !!this.state?.products.find((p) => p.type == "physical" && p.inStock);
  }

  getShippableCountries() {
    return this.state?.shippableCountries || [];
  }

  offersShipping() {
    return this.getShippableCountries().length;
  }

  offersLocalPickup() {
    return this.state?.locations?.length;
  }

  getCountryByCode(code) {
    return this.getShippableCountries().find(c => c.country_code == code);
  }

  canDeliver() {
    return !this.state.errors.filter(e => e.type == 'delivery-unavailable').length;
  }

  canShip() {
    return !!this.state.shipping.length && !this.state.errors.filter(e => e.type == 'cannot-ship').length;
  }

  hasZeroValue() {
    return this.state.total == 0;
  }

  canFinish() {
    return !this.state.errors.filter(e => e.severity == 'fatal').length;
  }

  getErrorText(e, subject) {

    // Old format of passing errors from the server
    // ['errors' => ['system' => 'Some error message.']
  
    let errors = e?.data?.errors || {};
    let message = errors[subject] || '';
  
    if (e.data.errorCode) {
  
      // New way: passing an errorCode id that can be localized.
      // ['errorCode' => 'localization.id'] OR
      // ['errorCode' => ['code' => 'localization.id', 'formats' => ['name' => 'Joe']]
  
      if (typeof e.data.errorCode === 'string' ) {
        message = this.translate(e.data.errorCode);
      }
      else {
        message = this.translate(e.data.errorCode.code, e.data.errorCode.formats);
      }
    }
  
    return message;
  }

  getStateErrorMessage(error = {}) {

    try {

      let errorCode = error.type.replaceAll('-', '_');
      let formats = error.formats || null;

      if (formats) {
        return this.translate('cart.errors.' + errorCode, formats);
      }
      else {
        return this.translate('cart.errors.' + errorCode);
      }
    }
    catch(e) {

      // Some errors are not localized. Show a predefined string from the server response.
      return error.message || '';
    }
  }

  getStateErrors() {
    let errors = this.state.errors || [];
    return errors.map(this.getStateErrorMessage.bind(this)).filter(message => !!message);
  }

  getProductPersonalization(product) {
    if (!product.personalization?.length) return [];

    return product.personalization.map(p => {

      let personalization = { id: p.id }
  
      if (p.inputText) personalization.inputText = p.inputText;
      if (p.selected) personalization.selected = p.selected;
      if (p.filename) personalization.filename = p.filename;
      if (p.filehash) personalization.filehash = p.filehash;
  
      return personalization;
    });
  }

  getDefaultCurrencyConfig() {
    return {
      code: 'USD',
      hasDecimal: true
    };
  }

  formatCurrency(money) {

    const currencyConfig = this.state?.currencyConfig || this.getDefaultCurrencyConfig();
    let fractionDigits = 0;
  
    if (currencyConfig.hasDecimal) {
      // Currencies with cents are kept in the smallest unit ($12.34 is 1234 in the DB)
      // Divide by 100 to get the proper float value.
      // For currencies without decimals, the money is already the correct int value.
      money = money/100;
      fractionDigits = 2;
    }
  
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyConfig.code,
      maximumFractionDigits: fractionDigits
    }).format(money);
  }

  async create() {
    let result = await this.api('/carts/', {method: 'POST'}, false);
    return result.cartKey;
  }

  async fetch(key, additionalParams = {}) {

    let addon = '';
    let params = [];

    for (let param in additionalParams) {
      params.push(`${param}=${additionalParams[param]}`);
    }

    if (params.length) {
      addon = '?' + params.join('&');
    }

    return await this.api('/carts/' + key + addon, {}, false);
  }

  async refreshState(additionalParams = {}) {

    let newState;

    try {

      if (this.key) {
        newState = await this.fetch(this.key, additionalParams);
      }
      else {
        throw new Error('No Key');
      }
    }
    catch (e) {
      if (!e.status || e.status == 404) {
        // The key was either unset or invalid, create a new one
        this.key = await this.create();
        newState = await this.fetch(this.key, additionalParams);
      }
      else {
        // This is a server error, just log it for now
        console.error('Reflow:', e);
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

  async updateProduct({ product, quantity = 1 }) {

    try {

      let body = new FormData();

      let personalization = this.getProductPersonalization(product);
      if (personalization && personalization.length) {
        body.append('personalization', JSON.stringify(personalization));
      }

      let variantID = product.variant?.id;

      let result = await this.api(`/update-cart-product/${this.key}/${product.id}/` + quantity + '/' + (variantID || ''), {method: 'POST', body}, false);

      this.updateState({ quantity: result.cartQuantity });

      this.scheduleRefresh();

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async removeProduct({ product }) {

    try {

      let body = new FormData();

      let personalization = this.getProductPersonalization(product);
      if (personalization && personalization.length) {
        body.append('personalization', JSON.stringify(personalization));
      }

      let variantID = product.variant?.id;

      let result = await this.api(`/remove-cart-product/${this.key}/${product.id}/` + (variantID || ''), {method: 'POST', body}, false);

      this.updateState({ quantity: result.cartQuantity });

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

    let body = new FormData();
    body.append('address', JSON.stringify(address));
    body.append('delivery_method', deliveryMethod);

    try {
      let result = await this.api(`/update-address/${this.key}/`, {
        method: 'POST',
        body
      }, false);
  
      this.scheduleRefresh();

      if (result.taxExemptionRemoved) {
        this.trigger('tax-exemption-removed');
      }

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async updateTaxExemption({ address, deliveryMethod, exemptionType, exemptionValue }) {
    let body = new FormData();

    body.append("address", JSON.stringify(address));
    body.append("delivery-method", deliveryMethod);
    body.append(exemptionType, exemptionValue);

    try {
      let result = await this.api(
        `/update-tax-exemption/${this.key}/`,
        {
          method: "POST",
          body,
        },
        false
      );

      this.scheduleRefresh();

      return result;

    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async invalidateTaxExemption({ address }) {

    let body = new FormData();
    body.append('address', JSON.stringify(address));

    try {
      let result = await this.api(`/invalidate-tax-exemption/${this.key}/`, {
        method: 'POST',
        body
      }, false);

      this.scheduleRefresh();

      if (result.taxExemptionRemoved) {
        this.trigger('tax-exemption-removed');
      }

      return result;

    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async removeTaxExemptionFile() {
    try {
      let result = await this.api(`/remove-tax-exemption-file/${this.key}/`, {
        method: 'POST',
      }, false);

      this.scheduleRefresh();

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async addCoupon({ code }) {
    let body = new FormData();
    body.append('code', code);

    try {
      let result = await this.api(`/add-coupon/${this.key}/`, {
        method: 'POST',
        body
      }, false);

      this.scheduleRefresh();

      this.trigger('coupon-added');

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async removeCoupon() {
    try {
      let result = await this.api(`/remove-coupon/${this.key}/`, {
        method: 'POST',
      }, false);

      this.scheduleRefresh();

      this.trigger('coupon-removed');

      return result;
    } catch (e) {
      console.error("Reflow:", e);
      throw e;
    }
  }

  async checkout(formData) {

    const body = new FormData();

    for (const [key, value] of Object.entries(formData)) {
      body.append(key, value);
    }

    return await this.api(`/complete-checkout/${this.key}/`, {
      method: "POST",
      body
    }, false);
  }
}
