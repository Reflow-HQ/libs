/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals";
import Cart from "../index.js";

describe("Cart", () => {
  let cart = new Cart({ storeID: "1234", apiBase: "http://api.reflow.local/v1" });

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
});
