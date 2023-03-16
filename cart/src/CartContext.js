import { createContext, useContext, useEffect, useRef } from 'react';
import { createReflowCartStore, useCart } from './createReflowCart';
import useCartAuth from "@reflowhq/auth-react";

const ShoppingCartContext = createContext({});

export function useAuth() {
  const { auth } = useContext(ShoppingCartContext);

  if (!auth) throw new Error('Missing ShoppingCartContext.Provider in the tree');

  return auth;
}

export function useShoppingCart(selector, equalityFn) {
  const { store } = useContext(ShoppingCartContext);

  if (!store) throw new Error('Missing ShoppingCartContext.Provider in the tree');

  return useCart(store, selector, equalityFn);
}

export function ShoppingCartProvider({ children, ...props }) {
  const storeRef = useRef();
  const authRef = useRef(useCartAuth(props.config));

  if (!storeRef.current) {
    storeRef.current = createReflowCartStore(props);
  }

  useEffect(() => {
    // Fetch the cart contents on mount
    storeRef.current.getState().cartManager.refresh();
  }, []);

  return (
    <ShoppingCartContext.Provider value={{ store: storeRef.current, auth: authRef.current }}>
      {children}
    </ShoppingCartContext.Provider>
  )
}
