import { useState, useEffect } from "react";

import { useShoppingCart } from "../CartContext";

import useLocalStorageFormData from "../hooks/useLocalStorageFormData";

import SummaryProduct from "../components/SummaryProduct";
import AddressWidget from "../widgets/AddressWidget";

import shortenString from "../utilities/shortenString";

export default function CheckoutSlide({ setStep }) {
  const [email, setEmail] = useLocalStorageFormData("email");
  const [phone, setPhone] = useLocalStorageFormData("phone");
  const [name, setName] = useLocalStorageFormData("name");
  const [note, setNote] = useLocalStorageFormData("note");
  const [couponCode, setCouponCode] = useState("");

  const [shippingAddress, setShippingAddress] = useLocalStorageFormData("shippingAddress", {});
  const [billingAddress, setBillingAddress] = useLocalStorageFormData("billingAddress", {});
  const [digitalAddress, setDigitalAddress] = useLocalStorageFormData("digitalAddress", {});

  const [showBilling, setShowBilling] = useState(() => isBillingFilled());

  const [isSummaryOpen, setSummaryOpen] = useState(false);
  const [isNoteFieldOpen, setNoteFieldOpen] = useState(true);
  const [isTaxFieldOpen, setTaxFieldOpen] = useState(true);

  const { cartState, cartManager, t, locale } = useShoppingCart();

  const [shippingLabel, setShippingLabel] = useState(t("shipping"));
  const [shippingPrice, setShippingPrice] = useState(t("cart.shipping_not_selected"));

  const {
    products,
    coupon,
    discount,
    total,
    subtotal,
    currency,
    locations,
    shippingMethods,
    shippableCountries,
    footerLinks,
    taxes,
    taxExemption,
    vacationMode,
    paymentProviders,
    deliveryMethod,
    selectedLocation,
    selectedShippingMethod,
    setDeliveryMethod,
    setSelectedLocation,
    setSelectedShippingMethod,
  } = cartState;

  function isDeliveryMethodActive(method) {
    return deliveryMethod === method;
  }

  function updateModel(model, key, value) {
    return {
      ...model,
      [key]: value,
    };
  }

  function isBillingFilled() {
    return Object.entries(billingAddress).some(
      ([field, value]) => ["city", "country", "name", "address"].includes(field) && value.length
    );
  }

  function showBillingAddress() {
    setBillingAddress(() => {
      return {
        ...shippingAddress,
      };
    });
    setShowBilling(true);
  }

  function hideBillingAddress() {
    setBillingAddress({});
    setShowBilling(false);
  }

  function getLocationAddressText(location) {
    let addressText = location.address.address + ", " + location.address.city + ", ";

    if (location.address.country == "US" && location.address.state) {
      addressText += location.address.state + ", ";
    }

    addressText += location.address.countryName;

    return addressText;
  }

  // Returns the address only if all fields are correctly filled.

  function getShippingAddress() {
    let ret = {};

    // Optional

    if (shippingAddress.name) {
      ret.name = shippingAddress.name;
    }

    if (shippingAddress.address) {
      ret.address = shippingAddress.address;
    }

    // Required

    if (!shippingAddress.city) return;
    ret.city = shippingAddress.city;

    let code = shippingAddress.countryCode;
    if (!code) return;

    let country = cartManager.getCountryByCode(code);
    if (!country) return;

    ret.country = code;

    // Conditionally required

    if (country.has_postcode) {
      if (!shippingAddress.postcode) return;
      ret.postcode = shippingAddress.postcode;
    }

    if (country.has_regions) {
      if (!shippingAddress.state) return;
      ret.state = shippingAddress.state;
    }

    return ret;
  }

  // Returns the address for digital carts.

  function getDigitalAddress() {
    let ret = {};

    // Required

    let code = digitalAddress.countryCode;
    if (!code) return;

    let country = cartManager.getCountryByCode(code);
    if (!country) return;

    ret.country = code;

    // State and zip required only for US

    if (code == "US") {
      if (!digitalAddress.postcode) return;
      ret.postcode = digitalAddress.postcode;

      if (!digitalAddress.state) return;
      ret.state = digitalAddress.state;
    }

    return ret;
  }

  function onTaxExemptionChange(exemptionType, exemptionValue) {
    // Updates the selected address and tax exemption fields
    // after which fetches the contents of the Cart with refreshed line items.

    let address;

    switch (deliveryMethod) {
      case "shipping": {
        address = getShippingAddress();
        break;
      }

      case "pickup": {
        let location = locations.find((l) => l.chosen);

        if (location) {
          address = location.address;
        }

        break;
      }

      case "digital": {
        address = getDigitalAddress();
        break;
      }

      default:
        break;
    }

    if (!address) {
      // TODO: Check form validity
      return;
    }

    cartManager.updateTaxExemption({
      address,
      deliveryMethod,
      exemptionType,
      exemptionValue,
    });
  }

  function invalidateTaxExemption(address) {
    cartManager.invalidateTaxExemption({ address });
    // TODO: show error if taxExemptionRemoved
  }

  function submitCouponForm(e) {
    e.preventDefault();
    addCoupon(couponCode);
  }

  function addCoupon(code) {
    cartManager.addCoupon({ code }).then(() => setCouponCode(""));
  }

  function removeCoupon() {
    cartManager.removeCoupon();
  }

  function checkout() {
    if (vacationMode?.enabled) {
      const message = vacationMode.message || t("store_unavailable");

      // TODO: handle system error
      return;
    }
  }

  function getDeliveryDate(days) {
    const deliveryDate = new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * days);
    const format = { month: "long", day: "numeric" };
    return deliveryDate.toLocaleDateString(locale, format);
  }

  function renderPaymentProviderButtons() {
    return paymentProviders.map((pm) =>
      pm.provider == "custom" ? (
        <div
          key={pm.id}
          className="ref-button ref-payment-button"
          onClick={() => checkout("custom", pm.id)}
        >
          {pm.name}
        </div>
      ) : pm.provider == "pay-in-store" ? (
        <div
          key={pm.provider}
          className="ref-button ref-payment-button"
          onClick={() => checkout("pay-in-store")}
        >
          {t("pay_on_pickup")}
        </div>
      ) : pm.provider == "stripe" && pm.supported && pm.paymentOptions.length ? (
        pm.paymentOptions.map((paymentOption) =>
          paymentOption.id === "card" ? (
            <div key={paymentOption.id}>
              <div className="ref-button ref-payment-button" onClick={() => checkout("stripe")}>
                {t("credit_card")}
              </div>
              <div className="ref-button ref-payment-button" onClick={() => checkout("stripe")}>
                Apple Pay / Google Pay
              </div>
            </div>
          ) : (
            <div
              key={paymentOption.id}
              className="ref-button ref-payment-button"
              onClick={() => checkout("stripe")}
            >
              {paymentOption.name}
            </div>
          )
        )
      ) : null
    );
  }

  useEffect(() => {
    const location = locations[selectedLocation];
    if (!location) return;

    invalidateTaxExemption(location.address);
  }, [selectedLocation]);

  useEffect(() => {
    let address;

    if (deliveryMethod === "shipping") {
      address = getShippingAddress();
    }

    if (deliveryMethod == "digital") {
      address = getDigitalAddress();
    }

    if (!address) return;

    cartManager.updateAddress({
      address,
      deliveryMethod,
    });
  }, [shippingAddress, digitalAddress]);

  useEffect(() => {
    if (!cartManager.hasPhysicalProducts()) {
      setShippingLabel("");
      setShippingPrice("");
      return;
    }

    let s1 = t("shipping");
    let s2 = t("cart.shipping_not_selected");

    if (isDeliveryMethodActive("shipping")) {
      for (let s of shippingMethods) {
        if (s.chosen) {
          s1 = `${t("shipping")} (${s.name})`;
          s2 = cartManager.formatCurrency(s.price);
        }
      }
    }

    if (isDeliveryMethodActive("pickup")) {
      s1 = t("pickup_at_store");
      s2 = cartManager.formatCurrency(0);

      for (let l of locations) {
        if (l.chosen) {
          s1 = t("cart.pickup_at_store", { store: l.name });
        }
      }
    }

    setShippingLabel(s1);
    setShippingPrice(s2);
  }, [shippingMethods, deliveryMethod]);

  const hasPhysicalProds = cartManager.hasPhysicalProducts();
  const isDigital = !hasPhysicalProds;
  const offersShipping = hasPhysicalProds && cartManager.offersShipping();
  const offersPickup = hasPhysicalProds && cartManager.offersLocalPickup();
  const isTabbable = offersShipping && offersPickup;
  const taxDetails = taxes?.details;
  const taxRate = taxDetails?.taxRate;

  const couponLabel = coupon?.name || coupon?.code.toUpperCase() || "";

  return (
    <div className="ref-checkout">
      <div className="ref-checkout-content">
        <form className="ref-details">
          <div className="ref-back" onClick={() => setStep("cart")}>
            ← {t("cart.back_to_cart")}
          </div>
          <div className="ref-heading">{t("cart.customer_details")}</div>

          {/* <div className="text-center ref-auth-button-holder">
            <div className="ref-auth-button" data-reflow-type="auth-button"></div>
          </div> */}

          <label>
            <span>{t("email")}</span>
            <input
              type="email"
              name="email"
              id="ref-field-email"
              className="ref-form-control"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="ref-validation-error"></div>
          </label>
          <label className="ref-phone-input">
            <span>{t("phone")}</span>
            <input
              type="tel"
              name="phone"
              id="ref-field-phone"
              className="ref-form-control"
              value={phone}
              pattern="[0-9 \\+\\-]{5,30}"
              placeholder="+1234567890"
              required
              onChange={(e) => setPhone(e.target.value)}
            />
            <div className="ref-validation-error"></div>
          </label>
          {(isDeliveryMethodActive("pickup") || isDigital) && (
            <label className="ref-customer-name-input">
              <span>{t("name")}</span>
              <input
                type="text"
                name="customer-name"
                className="ref-form-control"
                value={name}
                minLength="5"
                required
                onChange={(e) => setName(e.target.value)}
              />
              <div className="ref-validation-error"></div>
            </label>
          )}

          {isDigital && (
            <fieldset className="ref-digital-delivery">
              <div className="ref-digital-address-holder">
                <AddressWidget
                  countries={shippableCountries}
                  prefix="digital"
                  fields={["country"]}
                  isDigital={true}
                  model={digitalAddress}
                  updateModel={(key, value) =>
                    setDigitalAddress((prevModel) => updateModel(prevModel, key, value))
                  }
                />
              </div>
              <input type="hidden" name="delivery-method" value="digital" />
            </fieldset>
          )}

          <div className="ref-heading ref-heading-delivery">{t("delivery")}</div>

          {hasPhysicalProds && !cartManager.canDeliver() && (
            <div className="ref-delivery-unavailable">{t("cart.errors.delivery_unavailable")}</div>
          )}

          {(offersShipping || offersPickup) && (
            <div className={"ref-delivery-card" + (isTabbable ? " tabbable" : "")}>
              {offersPickup && (
                <div className={"ref-tab" + (isDeliveryMethodActive("pickup") ? " open" : "")}>
                  <label className="ref-tab-toggle">
                    <input
                      type="radio"
                      value="pickup"
                      name="delivery-method"
                      required
                      checked={isDeliveryMethodActive("pickup")}
                      onChange={(e) => setDeliveryMethod(e.target.value)}
                    />
                    <div className="ref-heading-small">{t("pickup_at_store")}</div>
                  </label>
                  <fieldset className="ref-tab-content">
                    <div className="ref-heading-small">{t("cart.select_store")}</div>
                    <div className="ref-locations ref-error-parent">
                      {locations.map((location, index) => (
                        <label key={location.id}>
                          <input
                            type="radio"
                            value={index}
                            name="store-location"
                            required
                            checked={selectedLocation == index}
                            onChange={() => setSelectedLocation(index)}
                          />
                          <div className="ref-location-card">
                            <b className="ref-location-name">{location.name}</b>
                            <div className="ref-location-address">
                              <b>{`${t("address")}: `}</b>
                              {getLocationAddressText(location)}
                            </div>
                            <div className="ref-location-contacts">
                              {location.email && (
                                <span>
                                  <b>{`${t("email")}: `}</b>
                                  {location.email}
                                </span>
                              )}
                              {location.phone && (
                                <span>
                                  <b>{`${t("phone")}: `}</b>
                                  {location.phone}
                                </span>
                              )}
                              {location.working_hours && (
                                <span>
                                  <b>{`${t("working_hours")}: `}</b>
                                  {location.working_hours}
                                </span>
                              )}
                              {location.delivery_time && (
                                <span>
                                  <b>{`${t("cart.order_ready_for_pickup_label")}: `}</b>
                                  {getDeliveryDate(location.delivery_time)}
                                </span>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="ref-billing-container">
                      {showBilling ? (
                        <fieldset className="ref-billing-address">
                          <div className="ref-row">
                            <div className="ref-heading-small">{t("billing_address")}</div>
                            <div
                              className="ref-button ref-remove-billing"
                              onClick={() => hideBillingAddress()}
                            >
                              {t("remove")}
                            </div>
                          </div>
                          <div className="ref-billing-address-holder">
                            <AddressWidget
                              countries={shippableCountries}
                              prefix="billing"
                              model={billingAddress}
                              updateModel={(key, value) =>
                                setBillingAddress((prevModel) => updateModel(prevModel, key, value))
                              }
                            />
                          </div>
                        </fieldset>
                      ) : (
                        <div
                          className="ref-button ref-add-billing"
                          onClick={() => showBillingAddress()}
                        >
                          {t("cart.add_billing")}
                        </div>
                      )}
                    </div>
                  </fieldset>
                </div>
              )}

              {offersShipping && (
                <div className={"ref-tab" + (isDeliveryMethodActive("shipping") ? " open" : "")}>
                  <label className="ref-tab-toggle">
                    <input
                      type="radio"
                      value="shipping"
                      name="delivery-method"
                      required
                      checked={isDeliveryMethodActive("shipping")}
                      onChange={(e) => setDeliveryMethod(e.target.value)}
                    />
                    <div className="ref-heading-small">{t("cart.deliver_to_address")}</div>
                  </label>
                  <fieldset className="ref-tab-content">
                    <div className="ref-heading-small">{t("shipping_address")}</div>
                    <div className="ref-shipping-address-holder">
                      <AddressWidget
                        countries={shippableCountries}
                        prefix="shipping"
                        model={shippingAddress}
                        updateModel={(key, value) =>
                          setShippingAddress((prevModel) => updateModel(prevModel, key, value))
                        }
                      />
                    </div>

                    {/* <div className="ref-auth-save-address">
                  <label>
                    <input
                      type="checkbox"
                      name="auth-save-address"
                      checked
                      onChange={(e) => e.target.value}
                    />
                    <span>{t("cart.save_address")}</span>
                  </label>
                </div> */}

                    <div className="ref-billing-container">
                      {showBilling ? (
                        <fieldset className="ref-billing-address">
                          <div className="ref-row">
                            <div className="ref-heading-small">{t("billing_address")}</div>
                            <div
                              className="ref-button ref-remove-billing"
                              onClick={() => hideBillingAddress()}
                            >
                              {t("remove")}
                            </div>
                          </div>
                          <div className="ref-billing-address-holder">
                            <AddressWidget
                              countries={shippableCountries}
                              prefix="billing"
                              model={billingAddress}
                              updateModel={(key, value) =>
                                setBillingAddress((prevModel) => updateModel(prevModel, key, value))
                              }
                            />
                          </div>
                        </fieldset>
                      ) : (
                        <div
                          className="ref-button ref-add-billing"
                          onClick={() => showBillingAddress()}
                        >
                          {t("cart.add_billing")}
                        </div>
                      )}
                    </div>

                    {!!shippingMethods.length && (
                      <>
                        <div className="ref-heading-shipping-methods ref-heading-small">
                          {t("shipping_method")}
                        </div>
                        <div className="ref-shipping-methods ref-error-parent">
                          {shippingMethods.map((method, index) => (
                            <label key={method.name} className="ref-row">
                              <div className="ref-method-radio">
                                <input
                                  type="radio"
                                  value={index}
                                  name="shipping-method"
                                  required
                                  checked={selectedShippingMethod == index}
                                  onChange={() => setSelectedShippingMethod(index)}
                                />
                              </div>
                              <div className="ref-method-name">
                                <b>{method.name}</b>
                                {method.delivery_time && (
                                  <small>
                                    {getDeliveryDate(method.delivery_time) +
                                      " - " +
                                      getDeliveryDate(method.delivery_time + 2)}
                                  </small>
                                )}
                                {method.note && <small>{method.note}</small>}
                              </div>
                              <div className="ref-method-price">
                                {cartManager.formatCurrency(method.price)}
                              </div>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </fieldset>
                </div>
              )}
            </div>
          )}

          {taxes && taxDetails.exemptionType && (
            <div className="ref-tax-note">
              <hr />

              <div className={`ref-field-collapsible${isTaxFieldOpen ? " open" : ""}`}>
                <span className="ref-field-toggle" onClick={() => setTaxFieldOpen(!isTaxFieldOpen)}>
                  <span className="ref-field-toggle-title">{t("cart.tax_exemption_add")}</span>
                </span>
                <div className="ref-collapse">
                  {taxDetails.exemptionType === "file" ? (
                    <div className="ref-tax-exemption-file">
                      {taxExemption ? (
                        <div className="ref-old-tax-file">
                          <a href={taxExemption.download} className="ref-tax-file-dl">
                            {t("cart.tax_exemption_file")}
                          </a>
                          <span
                            className="ref-remove-tax-file"
                            onClick={cartManager.removeTaxExemptionFile}
                          >
                            {t("remove")}
                          </span>
                        </div>
                      ) : (
                        <label className="ref-new-tax-file">
                          <span className="ref-tax-file-label">
                            {t("cart.tax_exemption_file_prompt")}
                          </span>
                          <input
                            type="file"
                            name="tax-exemption-file"
                            id="ref-field-exemption-file"
                            className="ref-form-control"
                            accept=".doc,.docx,.pdf,.jpg,.jpeg,.png"
                            onChange={(e) =>
                              onTaxExemptionChange("tax-exemption-file", e.target.files[0])
                            }
                          />
                          <div className="ref-validation-error"></div>
                        </label>
                      )}
                    </div>
                  ) : taxDetails.exemptionType === "vat_number" ? (
                    <label className="ref-tax-exemption-text">
                      <span>{t("cart.tax_exemption_number_prompt")}</span>
                      <input
                        type="text"
                        name="tax-exemption-text"
                        id="ref-field-exemption-text"
                        className="ref-form-control"
                        maxLength="30"
                        defaultValue={
                          taxExemption
                            ? taxExemption?.vat_number?.input || taxExemption?.vat_number?.number
                            : ""
                        }
                        onChange={(e) => onTaxExemptionChange("tax-exemption-text", e.target.value)}
                      />
                      {taxExemption &&
                        (taxExemption?.vat_number?.status === "invalid" ? (
                          <div className="ref-validation-error">
                            {t("cart.errors.vat_number_invalid")}
                          </div>
                        ) : taxExemption.status == "unvalidated" ? (
                          <div className="ref-validation-error">
                            {t("cart.errors.vat_number_validation_fail")}
                          </div>
                        ) : null)}
                    </label>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          <hr />

          <div
            className={`ref-field-collapsible ref-note-to-seller${isNoteFieldOpen ? " open" : ""}`}
          >
            <span className="ref-field-toggle" onClick={() => setNoteFieldOpen(!isNoteFieldOpen)}>
              <span className="ref-field-toggle-title">{t("cart.note_to_seller")}</span>
            </span>
            <label className="ref-collapse">
              <textarea
                id="ref-field-note-seller"
                className="ref-form-control"
                name="note-to-seller"
                value={note}
                row="4"
                maxLength="1000"
                placeholder={t("cart.note_to_seller_placeholder")}
                onChange={(e) => setNote(e.target.value)}
              ></textarea>
            </label>
            <div className="ref-validation-error"></div>
          </div>

          <hr />

          <div>
            {(paymentProviders.some((pm) => pm.supported) || cartManager.hasZeroValue()) && (
              <div className="ref-heading ref-heading-payment">{t("payment")}</div>
            )}
            <div className="ref-paypal-payment-holder"></div>
            <div className="ref-standard-payment-buttons">
              {cartManager.hasZeroValue() ? (
                <div
                  key={pm.id}
                  className="ref-button ref-payment-button"
                  onClick={() => checkout("zero-value-cart")}
                >
                  {t("cart.complete_order")}
                </div>
              ) : (
                renderPaymentProviderButtons()
              )}
            </div>
          </div>
        </form>

        {/* <div className="ref-instructions">
          <div className="ref-heading ref-payment-method-name"></div>
          <div className="ref-payment-method-instructions"></div>
        </div> */}

        <div className="ref-links">
          {footerLinks.map((link) => (
            <a key={link.id} href={link.url} target="_blank">
              {t("cart." + link.id)}
            </a>
          ))}
        </div>
      </div>

      <div className={`ref-checkout-summary${isSummaryOpen ? " open" : ""}`}>
        <div className="ref-heading">{t("cart.order_summary")}</div>
        <div className="ref-products">
          {products.map((product, index) => (
            <SummaryProduct
              key={product.id + (product.variant?.id || "") + index}
              product={product}
            ></SummaryProduct>
          ))}
        </div>
        <hr />
        {!coupon && (
          <>
            <div className="ref-coupon-code">
              <form className="ref-coupon-container" onSubmit={(e) => submitCouponForm(e)}>
                <div className="ref-coupon-input-holder">
                  <input
                    id="ref-coupon-input"
                    className="ref-form-control"
                    name="coupon-code"
                    type="text"
                    value={couponCode}
                    maxLength="32"
                    autoComplete="off"
                    placeholder={t("cart.coupon_placeholder")}
                    onChange={(e) => setCouponCode(e.target.value)}
                  />
                  {couponCode && (
                    <span
                      className="ref-coupon-input-clear"
                      title={t("clear")}
                      onClick={() => setCouponCode("")}
                    >
                      ✕
                    </span>
                  )}
                </div>
                <button
                  className={`ref-button ref-button-success ref-add-code${
                    couponCode ? "" : " inactive"
                  }`}
                >
                  {t("apply")}
                </button>
              </form>
              <div className="ref-validation-error"></div>
            </div>
            <hr />
          </>
        )}
        <div className="ref-totals">
          <div className="ref-subtotal">
            <div className="ref-row">
              <span>{t("subtotal")}</span>
              <span>{cartManager.formatCurrency(subtotal)}</span>
            </div>
          </div>
          {!!coupon && (
            <div className="ref-applied-coupon">
              <div className="ref-row">
                <div className="ref-row">
                  <span>{shortenString(couponLabel, 15)}</span>
                  <span className="ref-remove-coupon" onClick={removeCoupon}>
                    {t("remove")}
                  </span>
                </div>
                <span>{coupon.errorCode ? "" : "-" + cartManager.formatCurrency(discount)}</span>
              </div>
              <div className="ref-applied-coupon-error"></div>
            </div>
          )}
          {hasPhysicalProds && (
            <div className="ref-shipping">
              <div className="ref-row">
                <span>{shippingLabel}</span>
                <span>{shippingPrice}</span>
              </div>
            </div>
          )}
          {taxes && (
            <div className="ref-taxes">
              <div className="ref-row">
                <span>
                  {`${taxRate.name} (${taxRate.rate}%)` +
                    (taxDetails.exemption ? " – " + taxDetails.exemption : "")}
                </span>
                <span>{cartManager.formatCurrency(taxes.amount)}</span>
              </div>
            </div>
          )}
        </div>
        <hr />
        <div className="ref-total">
          <div className="ref-row">
            <span>{t("total")}</span>
            <span>{cartManager.formatCurrency(total)}</span>
          </div>
          <div className="ref-total-note">
            {t("cart.prices_currency_description", { currency })}
          </div>
        </div>
      </div>
      <div className={`ref-summary-toggle ref-field-collapsible${isSummaryOpen ? " open" : ""}`}>
        <span className="ref-field-toggle" onClick={() => setSummaryOpen(!isSummaryOpen)}>
          <span className="ref-field-toggle-title">{t("cart.show_summary")}</span>
          <span className="ref-summary-total"></span>
        </span>
      </div>
    </div>
  );
}
