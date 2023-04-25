import React, { createContext, useContext, useEffect, useRef } from "react";
import { createReflowCartStore, useCart } from "./createReflowCart";

const ShoppingCartContext = createContext({});

export function useAuth() {
  const { auth, hasAuth } = useContext(ShoppingCartContext);

  if (!hasAuth) return null;

  if (!auth) throw new Error("Missing ShoppingCartContext.Provider in the tree");

  return auth;
}

export function useShoppingCart(selector, equalityFn) {
  const { store } = useContext(ShoppingCartContext);

  if (!store) throw new Error("Missing ShoppingCartContext.Provider in the tree");

  return useCart(store, selector, equalityFn);
}

export function ShoppingCartProvider({ children, ...props }) {
  const storeRef = useRef();
  const authRef = useRef(props.auth);

  const hasAuth = !!props.auth;

  console.log("render");

  if (!storeRef.current) {
    storeRef.current = createReflowCartStore(props);
  }

  useEffect(() => {
    // Fetch the cart contents on mount
    storeRef.current.getState().cartManager.refresh();
  }, []);

  return (
    <ShoppingCartContext.Provider
      value={{ store: storeRef.current, auth: authRef.current, hasAuth }}
    >
      {children}
    </ShoppingCartContext.Provider>
  );
}
