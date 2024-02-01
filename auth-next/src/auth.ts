import { cookies } from "next/headers";
import { User, AuthRefreshChange, Subscription, UpdateUserOptions } from "./auth-types";

export class ReflowAuth {
  public storeID: number;
  public cookieName: string;
  public cookieMaxAge: number | undefined;
  public apiBase: string;
  public testMode: boolean;
  protected secret: string;

  constructor({
    storeID,
    secret,
    cookieName = "session",
    cookieMaxAge,
    apiBase,
    testMode = false,
  }: {
    storeID: number;
    secret: string;
    cookieName?: string;
    cookieMaxAge?: number;
    apiBase?: string;
    testMode?: boolean;
  }) {
    if (!storeID) {
      throw new Error("storeID is required");
    }

    if (!secret || secret.length != 32) {
      throw new Error("Secret must be 32 characters long");
    }

    this.storeID = storeID;
    this.secret = secret;
    this.cookieName = cookieName;
    this.cookieMaxAge = cookieMaxAge;

    this.testMode = testMode;
    this.apiBase = apiBase || `https://${testMode ? "test-" : ""}api.reflowhq.com/v2`;
  }

  protected api(endpoint: string, options?: object): Promise<object> {
    return fetch(this.apiBase + "/stores/" + this.storeID + endpoint, options).then(
      async (response) => {
        let data = await response.json();

        if (!response.ok) {
          throw new ReflowAPIError(data.error || "HTTP error", response.status, data);
        }

        return data;
      }
    );
  }

  /**
   * Returns a boolean indicating whether the user is signed in
   */
  public async isSignedIn(): Promise<boolean> {
    return await this.has("_key");
  }

  /**
   * Returns a boolean indicating whether the user has an active subscription
   */
  public async isSubscribed(): Promise<boolean> {
    return !!(await this.subscription());
  }

  /**
   * Returns the timestamp of the last sync with the Reflow backend
   */
  public async lastRefresh(): Promise<number | null> {
    return await this.get("_lastRefresh");
  }

  /**
   * Returns a user object with account info
   */
  public async user(): Promise<User | null> {
    if (!this.isSignedIn()) {
      return null;
    }

    return await this.get("_user");
  }

  /**
   * Returns the user's current subscription and plan info
   */
  public async subscription(): Promise<Subscription | null> {
    if (!(await this.isSignedIn())) {
      return null;
    }

    return await this.get("_subscription");
  }

  /**
   * Add a custom value to the session
   */
  public async set(key: string | { key: string; value: any }[], value?: any): Promise<void> {
    let all: { [key: string]: any } = await this.all();

    if (Array.isArray(key)) {
      for (let entry of key) {
        all[entry.key] = entry.value;
      }
    } else {
      if (value === undefined) {
        throw new Error("Value expected");
      }
      all[key] = value;
    }

    this.setCookie(await this.encrypt(JSON.stringify(all)));
  }

  /**
   * Returns a value from the session
   */
  public async get(key: string, def: any = null): Promise<any> {
    let all: { [key: string]: any } = await this.all();
    return all[key] ?? def;
  }

  /**
   * Checks whether a key exists in the session
   */
  public async has(key: string): Promise<boolean> {
    let all: { [key: string]: any } = await this.all();
    return all.hasOwnProperty(key);
  }

  /**
   * Removes a value from the session
   */
  public async forget(key: string): Promise<void> {
    let all: { [key: string]: any } = await this.all();
    delete all[key];
    this.setCookie(await this.encrypt(JSON.stringify(all)));
  }

  /**
   * Clears all data in the session
   */
  public async clear(): Promise<void> {
    this.clearCookie();
  }

  /**
   * Removes only system values that hold sign-in info. Any custom session data
   * you've added will be retained.
   */
  public async clearSystem(): Promise<void> {
    let all: { [key: string]: any } = await this.all();

    let filtered: { [key: string]: any } = {};

    for (let rule of Object.keys(all)) {
      // System properties start with an underscore
      if (rule[0] !== "_") filtered[rule] = all[rule];
    }

    this.setCookie(await this.encrypt(JSON.stringify(filtered)));
  }

  /**
   * Returns all data in the session
   */
  public async all(): Promise<Record<string, any>> {
    let data = {};

    try {
      data = JSON.parse(await this.decrypt(this.getCookie()));
    } catch (e) {}

    return data;
  }

  /**
   * Updates the user information stored at Reflow. You can use it
   * to update the name, email, photo and meta data of the user.
   */
  public async updateUser(
    options: UpdateUserOptions
  ): Promise<{ success: boolean; pendingEmailVerification?: boolean }> {
    let body = new FormData();

    for (let key in options) {
      if (key == null) continue;
      let val: any = options[key as keyof UpdateUserOptions];

      if (key == "meta") {
        val = JSON.stringify(val);
      }

      body.set(key, val);
    }

    let result: any = await this.api("/auth/user", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.get("_key")}`,
      },
      body,
    });

    let update = [{ key: "_lastRefresh", value: Date.now() }];

    if (!this.userSameAs(result.user)) {
      update.push({ key: "_user", value: result.user });
    }

    await this.set(update);

    let response = { success: true, pendingEmailVerification: false };

    if (result["email_update"]) {
      response.pendingEmailVerification = true;
    }

    return response;
  }

  /**
   * Returns whether the user is newly registered. You can use this status to
   * determine whether to display getting started guides or walkthroughs. The isNew
   * flag is stored in a cookie which expires at the end of the browser session.
   */
  public async isNew(): Promise<boolean> {
    const cookieStore = cookies();
    return cookieStore.has(this.cookieName + "-is-new");
  }

  /**
   * Sets the isNew flag for the current session. Will create a cookie which
   * expires at the end of the browser session.
   */
  public async setIsNew(): Promise<void> {
    const cookieStore = cookies();
    cookieStore.set(this.cookieName + "-is-new", "1", {
      httpOnly: true,
    });
  }

  /**
   * Clear the isNew cookie forcefully.
   */
  public async clearIsNew(): Promise<void> {
    cookies().set(this.cookieName + "-is-new", "", {
      httpOnly: true,
      maxAge: 0,
    });
  }

  protected async generateNonce(): Promise<string> {
    const nonceBytes = crypto.getRandomValues(new Uint8Array(12));
    return this.arrayBufferToBase64(nonceBytes);
  }

  protected async generateNonceHash(nonce: string): Promise<string> {
    return await this.generateSHA256Hash(nonce);
  }

  protected getCookie(): string {
    const cookieStore = cookies();
    return cookieStore.get(this.cookieName)?.value ?? "";
  }

  protected setCookie(value: string) {
    const cookieStore = cookies();
    return cookieStore.set(this.cookieName, value, {
      httpOnly: true,
      maxAge: this.cookieMaxAge,
    });
  }

  protected clearCookie() {
    cookies().set(this.cookieName, "", {
      httpOnly: true,
      maxAge: 0,
    });
  }

  protected async encrypt(value: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const alg = { name: "AES-GCM", iv: new Uint8Array(iv) };

    const valueEncoded = new TextEncoder().encode(value);
    const secretEncoded = new TextEncoder().encode(this.secret);

    const secretHash = await crypto.subtle.digest("SHA-256", secretEncoded);
    const key = await crypto.subtle.importKey("raw", secretHash, alg, false, ["encrypt"]);
    const encrypted = await crypto.subtle.encrypt(alg, key, valueEncoded);

    return this.arrayBufferToBase64(encrypted) + "." + this.arrayBufferToBase64(iv);
  }

  protected async decrypt(value: string): Promise<string> {
    const [data, iv] = value.split(".");

    const alg = { name: "AES-GCM", iv: new Uint8Array(this.base64ToArrayBuffer(iv)) };
    const secretEncoded = new TextEncoder().encode(this.secret);
    const secretHash = await crypto.subtle.digest("SHA-256", secretEncoded);

    const decryptKey = await crypto.subtle.importKey("raw", secretHash, alg, false, ["decrypt"]);

    const decrypted = await crypto.subtle.decrypt(
      alg,
      decryptKey,
      new Uint8Array(this.base64ToArrayBuffer(data))
    );

    return new TextDecoder().decode(decrypted);
  }

  protected async generateSHA256Hash(input: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");

    return hashHex;
  }

  protected arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    let bytes = new Uint8Array(buffer);
    let len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  }

  protected base64ToArrayBuffer(value: string): ArrayBuffer {
    const binaryString = atob(value);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes.buffer;
  }

  protected async userSameAs(user: User) {
    return JSON.stringify(await this.user()) === JSON.stringify(user);
  }

  protected async subscriptionSameAs(sub: Subscription) {
    return JSON.stringify(await this.subscription()) === JSON.stringify(sub);
  }

  /**
   * Pull the latest user account info from Reflow and update the data stored in the cookie.
   */
  public async refresh(): Promise<AuthRefreshChange | null> {
    if (!(await this.isSignedIn())) {
      return null;
    }

    let changes: AuthRefreshChange = {
      signout: false,
      user: false,
      subscription: false,
    };

    try {
      let result: any = await this.api("/auth/state", {
        headers: {
          Authorization: `Bearer ${await this.get("_key")}`,
        },
      });

      let update = [{ key: "_lastRefresh", value: Date.now() }];

      if (!(await this.userSameAs(result.user))) {
        changes.user = true;
        update.push({ key: "_user", value: result.user });
      }

      if (!(await this.subscriptionSameAs(result.subscription))) {
        changes.subscription = true;
        update.push({ key: "_subscription", value: result.subscription });
      }

      await this.set(update);

      return changes;
    } catch (e: any) {
      if (e.status == 403) {
        // User could not be fetched.
        // Delete the local session and signout

        await this.clearSystem();

        changes.signout = true;
        return changes;
      }

      throw e;
    }
  }

  /**
   * Handler for the backend API with which the front end JS methods communicate
   */
  public async handleRequest(request: Request): Promise<Response> {
    const params = new URL(request.url).searchParams;

    if (params.has("init")) {
      let response: { signinURL?: string };

      if (await this.isSignedIn()) {
        return Response.json({
          success: false,
          reason: "already-signed-in",
        });
      }

      try {
        response = await this.api("/auth/urls");

        if (!response.signinURL) {
          throw new Error("Unable to retrieve the auth URL");
        }
      } catch (e: any) {
        console.error("Reflow: " + e);
        if (e.data) console.error(e.data);
        if (e.error) console.error(e.error);
        return errorResponse(e.message);
      }

      // On every login attempt, generate a new nonce and save it to the session
      let nonce = await this.generateNonce();
      await this.set("_nonce", nonce);

      return Response.json({
        success: true,
        storeID: this.storeID,
        signinURL: response.signinURL,
        nonceHash: await this.generateNonceHash(nonce),
      });
    } else if (params.has("check")) {
      if (!params.has("auth-token")) {
        return errorResponse("Token missing");
      }

      try {
        let status: any = await this.api(
          "/auth/validate-token?auth-token=" +
            params.get("auth-token") +
            "&nonce=" +
            encodeURIComponent(await this.get("_nonce")),
          {
            method: "POST",
          }
        );

        if (!status.valid) {
          return Response.json({ success: false });
        }

        await this.set([
          { key: "_key", value: status.session },
          { key: "_user", value: status.user },
          { key: "_subscription", value: status.subscription },
          { key: "_lastRefresh", value: Date.now() },
        ]);

        await this.forget("_nonce");

        if (status.isNew) {
          await this.setIsNew();
        }

        return Response.json({ success: true });
      } catch (e: any) {
        return errorResponse(e.message);
      }
    } else if (params.has("signout")) {
      if (await this.isSignedIn()) {
        try {
          await this.api("/auth/signout", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${await this.get("_key")}`,
            },
          });
        } catch (e) {}
      }
      await this.clearSystem();
      await this.clearIsNew();
      return Response.json({ success: true });
    } else if (params.has("is-signed-in")) {
      return Response.json({ status: await this.isSignedIn() });
    } else if (params.has("create-subscription")) {
      if (!params.has("priceID")) {
        return errorResponse("Price ID missing");
      }

      let body = new FormData();
      body.set("priceID", String(params.get("priceID")));
      body.set("paymentProvider", String(params.get("paymentProvider")));

      try {
        let response: any = await this.api("/auth/user/subscribe", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${await this.get("_key")}`,
          },
          body,
        });
        return Response.json(response);
      } catch (e: any) {
        return errorResponse(e?.data?.errors?.system ?? e.message);
      }
    } else if (params.has("manage-subscription")) {
      try {
        let manageSubscriptionData: any = await this.api("/auth/user/manage-subscription", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${await this.get("_key")}`,
          },
        });

        return Response.json(manageSubscriptionData);
      } catch (e: any) {
        console.error(e);
        return errorResponse(e?.data?.errors?.system ?? e.message);
      }
    } else if (params.has("refresh")) {
      let result: AuthRefreshChange | null = null;
      if (params.has("force")) {
        result = await this.refresh();
      } else {
        let lr = await this.lastRefresh();
        if (!lr || lr < Date.now() - 5 * 60 * 1000) {
          // We haven't refreshed yet or the data is older than 5 minutes
          result = await this.refresh();
        }
      }
      return Response.json(result);
    } else if (params.has("get-subscription")) {
      return Response.json({ subscription: await this.subscription() });
    } else if (params.has("update-subscription")) {
      if (!params.has("priceID")) {
        return errorResponse("Price ID missing");
      }

      let body = new FormData();
      body.set("priceID", String(params.get("priceID")));

      try {
        let response: any = await this.api("/auth/user/update-plan", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${await this.get("_key")}`,
          },
          body,
        });
        return Response.json(response);
      } catch (e: any) {
        return errorResponse(e?.data?.errors?.system ?? e.message);
      }
    } else if (params.has("cancel-subscription")) {
      try {
        let response: any = await this.api("/auth/user/cancel-subscription", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${await this.get("_key")}`,
          },
        });
        return Response.json(response);
      } catch (e: any) {
        return errorResponse(e?.data?.errors?.system ?? e.message);
      }
    }

    return errorResponse("Invalid action");
  }
}

export class ReflowAPIError extends Error {
  status: number;
  data: object;

  constructor(message: string, status: number, data: object) {
    super(message);
    this.name = "ReflowAPIError";
    this.status = status;
    this.data = data;
  }
}

function errorResponse(message: String = "", status: number = 422): Response {
  return new Response(JSON.stringify({ error: message, success: false }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
