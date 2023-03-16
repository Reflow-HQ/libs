import { useState, useEffect } from "react";

import { useShoppingCart } from "../CartContext";

import SummaryProduct from "../components/SummaryProduct";
import shortenString from "../utilities/shortenString";

export default function Summary() {
  const [couponCode, setCouponCode] = useState("");
  const [isSummaryOpen, setSummaryOpen] = useState(false);

  const [formErrors, setFormErrors] = useState({});

  const {
    products,
    coupon,
    discount,
    total,
    subtotal,
    currency,
    taxes,
    locations,
    deliveryMethod,
    shippingMethods,
    cartManager,
    t,
  } = useShoppingCart((s) => ({
    products: s.products,
    coupon: s.coupon,
    discount: s.discount,
    total: s.total,
    subtotal: s.subtotal,
    currency: s.currency,
    taxes: s.taxes,
    locations: s.locations,
    deliveryMethod: s.deliveryMethod,
    shippingMethods: s.shippingMethods,
    cartManager: s.cartManager,
    t: s.t,
  }));

  const [shippingLabel, setShippingLabel] = useState(t("shipping"));
  const [shippingPrice, setShippingPrice] = useState(t("cart.shipping_not_selected"));

  useEffect(() => {
    if (!cartManager.hasPhysicalProducts()) {
      setShippingLabel("");
      setShippingPrice("");
      return;
    }

    let s1 = t("shipping");
    let s2 = t("cart.shipping_not_selected");

    if (deliveryMethod === "shipping") {
      for (let s of shippingMethods) {
        if (s.chosen) {
          s1 = `${t("shipping")} (${s.name})`;
          s2 = cartManager.formatCurrency(s.price);
        }
      }
    }

    if (deliveryMethod === "pickup") {
      s1 = t("pickup_at_store");
      s2 = cartManager.formatCurrency(0);

      for (let l of locations) {
        if (l.chosen) {
          s1 = t("cart.pickup_at_store", { store: l.name });
        }
      }
    }

    setShippingLabel(s1);
    setShippingPrice(s2);
  }, [shippingMethods, deliveryMethod]);

  function submitCouponForm(e) {
    e.preventDefault();
    addCoupon(couponCode);
  }

  function addCoupon(code) {
    return cartManager
      .addCoupon({ code })
      .then(resetCoupon)
      .catch((e) => {
        updateCouponError(cartManager.getErrorText(e, "coupon-code"));
      });
  }

  function removeCoupon() {
    return cartManager.removeCoupon().catch(() => {
      onError({
        title: t("error"),
      });
    });
  }

  function resetCoupon() {
    setCouponCode("");
    resetCouponError();
  }

  function resetCouponError() {
    updateCouponError("");
  }

  function updateCouponError(errorText = "") {
    setFormErrors((prevFormErrors) => {
      return {
        ...prevFormErrors,
        "coupon-code": errorText,
      };
    });
  }

  const taxDetails = taxes?.details;
  const taxRate = taxDetails?.taxRate;

  const couponLabel = coupon?.name || coupon?.code.toUpperCase() || "";

  return (
    <>
      <div className={`ref-checkout-summary${isSummaryOpen ? " open" : ""}`}>
        <div className="ref-heading">{t("cart.order_summary")}</div>
        <div className="ref-products">
          {products.map((product, index) => (
            <SummaryProduct
              key={product.id + (product.variant?.id || "") + index}
              product={product}
            ></SummaryProduct>
          ))}
        </div>
        <hr />
        {!coupon && (
          <>
            <div className="ref-coupon-code">
              <form className="ref-coupon-container" onSubmit={(e) => submitCouponForm(e)}>
                <div className="ref-coupon-input-holder">
                  <input
                    id="ref-coupon-input"
                    className="ref-form-control"
                    name="coupon-code"
                    type="text"
                    value={couponCode}
                    maxLength="32"
                    autoComplete="off"
                    placeholder={t("cart.coupon_placeholder")}
                    onChange={(e) => setCouponCode(e.target.value)}
                  />
                  {couponCode && (
                    <span
                      className="ref-coupon-input-clear"
                      title={t("clear")}
                      onClick={resetCoupon}
                    >
                      ✕
                    </span>
                  )}
                </div>
                <button
                  className={`ref-button ref-button-success ref-add-code${
                    couponCode ? "" : " inactive"
                  }`}
                >
                  {t("apply")}
                </button>
              </form>
              {formErrors["coupon-code"] && (
                <div className="ref-validation-error">{formErrors["coupon-code"]}</div>
              )}
            </div>
            <hr />
          </>
        )}
        <div className="ref-totals">
          <div className="ref-subtotal">
            <div className="ref-row">
              <span>{t("subtotal")}</span>
              <span>{cartManager.formatCurrency(subtotal)}</span>
            </div>
          </div>
          {!!coupon && (
            <div className="ref-applied-coupon">
              <div className="ref-row">
                <div className="ref-row">
                  <span>{shortenString(couponLabel, 15)}</span>
                  <span className="ref-remove-coupon" onClick={removeCoupon}>
                    {t("remove")}
                  </span>
                </div>
                <span>{coupon.errorCode ? "" : "-" + cartManager.formatCurrency(discount)}</span>
              </div>
              <div className="ref-applied-coupon-error"></div>
            </div>
          )}
          {cartManager.hasPhysicalProducts() && (
            <div className="ref-shipping">
              <div className="ref-row">
                <span>{shippingLabel}</span>
                <span>{shippingPrice}</span>
              </div>
            </div>
          )}
          {taxes && (
            <div className="ref-taxes">
              <div className="ref-row">
                <span>
                  {`${taxRate.name} (${taxRate.rate}%)` +
                    (taxDetails.exemption ? " – " + taxDetails.exemption : "")}
                </span>
                <span>{cartManager.formatCurrency(taxes.amount)}</span>
              </div>
            </div>
          )}
        </div>
        <hr />
        <div className="ref-total">
          <div className="ref-row">
            <span>{t("total")}</span>
            <span>{cartManager.formatCurrency(total)}</span>
          </div>
          <div className="ref-total-note">
            {t("cart.prices_currency_description", { currency })}
          </div>
        </div>
      </div>
      <div className={`ref-summary-toggle ref-field-collapsible${isSummaryOpen ? " open" : ""}`}>
        <span className="ref-field-toggle" onClick={() => setSummaryOpen(!isSummaryOpen)}>
          <span className="ref-field-toggle-title">{t("cart.show_summary")}</span>
          <span className="ref-summary-total"></span>
        </span>
      </div>
    </>
  );
}
