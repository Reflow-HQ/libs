# Reflow Cart

This is a JS library for adding a shopping cart to any frontend using [Reflow](https://reflowhq.com/docs/). It is written in vanilla JS and can work in any project and framework. For React projects, you can check out [the React Shopping Cart component](https://github.com/reflow-hq/libs/tree/master/cart-react).

## Installation

```bash
npm install @reflowhq/cart
```

## Usage

This library is meant to run in the browser. The recommended way to use it is to create an instance and assign it to the window object so that it is available globally. You can find your storeID on your Reflow admin page.

```js
import Cart from "@reflowhq/cart";

window.cart = new Cart({ storeID: "<your storeid here>" });
```

## API

The cart instance gives you access to a number of properties and methods for managing the current shopping cart.

### `cart.state`

A getter which returns an object with cart information.

```js
console.log(cart.state);

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

## Localization

To translate this toolkit, you need to pass a localization object in the config object. This will change the entire user interface of Reflow components, including labels, text prompts and error messages. Example:

```js
import localization from "./localization.json";

const cart = new Cart({
  storeID: "1234",
  localization,
});
```

To create a translation, **follow these steps:**

1. Download the [en-US.json](https://cdn.reflowhq.com/v2/en-US.json) file. This is Reflow's default language file. You will use it as a starting point.
2. Translate some or all of the phrases to your language of choice. This is covered in the next section.
3. Save the translation file somewhere in your project.
4. Import it and add it to the Cart config object.
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

Reflow supports a wide array of currencies that can be used for everything in your store, including product prices and shipping costs. You can change the currency of your store from the [general settings](https://reflowhq.com/store/settings) page.

For a full list of available currencies visit the [Currency Support docs](https://reflowhq.com/docs/guide/currency-support).

## Test Mode

With Reflow's test mode you can try out your store integration without making actual payments. The test mode provides a separate environment that supports all of the available features from live mode, without the risk of accidentally making a payment with real money.

To enable test mode, just add `testMode: true` to the config object:

```js
import Cart from "@reflowhq/cart";

window.cart = new Cart({ storeID: "<your storeid here>", testMode: true });
```

## License

Released under the MIT license.
