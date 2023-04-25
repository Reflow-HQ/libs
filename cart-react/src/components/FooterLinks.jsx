import React from "react";

import { useShoppingCart } from "../CartContext";

export default function FooterLinks() {
  const footerLinks = useShoppingCart((s) => s.footerLinks);
  const t = useShoppingCart((s) => s.t);

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
