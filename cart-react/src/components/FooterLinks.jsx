import React from "react";

import { useShoppingCart } from "../CartContext";

export default function FooterLinks() {
  const { footerLinks, t } = useShoppingCart();

  return (
    <div className="ref-links">
      {footerLinks.map((link) => (
        <a key={link.id} href={link.url} target="_blank">
          {t("cart." + link.id)}
        </a>
      ))}
    </div>
  );
}
