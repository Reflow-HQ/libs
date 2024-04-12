/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals";

let paddleCheckoutEventCallbackMock: Function;
let paddleCheckoutOpenMock = jest.fn();
let initializePaddleMock = jest.fn((options: { eventCallback: Function }) => {
  paddleCheckoutEventCallbackMock = options.eventCallback;

  return {
    Checkout: {
      open: paddleCheckoutOpenMock,
    },
  };
});
jest.unstable_mockModule("@paddle/paddle-js", async () => ({
  __esModule: true,
  initializePaddle: initializePaddleMock,
}));

const authClient = await import("../src/auth-client");
const {
  signIn,
  signOut,
  isSignedIn,
  createSubscription,
  modifySubscription,
  useSessionSync,
  sessionListeners,
} = authClient;

HTMLDialogElement.prototype.show = jest.fn();
HTMLDialogElement.prototype.showModal = jest.fn();
HTMLDialogElement.prototype.close = jest.fn();

import LoadingDialog from "../../helpers/dialogs/LoadingDialog.mjs";
let loadingDialogMock = {
  open: jest.spyOn(LoadingDialog.prototype, "open").mockImplementation(() => {}),
  close: jest.spyOn(LoadingDialog.prototype, "close").mockImplementation(() => {}),
};

import PaddleManageSubscriptionDialog from "../../helpers/dialogs/PaddleManageSubscriptionDialog.mjs";
let paddleManageSubscriptionDialogMock = {
  open: jest.spyOn(PaddleManageSubscriptionDialog.prototype, "open"),
  recordEventListener: jest
    .spyOn(PaddleManageSubscriptionDialog.prototype, "recordEventListener")
    .mockImplementation(() => {}),
};

import { renderHook, act } from "@testing-library/react";

afterEach(() => {
  loadingDialogMock.open.mockClear();
  loadingDialogMock.close.mockClear();
});

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
      "width=590,height=590,top=89,left=217"
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

  test("modifySubscriptionStripe", async () => {
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

    let intervals: Function[] = [];
    // @ts-ignore
    global.setInterval = jest.fn((cb) => intervals.push(cb));
    global.clearInterval = jest.fn(() => {});

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
          store: { object: "store", id: "123456" },
          user: { object: "user", id: "123456" },
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

    expect(loadingDialogMock.open).toHaveBeenCalledTimes(1);
    expect(initializePaddleMock).toHaveBeenCalledTimes(1);
    expect(loadingDialogMock.close).toHaveBeenCalledTimes(1);
    expect(paddleCheckoutOpenMock).toHaveBeenCalledTimes(1);

    // Mock a paddle event call

    paddleCheckoutEventCallbackMock({
      name: "checkout.closed",
      data: { status: "completed" },
    });

    expect(loadingDialogMock.open).toHaveBeenCalledTimes(2);
    expect(global.clearInterval).toHaveBeenCalledTimes(1);
    expect(intervals.length).toEqual(1);

    // Simulate a call of the subscription status check interval,
    // which in turn should trigger the onSuccess callback.
    // @ts-ignore
    await intervals.pop()();
    expect(global.setInterval).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ subscription: true });
    expect(onError).toHaveBeenCalledTimes(0);
    expect(loadingDialogMock.close).toHaveBeenCalledTimes(2);
  });

  test("modifySubscriptionPaddle", async () => {
    let onSuccess = jest.fn(() => {});
    let onError = jest.fn(() => {});

    let listeners: Record<string, any> = {};
    // @ts-ignore
    global.addEventListener = jest.fn((type: string, cb: Function) => {
      listeners[type] = cb;
    });

    const oldPrice = {
      id: "1111",
      object: "price",
      price: 1111,
      currency: {
        zero_decimal: false,
        code: "USD",
      },
      billing_period: "month",
    };
    const newPrice = {
      id: "2222",
      object: "price",
      price: 2222,
      currency: {
        zero_decimal: false,
        code: "USD",
      },
      billing_period: "month",
    };

    // @ts-ignore
    global.fetch = jest.fn((url: string) => {
      let response = {};

      if (url.includes("?is-signed-in=true")) {
        response = {
          status: true,
        };
      } else if (url.includes("?manage-subscription=true")) {
        response = {
          status: "success",
          provider: "paddle",
          paddle_seller_id: 1234,
          subscription: {
            object: "subscription",
            plan: {
              object: "plan",
              name: "Current Plan",
            },
            price: oldPrice,
          },
          update_payment_transaction_id: "transaction1234",
          available_plans: [
            {
              plan: {
                object: "plan",
                name: "Other Plan",
              },
              prices: [newPrice],
            },
          ],
          recent_payments: [],
          billing: {},
        };
      } else if (url.includes("?get-subscription=true")) {
        response = {
          subscription: {
            payment_provider: "paddle",
          },
        };
      } else if (url.includes("?refresh=true&force=true")) {
        response = {
          subscription: true,
        };
      } else if (url.includes("?update-subscription=true")) {
        response = {
          status: "success",
          plan: {
            object: "plan",
            name: "Other Plan",
          },
          price: newPrice,
        };
      } else if (url.includes("?cancel-subscription=true")) {
        response = {
          status: "success",
          cancel_at: "123456789",
        };
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(response),
      });
    });

    await modifySubscription({ onSuccess, onError });

    expect(loadingDialogMock.open).toHaveBeenCalledTimes(1);
    expect(loadingDialogMock.close).toHaveBeenCalledTimes(1);
    expect(paddleManageSubscriptionDialogMock.open).toHaveBeenCalledTimes(1);
    expect(paddleManageSubscriptionDialogMock.recordEventListener).toHaveBeenCalledTimes(3);

    let eventListenerCall = paddleManageSubscriptionDialogMock.recordEventListener.mock.calls.find(
      // @ts-ignore
      (call) => call[0] == "paddle-manage-subscription-dialog" && call[1] == "click"
    );
    // @ts-ignore
    const eventHandler: Function = eventListenerCall[2];

    // Test update plan

    let clickedSelector = ".ref-change-plan";
    let clickedDataset = {};
    const mockEvent = {
      preventDefault: jest.fn(),
      target: {
        closest: jest.fn((selector) => {
          if (selector !== clickedSelector) return false;

          return {
            dataset: clickedDataset,
            append: jest.fn(),
          };
        }),
      },
    };
    await eventHandler(mockEvent);

    clickedSelector = ".ref-price-update-option";
    clickedDataset = {
      billing_period: "month",
      price_id: newPrice.id,
    };
    await eventHandler(mockEvent);

    clickedSelector = ".ref-change-plan-update";
    clickedDataset = {};
    await eventHandler(mockEvent);
    expect(fetch).toHaveBeenLastCalledWith(
      "/auth?update-subscription=true&priceID=" + newPrice.id,
      {
        method: "POST",
        credentials: "include",
      }
    );

    // Test cancel

    global.confirm = jest.fn(() => true);
    clickedSelector = ".ref-cancel-plan";
    await eventHandler(mockEvent);
    expect(fetch).toHaveBeenLastCalledWith("/auth?cancel-subscription=true", {
      method: "POST",
      credentials: "include",
    });

    // Test closing the dialog, it should trigger teh onSuccess callback

    eventListenerCall = paddleManageSubscriptionDialogMock.recordEventListener.mock.calls.find(
      // @ts-ignore
      (call) => call[0] == "dialog" && call[1] == "close"
    );
    // @ts-ignore
    const closeEventHandler: Function = eventListenerCall[2];
    await closeEventHandler();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith();
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
