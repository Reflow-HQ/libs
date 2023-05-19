import React from "react";

export default function Instructions({ instructions }) {
  if (!instructions) return null;

  return (
    <div className="ref-instructions">
      <div className="ref-heading ref-payment-method-name">{instructions.title}</div>
      <div className="ref-payment-method-instructions">{instructions.description}</div>
    </div>
  );
}
