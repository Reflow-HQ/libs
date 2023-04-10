import React, { useState, useEffect } from "react";

import { useShoppingCart } from "../CartContext";

import SummaryProduct from "../components/SummaryProduct";
import shortenString from "../utilities/shortenString";

export default function Summary({ readOnly = false, onError }) {
  const [discountCode, setDiscountCode] = useState("");
  const [isSummaryOpen, setSummaryOpen] = useState(false);

  const [formErrors, setFormErrors] = useState({});

  const {
    products,
    coupon,
    giftCard,
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
    giftCard: s.giftCard,
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

  const shouldShowDiscountForm = !readOnly && (!coupon || !giftCard);

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

  function submitDicountForm(e) {
    e.preventDefault();
    applyDiscountCode(discountCode);
  }

  function applyDiscountCode(code) {
    return cartManager
      .applyDiscountCode({ code })
      .then((result) => {
        // TODO: onMessage title: t('cart.' + result.type +  '_added')
        resetCoupon();
      })
      .catch((e) => {
        updateDicountError(cartManager.getErrorText(e));
      });
  }

  function removeCoupon() {
    return cartManager.removeCoupon().catch(() => {
      onError({
        title: t("error"),
      });
    });
  }

  function removeGiftCard() {
    return cartManager.removeGiftCard().catch(() => {
      onError({
        title: t("error"),
      });
    });
  }

  function resetCoupon() {
    setDiscountCode("");
    resetDiscountError();
  }

  function resetDiscountError() {
    updateDicountError("");
  }

  function updateDicountError(errorText = "") {
    setFormErrors((prevFormErrors) => {
      return {
        ...prevFormErrors,
        "discount-code": errorText,
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
          {products.map((product) => (
            <SummaryProduct
              key={cartManager.getProductKey(product)}
              product={product}
            ></SummaryProduct>
          ))}
        </div>
        <hr />
        {shouldShowDiscountForm && (
          <>
            <div className="ref-discount-code">
              <form className="ref-discount-code-container" onSubmit={(e) => submitDicountForm(e)}>
                <div className="ref-discount-code-input-holder">
                  <input
                    id="ref-discount-code-input"
                    className="ref-form-control"
                    name="discount-code"
                    type="text"
                    value={discountCode}
                    maxLength="32"
                    autoComplete="off"
                    placeholder={t("cart.discount_code_placeholder")}
                    onChange={(e) => setDiscountCode(e.target.value)}
                  />
                  {discountCode && (
                    <span
                      className="ref-discount-code-input-clear"
                      title={t("clear")}
                      onClick={resetCoupon}
                    >
                      ✕
                    </span>
                  )}
                </div>
                <button
                  className={`ref-button ref-button-success ref-add-code${
                    discountCode ? "" : " inactive"
                  }`}
                >
                  {t("apply")}
                </button>
              </form>
              {formErrors["discount-code"] && (
                <div className="ref-validation-error">{formErrors["discount-code"]}</div>
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
                  {!readOnly && (
                    <span className="ref-remove-coupon" onClick={removeCoupon}>
                      {t("remove")}
                    </span>
                  )}
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
          {giftCard && (
            <div class="ref-applied-gift-card">
              <div class="ref-row">
                <div class="ref-row">
                  <span>{giftCard.code}</span>
                  {!readOnly && (
                    <span class="ref-remove-gift-card" onClick={removeGiftCard}>
                      {t("remove")}
                    </span>
                  )}
                </div>
                <span>
                  {giftCard.errorCode
                    ? ""
                    : "-" + cartManager.formatCurrency(giftCard.discountAmount)}
                </span>
              </div>
              <div class="ref-row">
                {"(" +
                  t("cart.gift_card_balance", {
                    amount: cartManager.formatCurrency(giftCard.balance),
                  }) +
                  ")"}
              </div>
              <div class="ref-applied-gift-card-error">
                {cartManager.getErrorText({ data: { errorCode: giftCard.errorCode } }) || ""}
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
