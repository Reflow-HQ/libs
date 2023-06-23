import useAuth from "@reflowhq/auth-react";
import CartView from "../src/CartView.jsx";
import "../src/cartview.css";

import { useCart, createStore } from "../src/useCart";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Example/CartView",
  component: CartView,
};

const config = {
  storeID: "199976733",
  apiBase: "http://api.reflow.local/v2",
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

export const Localization = ({ ...args }) => {
  const auth = useAuth(config);
  const cart = useCart({ ...config, localization });

  return (
    <div className="container my-5">
      <CartView auth={auth} cart={cart} {...args} />
      <div className="mt-5">
        <button id="add-physical-product" onClick={() => cart.addProduct({ id: "379178066" })}>
          Add Physical Product
        </button>
        <button id="add-digital-product" onClick={() => cart.addProduct({ id: "558773655" })}>
          Add Digital Product
        </button>
      </div>
    </div>
  );
};

Localization.args = {
  onMessage: (error) => {
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
