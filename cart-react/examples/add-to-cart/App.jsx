import React, { useState, useEffect } from "react";
import { useCart } from "@reflowhq/cart-react";
import "@reflowhq/cart-react/dist/style.css";
import Product from "./Product";

const config = {
  projectID: "267418190",
};

function App() {
  const cart = useCart(config);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    fetch(`https://api.reflowhq.com/v2/projects/${config.projectID}/products/`)
      .then((response) => response.json())
      .then((r) => setProducts(r.data))
      .catch((error) => console.error(error));
  }, []);

  return (
    <div className="container my-5">
      {products.map((product) => <Product product={product} cart={cart} key={product.id} />)}
    </div>
  );
}

export default App;
