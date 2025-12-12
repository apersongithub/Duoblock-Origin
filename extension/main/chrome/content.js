// content.js — selects and injects the desired mode into Duolingo
(async function () {
  const host = location.hostname;
  const isDuolingo =
    host === "www.duolingo.com" ||
    host === "duolingo.com" ||
    host.endsWith(".duolingo.com");

  if (!isDuolingo) return;

  try {
    const { mode } = await chrome.storage.sync.get("mode");
    const selectedMode = mode === "hard" ? "hard" : "soft";

    const url = chrome.runtime.getURL(
      selectedMode === "hard" ? "modes/hard-block.js" : "modes/soft-block.js"
    );

    const script = document.createElement("script");
    script.src = url;
    script.type = "text/javascript";
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
    script.onerror = (e) => {
      console.error("[Duolingo AdBlock] Failed to load mode script:", url, e);
    };
  } catch (e) {
    console.error("[Duolingo AdBlock] Initialization error:", e);
  }
})();