import React from "react";

import CartView from "../src/CartView.jsx";
import Cart from "../src/Cart.js";
import "../src/cartview.css";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Example/CartView",
  component: CartView,
};

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template = (args) => <CartView {...args} />;

export const Basic = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Basic.args = {
  text: "Button.",
  cartManager: new Cart(),
};

export const Localization = Template.bind({});
Localization.args = {
  text: "Бутонче.",
  cartManager: new Cart(),
  localization: {
    locale: "bg-BG",
    "button.click": "Кликнахте {clickNum, plural, =0 {нула пъти} =1 {веднъж} other {# пъти}}.",
  },
};
