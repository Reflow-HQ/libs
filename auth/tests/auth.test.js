/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals";
import Auth from "../auth.js";

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

  it("should return signed in status", async () => {
    expect(auth.isSignedIn()).toBe(false);

    auth.set({
      key: "key123",
      expiresAt: Date.now() + 99999 * 1000,
      profile: {
        name: "J Doe",
        email: "aa@example.com",
      },
    });

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
      await auth.getProfile();
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
    expect(auth.trigger).toHaveBeenCalledTimes(1);
    expect(auth.trigger).toHaveBeenCalledWith("signout", { error: "profile_not_found" });

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

    const profile = await auth.getProfile();
    expect(profile).toEqual({ name: "Mr. Name From Server" });
    expect(auth.profile.name).toBe("Mr. Name From Server");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("http://api.reflow.local/v1/stores/1234/auth/profile", {
      headers: {
        Authorization: `Bearer key123`,
      },
    });
    expect(auth.trigger).toHaveBeenCalledTimes(1);
    expect(auth.trigger).toHaveBeenCalledWith("profile-refreshed", undefined);
  });

  it("should update the user profile successfully", async () => {
    let name = "J Doe";
    let email = "email@example.com";
    let meta = {
      phone: "123456",
    };

    let successCB = jest.fn(() => {});
    let failCB = jest.fn(() => {});

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

    const result = await auth.updateProfile({ name, email, meta }, successCB, failCB);
    expect(result.profile).toEqual({ name, email, meta });
    expect(result.success).toEqual(true);
    expect(auth.profile.name).toBe(name);
    expect(auth.profile.email).toBe(email);
    expect(auth.profile.meta.phone).toBe(meta.phone);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(successCB).toHaveBeenCalledTimes(1);
    expect(failCB).toHaveBeenCalledTimes(0);
    expect(auth.trigger).toHaveBeenCalledTimes(1);
    expect(auth.trigger).toHaveBeenCalledWith("profile-refreshed", undefined);
  });

  it("should fail to update the user profile because of validation", async () => {
    let oldProfile = auth.profile;

    let result;
    let successCB = jest.fn(() => {});
    let failCB = jest.fn(() => {});

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
      result = await auth.updateProfile({}, successCB, failCB);
    } catch (e) {
      expect(e.message).toMatch("HTTP error");
    }

    expect(result).toBeFalsy();
    expect(auth.profile.name).toBe(oldProfile.name);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(successCB).toHaveBeenCalledTimes(0);
    expect(failCB).toHaveBeenCalledTimes(1);
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
    expect(auth.profile).toBe(undefined);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(auth.trigger).toHaveBeenCalledTimes(1);
    expect(auth.trigger).toHaveBeenCalledWith("signout", { error: false });

    // Already signed out

    result = await auth.signOut();
    expect(result).toEqual(false);
    expect(auth.trigger).toHaveBeenCalledTimes(1);
  });
});
