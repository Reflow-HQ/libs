import React, { useState, useEffect } from "react";

import { useShoppingCart } from "../CartContext";

import SummaryProduct from "../components/SummaryProduct";
import shortenString from "../utilities/shortenString";

export default function Summary({ readOnly = false, onMessage, updateCart }) {
  const [discountCode, setDiscountCode] = useState("");
  const [isSummaryOpen, setSummaryOpen] = useState(false);

  const [formErrors, setFormErrors] = useState({});

  const cart = useShoppingCart();

  const {
    t,
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
  } = cart;

  const [shippingLabel, setShippingLabel] = useState(getShippingLabel());
  const [shippingPrice, setShippingPrice] = useState(getShippingPriceLabel());

  const shouldShowDiscountForm = !readOnly && (!coupon || !giftCard);

  useEffect(() => {
    if (!cart.hasPhysicalProducts()) {
      setShippingLabel("");
      setShippingPrice("");
      return;
    }

    setShippingLabel(getShippingLabel());
    setShippingPrice(getShippingPriceLabel());
  }, [shippingMethods, deliveryMethod]);

  function getShippingLabel() {
    let label = t("shipping");

    if (deliveryMethod === "shipping") {
      for (let s of shippingMethods) {
        if (s.chosen) {
          return `${t("shipping")} (${s.name})`;
        }
      }
    }

    if (deliveryMethod === "pickup") {
      label = t("pickup_at_store");

      for (let l of locations) {
        if (l.chosen) {
          return t("cart.pickup_at_store", { store: l.name });
        }
      }
    }

    return label;
  }

  function getShippingPriceLabel() {
    if (deliveryMethod === "shipping") {
      for (let s of shippingMethods) {
        if (s.chosen) {
          return cart.formatCurrency(s.price);
        }
      }
    }

    if (deliveryMethod === "pickup") {
      return cart.formatCurrency(0);
    }

    return t("cart.shipping_not_selected");
  }

  function submitDicountForm(e) {
    e.preventDefault();
    applyDiscountCode(discountCode);
  }

  function applyDiscountCode(code) {
    return cart
      .applyDiscountCode({ code })
      .then((result) => {
        onMessage({
          type: "success",
          title: t("cart." + result.type + "_added"),
        });
        resetCoupon();
      })
      .catch((e) => {
        updateDicountError(cart.getErrorText(e));
      });
  }

  function removeDiscountCode(code) {
    return cart.removeDiscountCode({ code }).catch(() => {
      onMessage({
        type: "error",
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
    <div className="ref-summary">
      <div className={`ref-summary-toggle ref-field-collapsible${isSummaryOpen ? " open" : ""}`}>
        <span className="ref-field-toggle" onClick={() => setSummaryOpen(!isSummaryOpen)}>
          <span className="ref-field-toggle-title">{t("cart.show_summary")}</span>
          <span className="ref-summary-total">{cart.formatCurrency(total)}</span>
        </span>
      </div>
      <div className={`ref-summary-content${isSummaryOpen ? " open" : ""}`}>
        <div className="ref-heading">{t("cart.order_summary")}</div>
        <div className="ref-products">
          {products.map((product) => (
            <SummaryProduct
              key={product.lineItemID}
              product={product}
              updateCart={updateCart}
              showPriceBreakdown={true}
              showPersonalization={true}
              showRemoveButton={!product.inStock}
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
              <span>{cart.formatCurrency(subtotal)}</span>
            </div>
          </div>
          {!!coupon && (
            <div className="ref-applied-coupon">
              <div className="ref-row">
                <div className="ref-row">
                  <span>{shortenString(couponLabel, 15)}</span>
                  {!readOnly && (
                    <span
                      className="ref-remove-coupon"
                      onClick={() => removeDiscountCode(coupon.code)}
                    >
                      {t("remove")}
                    </span>
                  )}
                </div>
                <span>{coupon.errorCode ? "" : "-" + cart.formatCurrency(discount)}</span>
              </div>
              <div className="ref-applied-coupon-error"></div>
            </div>
          )}
          {cart.hasPhysicalProducts() && (
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
                  {taxRate
                    ? `${taxRate.name} (${taxRate.rate}%)` +
                      (taxDetails.exemption ? " – " + taxDetails.exemption : "")
                    : ""}
                </span>
                <span>{cart.formatCurrency(taxes.amount)}</span>
              </div>
            </div>
          )}
          {giftCard && (
            <div className="ref-applied-gift-card">
              <div className="ref-row">
                <div className="ref-row">
                  <span>{giftCard.code}</span>
                  {!readOnly && (
                    <span
                      className="ref-remove-gift-card"
                      onClick={() => removeDiscountCode(giftCard.code)}
                    >
                      {t("remove")}
                    </span>
                  )}
                </div>
                <span>
                  {giftCard.errorCode ? "" : "-" + cart.formatCurrency(giftCard.discountAmount)}
                </span>
              </div>
              <div className="ref-row">
                {"(" +
                  t("cart.gift_card_balance", {
                    amount: cart.formatCurrency(giftCard.balance),
                  }) +
                  ")"}
              </div>
              <div className="ref-applied-gift-card-error">
                {cart.getErrorText({ data: { errorCode: giftCard.errorCode } }) || ""}
              </div>
            </div>
          )}
        </div>
        <hr />
        <div className="ref-total">
          <div className="ref-row">
            <span>{t("total")}</span>
            <span>{cart.formatCurrency(total)}</span>
          </div>
          <div className="ref-total-note">
            {t("cart.prices_currency_description", { currency })}
          </div>
        </div>
      </div>
    </div>
  );
}
