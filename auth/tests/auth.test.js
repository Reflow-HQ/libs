/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals";
import Auth from "../index.js";

describe("Auth", () => {
  let auth = new Auth({ storeID: "1234", apiBase: "http://api.reflow.local/v1" });

  beforeEach(() => {
    // Hide console.error() spam
    jest.spyOn(console, "error").mockImplementation(() => {});

    // Mock the auth.trigger method so we can track its evocations
    auth.trigger = jest.fn();
  });

  afterEach(() => {
    auth.trigger.mockClear();
  });

  it("should get and set", async () => {
    let auth2 = new Auth({ storeID: "777" });

    auth2.set({ test123: "789" });

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
    let auth = new Auth({ storeID: "987" });

    expect(auth._listeners).toStrictEqual({});

    let cb = jest.fn();

    auth.on("asdf", cb);
    expect(auth._listeners).toStrictEqual({ asdf: [cb] });

    auth.on("asdf", cb);
    expect(auth._listeners).toStrictEqual({ asdf: [cb] });

    expect(cb).toHaveBeenCalledTimes(0);
    auth.trigger("asdf", "BananaArg");
    expect(cb).toHaveBeenCalledWith("BananaArg");

    auth.off("asdf", cb);
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
      profile: {
        name: "J Doe",
        email: "aa@example.com",
      },
    };

    auth.set(data);

    expect(JSON.parse(window.localStorage.reflowAuth1234)).toStrictEqual(data);
    expect(auth.isSignedIn()).toBe(true);
    expect(auth.profile.name).toBe("J Doe");
  });

  it("should fail to fetch the profile and logout", async () => {
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
    expect(fetch).toHaveBeenCalledWith("http://api.reflow.local/v1/stores/1234/auth/profile", {
      headers: {
        Authorization: `Bearer key123`,
      },
    });
    expect(auth.trigger).toHaveBeenCalledTimes(2);
    expect(auth.trigger).toHaveBeenCalledWith("signout", { error: "profile_not_found" });
    expect(auth.trigger).toHaveBeenCalledWith("change", undefined);

    // Log Back in

    auth.set({
      key: "key123",
      expiresAt: Date.now() + 99999 * 1000,
      profile: {
        name: "J Doe",
        email: "aa@example.com",
      },
    });
  });

  it("should fetch the profile from the server", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ name: "Mr. Name From Server" }),
      })
    );

    await auth.refresh();

    const profile = auth.profile;

    expect(profile).toEqual({ name: "Mr. Name From Server" });
    expect(auth.profile.name).toBe("Mr. Name From Server");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("http://api.reflow.local/v1/stores/1234/auth/profile", {
      headers: {
        Authorization: `Bearer key123`,
      },
    });
    expect(auth.trigger).toHaveBeenCalledTimes(1);
    expect(auth.trigger).toHaveBeenCalledWith("change", undefined);
  });

  it("should update the user profile successfully", async () => {
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
            profile: {
              name,
              email,
              meta,
            },
            success: true,
          }),
      })
    );

    const result = await auth.updateProfile({ name, email, meta });
    expect(result.profile).toEqual({ name, email, meta });
    expect(result.success).toEqual(true);
    expect(auth.profile.name).toBe(name);
    expect(auth.profile.email).toBe(email);
    expect(auth.profile.meta.phone).toBe(meta.phone);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(auth.trigger).toHaveBeenCalledTimes(1);
    expect(auth.trigger).toHaveBeenCalledWith("change", undefined);
  });

  it("should fail to update the user profile because of validation", async () => {
    let oldProfile = auth.profile;

    let result;

    global.fetch = jest.fn(() =>
      Promise.resolve({
        status: 422,
        json: () =>
          Promise.resolve({
            errors: { name: ["The name must be at least 2 characters."] },
            message: "The given data was invalid.",
          }),
      })
    );

    try {
      result = await auth.updateProfile({});
    } catch (e) {
      expect(e.message).toMatch("HTTP error");
    }

    expect(result).toBeFalsy();
    expect(auth.profile.name).toBe(oldProfile.name);
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
    expect(auth.profile).toBe(null);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(auth.trigger).toHaveBeenCalledTimes(2);
    expect(auth.trigger).toHaveBeenCalledWith("signout", { error: false });
    expect(auth.trigger).toHaveBeenCalledWith("change", undefined);

    auth.trigger.mockReset();

    // Already signed out

    result = await auth.signOut();
    expect(result).toEqual(false);
    expect(auth.trigger).toHaveBeenCalledTimes(0);
  });

  it("should support multiple instances", async () => {
    let auth3 = new Auth({ storeID: "333" });
    let auth4 = new Auth({ storeID: "444" });

    expect(auth3.isSignedIn()).toBe(false);
    expect(auth4.isSignedIn()).toBe(false);

    let data = {
      key: "key123",
      expiresAt: Date.now() + 99999 * 1000,
      profile: {
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

    let auth5 = new Auth({ storeID: "555" });

    expect(setInterval).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledTimes(0);
    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledWith("message", auth5._messageListener);
    expect(auth5._listeners).toStrictEqual({});

    let auth6 = new Auth({ storeID: "5556", autoBind: false });

    expect(setInterval).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledTimes(0);
    expect(addEventListener).toHaveBeenCalledTimes(1);
    expect(auth6._listeners).toStrictEqual({});

    auth6.bind();

    expect(addEventListener).toHaveBeenCalledTimes(2);
    expect(setInterval).toHaveBeenCalledTimes(2);
    expect(removeEventListener).toHaveBeenCalledTimes(0);

    auth6.unbind();

    expect(addEventListener).toHaveBeenCalledTimes(2);
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    expect(removeEventListener).toHaveBeenCalledWith("message", auth6._messageListener);
    expect(setInterval).toHaveBeenCalledTimes(2);
    expect(clearInterval).toHaveBeenCalledTimes(2);
    expect(clearInterval).toHaveBeenCalledWith(auth6._refreshInterval);
    expect(clearInterval).toHaveBeenCalledWith(auth6._checkWindowClosedInterval);

    auth5.on("change", () => {});

    expect(setTimeout).toHaveBeenCalledTimes(0);
    expect(setInterval).toHaveBeenCalledTimes(2);
    expect(clearInterval).toHaveBeenCalledTimes(2);
    expect(auth5._listeners["change"].length).toBe(1);

    auth5.unbind();

    expect(clearInterval).toHaveBeenCalledTimes(4);
    expect(clearInterval).toHaveBeenCalledWith(auth5._refreshInterval);
    expect(clearInterval).toHaveBeenCalledWith(auth5._checkWindowClosedInterval);
    expect(auth5._listeners["change"].length).toBe(1);
    expect(removeEventListener).toHaveBeenCalledWith("message", auth5._messageListener);

    jest.useRealTimers();
  });
});
