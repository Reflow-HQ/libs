# Reflow Auth-Next

This is a library for adding user accounts and subscriptions to any Next.js app using [Reflow](https://reflowhq.com/docs/store-management/registrations.html).

## Main Features

- Adds user accounts (both username+password and social sign in), authorization and subscriptions (with Stripe or Paddle) to any Next.js project.
- Can be used to restrict access and enforce limits with feature flags and rate limits.
- Works on both the Node.js and Edge runtimes.
- Stores session data in a securely encrypted http-only cookie.
- Can be used as a general Next.js session library for storing arbitrary data, so it replaces iron-session and others.
- Works in both client and server components.
- Simple to setup and integrate.

## Installation

The library is compatible with all Next.js projects running Next.js 13 and up. It works with both the App Router and Pages Router.

You can install it using npm or another package manager of your choice.

```bash
npm install @reflowhq/auth-next
```

## Documentation

You can find the full Reflow Auth Next documentation [here](https://reflowhq.com/docs/libraries/auth/auth-next/).

Visit the [Getting Started](https://reflowhq.com/docs/libraries/auth/auth-next/getting-started/) guide for a quick overview.

All of the methods and class options are available in the [API reference](https://reflowhq.com/docs/libraries/auth/auth-next/api-reference/) docs.

For more details and advanced examples, you can check out:

- [Auth Next Example demo app](https://github.com/Reflow-HQ/auth-next-example)
- [Signing In a User](https://reflowhq.com/docs/libraries/auth/auth-next/sign-in/)
- [Signing Out a User](https://reflowhq.com/docs/libraries/auth/auth-next/sign-out/)
- [Adding Subscriptions](https://reflowhq.com/docs/libraries/auth/auth-next/add-subscriptions/)
- [Cookie Session Management](https://reflowhq.com/docs/libraries/auth/auth-next/cookie-session-management/)

We also post full tutorials on the [Reflow blog](https://reflowhq.com/learn/).

## License

Released under the MIT license. (c) Reflow HQ
