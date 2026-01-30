import "@testing-library/jest-dom";

// jsdom does not provide Response/fetch; polyfill so tests can use real Response (e.g. makeJsonResponse).
if (typeof globalThis.Response === "undefined") {
  require("cross-fetch/polyfill");
}
