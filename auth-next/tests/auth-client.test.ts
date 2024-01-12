/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals";
import {
  signIn,
  signOut,
  isSignedIn,
  createSubscription,
  modifySubscription,
  useSessionSync,
  sessionListeners,
} from "../src/auth-client";

import { renderHook, act } from "@testing-library/react";

// Tests

describe("Reflow Auth Client", () => {
  test("signIn", async () => {
    // @ts-ignore
    global.fetch = jest.fn((url: string) => {
      let response = {};

      if (url.includes("?init=true")) {
        response = {
          success: true,
          signinURL: "https://banana123.com/",
          nonceHash: "pizza",
        };
      } else if (url.includes("?check=true&auth-token=token777")) {
        response = {
          success: true,
        };
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(response),
      });
    });

    let signInWindow = { document: { write: jest.fn(() => {}) }, location: "" };

    // @ts-ignore
    global.open = jest.fn(() => signInWindow);
    let listeners: Record<string, any> = {};
    // @ts-ignore
    global.addEventListener = jest.fn((type: string, cb: Function) => {
      listeners[type] = cb;
    });
    global.removeEventListener = jest.fn(() => {});
    global.clearInterval = jest.fn(() => {});

    let intervals: Function[] = [];
    // @ts-ignore
    global.setInterval = jest.fn((cb) => intervals.push(cb));

    let focusFlag = true;
    Object.defineProperty(global.document, "hasFocus", {
      value: function () {
        return (focusFlag = !focusFlag);
      },
      writable: true,
      configurable: true,
      enumerable: true,
    });

    let onSuccess = jest.fn(() => {});
    let onError = jest.fn(() => {});

    await signIn({ onSuccess, onError, subscribeTo: 12345 });

    expect(global.open).toHaveBeenCalledTimes(1);
    expect(global.open).toHaveBeenCalledWith(
      "about:blank",
      "reflow-signin",
      "width=650,height=650,top=59,left=187"
    );

    expect(signInWindow.location).toEqual(
      "https://banana123.com/?origin=http%3A%2F%2Flocalhost&nonceHash=pizza&step=login&subscribeTo=12345"
    );

    expect(global.addEventListener).toHaveBeenCalledTimes(1);
    expect(global.removeEventListener).toHaveBeenCalledTimes(0);
    expect(global.clearInterval).toHaveBeenCalledTimes(2);

    // Fake a received postMessage
    listeners.message({
      source: signInWindow,
      data: { authToken: "token777" },
    });

    expect(intervals.length).toEqual(2);
    // Simulate a call of the interval.
    // @ts-ignore
    await intervals.pop()();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(0);
  });

  test("signOut", async () => {
    let onSuccess = jest.fn(() => {});
    let onError = jest.fn(() => {});

    // @ts-ignore
    global.fetch = jest.fn((url: string) => {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
          }),
      });
    });

    await signOut({ onSuccess, onError });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(0);

    expect(fetch).toHaveBeenCalledWith("/auth?signout=true", {
      method: "POST",
      credentials: "include",
    });
  });

  test("isSignedIn", async () => {
    // @ts-ignore
    global.fetch = jest.fn((url: string) => {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: true,
          }),
      });
    });

    let result = await isSignedIn();

    expect(result).toEqual(true);

    expect(fetch).toHaveBeenCalledWith("/auth?is-signed-in=true", {
      method: "POST",
      credentials: "include",
    });
  });

  test("createSubscription", async () => {
    let onSuccess = jest.fn(() => {});
    let onError = jest.fn(() => {});

    // @ts-ignore
    global.fetch = jest.fn((url: string) => {
      let response = {};

      if (url.includes("?is-signed-in=true")) {
        response = {
          status: true,
        };
      } else if (url.includes("?create-subscription=true&priceID=1337")) {
        response = {
          checkoutURL: "https://example.com/payment-page",
        };
      } else if (url.includes("?refresh=true&force=true")) {
        response = {
          subscription: true,
        };
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(response),
      });
    });

    let subWindow = {
      document: { write: jest.fn(() => {}) },
      location: "",
      close() {},
    };

    // @ts-ignore
    global.open = jest.fn(() => subWindow);
    global.clearInterval = jest.fn(() => {});

    let intervals: Function[] = [];
    // @ts-ignore
    global.setInterval = jest.fn((cb) => intervals.push(cb));

    let focusFlag = true;
    Object.defineProperty(global.document, "hasFocus", {
      value: function () {
        return (focusFlag = !focusFlag);
      },
      writable: true,
      configurable: true,
      enumerable: true,
    });

    await createSubscription({
      priceID: 1337,
      onSuccess,
      onError,
    });

    // Simulate a call of the interval.
    // @ts-ignore
    await intervals.pop()();

    expect(global.open).toHaveBeenCalledTimes(1);
    expect(global.open).toHaveBeenCalledWith(
      "about:blank",
      "reflow-signin",
      "width=650,height=800,top=-16,left=187"
    );

    expect(subWindow.location).toEqual("https://example.com/payment-page");

    expect(global.clearInterval).toHaveBeenCalledTimes(3);

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ subscription: true });
    expect(onError).toHaveBeenCalledTimes(0);
  });

  test("modifySubscription", async () => {
    // @ts-ignore
    global.fetch = jest.fn((url: string) => {
      let response = {};

      if (url.includes("?is-signed-in=true")) {
        response = {
          status: true,
        };
      } else if (url.includes("?manage-subscription=true")) {
        response = {
          subscriptionManagementURL: "https://example.com/manage",
        };
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(response),
      });
    });

    let subWindow = { document: { write: jest.fn(() => {}) }, location: "" };

    // @ts-ignore
    global.open = jest.fn(() => subWindow);

    await modifySubscription();

    expect(global.open).toHaveBeenCalledTimes(1);
    expect(global.open).toHaveBeenCalledWith(
      "about:blank",
      "reflow-signin",
      "width=650,height=800,top=-16,left=187"
    );

    expect(subWindow.location).toEqual("https://example.com/manage");
  });

  test("useSessionSync", async () => {
    const onSignin1 = jest.fn();
    const onSignout1 = jest.fn();
    const onSubscribe1 = jest.fn();
    const onChange1 = jest.fn();

    const onSignin2 = jest.fn();
    const onSignout2 = jest.fn();
    const onSubscribe2 = jest.fn();
    const onChange2 = jest.fn();

    expect(sessionListeners).toEqual([]);

    const hook1 = renderHook(() =>
      useSessionSync({
        onSignin: onSignin1,
        onSignout: onSignout1,
        onSubscribe: onSubscribe1,
        onChange: onChange1,
      })
    );

    const hook2 = renderHook(() =>
      useSessionSync({
        onSignin: onSignin2,
        onSignout: onSignout2,
        onSubscribe: onSubscribe2,
        onChange: onChange2,
      })
    );

    expect(sessionListeners).toEqual([
      { type: "signin", cb: onSignin1 },
      { type: "signout", cb: onSignout1 },
      { type: "subscribe", cb: onSubscribe1 },
      { type: "change", cb: onChange1 },
      { type: "signin", cb: onSignin2 },
      { type: "signout", cb: onSignout2 },
      { type: "subscribe", cb: onSubscribe2 },
      { type: "change", cb: onChange2 },
    ]);

    hook1.unmount();

    expect(sessionListeners).toEqual([
      { type: "signin", cb: onSignin2 },
      { type: "signout", cb: onSignout2 },
      { type: "subscribe", cb: onSubscribe2 },
      { type: "change", cb: onChange2 },
    ]);

    hook2.unmount();
    expect(sessionListeners).toEqual([]);
  });
});
