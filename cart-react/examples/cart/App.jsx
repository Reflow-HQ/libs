import React from "react";
import CartView, { useCart } from "@reflowhq/cart-react";
import useAuth from "@reflowhq/auth-react";
import "@reflowhq/cart-react/dist/style.css";

const config = {
  storeID: "199976733",
  apiBase: "http://api.reflow.local/v1",
};

function App() {
  const auth = useAuth(config);
  const cart = useCart(config);

  return (
    <div className="container my-5">
      <CartView
        cart={cart}
        auth={auth}
        successURL={"https://example.com/success"}
        cancelURL={"https://example.com/cancel"}
        onMessage={(message) => {
          console.log(message.type, message.title, message.description);
        }}
      />
      <div className="mt-5">
        <div
          id="add-physical-product"
          className="btn btn-primary me-2"
          onClick={() => cart.addProduct({ id: "379178066" })}
        >
          Add Physical Product
        </div>
        <div
          id="add-digital-product"
          className="btn btn-primary"
          onClick={() => cart.addProduct({ id: "558773655" })}
        >
          Add Digital Product
        </div>
      </div>
    </div>
  );
}

export default App;
