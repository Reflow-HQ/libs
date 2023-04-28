import React from "react";

import QuantityWidget from "../widgets/QuantityWidget";

import { useShoppingCart } from "../CartContext";
import RemoveProductButton from "./RemoveProductButton";

import SummaryProduct from "./SummaryProduct";

export default function CartProduct({ product }) {
  const cartManager = useShoppingCart().cartManager;
  const t = useShoppingCart().t;

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
        />
      </div>
      <div className="ref-price-col">
        <div className="ref-product-price">{getUnitPrice()}</div>
      </div>
      <div className="ref-quantity-col">
        <div className="ref-product-quantity">
          <div className="ref-quantity-container">
            <QuantityWidget product={product} />
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
