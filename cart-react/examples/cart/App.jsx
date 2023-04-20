import React from "react";
import Cart, { createReflowCart } from "@reflowhq/cart-react";
import "@reflowhq/cart-react/dist/style.css";

const config = {
  storeID: "199976733",
  apiBase: "http://api.reflow.local/v1",
};

const useCart = createReflowCart({ config });

function App() {
  const cartManager = useCart((s) => s.cartManager);

  return (
    <div className="container my-5">
      <Cart
        config={config}
        successURL={"https://example.com/success"}
        cancelURL={"https://example.com/cancel"}
        onMessage={(error) => {
          console.log(error.type, error.title, error.description);
        }}
      />
      <div className="mt-5">
        <div
          id="add-physical-product"
          className="btn btn-primary me-2"
          onClick={() => cartManager.addProduct({ id: "379178066" })}
        >
          Add Physical Product
        </div>
        <div
          id="add-digital-product"
          className="btn btn-primary"
          onClick={() => cartManager.addProduct({ id: "558773655" })}
        >
          Add Digital Product
        </div>
      </div>
    </div>
  );
}

export default App;
