import React from "react";

import { useShoppingCart } from "../CartContext";
import QuantityWidget from "../widgets/QuantityWidget";

import shortenString from "../utilities/shortenString";
import RemoveProductButton from "./RemoveProductButton";

export default function SummaryProduct({
  product,
  updateCart,
  showCategory = false,
  showVariantBreakdown = false,
  showPersonalization = true,
  showPersonalizationPrice = false,
  showQuantityWidget = false,
  showRemoveButton = false,
  showPriceBreakdown = false,
}) {
  const cartManager = useShoppingCart((s) => s.cartManager);
  const t = useShoppingCart((s) => s.t);

  const category = product.categories[0]?.name || t("product");
  const priceBreakdown = `${cartManager.formatCurrency(product.unitPrice)} x ${product.quantity}`;

  const showVariant = showVariantBreakdown && !!product.variant;
  const productName = `${product.name}${
    !showVariantBreakdown && product.variant ? " (" + product.variant.name + ")" : ""
  }`;

  let hasQuantityError = false;
  let quantityErrorMessage = "";

  if (product.inStock) {
    if (product.quantity > product.availableQuantity) {
      hasQuantityError = true;
      quantityErrorMessage = t("cart.left_in_stock", { in_stock: product.availableQuantity });
    } else if (product.quantity > product.maxQty) {
      hasQuantityError = true;
      quantityErrorMessage = t("cart.max_product_qty", { max_quantity: product.maxQty });
    }
  }

  function getPersonalizationLabel(p) {
    return `${p.name}${p.inputText ? ': "' + p.inputText + '"' : ""}${
      p.selected ? ': "' + p.selected + '"' : ""
    }${p.filename ? ': "' + p.filename + '" ' : ""}${
      showPersonalizationPrice
        ? p.price
          ? " +" + cartManager.formatCurrency(p.price)
          : " - " + t("price_free")
        : ""
    }`;
  }

  return (
    <div className={`ref-product${hasQuantityError ? " ref-warning" : ""}`}>
      <img className="ref-product-photo" src={product.image.sm} alt={product.name} />
      <div className="ref-product-data">
        <div className="ref-product-info">
          <div>
            <div className="ref-product-name">{productName}</div>
            <div className="ref-product-secondary">
              {showCategory && <div className="ref-product-category">{category}</div>}
              {showVariant && (
                <div className="ref-product-variant">
                  {product.variant.option_name + ": " + product.variant.name}
                </div>
              )}
              {showPriceBreakdown && (
                <div className="ref-product-price-breakdown">{priceBreakdown}</div>
              )}
              {showPersonalization && !!product.personalization?.length && (
                <div className="ref-product-personalization-holder">
                  {product.personalization.map((p) => (
                    <div key={getPersonalizationLabel(p)} title={getPersonalizationLabel(p)}>
                      {shortenString(getPersonalizationLabel(p), 55)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="ref-product-price">
            <div className={`ref-product-total${product.inStock ? "" : " out-of-stock"}`}>
              {product.inStock ? cartManager.formatCurrency(product.price) : t("out_of_stock")}
            </div>
          </div>
        </div>
        <div className="ref-product-controls">
          <div>
            {showQuantityWidget && (
              <div className="ref-product-quantity">
                <QuantityWidget product={product} />
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
          {showRemoveButton && (
            <RemoveProductButton product={product}>{t("remove")}</RemoveProductButton>
          )}
        </div>
      </div>
    </div>
  );
}
