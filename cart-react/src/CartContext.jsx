import React, { createContext, useContext, useEffect, useRef } from "react";

const ShoppingCartContext = createContext({});

export function useAuth() {
  const { auth, hasAuth } = useContext(ShoppingCartContext);

  if (!hasAuth) return null;

  if (!auth) throw new Error("Missing ShoppingCartContext.Provider in the tree");

  return auth;
}

export function useShoppingCart() {
  const { cart } = useContext(ShoppingCartContext);
  return cart;
}

export function ShoppingCartProvider({ children, ...props }) {
  const hasAuth = !!props.auth;

  useEffect(() => {
    console.log("refresh cart");
    // Fetch the cart contents on mount
    props.cart.refresh();
  }, []);

  return (
    <ShoppingCartContext.Provider value={{ cart: props.cart, auth: props.auth, hasAuth }}>
      {children}
    </ShoppingCartContext.Provider>
  );
}
