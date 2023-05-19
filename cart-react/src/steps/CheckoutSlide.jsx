import React, { useState, useEffect } from "react";

import { useShoppingCart } from "../CartContext";

import formatURL from "../utilities/formatURL";

import Summary from "../components/Summary";
import Instructions from "../components/Instructions";
import FooterLinks from "../components/FooterLinks";
import CheckoutForm from "../components/CheckoutForm";

export default function CheckoutSlide({ successURL, cancelURL, onMessage, step, setStep }) {
  const cart = useShoppingCart();
  const { paymentProviders, locations, t, taxExemptionRemoved, setTaxExemptionRemoved } = cart;

  const [instructions, setInstructions] = useState({});

  const showForm = step === "details";
  const showInstructions = step === "instructions";

  useEffect(() => {
    if (taxExemptionRemoved) {
      onMessage({
        type: "warning",
        title: t("cart.tax_exemption_cleared"),
        description: t("cart.tax_exemption_cleared_details"),
      });

      setTaxExemptionRemoved(false);
    }
  }, [taxExemptionRemoved]);

  async function onCheckoutSuccess(result, paymentMethod, paymentID) {
    // Order total was 0 - the checkout is completed

    if (result.order && result.order.amount == 0) {
      // Redirect to the success page
      window.location = formatURL(successURL, {
        order_id: result.order.id,
        secure_hash: result.order.secure_hash,
      });
      return;
    }

    // Zero value cart payment was attempted, but the cart total turned out to be > 0.
    // No order is created, instead the cart refreshes and new payment methods are shown.

    if (paymentMethod === "zero-value-cart" && !result.order) {
      await cart.refresh();
    }

    // Stripe payment - redirect to the Stripe checkout page where the customer will finish payment.

    if (paymentMethod === "stripe" && result.stripeCheckoutURL) {
      window.location = result.stripeCheckoutURL;
      return;
    }

    // Custom payment - show instructions or redirect to successURL.

    if (paymentMethod === "custom" && result.order) {
      const method = paymentProviders.find((pm) => pm.id === paymentID);

      if (!method) return;

      if (!method.instructions) {
        // Redirect to the success page
        window.location = formatURL(successURL, {
          order_id: result.order.id,
          secure_hash: result.order.secure_hash,
        });
        return;
      }

      setInstructions((prevInstructions) => ({
        ...prevInstructions,
        title: method.name,
        description: method.instructions
          .replaceAll("{orderid}", result.order.id)
          .replaceAll("{amount}", cart.formatCurrency(result.order.amount)),
      }));

      setStep("instructions");
    }

    // Pay in store - customer will pay in person, show instructions or redirect to successURL

    if (paymentMethod === "pay-in-store" && result.order) {
      const location = locations.find((l) => l.chosen);

      if (!location || !location.instructions) {
        // Redirect to the success page
        window.location = formatURL(successURL, {
          order_id: result.order.id,
          secure_hash: result.order.secure_hash,
        });
        return;
      }

      setInstructions((prevInstructions) => ({
        ...prevInstructions,
        title: t("pickup_at_store"),
        description: location.instructions
          .replaceAll("{orderid}", result.order.id)
          .replaceAll("{amount}", cart.formatCurrency(result.order.amount)),
      }));

      setStep("instructions");
    }
  }

  return (
    <div className="ref-checkout">
      <div className="ref-checkout-content">
        <div className="ref-back" onClick={() => setStep("cart")}>
          ← {t("cart.back_to_cart")}
        </div>

        {showForm && (
          <CheckoutForm
            successURL={successURL}
            cancelURL={cancelURL}
            onMessage={onMessage}
            onCheckoutSuccess={onCheckoutSuccess}
          />
        )}

        {showInstructions && <Instructions instructions={instructions} />}

        <FooterLinks />
      </div>

      <Summary
        readOnly={step === "instructions"}
        onMessage={onMessage}
        updateCart={() => setStep("cart")}
      />
    </div>
  );
}
