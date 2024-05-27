import { ReflowAuth } from "../src/auth";
import { cookies } from "next/headers";

// Setup & Mocks

const sessionCookieName = "sessionCookie123";

function getAuth(): ReflowAuth {
  return new ReflowAuth({
    projectID: 199976733,
    secret: "B9LliGAV7WtEKtVR9TKorLnLQFPV1Po3",
    cookieName: sessionCookieName,
    cookieMaxAge: 14 * 24 * 60 * 60,
    apiBase: "http://api.reflow.local/v2",
    beforeSignin: async () => true,
  });
}

jest.mock("next/headers");
if (!globalThis.hasOwnProperty("crypto")) {
  globalThis.crypto = require("crypto").webcrypto;
}

let cookieValue: Record<string, any> = {};

(cookies as any).mockImplementation(() => ({
  get: (name: string) => ({ name, value: cookieValue[name] }),
  set: (name: string, val: String, props?: any) => {
    if (props?.maxAge === 0) {
      delete cookieValue[name];
    } else cookieValue[name] = val;
  },
  has: (name: string) => name in cookieValue,
}));

const userData = {
  object: "user",
  id: 123,
  name: "John Doe",
  email: "john.doe@example.com",
  photo: "https://example.com/profile.jpg",
  provider: "Google",
  meta: {
    age: 25,
    location: "New York",
  },
  created: 1635244789,
  livemode: true,
};

const subscriptionData = {
  object: "subscription",
  id: 456,
  status: "active",
  last_billing: null,
  next_billing: 1671571200,
  cancel_at: null,
  plan: {
    id: 789,
    name: "Premium Plan",
    type: "monthly",
  },
  price: {
    amount: 9.99,
    currency: "USD",
  },
};

// Hide console errors
jest.spyOn(console, "error").mockImplementation(() => {});

// Tests

describe("Reflow Auth Server", () => {
  const auth = getAuth();

  test("constructor errors", async () => {
    expect(() => {
      // @ts-ignore
      new ReflowAuth({});
    }).toThrow("projectID is required");

    expect(() => {
      // @ts-ignore
      new ReflowAuth({ projectID: 1234 });
    }).toThrow("Secret must be 32 characters long");

    expect(() => {
      // @ts-ignore
      new ReflowAuth({ storeID: 1234 });
    }).toThrow("Secret must be 32 characters long");

    expect(() => {
      // @ts-ignore
      new ReflowAuth({ projectID: 1234, secret: "asdf" });
    }).toThrow("Secret must be 32 characters long");
  });

  test("get, set and forget", async () => {
    expect(await auth.all()).toEqual({});

    expect(await auth.get("test")).toBeNull();
    expect(await auth.has("test")).toEqual(false);

    await auth.set("test", 12345);
    expect(await auth.has("test")).toEqual(true);
    expect(await auth.get("test")).toEqual(12345);
    expect(await auth.all()).toEqual({ test: 12345 });
    expect(Object.keys(cookieValue)).toEqual([sessionCookieName]);
    expect(cookieValue[sessionCookieName]).toMatch(
      /^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/i // base64 payload followed by salt
    );

    await auth.set("test", "banana");
    expect(await auth.all()).toEqual({ test: "banana" });

    await auth.set("grapefruit", false);
    expect(await auth.all()).toEqual({ test: "banana", grapefruit: false });

    await auth.set("_system123", 777);
    expect(await auth.all()).toEqual({
      test: "banana",
      grapefruit: false,
      _system123: 777,
    });

    await auth.forget("nonexisting");
    expect(await auth.all()).toEqual({
      test: "banana",
      grapefruit: false,
      _system123: 777,
    });

    await auth.forget("test");
    expect(await auth.has("test")).toEqual(false);
    expect(await auth.all()).toEqual({
      grapefruit: false,
      _system123: 777,
    });

    await auth.set("test2", 999);
    await auth.set("obj", { milk: true, eggs: false });
    expect(await auth.get("obj")).toEqual({ milk: true, eggs: false });
    expect(await auth.all()).toEqual({
      test2: 999,
      obj: { milk: true, eggs: false },
      grapefruit: false,
      _system123: 777,
    });

    await expect(async () => {
      await auth.set("_system1234");
    }).rejects.toThrow("Value expected");

    await auth.set("_system1234", true);

    await auth.clearSystem();
    expect(await auth.all()).toEqual({
      grapefruit: false,
      obj: { milk: true, eggs: false },
      test2: 999,
    });

    await auth.clear();
    expect(await auth.all()).toEqual({});

    await auth.set([
      { key: "z1", value: 123 },
      { key: "z2", value: 456 },
    ]);

    expect(await auth.all()).toEqual({
      z1: 123,
      z2: 456,
    });

    await auth.clear();
    expect(await auth.all()).toEqual({});

    await auth.clear();
    expect(await auth.all()).toEqual({});
  });

  test("user methods", async () => {
    expect(await auth.isSignedIn()).toEqual(false);
    await auth.set("_key", "asdf");
    expect(await auth.isSignedIn()).toEqual(true);

    expect(await auth.user()).toBeNull();

    await auth.set("_user", userData);

    expect(await auth.user()).toEqual(userData);
  });

  test("subscription methods", async () => {
    expect(await auth.isSubscribed()).toEqual(false);
    expect(await auth.subscription()).toBeNull();

    await auth.set("_subscription", subscriptionData);

    expect(await auth.subscription()).toEqual(subscriptionData);
    expect(await auth.isSubscribed()).toEqual(true);
  });

  test("refresh", async () => {
    await auth.clear();

    let newUser = structuredClone(userData);

    newUser.name = "Bob User";
    newUser.email = "bob@example.com";

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            user: newUser,
            subscription: null,
            success: true,
          }),
      })
    );

    expect(await auth.refresh()).toBeNull();

    expect(await auth.lastRefresh()).toBeNull();

    let mockedTimestamp = Date.now();
    jest.spyOn(Date, "now").mockImplementation(() => mockedTimestamp);

    await auth.set("_key", "asdf");
    await auth.set("_user", userData);

    expect(await auth.refresh()).toEqual({
      signout: false,
      user: true,
      subscription: false,
    });
    expect(await auth.user()).toEqual(newUser);
    expect(await auth.lastRefresh()).toEqual(mockedTimestamp);

    mockedTimestamp += 1000;

    expect(await auth.refresh()).toEqual({
      signout: false,
      subscription: false,
      user: false,
    });

    expect(await auth.lastRefresh()).toEqual(mockedTimestamp);

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            user: newUser,
            subscription: subscriptionData,
            success: true,
          }),
      })
    );

    mockedTimestamp += 1000;

    expect(await auth.refresh()).toEqual({
      signout: false,
      subscription: true,
      user: false,
    });

    expect(await auth.lastRefresh()).toEqual(mockedTimestamp);

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 403,
        json: () => Promise.resolve({}),
      })
    );

    mockedTimestamp += 1000;

    expect(await auth.refresh()).toEqual({
      signout: true,
      subscription: false,
      user: false,
    });

    expect(await auth.lastRefresh()).toEqual(null);

    // @ts-ignore
    Date.now.mockRestore();
  });

  test("handleRequest", async () => {
    /* Init test */

    await auth.clear();

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ signinURL: "https://asdf.com" }),
      })
    );

    expect(await auth.has("_nonce")).toEqual(false);

    let response = await auth.handleRequest(new Request("https://adfasdf/banana?init=1"));

    let json = await response.json();

    expect(json).toEqual({
      success: true,
      projectID: auth.projectID,
      signinURL: "https://asdf.com",
      nonceHash: json.nonceHash,
    });

    expect(json.nonceHash.length).toBeGreaterThan(10);
    expect(await auth.has("_nonce")).toEqual(true);
    expect((await auth.get("_nonce")).length).toBeGreaterThan(10);
    expect(fetch).toHaveBeenCalledWith(
      "http://api.reflow.local/v2/projects/199976733/auth/urls",
      undefined
    );

    expect(await auth.isSignedIn()).toEqual(false);

    await auth.set("_key", "adsf");

    expect(await auth.isSignedIn()).toEqual(true);

    response = await auth.handleRequest(new Request("https://adfasdf/banana?init=1"));

    json = await response.json();

    expect(json).toEqual({
      success: false,
      reason: "already-signed-in",
    });

    await auth.clear();

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "123456" }),
      })
    );

    response = await auth.handleRequest(new Request("https://adfasdf/something?init=1"));

    json = await response.json();

    expect(json).toEqual({ error: "123456", success: false });
    expect(response.status).toEqual(422);

    /* Check test */

    await auth.clear();
    await auth.set("_nonce", "banana123");

    response = await auth.handleRequest(new Request("https://adfasdf/something?check=1"));

    json = await response.json();
    expect(json).toEqual({ error: "Token missing", success: false });

    expect(cookieValue[sessionCookieName + "-is-new"]).toBeUndefined();

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            valid: true,
            session: "sess.123",
            isNew: true,
            user: { name: "Greg" },
            subscription: { price: 123 },
          }),
      })
    );

    /* beforeSignin test */

    /* Failed callback */

    const beforeSignin = jest.spyOn(auth as any, "beforeSignin");
    beforeSignin.mockImplementation(async () => false);

    response = await auth.handleRequest(
      new Request("https://adfasdf/something?check=1&auth-token=panda")
    );

    json = await response.json();
    expect(json).toEqual({ error: "Sign-in prevented.", success: false });

    expect(await auth.all()).toEqual({ _nonce: "banana123" });

    expect(fetch).toHaveBeenCalledWith(
      "http://api.reflow.local/v2/projects/199976733/auth/validate-token?auth-token=panda&nonce=banana123",
      { method: "POST" }
    );

    /* Successful callback */

    beforeSignin.mockImplementation(async () => true);

    await auth.clear();
    await auth.set("_nonce", "banana123");

    response = await auth.handleRequest(
      new Request("https://adfasdf/something?check=1&auth-token=panda")
    );

    json = await response.json();
    expect(json).toEqual({ success: true });

    expect(await auth.all()).toEqual({
      _key: "sess.123",
      _lastRefresh: await auth.lastRefresh(),
      _subscription: {
        price: 123,
      },
      _user: {
        name: "Greg",
      },
    });

    expect(cookieValue[sessionCookieName + "-is-new"]).toEqual("1");
    expect(await auth.isNew()).toEqual(true);

    expect(fetch).toHaveBeenCalledWith(
      "http://api.reflow.local/v2/projects/199976733/auth/validate-token?auth-token=panda&nonce=banana123",
      { method: "POST" }
    );

    /* Is signed in test 1 */

    response = await auth.handleRequest(new Request("https://adfasdf/something?is-signed-in=1"));

    json = await response.json();
    expect(json).toEqual({ status: true });

    /* Refresh test */

    // @ts-ignore
    jest.spyOn(auth, "refresh").mockImplementation(async () => ({ rrr: true }));

    let mockedTimestamp = Date.now();
    jest.spyOn(Date, "now").mockImplementation(() => mockedTimestamp);

    response = await auth.handleRequest(new Request("https://adfasdf/something?refresh=1"));

    json = await response.json();
    expect(json).toEqual(null);
    expect(auth.refresh).toHaveBeenCalledTimes(0);

    mockedTimestamp += 5 * 60 * 1000 + 1;

    response = await auth.handleRequest(new Request("https://adfasdf/something?refresh=1"));
    json = await response.json();
    expect(json).toEqual({ rrr: true });
    expect(auth.refresh).toHaveBeenCalledTimes(1);

    response = await auth.handleRequest(new Request("https://adfasdf/something?refresh=1&force=1"));

    json = await response.json();
    expect(json).toEqual({ rrr: true });
    expect(auth.refresh).toHaveBeenCalledTimes(2);

    // @ts-ignore
    Date.now.mockRestore();

    /* Create subscription test 1 */

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "success",
            provider: "stripe",
            mode: "live",
            checkoutURL: "https://example.com",
          }),
      })
    );

    response = await auth.handleRequest(
      new Request(
        "https://adfasdf/something?create-subscription=1&priceID=1337&paymentProvider=stripe"
      )
    );

    json = await response.json();
    expect(json).toEqual({
      status: "success",
      provider: "stripe",
      mode: "live",
      checkoutURL: "https://example.com",
    });

    let body = new FormData();
    body.set("priceID", "1337");
    body.set("paymentProvider", "stripe");

    expect(fetch).toHaveBeenCalledWith(
      "http://api.reflow.local/v2/projects/199976733/auth/user/subscribe",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer sess.123",
        },
        body,
      }
    );

    /* Manage subscription test */

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "success",
            provider: "stripe",
            subscriptionManagementURL: "https://example.com",
          }),
      })
    );

    response = await auth.handleRequest(
      new Request("https://adfasdf/something?manage-subscription=1")
    );

    json = await response.json();
    expect(json).toEqual({
      status: "success",
      provider: "stripe",
      subscriptionManagementURL: "https://example.com",
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://api.reflow.local/v2/projects/199976733/auth/user/manage-subscription",
      {
        method: "GET",
        headers: {
          Authorization: "Bearer sess.123",
        },
      }
    );

    // Get subscription test

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            subscription: {
              price: 123,
            },
          }),
      })
    );

    response = await auth.handleRequest(
      new Request("https://adfasdf/something?get-subscription=1")
    );

    json = await response.json();
    expect(json).toEqual({
      subscription: {
        price: 123,
      },
    });

    // Update (paddle) subscription test

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "success",
            plan: { object: "plan" },
            price: { object: "price" },
            paddle_subscription: { is: "paddle-api-result" },
          }),
      })
    );

    response = await auth.handleRequest(
      new Request("https://adfasdf/something?update-subscription=1&priceID=123")
    );

    json = await response.json();
    expect(json).toEqual({
      status: "success",
      plan: { object: "plan" },
      price: { object: "price" },
      paddle_subscription: { is: "paddle-api-result" },
    });

    let updatePlanBody = new FormData();
    updatePlanBody.set("priceID", "123");

    expect(fetch).toHaveBeenCalledWith(
      "http://api.reflow.local/v2/projects/199976733/auth/user/update-plan",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer sess.123",
        },
        body: updatePlanBody,
      }
    );

    // Cancel (paddle) subscription test

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "success",
            cancel_at: "123456789",
          }),
      })
    );

    response = await auth.handleRequest(
      new Request("https://adfasdf/something?cancel-subscription=1")
    );

    json = await response.json();
    expect(json).toEqual({
      status: "success",
      cancel_at: "123456789",
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://api.reflow.local/v2/projects/199976733/auth/user/cancel-subscription",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer sess.123",
        },
      }
    );

    /* Signout test */

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    );

    await auth.set("someprop", true);

    response = await auth.handleRequest(new Request("https://adfasdf/something?signout=1"));

    json = await response.json();
    expect(json).toEqual({ success: true });

    expect(fetch).toHaveBeenCalledWith(
      "http://api.reflow.local/v2/projects/199976733/auth/signout",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer sess.123",
        },
      }
    );

    expect(await auth.all()).toEqual({ someprop: true });
    expect(await auth.isNew()).toEqual(false);

    /* Is signed in test 2 */

    response = await auth.handleRequest(new Request("https://adfasdf/something?is-signed-in=1"));

    json = await response.json();
    expect(json).toEqual({ status: false });

    /* Create subscription test 2 */

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "123456" }),
      })
    );

    response = await auth.handleRequest(
      new Request("https://adfasdf/something?create-subscription=1&priceID=1337")
    );

    json = await response.json();
    expect(json).toEqual({
      success: false,
      error: "123456",
    });
  });

  test("updateUser", async () => {
    await auth.clear();
    await auth.set("_key", "sess.123");
    await auth.set("_user", userData);

    let newUser = structuredClone(userData);

    newUser.name = "Bob User";
    newUser.email = "bob@example.com";
    // @ts-ignore
    newUser.meta = { banana: false };

    let update = {
      email: newUser.email,
      name: newUser.name,
      meta: { banana: false },
      photo: new Blob(),
    };

    let body = new FormData();
    body.set("email", newUser.email);
    body.set("name", newUser.name);
    body.set("meta", JSON.stringify(newUser.meta));
    body.set("photo", update.photo);

    let mockedTimestamp = Date.now();
    jest.spyOn(Date, "now").mockImplementation(() => mockedTimestamp);

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ user: newUser }),
      })
    );

    let response = await auth.updateUser(update);

    expect(response).toEqual({
      success: true,
      pendingEmailVerification: false,
    });

    expect(await auth.lastRefresh()).toEqual(mockedTimestamp);

    expect(fetch).toHaveBeenCalledWith("http://api.reflow.local/v2/projects/199976733/auth/user", {
      method: "POST",
      headers: {
        Authorization: "Bearer sess.123",
      },
      body,
    });

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ user: newUser, email_update: true }),
      })
    );

    response = await auth.updateUser(update);

    expect(response).toEqual({
      success: true,
      pendingEmailVerification: true,
    });
  });

  test("deleteUser", async () => {
    await auth.clear();
    await auth.set("_key", "sess.123");
    await auth.set("_user", userData);

    // @ts-ignore
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
    );

    let response = await auth.deleteUser();

    expect(response).toEqual({
      success: true,
    });

    expect(fetch).toHaveBeenCalledWith("http://api.reflow.local/v2/projects/199976733/auth/user", {
      method: "DELETE",
      headers: {
        Authorization: "Bearer sess.123",
      },
    });

    expect(await auth.isSignedIn()).toEqual(false);
    expect(await auth.user()).toBeNull();
  });
});
