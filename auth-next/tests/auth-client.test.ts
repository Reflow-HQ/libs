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

import LoadingDialog from "../../helpers/dialogs/LoadingDialog.mjs";
let loadingDialogMock = {
  open: jest.spyOn(LoadingDialog.prototype, "open").mockImplementation(() => {}),
  close: jest.spyOn(LoadingDialog.prototype, "close").mockImplementation(() => {}),
};

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

    let onSuccess = jest.fn(() => {});
    let onError = jest.fn(() => {});

    await signIn({ onSuccess, onError, subscribeTo: 12345 });

    expect(global.addEventListener).toHaveBeenCalledTimes(2);
    expect(global.addEventListener).toBeCalledWith("focus", expect.any(Function));
    expect(global.addEventListener).toBeCalledWith("message", expect.any(Function));
    expect(global.removeEventListener).toHaveBeenCalledTimes(0);
    expect(global.clearInterval).toHaveBeenCalledTimes(1);

    expect(global.open).toHaveBeenCalledTimes(1);
    expect(global.open).toHaveBeenCalledWith(
      "about:blank",
      "reflow-signin",
      "width=650,height=650,top=59,left=187"
    );

    expect(signInWindow.location).toEqual(
      "https://banana123.com/?origin=http%3A%2F%2Flocalhost&nonceHash=pizza&step=login&subscribeTo=12345"
    );

    // Fake a received postMessage
    listeners.message({
      source: signInWindow,
      data: { authToken: "token777" },
    });

    // Fake refocusing the main document after opening popup
    await listeners.focus();

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

  test("createSubscriptionStripe", async () => {
    let onSuccess = jest.fn(() => {});
    let onError = jest.fn(() => {});

    let listeners: Record<string, any> = {};
    // @ts-ignore
    global.addEventListener = jest.fn((type: string, cb: Function) => {
      listeners[type] = cb;
    });

    // @ts-ignore
    global.fetch = jest.fn((url: string) => {
      let response = {};

      if (url.includes("?is-signed-in=true")) {
        response = {
          status: true,
        };
      } else if (url.includes("?create-subscription=true&priceID=1337")) {
        response = {
          status: "success",
          provider: "stripe",
          checkoutURL: "https://example.com/payment-page",
          mode: "live",
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

    await createSubscription({
      priceID: 1337,
      onSuccess,
      onError,
    });

    expect(global.addEventListener).toBeCalledWith("focus", expect.any(Function));
    expect(global.open).toHaveBeenCalledTimes(1);
    expect(global.open).toHaveBeenCalledWith(
      "about:blank",
      "reflow-subscription",
      "width=650,height=800,top=-16,left=187"
    );

    expect(subWindow.location).toEqual("https://example.com/payment-page");

    expect(global.clearInterval).toHaveBeenCalledTimes(1);

    // Simulate document focus after opening the popup
    await listeners.focus();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ subscription: true });
    expect(onError).toHaveBeenCalledTimes(0);
  });

  test("modifySubscription", async () => {
    let onSuccess = jest.fn(() => {});
    let onError = jest.fn(() => {});

    let listeners: Record<string, any> = {};
    // @ts-ignore
    global.addEventListener = jest.fn((type: string, cb: Function) => {
      listeners[type] = cb;
    });

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
          provider: "stripe",
        };
      } else if (url.includes("?get-subscription=true")) {
        response = {
          subscription: {
            payment_provider: "stripe",
          },
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

    let subWindow = { document: { write: jest.fn(() => {}) }, location: "" };

    // @ts-ignore
    global.open = jest.fn(() => subWindow);

    await modifySubscription({ onSuccess, onError });

    expect(global.addEventListener).toHaveBeenCalledTimes(1);
    expect(global.addEventListener).toBeCalledWith("focus", expect.any(Function));
    expect(global.open).toHaveBeenCalledTimes(1);
    expect(global.open).toHaveBeenCalledWith(
      "about:blank",
      "reflow-subscription",
      "width=650,height=800,top=-16,left=187"
    );
    expect(subWindow.location).toEqual("https://example.com/manage");

    // Fake refocusing the main document after opening popup
    await listeners.focus();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith();
    expect(onError).toHaveBeenCalledTimes(0);
  });

  test("createSubscriptionPaddle", async () => {
    let onSuccess = jest.fn(() => {});
    let onError = jest.fn(() => {});

    let listeners: Record<string, any> = {};
    // @ts-ignore
    global.addEventListener = jest.fn((type: string, cb: Function) => {
      listeners[type] = cb;
    });

    // @ts-ignore
    global.fetch = jest.fn((url: string) => {
      let response = {};

      if (url.includes("?is-signed-in=true")) {
        response = {
          status: true,
        };
      } else if (url.includes("?create-subscription=true&priceID=1337&paymentProvider=paddle")) {
        response = {
          status: "success",
          provider: "paddle",
          paddle_price_id: "123",
          seller_id: "paddle_id_123",
          store: { object: "store" },
          user: { object: "user" },
          mode: "live",
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

    await createSubscription({
      priceID: 1337,
      paymentProvider: "paddle",
      onSuccess,
      onError,
    });

    // @ts-ignore
    expect(loadingDialogMock.open).toHaveBeenCalledTimes(1);
    expect(loadingDialogMock.close).toHaveBeenCalledTimes(1);
    // expect(initializePaddle).toHaveBeenCalledTimes(1);

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ subscription: true });
    expect(onError).toHaveBeenCalledTimes(0);
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
