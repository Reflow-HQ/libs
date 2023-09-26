import React, { useState, useRef } from "react";
import { AddToCart } from "@reflowhq/cart-react";

export default function Product({
  product,
  cart
}) {

  const [selectedVariant, setSelectedVariant] = useState(
    product.variants.enabled ? product.variants.items[0] : null
  );

  return (
    <div className="row mb-5">
      <div
        className="col-12 col-md-4"
        style={{
          height: "300px",
          background: `url(${product.image.md})`,
          backgroundSize: "cover",
          backgroundPosition: "center center",
        }}
      ></div>
      <div className="col-12 col-md-8 mt-4 mt-md-0 px-md-4">
        <div className="mb-3">
          <h4>{product.name}</h4>
          <strong>{product.variants.enabled ? selectedVariant.price_formatted : product.price_formatted}</strong>
        </div>
        <AddToCart
          cart={cart}
          product={product}
          onVariantSelect={(variant) => {
            setSelectedVariant(variant)
          }}
          onMessage={(message) => {
            alert(message.title);
          }}
        />
      </div>
    </div>
  );
}
