# Reflow Auth-Next

This is a library which you can use to add user accounts and subscriptions to any Next.js app using [Reflow](https://reflowhq.com/docs/store-management/registrations.html). It requires Node 18+ and Next.js 13+

An example application can be seen on https://github.com/Reflow-HQ/auth-next-example

## Main Features

- Adds user accounts (both username+password and social sign in), authorization and subscriptions (with Stripe or Paddle) to any Next.js project.
- Can be used to restrict access and enforce limits with feature flags and rate limits.
- Works on both the Node.js and Edge runtimes.
- Stores session data in a securely encrypted http-only cookie.
- Can be used as a general Next.js session library for storing arbitrary data, so it replaces iron-session and others.
- Works in both client and server components.
- Simple to setup and integrate.

## Setup

As a prerequisite, make sure you have enabled at least one [Sign-in method](https://reflowhq.com/docs/guide/auth-overview) in your Reflow account. And, if you wish to add subscriptions to your Next app, you will need to define one or more [subscription plans](https://reflowhq.com/docs/guide/subscriptions-overview) and connect Stripe or Paddle.

The first step is to install this library in your Next.js 13+ project:

```bash
npm install @reflowhq/auth-next
```

Then you need to create the following two files.

### auth.ts

```typescript
import "server-only";
import { ReflowAuth } from "@reflowhq/auth-next";

export default function getAuth(): ReflowAuth {
  return new ReflowAuth({
    storeID: 123456,
    secret: "REPLACE_ME_WITH_A_32_CHAR_SECRET",
  });
}
```

This file imports and initializes the Reflow library. You will be importing this file in your server components in order to obtain a ReflowAuth instance. Remember to replace the `storeID` with the ID of your Reflow project (you can find in the dashboard [settings page](https://reflowhq.com/project/settings)), and to add a unique 32 character secret string. The latter is used for encrypting the session cookie.

Notes

- We are using TypeScript in our example, but you can easily convert this to JavaScript by removing the return type declaration, and changing the name to `auth.js`.
- The name of the file is arbitrary, you can even omit this file altogether, provided that you initialize ReflowAuth somehow.
- The ReflowAuth constructor [supports additional options](#reflowauth-class).
- You can generate a 32 char secret string with your password manager, or with a command like this (if you're on an unix-like OS): `openssl rand -hex 16`

### app/auth/route.ts

```typescript
import getAuth from "../../auth";

export async function POST(request: Request) {
  const auth = getAuth();
  return await auth.handleRequest(request);
}
```

This is the other file you need to create. It is a route handler which acts as the "glue" between the Reflow client functions and the server. Only the server has access to cookies and the session data.

Notes

- We assume that you use the app router which was introduced in Next.js 13. You can convert this file to JavaScript by removing the `request` type declaration and renaming it to `route.js`.
- The Reflow client functions are programmed to make fetch requests to `/auth` which is routed to the above file. You can rename or move this file under a different path if you pass an `authEndpoint` parameter to all client functions so they know where to locate it.

This is pretty much all the setup that's required. You can now use Reflow Auth in your Next.js project.

## Examples

The basic concept behind the Reflow Auth library for Next.js, is that

- **Server components** check for signin and subscription status and handle conditional rendering. They have access only to the auth object and its methods.
- **Client components** trigger actions like displaying a sign-in dialog, signing out or displaying a subscription prompt. They have access only to client-side functions.

The bridge between these two is the `app/auth/route.ts` file you created above. Client components issue fetch requests to that file and communicate with the backend.

A fully featured example application can be seen on https://github.com/Reflow-HQ/auth-next-example

### Displaying user data

Let's display a message with the logged in user's name and email. This is handled entirely on the server.

**app/page.tsx**

```tsx
import getAuth from "@/auth";

export default async function Page() {
  const auth = getAuth();
  const user = await auth.user();

  if (user) {
    return (
      <p>
        Hello, {user.name}. Your email is {user.email}
      </p>
    );
  }

  return <p>Please, sign in</p>;
}
```

First we import the `auth.ts` file we created earlier in order to use the `getAuth()` function and obtain an auth instance. Then we retrieve the logged-in user's data. You can see all available data on the User object [in the Docs section](#async-user-promiseuser--null).

### User Sign-in

User sign-in and sign-out can be done only on the client side. For our example, we will define a `LoginButton` client component (full example [here](https://github.com/Reflow-HQ/auth-next-example/blob/master/app/components/LoginButton.tsx)).

**app/components/LoginButton.tsx**

```typescript
"use client";

import { signIn } from "@reflowhq/auth-next/client";

export default function LoginButton() {
  return (
    <button onClick={() => signIn({ onSuccess: () => location.reload() })}>
      Sign-in to your account
    </button>
  );
}
```

Here we import the client `signIn` method (notice that we import from `@reflowhq/auth-next/client`), and `onSuccess` just reload the page. In a real app you may wish to do something more sophisticated.

This component can then be added to the page on the server:

**app/page.tsx**

```tsx
import getAuth from "@/auth";
import LoginButton from "./components/LoginButton";

export default async function Page() {
  const auth = getAuth();
  const user = await auth.user();

  if (user) {
    return <p>Hello, {user.name}.</p>;
  }

  return <LoginButton />;
}
```

#### Intercepting sign in

You can intercept the sign in process by passing an `beforeSignin` callback when creating a `ReflowAuth` instance:

```typescript
import "server-only";
import { ReflowAuth } from "@reflowhq/auth-next";
import type { User } from "@reflowhq/auth-next/types";

export default function getAuth(): ReflowAuth {
  return new ReflowAuth({
    storeID: 123456,
    secret: "REPLACE_ME_WITH_A_32_CHAR_SECRET",
    beforeSignin: async (user: User) => {
      // Create database records, validate permissions, send emails etc..
      // Return true to allow the user to sign in
      return true;

      // To prevent the sign-in:
      // return false;
    },
  });
}
```

The `beforeSignin` callback takes a [User object](#async-user-promiseuser--null) as a parameter. The callback is useful for performing actions every time a user signs in or if you need to prevent the sign in altogether. To prevent the user from logging in you can just return `false` in your `beforeSignin` callback.

### User Sign-out

By analogy to the above example, we will create a LogoutButton component (full example [here](https://github.com/Reflow-HQ/auth-next-example/blob/master/app/components/LogoutButton.tsx)).

**app/components/LogoutButton.tsx**

```tsx
"use client";

import { signOut } from "@reflowhq/auth-next/client";

export default function LogoutButton() {
  return <button onClick={() => signOut({ onSuccess: () => location.reload() })}>Sign-out</button>;
}
```

This time we import the signOut method from from `@reflowhq/auth-next/client`.

This component can then be added to the page on the server:

**app/page.tsx**

```tsx
import getAuth from "@/auth";
import LoginButton from "./components/LoginButton";
import LogoutButton from "./components/LogoutButton";

export default async function Page() {
  const auth = getAuth();
  const user = await auth.user();

  if (user) {
    return (
      <>
        <p>Hello, {user.name}.</p>
        <LogoutButton />
      </>
    );
  }

  return <LoginButton />;
}
```

### Subscriber-only access

Restricting certain parts of your app only to paying users is straightforward with Reflow. To do this, you need to gate your content on the server side, and call `createSubscription` on the client (full example [here](https://github.com/Reflow-HQ/auth-next-example/blob/master/app/components/SubscribeButton.tsx)).

For the client side, we will create a client component:

**app/components/LogoutButton.tsx**

```tsx
"use client";

import { createSubscription } from "@reflowhq/auth-next/client";

export default function SubscribeButton() {
  return (
    <button
      onClick={() => {
        createSubscription({
          priceID: 123456,
          onSuccess: () => location.reload(),
        });
      }}
    >
      Subscribe
    </button>
  );
}
```

Here we import and call the `createSubscription` method. It is called with the ID of a plan price. You can find this id when editing a plan, or you can retrieve it from the [Reflow API](https://reflowhq.com/docs/api/#get-all-subscription-plans).

When the button is clicked, the user will see a pop-up window where they will need to enter their payment details.

To gate the content on the server, you need to call the `auth.subscription()` method. This will return a [Reflow Subscription object](#async-subscription-promisesubscription--null), which contains the plan info. Depending on this you can decide whether to grant or restrict access. Naturally, this means that you can offer multiple plans and decide what restrictions to apply for each.

**app/page.tsx**

```tsx
import getAuth from "@/auth";
import LoginButton from "./components/LoginButton";
import LogoutButton from "./components/LogoutButton";
import SubscribeButton from "./components/SubscribeButton";

export default async function Page() {
  const auth = getAuth();
  const user = await auth.user();
  const sub = await auth.subscription();

  if (user && sub) {
    return (
      <>
        <p>Hello, {user.name}.</p>
        <p>
          You are subscribed to the {sub.plan.name} plan for {sub.price.price_formatted} per{" "}
          {sub.price.billing_period}
        </p>
        <LogoutButton />
      </>
    );
  } else if (user) {
    return (
      <>
        <p>Hello, {user.name}. You are not yet subscribed.</p>
        <SubscribeButton />
      </>
    );
  }

  return <LoginButton />;
}
```

Notes

- We won't be covering it in this readme, but you can also let users change their plan or cancel their subscription with the `modifySubscription` client functions [example](https://github.com/Reflow-HQ/auth-next-example/blob/master/app/page.tsx)).
- The `Subscription` object contains feature flags that you define in your Plan creation screen in Reflow. If you build your Next app around them, you can use these flags to create new plans with unique limits, or override the features/limits for a specific subscriber from Reflow's project management UI.

### Session Storage and Retrieval

The Reflow Auth library can be used as a generic session library for your Next.js app. The data is persisted in an encrypted http-only cookie and works in both the Node.js and Edge runtimes. This saves you from having to include a separate library like iron-session.

As an example, let's build a button that counts how many times it has been clicked. You can find the full example [here](https://github.com/Reflow-HQ/auth-next-example/blob/master/app/counter/page.tsx).

Note that you can read session data in any server component, but since it is stored in a cookie, you can update the session only in places where cookies can be set, like in [server actions](https://nextjs.org/docs/app/api-reference/functions/server-actions) and [route handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers).

For this reason, our counter update routes will be defined in two route handlers.

**app/api/counter/increment/route.ts**

```tsx
import getAuth from "@/auth";

export async function POST() {
  const auth = getAuth();
  await auth.set("counter", (await auth.get("counter", 0)) + 1);
  return Response.json({ success: true });
}
```

The first handler reads and increments the session using `auth.get` and `auth.set`.

**app/api/counter/clear/route.ts**

```tsx
import getAuth from "@/auth";

export async function POST() {
  const auth = getAuth();
  await auth.forget("counter");
  return Response.json({ success: true });
}
```

The second handler clears the data with `auth.forget`.

To issue fetch requests to the above endpoints, we will define two server components.

**app/components/IncrementButton.ts**

```tsx
"use client";

export default function IncrementButton() {
  async function increment() {
    await fetch("/api/counter/increment", {
      credentials: "include",
      method: "POST",
    });
    location.reload();
  }
  return <button onClick={increment}>Increment counter</button>;
}
```

**app/components/ClearButton.ts**

```tsx
"use client";

export default function ClearButton() {
  async function increment() {
    await fetch("/api/counter/clear", {
      credentials: "include",
      method: "POST",
    });
    location.reload();
  }
  return <button onClick={increment}>Clear counter</button>;
}
```

And lastly, to bring everything together, we will build a page which displays the current value of the counter and both actions.

**app/page.tsx**

```tsx
import IncrementButton from "@/app/components/IncrementButton";
import ClearButton from "@/app/components/ClearButton";
import getAuth from "@/auth";

export default async function Page() {
  const auth = getAuth();

  return (
    <>
      <p>Counter value is: {await auth.get("counter", 0)}</p>
      <IncrementButton />
      <br />
      <ClearButton />
    </>
  );
}
```

## Docs

### ReflowAuth class

You have access to this class only on the server. As you saw in the [setup](#setup), we created a helper file which initializes and returns an instance of the class.

```typescript
import "server-only";
import { ReflowAuth } from "@reflowhq/auth-next";

export default function getAuth(): ReflowAuth {
  return new ReflowAuth({
    storeID: 123456,
    secret: "REPLACE_ME_WITH_A_32_CHAR_SECRET",
  });
}
```

#### Options

The constructor supports the following options. The first two are required and must always be provided.

| Parameter    | Required | Type     | Default Value | Description                                                                                                                                                                                                                                                                             |
| ------------ | -------- | -------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| storeID      | yes      | number   | -             | The ID of your Reflow project. You can find in the Reflow dashboard [settings page](https://reflowhq.com/project/settings) page.                                                                                                                                                                                                      |
| secret       | yes      | string   | -             | A 32 character unique string. It is used to encrypt the session cookie where the auth data is stored. Ideally you should keep this in an .env file that is not committed in your repo.                                                                                                  |
| cookieName   | no       | string   | "session"     | The name of the session cookie stored in the browser with the http-only flag. By default the name is "session".                                                                                                                                                                         |
| cookieMaxAge | no       | number   | -             | The lifetime of the session in seconds. By default it is cleared when the browser window is closed.                                                                                                                                                                                     |
| beforeSignin | no       | function | -             | Async callback function which is called before a successful login with the user object as a parameter ([example](#intercepting-sign-in)). Useful for performing an action before every login. Return `true` from the function to allow the login to proceed, and `false` to prevent it. |
| testMode     | no       | boolean  | false         | Indicates whether the library should use [Reflow's test mode](https://reflowhq.com/docs/guide/test-mode/). Useful for testing in development.                                                                                                                                           |

#### Methods

##### `async isSignedIn(): Promise<boolean>`

Returns a boolean indicating whether the user is signed in or not.

```tsx
import getAuth from "@/auth";

export default async function Page() {
  const auth = getAuth();
  const status = await auth.isSignedIn();
  return <p>User is {status ? "signed in" : "not signed in"}!<p>;
}
```

##### `async isSubscribed(): Promise<boolean>`

Returns a boolean indicating whether the user has an active subscription. Checkout our [full example](#displaying-user-data) above.

```tsx
import getAuth from "@/auth";

export default async function Page() {
  const auth = getAuth();
  const status = await auth.isSubscribed();
  return <p>User is {status ? "subscribed" : "not subscribed"}!<p>;
}
```

##### `async user(): Promise<User | null>`

Returns a user object with account info.

```tsx
import getAuth from "@/auth";

export default async function Page() {
  const auth = getAuth();
  const user = await auth.user();
  return <pre>{user}</pre>;
}
```

Will return an object of type User

```typescript
interface User {
  object: "user";
  id: number;
  name: string;
  email: string;
  photo: string;
  provider: string;
  meta: Record<string, any>;
  created: number;
  livemode?: boolean;
}
```

| Property | Type    | Description                                                                                                                                                                                               |
| -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| object   | string  | Always equal to "user"                                                                                                                                                                                    |
| id       | number  | The id of the user                                                                                                                                                                                        |
| name     | string  | The name of the user                                                                                                                                                                                      |
| email    | string  | The user's email address. Note that some social networks don't provide this (Twitter/X), give the user the option to not share it (Facebook) or replace it with a relay (Apple).                          |
| photo    | string  | URL pointing to a user photo. If the login provider doesn't support it, a placeholder image is shown instead.                                                                                             |
| provider | string  | The id of provider, for example "google", "facebook", "twitter", "apple"                                                                                                                                  |
| meta     | object  | An object of key-value pairs. You can set these with the updateUser method. They can be used to store user preferences like choice of light or dark mode and other small pieces of data. Defaults to `{}` |
| created  | number  | The timestamp of the account creation, for example `1702053000755`.                                                                                                                                       |
| livemode | boolean | Indicates whether this user was created in Live or [Test mode](https://reflowhq.com/docs/guide/test-mode/).                                                                                               |

Here is an example object

```typescript
{
  "success": true,
  "user": {
    "object": "user",
    "id": 123456789,
    "name": "John Smith",
    "email": "user@example.com",
    "photo": "https://cdn.reflowhq.com/media/123456789/profiles/abc123456789.jpeg",
    "provider": "google",
    "meta": {
      "darkMode": true
    },
    "created_at": 1702053000755
  }
}
```

##### `async subscription(): Promise<Subscription | null>`

Returns the user's current subscription and plan info for the signed-in user. See a full example [above](#subscriber-only-access).

```tsx
import getAuth from "@/auth";

export default async function Page() {
  const auth = getAuth();
  const sub = await auth.subscription();
  return <pre>{sub}</pre>;
}
```

Returns an object of the following types

```typescript
interface Subscription {
  object: "subscription";
  id: number;
  status: string;
  last_billing: null | number;
  next_billing: null | number;
  cancel_at: null | number;
  plan: Plan;
  price: Price;
}

interface CurrencyCode {
  code: string;
  name: string;
  zero_decimal: boolean;
}

interface Plan {
  object: "plan";
  id: number;
  name: string;
  description: string;
  parameters: Record<string, any>;
  trial_days: number;
  is_archived: boolean;
  created: number;
}

interface Price {
  object: "plan_price";
  id: number;
  price: number;
  price_formatted: string;
  currency: CurrencyCode;
  billing_period: string;
  is_taxed: boolean;
  tax_behavior: string;
  is_archived: boolean;
  created: number;
}
```

Here is an example JSON object

```typescript
{
  "object": "subscription",
  "id": 12345,
  "status": "active",
  "last_billing": null,
  "next_billing": 1634024400,
  "cancel_at": null,
  "plan": {
    "object": "plan",
    "id": 54321,
    "name": "Premium Plan",
    "description": "Access to all premium features",
    "parameters": {},
    "trial_days": 7,
    "is_archived": false,
    "created": 1630876800
  },
  "price": {
    "object": "plan_price",
    "id": 98765,
    "price": 9.99,
    "price_formatted": "$9.99",
    "currency": {
      "code": "USD",
      "name": "US Dollar",
      "zero_decimal": false
    },
    "billing_period": "monthly",
    "is_taxed": true,
    "tax_behavior": "inclusive",
    "is_archived": false,
    "created": 1630876800
  }
}
```

##### `async updateUser(options: UpdateUserOptions): Promise<{success: boolean; pendingEmailVerification?:boolean}>`

This method updates the user information stored at Reflow. You can use it to update the name, email, photo and meta data of the user. See an example above. The options argument follows the following type definition.

```typescript
interface UpdateUserOptions {
  name?: string;
  email?: string;
  photo?: Blob;
  meta?: Record<string, any>;
}
```

| Property | Type   | Description                                                                                                                                                                                              |
| -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name     | string | New name for the user. By default the name is retrieved from the social sign in provider at the time of registration.                                                                                    |
| email    | string | The user's new email address.                                                                                                                                                                            |
| photo    | Blob   | This is an object of the [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) class that is available in browsers and Node.js. Many web APIs return this type including canvas and file inputs. |
| meta     | object | Object of key-value pairs which you wish to merge with the existing meta data of the user.                                                                                                               |

All fields are optional, but you need to provide at least one.

The method returns an object with properties `success` and `pendingEmailVerification`. The latter is set to true when you've changed the email address of the user and they need to click a validation link that's been delivered by Reflow to their new email address. When true, show a notification or some other message.

```typescript
// Note, works only in server actions and route handlers, not in server components.

const update = {
  email: "new-email@example.com",
  name: "John Sample",
  meta: { sidebarStatus: "collapsed" },
  photo: new Blob(),
};

const result = await auth.updateUser(update);
console.log(result);
/*
{
    success: true,
    pendingEmailVerification: true,
}
*/
```

**IMPORTANT**. Note that this method modifies the auth session cookie. This means that it can't be used in server components, since they are rendered after cookies are delivered to the browser. You can only call this method in server actions and route handlers.

##### `async deleteUser(): Promise<{success: boolean}>`

This method deletes the current user's account and information stored at Reflow. You can use it implement account deletion functionality in your apps. The method won't allow the user to delete their account if they have an active subscription.

The method returns an object with a boolean `success` property.

```typescript
// Note, works only in server actions and route handlers, not in server components.
const result = await auth.deleteUser();
console.log(result);
/*
{
    success: true
}
*/
```

**IMPORTANT**. Note that this method modifies the auth session cookie. This means that it can't be used in server components, since they are rendered after cookies are delivered to the browser. You can only call this method in server actions and route handlers.

##### `async isNew(): Promise<boolean>`

Returns whether the user is newly registered. You can use this status to determine whether to display getting started guides or walkthroughs. The isNew flag is stored in a cookie which expires at the end of the browser session.

```tsx
import getAuth from "@/auth";

export default async function Page() {
  const auth = getAuth();
  const status = await auth.isNew();
  return <p>User is {status ? "new" : "old"}!<p>;
}
```

##### `async setIsNew(): Promise<void>`

Sets the isNew flag for the current session. Will create a cookie which expires at the end of the browser session.

**IMPORTANT**. Note that this method modifies a cookie. This means that it can't be used in server components, since they are rendered after cookies are delivered to the browser. You can only call this method in server actions and route handlers.

```typescript
await auth.setIsNew();
```

##### `async clearIsNew(): Promise<void>`

Clear the isNew cookie forcefully.

**IMPORTANT**. Note that this method modifies a cookie. This means that it can't be used in server components, since they are rendered after cookies are delivered to the browser. You can only call this method in server actions and route handlers.

```typescript
await auth.clearIsNew();
```

##### `async set(key: string, value: any): Promise<void>`

##### `async set({ key: string; value: any }[]): Promise<void>`

This method sets arbitrary data in the session which can be retrieved later with get. You can use this method as an alternative to other session libraries.

The method comes in two forms, you can pass the key and value as arguments, or you can pass an array of keys and values to set a large number of items simultaneously.

Note that the session data is stored in the same encrypted cookie that the reflow user data is stored. As a good practice, try to keep the data you store in the session small, since cookies are sent on every HTTP request.

See an example in [session storage and retrieval](#session-storage-and-retrieval) above.

##### `async get(key: string, def: any = null): Promise<any>`

Returns a value from the session, which you've previously set with `set`. See an example in [session storage and retrieval](#session-storage-and-retrieval) above.

##### `async has(key: string): Promise<boolean>`

Checks whether a key exists in the session. See an example in [session storage and retrieval](#session-storage-and-retrieval) above.

##### `async forget(key: string): Promise<void>`

Removes a value from the session. See an example in [session storage and retrieval](#session-storage-and-retrieval) above.

##### `async clear(): Promise<void> `

Clears all data in the session. The user is signed out of their account and all data you've `set` is lost.

##### `async clearSystem(): Promise<void>`

Removes only system values that hold sign-in info. The customer will be signed out but any custom session data you've added will be retained.

##### `async all(): Promise<Record<string, any>>`

Returns all data in the session as a JS object of key-value pairs.

##### `async refresh(): Promise<AuthRefreshChange | null>`

```typescript
export interface AuthRefreshChange {
  signout: boolean;
  user: boolean;
  subscription: boolean;
}
```

Pull the latest user account info from Reflow and update the data stored in the cookie.

**IMPORTANT**. Note that this method modifies the auth session cookie. This means that it can't be used in server components, since they are rendered after cookies are delivered to the browser. You can only call this method in server actions and route handlers.

```typescript
await auth.refresh();
```

##### `async lastRefresh(): Promise<number | null>`

Returns the timestamp of the last sync with the Reflow backend. Returns either a date timestamp like `1702053000755` or null if not sync has been made yet. Note that the Reflow library handles its own sync so normally you don't need to force it to [refresh](#async-refresh-promiseauthrefreshchange--null).

```typescript
import getAuth from "@/auth";

export default async function Page() {
  const auth = getAuth();
  const ts = await auth.lastRefresh();
  return <p>Last sync with Reflow was at {ts}<p>;
}
```

##### `async handleRequest(request: Request): Promise<Response>`

Handler for the backend API with which the front end JS methods communicate. You can see it used in the [setup](#setup) section for `app/auth/route.ts`.

### Client Functions

The following functions are available in client components only.

#### `async function signIn(options?: {authEndpoint?: string;onSuccess?: Function;onError?: Function; step?: "login" | "register"; subscribeTo?: number;})`

Triggers the sign in flow and displays a window with sign in methods. You can see an example [above](#user-sign-in).

Takes the following options

| Property     | Type     | Description                                                                                                                                                                                                                   |
| ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| authEndpoint | string   | The path on your website where Next.js serves the auth route handler you created in the setup. By default, this is set to "/auth". If you use a non-standard route handler name or location you will need to change this.     |
| onSuccess    | Function | Callback function which is called when the user signs in successfully.                                                                                                                                                        |
| onError      | Function | Callback function which is called when an error occurs during sign in.                                                                                                                                                        |
| step         | string   | If you use the Username and Password auth provider, this indicates whether to display the login or register screens. This is only for convenience, users can navigate between them from the links in the window regardless.   |
| subscribeTo  | number   | You can provide a priceID if you wish the user to be presented with a subscription screen immediately after signing in. It is used internally by the createSubscription method if the user is not logged in when it's called. |

All are optional.

#### `async function signOut(options?: {authEndpoint?: string; onSuccess?: Function; onError?: Function;})`

Signs out the currently logged in user. You can see an example [above](#user-sign-out).

Takes the following options:

| Property     | Type     | Description                                                                                                                                                                                                               |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| authEndpoint | string   | The path on your website where Next.js serves the auth route handler you created in the setup. By default, this is set to "/auth". If you use a non-standard route handler name or location you will need to change this. |
| onSuccess    | Function | Callback function which is called when the user signs out successfully.                                                                                                                                                   |
| onError      | Function | Callback function which is called when an error occurs during sign out.                                                                                                                                                   |

All are optional.

#### `async function createSubscription(options?: {options: {priceID: number;authEndpoint?: string;paymentProvider?: string;onSuccess?: Function;onError?: Function;}})`

Displays a payment window to the currently signed in user, where they can sign up for the subscription plan at the price given in the priceID option. See a full example [above](#subscriber-only-access)

| Property        | Type     | Description                                                                                                                                                                                                               |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| priceID         | number   | The id of a plan price object. You can obtain this from the Reflow control panel or the API.                                                                                                                              |
| authEndpoint    | string   | The path on your website where Next.js serves the auth route handler you created in the setup. By default, this is set to "/auth". If you use a non-standard route handler name or location you will need to change this. |
| paymentProvider | string   | The payment provider that should be used for handling the subscription, either 'stripe' or 'paddle'.                                                                                                                      |
| onSuccess       | Function | Callback function which is called after a subscription is successfully created.                                                                                                                                           |
| onError         | Function | Callback function which is called when an error occurs during subscription creation.                                                                                                                                      |

The priceID option is required, the rest are optional.

#### `async function modifySubscription(options?: { authEndpoint?: string;onSuccess?: Function;onError?: Function; })`

Opens a window which lets the user change their payment method and billing info, or switch to a different plan if available. See a full example [above](#subscriber-only-access)

| Property     | Type     | Required | Description                                                                                                                                                                                                               |
| ------------ | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| authEndpoint | string   | Optional | The path on your website where Next.js serves the auth route handler you created in the setup. By default, this is set to "/auth". If you use a non-standard route handler name or location you will need to change this. |
| onSuccess    | Function | Optional | Callback function which is called after the subscription changes are applied and the management dialog is closed.                                                                                                         |
| onError      | Function | Optional | Callback function which is called when an error occurs during subscription management.                                                                                                                                    |

#### `async function isSignedIn(options?: { authEndpoint?: string })`

Returns a boolean indicating whether the user is currently signed in or not. This is the client counterpart of the isSignedIn() method available on the auth instance on the server. This method invokes a fetch request to the backend every time it is called, so it's better to rely on the auth version instead of this one whenever possible.

| Property     | Type   | Required | Description                                                                                                                                                                                                               |
| ------------ | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| authEndpoint | string | Optional | The path on your website where Next.js serves the auth route handler you created in the setup. By default, this is set to "/auth". If you use a non-standard route handler name or location you will need to change this. |

#### `useSessionSync` React Hook

This is a React hook which lets you listen to events originating from other browser tabs. Use this hook to listen for signin, signout and subscribe events. Alternatively, pass an onChange callback which accepts an event type parameter (can be one of "signin", "signout" and "subscribe").

See how we use it to build a toolbar notifying the user if they have signed in another browser tab in [our example](https://github.com/Reflow-HQ/auth-next-example/blob/master/app/components/SessionBanner.tsx).

**Signature**

```typescript
function useSessionSync(options: {
  authEndpoint?: string;
  onChange?: (event: "signin" | "signout" | "subscribe") => void;
  onSignin?: Function;
  onSignout?: Function;
  onSubscribe?: Function;
});
```

Options

| Property     | Type     | Description                                                                                                                                                                                                               |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| authEndpoint | string   | The path on your website where Next.js serves the auth route handler you created in the setup. By default, this is set to "/auth". If you use a non-standard route handler name or location you will need to change this. |
| onSignin     | Function | Callback function which is called when the user signs into their account from another tab.                                                                                                                                |
| onSingout    | Function | Callback function which is called when the user signs out from another tab.                                                                                                                                               |
| onSubscribe  | Function | Callback function which is called when the user subscribes to your app on another tab, browser or device.                                                                                                                 |
| onChange     | Function | Instead of passing separate `onSignin`, `onSignout` and `onSubscribe` callback, you can pass this one and determine the event from the function argument.                                                                 |

All of these are optional.

## License

Released under the MIT license. (c) Reflow HQ
