// Initialize default mode to "soft" if not set
chrome.runtime.onInstalled.addListener(async () => {
  const { mode, enableProfileShortcut } = await chrome.storage.sync.get(["mode", "enableProfileShortcut"]);
  const toSet = {};
  if (!mode) toSet.mode = "soft";
  if (enableProfileShortcut === undefined) toSet.enableProfileShortcut = true; // default ON
  if (Object.keys(toSet).length) await chrome.storage.sync.set(toSet);

  // Ensure icon reflects current active tab at install
  updateActiveTabIcon().catch(() => {});
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

  // Re-evaluate icon when settings change
  updateActiveTabIcon().catch(() => {});
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

//
// Dynamic icon logic: grayscale when not on Duolingo or options page
//

// Reuse available color icons; fall back to using the same grayscale for all sizes
const colorIconPaths = {
  16: "images/icon-16.png",
  48: "images/icon-48.png",
  128: "images/icon-128.png"
};

const grayscaleIconPaths = {
  16: "images/icon-16-grayscale.png",
  48: "images/icon-48-grayscale.png",
  128: "images/icon-128-grayscale.png"
};

const optionsUrlPrefix = chrome.runtime.getURL("options.html");
const duoPatterns = [
  /^https:\/\/(?:[^/]+\.)?duolingo\.com\//,
  /^https:\/\/(?:[^/]+\.)?duolingo\.cn\//
];

function isInUse(url) {
  if (!url) return false;
  try {
    // Active/in-use if Duolingo or our options page
    return duoPatterns.some((re) => re.test(url)) || url.startsWith(optionsUrlPrefix);
  } catch {
    return false;
  }
}

async function updateActiveTabIcon() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const inUse = isInUse(tab.url || "");
    await chrome.action.setIcon({
      path: inUse ? colorIconPaths : grayscaleIconPaths,
      tabId: tab.id
    });
  } catch (e) {
    console.error("[Duoblock Origin] Failed to set action icon:", e);
  }
}

// Update icon when switching tabs, changing windows, or navigating
chrome.tabs.onActivated.addListener(() => {
  updateActiveTabIcon().catch(() => {});
});

chrome.windows.onFocusChanged.addListener(() => {
  updateActiveTabIcon().catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // React when URL changes or when the page finishes loading for the active tab
  if (!tab?.active) return;
  if (changeInfo.url !== undefined || changeInfo.status === "complete") {
    updateActiveTabIcon().catch(() => {});
  }
});

// Also set the correct icon as soon as the service worker starts
updateActiveTabIcon().catch(() => {});