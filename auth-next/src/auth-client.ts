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

      setTimeout(async () => {
        await sessionSignOutCheck();

        sessionSyncInterval = window.setInterval(async () => {
          await sessionSignOutCheck();
        }, 5 * 60 * 1000);
      }, 30 * 1000);
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
  onSignin?: Function;
  onSubscribe?: Function;
  onSuccess?: Function;
  onError?: Function;
  step?: "login" | "register";
  subscribeTo?: number;
  subscribeWith?: string;
}) {
  let base = apiBase(options?.authEndpoint);

  if (options?.onSuccess) {
    console.warn(
      "The `onSuccess` option of the signIn method is deprecated. Please update your code to use the `onSignin` and `onSubscribe` callbacks instead."
    );
  }

  let isSignedIn = false;
  let authCheckInProgress = false;

  let callbacks: { onSignIn: Function; onSubscribe: Function; onError: Function } = {
    onSignIn: () => {
      if (options?.onSignin) return options.onSignin();
      if (options?.onSuccess) return options.onSuccess();
      console.info("Reflow: user has signed in");
    },
    onSubscribe: () => {
      if (options?.onSubscribe) return options.onSubscribe();
      console.info("Reflow: user has subscribed");
    },
    onError: (e: any) => {
      if (options?.onError) return options.onError(e);
      console.error("Reflow:", e);
    },
  };

  if (popupWindow.isOpen() && popupWindow.getLabel() === "reflow-signin") {
    popupWindow.focus();
    return;
  }

  if (!popupWindow.isOpen()) {
    popupWindow.open({
      label: "reflow-signin",
      size: {
        w: 590,
        h: 590,
      },
    });
  }

  popupWindow.setLabel("reflow-signin");
  popupWindow.setOnParentRefocus(async () => {
    if (!isSignedIn && authToken && !authCheckInProgress) {
      // Attempt sign in.

      try {
        authCheckInProgress = true;

        let attemptSigninResponse = await apiCall(base + "?check=true&auth-token=" + authToken);

        authCheckInProgress = false;

        // Check if the user has signed in using the popup window.
        // If they haven't done it yet, try again on next refocus.

        if ((await attemptSigninResponse.json()).success) {
          broadcastChannel?.postMessage({ type: "signin" });
          callbacks.onSignIn();
          isSignedIn = true;
        }
      } catch (e) {
        // There was an error during sign in or beforeSignin=false was used - do not try again.
        callbacks.onError(e);
        popupWindow.close();
        return;
      }
    }

    if (isSignedIn && options?.subscribeTo) {
      // At this point the user has signed in.
      // If subscribeTo is not set, there are no next steps - the popup window will self-close.

      // If it is set, we continue with the subscription process, depending on the payment provider.

      if (options?.subscribeWith == "paddle") {
        // For paddle, make sure the popup window is closed and continue to createSubscription.

        popupWindow.close();

        await createSubscription({
          priceID: options.subscribeTo,
          paymentProvider: "paddle",
          onSignin: callbacks.onSignIn,
          onSubscribe: callbacks.onSubscribe,
          onError: callbacks.onError,
        });

        return;
      } else {
        // For stripe, the same popup window used for sign in will redirect to the Stripe checkout URL.
        // On refocus, check if the subscription process has been successful.

        try {
          let change = await forceRefreshSession();

          if (change?.signout) {
            broadcastChannel?.postMessage({ type: "signout" });
            throw new Error("User has been signed out");
          }

          if (change?.subscription) {
            // The user has subscribed with Stripe. The popup window will self-close.
            broadcastChannel?.postMessage({ type: "subscribe" });
            callbacks.onSubscribe();
          }
        } catch (e: any) {
          callbacks.onError(e);
          return popupWindow.close();
        }
      }
    }

    // The popup window has self-closed or was closed by the user.
    // Either way, cleanup the popup window event listener.
    setTimeout(() => {
      if (popupWindow.isClosed()) {
        popupWindow.offParentRefocus();
      }
    }, 500);
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

      callbacks.onSignIn();

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
    callbacks.onError();
    popupWindow.close();
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
        console.info("Reflow: user has signed out");
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
  onSignin?: Function;
  onSubscribe?: Function;
  onSuccess?: Function;
  onError?: Function;
}) {
  if (working) {
    return;
  }

  if (options?.onSuccess) {
    console.warn(
      "The `onSuccess` option of the createSubscription method is deprecated. Please update your code to use the `onSignin` and `onSubscribe` callbacks instead."
    );
  }

  let base = apiBase(options.authEndpoint);
  let paymentProvider = options.paymentProvider || "stripe";

  let callbacks: { onSignIn: Function; onSubscribe: Function; onError: Function } = {
    onSignIn: () => {
      if (options.onSignin) return options.onSignin();
      console.info("Reflow: user has signed in");
    },
    onSubscribe: () => {
      if (options.onSubscribe) return options.onSubscribe();
      if (options.onSuccess) return options.onSuccess();
      console.info("Reflow: user has subscribed");
    },
    onError: (e: any) => {
      if (options.onError) return options.onError(e);
      console.error("Reflow:", e);
    },
  };

  if (paymentProvider == "stripe") {
    // Stripe checkout is displayed in a Stripe-hosted page loaded inside a popup window.
    // Open the window in an empty state immediately to make sure the browser understands it was opened due to user action.
    popupWindow.open({
      url: null,
      label: "reflow-subscription",
      size: {
        w: 650,
        h: 800,
      },
    });
  }

  if (!(await isSignedIn())) {
    // Open the sign in window instead, passing the callbacks from options.
    signIn({
      subscribeTo: options.priceID,
      subscribeWith: paymentProvider,
      onSignin: callbacks.onSignIn,
      onSubscribe: callbacks.onSubscribe,
      onError: callbacks.onError,
    });
    return;
  }

  if (await isSubscribed()) {
    popupWindow.close();
    return;
  }

  initializeDialogs({ authEndpoint: options.authEndpoint });

  if (paymentProvider == "stripe") {
    popupWindow.setOnParentRefocus(async () => {
      try {
        working = true;
        let change = await forceRefreshSession();
        working = false;
        if (change?.signout) {
          broadcastChannel?.postMessage({ type: "signout" });
          throw new Error("User has been signed out");
        }
        if (change?.subscription) {
          // The user has subscribed with Stripe. The popup window will self-close.
          broadcastChannel?.postMessage({ type: "subscribe" });
          callbacks.onSubscribe();
        }
      } catch (e: any) {
        working = false;
        callbacks.onError(e);
        popupWindow.close();
      }
      // The popup window has self-closed or was closed by the user.
      // Either way, cleanup all event listeners.
      setTimeout(() => {
        if (popupWindow.isClosed()) {
          popupWindow.offParentRefocus();
        }
      }, 500);
    });
  }

  if (paymentProvider == "paddle") {
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
    callbacks.onError(e);
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

                let change = await forceRefreshSession();

                working = false;

                if (change?.signout) {
                  broadcastChannel?.postMessage({ type: "signout" });
                  throw new Error("User has been signed out");
                }

                if (change?.subscription) {
                  broadcastChannel?.postMessage({ type: "subscribe" });
                  clearInterval(paddleSubscriptionCheckInterval);
                  callbacks.onSubscribe();
                  loadingDialog.close();
                }
              } catch (e: any) {
                working = false;
                callbacks.onError(e);
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
        project_id: checkoutData.project.id.toString(),
        user_id: checkoutData.user.id.toString(),
        price_id: options.priceID,
      },
    };

    if (checkoutData.user.email) {
      checkoutSettings.customer = {
        email: checkoutData.user.email,
      };
    }

    if (checkoutData.paddle_setup_fee_price_id) {
      checkoutSettings.items.push({
        priceId: checkoutData.paddle_setup_fee_price_id,
        quantity: 1,
      });
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
  if (working) {
    return;
  }

  // Open the popup window before doing any potentially slow actions such as api requests.
  popupWindow.open({
    label: "reflow-subscription",
    size: {
      w: 650,
      h: 800,
    },
  });

  let subscription = await getSubscription();

  if (!subscription) {
    console.error("Reflow: User does not have a subscription");
    popupWindow.close();
    return;
  }

  initializeDialogs({ authEndpoint: options?.authEndpoint });

  let onRefocusAuthChanged = async () => {
    try {
      working = true;
      let change = await forceRefreshSession();
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
    popupWindow.setOnParentRefocus(async () => {
      await onRefocusAuthChanged();

      setTimeout(() => {
        if (popupWindow.isClosed()) {
          popupWindow.offParentRefocus();
        }
      }, 500);
    });
  }

  if (subscription.payment_provider == "paddle") {
    // For paddle subscriptions we show a loading dialog.
    popupWindow.close();
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

/* Returns a boolean indicating whether the user has an active subscription */
export async function isSubscribed(options?: { authEndpoint?: string }): Promise<boolean> {
  let base = apiBase(options?.authEndpoint);

  let response = await apiCall(base + "?is-subscribed=true");

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
export async function forceRefreshSession(options?: {
  authEndpoint?: string;
}): Promise<AuthRefreshChange | null> {
  let base = apiBase(options?.authEndpoint);

  let response = await apiCall(base + "?refresh=true&force=true");

  return await response.json();
}

// Sign out the user if the session has ended on the backend.
// Will only check if last refresh was > 5 min ago.
export async function sessionSignOutCheck(options?: {
  authEndpoint?: string;
}): Promise<AuthRefreshChange | null> {
  let base = apiBase(options?.authEndpoint);

  let response = await apiCall(base + "?refresh=true");

  let data: AuthRefreshChange | null = await response.json();

  if (data?.signout) {
    // We only care about the signout event, which might arise when the
    // user session is reset from the Reflow backend. The other broadcast
    // events are triggered in the other client functions in this file.
    broadcastChannel?.postMessage({ type: "signout" });
  }

  return data;
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
    let body = await response.json();
    throw new Error(body.error || "Network response was not ok");
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
