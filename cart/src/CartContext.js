import { createContext, useContext, useState, useEffect } from 'react';
import Cart from "./Cart.js";

import IntlMessageFormat from "intl-messageformat";
import defaultLocalization from "./locale_en-US";

const ShoppingCartContext = createContext({});

export function useShoppingCart() {
  return useContext(ShoppingCartContext);
}

export function ShoppingCartProvider({ config, localization = {}, children }) {
  const cart = useState(() => new Cart(config))[0];

  const [isLoading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [footerLinks, setFooterLinks] = useState([]);
  const [total, setTotal] = useState(0);
  const [subtotal, setSubtotal] = useState(0);
  const [currency, setCurrency] = useState();
  const [coupon, setCoupon] = useState();
  const [discount, setDiscount] = useState();
  const [taxes, setTaxes] = useState({});
  const [taxExemption, setTaxExemption] = useState();
  const [vacationMode, setVacationMode] = useState();
  const [locations, setLocations] = useState([]);
  const [shippingMethods, setShippingMethods] = useState([]);
  const [shippableCountries, setShippableCountries] = useState([]);
  const [paymentProviders, setPaymentProviders] = useState([]);

  const [deliveryMethod, setDeliveryMethod] = useState("pickup");
  const [selectedLocation, setSelectedLocation] = useState(-1);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState(-1);

  const quantity = products.reduce((quantity, product) => quantity + product.quantity, 0);

  const loc = {
    ...defaultLocalization,
    ...localization,
  };

  useEffect(() => {
    // Fetch the cart contents on mount

    refresh();

    // Subscribing for events on the cart manager instance

    const subID = cart.subscribe((event, data) => {
      if (event == "loading") {
        setLoading(true);
      } else {
        setLoading(false);
      }
    });

    return () => {
      cart.unsubscribe(subID);
    };
  }, []);

  useEffect(() => {
    // Fetch the cart contents when delivery options change
    refresh();
  }, [deliveryMethod, selectedLocation, selectedShippingMethod]);


  function t(key, data) {
    return new IntlMessageFormat(loc[key], loc.locale).format(data);
  }

  function refresh() {
    let queryParams = {};

    if (deliveryMethod) {
      queryParams.deliveryMethod = deliveryMethod;
    }

    if (selectedShippingMethod >= 0) {
      queryParams.chosenShippingMethod = selectedShippingMethod;
    }

    if (selectedLocation >= 0) {
      queryParams.chosenStoreLocation = selectedLocation;
    }

    cart.refresh(queryParams).then(() => {
      updateState();
    });
  }

  function callApi(apiCall) {
    return (args) => {
      setLoading(true);
  
      return apiCall(args).then(() => {
        refresh();
      }).finally(() => {
        setLoading(false);
      });
    };
  }

  function updateState() {
    setProducts(cart.state.products);
    setFooterLinks(cart.state.footerLinks);
    setTotal(cart.state.total);
    setSubtotal(cart.state.subtotal);
    setCurrency(cart.state.currency);
    setCoupon(cart.state.coupon);
    setDiscount(cart.state.discount);
    setTaxes(cart.state.taxes);
    setTaxExemption(cart.state.taxExemption);
    setVacationMode(cart.state.vacationMode);
    setLocations(cart.state.locations);
    setShippingMethods(cart.state.shipping || []);
    setShippableCountries(cart.state.shippableCountries);
    setSelectedShippingMethod(cart.state.shipping.findIndex(s => s.chosen));
    setSelectedLocation(cart.state.locations.findIndex(l => l.chosen));
    setPaymentProviders(Object.entries(cart.state.paymentProviders).map(p => p[1]).sort((a, b) => {
      return b.order - a.order;
    }));

    let newDeliveryMethod = cart.hasPhysicalProducts() ? (deliveryMethod === 'digital' ? 'pickup' : deliveryMethod) : 'digital';

    if (deliveryMethod !== newDeliveryMethod) {
      setDeliveryMethod(newDeliveryMethod);
    }
  }

  const cartState = {
    isLoading,
    coupon,
    discount,
    products,
    quantity,
    footerLinks,
    total,
    subtotal,
    currency,
    locations,
    shippingMethods,
    shippableCountries,
    deliveryMethod,
    selectedLocation,
    selectedShippingMethod,
    setDeliveryMethod,
    setSelectedLocation,
    setSelectedShippingMethod,
    paymentProviders,
    taxes,
    taxExemption,
  };
  
  const cartManager = {
    updateProduct: callApi(cart.updateProduct.bind(cart)),
    removeProduct: callApi(cart.removeProduct.bind(cart)),
    addCoupon: callApi(cart.addCoupon.bind(cart)),
    removeCoupon: callApi(cart.removeCoupon.bind(cart)),
    updateAddress: callApi(cart.updateAddress.bind(cart)),
    updateTaxExemption: callApi(cart.updateTaxExemption.bind(cart)),
    invalidateTaxExemption: callApi(cart.invalidateTaxExemption.bind(cart)),
    removeTaxExemptionFile: callApi(cart.removeTaxExemptionFile.bind(cart)),
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
  };

  return (
    <ShoppingCartContext.Provider value={{ cartManager, cartState, t, locale: loc.locale }}>
      {children}
    </ShoppingCartContext.Provider>
  )
}
