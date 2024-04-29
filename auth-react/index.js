import { useState, useEffect } from "react";
import Auth from "@reflowhq/auth";

// Shared auth instances between react hooks
const authMap = new Map();

function useAuth(config = {}) {
  let authInstance;

  let projectID = config.projectID || config.storeID;

  if (config instanceof Auth) {
    authInstance = config;
  } else if (projectID) {
    if (!authMap.has(projectID)) {
      authMap.set(
        projectID,
        new Auth({
          ...config,
          autoBind: false,
        })
      );
    }

    authInstance = authMap.get(projectID);
  } else {
    throw new Error("projectID config option is required");
  }

  const [authObj, setAuthObj] = useState(makeAuthObject(authInstance));

  useEffect(() => {
    // Subscribe for auth events and cleanup
    // when the component is unmounted

    authInstance.bind();

    let authCb = () => {
      setAuthObj(makeAuthObject(authInstance));
    };

    authInstance.on("change", authCb);
    config.onSignin && authInstance.on("signin", config.onSignin);

    return () => {
      authInstance.unbind();

      authInstance.off("change", authCb);
      config.onSignin && authInstance.off("signin", config.onSignin);

      if (!authInstance.isBound() && authMap.has(projectID)) {
        // No other hook is using this instance
        authMap.delete(projectID);
      }
    };
  }, []);

  return authObj;
}

export { useAuth as default, authMap as _authMap };

function makeAuthObject(auth) {
  // Wrap the auth in a new object which exposes
  // only the methods necessary for the hook.
  return {
    get user() {
      return auth.user;
    },
    get subscription() {
      return auth.subscription;
    },
    updateUser: auth.updateUser.bind(auth),
    isSignedIn: auth.isSignedIn.bind(auth),
    isNew: auth.isNew.bind(auth),
    register: auth.register.bind(auth),
    signIn: auth.signIn.bind(auth),
    signOut: auth.signOut.bind(auth),
    sendPasswordResetLink: auth.sendPasswordResetLink.bind(auth),
    refresh: auth.refresh.bind(auth),
    getToken: auth.getToken.bind(auth),
    createSubscription: auth.createSubscription.bind(auth),
    isSubscribed: auth.isSubscribed.bind(auth),
    modifySubscription: auth.modifySubscription.bind(auth),
  };
}
