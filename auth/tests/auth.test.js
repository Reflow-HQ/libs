/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals";
import Auth from "../index.js";

describe("Auth", () => {
  let auth = new Auth({
    projectID: "1234",
    apiBase: "http://api.reflow.local/v2",
  });

  beforeEach(() => {
    // Hide console.error() spam
    jest.spyOn(console, "error").mockImplementation(() => {});

    // Mock the auth.trigger method so we can track its evocations
    auth.trigger = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should get and set", async () => {
    let auth2 = new Auth({
      projectID: "777",
    });

    auth2.set({
      test123: "789",
    });

    expect(JSON.parse(window.localStorage.reflowAuth777)).toStrictEqual(auth2.get());
    expect(auth2.get("test123")).toBe("789");

    auth2.clear();
    expect(auth2.get()).toStrictEqual({});
    expect(auth2.get("test123")).toBe(null);
    expect(auth2.get("test124")).toBe(null);

    expect(auth2.isNew()).toBe(false);
    auth2.setIsNew();
    expect(auth2.isNew()).toBe(true);
    expect(auth.isNew()).toBe(false);
  });

  it("should manage event listeners", async () => {
    let auth = new Auth({
      projectID: "987",
    });

    expect(auth._listeners).toStrictEqual({});

    let cb = jest.fn();
    let cb2 = jest.fn();

    auth.on("asdf", cb);
    expect(auth._listeners).toStrictEqual({
      asdf: [cb],
    });

    auth.on("asdf", cb);
    expect(auth._listeners).toStrictEqual({
      asdf: [cb],
    });

    auth.on("asdf", cb2);
    expect(auth._listeners).toStrictEqual({
      asdf: [cb, cb2],
    });

    expect(cb).toHaveBeenCalledTimes(0);
    auth.trigger("asdf", "BananaArg");
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("BananaArg");
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledWith("BananaArg");

    auth.off("asdf", cb);
    expect(auth._listeners).toStrictEqual({
      asdf: [cb2],
    });

    auth.off("asdf", cb2);
    expect(auth._listeners).toStrictEqual({});

    expect(() => {
      auth.off("asdf", cb);
    }).toThrow("Unrecognized event name");

    expect(() => {
      auth.off("asdf", () => {});
    }).toThrow("Unrecognized event name");

    expect(() => {
      auth.off("asdf");
    }).toThrow("Unrecognized event name");

    expect(() => {
      auth.off("deae", () => {});
    }).toThrow("Unrecognized event name");
  });

  it("should return signed in status", async () => {
    expect(auth.isSignedIn()).toBe(false);

    let data = {
      key: "key123",
      expiresAt: Date.now() + 99999 * 1000,
      user: {
        name: "J Doe",
        email: "aa@example.com",
      },
    };

    auth.set(data);

    expect(JSON.parse(window.localStorage.reflowAuth1234)).toStrictEqual(data);
    expect(auth.isSignedIn()).toBe(true);
    expect(auth.user.name).toBe("J Doe");
  });

  it("should sign in", async () => {
    global.fetch = jest.fn((url) => {
      let response = {};

      if (url.includes("/auth/urls")) {
        response = {
          signinURL: "https://banana123.com/",
        };
      } else if (url.includes("/auth/validate-token")) {
        response = {
          valid: true,
          isNew: true,
          session: "sess123",
          user: {
            name: "Name Here",
            photo: "Image Here",
          },
        };
      }

      return Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve(response),
      });
    });

    let signInWindow = {
      document: {
        write: jest.fn(() => {}),
      },
      focus: jest.fn(() => {}),
      location: "",
    };

    global.open = jest.fn(() => signInWindow);

    let auth = new Auth({
      projectID: "2345",
      apiBase: "http://api.reflow.local/v2",
    });
    expect(auth.isSignedIn()).toBe(false);
    expect(auth._popupWindow.isOpen()).toBe(false);

    await auth.signIn();

    expect(auth._popupWindow.isOpen()).toBe(true);
    expect(global.open).toHaveBeenCalledTimes(1);
    expect(global.open).toHaveBeenCalledWith(
      "about:blank",
      "reflow-signin",
      "width=590,height=590,top=89,left=217"
    );

    expect(auth._popupWindow.getWindowInstance()).toEqual(signInWindow);
    expect(auth._popupWindow.getWindowInstance().location).toEqual(
      "https://banana123.com/?origin=http%3A%2F%2Flocalhost&step=login"
    );

    // Todo: think of a way to simulate the window open postMessage response
    // and test the _loginCheckInterval
  });

  it("should fail to fetch the user and logout", async () => {
    // We will not be testing the same behavior in other auth api methods
    // as they follows the same pattern and exact same code.

    global.fetch = jest.fn(() =>
      Promise.resolve({
        status: 403,
        json: () => Promise.resolve({}),
      })
    );

    try {
      await auth.refresh();
    } catch (e) {
      expect(e.message).toMatch("HTTP error");
    }

    expect(auth.isSignedIn()).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("http://api.reflow.local/v2/projects/1234/auth/state", {
      headers: {
        Authorization: `Bearer key123`,
      },
    });
    expect(auth.trigger).toHaveBeenCalledTimes(2);
    expect(auth.trigger).toHaveBeenCalledWith("signout", {
      error: "user_not_found",
    });
    expect(auth.trigger).toHaveBeenCalledWith("change");

    // Log Back in

    auth.set({
      key: "key123",
      expiresAt: Date.now() + 99999 * 1000,
      user: {
        name: "J Doe",
        email: "aa@example.com",
      },
    });
  });

  it("should fetch the user from the server", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            user: {
              name: "Mr. Name From Server",
            },
            token: "asdf123",
          }),
      })
    );

    await auth.refresh();

    const user = auth.user;

    expect(user).toEqual({
      name: "Mr. Name From Server",
    });
    expect(auth.user.name).toBe("Mr. Name From Server");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("http://api.reflow.local/v2/projects/1234/auth/state", {
      headers: {
        Authorization: `Bearer key123`,
      },
    });
    expect(auth.trigger).toHaveBeenCalledTimes(2);
    expect(auth.trigger).toHaveBeenCalledWith("modify");
    expect(auth.trigger).toHaveBeenCalledWith("change");
  });

  it("should update the user successfully", async () => {
    let name = "J Doe";
    let email = "email@example.com";
    let meta = {
      phone: "123456",
    };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            user: {
              name,
              email,
              meta,
            },
            success: true,
          }),
      })
    );

    const result = await auth.updateUser({
      name,
      email,
      meta,
    });
    expect(result.user).toEqual({
      name,
      email,
      meta,
    });
    expect(result.success).toEqual(true);
    expect(auth.user.name).toBe(name);
    expect(auth.user.email).toBe(email);
    expect(auth.user.meta.phone).toBe(meta.phone);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(auth.trigger).toHaveBeenCalledTimes(2);
    expect(auth.trigger).toHaveBeenCalledWith("modify");
    expect(auth.trigger).toHaveBeenCalledWith("change");
  });

  it("should update the user email successfully", async () => {
    let oldUser = auth.user;
    let oldSubscription = auth.subscription;

    let newEmail = "new.email@example.com";
    let newUserData = {
      ...oldUser,
    };

    global.fetch = jest.fn((url) => {
      let response = {};

      if (url.includes("/auth/user")) {
        response = {
          success: true,
          user: {
            name: oldUser.name,
            email: oldUser.email,
            meta: oldUser.meta,
          },
          email_update: {
            new_email: newEmail,
            previous_email: oldUser.email,
            verified: false,
          },
        };
      } else if (url.includes("/auth/state")) {
        response = {
          user: newUserData,
          subscription: oldSubscription,
        };
      }

      return Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve(response),
      });
    });

    jest.spyOn(window, "addEventListener");
    jest.spyOn(window, "removeEventListener");

    // Update the user's email, the request will return the old email,
    // because we need to first verify the change.
    // We should set an event listener in order to check for changes to the profile.

    const result = await auth.updateUser({
      email: newEmail,
    });
    expect(result.user).toEqual({
      name: oldUser.name,
      email: oldUser.email,
      meta: oldUser.meta,
    });
    expect(result.success).toEqual(true);
    expect(auth.user.name).toBe(oldUser.name);
    expect(auth.user.email).toBe(oldUser.email);
    expect(auth.user.meta.phone).toBe(oldUser.meta.phone);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(auth.trigger).toHaveBeenCalledTimes(0);

    expect(auth.newEmail).toBe(newEmail);
    expect(window.addEventListener).toHaveBeenCalledTimes(1);
    expect(window.addEventListener).toHaveBeenCalledWith(
      "focus",
      auth._emailUpdatedListener,
      false
    );
    expect(auth._emailUpdatedListenerBound).toBe(true);

    jest.clearAllMocks();

    // Update the email again, the event listener should still be bound

    newEmail = "new.email2@example.com";

    await auth.updateUser({
      email: newEmail,
    });
    expect(auth.user.email).toBe(oldUser.email);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(auth.trigger).toHaveBeenCalledTimes(0);

    expect(auth.newEmail).toBe(newEmail);
    expect(window.addEventListener).toHaveBeenCalledTimes(0);
    expect(auth._emailUpdatedListenerBound).toBe(true);

    jest.clearAllMocks();

    // Check for changes to the user profile.
    // We're currently returning the old user data,
    // so nothing should change

    await auth._emailUpdatedListener();

    expect(fetch).toHaveBeenCalledTimes(1);

    expect(auth.user.name).toBe(oldUser.name);
    expect(auth.user.email).toBe(oldUser.email);
    expect(auth.user.meta.phone).toBe(oldUser.meta.phone);

    expect(auth.trigger).toHaveBeenCalledTimes(0);

    expect(window.addEventListener).toHaveBeenCalledTimes(0);
    expect(window.removeEventListener).toHaveBeenCalledTimes(0);
    expect(auth._emailUpdatedListenerBound).toBe(true);

    jest.clearAllMocks();

    // Update the user email and check for changes again.
    // This time the email has been updated, so the event listener should be removed

    newUserData.email = newEmail;

    await auth._emailUpdatedListener();

    expect(auth.user.name).toBe(oldUser.name);
    expect(auth.user.email).toBe(newEmail);
    expect(auth.user.meta.phone).toBe(oldUser.meta.phone);

    expect(auth.trigger).toHaveBeenCalledTimes(2);
    expect(auth.trigger).toHaveBeenCalledWith("modify");
    expect(auth.trigger).toHaveBeenCalledWith("change");

    expect(window.addEventListener).toHaveBeenCalledTimes(0);
    expect(window.removeEventListener).toHaveBeenCalledTimes(1);
    expect(auth._emailUpdatedListenerBound).toBe(false);

    jest.clearAllMocks();
  });

  it("should fail to update the user because of validation", async () => {
    let oldUser = auth.user;

    let result;

    global.fetch = jest.fn(() =>
      Promise.resolve({
        status: 422,
        json: () =>
          Promise.resolve({
            errors: {
              name: ["The name must be at least 2 characters."],
            },
            message: "The given data was invalid.",
          }),
      })
    );

    try {
      result = await auth.updateUser({});
    } catch (e) {
      expect(e.message).toMatch("HTTP error");
    }

    expect(result).toBeFalsy();
    expect(auth.user.name).toBe(oldUser.name);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(auth.trigger).toHaveBeenCalledTimes(0);
  });

  it("should sign out", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    );

    let result = await auth.signOut();
    expect(result).toEqual(true);
    expect(auth.isSignedIn()).toBe(false);
    expect(auth.user).toBe(null);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(auth.trigger).toHaveBeenCalledTimes(2);
    expect(auth.trigger).toHaveBeenCalledWith("signout", {
      error: false,
    });
    expect(auth.trigger).toHaveBeenCalledWith("change");

    auth.trigger.mockReset();

    // Already signed out

    result = await auth.signOut();
    expect(result).toEqual(false);
    expect(auth.trigger).toHaveBeenCalledTimes(0);
  });

  it("should obtain tokens", async () => {
    let auth = new Auth({
      projectID: "000111",
    });

    let data = {
      key: "key123",
      expiresAt: Date.now() + 99999 * 1000,
      user: {
        name: "J Doe",
        email: "aa@example.com",
      },
    };

    auth.set(data);

    expect(auth.isSignedIn()).toEqual(true);
    expect(await auth.getToken()).toEqual(null);

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            token: "asdf000",
          }),
      })
    );

    // Pseudo JWT with a payload
    data.token =
      "abc." +
      btoa(
        JSON.stringify({
          exp: Math.floor(Date.now() / 1000) + 60,
        })
      ) +
      ".abc";
    auth.set(data);

    expect(await auth.getToken()).toEqual(data.token);
    expect(fetch).toHaveBeenCalledTimes(0);

    // Expired token. Should trigger an HTTP Request
    data.token =
      "abc." +
      btoa(
        JSON.stringify({
          exp: Math.floor(Date.now() / 1000) + 59,
        })
      ) +
      ".abc";
    auth.set(data);

    expect(await auth.getToken()).toEqual("asdf000");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("should support multiple instances", async () => {
    let auth3 = new Auth({
      projectID: "333",
    });
    let auth4 = new Auth({
      projectID: "444",
    });

    expect(auth3.isSignedIn()).toBe(false);
    expect(auth4.isSignedIn()).toBe(false);

    let data = {
      key: "key123",
      expiresAt: Date.now() + 99999 * 1000,
      user: {
        name: "J Doe",
        email: "aa@example.com",
      },
    };

    auth3.set(data);

    expect(auth3.isSignedIn()).toBe(true);
    expect(auth4.isSignedIn()).toBe(false);

    let result = await auth4.signOut();
    expect(result).toEqual(false);
    expect(auth3.isSignedIn()).toBe(true);

    result = await auth3.signOut();
    expect(result).toEqual(true);

    result = await auth4.signOut();
    expect(result).toEqual(false);

    expect(auth3.isSignedIn()).toBe(false);
    expect(auth4.isSignedIn()).toBe(false);
  });

  it("should bind/unbind", async () => {
    // Capture all timer calls

    jest.useFakeTimers();
    jest.spyOn(global, "setTimeout");
    jest.spyOn(global, "setInterval");
    jest.spyOn(global, "clearInterval");
    jest.spyOn(global, "removeEventListener");
    jest.spyOn(global, "addEventListener");

    let auth5 = new Auth({
      projectID: "555",
    });

    expect(removeEventListener).toHaveBeenCalledTimes(0);
    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledWith("message", auth5._messageListener);
    expect(auth5._listeners).toStrictEqual({});

    let auth6 = new Auth({
      projectID: "5556",
      autoBind: false,
    });

    expect(removeEventListener).toHaveBeenCalledTimes(0);
    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(auth6._listeners).toStrictEqual({});

    auth6.bind();

    expect(addEventListener).toHaveBeenCalledTimes(2);
    expect(removeEventListener).toHaveBeenCalledTimes(0);

    auth6.unbind();

    expect(addEventListener).toHaveBeenCalledTimes(2);
    expect(removeEventListener).toHaveBeenCalledTimes(2);
    expect(removeEventListener).toHaveBeenCalledWith("message", auth6._messageListener);
    expect(clearInterval).toHaveBeenCalledTimes(2);
    expect(auth6._popupWindow._checkPopupWindowClosedInterval).toBe(null);
    expect(auth6._paddleSubscriptionCheckInterval).toBe(null);

    auth5.on("change", () => {});

    expect(setTimeout).toHaveBeenCalledTimes(0);
    expect(clearInterval).toHaveBeenCalledTimes(2);
    expect(auth5._listeners["change"].length).toBe(1);

    auth5.unbind();

    expect(auth5._listeners["change"].length).toBe(1);
    expect(removeEventListener).toHaveBeenCalledWith("message", auth5._messageListener);

    // Test multiple bind/unbind

    expect(auth5.isBound()).toBe(false);

    auth5.bind();

    expect(auth5._boundCounter).toBe(1);
    expect(auth5.isBound()).toBe(true);

    auth5.bind();

    expect(auth5._boundCounter).toBe(2);
    expect(auth5.isBound()).toBe(true);

    auth5.bind();
    auth5.bind();

    expect(auth5._boundCounter).toBe(4);
    expect(auth5.isBound()).toBe(true);

    auth5.unbind();

    expect(auth5._boundCounter).toBe(3);
    expect(clearInterval).toHaveBeenCalledTimes(4);
    expect(auth5.isBound()).toBe(true);

    auth5.unbind();
    auth5.unbind();

    expect(auth5._boundCounter).toBe(1);
    expect(auth5.isBound()).toBe(true);

    auth5.unbind();

    expect(auth5._boundCounter).toBe(0);
    expect(clearInterval).toHaveBeenCalledTimes(6);
    expect(auth5.isBound()).toBe(false);

    jest.useRealTimers();
  });

  it("should work with deprecated storeID alias", async () => {
    let authStore = new Auth({
      storeID: "240418",
    });

    authStore.set({
      testData: "any",
    });

    expect(authStore.get()).toStrictEqual({
      testData: "any",
    });
  });
});
