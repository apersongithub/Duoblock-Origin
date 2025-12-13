// Runs in page context (CSP-safe external script). Defines the function used by inline onclick.
(function () {
  if (window.openExtensionOptions) return;
  window.openExtensionOptions = function () {
    // Post a message the content script listens for
    window.postMessage({ type: "DUOBLOCK_OPEN_OPTIONS" }, "*");
  };
})();