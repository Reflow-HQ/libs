/**
 * @jest-environment jsdom
 */

import React from "react";

import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import Cart from "./mocks/Cart";

const storeID = "1234";
const cartKey = "key";
const config = {
  storeID,
  apiBase: "http://api.reflow.local/v2",
};

const defaultCartContent = {
  isLoaded: false,
  isLoading: false,
  isUnavailable: false,

  locale: "en-US",

  errors: [],

  products: [],
  footerLinks: [],
  total: 0,
  subtotal: 0,
  locations: [],
  shippingMethods: [],
  shippableCountries: [],
  paymentProviders: [],
  signInProviders: [],

  selectedLocation: -1,
  selectedShippingMethod: -1,
};

const paymentProviders = [
  {
    provider: "paypal",
    supported: true,
    clientID: "1234",
    merchantID: "5678",
    order: 1,
  },
  {
    provider: "stripe",
    supported: true,
    order: 1,
    paymentOptions: [
      {
        id: "card",
        name: "Card, Apple Pay, Google Pay",
        currencies: "*",
        countries: "*",
      },
    ],
  },
];

const physicalProduct = {
  id: "123",
  lineItemID: "456",
  name: "Hat",
  type: "physical",
  inStock: true,
  quantity: 2,
  variant: null,
  inStock: 1,
  availableQuantity: 999,
  sku: "SKU70505",
  unitPrice: 2000,
  price: 4000,
  tax: 0,
  personalization: [],
  categories: [],
  minQty: 0,
  maxQty: 99999,
  discountedUnitPrice: 1500,
  discountedPrice: 3000,
};

let cartContentResponse;

function mockFetch() {
  return (url) => {
    const pathname = new URL(url).pathname;

    let response;

    switch (pathname) {
      case `/v2/stores/${storeID}/carts/`: {
        response = { cartKey };
        break;
      }
      case `/v2/stores/${storeID}/carts/${cartKey}`: {
        response = cartContentResponse;
        break;
      }
      default: {
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({}),
        });
      }
    }

    return Promise.resolve({
      status: 200,
      ok: true,
      json: () => Promise.resolve(response),
    });
  };
}

beforeEach(() => {
  global.fetch = jest.fn(mockFetch());
  cartContentResponse = defaultCartContent;
  delete localStorage["reflowCartKey1234"];
});

afterEach(() => {
  global.fetch.mockClear();
});

it("renders an error message when cart is unavailable", async () => {
  cartContentResponse = null;

  render(<Cart config={config} />);

  expect(await screen.findByText("Unable to load shopping cart.")).toBeInTheDocument();
});

it("renders an error message when store has no payment methods", async () => {
  cartContentResponse = { ...defaultCartContent };

  render(<Cart config={config} />);

  expect(
    await screen.findByText("This store has no payment methods configured.")
  ).toBeInTheDocument();
});

it("renders an empty cart message when the cart has no products", async () => {
  cartContentResponse = {
    ...defaultCartContent,
    paymentProviders,
    products: [],
  };

  render(<Cart config={config} />);

  expect(await screen.findByText("Your shopping cart is empty.")).toBeInTheDocument();
});

it("renders the cart slide", async () => {
  cartContentResponse = {
    ...defaultCartContent,
    paymentProviders,
    products: [physicalProduct],
  };

  render(<Cart config={config} />);

  expect(await screen.findByText("Shopping Cart")).toBeInTheDocument();
  expect(await screen.findByText(physicalProduct.name)).toBeInTheDocument();
});
