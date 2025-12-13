// Initialize default mode to "soft" if not set
chrome.runtime.onInstalled.addListener(async () => {
  const { mode, enableProfileShortcut } = await chrome.storage.sync.get(["mode", "enableProfileShortcut"]);
  const toSet = {};
  if (!mode) toSet.mode = "soft";
  if (enableProfileShortcut === undefined) toSet.enableProfileShortcut = true; // default ON
  if (Object.keys(toSet).length) await chrome.storage.sync.set(toSet);
});

// Reload Duolingo tabs when mode changes to ensure clean injection of the new mode
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "sync") return;
  if (changes.mode || changes.enableProfileShortcut) {
    const what = changes.mode ? `mode: ${changes.mode.oldValue} -> ${changes.mode.newValue}` : 'enableProfileShortcut toggled';
    console.log(`[Duolingo AdBlock] Setting changed (${what}). Reloading Duolingo tabs...`);

    const tabs = await chrome.tabs.query({
      url: ["https://*.duolingo.com/*", "https://*.duolingo.cn/*"]
    });
    for (const t of tabs) {
      if (t.id) chrome.tabs.reload(t.id);
    }
  }
});

// Accept external message (from injected page bridge) to open options
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message && message.openOptions === true) {
    chrome.runtime.openOptionsPage();
    sendResponse?.({ status: "opened" });
  }
});

// Also accept internal messages (from our own content script), for robustness
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.openOptions === true) {
    chrome.runtime.openOptionsPage();
    sendResponse?.({ status: "opened" });
  }
});