import React from "react";

import { useShoppingCart } from "../CartContext";

export default function RemoveProductButton({ product, children }) {
  const cartManager = useShoppingCart((s) => s.cartManager);

  function removeProduct() {
    cartManager.removeLineItem(product.lineItemID);
  }

  return (
    <div className="ref-product-remove" onClick={removeProduct}>
      {children}
    </div>
  );
}
