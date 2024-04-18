export default class Api {
  constructor({ projectID, apiBase, testMode = false }) {
    this.projectID = projectID;
    this.apiBase = apiBase || `https://${testMode ? "test-" : ""}api.reflowhq.com/v2`;
    this.testMode = testMode || false;

    this.apiCache = new Map();
  }

  fetch(endpoint, options = {}, cacheEnabled = false) {
    try {
      if (typeof endpoint != "string" || !endpoint.trim().length) {
        return Promise.reject("Reflow: Endpoint Required");
      }

      endpoint = endpoint.replace(/^\/+/, "");

      const method = options.method ? options.method.toUpperCase() : "GET";

      const body =
        options.body instanceof Object
          ? new URLSearchParams(options.body).toString()
          : typeof options.body === "string"
          ? options.body
          : "";

      const requestKey = endpoint + method + body;

      if (cacheEnabled && this.apiCache.has(requestKey)) {
        return this.apiCache.get(requestKey);
      }

      const result = fetch(this.apiBase + "/projects/" + this.projectID + "/" + endpoint, options).then(
        async (response) => {
          let data = await response.json();

          if (cacheEnabled) {
            this.apiCache.delete(requestKey);
          }

          if (!response.ok) {
            let message = "HTTP error";
            if (data.error) message = data.error;
            if (data.errors?.system) message = data.errors.system;
            let err = Error(message);
            err.status = response.status;
            err.data = data;
            throw err;
          }

          return data;
        }
      );

      if (cacheEnabled) {
        this.apiCache.set(requestKey, result);
      }

      return result;
    } catch (e) {
      console.error("Reflow: " + e);
      if (e.data) console.error(e.data);
      if (e.error) console.error(e.error);

      throw e;
    }
  }
}
