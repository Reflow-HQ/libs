import React from "react";

import { useShoppingCart } from "../CartContext";

export default function RemoveProductButton({ product, children }) {
  const cartManager = useShoppingCart().cartManager;

  function removeProduct() {
    cartManager.removeProduct({
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
