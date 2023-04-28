import React, { useState, useEffect, useCallback } from "react";

import { useShoppingCart } from "../CartContext";

import debounce from "lodash.debounce";

export default function QuantityWidget({ product }) {
  const cartManager = useShoppingCart((s) => s.cartManager);

  const [quantity, setQuantity] = useState(() => product.quantity);

  const updateQuantity = useCallback(debounce(updateProductQuantity, 500), []);

  useEffect(() => {
    if (quantity !== product.quantity) {
      setQuantity(product.quantity);
    }
  }, [product.quantity]);

  function getMinQuantity() {
    return 1;
  }

  function getMaxQuantity() {
    return Math.min(product.availableQuantity, product.maxQty);
  }

  function canIncreaseQuantity() {
    return quantity < getMaxQuantity();
  }

  function increaseQuantity() {
    const newQuantity = quantity + 1;

    if (newQuantity <= getMaxQuantity()) {
      changeQuantity(newQuantity);
    }
  }

  function decreaseQuantity() {
    const newQuantity = quantity - 1;

    if (newQuantity >= getMinQuantity()) {
      changeQuantity(newQuantity);
    }
  }

  function changeQuantity(newQuantity) {
    if (isNaN(newQuantity)) return;

    if (newQuantity !== quantity) {
      setQuantity(newQuantity);
      updateQuantity(newQuantity);
    }
  }

  function updateProductQuantity(quantity) {
    cartManager.updateLineItemQuantity(product.lineItemID, quantity);
  }

  return (
    <div className={`ref-quantity-widget${!product.inStock ? " inactive" : ""}`}>
      <div className="ref-decrease" onClick={() => decreaseQuantity()}>
        <span></span>
      </div>
      <input
        type="text"
        value={quantity}
        onChange={(e) => changeQuantity(parseInt(e.target.value, 10))}
      />
      <div
        className={`ref-increase${!canIncreaseQuantity() ? " inactive" : ""}`}
        onClick={() => increaseQuantity()}
      >
        <span></span>
      </div>
    </div>
  );
}
