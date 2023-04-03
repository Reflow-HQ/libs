import { useState, useEffect } from "react";

import { ShoppingCartProvider, useShoppingCart } from "./CartContext";
import CartSlide from "./steps/CartSlide";
import CheckoutSlide from "./steps/CheckoutSlide";

const CartView = ({ config, localization = {}, onError }) => {
  return (
    <ShoppingCartProvider config={config} localization={localization}>
      <CartUI onError={onError} />
    </ShoppingCartProvider>
  );
};

function CartUI({ onError }) {
  const [step, setStep] = useState("cart");

  const { products, isLoading, isUnavailable, cartManager, t } = useShoppingCart((s) => ({
    products: s.products,
    isLoading: s.isLoading,
    isUnavailable: s.isUnavailable,
    cartManager: s.cartManager,
    t: s.t,
  }));

  const errorMessage = isUnavailable
    ? t("cart.errors.unavailable")
    : !cartManager.arePaymentProvidersAvailable()
    ? t("cart.errors.no_payment_methods")
    : cartManager.onlyPaypalNoDelivery()
    ? t("cart.errors.only_paypal_no_delivery")
    : !products.length
    ? t("cart.errors.empty")
    : "";

  useEffect(() => {
    if (!products.length && step !== "cart") {
      setStep("cart");
    }
  }, [products]);

  function renderActiveSlide() {
    if (step === "cart") {
      return <CartSlide step={step} setStep={setStep} onError={onError} />;
    } else {
      return <CheckoutSlide step={step} setStep={setStep} onError={onError} />;
    }
  }

  /* Todo: write tests with jest. I need to have a variant that uses a static state as well. I also need
    to show different attributes for customizing panels, layout, injecting components, placing things in the URL(?)

   */

  return (
    <div className="reflow-shopping-cart">
      <div className={"ref-loading-backdrop " + (isLoading ? "active" : "")}></div>
      {errorMessage ? <div className="ref-message">{errorMessage}</div> : renderActiveSlide()}
    </div>
  );
}

export default CartView;
