import React from "react";

import QuantityWidget from "../widgets/QuantityWidget";

import { useShoppingCart } from "../CartContext";

import shortenString from "../utilities/shortenString";

export default function CartProduct({ product }) {
  const { cartManager, t } = useShoppingCart((s) => ({
    cartManager: s.cartManager,
    t: s.t,
  }));

  const category = product.categories[0]?.name || t("product");
  let quantityErrorMessage = "";

  function getUnitPrice() {
    let price = product.unitPrice;

    if (cartManager.getTaxPricingType() === "inclusive") {
      price += product.tax / product.quantity;
    }

    return cartManager.formatCurrency(price);
  }

  function getTotalPrice() {
    let price = product.price;

    if (cartManager.getTaxPricingType() === "inclusive") {
      price += product.tax;
    }

    return cartManager.formatCurrency(price);
  }

  function updateProductQuantity(quantity) {
    cartManager.updateProductQuantity(
      {
        id: product.id,
        variantID: product.variant?.id,
        personalization: product.personalization,
      },
      quantity
    );
  }

  function removeProduct() {
    cartManager.removeProduct({
      id: product.id,
      variantID: product.variant?.id,
      personalization: product.personalization,
    });
  }

  if (product.inStock) {
    if (product.quantity > product.availableQuantity) {
      quantityErrorMessage = t("cart.left_in_stock", { in_stock: product.availableQuantity });
    } else if (product.quantity > product.maxQty) {
      quantityErrorMessage = t("cart.max_product_qty", { max_quantity: product.maxQty });
    }
  }

  function getPersonalizationLabel(p) {
    return `${p.name}${p.inputText ? ': "' + p.inputText + '" ' : ""}${
      p.selected ? ': "' + p.selected + '" ' : ""
    }${p.filename ? ': "' + p.filename + '" ' : ""} ${
      p.price ? "+" + cartManager.formatCurrency(p.price) : "- " + t("price_free")
    }`;
  }

  return (
    <div className="ref-product">
      <div className="ref-product-col">
        <div className="ref-product-wrapper">
          <img className="ref-product-photo" src={product.image.sm} alt={product.name} />
          <div className="ref-product-data">
            <div className="ref-product-info">
              <div>
                <div className="ref-product-name">{product.name}</div>
                <div className="ref-product-category">{category}</div>
                {product.variant && (
                  <div className="ref-product-variant">
                    {product.variant.option_name + ": " + product.variant.name}
                  </div>
                )}
                {!!product?.personalization.length && (
                  <div className="ref-product-personalization-holder">
                    {product.personalization.map((p) => (
                      <div
                        key={getPersonalizationLabel(p)}
                        className="ref-product-personalization"
                        title={getPersonalizationLabel(p)}
                      >
                        {shortenString(getPersonalizationLabel(p), 55)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="ref-product-price ref-mobile-product-price">{getUnitPrice()}</div>
            </div>
            <div className="ref-product-controls ref-mobile-product-controls">
              <div className="ref-product-quantity">
                <div className="ref-quantity-container">
                  <QuantityWidget product={product} onChange={updateProductQuantity} />
                </div>
                <div className="ref-product-qty-message">{quantityErrorMessage}</div>
              </div>
              <div className="ref-product-remove" onClick={removeProduct}>
                <svg xmlns="http://www.w3.org/2000/svg" height="18" width="18" viewBox="0 0 48 48">
                  <path
                    fill="currentColor"
                    d="M13.05 42q-1.2 0-2.1-.9-.9-.9-.9-2.1V10.5H8v-3h9.4V6h13.2v1.5H40v3h-2.05V39q0 1.2-.9 2.1-.9.9-2.1.9Zm21.9-31.5h-21.9V39h21.9Zm-16.6 24.2h3V14.75h-3Zm8.3 0h3V14.75h-3Zm-13.6-24.2V39Z"
                  ></path>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="ref-price-col">
        <div className="ref-product-price">{getUnitPrice()}</div>
      </div>
      <div className="ref-quantity-col">
        <div className="ref-product-quantity">
          <div className="ref-quantity-container">
            <QuantityWidget product={product} onChange={updateProductQuantity} />
          </div>
          <div className="ref-product-qty-message">{quantityErrorMessage}</div>
          <div className="ref-product-remove" onClick={removeProduct}>
            {t("remove")}
          </div>
        </div>
      </div>
      <div className="ref-total-col">
        <div className="ref-product-total">
          <div className={(product.outOfStock ? "out-of-stock " : "") + "ref-product-total-sum"}>
            {product.inStock ? getTotalPrice() : t("out_of_stock")}
          </div>
        </div>
      </div>
    </div>
  );
}
