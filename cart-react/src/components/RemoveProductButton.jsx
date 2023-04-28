import React from "react";

import { useShoppingCart } from "../CartContext";

export default function RemoveProductButton({ product, children }) {
  const cart = useShoppingCart();

  function removeProduct() {
    cart.removeProduct({
      id: product.id,
      variantID: product.variant?.id,
      personalization: product.personalization,
    });
  }

  return (
    <div className="ref-product-remove" onClick={removeProduct}>
      {children}
    </div>
  );
}
