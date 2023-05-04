import { useState, useEffect } from "react";
import Cart from "@reflowhq/cart";

export const cartMap = new Map();

function createStore(config) {
  const cart = new Cart(config);
  const listeners = new Set();

  let state;

  const getState = () => {
    return state;
  };

  const setState = (newState) => {
    const prevState = state;

    state = Object.assign({}, prevState, newState);

    listeners.forEach((listener) => listener());
  };

  state = {
    ...(cart.state || {}),
    storeID: config.storeID,
    localFormData: cart.localFormData,

    showLoading: () => cart.updateState({ isLoading: true }),
    hideLoading: () => cart.updateState({ isLoading: false }),
    setTaxExemptionRemoved: (taxExemptionRemoved) => setState({ taxExemptionRemoved }),

    setDeliveryMethod: cart.setDeliveryMethod.bind(cart),
    setSelectedLocation: cart.setSelectedLocation.bind(cart),
    setSelectedShippingMethod: cart.setSelectedShippingMethod.bind(cart),

    // Address-related methods

    getShippingAddress: cart.getShippingAddress.bind(cart),
    getDigitalAddress: cart.getDigitalAddress.bind(cart),
    isShippingFilled: cart.isShippingFilled.bind(cart),

    hasProducts: cart.hasProducts.bind(cart),
    hasPhysicalProducts: cart.hasPhysicalProducts.bind(cart),

    getCountryByCode: cart.getCountryByCode.bind(cart),
    getShippableCountries: cart.getShippableCountries.bind(cart),

    offersShipping: cart.offersShipping.bind(cart),
    offersLocalPickup: cart.offersLocalPickup.bind(cart),
    canDeliver: cart.canDeliver.bind(cart),
    canShip: cart.canShip.bind(cart),
    canFinish: cart.canFinish.bind(cart),
    hasZeroValue: cart.hasZeroValue.bind(cart),

    formatCurrency: cart.formatCurrency.bind(cart),
    getTaxPricingType: cart.getTaxPricingType.bind(cart),

    // Errors

    getErrorText: cart.getErrorText.bind(cart),
    getStateErrorMessage: cart.getStateErrorMessage.bind(cart),

    // Payment Provider methods

    getPaymentProvider: cart.getPaymentProvider.bind(cart),
    arePaymentProvidersAvailable: cart.arePaymentProvidersAvailable.bind(cart),

    // Stripe

    isStripeSupported: cart.isStripeSupported.bind(cart),

    // Paypal methods

    onlyPaypalNoDelivery: cart.onlyPaypalNoDelivery.bind(cart),
    isPaypalSupported: cart.isPaypalSupported.bind(cart),

    // Paypal API

    paypalCreateOrder: cart.paypalCreateOrder.bind(cart),
    paypalOnApprove: cart.paypalOnApprove.bind(cart),
    updatePaypalShipping: cart.updatePaypalShipping.bind(cart),

    // Reflow API

    refresh: cart.refresh.bind(cart),
    addProduct: cart.addProduct.bind(cart),
    updateLineItemQuantity: cart.updateLineItemQuantity.bind(cart),
    removeLineItem: cart.removeLineItem.bind(cart),
    applyDiscountCode: cart.applyDiscountCode.bind(cart),
    removeDiscountCode: cart.removeDiscountCode.bind(cart),
    updateAddress: cart.updateAddress.bind(cart),
    updateTaxExemption: cart.updateTaxExemption.bind(cart),
    invalidateTaxExemption: cart.invalidateTaxExemption.bind(cart),
    removeTaxExemptionFile: cart.removeTaxExemptionFile.bind(cart),
    checkout: cart.checkout.bind(cart),

    // Translations

    t: cart.translate.bind(cart),
  };

  return {
    getState,
    subscribe: (listener) => {
      const updateState = (newState) => {
        setState(newState);
      };

      const onTaxExemptionRemoved = () => {
        setState({ taxExemptionRemoved: true });
      };

      listeners.add(listener);
      cart.on("change", updateState);
      cart.on("tax-exemption-removed", onTaxExemptionRemoved);

      return () => {
        listeners.delete(listener);
        cart.off("change", updateState);
        cart.off("tax-exemption-removed", onTaxExemptionRemoved);
      };
    },
  };
}

export function useCart(config) {
  let store;

  if (config.storeID) {
    if (!cartMap.has(config.storeID)) {
      cartMap.set(config.storeID, createStore(config));
    }

    store = cartMap.get(config.storeID);
  } else {
    throw new Error("storeID config option is required");
  }

  const [cartObj, setCartObj] = useState(store.getState());

  useEffect(() => {
    // Subscribe for cart change events and cleanup
    // when the component is unmounted

    return store.subscribe(() => {
      let state = store.getState();
      console.log(state);
      setCartObj(store.getState());
    });

    // Todo: on unmount delete the store from the map if there are no more listeners left
  }, []);

  return cartObj;
}
