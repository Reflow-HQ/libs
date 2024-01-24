# Reflow Auth-React

This is a React hook which you can use to add user accounts and authentication to any app using [Reflow](https://reflowhq.com/docs/store-management/registrations.html). It is compatible with React 18+ and builds upon the [vanilla Auth](https://github.com/reflow-hq/libs/tree/master/auth) library.

The hook handles event syncing between open tabs and automatically syncs user information with the Reflow backend, making it a robust auth solution for frontend apps.

## Installation

To install this hook in your react project:

```bash
npm install @reflowhq/auth-react
```

## Usage

This library is designed to run in the browser. Just import the hook and pass your storeID, which you can obtain from Reflow's website:

```js
const auth = useAuth({ storeID: 12345678 });
```

Full example:

```jsx
import React, { useState } from "react";
import useAuth from "@reflowhq/auth-react";

function MyComponent() {
  const auth = useAuth({ storeID: 12345678 });

  if (auth.isSignedIn()) {
    return (
      <div>
        <p>Hello, {auth.user.name}!</p>
        <button
          onClick={() => {
            auth.signOut();
          }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => {
          auth.signIn();
        }}
      >
        Sign In
      </button>
    </div>
  );
}
```

You can see a full featured example in the [examples](https://github.com/reflow-hq/libs/tree/master/auth-react/examples) directory and in a [live editor](https://codesandbox.io/s/react-reflow-auth-6pcmg5). You can also browse the test directory or read the source.

## API

Calling the `useAuth` hook returns an object with several methods.

### `auth.user`

A getter which returns an object with user information or null if not logged in.

```js
console.log(auth.user);

/*
{
  "object": "user",
  "id": 123456789,
  "name": "John Doe",
  "email": "john@example.com",
  "photo": "https://cdn.reflowhq.com/media/123456789/profiles/abc123456789.jpeg",
  "provider": "google",
  "meta": {
    "exampleSetting": false
  },
  "created_at": 1674924409
}
*/
```

### `auth.updateUser( options )`

An async method which you can use to update the user information for the currently logged in user.

`options` should have one or more of the following keys

- name - pass a new name to change the user's name
- email - pass a new email address to replace the current one. Needs to be a valid email address otherwise the method will throw.
- photo - a [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) or a [File](https://developer.mozilla.org/en-US/docs/Web/API/File) object that will be uploaded to the server as a profile photo.
- meta - this is an object with key/value pairs that will be stored in the user's data object. The keys that you pass will be merged with the existing meta keys in the user data. There is a 20kb limit on the total size of this field. It is suitable for mall pieces of data like app settings or preferences.

```js
let result = await auth.updateUser({
  name: "John Smith",
  email: "js@example.com",
  photo: document.querySelector("#photo-input").files[0],
  meta: { darkMode: true },
});

console.log(result);

/*
{
  "success": true, 
  "user": {
    "object": "user",
    "id": 123456789,
    "name": "John Smith",
    "email": "js@example.com",
    "photo": "https://cdn.reflowhq.com/media/123456789/profiles/abc123456789.jpeg",
    "provider": "google",
    "meta": {
      "darkMode": true
    },
    "created_at": 1674924409
  }
}
*/
```

See a [live example](https://codesandbox.io/s/react-reflow-auth-update-yzw2nq) which you can edit in your browser.

### `auth.isNew()`

Returns a boolean indicating whether the current user account is newly registered. You can use it as a condition for showing tutorials and walkthroughs. The flag is stored in the browser's sessionStorage, and will be reset at the end of the session automatically.

```js
console.log(auth.isNew());
// true
```

### `auth.isSignedIn()`

Returns a boolean indicating whether the current user is signed in.

```js
console.log(auth.isSignedIn());
// false
```

### `auth.signIn()`

Triggers the sign in flow. The user is presented with a popup window with social sign-in buttons. You can configure the available buttons and their order on the [Reflow](https://reflowhq.com/) settings screen.

```js
auth.signIn();
```

After a successful sign in, session and user info are stored in localStorage. Clearing localStorage has the effect of signing the user out.

### `auth.signOut()`

Signs out the current user and clears locally stored session data.

```js
auth.signOut();
```

### `auth.refresh()`

After a successful sign in, session and user info are stored in localStorage. This speeds up UI updates and enables the application to work offline.

However, data can become out of sync with Reflow. For this reason the library automatically updates the user info every 5 minutes. If you wish to sync manually, call the refresh method.

```js
auth.refresh();
```

### `auth.getToken()`

Async method which resolves to a signed JWT containing user info. Pass it to your server in order to validate the request on the backend.

```js
await auth.getToken();
```

### `auth.createSubscription( options )`

This method initiates the [subscription flow](https://reflowhq.com/docs/guide/subscriptions-how#subscription-flow). It is called with an ID of the price which the customer is to be subscribed to. This will open a window with a Stripe or Paddle payment page where the customer can enter their payment details and finalize their subscription.

If the user is not signed in when this method is called, they will be prompted to sign in first, and will then proceed to payment.

`options` is an object which must contain a `priceID` key, which you can obtain by using the [Reflow API](https://reflowhq.com/docs/api/). In the options you can also select which payment provider to be used for handling the subscription (`stripe` or `paddle`).

```js
async auth.createSubscription({
  priceID: "123456789",
  paymentProvider: "stripe"
});
```

See a [live example](https://codesandbox.io/s/react-reflow-pricing-table-3kdc6l), which demonstrates how to build a pricing page with monthly/yearly switch and initiating a subscription.

### `auth.modifySubscription()`

This method lets users modify their subscription. When called, it will open a window where the customer can upgrade to another subscription plan, switch between monthly and yearly billing (if you have this configured), and update their payment method and billing info.

This method only works if the user is signed in and has a subscription.

```js
async auth.modifySubscription();
```

See a [live example](https://codesandbox.io/s/react-reflow-pricing-table-3kdc6l), which demonstrates how to build a pricing page with monthly/yearly switch, initiate and modify a subscription.

### `auth.isSubscribed()`

This method will return true or false depending on whether the currently signed in user has an active subscription for your store.

```js
auth.isSubscribed();
```

## Test Mode

With Reflow's [test mode](https://reflowhq.com/docs/guide/test-mode) you can try out your store integration without making actual payments. The test mode provides a separate environment that supports all of the available features from live mode, without the risk of accidentally making a payment with real money.

To enable test mode, just add `testMode: true` to the config object:

```js
import useAuth from "@reflowhq/auth-react";

function MyComponent() {
  const auth = useAuth({ storeID: "<your storeid here>", testMode: true });
  // ...
}
```

While testMode is active, user registrations will be recorded in the "Test mode" section of your Reflow store, and payments will be made with Paddle's Sandbox and Stripe's test credit card info.

## License

Released under the MIT license.
