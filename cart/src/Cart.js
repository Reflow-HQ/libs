// Cart Manager Class

export default class Cart {
  constructor({ storeID, apiBase = "https://api.reflowhq.com/v1" }) {
    this.storeID = storeID;
    this.apiBase = apiBase;

    this._subscribers = new Map();
    this._subID = 0;
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

  subscribe(cb) {
    this._subID++;
    this._subscribers.set(this._subID, cb);
    return this._subID;
  }

  unsubscribe(subID) {
    this._subscribers.delete(subID);
  }

  notify(event, data) {
    this._subscribers.forEach((cb) => cb(event, data));
  }

  get key() {
    return localStorage.reflowCartKey;
  }

  set key(key) {
    localStorage.reflowCartKey = key;
  }

  get state() {
    return this._state;
  }

  set state(state) {
    this._state = state;
    this.quantity = this.calculateTotalQuantity();
  }

  get quantity() {
    return parseInt(localStorage.reflowCartQuantity, 10) || 0;
  }

  set quantity(quantity) {
    localStorage.reflowCartQuantity = quantity;
  }

  calculateTotalQuantity() {
    return this.state ? this.state.products.reduce((prev, curr) => prev + curr.quantity, 0) : 0;
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
    return this.state.shipping.length && !this.state.errors.filter(e => e.type == 'cannot-ship').length;
  }

  hasZeroValue() {
    return this.state.total == 0;
  }

  canFinish() {
    return !this.state.errors.filter(e => e.severity == 'fatal').length;
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

    try {

      if (this.key) {
        this.state = await this.fetch(this.key, additionalParams);
      }
      else {
        throw new Error('No Key');
      }
    }
    catch (e) {
      if (!e.status || e.status == 404) {
        // The key was either unset or invalid, create a new one
        this.key = await this.create();
        this.state = await this.fetch(this.key, additionalParams);
        // this.localFormData.clear();
      }
      else {
        // This is a server error, just log it for now
        console.error('Reflow:', e);
      }
    }
  }

  async refresh(additionalParams = {}) {
    // Fetches the state from the backend
    await this.refreshState(additionalParams);
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

      this.quantity = result.cartQuantity;

      return result;
    }
    catch (e) {
      // TODO: handle errors
    }
  }

  async removeProduct({ product }) {

    let body = new FormData();

    let personalization = this.getProductPersonalization(product);
    if (personalization && personalization.length) {
      body.append('personalization', JSON.stringify(personalization));
    }

    let variantID = product.variant?.id;

    let result = await this.api(`/remove-cart-product/${this.key}/${product.id}/` + (variantID || ''), {method: 'POST', body}, false);

    this.quantity = result.cartQuantity;

    return result;
  }

  async updateAddress({ address, deliveryMethod }) {

    // Updates the shipping/digital address and fetches the contents of the Cart with updated
    // tax regions, shipping methods, etc. taking into account the new address.

    // Only goes through if all relevant address fields are filled.

    if (!address) return;

    let body = new FormData();
    body.append('address', JSON.stringify(address));
    body.append('delivery_method', deliveryMethod);

    let result = await this.api(`/update-address/${this.key}/`, {
      method: 'POST',
      body
    }, false);

    return result;
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

      return result;

    } catch (e) {
      console.error("Reflow:", e);
    }
  }

  async invalidateTaxExemption({ address }) {

    let body = new FormData();
    body.append('address', JSON.stringify(address));

    let result = await this.api(`/invalidate-tax-exemption/${this.key}/`, {
      method: 'POST',
      body
    }, false);

    return result;
  }

  async removeTaxExemptionFile() {
    return await this.api(`/remove-tax-exemption-file/${this.key}/`, {
      method: 'POST',
    }, false);
  }

  async addCoupon({ code }) {
    let body = new FormData();
    body.append('code', code);

    let result = await this.api(`/add-coupon/${this.key}/`, {
      method: 'POST',
      body
    }, false);

    return result;
  }

  async removeCoupon() {
    return await this.api(`/remove-coupon/${this.key}/`, {
      method: 'POST',
    }, false);
  }
}
