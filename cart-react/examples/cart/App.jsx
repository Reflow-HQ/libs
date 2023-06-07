import React from "react";
import CartView, { useCart } from "@reflowhq/cart-react";
import useAuth from "@reflowhq/auth-react";
import "@reflowhq/cart-react/dist/style.css";

const config = {
  storeID: "267418190"
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
          id="add-product-1"
          className="btn btn-primary me-2"
          onClick={() => cart.addProduct({ id: "108661429" })}
        >
          Add Product 1
        </div>
        <div
          id="add-product-2"
          className="btn btn-primary"
          onClick={() => cart.addProduct({ id: "277093884" })}
        >
          Add Product 2
        </div>
      </div>
    </div>
  );
}

export default App;
