/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals";
import Cart from "../index.js";

const physicalProduct = {
  id: "123",
  lineItemID: "456",
  type: "physical",
  inStock: true,
  quantity: 1,
};

const digitalProduct = {
  id: "987",
  lineItemID: "654",
  type: "physical",
  inStock: true,
  quantity: 1,
};

const updatedProductQuantity = 5;
const products = [physicalProduct];

const address = {
  name: "John Doe",
  city: "New York",
  country: "US",
  state: "New York",
  postcode: "12345",
};

const taxExemption = {
  country: "US",
  vat_number: {
    input: "6789",
    number: "US6789",
    status: "valid",
  },
};

const deliveryMethod = "shipping";
const exemptionType = "tax-exemption-text";
const exemptionValue = "6789";

const projectID = "1234";
const apiBase = "http://api.reflow.local/v2";
const cartKey = "key";

let refreshedState = {};

function mockFetch() {
  return (url) => {
    let response;

    switch (url) {
      case `${apiBase}/projects/${projectID}/carts/`: {
        response = {
          cartKey,
        };
        break;
      }
      case `${apiBase}/projects/${projectID}/carts/${cartKey}`: {
        response = {
          products,
        };
        break;
      }
      case `${apiBase}/projects/${projectID}/add-to-cart/${physicalProduct.id}/${physicalProduct.quantity}/`: {
        response = {
          cartKey,
          cartQuantity: physicalProduct.quantity,
        };
        refreshedState = {
          products: [physicalProduct],
        };
        break;
      }
      case `${apiBase}/projects/${projectID}/update-cart-product/${cartKey}/${physicalProduct.id}/${updatedProductQuantity}/`: {
        response = {
          cartQuantity: updatedProductQuantity,
        };
        refreshedState = {
          products: [
            {
              ...physicalProduct,
              quantity: updatedProductQuantity,
            },
          ],
        };
        break;
      }
      case `${apiBase}/projects/${projectID}/remove-cart-product/${cartKey}/${physicalProduct.id}/`: {
        response = {
          cartQuantity: 0,
        };
        refreshedState = {
          products: [],
        };
        break;
      }
      case `${apiBase}/projects/${projectID}/update-address/${cartKey}/`: {
        response = {
          success: true,
          taxExemptionRemoved: false,
        };
        refreshedState = {
          deliveryMethod,
          shippingAddress: address,
        };
        break;
      }
      case `${apiBase}/projects/${projectID}/update-tax-exemption/${cartKey}/`: {
        response = {
          success: true,
        };
        refreshedState = {
          deliveryMethod,
          taxExemption,
        };
        break;
      }
      case `${apiBase}/projects/${projectID}/invalidate-tax-exemption/${cartKey}/`: {
        response = {
          success: true,
          taxExemptionRemoved: true,
        };
        refreshedState = {
          taxExemption: null,
        };
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

describe("Cart", () => {
  let cart = new Cart({
    projectID,
    apiBase,
  });
  let defaultCartState = cart.state;

  beforeEach(() => {
    // Hide console.error() spam
    jest.spyOn(console, "error").mockImplementation(() => {});

    // Mock the cart.trigger method so we can track its evocations
    cart.trigger = jest.fn();
    cart.scheduleRefresh = jest.fn(() => {
      cart.updateState(refreshedState);
    });

    global.fetch = jest.fn(mockFetch());
  });

  afterEach(() => {
    cart.trigger.mockClear();
    cart.scheduleRefresh.mockClear();
    global.fetch.mockClear();

    cart.state = {
      ...defaultCartState,
    };

    refreshedState = {};
  });

  it("should manage event listeners", async () => {
    let cart = new Cart({
      projectID: "987",
    });

    expect(cart._listeners).toStrictEqual({});

    let cb = jest.fn();
    let cb2 = jest.fn();

    cart.on("asdf", cb);
    expect(cart._listeners).toStrictEqual({
      asdf: [cb],
    });

    cart.on("asdf", cb);
    expect(cart._listeners).toStrictEqual({
      asdf: [cb],
    });

    cart.on("asdf", cb2);
    expect(cart._listeners).toStrictEqual({
      asdf: [cb, cb2],
    });

    expect(cb).toHaveBeenCalledTimes(0);
    cart.trigger("asdf", "BananaArg");
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("BananaArg");
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledWith("BananaArg");

    cart.off("asdf", cb);
    expect(cart._listeners).toStrictEqual({
      asdf: [cb2],
    });

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

  it("should create new cart", async () => {
    expect(cart.isLoaded()).toBe(false);
    expect(cart.key).toBe(undefined);

    // If no key is present, create a new cart and fetch its contents
    await cart.refresh();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(1, "http://api.reflow.local/v2/projects/1234/carts/", {
      method: "POST",
    });
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "http://api.reflow.local/v2/projects/1234/carts/key",
      {}
    );

    expect(cart.trigger).toHaveBeenCalledTimes(1);
    expect(cart.trigger).toHaveBeenCalledWith("change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod: "pickup",
      products: products,
      quantity: 1,
    });

    expect(cart.isLoaded()).toBe(true);
    expect(cart.key).toBe("key");
    expect(localStorage["reflowCartKey1234"]).toBe("key");

    expect(cart.state.products).toStrictEqual(products);
  });

  it("should create new cart when the key is invalid", async () => {
    // If the cart with the presented key doesn't exist,
    // create a new cart and fetch its contents
    cart.key = "nonexistent";

    await cart.refresh();

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      "http://api.reflow.local/v2/projects/1234/carts/nonexistent",
      {}
    );
    expect(fetch).toHaveBeenNthCalledWith(2, "http://api.reflow.local/v2/projects/1234/carts/", {
      method: "POST",
    });
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      "http://api.reflow.local/v2/projects/1234/carts/key",
      {}
    );

    expect(cart.trigger).toHaveBeenCalledTimes(1);
    expect(cart.trigger).toHaveBeenCalledWith("change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod: "pickup",
      products: products,
      quantity: 1,
    });

    expect(cart.isLoaded()).toBe(true);
    expect(cart.key).toBe("key");
    expect(localStorage["reflowCartKey1234"]).toBe("key");

    expect(cart.state.products).toStrictEqual(products);
  });

  it("should add product to cart", async () => {
    const oldProducts = [];
    const newProducts = [physicalProduct];

    delete localStorage[`reflowCartKey1234`];

    await cart.addProduct(
      {
        id: physicalProduct.id,
      },
      physicalProduct.quantity
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `http://api.reflow.local/v2/projects/1234/add-to-cart/${physicalProduct.id}/${physicalProduct.quantity}/`,
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
      quantity: physicalProduct.quantity,
      products: oldProducts,
    });

    expect(cart.trigger).toHaveBeenNthCalledWith(2, "product-added", {
      productID: physicalProduct.id,
    });

    expect(cart.trigger).toHaveBeenNthCalledWith(3, "change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod: "pickup",
      quantity: physicalProduct.quantity,
      products: newProducts,
    });

    expect(cart.isLoaded()).toBe(true);
    expect(cart.key).toBe(cartKey);
    expect(localStorage["reflowCartKey1234"]).toBe(cartKey);

    expect(cart.state.products).toStrictEqual(newProducts);
    expect(cart.getProducts()).toStrictEqual(newProducts);
    expect(cart.hasProducts()).toStrictEqual(true);
  });

  it("should update line item quantity", async () => {
    const oldProducts = [physicalProduct];
    const newProducts = [
      {
        ...physicalProduct,
        quantity: updatedProductQuantity,
      },
    ];

    cart.state.products = oldProducts;

    await cart.updateLineItemQuantity(physicalProduct.lineItemID, updatedProductQuantity);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `http://api.reflow.local/v2/projects/1234/update-cart-product/${cartKey}/${physicalProduct.id}/${updatedProductQuantity}/`,
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
      quantity: updatedProductQuantity,
      products: oldProducts,
    });

    expect(cart.trigger).toHaveBeenNthCalledWith(2, "product-updated", {
      productID: physicalProduct.id,
    });

    expect(cart.trigger).toHaveBeenNthCalledWith(3, "change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod: "pickup",
      quantity: updatedProductQuantity,
      products: newProducts,
    });

    expect(cart.isLoaded()).toBe(true);

    expect(cart.state.products).toStrictEqual(newProducts);
    expect(cart.getProducts()).toStrictEqual(newProducts);
    expect(cart.hasProducts()).toStrictEqual(true);
  });

  it("should remove line item", async () => {
    const oldProducts = [physicalProduct];
    const newProducts = [];

    cart.state.products = oldProducts;

    await cart.removeLineItem(physicalProduct.lineItemID);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `http://api.reflow.local/v2/projects/1234/remove-cart-product/${cartKey}/${physicalProduct.id}/`,
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
      quantity: 0,
      products: oldProducts,
    });

    expect(cart.trigger).toHaveBeenNthCalledWith(2, "product-removed", {
      productID: physicalProduct.id,
    });

    expect(cart.trigger).toHaveBeenNthCalledWith(3, "change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod: "pickup",
      quantity: 0,
      products: newProducts,
    });

    expect(cart.isLoaded()).toBe(true);

    expect(cart.state.products).toStrictEqual(newProducts);
    expect(cart.getProducts()).toStrictEqual(newProducts);
    expect(cart.hasProducts()).toStrictEqual(false);
  });

  it("should update shipping address", async () => {
    await cart.updateAddress({
      address,
      deliveryMethod,
    });

    const body = new FormData();
    body.append("address", JSON.stringify(address));
    body.append("delivery_method", deliveryMethod);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `http://api.reflow.local/v2/projects/1234/update-address/${cartKey}/`,
      {
        method: "POST",
        body,
      }
    );

    expect(cart.trigger).toHaveBeenCalledTimes(2);

    expect(cart.trigger).toHaveBeenNthCalledWith(1, "address-updated");

    expect(cart.trigger).toHaveBeenNthCalledWith(2, "change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod,
      shippingAddress: address,
    });

    expect(cart.isLoaded()).toBe(true);
    expect(cart.state.shippingAddress).toStrictEqual(address);
  });

  it("should update tax exemption", async () => {
    await cart.updateTaxExemption({
      address,
      deliveryMethod,
      exemptionType,
      exemptionValue,
    });

    const body = new FormData();
    body.append("address", JSON.stringify(address));
    body.append("delivery-method", deliveryMethod);
    body.append(exemptionType, exemptionValue);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `http://api.reflow.local/v2/projects/1234/update-tax-exemption/${cartKey}/`,
      {
        method: "POST",
        body,
      }
    );

    expect(cart.trigger).toHaveBeenCalledTimes(2);

    expect(cart.trigger).toHaveBeenNthCalledWith(1, "tax-exemption-updated");

    expect(cart.trigger).toHaveBeenNthCalledWith(2, "change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod,
      taxExemption,
    });

    expect(cart.isLoaded()).toBe(true);
    expect(cart.state.taxExemption).toStrictEqual(taxExemption);
  });

  it("should invalidate tax exemption", async () => {
    await cart.invalidateTaxExemption({
      address,
    });

    const body = new FormData();
    body.append("address", JSON.stringify(address));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `http://api.reflow.local/v2/projects/1234/invalidate-tax-exemption/${cartKey}/`,
      {
        method: "POST",
        body,
      }
    );

    expect(cart.trigger).toHaveBeenCalledTimes(2);

    expect(cart.trigger).toHaveBeenNthCalledWith(1, "tax-exemption-removed");

    expect(cart.trigger).toHaveBeenNthCalledWith(2, "change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod: "pickup",
      taxExemption: null,
    });

    expect(cart.isLoaded()).toBe(true);
    expect(cart.state.taxExemption).toStrictEqual(null);
  });

  it("should apply coupon", async () => {
    const code = "5678";
    const coupon = {
      id: "1234",
      name: "Coupon",
      code: "5678",
      type: "flat",
      discount: 5000,
      discountAmount: 5000,
      originalProductSum: 60337,
      error: null,
      errorCode: null,
    };

    global.fetch = jest.fn((url) => {
      let response = {};

      if (/\/apply-discount-code/.test(url)) {
        response = {
          success: true,
          type: "coupon",
        };
        refreshedState = {
          coupon,
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

    await cart.applyDiscountCode({
      code,
    });

    const body = new FormData();
    body.append("code", code);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `http://api.reflow.local/v2/projects/1234/apply-discount-code/${cartKey}/`,
      {
        method: "POST",
        body,
      }
    );

    expect(cart.trigger).toHaveBeenCalledTimes(2);

    expect(cart.trigger).toHaveBeenNthCalledWith(1, "discount-code-added", {
      type: "coupon",
    });

    expect(cart.trigger).toHaveBeenNthCalledWith(2, "change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod: "pickup",
      coupon,
    });

    expect(cart.isLoaded()).toBe(true);
    expect(cart.state.coupon).toStrictEqual(coupon);
  });

  it("should apply gift card", async () => {
    const code = "5678";
    const giftCard = {
      id: "1234",
      code: "1111-1111-1111-1111",
      last_4: "1111",
      balance: 0,
      discountAmount: 0,
      error: null,
      errorCode: null,
    };

    global.fetch = jest.fn((url) => {
      let response = {};

      if (/\/apply-discount-code/.test(url)) {
        response = {
          success: true,
          type: "gift_card",
        };
        refreshedState = {
          giftCard,
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

    await cart.applyDiscountCode({
      code,
    });

    const body = new FormData();
    body.append("code", code);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `http://api.reflow.local/v2/projects/1234/apply-discount-code/${cartKey}/`,
      {
        method: "POST",
        body,
      }
    );

    expect(cart.trigger).toHaveBeenCalledTimes(2);

    expect(cart.trigger).toHaveBeenNthCalledWith(1, "discount-code-added", {
      type: "gift_card",
    });

    expect(cart.trigger).toHaveBeenNthCalledWith(2, "change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod: "pickup",
      giftCard,
    });

    expect(cart.isLoaded()).toBe(true);
    expect(cart.state.giftCard).toStrictEqual(giftCard);
  });

  it("should remove discount", async () => {
    const code = "5678";

    global.fetch = jest.fn((url) => {
      let response = {};

      if (/\/remove-discount-code/.test(url)) {
        response = {
          success: true,
          type: "coupon",
        };
        refreshedState = {
          coupon: null,
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

    await cart.removeDiscountCode({
      code,
    });

    const body = new FormData();
    body.append("code", code);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      `http://api.reflow.local/v2/projects/1234/remove-discount-code/${cartKey}/`,
      {
        method: "POST",
        body,
      }
    );

    expect(cart.trigger).toHaveBeenCalledTimes(2);

    expect(cart.trigger).toHaveBeenNthCalledWith(1, "discount-code-removed", {
      type: "coupon",
    });

    expect(cart.trigger).toHaveBeenNthCalledWith(2, "change", {
      ...defaultCartState,
      isLoaded: true,
      deliveryMethod: "pickup",
      coupon: null,
    });

    expect(cart.isLoaded()).toBe(true);
    expect(cart.state.coupon).toStrictEqual(null);
  });

  it("should update state correctly", async () => {
    expect(cart.state.isLoaded).toBe(false);
    expect(cart.state.isUnavailable).toBe(false);

    let data;

    cart.updateState(data);

    expect(cart.state.isUnavailable).toBe(true);

    data = {
      products: [
        {
          id: "123",
        },
      ],
    };

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

    cart.updateState({
      deliveryMethod: "shipping",
    });

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

    expect(cart.state.deliveryMethod).toBe("pickup");

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

    cart.updateState({
      deliveryMethod: "digital",
    });

    expect(cart.state.deliveryMethod).toBe("shipping");

    // We should accept pickup as physical locations are present

    cart.updateState({
      deliveryMethod: "pickup",
    });

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

  it("should format the shipping address", async () => {
    let address;

    // No address provided, no address in local storage

    let result = cart.getShippingAddress(address);

    expect(result).toBe(undefined);

    localStorage["reflowFormData1234"] = JSON.stringify({
      shippingAddress: {},
    });

    result = cart.getShippingAddress(address);

    expect(result).toBe(undefined);

    // Only name provided

    address = {
      name: "John Doe",
    };

    result = cart.getShippingAddress(address);

    expect(result).toBe(undefined);

    // Country code not provided

    address = {
      name: "John Doe",
      city: "New York",
    };

    result = cart.getShippingAddress(address);

    expect(result).toBe(undefined);

    // City and country code provided, but no shippable countries

    address = {
      name: "John Doe",
      city: "New York",
      countryCode: "US",
    };

    result = cart.getShippingAddress(address);

    expect(result).toBe(undefined);

    // City and country code provided, country not present in shippableCountries

    address = {
      name: "John Doe",
      city: "New York",
      countryCode: "US",
    };

    cart.state.shippableCountries = [
      {
        country_code: "ES",
        has_postcode: true,
        has_regions: true,
      },
    ];

    result = cart.getShippingAddress(address);

    expect(result).toBe(undefined);

    // City and country code provided, country is present in shippableCountries,
    // but it requires a region and postcode

    address = {
      name: "John Doe",
      city: "New York",
      countryCode: "US",
    };

    cart.state.shippableCountries = [
      {
        country_code: "US",
        has_postcode: true,
        has_regions: true,
      },
    ];

    result = cart.getShippingAddress(address);

    expect(result).toBe(undefined);

    // City, country code and region provided, country is present in shippableCountries,
    // but it requires a postcode

    address = {
      name: "John Doe",
      city: "New York",
      countryCode: "US",
      state: "New York",
    };

    result = cart.getShippingAddress(address);

    expect(result).toBe(undefined);

    // City, country code, region and postcode provided

    address = {
      name: "John Doe",
      city: "New York",
      countryCode: "US",
      state: "New York",
      postcode: "1234",
    };

    result = cart.getShippingAddress(address);

    expect(result).toStrictEqual({
      name: "John Doe",
      city: "New York",
      country: "US",
      state: "New York",
      postcode: "1234",
    });

    // City and country code provided, country is present in shippableCountries,
    // it doesn't require region and postcode

    address = {
      name: "John Doe",
      city: "New York",
      countryCode: "US",
    };

    cart.state.shippableCountries = [
      {
        country_code: "US",
        has_postcode: false,
        has_regions: false,
      },
    ];

    result = cart.getShippingAddress(address);

    expect(result).toStrictEqual({
      name: "John Doe",
      city: "New York",
      country: "US",
    });

    // No address provided - get it from local storage

    localStorage["reflowFormData1234"] = JSON.stringify({
      shippingAddress: address,
    });

    result = cart.getShippingAddress();

    expect(result).toStrictEqual({
      name: "John Doe",
      city: "New York",
      country: "US",
    });
  });

  it("should format the digital address", async () => {
    let address;

    // No address provided, no address in local storage

    let result = cart.getDigitalAddress(address);

    expect(result).toBe(undefined);

    localStorage["reflowFormData1234"] = JSON.stringify({
      digitalAddress: {},
    });

    result = cart.getDigitalAddress(address);

    expect(result).toBe(undefined);

    // Country code provided, country not present in shippableCountries

    address = {
      countryCode: "US",
    };

    result = cart.getDigitalAddress(address);

    expect(result).toBe(undefined);

    // Country code provided, country not present in shippableCountries

    address = {
      city: "New York",
      countryCode: "US",
    };

    cart.state.shippableCountries = [
      {
        country_code: "ES",
      },
    ];

    result = cart.getDigitalAddress(address);

    expect(result).toBe(undefined);

    // Country code provided, country is present in shippableCountries,
    // but it requires a state and postcode

    address = {
      city: "New York",
      countryCode: "US",
    };

    cart.state.shippableCountries = [
      {
        country_code: "US",
      },
    ];

    result = cart.getDigitalAddress(address);

    expect(result).toBe(undefined);

    // Country code and state provided, country is present in shippableCountries,
    // but it requires a postcode

    address = {
      city: "New York",
      countryCode: "US",
      state: "New York",
    };

    result = cart.getDigitalAddress(address);

    expect(result).toBe(undefined);

    // City, country code, state and postcode provided

    address = {
      city: "New York",
      countryCode: "US",
      state: "New York",
      postcode: "1234",
    };

    result = cart.getDigitalAddress(address);

    expect(result).toStrictEqual({
      country: "US",
      state: "New York",
      postcode: "1234",
    });

    // Country code provided, country is present in shippableCountries,
    // it doesn't require state and postcode

    address = {
      city: "New York",
      countryCode: "ES",
    };

    cart.state.shippableCountries = [
      {
        country_code: "ES",
      },
    ];

    result = cart.getDigitalAddress(address);

    expect(result).toStrictEqual({
      country: "ES",
    });

    // No address provided, use the one from local storage

    localStorage["reflowFormData1234"] = JSON.stringify({
      digitalAddress: address,
    });

    result = cart.getDigitalAddress();

    expect(result).toStrictEqual({
      country: "ES",
    });
  });

  it("should work with deprecated storeID alias", async () => {
    let cart = new Cart({
      storeID: "240418",
      apiBase,
    });

    expect(cart.getProducts()).toStrictEqual([]);
  });
});
