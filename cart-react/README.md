# Reflow CartView

This is a React 18+ component for rendering a Reflow shopping cart in your application.

## Installation

Install it in your project with npm or another package manager:

```bash
npm install @reflowhq/cart-react
```

## Usage

This library is meant to run in the browser. Just import the hook and pass your projectID, which can be found in the Reflow dashboard [settings page](https://reflowhq.com/project/settings):

### `useCart(config)`

```js
import { useCart } from "@reflowhq/cart-react";
import localization from "./localization.json";

const config = {
  projectID: "1234",
  localization,
};

function App() {
  const cart = useCart(config);
  ...
}
```

The `config` can have the following keys:

| Prop           | Type      | Required | Description                                                                    |
| -------------- | --------- | -------- | ------------------------------------------------------------------------------ |
| `projectID`    | _string_  | _Yes_    | The `id` of your Reflow project.                                               |
| `localization` | _object_  | _No_     | An object consisting of key/value pairs. [Learn more](#localization).          |
| `testMode`     | _boolean_ | _No_     | Determines whether the cart should run in test mode. [Learn more](#test-mode). |

The `cart` object the hook returns contains the current [cart state](#cart-state) and a lot of useful [functions](#reflow-api).

### `<CartView/>`

Renders a two-step shopping cart - Overview and Checkout.

```js
import CartView, { useCart } from "@reflowhq/cart-react";
import useAuth from "@reflowhq/auth-react";
import "@reflowhq/cart-react/dist/style.css";

const config = {
  projectID: "1234",
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

#### Props

| Prop         | Type       | Required | Description                                                                                                                                                   |
| ------------ | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cart`       | _object_   | _Yes_    | The result of calling the `useCart` hook.                                                                                                                     |
| `auth`       | _object_   | _No_     | The result of calling the `useAuth` hook from `@reflowhq/auth-react`.                                                                                         |
| `successURL` | _string_   | _No_     | The URL where the customer will be redirected after a successful payment.                                                                                     |
| `cancelURL`  | _string_   | _No_     | The URL where the customer will be redirected after a failed or canceled payment.                                                                             |
| `onMessage`  | _function_ | _No_     | Called when the component produces any messages that should be shown to the customer. Returns a `message` object with `type`, `title` and `description` keys. |

You can see a full featured example in the [examples](https://github.com/reflow-hq/libs/tree/master/cart-react/examples) directory.

### `<AddToCart/>`

Renders controls for variant selection, personalization options, a quantity widget and a button that adds the product to the cart.

```js
import { useState, useEffect } from "react";
import { AddToCart, useCart } from "@reflowhq/cart-react";
import "@reflowhq/cart-react/dist/style.css";

const config = {
  projectID: "1234",
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
    <div>
      {products.map((product) => (
        <AddToCart
          key={product.id}
          cart={cart}
          product={product}
          onMessage={(message) => {
            alert(message.title);
          }}
        />
      ))}
    </div>
  );
}
```

#### Props

| Prop                  | Type       | Required | Description                                                                                                                                                   |
| --------------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cart`                | _object_   | _Yes_    | The result of calling the `useCart` hook.                                                                                                                     |
| `product`             | _object_   | _Yes_    |                                                                                                                                                               |
| `buttonText`          | _string_   | _No_     | Redefines the "Add to Cart" button text, if set.                                                                                                              |
| `showQuantity`        | _boolean_  | _No_     | Whether the component should display the quantity widget.                                                                                                     |
| `showPersonalization` | _boolean_  | _No_     | Whether the component should display the product personalization options.                                                                                     |
| `onMessage`           | _function_ | _No_     | Called when the component produces any messages that should be shown to the customer. Returns a `message` object with `type`, `title` and `description` keys. |
| `onVariantSelect`     | _function_ | _No_     | Called when a different variant is selected for purchase. Returns a `variant` object containing all properties of the newly selected variant.                 |

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
| `footerLinks`        | _array_   | An array of the links to terms of service/privacy/refund policy that are configured in the Reflow project's settings.         |
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
| `quantity`           | _number_  | The total number of products currently in the cart, taking into account quantity.                                             |
| `errors`             | _array_   | An array of objects describing the errors encountered. Includes error type, severity, message.                                |

### Reflow API

### `cart.refresh()`

Updates the cart state with fresh data. If a cart has not yet been created, it creates a new cart.

### `cart.addProduct(options, quantity)`

Adds a new product to the cart.

`options` can have the following keys:

| Prop              | Required | Description                                                                          |
| ----------------- | -------- | ------------------------------------------------------------------------------------ |
| `id`              | _Yes_    | The `id` of the product you want to add to the cart.                                 |
| `variantID`       | _No\*_   | The id of the selected product variant (\* **required if the product has variants**) |
| `personalization` | _No_     | An array of objects describing the applied personalizations.                         |

Each `personalization` object can have the following props:

| Prop        | Required | Description                                                                                                                                                                                                            |
| ----------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | _Yes_    | The personalization id.                                                                                                                                                                                                |
| `inputText` | _No_     | The personalization text (for personalizations of type `"text"`).                                                                                                                                                      |
| `selected`  | _No_     | The selected value from the personalization dropdown (for personalizations of type `"dropdown"`).                                                                                                                      |
| `file`      | _No_     | A [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) or a [File](https://developer.mozilla.org/en-US/docs/Web/API/File) object that will be uploaded to the server (for personalizations of type `"file"`). |

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
let result = await cart.removeDiscountCode({ code: "1234" });

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

| Prop             | Required | Possible Values                                                                                                                                                                                                                         |
| ---------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `address`        | _Yes_    | object                                                                                                                                                                                                                                  |
| `deliveryMethod` | _Yes_    | `'shipping'`, `'pickup'`, `'digital'`                                                                                                                                                                                                   |
| `exemptionType`  | _Yes_    | `'tax-exemption-file'` or `'tax-exemption-text'`                                                                                                                                                                                        |
| `exemptionValue` | _Yes_    | a [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) or a [File](https://developer.mozilla.org/en-US/docs/Web/API/File) object that will be uploaded to the server (jpg, jpeg, png, pdf, doc, docx) or a string (VAT number) |

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
| `payment-method`    | _Yes_    | `'stripe'`, `'custom'`, `'pay-in-store'`, `'zero-value-cart'` | The payment method that will be used for completing the checkout.                             |
| `payment-id`        | _No\*_   | _string_                                                      | The `id` of the payment method. \* Required if the payment method is `'custom'`.              |
| `email`             | _Yes_    | _string_                                                      |                                                                                               |
| `phone`             | _No_     | _string_                                                      |                                                                                               |
| `customer-name`     | _No_     | _string_                                                      |                                                                                               |
| `delivery-method`   | _Yes_    | `'shipping'`, `'pickup'`, `'digital'`                         |                                                                                               |
| `store-location`    | _No\*_   | _number_                                                      | The index of the selected pickup location. \* Required if the delivery method is `'pickup'`   |
| `shipping-method`   | _No\*_   | _number_                                                      | The index of the selected shipping method. \* Required if the delivery method is `'shipping'` |
| `note-to-seller`    | _No_     | _string_                                                      |                                                                                               |
| `auth-account-id`   | _No_     | _number_                                                      | The user `id`. \* If Reflow user auth is enabled and a user is signed in in.                  |
| `auth-save-address` | _No_     | _boolean_                                                     |                                                                                               |

## Localization

To translate this toolkit, you need to pass a localization object to the `useCart` hook. This will change the entire user interface of Reflow components, including labels, text prompts and error messages. Example:

```js
import localization from "./localization.json";

const cart = useCart({
  projectID: "1234",
  localization,
});
```

To create a translation, **follow these steps:**

1. Download the [en-US.json](https://cdn.reflowhq.com/v2/en-US.json) file. This is Reflow's default language file. You will use it as a starting point.
2. Translate some or all of the phrases to your language of choice. This is covered in the next section.
3. Save the translation file somewhere in your project.
4. Import it and pass it to the `useCart` hook.
5. Check your browser's console for any error messages that may point you to potential problems with your translation.

### Translation File Format

The translation file is a simple JSON consisting of key/value pairs. The process of translating Reflow consists of rewriting the values to your language of choice.

```json
// The default en-US.json in English
{
  "locale": "en-US",

  "shopping_cart": "Shopping Cart",
  "product": "Product",
  ...
}
```

```json
// A localized example in French
{
  "locale": "fr-FR",

  "shopping_cart": "Panier",
  "product": "Produit",
  ...
}
```

### Instructions

- The keys should not be changed. They are used by the library for matching UI elements with their localized text.
- The values represent the actual content that is visible in the UI. They should be replaced with the translation in the chosen language.
- All lines in the JSON (except for the `locale` property) are optional. You can omit the lines you don't wish to translate. In that case the default English equivalent will be used.
- The `locale` line is special. It only accepts a standard ISO country-language tag. This is the locale used for formatting prices and dates, among other things.

### Message Format

The values in the JSON follow the standardized [ICU message format](https://unicode-org.github.io/icu/userguide/format_parse/messages/). You can learn more about the message format [here](https://reflowhq.com/docs/html-toolkit/localization#message-format).

### Translating Countries and Regions

In some cases the `CartView` component can display select inputs for customers to choose their country and region (e.g. for shipping address). By default all the countries and their regions names are shown in English.

These can be translated by adding the `geo` property to the localization JSON. In it, you can define what names should be displayed for the countries and regions you wish to translate. Here is an example:

```json
"geo": {
  "BE": {
    "country_name": "Belgique",
  },
  "DE": {
    "country_name": "Allemagne",
  },
  "CA": {
    "country_name": "Canada",
    "regions": {
      "AB": "Alberta",
      "BC": "Colombie-Britannique",
      "MB": "Manitoba",
      "NB": "Nouveau-Brunswick",
      "NL": "Terre-Neuve-et-Labrador",
      "NT": "Territoires du Nord-Ouest",
      "NS": "Nouvelle-Écosse",
      "NU": "Nunavut",
      "ON": "Ontario",
      "PE": "île du Prince-Édouard",
      "QC": "Québec",
      "SK": "Saskatchewan",
      "YT": "Yukon"
    }
  },
}
```

We recommend [downloading our example file](https://reflowhq.com/locale_regions_example_en-US.json) for the geo property in English. You can then remove the countries that are unnecessary for you store, translate the ones you need and move them to your localization file under the `geo` property.

### Local Currency

Reflow supports a wide array of currencies that can be used for everything in your store, including product prices and shipping costs. You can change the currency of your project from the [general settings](https://reflowhq.com/project/settings) page.

For a full list of available currencies visit the [Currency Support docs](https://reflowhq.com/docs/guide/currency-support).

## Test Mode

With Reflow's [test mode](https://reflowhq.com/docs/guide/test-mode) you can try out your integration without making actual payments. The test mode provides a separate environment that supports all of the available features from live mode, without the risk of accidentally making a payment with real money.

To enable test mode, just add `testMode: true` to the config object:

```js
import { useCart } from "@reflowhq/cart-react";

const config = {
  projectID: "1234",
  testMode: true,
};

function App() {
  const cart = useCart(config);
  // ...
}
```

While testMode is active, orders will be recorded in the "Test mode" section of your Reflow project, and payments will be made with PayPal's Sandbox and Stripe's test credit card info.

## License

Released under the MIT license.
