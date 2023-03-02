import { useState } from "react";

export default function QuantityWidget({ product, onChange }) {
  const [quantity, setQuantity] = useState(() => product.quantity);

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
    changeQuantity(quantity + 1);
  }

  function decreaseQuantity() {
    changeQuantity(quantity - 1);
  }

  function changeQuantity(newQuantity) {
    if (isNaN(newQuantity)) return;

    const minQuantity = getMinQuantity();
    const maxQuantity = getMaxQuantity();

    newQuantity = Math.min(Math.max(minQuantity, newQuantity), maxQuantity);

    if (newQuantity !== quantity) {
      setQuantity(newQuantity);
      onChange(newQuantity);
    }
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
