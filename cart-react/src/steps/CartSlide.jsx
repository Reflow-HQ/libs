import React from "react";

import CartProduct from "../components/CartProduct";

import { useShoppingCart } from "../CartContext";
import useLocalStorageFormData from "../hooks/useLocalStorageFormData";
import PayPalButton from "../components/PayPalButton";
import FooterLinks from "../components/FooterLinks";

const CartSlide = ({ successURL, onMessage, step, setStep }) => {
  const cartManager = useShoppingCart((s) => s.cartManager);
  const t = useShoppingCart((s) => s.t);

  const products = useShoppingCart((s) => s.products);
  const footerLinks = useShoppingCart((s) => s.footerLinks);
  const subtotal = useShoppingCart((s) => s.subtotal);
  const taxes = useShoppingCart((s) => s.taxes);
  const errors = useShoppingCart((s) => s.errors);

  const formDataKey = useShoppingCart((s) => s.localFormData.formDataKey);
  const useFormData = useLocalStorageFormData(formDataKey);

  const [termsAccepted, setTermsAccepted] = useFormData("termsAccepted", false);

  const taxAmount = taxes?.amount || 0;

  function getSubtotal() {
    let price = subtotal;

    if (cartManager.getTaxPricingType() === "inclusive") {
      price += taxAmount;
    }

    return cartManager.formatCurrency(price);
  }

  function onSubmit(e) {
    e.preventDefault();

    // Check for state errors and send them through an onMessage callback
    // so the user can handle them however they see fit

    for (const err of errors) {
      if (
        err.severity == "fatal" &&
        [
          "unavailable-quantity",
          "product-min-qty-not-reached",
          "product-max-qty-exceeded",
        ].includes(err.type)
      ) {
        onMessage({ type: "error", title: cartManager.getStateErrorMessage(err) });
        return;
      }

      // The "min-val-not-reached" error is not displayed in this step
      // because discounts are not shown here but are accounted for when calculating min cart val.
      // The error is shown in the next steps instead.
    }

    setStep("details");
  }

  function renderTermsOfAgreement() {
    const requiredLinks = footerLinks.filter((l) => l.required);
    const hasFooterLinks = !!requiredLinks.length;

    if (hasFooterLinks) {
      return (
        <form className="ref-accept-terms" onSubmit={onSubmit}>
          <label>
            <input
              type="checkbox"
              id="ref-terms-agreement"
              required
              checked={termsAccepted}
              onChange={() => setTermsAccepted(!termsAccepted)}
            />
            <span className="ref-terms-agreement-text">
              {t("cart.terms_agree", { terms: "" })}
              {requiredLinks.map((link, index) => (
                <span key={link.id}>
                  <a href={link.url}>{t("cart." + link.id)}</a>
                  <span>
                    {index === requiredLinks.length - 2
                      ? " and "
                      : index === requiredLinks.length - 1
                      ? ""
                      : ", "}
                  </span>
                </span>
              ))}
            </span>
          </label>
          <div className="ref-row ref-checkout-buttons">
            {cartManager.isPaypalSupported() && (
              <div className="ref-paypal-express-checkout-holder">
                <PayPalButton
                  fundingSource={"PAYPAL"}
                  step={step}
                  canSubmit={() => !!termsAccepted}
                  successURL={successURL}
                  onMessage={onMessage}
                  style={{
                    height: 42,
                  }}
                />
              </div>
            )}
            <button className="ref-button ref-standard-checkout-button">
              {t("cart.checkout")}
            </button>
          </div>
        </form>
      );
    }

    return null;
  }

  return (
    <div className="ref-cart">
      <div className="ref-heading">{t("shopping_cart")}</div>
      <div className="ref-th">
        <div className="ref-product-col">{t("product")}</div>
        <div className="ref-price-col">{t("price")}</div>
        <div className="ref-quantity-col">{t("quantity")}</div>
        <div className="ref-total-col">{t("total")}</div>
      </div>
      <div className="ref-cart-table">
        {products.map((product) => (
          <CartProduct key={cartManager.getProductKey(product)} product={product} />
        ))}
      </div>
      <div className="ref-footer">
        <FooterLinks />
        <div className="ref-totals">
          <div className="ref-subtotal">{`${t("subtotal")}: ` + getSubtotal()}</div>
          {renderTermsOfAgreement()}
        </div>
      </div>
    </div>
  );
};

export default CartSlide;
