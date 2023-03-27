# Reflow Cart

This is a JS library for adding user accounts to any frontend using [Reflow](https://reflowhq.com/docs/store-management/registrations.html). It is written in vanilla JS and can work in any project and framework. For React projects, you can check out [the hook](https://github.com/reflow-hq/reflow-libs/tree/main/auth-react) version of this library.

## Installation

If you've configured sign in providers in your Reflow Store, this library makes it super simple for users to authenticate in your app. You just need to install it in your project with npm or another package manager:

```bash
npm install @reflowhq/cart
```

## Usage

This library is meant to run in the browser. The recommended way to use it is to create an instance and assign it to the window object so that it is available globally. You can find your storeID on your Reflow admin page.

```js
import Cart from "@reflowhq/cart";

window.cart = new Cart({ storeID: "<your storeid here>" });
```

You can see a full featured example in the [examples](https://github.com/reflow-hq/reflow-libs/tree/main/auth/examples) directory.

## API

The auth instance gives you access to a number of properties and methods for managing the user account of the current user.

### `auth.profile`

A getter which returns an object with profile information or null if not logged in.

```js
console.log(auth.profile);

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

### `auth.updateProfile( options )`

An async method which you can use to update the profile information for the currently logged in user.

`options` should have one or more of the following keys

- name - pass a new name to change the user's name
- email - pass a new email address to replace the current one. Needs to be a valid email address otherwise the method will throw.
- photo - a [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) or a [File](https://developer.mozilla.org/en-US/docs/Web/API/File) object that will be uploaded to the server as a profile photo.
- meta - this is an object with key/value pairs that will be stored in the user's profile. The keys that you pass will be merged with the existing meta keys in the profile. There is a 20kb limit on the total size of this field. It is suitable for mall pieces of data like app settings or preferences.

```js
let result = await auth.updateProfile({
  name: "John Smith",
  email: "js@example.com",
  photo: document.querySelector("#photo-input").files[0],
  meta: { darkMode: true },
});

console.log(result);

/*
{
  "success": true, 
  "profile": {
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

After a successful sign in, session and profile info are stored in localStorage. Clearing localStorage has the effect of signing the user out.

### `auth.signOut()`

Signs out the current user and clears locally stored session data.

```js
auth.signOut();
```

### `auth.refresh()`

After a successful sign in, session and profile info are stored in localStorage. This speeds up UI updates and enables the application to work offline.

However, data can become out of sync with Reflow. For this reason the library automatically updates profile every 5 minutes. If you wish to sync the profile data manually, call the refresh method.

```js
auth.refresh();
```

## Events

The library implements a simplified event system which you can subscribe to. It works only for a single event type at a time (you can't subscribe for multiple events or add namespaces).

Note that the library handles cross-tab communication and syncs with the Reflow backend periodically, so these events may not necessarily originate in the current tab or device.

### `signin`

This event is triggered when the user signs in successfully.

```js
auth.on("signin", (profile) => {
  if (auth.isNew()) {
    alert("Great to meet you, " + profile.name + "!");
  } else {
    alert("Hello again, " + profile.name + "!");
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

This event is triggered when the user profile info is edited with the updateProfile method or from the Reflow backend.

```js
auth.on("modify", () => {
  console.log("the profile was modified!");
});
```

### `change`

This event is triggered in all cases that can lead to a change in the authentication status or info:

- The user signs in or out of their account.
- The user profile is edited with the updateProfile method.
- The profile has been edited in the Reflow backend.

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

## License

Released under the MIT license.
