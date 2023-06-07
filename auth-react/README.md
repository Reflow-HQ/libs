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

You can see a full featured example in the [examples](https://github.com/reflow-hq/libs/tree/master/auth-react/examples) directory. You can also browse the test directory or read the source directly, it's only 50 lines long.

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

## License

Released under the MIT license.
