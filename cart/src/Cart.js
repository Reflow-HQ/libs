// Cart Manager Class

export default class Cart {
  constructor() {
    this._subscribers = new Map();
    this._subID = 0;
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

  async addProduct({ productID, quantity, variantID }) {
    this.notify("loading");

    // Todo

    setTimeout(() => {
      this.notify("updated");
    }, 2000);
  }

  // Todo
  // async updateProduct({ productID, quantity, variantID }) {}
  // async removeProduct({ productID, variantID }) {}
  // Etc..
}
