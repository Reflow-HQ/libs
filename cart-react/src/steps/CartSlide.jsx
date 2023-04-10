import React from "react";

import CartProduct from "../components/CartProduct";

import { useShoppingCart } from "../CartContext";
import useLocalStorageFormData from "../hooks/useLocalStorageFormData";
import PayPalButton from "../components/PayPalButton";

const CartSlide = ({ onError, step, setStep }) => {
  const { storeID, errors, products, footerLinks, subtotal, taxes, cartManager, t } =
    useShoppingCart((s) => ({
      storeID: s.storeID,
      errors: s.errors,
      products: s.products,
      subtotal: s.subtotal,
      taxes: s.taxes,
      footerLinks: s.footerLinks,
      cartManager: s.cartManager,
      t: s.t,
    }));

  const formDataKey = `reflowFormData${storeID}`;
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

    // Check for state errors and send them through an onError callback
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
        onError({ title: cartManager.getStateErrorMessage(err) });
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
                  onError={onError}
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
        <div className="ref-links">
          {footerLinks.map((link) => (
            <a key={link.id} href={link.url} target="_blank">
              {t("cart." + link.id)}
            </a>
          ))}
        </div>
        <div className="ref-totals">
          <div className="ref-subtotal">{`${t("subtotal")}: ` + getSubtotal()}</div>
          {renderTermsOfAgreement()}
          {/* TODO: add PayPal button */}
        </div>
      </div>
    </div>
  );
};

export default CartSlide;
