# Reflow Auth

This is a JS library for adding user accounts to any frontend using [Reflow](https://reflowhq.com/docs/store-management/registrations.html). It is written in vanilla JS and can work in any project and framework. For React projects, you can check out [the hook](https://github.com/reflow-hq/libs/tree/master/auth-react) version of this library.

## Installation

If you've configured sign in providers in your Reflow project, this library makes it super simple for users to authenticate in your app. You just need to install it in your project with npm or another package manager:

```bash
npm install @reflowhq/auth
```

## Usage

This library is meant to run in the browser. The recommended way to use it is to create an instance and assign it to the window object so that it is available globally. You can find your projectID in the dashboard [settings page](https://reflowhq.com/project/settings).

```js
import Auth from "@reflowhq/auth";

window.auth = new Auth({ projectID: "<your project id here>" });
```

You can see a full featured example in the [examples](https://github.com/reflow-hq/libs/tree/master/auth/examples) directory.

## API

The auth instance gives you access to a number of properties and methods for managing the user account of the current user.

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
- meta - this is an object with key/value pairs that will be stored in the user's object. The keys that you pass will be merged with the existing meta keys in the user info. There is a 20kb limit on the total size of this field. It is suitable for mall pieces of data like app settings or preferences.

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

However, data can become out of sync with Reflow. For this reason the library automatically updates the user data every 5 minutes. If you wish to sync manually, call the refresh method.

```js
auth.refresh();
```

### `auth.getToken()`

Async method which resolves to a signed JWT containing user info. Pass it to your server in order to validate the request on the backend. See `examples/express-signin` to see an example.

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

### `auth.modifySubscription()`

This method lets users modify their subscription. When called, it will open a window where the customer can upgrade to another subscription plan, switch between monthly and yearly billing (if you have this configured), and update their payment method and billing info.

This method only works if the user is signed in and has a subscription.

```js
async auth.modifySubscription();
```

### `auth.isSubscribed()`

This method will return true or false depending on whether the currently signed in user has an active subscription for your project.

```js
auth.isSubscribed();
```

## Events

The library implements a simplified event system which you can subscribe to. It works only for a single event type at a time (you can't subscribe for multiple events or add namespaces).

Note that the library handles cross-tab communication and syncs with the Reflow backend periodically, so these events may not necessarily originate in the current tab or device.

### `signin`

This event is triggered when the user signs in successfully.

```js
auth.on("signin", (user) => {
  if (auth.isNew()) {
    alert("Great to meet you, " + user.name + "!");
  } else {
    alert("Hello again, " + user.name + "!");
  }
});
```

### `signout`

This event is triggered when the user signs out from their account.

```js
auth.on("signout", () => {
  alert("Goodbye!");
});
```

### `modify`

This event is triggered when the user info is edited with the updateUser method or from the Reflow backend.

```js
auth.on("modify", () => {
  console.log("the user was modified!");
});
```

### `change`

This event is triggered in all cases that can lead to a change in the authentication status or info:

- The user signs in or out of their account.
- The user is edited with the updateUser method.
- The user signs up for a subscription plan or modifies the plan they are on.
- The user has been edited in the Reflow backend.

You can use it to trigger updates to your application's UI state.

```js
auth.on("change", () => {
  console.log("a change occurred!");
});
```

### Unsubscribing from events

The library exposes a corresponding `off` method. You need to pass the same callback which you used to subscribe.

```js
const changeCb = () => console.log("a change occurred!");

auth.on("change", changeCb);

// Unsubscribe

auth.off("change", changeCb);
```

## Test Mode

With Reflow's [test mode](https://reflowhq.com/docs/guide/test-mode) you can try out your integration without making actual payments. The test mode provides a separate environment that supports all of the available features from live mode, without the risk of accidentally making a payment with real money.

To enable test mode, just add `testMode: true` to the config object:

```js
import Auth from "@reflowhq/auth";

window.auth = new Auth({ storeID: "<your storeid here>", testMode: true });
```

While testMode is active, user registrations will be recorded in the "Test mode" section of your Reflow project, and payments will be made with Paddle's Sandbox and Stripe's test credit card info.

## License

Released under the MIT license.
