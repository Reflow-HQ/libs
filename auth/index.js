class Auth {
  constructor({ storeID, apiBase = "https://api.reflowhq.com/v2", autoBind = true }) {
    this.storeID = storeID;
    this.apiBase = apiBase;

    this._boundCounter = 0;

    if (this.get("expiresAt") < Date.now()) {
      this.clear();
    }

    this._listeners = {};

    this._signInWindow = null;
    this._authToken = null;

    this._checkWindowClosedInterval = null;
    this._loginCheckInterval = null;

    this._subscriptionWindow = null;
    this._subscribeCheckInterval = null;

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
      if (!this._signInWindow) {
        return;
      }

      if (e.source !== this._signInWindow) {
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

    clearInterval(this._checkWindowClosedInterval);
    clearInterval(this._loginCheckInterval);
    clearInterval(this._subscribeCheckInterval);

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
        this.trigger("signout", { error: "user_not_found" });
        this.trigger("change");
        this.broadcast("signout", { error: "user_not_found" });
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
        this.set({ user: result.user });
        this.trigger("modify");
        this.trigger("change");
        this.broadcast("modify");
      }

      return result;
    } catch (e) {
      console.error("Reflow: Unable to update user.");
      if (e.data) console.error(e.data);

      if (e.status == 403) {
        this.clear();
        this.trigger("signout", { error: "user_not_found" });
        this.trigger("change");
        this.broadcast("signout", { error: "user_not_found" });
      }

      throw e;
    }
  }

  async signIn(options = {}) {
    if (this.isSignedIn() || this._isLoading) {
      return;
    }

    if (this._signInWindow) {
      // Already open
      this._signInWindow.focus();
      return;
    }

    // Open the signin window. Center it relative to the current one.
    const w = 600,
      h = 600;
    const y = window.outerHeight / 2 + window.screenY - h / 2;
    const x = window.outerWidth / 2 + window.screenX - w / 2;

    this._signInWindow = window.open(
      "about:blank",
      "reflow-signin",
      `width=${w},height=${h},top=${y},left=${x}`
    );

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

      this._signInWindow.close();
      this._signInWindow = null;

      this._isLoading = false;

      throw e;
    }

    let params = "?origin=" + encodeURIComponent(window.location.origin);

    if (options.subscribeTo) {
      params += "&subscribeTo=" + Number(options.subscribeTo);
    }

    this._signInWindow.location = response.signinURL + params;

    clearInterval(this._checkWindowClosedInterval);
    this._checkWindowClosedInterval = setInterval(() => {
      try {
        if (this._signInWindow && this._signInWindow.closed) {
          this._signInWindow = null;
        }
      } catch (e) {}

      if (!this._signInWindow) {
        clearInterval(this._checkWindowClosedInterval);
      }
    }, 500);

    let hasFocus = document.hasFocus();

    clearInterval(this._loginCheckInterval);
    this._loginCheckInterval = setInterval(async () => {
      if (this.isSignedIn()) {
        clearInterval(this._loginCheckInterval);
        return;
      }

      if (!this._authToken) {
        return;
      }

      if (!hasFocus && document.hasFocus()) {
        // We've switched back to this page/window. Check the login status
        hasFocus = true;
        let status;

        try {
          status = await this.api("/auth/validate-token?auth-token=" + this._authToken, {
            method: "POST",
          });
        } catch (e) {
          clearInterval(this._loginCheckInterval);
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
        }
      }

      hasFocus = document.hasFocus();
    }, 250);
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

    this.trigger("signout", { error: false });
    this.trigger("change");
    this.broadcast("signout", { error: false });

    return true;
  }

  async createSubscription(data) {
    if (this._isLoading) {
      return;
    }

    if (!this.isSignedIn()) {
      // Sign in and initiate a subscription in the same window
      this.signIn({ subscribeTo: data.priceID });
      return;
    }

    if (this._subscriptionWindow) {
      // Already open
      this._subscriptionWindow.focus();
      return;
    }

    // Open the window. Center it relative to the current one.
    const w = 600,
      h = 800;
    const y = window.outerHeight / 2 + window.screenY - h / 2;
    const x = window.outerWidth / 2 + window.screenX - w / 2;

    this._subscriptionWindow = window.open(
      "about:blank",
      "reflow-subscribe",
      `width=${w},height=${h},top=${y},left=${x}`
    );

    let body = new FormData();

    for (let key in data) {
      if (key == null) continue;
      let val = data[key];
      body.set(key, val);
    }

    let response;

    try {
      this._isLoading = true;
      response = await this.api("/auth/user/subscribe", {
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

      this._subscriptionWindow.close();
      this._subscriptionWindow = null;

      this._isLoading = false;

      throw e;
    }

    this._subscriptionWindow.location = response.checkoutURL;

    clearInterval(this._checkWindowClosedInterval);
    this._checkWindowClosedInterval = setInterval(() => {
      try {
        if (this._subscriptionWindow && this._subscriptionWindow.closed) {
          this._subscriptionWindow = null;
        }
      } catch (e) {}

      if (!this._subscriptionWindow) {
        clearInterval(this._checkWindowClosedInterval);
      }
    }, 500);

    let hasFocus = document.hasFocus();

    clearInterval(this._subscribeCheckInterval);
    this._subscribeCheckInterval = setInterval(async () => {
      if (!hasFocus && document.hasFocus()) {
        // We've switched back to this page/window. Refresh the state.
        hasFocus = true;

        clearInterval(this._subscribeCheckInterval);

        await this.refresh();
      }

      hasFocus = document.hasFocus();
    }, 250);
  }

  async modifySubscription() {
    if (!this.isSignedIn() || this._isLoading) {
      console.error("Reflow: Can't modify subscription, user is not signed in");
      return;
    }

    if (this._subscriptionWindow) {
      // Already open
      this._subscriptionWindow.focus();
      return;
    }

    // Open the window. Center it relative to the current one.
    const w = 600,
      h = 800;
    const y = window.outerHeight / 2 + window.screenY - h / 2;
    const x = window.outerWidth / 2 + window.screenX - w / 2;

    this._subscriptionWindow = window.open(
      "about:blank",
      "reflow-modify-subscription",
      `width=${w},height=${h},top=${y},left=${x}`
    );

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

      this._subscriptionWindow.close();
      this._subscriptionWindow = null;

      this._isLoading = false;

      throw e;
    }

    this._subscriptionWindow.location = response.subscriptionManagementURL;

    clearInterval(this._checkWindowClosedInterval);
    this._checkWindowClosedInterval = setInterval(() => {
      try {
        if (this._subscriptionWindow && this._subscriptionWindow.closed) {
          this._subscriptionWindow = null;
        }
      } catch (e) {}

      if (!this._subscriptionWindow) {
        clearInterval(this._checkWindowClosedInterval);
      }
    }, 500);
  }
}

export default Auth;
