/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals";
import Auth from "@reflowhq/auth";
import useAuth from "../index.js";
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
      "profile",
      "updateProfile",
      "isSignedIn",
      "isNew",
      "signIn",
      "signOut",
      "refresh",
    ]);

    expect(result.current.profile).toBe(null);
    expect(typeof result.current.updateProfile).toBe("function");
    expect(typeof result.current.isSignedIn).toBe("function");
    expect(typeof result.current.isNew).toBe("function");
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signOut).toBe("function");
    expect(typeof result.current.refresh).toBe("function");
  });

  it("should read profile info from localStorage", async () => {
    let data = {
      key: "key123",
      expiresAt: Date.now() + 99999 * 1000,
      profile: {
        name: "J Doe",
        email: "aa@example.com",
      },
    };

    window.localStorage.reflowAuth123456 = JSON.stringify(data);

    const { result } = renderHook(() => useAuth({ storeID: 123456 }));

    expect(result.current.profile).toStrictEqual({ name: "J Doe", email: "aa@example.com" });
    expect(result.current.isSignedIn()).toBe(true);
  });

  it("should rerender and unmount", async () => {
    let auth = new Auth({
      storeID: "1234",
      apiBase: "http://api.reflow.local/v1",
      autoBind: false,
    });

    auth.bind = jest.fn();
    auth.unbind = jest.fn();

    const { result, rerender, unmount } = renderHook(() => useAuth(auth));

    expect(result.current.isSignedIn()).toBe(false);
    expect(result.current.profile).toBe(null);

    expect(auth.bind).toHaveBeenCalledTimes(1);
    expect(auth.unbind).toHaveBeenCalledTimes(0);
    expect(auth._listeners.change.length).toBe(1);

    auth.set({
      key: "key123",
      expiresAt: Date.now() + 99999 * 1000,
      profile: {
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

    act(async () => {
      await result.current.signOut();
    });

    expect(result.current.isSignedIn()).toBe(false);

    unmount();

    expect(auth.bind).toHaveBeenCalledTimes(1);
    expect(auth.unbind).toHaveBeenCalledTimes(1);
    expect(auth._listeners.change).toBe(undefined);
  });
});
