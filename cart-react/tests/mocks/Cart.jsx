import React from "react";
import CartView, { useCart } from "../../";

export default function Cart({ config }) {
  const cart = useCart(config);
  return <CartView cart={cart} />;
}
