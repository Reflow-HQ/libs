import { useState, useEffect } from "react";
import Auth from "@reflowhq/auth";

// Shared auth instances between react hooks
const authMap = new Map();

function useAuth(config = {}) {
  let authInstance;

  if (config instanceof Auth) {
    authInstance = config;
  } else if (config.storeID) {
    if (!authMap.has(config.storeID)) {
      authMap.set(config.storeID, new Auth({ ...config, autoBind: false }));
    }

    authInstance = authMap.get(config.storeID);
  } else {
    throw new Error("storeID config option is required");
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

    return () => {
      authInstance.unbind();
      authInstance.off("change", authCb);

      if (!authInstance.isBound() && authMap.has(config.storeID)) {
        // No other hook is using this instance
        authMap.delete(config.storeID);
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
    get profile() {
      return auth.profile;
    },
    updateProfile: auth.updateProfile.bind(auth),
    isSignedIn: auth.isSignedIn.bind(auth),
    isNew: auth.isNew.bind(auth),
    signIn: auth.signIn.bind(auth),
    signOut: auth.signOut.bind(auth),
    refresh: auth.refresh.bind(auth),
  };
}
