/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals";
import Auth from "@reflowhq/auth";
import useAuth, { _authMap } from "../index.js";
import { renderHook, act } from "@testing-library/react";

describe("Auth", () => {
  beforeEach(() => {
    // Hide console.error() spam
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should accept a store id", async () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("storeID config option is required");

    const { result } = renderHook(() => useAuth({ storeID: 1234 }));

    expect(Object.keys(result.current)).toStrictEqual([
      "user",
      "subscription",
      "updateUser",
      "isSignedIn",
      "isNew",
      "signIn",
      "signOut",
      "refresh",
      "getToken",
      "createSubscription",
      "isSubscribed",
      "modifySubscription",
    ]);

    expect(result.current.user).toBe(null);
    expect(typeof result.current.updateUser).toBe("function");
    expect(typeof result.current.isSignedIn).toBe("function");
    expect(typeof result.current.isNew).toBe("function");
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signOut).toBe("function");
    expect(typeof result.current.refresh).toBe("function");
    expect(typeof result.current.getToken).toBe("function");
  });

  it("should read user info from localStorage", async () => {
    _authMap.clear();
    let data = {
      key: "key123",
      expiresAt: Date.now() + 99999 * 1000,
      user: {
        name: "J Doe",
        email: "aa@example.com",
      },
    };

    window.localStorage.reflowAuth123456 = JSON.stringify(data);

    const { result, unmount } = renderHook(() => useAuth({ storeID: 123456 }));

    expect(result.current.user).toStrictEqual({ name: "J Doe", email: "aa@example.com" });
    expect(result.current.isSignedIn()).toBe(true);
    expect(_authMap.size).toBe(1);

    unmount();

    expect(_authMap.size).toBe(0);
  });

  it("should rerender and unmount", async () => {
    let auth = new Auth({
      storeID: "1234",
      apiBase: "http://api.reflow.local/v1",
      autoBind: false,
    });

    auth.bind = jest.fn();
    auth.unbind = jest.fn();
    auth.onSignin = jest.fn();

    const { result, rerender, unmount } = renderHook(() => useAuth(auth));

    expect(result.current.isSignedIn()).toBe(false);
    expect(result.current.user).toBe(null);

    expect(auth.bind).toHaveBeenCalledTimes(1);
    expect(auth.unbind).toHaveBeenCalledTimes(0);
    expect(auth._listeners.change.length).toBe(1);
    expect(auth._listeners.signin.length).toBe(1);

    auth.set({
      key: "key123",
      expiresAt: Date.now() + 99999 * 1000,
      user: {
        name: "J Doe",
        email: "aa@example.com",
      },
    });

    expect(result.current.isSignedIn()).toBe(true);

    rerender();

    expect(result.current.isSignedIn()).toBe(true);
    expect(auth.bind).toHaveBeenCalledTimes(1);
    expect(auth.unbind).toHaveBeenCalledTimes(0);
    expect(auth._listeners.change.length).toBe(1);
    expect(auth._listeners.signin.length).toBe(1);

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.isSignedIn()).toBe(false);

    unmount();

    expect(auth.bind).toHaveBeenCalledTimes(1);
    expect(auth.unbind).toHaveBeenCalledTimes(1);
    expect(auth._listeners.change).toBe(undefined);
    expect(auth._listeners.signin).toBe(undefined);
  });

  it("should reuse auth instances", async () => {
    const { result, unmount: unmount } = renderHook(() => useAuth({ storeID: 777123 }));
    expect(result.current.isSignedIn()).toBe(false);
    expect(_authMap.size).toBe(1);

    const { unmount: unmount2 } = renderHook(() => useAuth({ storeID: 777123 }));
    expect(_authMap.size).toBe(1);

    const { unmount: unmount3 } = renderHook(() => useAuth({ storeID: 12345678 }));
    expect(_authMap.size).toBe(2);

    unmount();

    expect(_authMap.size).toBe(2);

    unmount2();

    expect(_authMap.size).toBe(1);

    unmount3();

    expect(_authMap.size).toBe(0);
  });

  it("should reuse auth instances", async () => {
    const { result, unmount: unmount } = renderHook(() => useAuth({ storeID: 777123 }));
    expect(result.current.isSignedIn()).toBe(false);
    expect(_authMap.size).toBe(1);

    const { unmount: unmount2 } = renderHook(() => useAuth({ storeID: 777123 }));
    expect(_authMap.size).toBe(1);

    const { unmount: unmount3 } = renderHook(() => useAuth({ storeID: 12345678 }));
    expect(_authMap.size).toBe(2);

    unmount();

    expect(_authMap.size).toBe(2);

    unmount2();

    expect(_authMap.size).toBe(1);

    unmount3();

    expect(_authMap.size).toBe(0);
  });
});
