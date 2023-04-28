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
    showLoading: () => cart.updateState({ isLoading: true }),
    hideLoading: () => cart.updateState({ isLoading: false }),
    setDeliveryMethod: cart.setDeliveryMethod.bind(cart),
    setSelectedLocation: cart.setSelectedLocation.bind(cart),
    setSelectedShippingMethod: cart.setSelectedShippingMethod.bind(cart),
    setTaxExemptionRemoved: (taxExemptionRemoved) => setState({ taxExemptionRemoved }),
    cartManager: {
      addProduct: cart.addProduct.bind(cart),
      updateProductQuantity: cart.updateProductQuantity.bind(cart),
      removeProduct: cart.removeProduct.bind(cart),
      addCoupon: cart.addCoupon.bind(cart),
      removeCoupon: cart.removeCoupon.bind(cart),
      applyDiscountCode: cart.applyDiscountCode.bind(cart),
      applyGiftCard: cart.applyGiftCard.bind(cart),
      removeGiftCard: cart.removeGiftCard.bind(cart),
      updateAddress: cart.updateAddress.bind(cart),
      updateTaxExemption: cart.updateTaxExemption.bind(cart),
      invalidateTaxExemption: cart.invalidateTaxExemption.bind(cart),
      removeTaxExemptionFile: cart.removeTaxExemptionFile.bind(cart),
      checkout: cart.checkout.bind(cart),
      getShippingAddress: cart.getShippingAddress.bind(cart),
      getDigitalAddress: cart.getDigitalAddress.bind(cart),
      isShippingFilled: cart.isShippingFilled.bind(cart),
      getPaymentProvider: cart.getPaymentProvider.bind(cart),
      arePaymentProvidersAvailable: cart.arePaymentProvidersAvailable.bind(cart),
      onlyPaypalNoDelivery: cart.onlyPaypalNoDelivery.bind(cart),
      isPaypalSupported: cart.isPaypalSupported.bind(cart),
      paypalCreateOrder: cart.paypalCreateOrder.bind(cart),
      paypalOnApprove: cart.paypalOnApprove.bind(cart),
      updatePaypalShipping: cart.updatePaypalShipping.bind(cart),
      isStripeSupported: cart.isStripeSupported.bind(cart),
      hasPhysicalProducts: cart.hasPhysicalProducts.bind(cart),
      getShippableCountries: cart.getShippableCountries.bind(cart),
      offersShipping: cart.offersShipping.bind(cart),
      offersLocalPickup: cart.offersLocalPickup.bind(cart),
      getCountryByCode: cart.getCountryByCode.bind(cart),
      canDeliver: cart.canDeliver.bind(cart),
      canShip: cart.canShip.bind(cart),
      hasZeroValue: cart.hasZeroValue.bind(cart),
      canFinish: cart.canFinish.bind(cart),
      formatCurrency: cart.formatCurrency.bind(cart),
      getProductKey: cart.getProductKey.bind(cart),
      getErrorText: cart.getErrorText.bind(cart),
      getStateErrorMessage: cart.getStateErrorMessage.bind(cart),
      getTaxPricingType: cart.getTaxPricingType.bind(cart),
      refresh: cart.refresh.bind(cart),
    },
    localFormData: cart.localFormData,
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
      setCartObj(store.getState());
    });

    // Todo: on unmount delete the store from the map if there are no more listeners left
  }, []);

  return cartObj;
}
