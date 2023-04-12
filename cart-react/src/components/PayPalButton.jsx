import ReactDOM from "react-dom";
import React, { useState, useEffect } from "react";
import { useShoppingCart, useAuth } from "../CartContext";

export default function PayPalButton({ fundingSource, style = {}, step, canSubmit, onError }) {
  const auth = useAuth();
  const cartManager = useShoppingCart((s) => s.cartManager);
  const currency = useShoppingCart((s) => s.currency);

  const [sdkLoaded, setSDKLoaded] = useState(false);
  const [paypalError, setPaypalError] = useState("");

  useEffect(() => {
    const paypalProvider = cartManager.getPaymentProvider("paypal");

    if (!paypalProvider) return;

    const id = "reflow-paypal-sdk";
    let script = document.querySelector(`#${id}`);

    if (script) {
      setSDKLoaded(true);
      return;
    }

    // Create a script element
    script = document.createElement("script");
    script.id = id;

    script.onload = () => setSDKLoaded(true);
    script.onerror = (e) => console.error(e);

    document.body.append(script);

    script.src =
      "https://www.paypal.com/sdk/js?client-id=" +
      paypalProvider.clientID +
      "&disable-funding=credit,bancontact,blik,eps,giropay,ideal,mercadopago,mybank,p24,sepa,sofort,venmo" +
      "&merchant-id=" +
      paypalProvider.merchantID +
      "&currency=" +
      currency +
      "&integration-date=2023-03-30";

    //return a function to clean up the script element when the component unmounts
    // return () => {
    //   document.body.removeChild(script);
    // };
  }, []);

  async function createOrder() {
    if (!canSubmit()) return;

    try {
      const data = { "checkout-step": step };

      if (auth.isSignedIn()) {
        data["auth-account-id"] = auth.profile.id;
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

      // window.location = this.getSuccessURL({
      //   order_id: result.orderID,
      //   secure_hash: result.secureHash,
      // });
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
      onError({
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

    onError({ description: errorText });
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

  return <>{sdkLoaded ? renderButton() : null}</>;
}
