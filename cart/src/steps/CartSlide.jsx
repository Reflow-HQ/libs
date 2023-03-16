import CartProduct from "../components/CartProduct";

import { useShoppingCart } from "../CartContext";
import useLocalStorageFormData from "../hooks/useLocalStorageFormData";

const CartSlide = ({ onError, setStep }) => {
  const [termsAccepted, setTermsAccepted] = useLocalStorageFormData("termsAccepted", false);
  const { errors, products, footerLinks, subtotal, cartManager, t } = useShoppingCart((s) => ({
    errors: s.errors,
    products: s.products,
    subtotal: s.subtotal,
    footerLinks: s.footerLinks,
    cartManager: s.cartManager,
    t: s.t,
  }));

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
            <div className="ref-paypal-express-checkout-holder"></div>
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
        {products.map((product, index) => (
          <CartProduct key={product.id + (product.variant?.id || "") + index} product={product} />
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
          <div className="ref-subtotal">
            {`${t("subtotal")}: ` + cartManager.formatCurrency(subtotal)}
          </div>
          {renderTermsOfAgreement()}
          {/* TODO: add PayPal button */}
        </div>
      </div>
    </div>
  );
};

export default CartSlide;
