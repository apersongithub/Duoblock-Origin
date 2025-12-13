document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("modeForm");
  const statusEl = document.getElementById("status");
  const modeInputs = form.querySelectorAll('input[name="mode"]');
  const profileShortcutInput = document.getElementById("enableProfileShortcut");
  const closeBtn = document.getElementById("closeBtn");

  // Load settings
  const { mode, enableProfileShortcut } = await chrome.storage.sync.get(["mode", "enableProfileShortcut"]);
  const currentMode = mode || "soft";
  const currentInput = form.querySelector(`input[name="mode"][value="${currentMode}"]`);
  if (currentInput) currentInput.checked = true;

  // Default feature: enabled if undefined
  profileShortcutInput.checked = enableProfileShortcut !== false;

  function showStatus(text) {
    statusEl.textContent = text;
    statusEl.style.opacity = "1";
    setTimeout(() => {
      statusEl.style.opacity = "0";
      setTimeout(() => (statusEl.textContent = ""), 300);
    }, 1200);
  }

  async function reloadActiveDuoTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab?.url && /https:\/\/(.+\.)?duolingo\.com\//.test(tab.url)) {
        chrome.tabs.reload(tab.id);
      }
    } catch (err) {
      console.error("Error reloading tab:", err);
    }
  }

  // Save on mode change (supports soft, hard, extreme)
  modeInputs.forEach((input) => {
    input.addEventListener("change", async (event) => {
      const selected = event.target.value; // "soft" | "hard" | "extreme"
      await chrome.storage.sync.set({ mode: selected });
      showStatus("Saved");
      reloadActiveDuoTab();
    });
  });

  // Save on feature toggle
  profileShortcutInput.addEventListener("change", async () => {
    const enabled = profileShortcutInput.checked;
    await chrome.storage.sync.set({ enableProfileShortcut: enabled });
    showStatus(enabled ? "Enabled" : "Disabled");
    reloadActiveDuoTab();
  });

  // Close options tab using Chrome Tabs API
  closeBtn?.addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.remove(tab.id);
      }
    } catch (e) {
      console.error("Failed to close tab via chrome.tabs.remove:", e);
    }
  });
});