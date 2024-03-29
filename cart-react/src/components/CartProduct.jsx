import React, { useCallback } from "react";

import QuantityWidget from "../widgets/QuantityWidget";

import { useShoppingCart } from "../CartContext";
import RemoveProductButton from "./RemoveProductButton";

import SummaryProduct from "./SummaryProduct";

import debounce from "lodash.debounce";

export default function CartProduct({ product }) {
  const cart = useShoppingCart();
  const t = cart.t;

  const updateQuantity = useCallback(debounce(updateProductQuantity, 500), []);

  let quantityErrorMessage = "";

  function getUnitPrice() {
    let price = product.unitPrice;

    if (cart.getTaxPricingType() === "inclusive") {
      price += product.tax / product.quantity;
    }

    return cart.formatCurrency(price);
  }

  function getTotalPrice() {
    let price = product.price;

    if (cart.getTaxPricingType() === "inclusive") {
      price += product.tax;
    }

    return cart.formatCurrency(price);
  }

  function updateProductQuantity(quantity) {
    cart.updateLineItemQuantity(product.lineItemID, quantity);
  }

  if (product.inStock) {
    if (product.quantity > product.availableQuantity) {
      quantityErrorMessage = t("cart.left_in_stock", { in_stock: product.availableQuantity });
    } else if (product.quantity > product.maxQty) {
      quantityErrorMessage = t("cart.max_product_qty", { max_quantity: product.maxQty });
    }
  }

  return (
    <div className="ref-line-item">
      <div className="ref-product-col">
        <SummaryProduct
          product={product}
          showCategory={true}
          showVariantBreakdown={true}
          showPersonalization={true}
          showPersonalizationPrice={true}
          showQuantityWidget={true}
          showRemoveButton={true}
          showPriceBreakdown={false}
          updateQuantity={updateQuantity}
        />
      </div>
      <div className="ref-price-col">
        <div className="ref-product-price">{getUnitPrice()}</div>
      </div>
      <div className="ref-quantity-col">
        <div className="ref-product-quantity">
          <div className="ref-quantity-container">
            <QuantityWidget
              active={product.inStock}
              originalQuantity={product.quantity}
              maxQuantity={product.maxQty}
              availableQuantity={product.availableQuantity}
              updateQuantity={updateQuantity}
            />
          </div>
          <div className="ref-product-qty-message">{quantityErrorMessage}</div>
          <RemoveProductButton product={product}>{t("remove")}</RemoveProductButton>
        </div>
      </div>
      <div className="ref-total-col">
        <div className="ref-product-total">
          <div className={(!product.inStock ? "out-of-stock " : "") + "ref-product-total"}>
            {product.inStock ? getTotalPrice() : t("out_of_stock")}
          </div>
        </div>
      </div>
    </div>
  );
}
