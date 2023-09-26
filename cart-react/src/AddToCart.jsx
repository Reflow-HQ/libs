import React, { useState, useRef } from "react";

import QuantityWidget from "./widgets/QuantityWidget";

export default function AddToCart({
  cart,
  product,
  buttonText,
  showQuantity = true,
  showPersonalization = true,
  onVariantSelect,
  onMessage,
}) {
  const personalizationForm = useRef();

  const [quantity, setQuantity] = useState(product.min_quantity || 1);
  const [selectedVariant, setSelectedVariant] = useState(
    product.variants.enabled ? product.variants.items[0].id : ""
  );
  const [personalizationValues, setPersonalizationValues] = useState({});

  function getButtonText() {
    let text = buttonText || cart.t("add_to_cart.button_text");

    if (!canBePurchased()) {
      text = cart.t("out_of_stock");
    }

    return text;
  }

  function hasVariants() {
    return product.variants.enabled;
  }

  function hasPersonalizationOptions() {
    return product.personalization.enabled;
  }

  function getActiveVariantOptions() {
    const variant = hasVariants()
      ? product.variants.items.find((v) => v.id === selectedVariant)
      : product;

    return variant || product;
  }

  function setActiveVariant(id) {

    setSelectedVariant(id);

    if (onVariantSelect) {
      onVariantSelect(product.variants.items.find((v) => v.id == id));
    }
  }

  function setPersonalizationInput(id, input, value) {
    setPersonalizationValues((prevPersonalization) => {
      return {
        ...prevPersonalization,
        [id]: {
          ...(prevPersonalization[id] || {}),
          [input]: value,
        },
      };
    });
  }

  function getPersonalizationInput(id, input) {
    // Used when switching variants to keep the personalization as they were.

    if (!personalizationValues[id] || !personalizationValues[id][input]) return null;

    return personalizationValues[id][input];
  }

  function canBePurchased() {
    return getActiveVariantOptions().in_stock;
  }

  async function addToCart(e) {
    e.preventDefault();

    if (personalizationForm.current && !personalizationForm.current.checkValidity()) {
      personalizationForm.current.reportValidity();
      return;
    }

    const personalization = [];

    for (const p of product.personalization.items) {
      if (!isPersonalizationActive(p)) continue;

      const tmp = {
        id: p.id,
      };

      switch (p.type) {
        case "text":
          tmp.inputText = getPersonalizationInput(p.id, "text");
          break;
        case "dropdown":
          tmp.selected = getPersonalizationInput(p.id, "dropdown");
          break;
        case "file":
          const files = getPersonalizationInput(p.id, "file");

          if (files && files.length) {
            tmp.file = files[0];
          }
          break;
        default:
          break;
      }

      personalization.push(tmp);
    }

    try {
      await cart.addProduct(
        {
          id: product.id,
          variantID: selectedVariant,
          personalization,
        },
        quantity
      );

      if (onMessage) {
        onMessage({
          title: cart.t("add_to_cart.success"),
        });
      }

      // Reset the quantity and personalization inputs.

      setQuantity(1);
      setPersonalizationValues({});
    } catch (e) {

      console.error("Reflow: Couldn't add product to cart", e);

      if (onMessage) {
        onMessage({
          title: cart.t("add_to_cart.error"),
          description: e.data && e.data.errorCode ? cart.t(e.data.errorCode) : null
        });
      }

    }
  }

  function isPersonalizationActive(personalization) {
    const oldValueChecked = !!getPersonalizationInput(personalization.id, "checkbox");
    const isRequired = personalization.required;

    return oldValueChecked || isRequired;
  }

  function shouldShowVariants() {
    return hasVariants();
  }

  function shouldShowQuantity() {
    return showQuantity;
  }

  function shouldShowPersonalization() {
    return showPersonalization && hasPersonalizationOptions();
  }

  function shouldShowButton() {
    return true;
  }

  function shouldShowControls(personalization) {
    return isPersonalizationActive(personalization);
  }

  function renderPersonalizationControls(personalization) {
    const isActive = isPersonalizationActive(personalization);
    const required = isActive;
    const style = { display: isActive ? "block" : "none" };
    const value = getPersonalizationInput(personalization.id, personalization.type);
    const onChange = (e) =>
      setPersonalizationInput(personalization.id, personalization.type, e.target.value);

    switch (personalization.type) {
      case "text":
        return (
          <input
            type="text"
            className="ref-form-control ref-personalization-text-input"
            style={style}
            minLength={personalization.min || 0}
            maxLength={personalization.max || Infinity}
            value={value || ""}
            onChange={onChange}
            required={required}
          />
        );

      case "dropdown":
        const dropdownOptions = personalization.dropdownOptions
          .split(",")
          .map((text) => text.trim())
          .filter((text) => !!text);

        return (
          <select
            className="ref-form-control ref-personalization-dropdown"
            style={style}
            value={value || dropdownOptions[0]}
            onChange={onChange}
            required={required}
          >
            {dropdownOptions.map((text) => (
              <option key={text} value={text}>
                {text}
              </option>
            ))}
          </select>
        );

      case "file":
        return (
          <input
            type="file"
            className="ref-form-control ref-personalization-file-input"
            style={style}
            accept={personalization.filetypes}
            required={required}
            onChange={(e) =>
              setPersonalizationInput(personalization.id, personalization.type, e.target.files)
            }
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="reflow-add-to-cart ref-product-controls">
      {shouldShowVariants() && (
        <div className="ref-variant">
          <label>
            <span>{product.variants.option_name || ""}</span>
            <select
              className="ref-form-control ref-field-variants"
              name="variant-state"
              required=""
              value={selectedVariant}
              onChange={(e) => setActiveVariant(e.target.value)}
            >
              {product.variants.items.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {shouldShowPersonalization() && (
        <form
          ref={personalizationForm}
          className="ref-personalization-holder ref-personalization-form"
        >
          {product.personalization.items.map((p) => (
            <div className="ref-personalization" id={p.id} key={p.id}>
              <span className="ref-row">
                <div>
                  <label className="ref-personalization-label">
                    {p.name}
                    {!p.required && (
                      <input
                        type="checkbox"
                        className="ref-form-control ref-personalization-checkbox"
                        value={p.id}
                        checked={getPersonalizationInput(p.id, "checkbox") || false}
                        onChange={(e) =>
                          setPersonalizationInput(p.id, "checkbox", e.target.checked)
                        }
                      />
                    )}
                  </label>
                </div>
                {!p.required && (
                  <span className="ref-price">
                    {p.price > 0 ? p.price_formatted : cart.t("price_free")}
                  </span>
                )}
              </span>
              {!!p.instructions && (
                <p
                  className="ref-instructions"
                  style={{ display: shouldShowControls(p) ? "block" : "none" }}
                >
                  {p.instructions}
                </p>
              )}
              {renderPersonalizationControls(p)}
            </div>
          ))}
        </form>
      )}

      {shouldShowQuantity() && (
        <QuantityWidget
          active={canBePurchased()}
          originalQuantity={quantity || 1}
          maxQuantity={product.max_quantity}
          availableQuantity={getActiveVariantOptions().available_quantity}
          updateQuantity={(quantity) => setQuantity(quantity)}
        />
      )}

      {shouldShowButton() && (
        <a
          href="#"
          className={`ref-button${canBePurchased() ? "" : " inactive"}`}
          disabled={!canBePurchased()}
          onClick={addToCart}
        >
          {getButtonText()}
        </a>
      )}

      {product.min_quantity > 0 && (
        <p className="ref-min-qty-message">
          {cart.t("add_to_cart.min_quantity_per_order", { quantity: product.min_quantity })}
        </p>
      )}
    </div>
  );
}
