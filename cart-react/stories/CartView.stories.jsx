import CartView from "../src/CartView.jsx";
import "../src/cartview.css";

import { createReflowCartStore, cartMap } from "../src/createReflowCart";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Example/CartView",
  component: CartView,
};

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template = (args) => <CartView {...args} />;

export const Localization = Template.bind({});

const config = {
  storeID: "199976733",
  apiBase: "http://api.reflow.local/v1",
};

const localization = {
  locale: "bg-BG",
  shopping_cart: "Количка",
  cart: "Количка",
  product: "Продукт",
  products: "Продукти",
  price: "Цена",
  quantity: "Количество",
  payment: "Плащане",
  name: "Име",
  email: "Email",
  phone: "Телефон",
  delivery: "Доставка",
  shipping: "Доставка",
  address: "Адрес",
  city: "Град",
  country: "Държава",
  state: "Област",
  postcode: "Пощенски код",
};

// TODO: figure out a better way to do this
delete localStorage[`reflowCartKey${config.storeID}`];

createReflowCartStore({ config, localization });

const cart = cartMap.get(config.storeID);
cart
  .getState()
  .cartManager.addProduct({ id: "379178066" })
  .then(() => {
    cart.getState().cartManager.addProduct({ id: "558773655" });
  });

Localization.args = {
  config,
  localization,
  onError: (error) => {
    let message = "";

    if (error.title) {
      message += `Title: ${error.title}`;
    }

    if (error.description) {
      message += `\nDescription: ${error.description}`;
    }

    alert(message || "Error");
  },
};
