class Auth {
  constructor({ storeID, apiBase = "https://api.reflowhq.com/v1", autoBind = true }) {
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

  get profile() {
    return this.get("profile");
  }

  profileSameAs(prof) {
    return JSON.stringify(this.profile) === JSON.stringify(prof);
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

    // Listen to the broadcast channel for cross-tab communication

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
            profile: e.data.profile,
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

    this._refreshInterval = setInterval(() => {
      if (this.isSignedIn() && this.get("refreshAt") < Date.now()) {
        // Fetch the profile from server and update the local storage object.
        this.refresh();
      }
    }, 1000 * 60); // Check every minute
  }

  unbind() {
    this._boundCounter = Math.max(this._boundCounter - 1, 0);

    if (this._boundCounter > 0) {
      // This auth instance still has other users. Don't unbind.
      return;
    }

    clearInterval(this._refreshInterval);
    clearInterval(this._checkWindowClosedInterval);
    clearInterval(this._loginCheckInterval);

    window.removeEventListener("message", this._messageListener);

    if (this._broadcastChannel) {
      this._broadcastChannel.close();
      this._broadcastChannel = null;
    }
  }

  isBound() {
    return this._boundCounter > 0;
  }

  scheduleRefresh() {
    // Saves a timestamp 5 minutes into the future in local storage.
    // When the time is reached, the profile is fetched from the server.

    this.set({
      refreshAt: Date.now() + 60 * 5 * 1000,
    });
  }

  broadcast(event, passthrough) {
    if (this._broadcastChannel) {
      this._broadcastChannel.postMessage({
        type: event,
        ...passthrough,
      });
    }
  }

  async refresh() {
    // Requests the profile from the server without caching

    try {
      let result = await this.api("/auth/profile", {
        headers: {
          Authorization: `Bearer ${this.get("key")}`,
        },
      });

      this.scheduleRefresh();

      if (!this.profileSameAs(result)) {
        this.set({ profile: result });
        this.trigger("modify");
        this.trigger("change");
        this.broadcast("modify");
      }
    } catch (e) {
      console.error("Reflow: Unable to fetch profile");
      if (e.data) console.error(e.data);

      if (e.status == 403) {
        // Profile could not be fetched.
        // Delete the local session and signout components.

        this.clear();
        this.trigger("signout", { error: "profile_not_found" });
        this.trigger("change");
        this.broadcast("signout", { error: "profile_not_found" });
      }

      throw e;
    }
  }

  async updateProfile(data) {
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

      let result = await this.api("/auth/profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.get("key")}`,
        },
        body,
      });

      this.scheduleRefresh();

      if (!this.profileSameAs(result.profile)) {
        this.set({ profile: result.profile });
        this.trigger("modify");
        this.trigger("change");
        this.broadcast("modify");
      }

      return result;
    } catch (e) {
      console.error("Reflow: Unable to update profile.");
      if (e.data) console.error(e.data);

      if (e.status == 403) {
        this.clear();
        this.trigger("signout", { error: "profile_not_found" });
        this.trigger("change");
        this.broadcast("signout", { error: "profile_not_found" });
      }

      throw e;
    }
  }

  async signIn() {
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

      throw e;
    }

    this._signInWindow.location =
      response.signinURL + "?origin=" + encodeURIComponent(window.location.origin);

    this._checkWindowClosedInterval = setInterval(() => {
      if (this._signInWindow && this._signInWindow.closed) {
        this._signInWindow = null;
      }

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

        this.scheduleRefresh();

        if (status.valid) {
          this.clearIsNew();

          if (status.isNew) {
            this.setIsNew();
          }

          this.set({
            key: status.session,
            expiresAt: Date.now() + status.lifetime * 1000,
            profile: status.profile,
          });

          this.trigger("signin", {
            profile: status.profile,
          });

          this.trigger("change");

          this.broadcast("signin", {
            profile: status.profile,
            isNew: status.isNew,
          });

          this.scheduleRefresh();
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
}

export default Auth;
