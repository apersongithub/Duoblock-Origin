document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("modeForm");
  const statusEl = document.getElementById("status");

  // Load current setting
  const { mode } = await chrome.storage.sync.get("mode");
  const current = mode || "soft";
  const input = form.querySelector(`input[name="mode"][value="${current}"]`);
  if (input) input.checked = true;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const selected = form.querySelector('input[name="mode"]:checked')?.value || "soft";
    await chrome.storage.sync.set({ mode: selected });
    statusEl.textContent = `Saved: ${selected.toUpperCase()} mode`;

    // Reload active Duolingo tab (nice UX) while background.js reloads all duolingo tabs
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab?.url && /https:\/\/(.+\.)?duolingo\.com\//.test(tab.url)) {
        chrome.tabs.reload(tab.id);
      }
    } catch {}

    setTimeout(() => (statusEl.textContent = ""), 2000);
  });
});