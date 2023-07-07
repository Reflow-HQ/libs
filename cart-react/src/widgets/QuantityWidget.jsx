import React, { useState, useEffect } from "react";

export default function QuantityWidget({
  active = true,
  originalQuantity,
  maxQuantity,
  availableQuantity,
  updateQuantity,
}) {
  const [quantity, setQuantity] = useState(() => originalQuantity);

  useEffect(() => {
    if (quantity !== originalQuantity) {
      setQuantity(originalQuantity);
    }
  }, [originalQuantity]);

  function getMinQuantity() {
    return 1;
  }

  function getMaxQuantity() {
    return Math.min(
      isNaN(parseInt(availableQuantity)) ? Infinity : availableQuantity,
      isNaN(parseInt(maxQuantity)) ? Infinity : maxQuantity
    );
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
      updateQuantity && updateQuantity(newQuantity);
    }
  }

  return (
    <div className={`ref-quantity-widget${!active ? " inactive" : ""}`}>
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
