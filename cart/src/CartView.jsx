import { useState } from "react";

import { useShoppingCart } from "./CartContext";
import CartSlide from "./steps/CartSlide";
import CheckoutSlide from "./steps/CheckoutSlide";

const CartView = () => {
  const [step, setStep] = useState("cart");

  const { cartState, t } = useShoppingCart();
  const { products, isLoading } = cartState;

  function renderActiveSlide() {
    if (step === "cart") {
      return <CartSlide setStep={setStep} />;
    } else {
      return <CheckoutSlide setStep={setStep} />;
    }
  }

  /* Todo: write tests with jest. I need to have a variant that uses a static state as well. I also need
    to show different attributes for customizing panels, layout, injecting components, placing things in the URL(?)

   */

  return (
    <div className="reflow-shopping-cart">
      <div className={"ref-loading-backdrop " + (isLoading ? "active" : "")}></div>
      {products.length ? (
        renderActiveSlide()
      ) : (
        <div className="ref-message">{t("cart.errors.empty")}</div>
      )}
    </div>
  );
};

export default CartView;
