/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals";
import Cart from "../index.js";

describe("Cart", () => {
  let cart = new Cart({ storeID: "1234", apiBase: "http://api.reflow.local/v1" });
  let defaultCartState = cart.state;

  beforeEach(() => {
    // Hide console.error() spam
    jest.spyOn(console, "error").mockImplementation(() => {});

    // Mock the cart.trigger method so we can track its evocations
    cart.trigger = jest.fn();
  });

  afterEach(() => {
    cart.trigger.mockClear();
  });

  it("should manage event listeners", async () => {
    let cart = new Cart({ storeID: "987" });

    expect(cart._listeners).toStrictEqual({});

    let cb = jest.fn();
    let cb2 = jest.fn();

    cart.on("asdf", cb);
    expect(cart._listeners).toStrictEqual({ asdf: [cb] });

    cart.on("asdf", cb);
    expect(cart._listeners).toStrictEqual({ asdf: [cb] });

    cart.on("asdf", cb2);
    expect(cart._listeners).toStrictEqual({ asdf: [cb, cb2] });

    expect(cb).toHaveBeenCalledTimes(0);
    cart.trigger("asdf", "BananaArg");
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("BananaArg");
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledWith("BananaArg");

    cart.off("asdf", cb);
    expect(cart._listeners).toStrictEqual({ asdf: [cb2] });

    cart.off("asdf", cb2);
    expect(cart._listeners).toStrictEqual({});

    expect(() => {
      cart.off("asdf", cb);
    }).toThrow("Unrecognized event name");

    expect(() => {
      cart.off("asdf", () => {});
    }).toThrow("Unrecognized event name");

    expect(() => {
      cart.off("asdf");
    }).toThrow("Unrecognized event name");

    expect(() => {
      cart.off("deae", () => {});
    }).toThrow("Unrecognized event name");
  });

  it("should manage localization", async () => {
    const localization = {
      "cart.message": "Message",
      "cart.amount": "This is the amount - {amount}",
    };

    const cart = new Cart({ storeID: "987", localization });

    expect(cart.localization["cart.message"]).toBe("Message");
    expect(cart.localization["cart.amount"]).toBe("This is the amount - {amount}");

    // expect(cart.translate("cart.message")).toBe("Message");

    // expect(
    //   cart.translate("cart.amount", {
    //     amount: "$5",
    //   })
    // ).toBe("This is the amount - $5");

    expect(() => {
      cart.translate("asdf");
    }).toThrow('Reflow: Localization key "asdf" is not defined');
  });

  it("should create new cart", async () => {
    let products = [
      {
        id: 123,
        type: "physical",
        inStock: true,
        quantity: 1,
      },
    ];

    global.fetch = jest.fn((url) => {
      let response = {};

      if (/\/carts\/$/.test(url)) {
        response = { cartKey: "key" };
      } else if (/\/carts\/key$/.test(url)) {
        response = {
          products,
        };
      } else {
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({}),
        });
      }

      return Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve(response),
      });
    });

    const cart = new Cart({ storeID: "987", apiBase: "http://api.reflow.local/v1" });
    cart.trigger = jest.fn();

    expect(cart.isLoaded()).toBe(false);
    expect(cart.key).toBe(undefined);

    // If no key is present, create a new cart and fetch its contents
    await cart.refresh();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(1, "http://api.reflow.local/v1/stores/987/carts/", {
      method: "POST",
    });
    expect(fetch).toHaveBeenNthCalledWith(2, "http://api.reflow.local/v1/stores/987/carts/key", {});

    expect(cart.trigger).toHaveBeenCalledTimes(1);
    expect(cart.trigger).toHaveBeenCalledWith("change", {
      isLoaded: true,
      isLoading: false,
      isUnavailable: false,

      locale: "en-US",

      errors: [],

      footerLinks: [],
      total: 0,
      subtotal: 0,
      taxes: {},
      locations: [],
      shippingMethods: [],
      shippableCountries: [],
      paymentProviders: [],
      signInProviders: [],

      selectedLocation: -1,
      selectedShippingMethod: -1,

      products: products,
      quantity: 1,
      deliveryMethod: "pickup",
      selectedLocation: -1,
      selectedShippingMethod: -1,
    });

    expect(cart.isLoaded()).toBe(true);
    expect(cart.key).toBe("key");
    expect(localStorage["reflowCartKey987"]).toBe("key");

    expect(cart.state.products).toStrictEqual(products);
  });

  it("should create new cart when the key is invalid", async () => {
    let products = [
      {
        id: 123,
        type: "physical",
        inStock: true,
        quantity: 1,
      },
    ];

    global.fetch = jest.fn((url) => {
      let response = {};

      if (/\/carts\/$/.test(url)) {
        response = { cartKey: "key" };
      } else if (/\/carts\/key$/.test(url)) {
        response = {
          products,
        };
      } else {
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({}),
        });
      }

      return Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve(response),
      });
    });

    const cart = new Cart({ storeID: "987", apiBase: "http://api.reflow.local/v1" });
    cart.trigger = jest.fn();

    // If the cart with the presented key doesn't exist,
    // create a new cart and fetch its contents
    cart.key = "nonexistent";

    await cart.refresh();

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://api.reflow.local/v1/stores/987/carts/nonexistent",
      {}
    );
    expect(fetch).toHaveBeenNthCalledWith(2, "http://api.reflow.local/v1/stores/987/carts/", {
      method: "POST",
    });
    expect(fetch).toHaveBeenNthCalledWith(3, "http://api.reflow.local/v1/stores/987/carts/key", {});

    expect(cart.trigger).toHaveBeenCalledTimes(1);
    expect(cart.trigger).toHaveBeenCalledWith("change", {
      isLoaded: true,
      isLoading: false,
      isUnavailable: false,

      locale: "en-US",

      errors: [],

      footerLinks: [],
      total: 0,
      subtotal: 0,
      taxes: {},
      locations: [],
      shippingMethods: [],
      shippableCountries: [],
      paymentProviders: [],
      signInProviders: [],

      selectedLocation: -1,
      selectedShippingMethod: -1,

      products: products,
      quantity: 1,
      deliveryMethod: "pickup",
      selectedLocation: -1,
      selectedShippingMethod: -1,
    });

    expect(cart.isLoaded()).toBe(true);
    expect(cart.key).toBe("key");
    expect(localStorage["reflowCartKey987"]).toBe("key");

    expect(cart.state.products).toStrictEqual(products);
  });

  it("should add product to cart", async () => {
    let product = {
      id: "123",
      lineItemID: "456",
      type: "physical",
      inStock: true,
    };

    let cartKey = "key";
    let quantity = 2;
    let products = [];

    global.fetch = jest.fn((url) => {
      let response = {};

      if (/\/add-to-cart/.test(url)) {
        response = { cartKey, cartQuantity: quantity };
        products = [{ ...product, quantity }];
      } else {
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({}),
        });
      }

      return Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve(response),
      });
    });

    const cart = new Cart({ storeID: "987", apiBase: "http://api.reflow.local/v1" });
    delete localStorage["reflowCartKey987"];

    cart.trigger = jest.fn();
    cart.scheduleRefresh = jest.fn(() => {
      cart.updateState({ products });
    });

    await cart.addProduct({ id: product.id }, quantity);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `http://api.reflow.local/v1/stores/987/add-to-cart/${product.id}/${quantity}/`,
      {
        method: "POST",
        body: new FormData(),
      }
    );

    expect(cart.trigger).toHaveBeenCalledTimes(3);
    expect(cart.trigger).toHaveBeenNthCalledWith(1, "change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod: "pickup",
      quantity,
    });

    expect(cart.trigger).toHaveBeenNthCalledWith(2, "product-added", { productID: product.id });

    expect(cart.trigger).toHaveBeenNthCalledWith(3, "change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod: "pickup",
      quantity,
      products,
    });

    expect(cart.isLoaded()).toBe(true);
    expect(cart.key).toBe(cartKey);
    expect(localStorage["reflowCartKey987"]).toBe(cartKey);

    expect(cart.state.products).toStrictEqual(products);
    expect(cart.getProducts()).toStrictEqual(products);
    expect(cart.hasProducts()).toStrictEqual(true);
  });

  it("should update line item quantity", async () => {
    let product = {
      id: "123",
      lineItemID: "456",
      type: "physical",
      inStock: true,
      quantity: 2,
    };

    let cartKey = "key";
    let newQuantity = 5;
    let products = [];

    global.fetch = jest.fn((url) => {
      let response = {};

      if (/\/update-cart-product/.test(url)) {
        response = { cartQuantity: newQuantity };
        products = [{ ...product, quantity: newQuantity }];
      } else {
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({}),
        });
      }

      return Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve(response),
      });
    });

    const cart = new Cart({ storeID: "987", apiBase: "http://api.reflow.local/v1" });
    cart.key = cartKey;
    cart.state.products = [product];

    cart.trigger = jest.fn();
    cart.scheduleRefresh = jest.fn(() => {
      cart.updateState({ products });
    });

    await cart.updateLineItemQuantity(product.lineItemID, newQuantity);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `http://api.reflow.local/v1/stores/987/update-cart-product/${cartKey}/${product.id}/${newQuantity}/`,
      {
        method: "POST",
        body: new FormData(),
      }
    );

    expect(cart.trigger).toHaveBeenCalledTimes(3);
    expect(cart.trigger).toHaveBeenNthCalledWith(1, "change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod: "pickup",
      products: [product],
      quantity: newQuantity,
    });

    expect(cart.trigger).toHaveBeenNthCalledWith(2, "product-updated", { productID: product.id });

    expect(cart.trigger).toHaveBeenNthCalledWith(3, "change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod: "pickup",
      quantity: newQuantity,
      products,
    });

    expect(cart.isLoaded()).toBe(true);
    expect(cart.key).toBe(cartKey);
    expect(localStorage["reflowCartKey987"]).toBe(cartKey);

    expect(cart.state.products).toStrictEqual(products);
    expect(cart.getProducts()).toStrictEqual(products);
    expect(cart.hasProducts()).toStrictEqual(true);
  });

  it("should remove line item", async () => {
    let product = {
      id: "123",
      lineItemID: "456",
      type: "physical",
      inStock: true,
      quantity: 5,
    };

    let cartKey = "key";
    let newQuantity = 0;
    let products = [];

    global.fetch = jest.fn((url) => {
      let response = {};

      if (/\/remove-cart-product/.test(url)) {
        response = { cartQuantity: newQuantity };
        products = [];
      } else {
        return Promise.resolve({
          status: 404,
          json: () => Promise.resolve({}),
        });
      }

      return Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve(response),
      });
    });

    const cart = new Cart({ storeID: "987", apiBase: "http://api.reflow.local/v1" });
    cart.key = cartKey;
    cart.state.products = [product];

    cart.trigger = jest.fn();
    cart.scheduleRefresh = jest.fn(() => {
      cart.updateState({ products });
    });

    await cart.removeLineItem(product.lineItemID);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `http://api.reflow.local/v1/stores/987/remove-cart-product/${cartKey}/${product.id}/`,
      {
        method: "POST",
        body: new FormData(),
      }
    );

    expect(cart.trigger).toHaveBeenCalledTimes(3);
    expect(cart.trigger).toHaveBeenNthCalledWith(1, "change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod: "pickup",
      products: [product],
      quantity: newQuantity,
    });

    expect(cart.trigger).toHaveBeenNthCalledWith(2, "product-removed", { productID: product.id });

    expect(cart.trigger).toHaveBeenNthCalledWith(3, "change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod: "pickup",
      quantity: newQuantity,
      products: [],
    });

    expect(cart.isLoaded()).toBe(true);
    expect(cart.key).toBe(cartKey);
    expect(localStorage["reflowCartKey987"]).toBe(cartKey);

    expect(cart.state.products).toStrictEqual([]);
    expect(cart.getProducts()).toStrictEqual([]);
    expect(cart.hasProducts()).toStrictEqual(false);
  });

  it("should update state correctly", async () => {
    expect(cart.state.isLoaded).toBe(false);
    expect(cart.state.isUnavailable).toBe(false);

    let data;

    cart.updateState(data);

    expect(cart.state.isUnavailable).toBe(true);

    data = { products: [{ id: "123" }] };

    cart.updateState(data);

    expect(cart.state.isLoaded).toBe(true);
    expect(cart.state.isUnavailable).toBe(false);
  });

  it("should calculate the total quantity", async () => {
    let data = {
      products: [
        {
          quantity: 1,
        },
        {
          quantity: 2,
        },
        {
          quantity: 3,
        },
      ],
    };

    cart.updateState(data);

    expect(cart.state.quantity).toBe(6);
    expect(cart.calculateTotalQuantity()).toBe(6);
  });

  it("should set the correct delivery method", async () => {
    const cart = new Cart({ storeID: "987", apiBase: "http://api.reflow.local/v1" });

    let data;

    expect(cart.state.deliveryMethod).toBe(undefined);

    // No products - default delivery method is 'pickup'

    data = {
      products: [],
    };

    cart.updateState(data);

    expect(cart.state.deliveryMethod).toBe("pickup");

    // Digital products only - 'digital'

    data = {
      products: [
        {
          type: "digital",
          inStock: true,
          quantity: 1,
        },
        {
          type: "digital",
          inStock: true,
          quantity: 2,
        },
      ],
    };

    cart.updateState(data);

    expect(cart.state.deliveryMethod).toBe("digital");

    // We shouldn't accept an invalid delivery method

    cart.updateState({ deliveryMethod: "shipping" });

    expect(cart.state.deliveryMethod).toBe("digital");

    // Mixed products, physical product is out of stock - 'digital'

    data = {
      products: [
        {
          type: "digital",
          inStock: true,
          quantity: 1,
        },
        {
          type: "physical",
          inStock: false,
          quantity: 2,
        },
      ],
    };

    cart.updateState(data);

    expect(cart.state.deliveryMethod).toBe("digital");

    // Mixed products, physical product is in stock,
    // no physical locations, no shipping methods - use default method 'pickup'

    data = {
      products: [
        {
          type: "digital",
          inStock: true,
          quantity: 1,
        },
        {
          type: "physical",
          inStock: true,
          quantity: 2,
        },
      ],
    };

    cart.updateState(data);

    expect(cart.state.deliveryMethod).toBe("pickup");

    // Mixed products, physical product is in stock,
    // physical locations are present - use method 'pickup'

    data = {
      products: [
        {
          type: "digital",
          inStock: true,
          quantity: 1,
        },
        {
          type: "physical",
          inStock: true,
          quantity: 2,
        },
      ],
      locations: [
        {
          id: 199976733,
          name: "Labore deleniti.",
          email: "mckayla77@example.net",
          phone: "+12345658",
          working_hours: "24/7",
          address: {
            city: "Citysville",
            state: "NY",
            address: "123 Street",
            country: "US",
            postcode: "9187",
            countryName: "United States",
          },
          pay_in_store: true,
          instructions:
            "Come by at Address Street 123 between 10AM and 2PM to pick up your order. CASH ONLY! Order {orderid}. Amount {amount}",
          chosen: true,
          delivery_time: 2,
        },
      ],
    };

    cart.updateState(data);

    expect(cart.state.deliveryMethod).toBe("pickup");

    // Mixed products, physical product is in stock,
    // no physical locations, shippable countries are present - use method 'shipping'

    data = {
      products: [
        {
          type: "digital",
          quantity: 1,
        },
        {
          type: "physical",
          inStock: true,
          quantity: 2,
        },
      ],
      locations: [],
      shippableCountries: [
        {
          country_name: "United States",
        },
      ],
    };

    cart.updateState(data);

    expect(cart.state.deliveryMethod).toBe("shipping");

    // Mixed products, physical product is in stock,
    // physical locations are present, shippable countries are present -
    // we shouldn't change the method

    data = {
      products: [
        {
          type: "digital",
          quantity: 1,
        },
        {
          type: "physical",
          inStock: true,
          quantity: 2,
        },
      ],
      locations: [
        {
          id: 199976733,
          name: "Labore deleniti.",
          email: "mckayla77@example.net",
          phone: "+12345658",
          working_hours: "24/7",
          address: {
            city: "Citysville",
            state: "NY",
            address: "123 Street",
            country: "US",
            postcode: "9187",
            countryName: "United States",
          },
          pay_in_store: true,
          instructions:
            "Come by at Address Street 123 between 10AM and 2PM to pick up your order. CASH ONLY! Order {orderid}. Amount {amount}",
          chosen: true,
          delivery_time: 2,
        },
      ],
      shippableCountries: [
        {
          country_name: "United States",
        },
      ],
    };

    cart.updateState(data);

    expect(cart.state.deliveryMethod).toBe("shipping");

    // We shouldn't accept an invalid delivery method,
    // we should keep the old method if it's still valid

    cart.updateState({ deliveryMethod: "digital" });

    expect(cart.state.deliveryMethod).toBe("shipping");

    // We should accept pickup as physical locations are present

    cart.updateState({ deliveryMethod: "pickup" });

    expect(cart.state.deliveryMethod).toBe("pickup");
  });

  it("should set the correct location index", async () => {
    let data = {
      locations: [
        {
          id: 199976733,
          name: "Labore deleniti.",
          email: "mckayla77@example.net",
          phone: "+12345658",
          working_hours: "24/7",
          address: {
            city: "Citysville",
            state: "NY",
            address: "123 Street",
            country: "US",
            postcode: "9187",
            countryName: "United States",
          },
          pay_in_store: true,
          instructions:
            "Come by at Address Street 123 between 10AM and 2PM to pick up your order. CASH ONLY! Order {orderid}. Amount {amount}",
          chosen: false,
          delivery_time: 2,
        },
        {
          id: 379178066,
          name: "Illo adipisci.",
          email: "leta.howell@example.net",
          phone: "+12345658",
          working_hours: "24/7",
          address: {
            city: "La City",
            state: "VI",
            address: "123 Street",
            country: "ES",
            postcode: "9187",
            countryName: "Spain",
          },
          pay_in_store: true,
          instructions:
            "Come by at Address Street 123 between 10AM and 2PM to pick up your order. CASH ONLY! Order {orderid}. Amount {amount}",
          chosen: false,
          delivery_time: 2,
        },
      ],
    };

    cart.updateState(data);

    expect(cart.state.selectedLocation).toBe(-1);

    data = {
      locations: [
        {
          id: 199976733,
          name: "Labore deleniti.",
          email: "mckayla77@example.net",
          phone: "+12345658",
          working_hours: "24/7",
          address: {
            city: "Citysville",
            state: "NY",
            address: "123 Street",
            country: "US",
            postcode: "9187",
            countryName: "United States",
          },
          pay_in_store: true,
          instructions:
            "Come by at Address Street 123 between 10AM and 2PM to pick up your order. CASH ONLY! Order {orderid}. Amount {amount}",
          chosen: false,
          delivery_time: 2,
        },
        {
          id: 379178066,
          name: "Illo adipisci.",
          email: "leta.howell@example.net",
          phone: "+12345658",
          working_hours: "24/7",
          address: {
            city: "La City",
            state: "VI",
            address: "123 Street",
            country: "ES",
            postcode: "9187",
            countryName: "Spain",
          },
          pay_in_store: true,
          instructions:
            "Come by at Address Street 123 between 10AM and 2PM to pick up your order. CASH ONLY! Order {orderid}. Amount {amount}",
          chosen: true,
          delivery_time: 2,
        },
      ],
    };

    cart.updateState(data);

    expect(cart.state.selectedLocation).toBe(1);
  });

  it("should set the correct shipping method index", async () => {
    let data = {
      shipping: [
        {
          name: "Free Delivery always",
          type: "shipping",
          note: null,
          chosen: false,
          price: 0,
          delivery_time: 5,
        },
        {
          name: "Free Delivery",
          type: "shipping",
          note: null,
          chosen: false,
          price: 0,
          delivery_time: 5,
        },
        {
          name: "Standard Delivery",
          type: "shipping",
          note: null,
          chosen: false,
          price: 2300,
          delivery_time: 3,
        },
      ],
    };

    cart.updateState(data);

    expect(cart.state.selectedShippingMethod).toBe(-1);

    data = {
      shipping: [
        {
          name: "Free Delivery always",
          type: "shipping",
          note: null,
          chosen: false,
          price: 0,
          delivery_time: 5,
        },
        {
          name: "Free Delivery",
          type: "shipping",
          note: null,
          chosen: false,
          price: 0,
          delivery_time: 5,
        },
        {
          name: "Standard Delivery",
          type: "shipping",
          note: null,
          chosen: true,
          price: 2300,
          delivery_time: 3,
        },
      ],
    };

    cart.updateState(data);

    expect(cart.state.selectedShippingMethod).toBe(2);
  });
});
