import { useShoppingCart } from "../CartContext";
import React from "react";

export default function AddressWidget({
  model = {},
  onChange,
  fields,
  errors = {},
  countries = [],
  prefix = "",
  isDigital = false,
}) {
  if (!fields) {
    fields = ["name", "city", "address", "country"];
  }

  // TODO: make this a ref and update only when countryCode changes?
  const country = countries.find((c) => c.country_code === model.countryCode);
  const showRegionZip = isDigital ? country?.country_code === "US" : true;
  const showPostcode = showRegionZip && country?.has_postcode;
  const showState = showRegionZip && country?.has_regions;

  const { t } = useShoppingCart((s) => ({
    t: s.t,
  }));

  function shouldShowField(field) {
    return fields.includes(field);
  }

  function getFieldID(name) {
    return `${prefix ? prefix + "-" : ""}${name}`;
  }

  return (
    <div className="ref-address-widget">
      {shouldShowField("name") && (
        <label>
          <span>{t("name")}</span>
          <input
            type="text"
            className="ref-form-control ref-field-details-name"
            value={model.name || ""}
            name={getFieldID("name")}
            required
            minLength="5"
            onChange={(e) => onChange("name", e.target.value)}
          />
          {errors[getFieldID("name")] && (
            <div className="ref-validation-error">{errors[getFieldID("name")]}</div>
          )}
        </label>
      )}
      {shouldShowField("address") && (
        <label>
          <span>{t("address")}</span>
          <textarea
            row="2"
            className="ref-form-control ref-field-details-address-line"
            value={model.address || ""}
            name={getFieldID("address")}
            required
            minLength="5"
            onChange={(e) => onChange("address", e.target.value)}
          ></textarea>
          {errors[getFieldID("name")] && (
            <div className="ref-validation-error">{errors[getFieldID("address")]}</div>
          )}
        </label>
      )}
      {shouldShowField("city") && (
        <label>
          <span>{t("city")}</span>
          <input
            type="text"
            className="ref-form-control ref-field-details-city"
            value={model.city || ""}
            name={getFieldID("city")}
            required
            minLength="2"
            onChange={(e) => onChange("city", e.target.value)}
          />
          {errors[getFieldID("city")] && (
            <div className="ref-validation-error">{errors[getFieldID("city")]}</div>
          )}
        </label>
      )}

      {shouldShowField("country") && (
        <div className="ref-error-parent">
          <label>
            <span>{t("country")}</span>
            <select
              className="ref-form-control ref-field-details-country"
              name={getFieldID("country")}
              required
              value={model.countryCode || ""}
              onChange={(e) => onChange("countryCode", e.target.value)}
            >
              <option value="">{t("cart.select_country")}</option>
              {countries.map((c) => (
                <option key={c.country_code} value={c.country_code}>
                  {c.country_name}
                </option>
              ))}
            </select>
          </label>
          <div className="ref-row ref-row-region">
            {showState && (
              <label>
                <span>{country.region_title}</span>
                <select
                  className="ref-form-control ref-field-details-region"
                  name={getFieldID("state")}
                  value={model.state || ""}
                  required
                  onChange={(e) => onChange("state", e.target.value)}
                >
                  <option value="">{country.region_title}</option>
                  {Object.entries(country.regions).map(([rCode, rName]) => (
                    <option key={rCode} value={rCode}>
                      {rName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {showPostcode && (
              <label>
                <span>{country.postcode_title || "Postal Code" || t("postcode")}</span>
                <input
                  type="text"
                  className="ref-form-control ref-field-details-postcode"
                  name={getFieldID("postcode")}
                  value={model.postcode || ""}
                  required
                  onChange={(e) => onChange("postcode", e.target.value)}
                />
              </label>
            )}
          </div>

          {errors[getFieldID("county")] && (
            <div className="ref-validation-error">{errors[getFieldID("county")]}</div>
          )}
        </div>
      )}
    </div>
  );
}
