import React from "react";

import { useShoppingCart } from "../CartContext";

export default function FooterLinks() {
  const footerLinks = useShoppingCart().footerLinks;
  const t = useShoppingCart().t;

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
