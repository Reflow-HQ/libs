import { useState, useEffect } from 'react';

const formDataKey = 'reflowFormData';

function getFormData() {
  return JSON.parse(localStorage.getItem(formDataKey) || '{}');
}

function setFormData(formData) {
  localStorage.setItem(formDataKey, JSON.stringify(formData));
}

function getInitialValue(key, initialValue) {
  var savedValue = getFormData();

  if (savedValue[key]) return savedValue[key];

  if (initialValue instanceof Function) return initialValue();
  return initialValue;
}

export default function useLocalStorageFormData(key, initialValue) {
  const [value, setValue] = useState(() => {
    return getInitialValue(key, initialValue);
  });

  useEffect(() => {
    let formData = getFormData();
    formData[key] = value || '';
    setFormData(formData);
  }, [value]);

  return [value, setValue];
}
