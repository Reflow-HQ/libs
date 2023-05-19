import React from "react";

import { useShoppingCart } from "../CartContext";

export default function RemoveProductButton({ product, children }) {
  const cart = useShoppingCart();

  function removeProduct() {
    cart.removeLineItem(product.lineItemID);
  }

  return (
    <div className="ref-product-remove" onClick={removeProduct}>
      {children}
    </div>
  );
}
