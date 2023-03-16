import { useState, useEffect, useRef, useCallback } from "react";
import debounce from "lodash.debounce";

import { useShoppingCart, useAuth } from "../CartContext";

import useLocalStorageFormData from "../hooks/useLocalStorageFormData";

import AddressWidget from "../widgets/AddressWidget";
import AuthButton from "../components/AuthButton";
import Summary from "../components/Summary";

export default function CheckoutSlide({ successURL, cancelURL, onError, step, setStep }) {
  const [email, setEmail] = useLocalStorageFormData("email");
  const [phone, setPhone] = useLocalStorageFormData("phone");
  const [name, setName] = useLocalStorageFormData("name");
  const [note, setNote] = useLocalStorageFormData("note");

  const [shippingAddress, setShippingAddress] = useLocalStorageFormData("shippingAddress", {});
  const [billingAddress, setBillingAddress] = useLocalStorageFormData("billingAddress", {});
  const [digitalAddress, setDigitalAddress] = useLocalStorageFormData("digitalAddress", {});

  const [showBilling, setShowBilling] = useState(() => isBillingFilled());

  const [isNoteFieldOpen, setNoteFieldOpen] = useState(true);
  const [isTaxFieldOpen, setTaxFieldOpen] = useState(true);

  const [instructions, setInstructions] = useState({});
  const [formErrors, setFormErrors] = useState({});

  const auth = useAuth();

  const {
    errors,
    locations,
    shippingMethods,
    shippableCountries,
    footerLinks,
    taxes,
    taxExemption,
    vacationMode,
    paymentProviders,
    signInProviders,
    deliveryMethod,
    selectedLocation,
    selectedShippingMethod,
    setDeliveryMethod,
    setSelectedLocation,
    setSelectedShippingMethod,
    cartManager,
    showLoading,
    hideLoading,
    t,
    locale,
  } = useShoppingCart((s) => ({
    cartManager: s.cartManager,
    t: s.t,
    locale: s.locale,
    errors: s.errors,
    locations: s.locations,
    shippingMethods: s.shippingMethods,
    shippableCountries: s.shippableCountries,
    footerLinks: s.footerLinks,
    taxes: s.taxes,
    taxExemption: s.taxExemption,
    vacationMode: s.vacationMode,
    paymentProviders: s.paymentProviders,
    signInProviders: s.signInProviders,
    deliveryMethod: s.deliveryMethod,
    selectedLocation: s.selectedLocation,
    selectedShippingMethod: s.selectedShippingMethod,
    setDeliveryMethod: s.setDeliveryMethod,
    setSelectedLocation: s.setSelectedLocation,
    setSelectedShippingMethod: s.setSelectedShippingMethod,
    showLoading: s.showLoading,
    hideLoading: s.hideLoading,
  }));

  const debouncedUpdateAddress = useCallback(debounce(updateAddress, 500), []);

  const detailsForm = useRef();

  function isDeliveryMethodActive(method) {
    return deliveryMethod === method;
  }

  function updateAddressModel(model, key, value) {
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

  function isShippingFilled() {
    return !!getShippingAddress();
  }

  function getShippingAddressInput() {
    if (!auth.isSignedIn()) {
      return shippingAddress;
    }

    const profile = auth.profile;
    const newShippingAddress = {};

    if (profile.name) {
      if (!shippingAddress.name) {
        newShippingAddress.name = profile.name;
      }
    }

    if (profile.meta.address) {
      const address = profile.meta.address;

      for (const prop of ["address", "city", "country", "postcode", "state"]) {
        if (address[prop] && !shippingAddress[prop]) {
          newShippingAddress[prop] = address[prop];
        }
      }
    }

    return {
      ...shippingAddress,
      ...newShippingAddress,
    };
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

  function checkFormValidity(form) {
    // TODO
    return true;
  }

  function getSuccessURL(queryParams = {}) {
    // The URL we redirect to when a cart purchase is successfully completed.

    try {
      if (!successURL) throw Error("invalid");
      // Turns relative URLs into absolute ones using the current URL as a base.
      // This gives users the ability to pass relative addresses as the value of
      // the data-reflow-success-url attribute and it will be resolved correctly.

      let url = new URL(successURL, window.location.href);

      // Add the search parameters. It's done this way instead of with url.searchParams
      // because of Stripe's session_id={CHECKOUT_SESSION_ID} which is escaped with searchParams.

      let search = url.search;

      for (const key in queryParams) {
        search += !search.length ? "?" : "&";
        search += `${key}=${queryParams[key]}`;
      }

      url.search = search;

      return url.href;
    } catch (e) {
      return window.location.href;
    }
  }

  function getCancelURL() {
    try {
      // Analogous to success url.
      if (!cancelURL) throw Error("invalid");
      return new URL(cancelURL, window.location.href).href;
    } catch (e) {
      return window.location.href;
    }
  }

  function clearFormErrors() {
    setFormErrors({});
  }

  async function checkout(paymentMethod, paymentID) {
    if (vacationMode?.enabled) {
      const message = vacationMode.message || t("store_unavailable");

      onError({ description: message });
      return;
    }

    clearFormErrors();

    if (!checkFormValidity(detailsForm.current)) {
      return;
    }

    const customerFormData = new FormData(detailsForm.current);
    const data = {
      ...Object.fromEntries(customerFormData.entries()),
      "success-url": getSuccessURL({ session_id: "{CHECKOUT_SESSION_ID}" }),
      "cancel-url": getCancelURL(),
      "payment-method": paymentMethod,
      "payment-id": paymentID,
    };

    // TODO: add auth
    if (auth.isSignedIn()) {
      data["auth-account-id"] = auth.profile.id;
    }

    showLoading();

    try {
      // Before trying to complete the payment,
      // refresh the state to fetch any store changes and show them in the interface.
      await cartManager.refresh();

      if (!cartManager.canFinish()) {
        // TODO: handle error
        onError({ description: cartManager.getStateErrors()[0] });
        return;
      }

      const result = await cartManager.checkout(data);

      if (!result.success) return;

      // Order total was 0 - the checkout is completed

      if (result.order && result.order.amount == 0) {
        // Redirect to the success page
        window.location = getSuccessURL({
          order_id: result.order.id,
          secure_hash: result.order.secure_hash,
        });
        return;
      }

      // Zero value cart payment was attempted, but the cart total turned out to be > 0.
      // No order is created, instead the cart refreshes and new payment methods are shown.

      if (paymentMethod === "zero-value-cart" && !result.order) {
        await cartManager.refresh();
      }

      // Stripe payment - redirect to the Stripe checkout page where the customer will finish payment.

      if (paymentMethod === "stripe" && result.stripeCheckoutURL) {
        window.location = result.stripeCheckoutURL;
        return;
      }

      // Custom payment - show instructions or redirect to successURL.

      if (paymentMethod === "custom" && result.order) {
        const method = Object.entries(paymentProviders).find((pm) => pm.id === paymentID);

        if (!method) return;

        if (!method.instructions) {
          // Redirect to the success page
          window.location = getSuccessURL({
            order_id: result.order.id,
            secure_hash: result.order.secure_hash,
          });
          return;
        }

        setInstructions((prevInstructions) => ({
          ...prevInstructions,
          title: method.name,
          description: method.instructions
            .replaceAll("{orderid}", result.order.id)
            .replaceAll("{amount}", cartManager.formatCurrency(result.order.amount)),
        }));

        setStep("instructions");
      }

      // Pay in store - customer will pay in person, show instructions or redirect to successURL

      if (paymentMethod === "pay-in-store" && result.order) {
        const location = locations.find((l) => l.chosen);

        if (!location || !location.instructions) {
          // Redirect to the success page
          window.location = getSuccessURL({
            order_id: result.order.id,
            secure_hash: result.order.secure_hash,
          });
          return;
        }

        setInstructions((prevInstructions) => ({
          ...prevInstructions,
          title: t("pickup_at_store"),
          description: location.instructions
            .replaceAll("{orderid}", result.order.id)
            .replaceAll("{amount}", cartManager.formatCurrency(result.order.amount)),
        }));

        setStep("instructions");
      }
    } catch (e) {
      if (e.data && e.data.errors) {
        setFormErrors(e.data.errors);

        if (e.data.errors.system) {
          onError({
            title: t("cart.errors.cannot_complete"),
            description: getErrorText(e, "system"),
          });
        }
      }
    } finally {
      hideLoading();
    }
  }

  function getDeliveryDate(days) {
    const deliveryDate = new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * days);
    const format = { month: "long", day: "numeric" };
    return deliveryDate.toLocaleDateString(locale, format);
  }

  function renderPaymentProviderButtons() {
    return paymentProviders.map((pm) =>
      pm.provider === "custom" ? (
        <div
          key={pm.id}
          className="ref-button ref-payment-button"
          onClick={() => checkout("custom", pm.id)}
        >
          {pm.name}
        </div>
      ) : pm.provider === "pay-in-store" ? (
        <div
          key={pm.provider}
          className="ref-button ref-payment-button"
          onClick={() => checkout("pay-in-store")}
        >
          {t("pay_on_pickup")}
        </div>
      ) : pm.provider === "stripe" && pm.supported && pm.paymentOptions.length ? (
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

  function updateAddress(deliveryMethod, address) {
    if (!address) return;

    cartManager.updateAddress({
      address,
      deliveryMethod,
    });
  }

  function hasShippingMethods() {
    return !!shippingMethods.length;
  }

  function canShipToAddress() {
    return isShippingFilled() && cartManager.canShip();
  }

  function canShowShippingMethods() {
    return canShipToAddress() && hasShippingMethods();
  }

  function hasSignInProviders() {
    return !!(signInProviders && signInProviders.length);
  }

  useEffect(() => {
    if (!canShipToAddress()) {
      setFormErrors((prevFormErrors) => {
        return {
          ...prevFormErrors,
          "shipping-country": t("cart.errors.address_not_supported"),
        };
      });
    }
  }, [shippingMethods, errors]);

  const hasPhysicalProds = cartManager.hasPhysicalProducts();
  const isDigital = !hasPhysicalProds;
  const offersShipping = hasPhysicalProds && cartManager.offersShipping();
  const offersPickup = hasPhysicalProds && cartManager.offersLocalPickup();
  const isTabbable = offersShipping && offersPickup;

  const taxDetails = taxes?.details;

  return (
    <div className="ref-checkout">
      <div className="ref-checkout-content">
        <form
          ref={detailsForm}
          className="ref-details"
          style={{ display: step === "details" ? "block" : "none" }}
        >
          <div className="ref-back" onClick={() => setStep("cart")}>
            ← {t("cart.back_to_cart")}
          </div>
          <div className="ref-heading">{t("cart.customer_details")}</div>

          {hasSignInProviders() && (
            <div className="text-center ref-auth-button-holder">
              <div className="ref-auth-button">
                <AuthButton />
              </div>
            </div>
          )}

          <label>
            <span>{t("email")}</span>
            <input
              type="email"
              name="email"
              id="ref-field-email"
              className="ref-form-control"
              value={email || auth.profile?.email || ""}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
            {formErrors["email"] && (
              <div className="ref-validation-error">{formErrors["email"]}</div>
            )}
          </label>
          <label className="ref-phone-input">
            <span>{t("phone")}</span>
            <input
              type="tel"
              name="phone"
              id="ref-field-phone"
              className="ref-form-control"
              value={phone || auth.profile?.meta.phone || ""}
              pattern="[0-9 \\+\\-]{5,30}"
              placeholder="+1234567890"
              required
              onChange={(e) => setPhone(e.target.value)}
            />
            {formErrors["phone"] && (
              <div className="ref-validation-error">{formErrors["phone"]}</div>
            )}
          </label>
          {(isDeliveryMethodActive("pickup") || isDigital) && (
            <label className="ref-customer-name-input">
              <span>{t("name")}</span>
              <input
                type="text"
                name="customer-name"
                className="ref-form-control"
                value={name || auth.profile?.name || ""}
                minLength="5"
                required
                onChange={(e) => setName(e.target.value)}
              />
              {formErrors["customer-name"] && (
                <div className="ref-validation-error">{formErrors["customer-name"]}</div>
              )}
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
                  onChange={(key, value) => {
                    setDigitalAddress((prevModel) => updateAddressModel(prevModel, key, value));
                    debouncedUpdateAddress("digital", getDigitalAddress());
                  }}
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

                      {formErrors["store-location"] && (
                        <div className="ref-validation-error">{formErrors["store-location"]}</div>
                      )}
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
                              onChange={(key, value) =>
                                setBillingAddress((prevModel) =>
                                  updateAddressModel(prevModel, key, value)
                                )
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
                        model={getShippingAddressInput()}
                        onChange={(key, value) => {
                          setShippingAddress((prevModel) =>
                            updateAddressModel(prevModel, key, value)
                          );
                          debouncedUpdateAddress("shipping", getShippingAddress());
                        }}
                      />
                    </div>

                    {auth.isSignedIn() && (
                      <div className="ref-auth-save-address">
                        <label>
                          <input
                            type="checkbox"
                            name="auth-save-address"
                            checked
                            onChange={(e) => e.target.value}
                          />
                          <span>{t("cart.save_address")}</span>
                        </label>
                      </div>
                    )}

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
                              onChange={(key, value) =>
                                setBillingAddress((prevModel) =>
                                  updateAddressModel(prevModel, key, value)
                                )
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

                    {canShowShippingMethods() && (
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

                          {formErrors["shipping-method"] && (
                            <div className="ref-validation-error">
                              {formErrors["shipping-method"]}
                            </div>
                          )}
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
                          {formErrors["tax-exemption-file"] && (
                            <div className="ref-validation-error">
                              {formErrors["tax-exemption-file"]}
                            </div>
                          )}
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
            {formErrors["note"] && <div className="ref-validation-error">{formErrors["note"]}</div>}
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

        {instructions && (
          <div
            className="ref-instructions"
            style={{ display: step === "instructions" ? "block" : "none" }}
          >
            <div className="ref-heading ref-payment-method-name">{instructions.title}</div>
            <div className="ref-payment-method-instructions">{instructions.description}</div>
          </div>
        )}

        <div className="ref-links">
          {footerLinks.map((link) => (
            <a key={link.id} href={link.url} target="_blank">
              {t("cart." + link.id)}
            </a>
          ))}
        </div>
      </div>

      <Summary />
    </div>
  );
}
