import { useState, useEffect } from "react";

function getFormData(formDataKey) {
  return JSON.parse(localStorage.getItem(formDataKey) || "{}");
}

function setFormData(formDataKey, formData) {
  localStorage.setItem(formDataKey, JSON.stringify(formData));
}

function getInitialValue(formDataKey, key, initialValue) {
  var savedValue = getFormData(formDataKey);

  if (savedValue[key]) return savedValue[key];

  if (initialValue instanceof Function) return initialValue();
  return initialValue;
}

export default function useLocalStorageFormData(formDataKey) {
  return (key, initialValue) => {
    const [value, setValue] = useState(() => {
      return getInitialValue(formDataKey, key, initialValue);
    });

    useEffect(() => {
      let formData = getFormData(formDataKey);
      formData[key] = value ?? "";
      setFormData(formDataKey, formData);
    }, [value]);

    return [value, setValue];
  };
}
