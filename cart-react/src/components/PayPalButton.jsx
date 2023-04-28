import ReactDOM from "react-dom";
import React, { useState, useEffect } from "react";
import { useShoppingCart, useAuth } from "../CartContext";

import useExternalScript from "../hooks/useExternalScript";
import formatURL from "../utilities/formatURL";

export default function PayPalButton({
  fundingSource,
  style = {},
  checkoutStep,
  canSubmit,
  onMessage,
}) {
  const auth = useAuth();
  const cartManager = useShoppingCart().cartManager;
  const currency = useShoppingCart().currency;

  const paypalProvider = cartManager.getPaymentProvider("paypal");

  if (!paypalProvider) return null;

  const externalScript =
    "https://www.paypal.com/sdk/js?client-id=" +
    paypalProvider.clientID +
    "&disable-funding=credit,bancontact,blik,eps,giropay,ideal,mercadopago,mybank,p24,sepa,sofort,venmo" +
    "&merchant-id=" +
    paypalProvider.merchantID +
    "&currency=" +
    currency +
    "&integration-date=2023-03-30";

  const state = useExternalScript(externalScript);
  const sdkLoaded = state === "ready";

  const [paypalError, setPaypalError] = useState("");

  async function createOrder() {
    if (!canSubmit()) return;

    try {
      const data = { "checkout-step": checkoutStep };

      if (auth && auth.isSignedIn()) {
        data["auth-account-id"] = auth.user.id;
      }

      let result = await cartManager.paypalCreateOrder(data);
      return result;
    } catch (e) {
      console.log(e);
    }
  }

  async function onApprove(data, actions) {
    try {
      const result = await cartManager.paypalOnApprove(data, actions);

      window.location = formatURL(successURL, {
        order_id: result.orderID,
        secure_hash: result.secureHash,
      });
    } catch (e) {
      if (!e.data) {
        throw e;
      }

      const orderData = e.data;

      const errorDetail = Array.isArray(orderData.details) && orderData.details[0];

      if (errorDetail && errorDetail.issue === "INSTRUMENT_DECLINED") {
        return actions.restart(); // Recoverable state
      }
    }
  }

  async function onShippingChange(data, actions) {
    try {
      let selectedShippingOption = 0;

      if (data.selected_shipping_option && data.selected_shipping_option.id) {
        selectedShippingOption = data.selected_shipping_option.id;
      }

      await cartManager.updatePaypalShipping({
        orderID: data.orderID,
        address: data.shipping_address,
        selectedShippingOption,
      });

      return actions.resolve();
    } catch (e) {
      onMessage({
        type: "error",
        title: "Couldn't update PayPal shipping",
        description: cartManager.getErrorText(e),
      });

      return actions.reject();
    }
  }

  function onCancel() {
    // Refresh the cart in case we've made changes to the shipping
    // address in paypal
    cartManager.refresh();
  }

  function onError() {
    // The default error message for 500 errors.
    let errorText = "Sorry, your transaction could not be processed. Please try again.";

    if (paypalError) {
      // The reason for the failure was from cancelling createOrder.

      errorText = paypalError;
      setPaypalError("");
    }

    onMessage({ type: "error", description: errorText });
  }

  function renderButton() {
    const Button = paypal.Buttons.driver("react", { React, ReactDOM });

    return (
      <Button
        fundingSource={paypal.FUNDING[fundingSource]}
        createOrder={createOrder}
        onApprove={onApprove}
        onShippingChange={onShippingChange}
        onCancel={onCancel}
        onError={onError}
        style={style}
      />
    );
  }

  if (!paypalProvider) return null;

  return <>{sdkLoaded ? renderButton() : null}</>;
}
