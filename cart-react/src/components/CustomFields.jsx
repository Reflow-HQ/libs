export default function CustomFields({ customFields, useFormData, formErrors }) {
  return (
    <div className="ref-custom-fields">
      {customFields?.map((field) => renderCustomField(field, useFormData, formErrors))}
    </div>
  );
}

const renderCustomField = (field, useFormData, formErrors) => {
  const inputName = "rcf-" + field.id;
  const [value, setValue] = useFormData(inputName);

  const getInputElement = () => {
    if (field.type === "checkbox") {
      return (
        <input
          type="checkbox"
          name={inputName}
          required={field.is_required}
          checked={!!value}
          onChange={(e) => setValue(e.target.checked)}
        />
      );
    }
    if (field.type === "text") {
      return (
        <input
          type="text"
          name={inputName}
          required={field.is_required}
          className="ref-form-control"
          minLength={field.minlength || 0}
          maxLength={field.maxlength || 99}
          value={value || ""}
          onChange={(e) => setValue(e.target.value)}
        />
      );
    }
    if (field.type === "dropdown") {
      return (
        <select
          name={inputName}
          required={field.is_required}
          className="ref-form-control"
          value={value || ""}
          onChange={(e) => setValue(e.target.value)}
        >
          {field.dropdown_options.map((optionText, index) => (
            <option key={index} value={optionText}>
              {optionText}
            </option>
          ))}
        </select>
      );
    }
    return null;
  };

  return (
    <label className={field.type === "checkbox" ? "ref-form-checkbox-group" : ""} key={field.id}>
      <span>{field.label}</span>
      {getInputElement()}
      {formErrors[inputName] && <div className="ref-validation-error">{formErrors[inputName]}</div>}
    </label>
  );
};
