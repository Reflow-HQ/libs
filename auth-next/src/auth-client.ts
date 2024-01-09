import "client-only";
import { AuthRefreshChange, Subscription } from "./auth-types";
import { useEffect } from "react";
import PopupWindow from "../../helpers/PopupWindow";
import PaddleManageSubscriptionDialog from "../../helpers/dialogs/PaddleManageSubscriptionDialog";
import LoadingDialog from "../../helpers/dialogs/LoadingDialog";

let popupWindow: PopupWindow = new PopupWindow({});
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

    popupWindow.startPageRefocusInterval({
      // TODO: in vanilla here we check if user is signed in using localStorage
      // the Next.js does that same check with an async request
      // so its not a good idea to run it on a interval loop

      // stopIntervalClause: async () => (await isSignedIn()) || popupWindow.isClosed(),
      stopIntervalClause: () => popupWindow.isClosed(),

      onRefocus: async () => {
        if (!authToken) {
          return;
        }

        let status: any;

        try {
          let response = await apiCall(base + "?check=true&auth-token=" + authToken);

          status = await response.json();
        } catch (e) {
          popupWindow.stopPageRefocusInterval();
          return;
        }

        if (status.success) {
          popupWindow.stopPageRefocusInterval();

          broadcastChannel?.postMessage({ type: "signin" });

          if (options?.onSuccess) {
            options.onSuccess();
          } else {
            window.location.reload();
          }
        }
      },
    });
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
        window.location.reload();
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

  let base = apiBase(options?.authEndpoint);
  let paymentProvider = options?.paymentProvider || "stripe";

  if (!(await isSignedIn())) {
    // Sign in and initiate a subscription in the same window
    signIn({
      subscribeTo: options.priceID,
      subscribeWith: paymentProvider,
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
    });
  }

  // Get the data necessary for continuing to checkout.
  // For stripe that is a checkout URL.
  // For paddle, its seller and price ids.

  let response, data;

  try {
    working = true;
    response = await apiCall(
      base +
        "?create-subscription=true&priceID=" +
        options.priceID +
        "&paymentProvider=" +
        paymentProvider
    );
    data = await response.json();
    working = false;
  } catch (e: any) {
    if (options.onError) {
      options.onError(e);
    } else {
      console.error("Reflow:", e);
    }

    popupWindow.close();
    working = false;
    throw e;
  }

  if (data.provider == "stripe") {
    // Stripe subscriptions are handled in a popup window that redirects to the checkout url.

    popupWindow.setURL(data.checkoutURL);

    popupWindow.startPageRefocusInterval({
      stopIntervalClause: () => popupWindow.isClosed(),
      onRefocus: async () => {
        try {
          working = true;
          let change = await refreshSession();
          if (change?.signout) {
            broadcastChannel?.postMessage({ type: "signout" });
            throw new Error("User has been signed out");
          }

          working = false;

          if (change?.subscription) {
            // TODO: inconsistent behavior of onSuccess.
            // sometimes when not provided it refreshes the page (signIn function)
            // sometimes does nothing (here)
            if (options.onSuccess) {
              broadcastChannel?.postMessage({ type: "subscribe" });
              options.onSuccess(change);
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
      },
    });
  }

  if (paymentProvider == "paddle") {
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
    });
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

    popupWindow.close();
    working = false;

    throw e;
  }

  let data = await response.json();

  if (data.provider == "stripe") {
    popupWindow.setURL(data.subscriptionManagementURL);

    popupWindow.startPageRefocusInterval({
      stopIntervalClause: () => popupWindow.isClosed(),
      onRefocus: async () => {
        try {
          working = true;
          let change = await refreshSession();
          if (change?.signout) {
            broadcastChannel?.postMessage({ type: "signout" });
            throw new Error("User has been signed out");
          }

          working = false;

          if (change?.subscription && options?.onSuccess) {
            // TODO: onSuccess doesn't describe when this is called properly
            // but onPageRefocusAfterSuccessfulChange is insane
            options.onSuccess(change);
          }
        } catch (e: any) {
          working = false;

          if (options?.onError) {
            options.onError(e);
          } else {
            console.error("Reflow:", e);
          }
        }
      },
    });
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
