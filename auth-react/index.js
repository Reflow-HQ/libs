import { useState, useEffect, useRef } from "react";
import Auth from "@reflowhq/auth";

export default function useAuth(config = {}) {
  const authRef = useRef(null);

  if (authRef.current === null) {
    if (config instanceof Auth) {
      authRef.current = config;
    } else if (config.storeID) {
      authRef.current = new Auth({ ...config, autoBind: false });
    } else {
      throw new Error("storeID config option is required");
    }
  }

  const [authObj, setAuthObj] = useState(makeAuthObject(authRef.current));

  useEffect(() => {
    // Subscribe for auth events and cleanup
    // when the component is unmounted

    authRef.current.bind();

    let authCb = () => {
      setAuthObj(makeAuthObject(authRef.current));
    };

    authRef.current.on("change", authCb);

    return () => {
      authRef.current.unbind();
      authRef.current.off("change", authCb);
    };
  }, []);

  return authObj;
}

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
