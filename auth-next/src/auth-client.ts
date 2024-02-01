import "client-only";
import { initializePaddle, PaddleEventData, CheckoutOpenOptions, Paddle } from "@paddle/paddle-js";
import { AuthRefreshChange, Subscription } from "./auth-types";
import { useEffect } from "react";
import PopupWindow from "../../helpers/PopupWindow.mjs";
import PaddleManageSubscriptionDialog from "../../helpers/dialogs/PaddleManageSubscriptionDialog.mjs";
import LoadingDialog from "../../helpers/dialogs/LoadingDialog.mjs";

let popupWindow: PopupWindow = new PopupWindow({});
let paddleSubscribeCheckout: Paddle | undefined;
let paddleSubscriptionCheckInterval: number;

let loadingDialog: LoadingDialog;
let paddleManageSubscriptionDialog: PaddleManageSubscriptionDialog;

let messageListener: EventListener;
let authToken: string;

let broadcastChannel: BroadcastChannel | null;
let sessionSyncInterval: number;
export let sessionListeners: { type: string; cb: Function }[] = [];
let syncListeners: number = 0;
let working = false;

/**
 * React hook which lets you listen to events originating from other browser tabs.
 * Use this hook to listen for signin, signout and subscribe events. Alternatively,
 * pass an onChange callback which accepts an event type parameter (can be one of
 * "signin", "signout" and "subscribe")
 */
export function useSessionSync(options: {
  authEndpoint?: string;
  onChange?: (event: "signin" | "signout" | "subscribe") => void;
  onSignin?: Function;
  onSignout?: Function;
  onSubscribe?: Function;
}) {
  let base = apiBase(options?.authEndpoint);

  // Store the passed listeners in the array, and remove them
  // when the component is destroyed

  let cbs: Function[] = [];

  useEffect(() => {
    // Use BroadcastChannel for cross-tab communication

    if (window && "BroadcastChannel" in window) {
      if (broadcastChannel) {
        broadcastChannel.close();
        broadcastChannel = null;
      }

      broadcastChannel = new BroadcastChannel("reflow-next");
      broadcastChannel.onmessage = (e) => {
        for (let item of sessionListeners) {
          if (item.type == e.data.type) {
            item.cb();
          } else if (item.type == "change") {
            // change is always called
            item.cb(e.data.type);
          }
        }
      };
    }

    if (options.onSignin) {
      sessionListeners.push({ type: "signin", cb: options.onSignin });
      cbs.push(options.onSignin);
    }

    if (options.onSignout) {
      sessionListeners.push({ type: "signout", cb: options.onSignout });
      cbs.push(options.onSignout);
    }

    if (options.onSubscribe) {
      sessionListeners.push({ type: "subscribe", cb: options.onSubscribe });
      cbs.push(options.onSubscribe);
    }

    if (options.onChange) {
      sessionListeners.push({ type: "change", cb: options.onChange });
      cbs.push(options.onChange);
    }

    // Backend check interval

    if (window && window.setInterval && !syncListeners) {
      window.clearInterval(sessionSyncInterval);
      sessionSyncInterval = window.setInterval(async () => {
        try {
          let response = await apiCall(base + "?refresh=true");
          let data: AuthRefreshChange | null = await response.json();

          if (data?.signout) {
            // We only care about the signout event, which might arise when the
            // user session is reset from the Reflow backend. The other broadcast
            // events are triggered in the other client functions in this file.
            broadcastChannel?.postMessage({ type: "signout" });
          }
        } catch (e) {}
      }, 5 * 60 * 1000);
    }

    syncListeners++;

    return () => {
      // On unmount remove the listeners from the array, while keeping the reference
      for (let cb of cbs) {
        sessionListeners.splice(
          sessionListeners.findIndex((s) => s.cb == cb),
          1
        );
      }

      // If there are no components making use of the interval left, clear it
      syncListeners--;

      if (!syncListeners) {
        window.clearInterval(sessionSyncInterval);

        if (broadcastChannel) {
          broadcastChannel.close();
          broadcastChannel = null;
        }
      }
    };
  });
}

/* Triggers the sign in flow and displays a window with sign in methods */
export async function signIn(options?: {
  authEndpoint?: string;
  onSuccess?: Function;
  onError?: Function;
  step?: "login" | "register";
  subscribeTo?: number;
  subscribeWith?: string;
}) {
  let base = apiBase(options?.authEndpoint);

  popupWindow.open({
    url: null,
    label: "reflow-signin",
    title: "Signing in..",
    size: {
      w: 650,
      h: 650,
    },
    onParentRefocus: async () => {
      if (!authToken) {
        return;
      }

      let status: any;

      try {
        let response = await apiCall(base + "?check=true&auth-token=" + authToken);

        status = await response.json();
      } catch (e) {
        popupWindow.offParentRefocus();
        return;
      }

      if (status.success) {
        popupWindow.offParentRefocus();

        broadcastChannel?.postMessage({ type: "signin" });

        if (options?.subscribeTo && options?.subscribeWith == "paddle") {
          // The sign in was caused by a call of createSubscription.
          // Proceed with that flow and directly go to Paddle checkout.

          // NOTE: this behavior can be very buggy depending on the onSuccess/onError handling.
          // e.g. if user is already subscribed, they will be logged in but onSuccess won't be called:
          // if auth state is handled in onSuccess this will break the app

          createSubscription({
            priceID: options.subscribeTo,
            paymentProvider: "paddle",
            onSuccess: options.onSuccess,
            onError: options.onError,
          });
          return;

          // For stripe, the same popup window used for sign in will redirect to the Stripe checkout URL.
          // No action is required from the library.
        }

        if (options?.onSuccess) {
          options.onSuccess();
        } else {
          console.info("Reflow: user is signed in");
        }
      }
    },
  });

  let openTimestamp = Date.now();

  if (messageListener) {
    window.removeEventListener("message", messageListener);
  }

  messageListener = (e: any) => {
    if (!popupWindow.getWindowInstance()) {
      return;
    }

    if (e.source !== popupWindow.getWindowInstance()) {
      return;
    }

    if (e.data.authToken) {
      authToken = e.data.authToken;
    }
  };

  window.addEventListener("message", messageListener);

  try {
    let response = await apiCall(base + "?init=true");

    let data = await response.json();

    if (!data.success && data.reason == "already-signed-in") {
      setTimeout(() => {
        popupWindow.close();
      }, Math.max(2500 - (Date.now() - openTimestamp), 0)); // Keep the window visible for at least 2.5 sec

      if (options?.onSuccess) {
        options.onSuccess();
      } else {
        console.info("Reflow: user is already signed in");
      }

      return;
    }

    const url = new URL(data.signinURL);
    const params = new URLSearchParams(url.search);

    params.append("origin", window.location.origin);
    params.append("nonceHash", data.nonceHash);
    params.append("step", options?.step || "login");

    if (options?.subscribeTo) {
      params.append("subscribeTo", String(options?.subscribeTo));
    }

    if (options?.subscribeWith) {
      params.append("subscribeWith", options.subscribeWith);
    }

    url.search = params.toString();

    popupWindow.setURL(url.toString());
  } catch (e) {
    popupWindow.close();

    if (options?.onError) {
      options.onError(e);
    } else {
      console.error("Reflow:", e);
    }
  }
}

/* Signs out the current user */
export async function signOut(options?: {
  authEndpoint?: string;
  onSuccess?: Function;
  onError?: Function;
}) {
  let base = apiBase(options?.authEndpoint);

  if (working) {
    return;
  }

  try {
    working = true;
    let response = await apiCall(base + "?signout=true");

    let data = await response.json();
    working = false;

    if (data.success) {
      broadcastChannel?.postMessage({ type: "signout" });

      if (options?.onSuccess) {
        options.onSuccess();
      } else {
        console.info("Reflow: user is signed out");
      }
    }
  } catch (e: any) {
    working = false;
    if (options?.onError) {
      options.onError(e);
    } else {
      console.error("Reflow:", e);
    }
  }
}

/* Displays a payment window to the currently signed in user, where they can 
sign up for the subscription plan at the price given in the priceID argument. */
export async function createSubscription(options: {
  priceID: number;
  authEndpoint?: string;
  paymentProvider?: string;
  onSuccess?: Function;
  onError?: Function;
}) {
  if (working) {
    return;
  }

  initializeDialogs({ authEndpoint: options.authEndpoint });

  let base = apiBase(options.authEndpoint);
  let paymentProvider = options.paymentProvider || "stripe";

  if (!(await isSignedIn())) {
    // Sign in and initiate a subscription in the same window
    signIn({
      subscribeTo: options.priceID,
      subscribeWith: paymentProvider,
      onSuccess: options.onSuccess,
      onError: options.onError,
    });
    return;
  }

  if (paymentProvider == "stripe") {
    // Stripe checkout is displayed in a Stripe-hosted page loaded inside a popup window.
    // Open the window in an empty state immediately to make sure the browser understands it was opened due to user action.

    popupWindow.open({
      url: null,
      label: "reflow-subscription",
      title: "Loading..",
      size: {
        w: 650,
        h: 800,
      },
      onParentRefocus: async () => {
        try {
          working = true;
          let change = await refreshSession();
          if (change?.signout) {
            broadcastChannel?.postMessage({ type: "signout" });
            throw new Error("User has been signed out");
          }

          working = false;

          if (change?.subscription) {
            broadcastChannel?.postMessage({ type: "subscribe" });

            if (options.onSuccess) {
              options.onSuccess(change);
            } else {
              console.info("Reflow: user subscription created");
            }

            popupWindow.close();
          }
        } catch (e: any) {
          working = false;

          if (options.onError) {
            options.onError(e);
          } else {
            console.error("Reflow:", e);
          }

          popupWindow.close();
        }

        setTimeout(() => {
          if (popupWindow.isClosed()) {
            popupWindow.offParentRefocus();
          }
        }, 500);
      },
    });
  } else if (paymentProvider == "paddle") {
    loadingDialog.open();
  }

  // Get the data necessary for continuing to checkout.
  // For stripe that is a checkout URL.
  // For paddle, its seller and price ids.

  let response, checkoutData;

  try {
    working = true;
    response = await apiCall(
      base +
        "?create-subscription=true&priceID=" +
        options.priceID +
        "&paymentProvider=" +
        paymentProvider
    );
    checkoutData = await response.json();
    working = false;
  } catch (e: any) {
    if (options.onError) {
      options.onError(e);
    } else {
      console.error("Reflow:", e);
    }

    popupWindow.close();
    loadingDialog.close();
    working = false;
    throw e;
  }

  if (checkoutData.provider == "stripe") {
    // Stripe subscriptions are handled in a popup window that redirects to the checkout url.

    popupWindow.setURL(checkoutData.checkoutURL);
  }

  if (checkoutData.provider == "paddle") {
    if (!paddleSubscribeCheckout) {
      paddleSubscribeCheckout = await initializePaddle({
        environment: checkoutData.mode == "test" ? "sandbox" : "production",
        seller: checkoutData.seller_id,
        eventCallback: function (ev: PaddleEventData) {
          if (ev.name == "checkout.closed" && ev.data?.status == "completed") {
            loadingDialog.open();

            clearInterval(paddleSubscriptionCheckInterval);
            paddleSubscriptionCheckInterval = window.setInterval(async () => {
              try {
                // Note: this flow differs slightly from vanilla auth:
                // The Reflow api route used for checking subscription status is not the same.

                working = true;

                let change = await refreshSession();
                if (change?.signout) {
                  broadcastChannel?.postMessage({ type: "signout" });
                  throw new Error("User has been signed out");
                }

                working = false;

                if (change?.subscription) {
                  broadcastChannel?.postMessage({ type: "subscribe" });

                  if (options.onSuccess) {
                    options.onSuccess(change);
                  } else {
                    console.info("Reflow: user subscription created");
                  }

                  clearInterval(paddleSubscriptionCheckInterval);
                  loadingDialog.close();
                }
              } catch (e: any) {
                working = false;

                if (options.onError) {
                  options.onError(e);
                } else {
                  console.error("Reflow:", e);
                }
              }
            }, 1000 * 1); // Check every second

            setTimeout(() => {
              clearInterval(paddleSubscriptionCheckInterval);
              loadingDialog.close();
            }, 1000 * 60 * 2); // Give up after 2 mins
          }
        },
      });
    }

    let checkoutSettings: CheckoutOpenOptions = {
      settings: {
        showAddDiscounts: false,
      },
      items: [
        {
          priceId: checkoutData.paddle_price_id,
          quantity: 1,
        },
      ],
      customData: {
        store_id: checkoutData.store.id.toString(),
        user_id: checkoutData.user.id.toString(),
        price_id: options.priceID,
      },
    };

    if (checkoutData.user.email) {
      checkoutSettings.customer = {
        email: checkoutData.user.email,
      };
    }

    loadingDialog.close();
    paddleSubscribeCheckout?.Checkout.open(checkoutSettings);
  }
}

/* Opens a window which lets the user change their payment method and billing info, or switch 
to a different plan if available. */
export async function modifySubscription(options?: {
  authEndpoint?: string;
  onSuccess?: Function;
  onError?: Function;
}) {
  let subscription = await getSubscription();

  if (!subscription) {
    console.error("Reflow: User does not have a subscription");
    return;
  }

  if (working) {
    return;
  }

  initializeDialogs({ authEndpoint: options?.authEndpoint });

  let onRefocusAuthChanged = async () => {
    try {
      working = true;
      let change = await refreshSession();
      if (change?.signout) {
        broadcastChannel?.postMessage({ type: "signout" });
        throw new Error("User has been signed out");
      }

      working = false;

      if (change?.subscription) {
        if (options?.onSuccess) {
          options.onSuccess();
        } else {
          console.info("Reflow: user subscription updated");
        }
      }
    } catch (e: any) {
      working = false;

      if (options?.onError) {
        options.onError(e);
      } else {
        console.error("Reflow:", e);
      }
    }
  };

  if (subscription.payment_provider == "stripe") {
    // If the subscription is stripe based, prepare a popup window for the Stripe-hosted management page.
    popupWindow.open({
      url: null,
      label: "reflow-subscription",
      title: "Loading..",
      size: {
        w: 650,
        h: 800,
      },
      onParentRefocus: async () => {
        await onRefocusAuthChanged();

        setTimeout(() => {
          if (popupWindow.isClosed()) {
            popupWindow.offParentRefocus();
          }
        }, 500);
      },
    });
  } else if (subscription.payment_provider == "paddle") {
    // For paddle subscriptions we show a loading dialog.
    loadingDialog.open();
  }

  let base = apiBase(options?.authEndpoint);
  let response: any;

  try {
    working = true;
    response = await apiCall(base + "?manage-subscription=true");
    working = false;
  } catch (e: any) {
    if (options?.onError) {
      options.onError(e);
    } else {
      console.error("Reflow: " + e);
    }

    if (e.data) console.error(e.data);

    working = false;

    popupWindow.close();
    loadingDialog.close();

    throw e;
  }

  let manageSubscriptionData = await response.json();

  if (manageSubscriptionData.provider == "stripe") {
    popupWindow.setURL(manageSubscriptionData.subscriptionManagementURL);
  }

  if (manageSubscriptionData.provider == "paddle") {
    loadingDialog.close();
    paddleManageSubscriptionDialog.open(manageSubscriptionData, onRefocusAuthChanged);
  }
}

/* Returns a boolean indicating whether the user is currently signed in or not */
export async function isSignedIn(options?: { authEndpoint?: string }): Promise<boolean> {
  let base = apiBase(options?.authEndpoint);

  let response = await apiCall(base + "?is-signed-in=true");

  let data = await response.json();
  return data.status;
}

/* Returns the user's subscription if such exists. Returns null if user not signed in at all */
export async function getSubscription(options?: {
  authEndpoint?: string;
}): Promise<Subscription | null> {
  let base = apiBase(options?.authEndpoint);

  let response = await apiCall(base + "?get-subscription=true");

  let data = await response.json();
  return data.subscription;
}

/* Forces the auth session to refresh. */
export async function refreshSession(options?: {
  authEndpoint?: string;
}): Promise<AuthRefreshChange | null> {
  let base = apiBase(options?.authEndpoint);

  let response = await apiCall(base + "?refresh=true&force=true");

  return await response.json();
}

// Helper functions

function apiBase(authEndpoint?: string): string {
  return (authEndpoint ?? "/auth").replace(/[\/\s]+$/, "");
}

async function apiCall(url: string): Promise<Response> {
  let response = await fetch(url, {
    credentials: "include",
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  return response;
}

function initializeDialogs(options: { authEndpoint?: string }) {
  if (document.querySelector(".reflow-auth-dialog-container")) {
    // The container is present on the page. Dialogs should be working.
    return;
  }

  // Add the dialog container to the page and initialize / reinitialize the dialogs.
  let dialogContainer = document.createElement("div");
  dialogContainer.classList.add("reflow-auth-dialog-container");
  document.body.append(dialogContainer);

  loadingDialog = new LoadingDialog({ container: dialogContainer });

  paddleManageSubscriptionDialog = new PaddleManageSubscriptionDialog({
    container: dialogContainer,
    updatePlan: async (priceID: string): Promise<Subscription | null> => {
      let base = apiBase(options?.authEndpoint);
      let response = await apiCall(base + "?update-subscription=true&priceID=" + priceID);
      return await response.json();
    },
    cancelSubscription: async () => {
      let base = apiBase(options?.authEndpoint);
      let response = await apiCall(base + "?cancel-subscription=true");
      return await response.json();
    },
  });
}
