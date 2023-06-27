import useAuth from "@reflowhq/auth-react";
import CartView from "../src/CartView.jsx";
import "../src/cartview.css";

import { useCart } from "../src/useCart";
import AddToCart from "../src/AddToCart";

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

const physicalProduct = {
  object: "product",
  id: 199976733,
  name: "T-shirt",
  excerpt: "Iusto et repellendus et incidunt totam totam.",
  description: "Iusto et repellendus et incidunt totam totam.",
  description_html: "Iusto et <b>repellendus</b> et <i>incidunt</i> totam totam.",
  promo_badge: "Editor's Choice",
  currency: {
    code: "USD",
    name: "United States Dollar (USD)",
    zero_decimal: false,
  },
  price: 46252,
  price_formatted: "$462.52",
  price_range: [46252],
  price_range_formatted: "$462.52",
  image: {
    sm: "https://cdn.reflowhq.com/media/product-default.png",
    md: "https://cdn.reflowhq.com/media/product-default.png",
    lg: "https://cdn.reflowhq.com/media/product-default.png",
  },
  media: [],
  variants: {
    enabled: true,
    option_name: "Size",
    items: [
      {
        id: "199976733_s",
        sku: "12345_S",
        price: 46252,
        price_formatted: "$462.52",
        name: "S",
        in_stock: true,
        quantity: 10,
        available_quantity: 10,
        original_price: 1539675,
        original_price_formatted: "$15,396.75",
      },
      {
        id: "199976733_m",
        sku: "12345_M",
        price: 46252,
        price_formatted: "$462.52",
        name: "M",
        in_stock: true,
        quantity: 10,
        available_quantity: 10,
        original_price: 1539675,
        original_price_formatted: "$15,396.75",
      },
      {
        id: "199976733_l",
        sku: "12345_L",
        price: 46252,
        price_formatted: "$462.52",
        name: "L",
        in_stock: false,
        quantity: 0,
        available_quantity: 0,
        original_price: 1539675,
        original_price_formatted: "$15,396.75",
      },
    ],
  },
  categories: [],
  inventory_type: "advanced",
  in_stock: true,
  personalization: {
    enabled: true,
    items: [
      {
        id: "199976733_engraving",
        name: "Engraving",
        type: "text",
        price: 12345,
        instructions: "Add beautiful handwritten text.",
        price_formatted: "$123.45",
      },
      {
        id: "199976733_gift_wrap",
        name: "Gift Wrap",
        type: "checkbox",
        price: 0,
        instructions: "Professional gift wrapping.",
        price_formatted: "$0.00",
      },
      {
        id: "199976733_file",
        name: "Image Upload",
        type: "file",
        price: 0,
        filetypes: ".png, .jpg",
        price_formatted: "$0.00",
      },
      {
        id: "199976733_dropdown",
        name: "Dropdown",
        type: "dropdown",
        price: 0,
        dropdownOptions: "Option 1, Option 2, Option 3",
        price_formatted: "$0.00",
      },
    ],
  },
  min_quantity: null,
  max_quantity: null,
  on_sale: {
    enabled: true,
    original_price: 1539675,
    original_price_formatted: "$15,396.75",
  },
  available_quantity: 0,
};

const digitalProduct = {
  object: "product",
  id: 558773655,
  name: "PC Program",
  excerpt: "Quis nemo doloribus eveniet aperiam repudiandae adipisci.",
  description: "Quis nemo doloribus eveniet aperiam repudiandae adipisci.",
  description_html: "Quis nemo <b>doloribus</b> eveniet <i>aperiam</i> repudiandae adipisci.",
  promo_badge: "Editor's Choice",
  currency: {
    code: "USD",
    name: "United States Dollar (USD)",
    zero_decimal: false,
  },
  price: 99911,
  price_formatted: "$999.11",
  price_range: [99911],
  price_range_formatted: "$999.11",
  image: {
    sm: "https://cdn.reflowhq.com/media/product-default.png",
    md: "https://cdn.reflowhq.com/media/product-default.png",
    lg: "https://cdn.reflowhq.com/media/product-default.png",
  },
  media: [],
  variants: {
    enabled: false,
    option_name: null,
    items: [],
  },
  categories: [],
  inventory_type: "simple",
  in_stock: true,
  personalization: {
    enabled: false,
    items: [],
  },
  min_quantity: null,
  max_quantity: null,
  on_sale: {
    enabled: false,
    original_price: null,
    original_price_formatted: null,
  },
};

export const Localization = ({ ...args }) => {
  const auth = useAuth(config);
  const cart = useCart({ ...config, localization });

  return (
    <div className="container my-5">
      <CartView auth={auth} cart={cart} {...args} />
      <div className="mt-5">
        <div className="mb-3">
          <h3>Add physical product with variants</h3>
          <AddToCart cart={cart} product={physicalProduct} />
        </div>
        <div className="mb-3">
          <h3>Add digital product</h3>
          <AddToCart cart={cart} product={digitalProduct} />
        </div>
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
