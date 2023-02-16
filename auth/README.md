# Reflow Auth

This is a JS library for adding user accounts to any frontend using [Reflow](https://reflowhq.com). It is written in vanilla JS and can work in any project and framework.

## Installation

If you've configured sign in providers in your Reflow Store, this library makes it super simple for users to authanticate in your app. Then you need to install it in your project with your package manager of choice.

```bash
npm install @reflowhq/auth
````

## Usage

This library is meant to run in the browser. The recommended way to use it is to create an instance and assign it to the window object so it is available globally. Only one cart instance should exist at a given time.

```js
import Auth from "@reflowhq/auth";

window.auth = new Auth({storeID: '<your storeid here>'});
```

You can then use a number of methods for signing in/out and managing the user account:

```js

await window.auth.signIn({...})

// TODO

```