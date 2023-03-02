import { useShoppingCart } from "../CartContext";

export default function AddressWidget({
  model = {},
  updateModel,
  fields,
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

  const { t } = useShoppingCart();

  function shouldShowField(field) {
    return fields.includes(field);
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
            name={`${prefix ? prefix + "-" : ""}name`}
            required
            minLength="5"
            onChange={(e) => updateModel("name", e.target.value)}
          />
          <div className="ref-validation-error"></div>
        </label>
      )}
      {shouldShowField("address") && (
        <label>
          <span>{t("address")}</span>
          <textarea
            row="2"
            className="ref-form-control ref-field-details-address-line"
            value={model.address || ""}
            name={`${prefix ? prefix + "-" : ""}address`}
            required
            minLength="5"
            onChange={(e) => updateModel("address", e.target.value)}
          ></textarea>
          <div className="ref-validation-error"></div>
        </label>
      )}
      {shouldShowField("city") && (
        <label>
          <span>{t("city")}</span>
          <input
            type="text"
            className="ref-form-control ref-field-details-city"
            value={model.city || ""}
            name={`${prefix ? prefix + "-" : ""}city`}
            required
            minLength="2"
            onChange={(e) => updateModel("city", e.target.value)}
          />
          <div className="ref-validation-error"></div>
        </label>
      )}

      {shouldShowField("country") && (
        <div className="ref-error-parent">
          <label>
            <span>{t("country")}</span>
            <select
              className="ref-form-control ref-field-details-country"
              name={`${prefix ? prefix + "-" : ""}country`}
              required
              value={model.countryCode || ""}
              onChange={(e) => updateModel("countryCode", e.target.value)}
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
                  name={`${prefix ? prefix + "-" : ""}state`}
                  value={model.state || ""}
                  required
                  onChange={(e) => updateModel("state", e.target.value)}
                >
                  <option value="">{country.region_title}</option>
                  {Object.entries(country.regions).map(([rCode, rName]) => (
                    <option value={rCode}>{rName}</option>
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
                  name={`${prefix ? prefix + "-" : ""}postcode`}
                  value={model.postcode || ""}
                  required
                  onChange={(e) => updateModel("postcode", e.target.value)}
                />
              </label>
            )}
          </div>
          <div className="ref-validation-error"></div>
        </div>
      )}
    </div>
  );
}
