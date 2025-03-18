import React, { useState, useEffect, useRef, useCallback } from "react";

import debounce from "lodash.debounce";

import { useShoppingCart, useAuth } from "../CartContext";

import useLocalStorageFormData from "../hooks/useLocalStorageFormData";
import formatURL from "../utilities/formatURL";

import AddressWidget from "../widgets/AddressWidget";
import AuthButton from "../components/AuthButton";
import PaymentButton from "../components/PaymentButton";
import PayPalButton from "../components/PayPalButton";
import PayPalDemoButton from "../components/PayPalDemoButton";
import CustomFields from "../components/CustomFields";

export default function CheckoutForm({
  successURL,
  cancelURL,
  onMessage,
  onCheckoutSuccess,
  demoMode,
}) {
  const cart = useShoppingCart();

  const formDataKey = cart.localFormData.formDataKey;
  const useFormData = useLocalStorageFormData(formDataKey);

  const [email, setEmail] = useFormData("email");
  const [phone, setPhone] = useFormData("phone");
  const [name, setName] = useFormData("name");
  const [note, setNote] = useFormData("note");

  const [shippingAddress, setShippingAddress] = useFormData("shippingAddress", {});
  const [billingAddress, setBillingAddress] = useFormData("billingAddress", {});
  const [digitalAddress, setDigitalAddress] = useFormData("digitalAddress", {});

  const [saveAddress, setSaveAddress] = useState(true);

  const [showBilling, setShowBilling] = useState(() => isBillingFilled());

  const [isNoteFieldOpen, setNoteFieldOpen] = useState(true);
  const [isTaxFieldOpen, setTaxFieldOpen] = useState(true);

  const [formErrors, setFormErrors] = useState({});

  const auth = useAuth();
  const user = auth?.user || null;

  const showLoading = useShoppingCart().showLoading;
  const hideLoading = useShoppingCart().hideLoading;
  const t = useShoppingCart().t;

  const {
    locale,
    errors,
    locations,
    shippingMethods,
    shippableCountries,
    taxes,
    taxExemption,
    vacationMode,
    paymentProviders,
    signInProviders,
    collectPhone,
    customFields,
    getShippableCountries,
    getBillableCountries,
  } = cart;

  const [deliveryMethod, setDeliveryMethod] = [cart.deliveryMethod, cart.setDeliveryMethod];
  const [selectedLocation, setSelectedLocation] = [cart.selectedLocation, cart.setSelectedLocation];
  const [selectedShippingMethod, setSelectedShippingMethod] = [
    cart.selectedShippingMethod,
    cart.setSelectedShippingMethod,
  ];

  const isInVactionMode = !!vacationMode?.enabled;
  const shouldShowPaypalButtons =
    cart.isPaypalSupported() && !isInVactionMode && !cart.hasZeroValue();
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

  function getShippingAddressInput() {
    if (!auth || !auth.isSignedIn()) {
      return shippingAddress;
    }

    const newShippingAddress = {};

    if (user.name) {
      if (!shippingAddress.name) {
        newShippingAddress.name = user.name;
      }
    }

    if (user.meta.address) {
      const address = user.meta.address;

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

  function onTaxExemptionChange(exemptionType, exemptionValue) {
    // Updates the selected address and tax exemption fields
    // after which fetches the contents of the Cart with refreshed line items.

    let address;

    switch (deliveryMethod) {
      case "shipping": {
        address = cart.getShippingAddress();
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
        address = cart.getDigitalAddress();
        break;
      }

      default:
        break;
    }

    if (!address) {
      checkFormValidity(detailsForm.current);
      return;
    }

    cart.updateTaxExemption({
      address,
      deliveryMethod,
      exemptionType,
      exemptionValue,
    });
  }

  function checkFormValidity(form) {
    for (const input of form.querySelectorAll("input, textarea, select")) {
      // Find the first invalid input, scroll to it and show the browser message.

      if (!input.checkValidity()) {
        input.parentElement.scrollIntoView();
        setTimeout(() => input.reportValidity(), 600);
        return false;
      }
    }

    return true;
  }

  function clearFormErrors() {
    setFormErrors({});
  }

  async function checkout(paymentMethod, paymentID) {
    if (demoMode) {
      alert("Payment doesn't work in demo mode!");
      return;
    }

    if (isInVactionMode) {
      const message = vacationMode.message || t("store_unavailable");

      onMessage({ type: "error", description: message });
      return;
    }

    clearFormErrors();

    if (!checkFormValidity(detailsForm.current)) {
      return;
    }

    const customerFormData = new FormData(detailsForm.current);
    const data = {
      ...Object.fromEntries(customerFormData.entries()),
      "success-url": formatURL(successURL, { session_id: "{CHECKOUT_SESSION_ID}" }),
      "cancel-url": formatURL(cancelURL),
      "payment-method": paymentMethod,
      "payment-id": paymentID,
    };

    if (auth && auth.isSignedIn()) {
      data["auth-account-id"] = auth.user.id;
    }

    if (cart.customFields) {
      data["custom-fields"] = true;
    }

    showLoading();

    try {
      // Before trying to complete the payment,
      // refresh the state to fetch any store changes and show them in the interface.
      await cart.refresh();

      if (!cart.canFinish()) {
        onMessage({
          type: "error",
          title: t("cart.errors.cannot_complete"),
          description: cart.getStateErrors()[0],
        });
        return;
      }

      const result = await cart.checkout(data);

      if (!result.success) return;

      onCheckoutSuccess(result, paymentMethod, paymentID);
    } catch (e) {
      if (e.data && e.data.errors) {
        setFormErrors(e.data.errors);

        if (e.data.errors.system) {
          onMessage({
            type: "error",
            title: t("cart.errors.cannot_complete"),
            description: cart.getErrorText(e, "system"),
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

  function renderPaypalButtons() {
    if (demoMode) {
      return <PayPalDemoButton />;
    }

    let fundingSources = ["PAYPAL"];

    if (!cart.isStripeSupported()) {
      // When both are supported only the Stripe card payment button is shown.
      fundingSources.push("CARD");
    }

    return (
      <div className="ref-paypal-payment-holder">
        {fundingSources.map((fundingSource) => (
          <PayPalButton
            key={fundingSource}
            fundingSource={fundingSource}
            checkoutStep="details"
            canSubmit={() => true}
            successURL={successURL}
            onMessage={onMessage}
            style={{
              height: 55,
              disableMaxWidth: true,
            }}
          />
        ))}
      </div>
    );
  }

  function renderPaymentProviderButtons() {
    return paymentProviders.map((pm) =>
      pm.provider === "custom" ? (
        <PaymentButton key={pm.id} text={pm.name} onClick={() => checkout("custom", pm.id)} />
      ) : pm.provider === "pay-in-store" ? (
        <PaymentButton
          key={pm.provider}
          text={t("pay_on_pickup")}
          onClick={() => checkout("pay-in-store")}
        />
      ) : pm.provider === "stripe" && pm.supported && pm.paymentOptions.length ? (
        pm.paymentOptions.map((paymentOption) =>
          paymentOption.id === "card" ? (
            <div key={paymentOption.id}>
              <PaymentButton text={t("credit_card")} onClick={() => checkout("stripe")} />
              <PaymentButton text={"Apple Pay / Google Pay"} onClick={() => checkout("stripe")} />
            </div>
          ) : (
            <PaymentButton
              key={paymentOption.id}
              text={paymentOption.name}
              onClick={() => checkout("stripe")}
            />
          )
        )
      ) : null
    );
  }

  function updateAddress(deliveryMethod, address) {
    if (!address) return;

    cart.updateAddress({
      address,
      deliveryMethod,
    });
  }

  function hasShippingMethods() {
    return !!shippingMethods.length;
  }

  function canShipToAddress() {
    return cart.isShippingFilled() && cart.canShip();
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

  const hasPhysicalProds = cart.hasPhysicalProducts();
  const isDigital = !hasPhysicalProds;
  const offersShipping = hasPhysicalProds && cart.offersShipping();
  const offersPickup = hasPhysicalProds && cart.offersLocalPickup();
  const offersDelivery = offersShipping || offersPickup;
  const isTabbable = offersShipping && offersPickup;

  const taxDetails = taxes?.details;

  return (
    <form ref={detailsForm} className="ref-details ref-checkout-form">
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
          value={email || user?.email || ""}
          required
          onChange={(e) => setEmail(e.target.value)}
        />
        {formErrors["email"] && <div className="ref-validation-error">{formErrors["email"]}</div>}
      </label>
      {!!collectPhone && (
        <label className="ref-phone-input">
          <span>{t("phone")}</span>
          <input
            type="tel"
            name="phone"
            id="ref-field-phone"
            className="ref-form-control"
            value={phone || user?.meta.phone || ""}
            pattern="[0-9 \+\-]{5,30}"
            placeholder="+1234567890"
            required
            onChange={(e) => setPhone(e.target.value)}
          />
          {formErrors["phone"] && <div className="ref-validation-error">{formErrors["phone"]}</div>}
        </label>
      )}
      {(isDeliveryMethodActive("pickup") || isDigital) && (
        <label className="ref-customer-name-input">
          <span>{t("name")}</span>
          <input
            type="text"
            name="customer-name"
            className="ref-form-control"
            value={name || user?.name || ""}
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
              countries={getBillableCountries()}
              prefix="digital"
              fields={["country"]}
              isDigital={true}
              model={digitalAddress}
              onChange={(key, value) => {
                setDigitalAddress((prevModel) => {
                  const address = updateAddressModel(prevModel, key, value);
                  debouncedUpdateAddress("digital", cart.getDigitalAddress(address));

                  return address;
                });
              }}
            />
          </div>
          <input type="hidden" name="delivery-method" value="digital" />
        </fieldset>
      )}

      {!!customFields && (
        <CustomFields
          customFields={customFields}
          useFormData={useFormData}
          formErrors={formErrors}
        />
      )}

      <div className="ref-heading ref-heading-delivery">{t("delivery")}</div>

      {hasPhysicalProds && !cart.canDeliver() && (
        <div className="ref-delivery-unavailable">{t("cart.errors.delivery_unavailable")}</div>
      )}

      {offersDelivery && (
        <div className={"ref-delivery-card" + (isTabbable ? " tabbable" : "")}>
          {offersPickup && (
            <div
              className={
                "ref-tab ref-local-pickup-tab " + (isDeliveryMethodActive("pickup") ? " open" : "")
              }
            >
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
              <fieldset className="ref-tab-content" disabled={!isDeliveryMethodActive("pickup")}>
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
                          countries={getBillableCountries()}
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
            <div
              className={
                "ref-tab ref-shipping-tab " + (isDeliveryMethodActive("shipping") ? " open" : "")
              }
            >
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
              <fieldset className="ref-tab-content" disabled={!isDeliveryMethodActive("shipping")}>
                <div className="ref-heading-small">{t("shipping_address")}</div>
                <div className="ref-shipping-address-holder">
                  <AddressWidget
                    countries={getShippableCountries()}
                    prefix="shipping"
                    model={getShippingAddressInput()}
                    onChange={(key, value) => {
                      setShippingAddress((prevModel) => {
                        const address = updateAddressModel(prevModel, key, value);
                        debouncedUpdateAddress(
                          "shipping",
                          cart.getShippingAddress({
                            ...getShippingAddressInput(),
                            ...address,
                          })
                        );

                        return address;
                      });
                    }}
                  />
                </div>

                {!!auth && auth.isSignedIn() && (
                  <div className="ref-auth-save-address">
                    <label>
                      <input
                        type="checkbox"
                        name="auth-save-address"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
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
                          countries={getBillableCountries()}
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
                            {!!method.delivery_time && (
                              <small>
                                {getDeliveryDate(method.delivery_time) +
                                  " - " +
                                  getDeliveryDate(method.delivery_time + 2)}
                              </small>
                            )}
                            {!!method.note && <small>{method.note}</small>}
                          </div>
                          <div className="ref-method-price">
                            {cart.formatCurrency(method.price)}
                          </div>
                        </label>
                      ))}

                      {formErrors["shipping-method"] && (
                        <div className="ref-validation-error">{formErrors["shipping-method"]}</div>
                      )}
                    </div>
                  </>
                )}
              </fieldset>
            </div>
          )}
        </div>
      )}

      {taxDetails?.exemptionType && (
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
                      <span className="ref-remove-tax-file" onClick={cart.removeTaxExemptionFile}>
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

      <div className={`ref-field-collapsible ref-note-to-seller${isNoteFieldOpen ? " open" : ""}`}>
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
        {(paymentProviders.some((pm) => pm.supported) || cart.hasZeroValue()) && (
          <div className="ref-heading ref-heading-payment">{t("payment")}</div>
        )}
        {shouldShowPaypalButtons && renderPaypalButtons()}
        <div className="ref-standard-payment-buttons">
          {cart.hasZeroValue() ? (
            <PaymentButton
              text={t("cart.complete_order")}
              onClick={() => checkout("zero-value-cart")}
            />
          ) : (
            renderPaymentProviderButtons()
          )}
        </div>
      </div>
    </form>
  );
}
