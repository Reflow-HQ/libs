import {
  initializePaddle,
  Paddle
} from '@paddle/paddle-js';

class Auth {
  constructor({
    storeID,
    apiBase,
    autoBind = true,
    testMode = false
  }) {
    this.storeID = storeID;
    this.apiBase = apiBase || `https://${testMode ? "test-" : ""}api.reflowhq.com/v2`;
    this.testMode = testMode || false;

    this._boundCounter = 0;

    if (this.get("expiresAt") < Date.now()) {
      this.clear();
    }

    this._listeners = {};

    this._authToken = null;

    this._popupWindow = null;
    this._checkPopupWindowClosedInterval = null;
    this._checkPageRefocusInterval = null;

    this._paddleSubscribeCheckout = null;
    this._paddleUpdatePaymentCheckout = null;
    this._paddleCheckoutSuccessFlag = false;

    if (autoBind) {
      this.bind();
    }
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

      if (!this._popupWindow) {
        return;
      }

      if (e.source !== this._popupWindow) {
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

    clearInterval(this._checkPopupWindowClosedInterval);
    clearInterval(this._checkPageRefocusInterval);

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
      let result = await this.api("/auth/state", {
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
          error: "user_not_found"
        });
        this.trigger("change");
        this.broadcast("signout", {
          error: "user_not_found"
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

      let result = await this.api("/auth/user", {
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
          user: result.user
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
          error: "user_not_found"
        });
        this.trigger("change");
        this.broadcast("signout", {
          error: "user_not_found"
        });
      }

      throw e;
    }
  }

  async register() {
    return this.signIn({
      step: "register"
    });
  }

  async signIn(options = {}) {

    if (this.isSignedIn() || this._isLoading) {
      return;
    }

    this.openPopupWindow({
      url: null,
      label: 'reflow-signin',
      size: {
        w: 650,
        h: 650
      }
    });

    let response;

    try {
      this._isLoading = true;
      response = await this.api("/auth/urls");
      this._isLoading = false;

      if (!response.signinURL) {
        throw new Error("Unable to retrieve the auth URL");
      }
    } catch (e) {
      console.error("Reflow: " + e);
      if (e.data) console.error(e.data);
      if (e.error) console.error(e.error);

      this.closePopupWindow();

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
    this._popupWindow.location = url.toString();

    this.startPageRefocusInterval({

      stopIntervalClause: (() => this.isSignedIn() || this.isPopupWindowClosed()).bind(this),

      onRefocus: (async () => {

        if (this.isSignedIn() || !this._authToken) {
          return;
        }

        let status;

        try {
          status = await this.api("/auth/validate-token?auth-token=" + this._authToken, {
            method: "POST",
          });
        } catch (e) {
          clearInterval(this._checkPageRefocusInterval);
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

          if (options.subscribeTo && options.subscribeWith && options.subscribeWith == 'paddle') {

            // Directly go to Paddle checkout.

            this.createSubscription({
              priceID: options.subscribeTo,
              paymentProvider: 'paddle'
            })

            // For stripe, the same popup window used for sign in will redirect to the Stripe checkout URL.
            // No action is required from the library.
          }
        }
      }).bind(this)
    })
  }

  async signOut() {
    if (!this.isSignedIn()) {
      return false;
    }

    try {
      await this.api("/auth/signout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.get("key")}`,
        },
      });
    } catch (e) {
      console.error("Reflow: " + e);
      if (e.data) console.error(e.data);
    }

    // Regardless of the response, delete the local session and signout components

    this.clear();

    this.trigger("signout", {
      error: false
    });
    this.trigger("change");
    this.broadcast("signout", {
      error: false
    });

    return true;
  }

  async sendPasswordResetLink() {
    try {
      return await this.api("/auth/user/send-reset-password-email", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.get("key")}`,
        },
      });
    } catch (e) {
      console.error("Reflow: Unable to send reset password link email.");
      if (e.data) console.error(e.data);

      throw e;
    }
  }

  async createSubscription(data) {

    if (this._isLoading) {
      return;
    }

    if (!this.isSignedIn()) {
      // Sign in and initiate a subscription in the same window

      let signInOptions = {
        subscribeTo: data.priceID
      }

      if (data.paymentProvider) {
        signInOptions.subscribeWith = data.paymentProvider;
      }

      this.signIn(signInOptions);
      return;
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

      checkoutData = await this.api("/auth/user/subscribe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.get("key")}`,
        },
        body,
      });

      this._isLoading = false;

    } catch (e) {

      console.error("Reflow: " + e);
      if (e.data) console.error(e.data);

      this.closePopupWindow();

      this._isLoading = false;

      throw e;
    }

    if (checkoutData.provider == 'stripe') {

      // Stripe subscriptions are handled in a popup window that redirects to the checkout url.

      this.openPopupWindow({
        url: checkoutData.checkoutURL,
        label: 'reflow-subscription',
        size: {
          w: 650,
          h: 800
        }
      });

      this.startPageRefocusInterval({
        stopIntervalClause: this.isPopupWindowClosed.bind(this),
        onRefocus: this.refresh.bind(this)
      });
    }

    if (checkoutData.provider == 'paddle') {

      if (!this._paddleSubscribeCheckout) {

        this._paddleSubscribeCheckout = await initializePaddle({
          environment: this.testMode ? 'sandbox' : 'production',
          seller: checkoutData.seller_id,
          eventCallback: function (data) {

            if (data.name == "checkout.completed") {
              this._paddleCheckoutSuccessFlag = true;
            }

            if (data.name == "checkout.closed" && this._paddleCheckoutSuccessFlag) {

              this._paddleCheckoutSuccessFlag = false;

              this.openPopupWindow({
                url: `${this.apiBase}/subscription/processing?store_id=${this.storeID}&user_id=${this.user.id}`,
                label: 'reflow-subscription',
                size: {
                  w: 650,
                  h: 800
                }
              });

              this.startPageRefocusInterval({
                stopIntervalClause: () => (this.isPopupWindowClosed() && this.subscription),
                onRefocus: this.refresh.bind(this)
              });

            }
          }.bind(this)
        });
      }

      let checkoutSettings = {
        settings: {
          showAddDiscounts: false,
        },
        items: [{
          priceId: checkoutData.paddle_price_id,
          quantity: 1
        }],
        customData: {
          store_id: this.storeID.toString(),
          user_id: this.user.id.toString(),
          price_id: data.priceID
        }
      }

      if (this.user.email) {
        checkoutSettings.customer = {
          email: this.user.email
        }
      }

      this._paddleSubscribeCheckout.Checkout.open(checkoutSettings)
    }

  }

  async modifySubscription() {
    if (!this.isSignedIn() || this._isLoading) {
      console.error("Reflow: Can't modify subscription, user is not signed in");
      return;
    }

    let response;

    try {
      this._isLoading = true;

      response = await this.api("/auth/user/manage-subscription", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.get("key")}`,
        },
      });

      this._isLoading = false;

    } catch (e) {

      console.error("Reflow: " + e);
      if (e.data) console.error(e.data);

      this.closePopupWindow();

      this._isLoading = false;

      throw e;
    }

    if (response.provider == 'stripe') {

      // TODO: isn't there high chance that the api call takes too long and this doesn't open
      // because chrome thinks its not caused by user action?

      this.openPopupWindow({
        url: response.subscriptionManagementURL,
        label: 'reflow-subscription',
        size: {
          w: 650,
          h: 800
        }
      });

      this.startPageRefocusInterval({
        stopIntervalClause: this.isPopupWindowClosed.bind(this),
        onRefocus: this.refresh.bind(this)
      });
    }

    if (response.provider == 'paddle') {

      this.openDialog();
      this.renderPaddleSubscriptionDialog(response);
    }
  }

  openPopupWindow(options) {

    if (this._popupWindow) {
      // Already open
      this._popupWindow.focus();
      return;
    }

    const {
      url,
      label,
    } = options;

    const {
      w,
      h
    } = options.size;
    const y = window.outerHeight / 2 + window.screenY - h / 2;
    const x = window.outerWidth / 2 + window.screenX - w / 2;

    this._popupWindow = window.open(
      url || "about:blank",
      label,
      `width=${w},height=${h},top=${y},left=${x}`
    );

    // This interval cleans up the _popupWindow after the popup window is closed.

    clearInterval(this._checkPopupWindowClosedInterval);
    this._checkPopupWindowClosedInterval = setInterval(() => {
      try {
        if (this._popupWindow && this._popupWindow.closed) {
          this._popupWindow = null;
        }
      } catch (e) {}

      if (!this._popupWindow) {
        clearInterval(this._checkPopupWindowClosedInterval);
      }
    }, 500);

  }

  closePopupWindow() {
    if (this._popupWindow) {
      this._popupWindow.close();
      this._popupWindow = null;
    }
  }

  isPopupWindowOpen() {
    return !!this._popupWindow;
  }

  isPopupWindowClosed() {
    return !this._popupWindow;
  }

  startPageRefocusInterval(options) {

    // Run a callback function when the focus goes back on the main window (regardless if _popupWindow was closed)

    const {
      stopIntervalClause,
      onRefocus
    } = options;

    let hasFocus = document.hasFocus();

    clearInterval(this._checkPageRefocusInterval);
    this._checkPageRefocusInterval = setInterval(async () => {

      if (!hasFocus && document.hasFocus()) {

        // We've selected something else and then switched back to this page/window.

        onRefocus();
      }

      if (stopIntervalClause()) {

        // Clear the interval and exit when the provided function returns true.

        clearInterval(this._checkPageRefocusInterval);
      }

      // This line makes sure the focus has been lost in the first place,
      // in case hasFocus has been true from the beginning.

      hasFocus = document.hasFocus();
    }, 250);

  }

  openDialog() {

    if (!this._dialog) {
      this._dialog = document.createElement('dialog');
      this._dialog.style = "min-width: 800px; border: 1px solid #ccc; font-size: 16px; padding: 25px";
      document.body.append(this._dialog);
      this._dialog.addEventListener('close', () => {
        this.closeDialog();
      });
    }

    if (!this._dialog.open) {
      this._dialog.showModal();
    }
  }

  closeDialog() {
    if (this._dialog) {
      this._dialog.close();
      this._dialog.remove();
      this._dialog = null;
    }
  }

  renderPaddleSubscriptionDialog(data) {

    // TODO: offer localization here?

    this._dialog.innerHTML = `
<div style="display:flex; justify-content:space-between;">
  <h3 style="font-size: 1.6em; margin-top: 0;">Manage Subscription</h3>
  <span title="Close" style="font-size: 2em; cursor: pointer; line-height: 1;" class="ref-sub-dialog-close">×</span>
</div>

<div>Status: ${data.subscription.status}</div>

<div>
  <h4 style="font-size: 1.4em;" class="ref-plans-title">Update Your Plan</h4>
  <div class="ref-plans"></div>
  <button style="font-size: 1em;" class="ref-update-plan" disabled>Update Plan</button>
</div>
  
<div>
  <button style="font-size: 1em; margin: 1em 0;" class="ref-edit-payment">Edit Payment Method</button>
</div>

<div>
  <a class="ref-sub-cancel" target="_blank" style="font-size: 1em; color: red; cursor: pointer;">Cancel Subscription</a>
</div>

<div>
  <h4 style="font-size: 1.4em;">Billing Information</h4>
  <p class="ref-sub-billing-name"><b>Name</b> <span></span></p>
  <p class="ref-sub-billing-email"><b>Email</b> <span></span></p>
  <p class="ref-sub-billing-address"><b>Address</b> <span></span></p>
  <p class="ref-sub-billing-tax"><b>Tax ID</b> <span></span></p>
</div>

<div>
  <h4 style="font-size: 1.4em;">Recent Payments</h4>
  <div class="ref-sub-payments"></div>
</div>
`;

    const close = this._dialog.querySelector('.ref-sub-dialog-close');
    close.addEventListener('click', (e) => {
      this.closeDialog();
    });

    console.log(data);

    // Update plan

    // TODO: don't use _formatted

    let currentPlan = data.subscription.plan;
    let currentPrice = data.subscription.price;
    let refPlansContainer = this._dialog.querySelector('.ref-plans');

    if (!data.available_plans.length) {

      // Can't update the plan.

      renderUpdateOption({
        plan: currentPlan,
        prices: [currentPrice]
      }, refPlansContainer, data.subscription);

      this._dialog.querySelector('.ref-update-plan').remove();
      this._dialog.querySelector('.ref-plans-title').textContent = 'Current Plan';

    } else {

      let isCurrentAvailable = false;

      for (const updateOption of data.available_plans) {

        if (currentPlan.id != updateOption.plan.id) continue;

        for (const price of updateOption.prices) {
          if (price.id === currentPrice.id) {
            isCurrentAvailable = true;
            break;
          }
        }

        if (isCurrentAvailable) {
          break;
        }
      }

      if (!isCurrentAvailable) {

        // The current plan is no longer available.
        // Add the current plan as the first "available" plan. 
        // It will be selectable but not usable for updates.

        currentPlan.is_disabled = true;
        currentPrice.is_disabled = true;

        renderUpdateOption({
          plan: currentPlan,
          prices: [currentPrice]
        }, refPlansContainer, data.subscription);
      }

      for (const updateOption of data.available_plans) {
        renderUpdateOption(updateOption, refPlansContainer, data.subscription);
      }

      this._dialog.addEventListener('click', async (e) => {

        if (!this._dialog) return;

        let selectedPrice = this._dialog.querySelector('.ref-price.ref-price-selected');
        let clickedPrice = e.target.closest('.ref-price');

        if (clickedPrice) {

          selectedPrice && selectedPrice.classList.remove('ref-price-selected');

          clickedPrice.classList.add('ref-price-selected');

          this._dialog.querySelector('.ref-update-plan').disabled = clickedPrice.dataset.is_disabled || clickedPrice.dataset.is_current;

          this._dialog.querySelectorAll('.ref-price-proration-info').forEach(element => {
            element.style.display = 'none';
          });

          clickedPrice.querySelector('.ref-price-proration-info') && (clickedPrice.querySelector('.ref-price-proration-info').style.display = 'block');
        }

        let updatePlanButton = e.target.closest('.ref-update-plan');
        if (updatePlanButton) {

          if (selectedPrice.dataset.is_disabled || selectedPrice.dataset.is_current || !selectedPrice.dataset.price_id) return;

          if (!this.isSignedIn() || this._isLoading) {
            console.error("Reflow: Can't modify subscription, user is not signed in");
            return;
          }

          let response;
          let loadingIndicator = document.createElement("span");
          loadingIndicator.className = "ref-loading-indicator";
          loadingIndicator.textContent = " Loading...";

          try {

            this._isLoading = true;

            updatePlanButton.append(loadingIndicator);

            let body = new FormData();
            body.set('price_id', selectedPrice.dataset.price_id);

            response = await this.api("/auth/user/update-plan", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${this.get("key")}`,
              },
              body
            });

            this._isLoading = false;
            loadingIndicator && loadingIndicator.remove();

          } catch (e) {

            // TODO: how should we handle errors here? add something similar to Cart.onMessage? 

            console.error("Reflow: " + e);
            if (e.data) console.error(e.data);
            this._isLoading = false;
            loadingIndicator && loadingIndicator.remove();
            throw e;
          }

          // TODO: how do we handle success here? We can get the update sub from paddle
          // but that does not guarantee we've received and handled the webhook.

          let paddleSubscriptionAfterUpdate = response.paddle_subscription;
          let newPrice = paddleSubscriptionAfterUpdate.items[0].price;

          // Refresh the user and rerender the dialog to show the new subscription state
          alert(`New plan: #${newPrice.id} ${newPrice.description}`);
        }

      });
    }

    function renderUpdateOption(updateOption, container, subscription) {

      let currentPrice = subscription.price;

      let planHTML = document.createElement('div');
      planHTML.innerHTML = `<div style="border: 1px solid #ccc; padding: 1em; margin-bottom: 1.5em;" class="ref-plan">
        <h5 style="margin-top: 0;">${updateOption.plan.name}</h5>
        <div class="ref-prices" style="display: flex;"></div>
      </div>`;

      for (const price of updateOption.prices) {
        let priceHTML = document.createElement('div');
        priceHTML.style = "border: 1px solid #ccc; padding: 1em; margin-bottom: 1em; margin-right: 1em; cursor: pointer; max-width: 350px;";
        priceHTML.dataset.price_id = price.id;
        priceHTML.className = 'ref-price';
        priceHTML.innerHTML = `<p>${price.price_formatted + ' / ' + price.billing_period}</p>`;

        if (price.id == currentPrice.id) {

          let currentBadge = document.createElement('span')
          currentBadge.textContent = 'Current Plan' + (price.is_disabled ? ' (No Longer Available)' : '');
          currentBadge.style.color = '#fff';
          currentBadge.style.padding = '.5em';
          currentBadge.style.borderRadius = '1em';
          priceHTML.prepend(currentBadge);

          priceHTML.dataset.is_current = true;

          if (price.is_disabled) {
            priceHTML.style.borderColor = "gray";
            priceHTML.style.background = "lightgray";
            priceHTML.dataset.is_disabled = true;
            currentBadge.style.background = "lightgray";
          } else {
            priceHTML.style.color = "blue";
            priceHTML.style.borderColor = "blue";
            currentBadge.style.background = "blue";
          }

        } else {

          let prorationInfo = document.createElement('div');
          let date, prorationText;
          prorationInfo.style = 'display: none;'
          prorationInfo.classList.add('ref-price-proration-info');

          if (data.subscription.status == 'trialing') {

            // Trial will stop. Billing date will be now.
            date = new Date();
            prorationText = 'Changing your subscription plan will stop your free trial. You will be billed immediately to reflect the new pricing.';

          } else if (currentPrice.billing_period != price.billing_period || (!currentPrice.price && price.price)) {

            // Changes billing date.
            date = new Date();
            prorationText = 'You will be billed immediately to reflect the new pricing.';

          } else {

            // Keeps billing date.
            date = new Date(data.subscription.next_billing * 1000);
            prorationText = 'Your next payment will be prorated to account for the updated pricing. The billing schedule will remain the same.';
          }

          date = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          prorationInfo.innerHTML = `<b>Next payment on: ${date}.</b><p>${prorationText}</p>`;

          priceHTML.append(prorationInfo);
        }


        planHTML.querySelector('.ref-prices').append(priceHTML);
      }

      container.append(planHTML);
    }

    // Cancel button or displaying the canceled status

    if (data.cancel_url) {

      this._dialog.querySelector('.ref-sub-cancel').addEventListener('click', (e) => {

        this.openPopupWindow({
          url: data.cancel_url,
          label: 'reflow-subscription',
          size: {
            w: 500,
            h: 500
          }
        });

        this.startPageRefocusInterval({
          stopIntervalClause: this.isPopupWindowClosed.bind(this),
          onRefocus: (() => {
            // Fetch the subscription data and rerender this dialog
            this.modifySubscription();
          }).bind(this)
        });

      });
    } else if (data.subscription.cancel_at) {
      let date = new Date(data.subscription.cancel_at * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      this._dialog.querySelector('.ref-sub-cancel').textContent = 'Your subscription will be canceled on ' + date;
    } else {
      this._dialog.querySelector('.ref-sub-cancel').remove();
    }

    // Update payment

    let transactionID = data.update_payment_transaction_id;
    let sellerID = data.paddle_seller_id;

    if (!transactionID || !sellerID) {
      this._dialog.querySelector('.ref-edit-payment').remove();
    } else {
      this._dialog.querySelector('.ref-edit-payment').addEventListener('click', async (e) => {

        if (!this._paddleUpdatePaymentCheckout) {

          this._paddleUpdatePaymentCheckout = await initializePaddle({
            environment: this.testMode ? 'sandbox' : 'production',
            seller: sellerID,
            eventCallback: function (data) {

              if (data.name == "checkout.completed") {}

              if (data.name == "checkout.closed") {
                this.modifySubscription();
              }

            }.bind(this)
          });
        }

        this.closeDialog();

        this._paddleUpdatePaymentCheckout.Checkout.open({
          transactionId: data.update_payment_transaction_id
        });

      });
    }

    // Billing info

    let name = this._dialog.querySelector('.ref-sub-billing-name');
    data.billing.name ? name.lastElementChild.textContent = data.billing.name : name.remove();

    let email = this._dialog.querySelector('.ref-sub-billing-email');
    data.billing.email ? email.lastElementChild.textContent = data.billing.email : email.remove();

    let address = this._dialog.querySelector('.ref-sub-billing-address');
    data.billing.address ? address.lastElementChild.textContent = `${data.billing.address.line1 || ''} ${data.billing.address.city || ''} ${data.billing.address.country}` : address.remove();

    let tax = this._dialog.querySelector('.ref-sub-billing-tax');
    data.billing.taxes.tax_ids.length ? tax.lastElementChild.textContent = data.billing.taxes.tax_ids[0].value : tax.remove();

    // Payments

    let paymentsTable = document.createElement("table");
    paymentsTable.style = "width: 100%; text-align: left;";
    let headerRow = paymentsTable.insertRow();
    let headers = ["Invoice Number", "Status", "Created", "Total", "Subtotal", "Taxes", "Link"];
    headers.forEach(headerText => {
      let th = document.createElement("th");
      th.textContent = headerText;
      headerRow.appendChild(th);
    });

    for (const payment of data.recent_payments) {
      let row = paymentsTable.insertRow();

      let cell = row.insertCell();
      cell.textContent = payment.invoice_number;

      cell = row.insertCell();
      cell.textContent = payment.status;

      cell = row.insertCell();
      cell.textContent = payment.created;

      // TODO: dont use _formatted
      cell = row.insertCell();
      cell.textContent = payment.total_formatted;

      cell = row.insertCell();
      cell.textContent = payment.subtotal_formatted;

      cell = row.insertCell();
      cell.textContent = payment.tax.amountFormatted;
      cell = row.insertCell();
      cell.textContent = '?';
    }

    this._dialog.querySelector('.ref-sub-payments').append(paymentsTable);
  }
}

export default Auth;
