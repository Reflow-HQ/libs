import { initializePaddle } from "@paddle/paddle-js";
import PopupWindow from "../helpers/PopupWindow.mjs";
import PaddleManageSubscriptionDialog from "../helpers/dialogs/PaddleManageSubscriptionDialog.mjs";
import LoadingDialog from "../helpers/dialogs/LoadingDialog.mjs";
import Api from "../helpers/Api.mjs";

class Auth {
  constructor({ storeID, apiBase, autoBind = true, testMode = false }) {
    this.storeID = storeID;
    this.testMode = testMode || false;

    this._boundCounter = 0;

    if (this.get("expiresAt") < Date.now()) {
      this.clear();
    }

    this._listeners = {};

    this._isLoading = false;

    this._authToken = null;

    this._api = new Api({
      storeID,
      apiBase,
      testMode,
    });

    this._popupWindow = new PopupWindow({});
    this._paddleManageSubscriptionDialog = null;
    this._loadingDialog = null;

    this._paddleSubscribeCheckout = null;
    this._paddleSubscriptionCheckInterval = null;

    if (autoBind) {
      this.bind();
    }
  }

  initializeDialogs() {
    if (document.querySelector(".reflow-auth-dialog-container")) {
      // The container is present on the page. Dialogs should be working.
      return;
    }

    // Add the dialog container to the page and initialize / reinitialize the dialogs.
    let dialogContainer = document.createElement("div");
    dialogContainer.classList.add("reflow-auth-dialog-container");
    document.body.append(dialogContainer);

    this._loadingDialog = new LoadingDialog({
      container: dialogContainer,
    });

    this._paddleManageSubscriptionDialog = new PaddleManageSubscriptionDialog({
      container: dialogContainer,
      updatePlan: async (priceID) => {
        let body = new FormData();
        body.set("priceID", priceID);

        let response = await this._api.fetch("auth/user/update-plan", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.get("key")}`,
          },
          body,
        });

        return response;
      },
      cancelSubscription: async () => {
        let response = await this._api.fetch("auth/user/cancel-subscription", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.get("key")}`,
          },
        });

        return response;
      },
    });
  }

  get(key, def = null) {
    let data = {};

    try {
      data = JSON.parse(localStorage["reflowAuth" + this.storeID]);
    } catch (e) {}

    if (key) {
      return key in data ? data[key] : def;
    }

    return data;
  }

  set(obj) {
    let data = this.get();
    Object.assign(data, obj);
    localStorage["reflowAuth" + this.storeID] = JSON.stringify(data);
  }

  clear() {
    delete localStorage["reflowAuth" + this.storeID];
  }

  isSignedIn() {
    return !!this.get("key");
  }

  isSubscribed() {
    return this.isSignedIn() && !!this.subscription;
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

  isLoading() {
    return this._isLoading;
  }

  get user() {
    return this.get("user");
  }

  get subscription() {
    return this.get("subscription");
  }

  userSameAs(user) {
    return JSON.stringify(this.user) === JSON.stringify(user);
  }

  subscriptionSameAs(sub) {
    return JSON.stringify(this.subscription) === JSON.stringify(sub);
  }

  setIsNew() {
    sessionStorage["reflowAuth" + this.storeID + "IsNew"] = "1";
  }

  isNew() {
    return sessionStorage["reflowAuth" + this.storeID + "IsNew"] === "1";
  }

  clearIsNew() {
    delete sessionStorage["reflowAuth" + this.storeID + "IsNew"];
  }

  bind() {
    this._boundCounter++;

    if (this._boundCounter > 1) {
      // Only one set of event listeners can be bound at a time so we don't proceed further.
      return;
    }

    // Use BroadcastChannel for cross-tab communication

    if ("BroadcastChannel" in window) {
      this._broadcastChannel = new BroadcastChannel("reflow-auth");
      this._broadcastChannel.onmessage = (e) => {
        if (e.data.type == "signout") {
          this.clear();
          this.trigger("signout", {
            error: e.data.error,
          });
          this.trigger("change");
        }
        if (e.data.type == "signin") {
          if (e.data.isNew) this.setIsNew();

          this.trigger("signin", {
            user: this.user,
          });

          this.trigger("change");
        }
        if (e.data.type == "modify") {
          this.trigger("modify");
          this.trigger("change");
        }
      };
    }

    // Listen for messages from the signin window

    this._messageListener = (e) => {
      if (!this._popupWindow.getWindowInstance()) {
        return;
      }

      if (e.source !== this._popupWindow.getWindowInstance()) {
        return;
      }

      if (e.data.authToken) {
        this._authToken = e.data.authToken;
      }
    };

    window.addEventListener("message", this._messageListener);

    if (this.isSignedIn() && Date.now() - this.get("lastRefresh", 0) > 5 * 60 * 1000) {
      // The last refresh was more than 5 minutes ago. Fetch the latest state from Reflow
      setTimeout(this.refresh.bind(this), 20);
    }
  }

  unbind() {
    this._boundCounter = Math.max(this._boundCounter - 1, 0);

    if (this._boundCounter > 0) {
      // This auth instance still has other users. Don't unbind.
      return;
    }

    clearInterval(this._paddleSubscriptionCheckInterval);

    this._popupWindow.unbind();

    window.removeEventListener("message", this._messageListener);

    if (this._broadcastChannel) {
      this._broadcastChannel.close();
      this._broadcastChannel = null;
    }
  }

  isBound() {
    return this._boundCounter > 0;
  }

  broadcast(event, passthrough) {
    if (this._broadcastChannel) {
      this._broadcastChannel.postMessage({
        type: event,
        ...passthrough,
      });
    }
  }

  async getToken() {
    if (!this.hasToken()) {
      return null;
    }

    if ((this.parseToken("exp") - 59) * 1000 < Date.now()) {
      // The token is less than a minute from expiring
      await this.refresh();
    }

    return this.get("token");
  }

  hasToken() {
    return !!this.get("token");
  }

  parseToken(key) {
    if (!this.hasToken()) {
      return null;
    }

    const parsed = JSON.parse(atob(this.get("token").split(".")[1]));

    if (key != null) {
      return parsed[key];
    }

    return parsed;
  }

  async refresh() {
    // Requests the user from the server without caching

    try {
      let result = await this._api.fetch("auth/state", {
        headers: {
          Authorization: `Bearer ${this.get("key")}`,
        },
      });

      this.set({
        token: result.token,
        lastRefresh: Date.now(),
      });

      if (!this.userSameAs(result.user) || !this.subscriptionSameAs(result.subscription)) {
        this.set({
          user: result.user,
          subscription: result.subscription,
        });
        this.trigger("modify");
        this.trigger("change");
        this.broadcast("modify");
      }
    } catch (e) {
      console.error("Reflow: Unable to fetch user");
      if (e.data) console.error(e.data);

      if (e.status == 403) {
        // User could not be fetched.
        // Delete the local session and signout components.

        this.clear();
        this.trigger("signout", {
          error: "user_not_found",
        });
        this.trigger("change");
        this.broadcast("signout", {
          error: "user_not_found",
        });
      }

      throw e;
    }
  }

  async updateUser(data) {
    try {
      let body = new FormData();

      for (let key in data) {
        if (key == null) continue;
        let val = data[key];

        if (key == "meta") {
          val = JSON.stringify(val);
        }

        body.set(key, val);
      }

      let result = await this._api.fetch("auth/user", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.get("key")}`,
        },
        body,
      });

      this.set({
        token: result.token,
        lastRefresh: Date.now(),
      });

      if (!this.userSameAs(result.user)) {
        this.set({
          user: result.user,
        });
        this.trigger("modify");
        this.trigger("change");
        this.broadcast("modify");
      }

      // The email update needs verification
      if (result["email_update"]) {
        this.newEmail = result["email_update"]["new_email"];

        if (!this._emailUpdatedListenerBound) {
          this._emailUpdatedListener = async () => {
            await this.refresh();

            if (this.user.email === this.newEmail) {
              window.removeEventListener("focus", this._emailUpdatedListener, false);
              this._emailUpdatedListenerBound = false;
            }
          };

          window.addEventListener("focus", this._emailUpdatedListener, false);
          this._emailUpdatedListenerBound = true;
        }
      }

      return result;
    } catch (e) {
      console.error("Reflow: Unable to update user.");
      if (e.data) console.error(e.data);

      if (e.status == 403) {
        this.clear();
        this.trigger("signout", {
          error: "user_not_found",
        });
        this.trigger("change");
        this.broadcast("signout", {
          error: "user_not_found",
        });
      }

      throw e;
    }
  }

  async register() {
    return this.signIn({
      step: "register",
    });
  }

  async signIn(options = {}) {
    if (this.isSignedIn() || this.isLoading()) {
      return;
    }

    this._popupWindow.open({
      url: null,
      label: "reflow-signin",
      size: {
        w: 650,
        h: 650,
      },
      onParentRefocus: (async () => {
        if (this.isSignedIn()) {
          this._popupWindow.offParentRefocus();
          return;
        }

        if (!this._authToken) {
          return;
        }

        let status;

        try {
          status = await this._api.fetch("auth/validate-token?auth-token=" + this._authToken, {
            method: "POST",
          });
        } catch (e) {
          this._popupWindow.offParentRefocus();
          return;
        }

        if (status.valid) {
          this.clearIsNew();

          if (status.isNew) {
            this.setIsNew();
          }

          this.set({
            key: status.session,
            expiresAt: Date.now() + status.lifetime * 1000,
            user: status.user,
            subscription: status.subscription,
            token: status.token,
            lastRefresh: Date.now(),
          });

          this.trigger("signin", {
            user: status.user,
          });

          this.trigger("change");

          this.broadcast("signin", {
            isNew: status.isNew,
          });

          if (options.subscribeTo && options.subscribeWith && options.subscribeWith == "paddle") {
            // Directly go to Paddle checkout.

            this.createSubscription({
              priceID: options.subscribeTo,
              paymentProvider: "paddle",
            });

            // For stripe, the same popup window used for sign in will redirect to the Stripe checkout URL.
            // No action is required from the library.
          }
        }
      }).bind(this),
    });

    let response;

    try {
      this._isLoading = true;
      response = await this._api.fetch("auth/urls");
      this._isLoading = false;

      if (!response.signinURL) {
        throw new Error("Unable to retrieve the auth URL");
      }
    } catch (e) {
      this._popupWindow.close();
      this._isLoading = false;
      throw e;
    }

    const url = new URL(response.signinURL);
    const params = new URLSearchParams(url.search);
    params.append("origin", window.location.origin);
    params.append("step", options.step || "login");

    if (options.subscribeTo) {
      params.append("subscribeTo", Number(options.subscribeTo));
    }

    if (options.subscribeWith) {
      params.append("subscribeWith", options.subscribeWith);
    }

    url.search = params.toString();
    this._popupWindow.setURL(url.toString());
  }

  async signOut() {
    if (!this.isSignedIn()) {
      return false;
    }

    try {
      await this._api.fetch("auth/signout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.get("key")}`,
        },
      });
    } catch (e) {}

    // Regardless of the response, delete the local session and signout components

    this.clear();

    this.trigger("signout", {
      error: false,
    });
    this.trigger("change");
    this.broadcast("signout", {
      error: false,
    });

    return true;
  }

  async sendPasswordResetLink() {
    return await this._api.fetch("auth/user/send-reset-password-email", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.get("key")}`,
      },
    });
  }

  async createSubscription(data) {
    if (this.isLoading()) {
      return;
    }

    this.initializeDialogs();

    let paymentProvider = data.paymentProvider || "stripe";

    if (!this.isSignedIn()) {
      // Sign in and initiate a subscription in the same window

      let signInOptions = {
        subscribeTo: data.priceID,
        subscribeWith: paymentProvider,
      };

      this.signIn(signInOptions);
      return;
    }

    if (paymentProvider == "stripe") {
      // Stripe checkout is displayed in a Stripe-hosted page loaded inside a popup window.
      // Open the window in an empty state immediately to make sure the browser understands it was opened due to user action.

      this._popupWindow.open({
        url: null,
        label: "reflow-subscription",
        size: {
          w: 650,
          h: 800,
        },
        onParentRefocus: (() => {
          this.refresh.bind(this);

          setTimeout(() => {
            if (this._popupWindow.isClosed()) {
              this._popupWindow.offParentRefocus();
            }
          }, 500);
        }).bind(this),
      });
    }

    // Get the data necessary for continuing to checkout.
    // For stripe that is a checkout URL.
    // For paddle, its seller and price ids.

    let checkoutData;
    let body = new FormData();

    for (let key in data) {
      if (key == null) continue;
      let val = data[key];
      body.set(key, val);
    }

    try {
      this._isLoading = true;

      checkoutData = await this._api.fetch("auth/user/subscribe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.get("key")}`,
        },
        body,
      });

      this._isLoading = false;
    } catch (e) {
      this._popupWindow.close();
      this._isLoading = false;
      throw e;
    }

    if (checkoutData.provider == "stripe") {
      // Stripe subscriptions are handled in a popup window that redirects to the checkout url.

      this._popupWindow.setURL(checkoutData.checkoutURL);
    }

    if (checkoutData.provider == "paddle") {
      if (!this._paddleSubscribeCheckout) {
        this._paddleSubscribeCheckout = await initializePaddle({
          environment: this.testMode ? "sandbox" : "production",
          seller: checkoutData.seller_id,
          eventCallback: function (data) {
            if (data.name == "checkout.closed" && data.data.status == "completed") {
              this._loadingDialog.open();

              clearInterval(this._paddleSubscriptionCheckInterval);
              this._paddleSubscriptionCheckInterval = setInterval(async () => {
                let res = await this._api.fetch(`users/${this.user.id}/subscription/status`, {
                  method: "GET",
                });

                if (res.is_subscribed) {
                  clearInterval(this._paddleSubscriptionCheckInterval);
                  this._loadingDialog.close();
                  this.refresh();
                }
              }, 1000 * 1); // Check every second

              setTimeout(() => {
                clearInterval(this._paddleSubscriptionCheckInterval);
                this._loadingDialog.close();
              }, 1000 * 60 * 2); // Give up after 2 mins
            }
          }.bind(this),
        });
      }

      let checkoutSettings = {
        settings: {
          showAddDiscounts: false,
        },
        items: [
          {
            priceId: checkoutData.paddle_price_id,
            quantity: 1,
          },
        ],
        customData: {
          store_id: this.storeID.toString(),
          user_id: this.user.id.toString(),
          price_id: data.priceID,
        },
      };

      if (this.user.email) {
        checkoutSettings.customer = {
          email: this.user.email,
        };
      }

      this._paddleSubscribeCheckout.Checkout.open(checkoutSettings);
    }
  }

  async modifySubscription() {
    if (!this.isSignedIn()) {
      console.error("Reflow: Can't modify subscription, user is not signed in");
      return;
    }

    if (this.isLoading()) {
      return;
    }

    this.initializeDialogs();

    let onSuccess = (() => this.refresh()).bind(this);

    let provider = this.subscription.payment_provider || "stripe";

    if (provider == "stripe") {
      // If the subscription is stripe based, prepare a popup window for the Stripe-hosted management page.

      this._popupWindow.open({
        url: null,
        label: "reflow-subscription",
        size: {
          w: 650,
          h: 800,
        },
        onParentRefocus: (() => {
          onSuccess();

          setTimeout(() => {
            if (this._popupWindow.isClosed()) {
              this._popupWindow.offParentRefocus();
            }
          }, 500);
        }).bind(this),
      });
    } else if (provider == "paddle") {
      // For paddle subscriptions we show a loading dialog.

      this._loadingDialog.open();
    }

    let response;

    try {
      this._isLoading = true;

      response = await this._api.fetch("auth/user/manage-subscription", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.get("key")}`,
        },
      });

      this._loadingDialog.close();
      this._isLoading = false;
    } catch (e) {
      this._popupWindow.close();
      this._loadingDialog.close();
      this._isLoading = false;

      throw e;
    }

    if (response.provider == "stripe") {
      this._popupWindow.setURL(response.subscriptionManagementURL);
    }

    if (response.provider == "paddle") {
      this._paddleManageSubscriptionDialog.open(response, onSuccess);
    }
  }
}

export default Auth;
