import React, { useState, useEffect } from "react";

import { useShoppingCart } from "../CartContext";

import SummaryProduct from "../components/SummaryProduct";
import shortenString from "../utilities/shortenString";

export default function Summary({ readOnly = false, onMessage, updateCart }) {
  const [discountCode, setDiscountCode] = useState("");
  const [isSummaryOpen, setSummaryOpen] = useState(false);

  const [formErrors, setFormErrors] = useState({});

  const cartManager = useShoppingCart((s) => s.cartManager);
  const t = useShoppingCart((s) => s.t);

  const products = useShoppingCart((s) => s.products);
  const coupon = useShoppingCart((s) => s.coupon);
  const giftCard = useShoppingCart((s) => s.giftCard);
  const discount = useShoppingCart((s) => s.discount);
  const total = useShoppingCart((s) => s.total);
  const subtotal = useShoppingCart((s) => s.subtotal);
  const currency = useShoppingCart((s) => s.currency);
  const taxes = useShoppingCart((s) => s.taxes);
  const locations = useShoppingCart((s) => s.locations);
  const deliveryMethod = useShoppingCart((s) => s.deliveryMethod);
  const shippingMethods = useShoppingCart((s) => s.shippingMethods);

  const [shippingLabel, setShippingLabel] = useState(getShippingLabel());
  const [shippingPrice, setShippingPrice] = useState(getShippingPriceLabel());

  const shouldShowDiscountForm = !readOnly && (!coupon || !giftCard);

  useEffect(() => {
    if (!cartManager.hasPhysicalProducts()) {
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
          return cartManager.formatCurrency(s.price);
        }
      }
    }

    if (deliveryMethod === "pickup") {
      return cartManager.formatCurrency(0);
    }

    return t("cart.shipping_not_selected");
  }

  function submitDicountForm(e) {
    e.preventDefault();
    applyDiscountCode(discountCode);
  }

  function applyDiscountCode(code) {
    return cartManager
      .applyDiscountCode({ code })
      .then((result) => {
        onMessage({
          type: "success",
          title: t("cart." + result.type + "_added"),
        });
        resetCoupon();
      })
      .catch((e) => {
        updateDicountError(cartManager.getErrorText(e));
      });
  }

  function removeCoupon() {
    return cartManager.removeCoupon().catch(() => {
      onMessage({
        type: "error",
        title: t("error"),
      });
    });
  }

  function removeGiftCard() {
    return cartManager.removeGiftCard().catch(() => {
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
          <span className="ref-summary-total">{cartManager.formatCurrency(total)}</span>
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
                  {taxRate
                    ? `${taxRate.name} (${taxRate.rate}%)` +
                      (taxDetails.exemption ? " – " + taxDetails.exemption : "")
                    : ""}
                </span>
                <span>{cartManager.formatCurrency(taxes.amount)}</span>
              </div>
            </div>
          )}
          {giftCard && (
            <div className="ref-applied-gift-card">
              <div className="ref-row">
                <div className="ref-row">
                  <span>{giftCard.code}</span>
                  {!readOnly && (
                    <span className="ref-remove-gift-card" onClick={removeGiftCard}>
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
              <div className="ref-row">
                {"(" +
                  t("cart.gift_card_balance", {
                    amount: cartManager.formatCurrency(giftCard.balance),
                  }) +
                  ")"}
              </div>
              <div className="ref-applied-gift-card-error">
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
    </div>
  );
}
