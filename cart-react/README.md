# Reflow CartView

This is a React 18+ component for rendering a Reflow shopping cart in your application.

## Installation

Install it in your project with npm or another package manager:

```bash
npm install @reflowhq/cart-react
```

## Usage

This library is meant to run in the browser. Just import the hook and pass your storeID, which you can obtain from Reflow's website:

```js
import CartView, { useCart } from "@reflowhq/cart-react";
import useAuth from "@reflowhq/auth-react";
import "@reflowhq/cart-react/src/cartview.css";

const config = {
  storeID: "1234",
};

function App() {
  const auth = useAuth(config);
  const cart = useCart(config);

  return (
    <div>
      <CartView
        cart={cart}
        auth={auth}
        successURL={"https://example.com/success"}
        cancelURL={"https://example.com/cancel"}
        onMessage={(message) => {
          console.log(message.type, message.title, message.description);
        }}
      />
      <button onClick={() => cart.addProduct({ id: "5678" })}>Add to cart</button>
    </div>
  );
}
```

You can see a full featured example in the [examples](https://github.com/reflow-hq/libs/tree/master/cart-react/examples) directory.

## API

Calling the `useCart` hook returns an object containing the current cart state as well as methods for managing it.

```js
const cart = useCart(config);
console.log(cart);

/*
{
  "isLoaded": true,
  "isUnavailable": false,
  "products": [],
  "locations": [],
  ...
}
*/
```

### Cart state

| Prop                 | Type      | Description                                                                                                                   |
| -------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `isLoaded`           | _boolean_ | _True_ if the cart has been fetched.                                                                                          |
| `isUnavailable`      | _boolean_ | _True_ if there were issues while fetching the cart.                                                                          |
| `vacationMode`       | _object_  | Includes a boolean status and a message if the store is in vacation mode.                                                     |
| `products`           | _array_   | The line items currently in the shopping cart.                                                                                |
| `footerLinks`        | _array_   | An array of the links to terms of service/privacy/refund policy that are configured in the Reflow store's settings.           |
| `signInProviders`    | _array_   | An array of the configured payment providers e.g. "facebook", "google", etc.                                                  |
| `paymentProviders`   | _array_   | An array of objects describing the configured payment providers e.g. Paypal, Stripe, etc.                                     |
| `currency`           | _string_  | The cart currency.                                                                                                            |
| `subtotal`           | _number_  | The cart subtotal. Use `cart.formatCurrency(subtotal)` to format the price.                                                   |
| `total`              | _number_  | The cart total. Use `cart.formatCurrency(total)` to format the price.                                                         |
| `discount`           | _number_  | The cart discount. Use `cart.formatCurrency(discount)` to format the price.                                                   |
| `coupon`             | _object_  | An object describing the coupon applied to the cart or `null`. Includes the coupon name, code, discount amount, etc.          |
| `giftCard`           | _object_  | An object describing the gift card applied to the cart or `null`. Includes the gift card code, discount amount, balance, etc. |
| `taxes`              | _object_  | An object describing the taxes applicable to the order or `null`. Includes the tax amount, as well as tax exemption details.  |
| `taxExemption`       | _object_  | An object describing the applied tax exemption.                                                                               |
| `locations`          | _array_   | The available pickup locations.                                                                                               |
| `shippingMethods`    | _array_   | The available shipping methods for the provided shipping address.                                                             |
| `shippableCountries` | _array_   | The countries the items in the cart can be shipped to.                                                                        |
| `shippingAddress`    | _object_  | The shipping address entered by the user.                                                                                     |
| `errors`             | _array_   | An array of objects describing the errors encountered. Includes error type, severity, message.                                |

### Reflow API

### `cart.refresh()`

Updates the cart state with fresh data. If a cart has not yet been created, it creates a new cart.

### `cart.addProduct(options, quantity)`

Adds a new product to the cart.

`options` can have the following keys:

| Prop              | Required | Description                                                                                              |
| ----------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `id`              | _Yes_    | The `id` of the product you want to add to the cart.                                                     |
| `variantID`       | _No\*_   | The id of the selected product variant (\* **required if the product has variants**)                     |
| `personalization` | _No_     | An array of objects describing the applied personalizations.                                             |
| `files`           | _No_     | An array of objects describing the files that need to be uploaded for personalizations of type `"file"`. |

Each `personalization` object can have the following props:

| Prop        | Required | Description                                                                                       |
| ----------- | -------- | ------------------------------------------------------------------------------------------------- |
| `id`        | _Yes_    | The personalization id.                                                                           |
| `inputText` | _No_     | The personalization text (for personalizations of type `"text"`).                                 |
| `selected`  | _No_     | The selected value from the personalization dropdown (for personalizations of type `"dropdown"`). |
| `filename`  | _No_     | The name of the uploaded file (for personalizations of type `"file"`).                            |
| `filehash`  | _No_     | //TODO (for personalizations of type `"file"`).                                                   |

Each `file` object can have the following props:

| Prop   | Required | Description                                                                                                                                                                    |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `hash` | _Yes_    | //TODO                                                                                                                                                                         |
| `file` | _Yes_    | A [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) or a [File](https://developer.mozilla.org/en-US/docs/Web/API/File) object that will be uploaded to the server. |

```js
let result = await cart.addProduct(
  {
    id: "1234",
    variantID: "1234_m",
    personalization: [
      {
        id: "1234_engraving",
        inputText: "Hello World",
      },
      {
        id: "1234_gift_wrap",
      },
    ],
  },
  2
);

console.log(result);

/*
{
    "cartKey": <your-cart-key>
    "cartQuantity": 2,
    "success": true
}
*/
```

### `cart.updateLineItemQuantity(lineItemID, quantity)`

Updates the quantity of a line item in the cart.

```js
let result = await cart.updateLineItemQuantity(product.lineItemID, 3);

console.log(result);

/*
{
    "cartQuantity": 3,
    "success": true
}
*/
```

### `cart.removeLineItem(lineItemID)`

Removes a line item from the cart.

```js
let result = await cart.removeLineItem(product.lineItemID);

console.log(result);

/*
{
    "cartQuantity": 0,
    "success": true
}
*/
```

### `cart.applyDiscountCode({ code })`

Adds a coupon/gift card code to the cart.

```js
let result = await cart.applyDiscountCode({ code: "1234" });

console.log(result);

/*
{
    "type": "coupon",
    "success": true
}
*/
```

### `cart.removeDiscountCode({ code })`

Removes the coupon/gift card with the given code from the cart.

```js
let result = await cart.applyDiscountCode({ code: "1234" });

console.log(result);

/*
{
    "type": "coupon",
    "success": true
}
*/
```

### `cart.updateAddress({ address, deliveryMethod })`

Updates the shipping/digital address and fetches the contents of the Cart with updated tax regions, shipping methods, etc. taking into account the new address.

```js
let result = await cart.updateAddress({
  address: {
    name: "John Doe",
    address: {
      city: "New York",
      country: "US",
      postcode: "1234",
      state: "NY",
    },
  },
  deliveryMethod: "shipping",
});

console.log(result);

/*
{
    "success": true
}
*/
```

### `cart.updateTaxExemption({ address, deliveryMethod, exemptionType, exemptionValue })`

Updates the tax exemption.

- exemptionType - "tax-exemption-file" or "tax-exemption-text"
- exemptionValue - a [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) or a [File](https://developer.mozilla.org/en-US/docs/Web/API/File) object that will be uploaded to the server or a string (VAT number)

```js
let result = await cart.updateTaxExemption({
  address: {
    name: "John Doe",
    address: {
      city: "New York",
      country: "US",
      postcode: "1234",
      state: "NY",
    },
  },
  deliveryMethod: "shipping",
  exemptionType: "tax-exemption-text",
  exemptionValue: "1234",
});

console.log(result);

/*
{
    "success": true
}
*/
```

### `cart.removeTaxExemptionFile({ address, deliveryMethod, exemptionType, exemptionValue })`

Removes the applied tax exemption.

```js
let result = await cart.removeTaxExemptionFile();

console.log(result);

/*
{
    "success": true
}
*/
```

### `cart.checkout(data)`

`data` can have the following keys:

| Prop                | Required | Possible Values                                               | Description                                                                                   |
| ------------------- | -------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `success-url`       | _Yes_    | _URL_                                                         | The URL the user should be redirected to after a successful checkout.                         |
| `cancel-url`        | _Yes_    | _URL_                                                         | The URL where the customer will be redirected after a failed or cancelled payment.            |
| `payment-method`    | _Yes_    | `'stripe'`, `'custom'`, `'pay-in-store'`, `'zero-value-cart'` | The URL where the customer will be redirected after a failed or cancelled payment.            |
| `payment-id`        | _No\*_   | _string_                                                      | The `id` of the payment method. \* Required if the payment method is `'custom'`.              |
| `email`             |          | _string_                                                      |                                                                                               |
| `phone`             |          | _string_                                                      |                                                                                               |
| `customer-name`     |          | _string_                                                      |                                                                                               |
| `delivery-method`   | _Yes_    | `'shipping'`, `'pickup'`, `'digital'`                         |                                                                                               |
| `store-location`    | _No\*_   | _number_                                                      | The index of the selected pickup location. \* Required if the delivery method is `'pickup'`   |
| `shipping-method`   | _No\*_   | _number_                                                      | The index of the selected shipping method. \* Required if the delivery method is `'shipping'` |
| `note-to-seller`    | _No_     | _string_                                                      |                                                                                               |
| `auth-account-id`   | _No_     | _number_                                                      | The user `id`. \* If the store provides sign in methods and a user is logged in.              |
| `auth-save-address` | _No_     | _boolean_                                                     |                                                                                               |

### Additional methods

### `cart.getProducts()`

## License

Released under the MIT license.