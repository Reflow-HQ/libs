import React, { useState, useEffect } from "react";
import { useCart, AddToCart } from "@reflowhq/cart-react";
import "@reflowhq/cart-react/dist/style.css";

const config = {
  storeID: "267418190",
};

function App() {
  const cart = useCart(config);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch(`https://api.reflowhq.com/v2/stores/${config.storeID}/products/`)
      .then((response) => response.json())
      .then((r) => setProducts(r.data))
      .catch((error) => console.error(error));
  }, []);

  return (
    <div className="container my-5">
      {products.map((product) => (
        <div key={product.id} className="row mb-5">
          <div
            className="col-12 col-md-4"
            style={{
              height: "300px",
              background: `url(${product.image.md})`,
              backgroundSize: "cover",
              backgroundPosition: "center center",
            }}
          ></div>
          <div className="col-12 col-md-8 mt-4 mt-md-0 px-md-4">
            <div className="mb-3">
              <h4>{product.name}</h4>
              <strong>{product.price_formatted}</strong>
            </div>
            <AddToCart
              cart={cart}
              product={product}
              onMessage={(message) => {
                alert(message.title);
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default App;
