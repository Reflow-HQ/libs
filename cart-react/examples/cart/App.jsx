import React from "react";
import Cart, { createReflowCart } from "@reflowhq/cart-react";
import "@reflowhq/cart-react/dist/style.css";
// import "./style.css";
// import "./cartview.css";

const config = {
  storeID: "199976733",
  apiBase: "http://api.reflow.local/v1",
};

const useCart = createReflowCart({ config });

function App() {
  const cartManager = useCart((s) => s.cartManager);

  return (
    <>
      <Cart
        config={config}
        successURL={"https://example.com/success"}
        cancelURL={"https://example.com/cancel"}
        onError={(error) => {
          console.log(error.title, error.description);
        }}
      />
      <div
        id="add-physical-product"
        className="btn btn-primary"
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
    </>
  );
}

export default App;
