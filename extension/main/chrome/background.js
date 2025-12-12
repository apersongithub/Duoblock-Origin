// Initialize default mode to "soft" if not set
chrome.runtime.onInstalled.addListener(async () => {
  const { mode } = await chrome.storage.sync.get("mode");
  if (!mode) {
    await chrome.storage.sync.set({ mode: "soft" });
  }
});

// Reload Duolingo tabs when mode changes to ensure clean injection of the new mode
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== "sync" || !changes.mode) return;
  const newMode = changes.mode.newValue;
  console.log(`[Duolingo AdBlock] Mode changed: ${changes.mode.oldValue} -> ${newMode}. Reloading Duolingo tabs...`);

  const tabs = await chrome.tabs.query({
    url: ["https://www.duolingo.com/*", "https://*.duolingo.com/*"]
  });
  for (const t of tabs) {
    if (t.id) chrome.tabs.reload(t.id);
  }
});