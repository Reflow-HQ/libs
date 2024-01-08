import "client-only";
import { AuthRefreshChange } from "./auth-types";
import { useEffect } from "react";

let signInWindow: Window | null;
let checkWindowClosedInterval: number;
let subscribeCheckInterval: number;
let loginCheckInterval: number;
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
}) {
  let base = apiBase(options?.authEndpoint);

  if (signInWindow) {
    // Already open
    signInWindow.focus();
    return;
  }

  let openTimestamp = Date.now();
  signInWindow = openWindow({ title: "Signing in.." });

  if (messageListener) {
    window.removeEventListener("message", messageListener);
  }

  messageListener = (e: any) => {
    if (!signInWindow) {
      return;
    }

    if (e.source !== signInWindow) {
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
        signInWindow?.close();
        signInWindow = null;
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

    url.search = params.toString();

    if (signInWindow) {
      signInWindow.location = url.toString();
    }

    window.clearInterval(checkWindowClosedInterval);
    checkWindowClosedInterval = window.setInterval(() => {
      try {
        if (signInWindow && signInWindow.closed) {
          signInWindow = null;
        }
      } catch (e) {}

      if (!signInWindow) {
        window.clearInterval(checkWindowClosedInterval);
      }
    }, 500);

    let hasFocus = document.hasFocus();

    // Todo: rewrite this with a window focus event listener

    window.clearInterval(loginCheckInterval);
    loginCheckInterval = window.setInterval(async () => {
      if (!authToken) {
        return;
      }

      if (!hasFocus && document.hasFocus()) {
        // We've switched back to this page/window. Check the login status
        hasFocus = true;
        let status: any;

        try {
          let response = await apiCall(base + "?check=true&auth-token=" + authToken);

          status = await response.json();
        } catch (e) {
          window.clearInterval(loginCheckInterval);
          return;
        }
        if (status.success) {
          window.clearInterval(loginCheckInterval);

          broadcastChannel?.postMessage({ type: "signin" });

          if (options?.onSuccess) {
            options.onSuccess();
          } else {
            window.location.reload();
          }
        }
      }

      hasFocus = document.hasFocus();
    }, 250);
  } catch (e) {
    signInWindow?.close();
    signInWindow = null;

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

let subscriptionWindow: Window | null = null;

/* Displays a payment window to the currently signed in user, where they can 
sign up for the subscription plan at the price given in the priceID argument. */
export async function createSubscription(options: {
  priceID: number;
  authEndpoint?: string;
  onSuccess?: Function;
  onError?: Function;
}) {
  if (working) {
    return;
  }

  let base = apiBase(options?.authEndpoint);

  if (!(await isSignedIn())) {
    // Sign in and initiate a subscription in the same window
    signIn({
      subscribeTo: options.priceID,
    });
    return;
  }

  if (subscriptionWindow) {
    // Already open
    subscriptionWindow.focus();
    return;
  }

  subscriptionWindow = openWindow({ width: 650, height: 800 });

  let response, data;

  try {
    working = true;
    response = await apiCall(base + "?create-subscription=true&priceID=" + options.priceID);
    data = await response.json();
    working = false;
  } catch (e: any) {
    if (options.onError) {
      options.onError(e);
    } else {
      console.error("Reflow:", e);
    }

    subscriptionWindow?.close();
    subscriptionWindow = null;

    working = false;

    throw e;
  }

  if (subscriptionWindow) {
    subscriptionWindow.location = data.checkoutURL;
  }

  clearInterval(checkWindowClosedInterval);
  checkWindowClosedInterval = window.setInterval(() => {
    try {
      if (subscriptionWindow && subscriptionWindow.closed) {
        subscriptionWindow = null;
      }
    } catch (e) {}

    if (!subscriptionWindow) {
      clearInterval(checkWindowClosedInterval);
    }
  }, 500);

  let hasFocus = document.hasFocus();

  clearInterval(subscribeCheckInterval);
  subscribeCheckInterval = window.setInterval(async () => {
    if (!hasFocus && document.hasFocus()) {
      // We've switched back to this page/window. Refresh the state.
      hasFocus = true;

      try {
        working = true;
        let response = await apiCall(base + "?refresh=true&force=true");
        let change: AuthRefreshChange | null = await response.json();
        if (change?.signout) {
          broadcastChannel?.postMessage({ type: "signout" });
          throw new Error("User has been signed out");
        }

        working = false;

        if (change?.subscription) {
          clearInterval(subscribeCheckInterval);

          if (options.onSuccess) {
            broadcastChannel?.postMessage({ type: "subscribe" });
            options.onSuccess(change);
          }

          subscriptionWindow?.close();
          subscriptionWindow = null;
        }
      } catch (e: any) {
        working = false;
        clearInterval(subscribeCheckInterval);

        if (options.onError) {
          options.onError(e);
        } else {
          console.error("Reflow:", e);
        }

        subscriptionWindow?.close();
        subscriptionWindow = null;
      }
    }

    hasFocus = document.hasFocus();
  }, 250);
}

/* Opens a window which lets the user change their payment method and billing info, or switch 
to a different plan if available. */
export async function modifySubscription(options?: { authEndpoint?: string }) {
  if (!(await isSignedIn())) {
    console.error("Reflow: Can't modify subscription, user is not signed in");
    return;
  }

  if (working) {
    return;
  }

  if (subscriptionWindow) {
    // Already open
    subscriptionWindow.focus();
    return;
  }

  let base = apiBase(options?.authEndpoint);

  subscriptionWindow = openWindow({
    width: 650,
    height: 800,
    title: "Loading..",
  });

  let response: any;

  try {
    working = true;
    response = await apiCall(base + "?manage-subscription=true");
    working = false;
  } catch (e: any) {
    console.error("Reflow: " + e);
    if (e.data) console.error(e.data);

    subscriptionWindow?.close();
    subscriptionWindow = null;

    working = false;

    throw e;
  }

  let data = await response.json();

  if (subscriptionWindow) {
    subscriptionWindow.location = data.subscriptionManagementURL;
  }

  clearInterval(checkWindowClosedInterval);
  checkWindowClosedInterval = window.setInterval(() => {
    try {
      if (subscriptionWindow && subscriptionWindow.closed) {
        subscriptionWindow = null;
      }
    } catch (e) {}

    if (!subscriptionWindow) {
      clearInterval(checkWindowClosedInterval);
    }
  }, 500);
}

/* Returns a boolean indicating whether the user is currently signed in or not */
export async function isSignedIn(options?: { authEndpoint?: string }): Promise<boolean> {
  let base = apiBase(options?.authEndpoint);

  let response = await apiCall(base + "?is-signed-in=true");

  let data = await response.json();
  return data.status;
}

// Helper functions

function openWindow(options?: { width?: number; height?: number; title?: string }) {
  const { width = 650, height = 650, title = "" } = options || {};

  // Open and center a window relative to the current one.
  const y = window.outerHeight / 2 + window.screenY - height / 2;
  const x = window.outerWidth / 2 + window.screenX - width / 2;

  let win = window.open(
    "about:blank",
    "reflow-signin",
    `width=${width},height=${height},top=${y},left=${x}`
  );

  win?.document.write(
    `<!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
            <style>
* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
}

html {
  color:#333;
  background:#fff;
}

.loader {
  position: fixed;
  left: 50%;
  top: 50%;
  margin-left: -24px;
  margin-top: -40px;

  width: 48px;
  height: 48px;
  border: 5px solid currentColor;
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  animation: rotation 1s linear infinite;
}

@keyframes rotation {
  0% {
      transform: rotate(0deg);
  }
  100% {
      transform: rotate(360deg);
  }
}

@media (prefers-color-scheme: dark) {
  html {
    background: #141415;
    color: #fff;
  }
}
    </style>
        </head>
      <body><span class="loader"></span></body>
    </html>`
  );

  return win;
}

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
