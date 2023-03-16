import useSyncExternalStoreExports from 'use-sync-external-store/shim/with-selector';

import Cart from "./Cart.js";

const { useSyncExternalStoreWithSelector } = useSyncExternalStoreExports;

const cartMap = new Map();

function createStore({ config, localization = {} }) {
  const cart = new Cart({ ...config, localization });

  let state;

  const getState = () => {
    return state;
  };

  const setState = (newState) => {
    const prevState = state;

    state = Object.assign({}, prevState, newState);

    // cart._subscribers.forEach((cb) => cb(state, prevState));
  };

  state = {
    ...(cart.state || {}),
    showLoading: () => cart.updateState({ isLoading: true }),
    hideLoading: () => cart.updateState({ isLoading: false }),
    setDeliveryMethod: cart.setDeliveryMethod.bind(cart),
    setSelectedLocation: cart.setSelectedLocation.bind(cart),
    setSelectedShippingMethod: cart.setSelectedShippingMethod.bind(cart),
    cartManager: {
      updateProduct: cart.updateProduct.bind(cart),
      removeProduct: cart.removeProduct.bind(cart),
      addCoupon: cart.addCoupon.bind(cart),
      removeCoupon: cart.removeCoupon.bind(cart),
      updateAddress: cart.updateAddress.bind(cart),
      updateTaxExemption: cart.updateTaxExemption.bind(cart),
      invalidateTaxExemption: cart.invalidateTaxExemption.bind(cart),
      removeTaxExemptionFile: cart.removeTaxExemptionFile.bind(cart),
      checkout: cart.checkout.bind(cart),
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
      getProductPersonalization: cart.getProductPersonalization.bind(cart),
      getErrorText: cart.getErrorText.bind(cart),
      getStateErrorMessage: cart.getStateErrorMessage.bind(cart),
      refresh: cart.refresh.bind(cart),
    },
    t: cart.translate.bind(cart),
  };

  return {
    getState,
    subscribe: (listener) => {
      const updateState = (newState) => {
        setState(newState);
        listener();
      };

      cart.on('change', updateState);
      
      return () => {
        cart.off('change', updateState);
      }
    },
  };
}

export function createReflowCartStore({ config, ...props }) {
  let store;

  // if (config instanceof Cart) {
  //   store = config;
  // } else
  if (config.storeID) {
    if (!cartMap.has(config.storeID)) {
      cartMap.set(config.storeID, createStore({ config, ...props }));
    }

    store = cartMap.get(config.storeID);
  } else {
    throw new Error("storeID config option is required");
  }

  return store;
}

export function createReflowCart(props) {
  const store = createReflowCartStore(props);

  return (selector, equalityFn) => {
    return useCart(store, selector, equalityFn);
  }
}

export function useCart(store, selector, equalityFn) {
  return useSyncExternalStoreWithSelector(store.subscribe, store.getState, store.getServerState || store.getState, selector || store.getState, equalityFn);
}
