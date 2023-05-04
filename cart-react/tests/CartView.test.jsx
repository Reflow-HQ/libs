/**
 * @jest-environment jsdom
 */

import React from "react";

// import renderer from "react-test-renderer";
import { render, renderHook, screen, act, waitFor } from "@testing-library/react";

import CartView, { useCart } from "../";

let products = [
  {
    id: "123",
    lineItemID: "456",
    type: "physical",
    inStock: true,
    quantity: 1,
  },
];

const storeID = "1234";
const cartKey = "key";
const config = {
  storeID,
  apiBase: "http://api.reflow.local/v1",
};

const defaultCartContent = {
  isLoading: false,
  isLoaded: true,
  isUnavailable: false,
};

function mockFetch() {
  return (url) => {
    let response;

    switch (url) {
      case `http://api.reflow.local/v1/stores/${storeID}/carts/`: {
        response = { cartKey };
        break;
      }
      case `http://api.reflow.local/v1/stores/${storeID}/carts/${cartKey}`: {
        response = { ...defaultCartContent, products };
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
beforeAll(() => {
  // we're using fake timers because we don't want to
  // wait a full second for this test to run.
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  global.fetch = jest.fn(mockFetch());
});

afterEach(() => {
  global.fetch.mockClear();
});

it("renders a loading screen", async () => {
  // let cart;

  // act(() => {
  // renderHook(() => {
  // });
  // cart = useCart(config);

  const { result } = renderHook(() => useCart(config));

  render(<CartView cart={result.current} />);

  jest.advanceTimersByTime(1000);
  // await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

  expect(await screen.findByTestId("cart")).toBeInTheDocument();
  // const component = renderer.create(<CartView cart={cart} />);
  // expect(component.toJSON()).toMatchSnapshot();

  // Todo: implement interactive snapshot testing
  // https://jestjs.io/docs/snapshot-testing
});
