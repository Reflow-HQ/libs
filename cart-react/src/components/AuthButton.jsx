import React from "react";
import { useShoppingCart, useAuth } from "../CartContext";

export default function AuthButton({ showPhoto = true, showName = true, userPageURL = "#" }) {
  const auth = useAuth();
  const t = useShoppingCart().t;

  if (!auth) return null;

  return (
    <div className="reflow-auth-button">
      {!auth.isSignedIn() && (
        <div className="ref-auth-button-guest">
          <div className="ref-button ref-sign-in" onClick={() => auth.signIn()}>
            {t("auth.sign_in")}
          </div>
          <div className="ref-register" onClick={() => auth.signIn()}>
            {t("auth.prompt_register")} <span className="text-primary">{t("auth.register")}</span>
          </div>
        </div>
      )}

      {auth.isSignedIn() && (
        <div className="ref-auth-button-signed">
          <a className="ref-profile-info" href={userPageURL}>
            {showPhoto && <img className="ref-profile-photo" src={auth.user.photo} />}

            {showName && <span className="ref-profile-name">{auth.user.name}</span>}
          </a>
          <div className="ref-button ref-sign-out" onClick={() => auth.signOut()}>
            {t("auth.sign_out")}
          </div>
        </div>
      )}
    </div>
  );
}
