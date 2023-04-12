import React from "react";

import { useShoppingCart } from "../CartContext";

import shortenString from "../utilities/shortenString";

export default function SummaryProduct({ product, updateCart }) {
  const cartManager = useShoppingCart((s) => s.cartManager);
  const t = useShoppingCart((s) => s.t);

  let quantityErrorMessage = "";

  if (product.inStock) {
    if (product.quantity > product.availableQuantity) {
      quantityErrorMessage = t("cart.left_in_stock", { in_stock: product.availableQuantity });
    } else if (product.quantity > product.maxQty) {
      quantityErrorMessage = t("cart.max_product_qty", { max_quantity: product.maxQty });
    }
  }

  function getPersonalizationLabel(p) {
    return `${p.name}${p.inputText ? ': "' + p.inputText + '"' : ""}${
      p.selected ? ': "' + p.selected + '"' : ""
    }${p.filename ? ': "' + p.filename + '" ' : ""}`;
  }

  function removeProduct() {
    cartManager.removeProduct({
      id: product.id,
      variantID: product.variant?.id,
      personalization: product.personalization,
    });
  }

  return (
    <div className="ref-product">
      <div className="ref-product-col">
        <img className="ref-product-photo" src={product.image.sm} alt={product.name} />
        <div>
          <div className="ref-product-name">{`${product.name}${
            product.variant ? " (" + product.variant.name + ")" : ""
          }`}</div>
          <div className="ref-product-secondary">{`${cartManager.formatCurrency(
            product.unitPrice
          )} x ${product.quantity}`}</div>
          {!!product?.personalization.length && (
            <div className="ref-product-personalization-holder">
              {product.personalization.map((p) => (
                <div key={getPersonalizationLabel(p)} title={getPersonalizationLabel(p)}>
                  {shortenString(getPersonalizationLabel(p), 55)}
                </div>
              ))}
            </div>
          )}
          {quantityErrorMessage && (
            <>
              <div className="ref-product-qty-message">{quantityErrorMessage}</div>
              <div className="ref-product-update-cart" onClick={updateCart}>
                {t("cart.update")}
              </div>
            </>
          )}
        </div>
      </div>
      <div>
        <div className={`ref-product-total${product.inStock ? "" : " out-of-stock"}`}>
          {product.inStock ? cartManager.formatCurrency(product.price) : t("out_of_stock")}
        </div>
        {!product.inStock && (
          <div className="ref-product-remove" onClick={removeProduct}>
            {t("remove")}
          </div>
        )}
      </div>
    </div>
  );
}
