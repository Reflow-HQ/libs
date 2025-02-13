import React, { useState, useRef, useEffect, useCallback } from "react";
import { useShoppingCart, useAuth } from "../CartContext";

import useExternalScript from "../hooks/useExternalScript";
import formatURL from "../utilities/formatURL";

import debounce from "lodash.debounce";

export default function PayPalButton({
  fundingSource,
  style = {},
  checkoutStep,
  canSubmit,
  successURL,
  onMessage,
}) {
  const auth = useAuth();
  const cart = useShoppingCart();

  const containerRef = useRef();
  const paypalProvider = cart.getPaymentProvider("paypal");
  const debouncedRenderButton = useCallback(debounce(renderButton, 500), []);

  if (!paypalProvider) return null;

  const externalScript =
    "https://www.paypal.com/sdk/js?client-id=" +
    paypalProvider.clientID +
    "&disable-funding=credit,bancontact,blik,eps,giropay,ideal,mercadopago,mybank,p24,sepa,sofort,venmo" +
    "&merchant-id=" +
    paypalProvider.merchantID +
    "&currency=" +
    cart.currency +
    "&integration-date=2023-03-30";

  const state = useExternalScript(externalScript);
  const sdkLoaded = state === "ready";

  const [paypalError, setPaypalError] = useState("");

  useEffect(() => {
    if (sdkLoaded) {
      debouncedRenderButton();
    }
  }, [sdkLoaded]);

  async function createOrder() {
    if (!canSubmit()) return;

    try {
      const data = { "checkout-step": checkoutStep };

      if (auth && auth.isSignedIn()) {
        data["auth-account-id"] = auth.user.id;
      }

      if (cart.customFields) {
        data["custom-fields"] = true;
      }

      let result = await cart.paypalCreateOrder(data);
      return result;
    } catch (e) {
      console.log(e);
    }
  }

  async function onApprove(data, actions) {
    try {
      const result = await cart.paypalOnApprove(data, actions);

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

      await cart.updatePaypalShipping({
        orderID: data.orderID,
        address: data.shipping_address,
        selectedShippingOption,
      });

      return actions.resolve();
    } catch (e) {
      onMessage({
        type: "error",
        title: "Couldn't update PayPal shipping",
        description: cart.getErrorText(e),
      });

      return actions.reject();
    }
  }

  function onCancel() {
    // Refresh the cart in case we've made changes to the shipping
    // address in paypal
    cart.refresh();
  }

  function onError() {
    // If we stop the createOrder process, because canSubmit() returns false,
    // paypal throws an error. We should let the browser handle this error.
    if (!canSubmit()) return;

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
    paypal
      .Buttons({
        fundingSource: paypal.FUNDING[fundingSource],
        createOrder,
        onApprove,
        onCancel,
        onError,
        onShippingChange,
        style,
      })
      .render(containerRef.current);
  }

  return <div ref={containerRef}></div>;
}
