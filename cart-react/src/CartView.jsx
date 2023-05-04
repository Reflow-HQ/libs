import React, { useState, useEffect } from "react";

import { ShoppingCartProvider, useShoppingCart } from "./CartContext";
import CartSlide from "./steps/CartSlide";
import CheckoutSlide from "./steps/CheckoutSlide";

const CartView = ({ cart, auth, successURL, cancelURL, onMessage }) => {
  return (
    <ShoppingCartProvider cart={cart} auth={auth}>
      <CartUI successURL={successURL} cancelURL={cancelURL} onMessage={onMessage} />
    </ShoppingCartProvider>
  );
};

export function CartUI({ successURL, cancelURL, onMessage }) {
  const [step, setStep] = useState("cart");

  const cart = useShoppingCart();

  const { products, isLoading, isLoaded, isUnavailable, t } = cart;

  const errorMessage = isUnavailable
    ? t("cart.errors.unavailable")
    : isLoaded
    ? !cart.arePaymentProvidersAvailable()
      ? t("cart.errors.no_payment_methods")
      : cart.onlyPaypalNoDelivery()
      ? t("cart.errors.only_paypal_no_delivery")
      : !products.length
      ? t("cart.errors.empty")
      : ""
    : "";

  console.log("render CartUI", isLoaded);
  console.log("render CartUI", errorMessage);

  useEffect(() => {
    if (!products.length && step !== "cart") {
      setStep("cart");
    }
  }, [products]);

  function renderActiveSlide() {
    if (step === "cart") {
      return (
        <CartSlide
          step={step}
          setStep={setStep}
          successURL={successURL}
          cancelURL={cancelURL}
          onMessage={onMessage}
        />
      );
    } else {
      return (
        <CheckoutSlide
          step={step}
          setStep={setStep}
          successURL={successURL}
          cancelURL={cancelURL}
          onMessage={onMessage}
        />
      );
    }
  }

  /* Todo: write tests with jest. I need to have a variant that uses a static state as well. I also need
    to show different attributes for customizing panels, layout, injecting components, placing things in the URL(?)

   */

  return (
    <div className="reflow-shopping-cart">
      <div className={"ref-loading-backdrop" + (isLoading ? " active" : "")}></div>
      {errorMessage ? (
        <div className="ref-message">{errorMessage}</div>
      ) : isLoaded ? (
        renderActiveSlide()
      ) : null}
    </div>
  );
}

export default CartView;
