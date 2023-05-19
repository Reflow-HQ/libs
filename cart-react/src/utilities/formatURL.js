export default function formatURL(url, queryParams = {}) {
  try {
    if (!url) throw Error("invalid");
    // Turns relative URLs into absolute ones using the current URL as a base.
    // This gives users the ability to pass relative addresses and they will be resolved correctly.

    let formattedURL = new URL(url, window.location.href);

    // Add the search parameters. It's done this way instead of with url.searchParams
    // because of Stripe's session_id={CHECKOUT_SESSION_ID} which is escaped with searchParams.

    let search = formattedURL.search;

    for (const key in queryParams) {
      search += !search.length ? "?" : "&";
      search += `${key}=${queryParams[key]}`;
    }

    formattedURL.search = search;

    return formattedURL.href;
  } catch (e) {
    return window.location.href;
  }
}
