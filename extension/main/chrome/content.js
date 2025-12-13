// content.js — injects selected mode and adds an in-page "DUOBLOCK ORIGIN" shortcut.
// Desktop: clones Home/Shop-style nav item and places it BEFORE the parent <div> containing data-test="more-nav".
// Mobile: clones the Quests entry found via <a href="/quests" aria-label="...">, then inserts the duplicate
// right after the original quests link. The duplicate's <img> src/srcset are set to imglink and it opens the options page on click.
(async function () {
  'use strict';

const host = location.hostname;
const isDuolingo =
  host === "duolingo.com" ||
  host.endsWith(".duolingo.com") ||
  host === "duolingo.cn" ||
  host.endsWith(".duolingo.cn");
if (!isDuolingo) return;

  // Configurable image link for icons inside the duplicated elements
  const imglink = "https://raw.githubusercontent.com/apersongithub/Duoblock-Origin/refs/heads/main/extension/main/chrome/images/icon-128.png";

  // Open options page directly (simple and reliable)
  function openOptions() {
    if (chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      chrome.runtime?.sendMessage({ openOptions: true });
    }
  }

  // Utility: wait for a selector to appear
  function waitForElement(selector, { root = document, timeout = 20000 } = {}) {
    return new Promise((resolve, reject) => {
      const el = root.querySelector(selector);
      if (el) return resolve(el);
      const obs = new MutationObserver(() => {
        const node = root.querySelector(selector);
        if (node) {
          obs.disconnect();
          resolve(node);
        }
      });
      obs.observe(root, { subtree: true, childList: true });
      if (timeout > 0) {
        setTimeout(() => {
          try { obs.disconnect(); } catch {}
          reject(new Error(`Timeout waiting for ${selector}`));
        }, timeout);
      }
    });
  }

  async function waitForBody() {
    if (document.body) return document.body;
    await new Promise(res => {
      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', res, { once: true });
      } else {
        const obs = new MutationObserver(() => {
          if (document.body) { obs.disconnect(); res(); }
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
      }
    });
    return document.body || document.documentElement;
  }

  // Build a DOM path from root -> target based on element-child indices
  function computeElementPath(root, target) {
    const path = [];
    let node = target;
    while (node && node !== root) {
      const parent = node.parentElement;
      if (!parent) break;
      const index = Array.prototype.indexOf.call(parent.children, node);
      path.unshift(index);
      node = parent;
    }
    return path;
  }

  // Traverse a path on a cloned root to get the corresponding node
  function traversePath(root, path) {
    let node = root;
    for (const idx of path) {
      node = node?.children?.[idx];
      if (!node) break;
    }
    return node || null;
  }

  // Find a label-like element inside a given root: choose the last non-trivial text leaf
  function findLabelElement(root) {
    const candidates = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    let n;
    while ((n = walker.nextNode())) {
      const el = n;
      if (el.children.length === 0) {
        const txt = (el.textContent || "").trim();
        if (txt.length > 0) candidates.push(el);
      }
    }
    if (candidates.length === 0) return null;
    const nonInitials = candidates.filter(el => el.textContent.trim().length > 1);
    return nonInitials[nonInitials.length - 1] || candidates[candidates.length - 1];
  }

  async function injectDesktopShortcut() {
    // Use shop-nav if present; fallback to home-nav for robustness
    const anchor =
      document.querySelector('a[data-test="shop-nav"]') ||
      await waitForElement('a[data-test="shop-nav"]', { timeout: 1500 }).catch(() => null) ||
      document.querySelector('a[data-test="quests-nav"]') ||
      await waitForElement('a[data-test="quests-nav"]', { timeout: 20000 }).catch(() => null);

    if (!anchor) return;

    const parent = anchor.parentElement;
    if (!parent) return;

    const moreNavButton = document.querySelector('div[data-test="more-nav"]') ||
                          await waitForElement('div[data-test="more-nav"]', { timeout: 5000 }).catch(() => null);
    const moreParent = moreNavButton ? moreNavButton.parentElement : null;

    if (document.getElementById('duoblock-origin-shop-shortcut')) return;

    const origLabelEl = findLabelElement(anchor);
    const labelPath = origLabelEl ? computeElementPath(anchor, origLabelEl) : null;

    const cloneParent = parent.cloneNode(true);
    cloneParent.id = 'duoblock-origin-shop-shortcut';
    cloneParent.style.cursor = 'pointer';

    let cloneAnchor = cloneParent.querySelector('a') || cloneParent.getElementsByTagName('a')[0];

    if (cloneAnchor) {
      cloneAnchor.removeAttribute('data-test');
      cloneAnchor.setAttribute('href', '#');

      const imgs = cloneAnchor.querySelectorAll('img');
      imgs.forEach(img => {
        img.src = imglink;
        if (img.srcset) img.srcset = imglink;
      });

      let cloneLabelEl = labelPath ? traversePath(cloneAnchor, labelPath) : null;
      if (!cloneLabelEl) cloneLabelEl = findLabelElement(cloneAnchor);

      if (cloneLabelEl) {
        cloneLabelEl.textContent = 'DUOBLOCK ORIGIN';
        cloneLabelEl.setAttribute('aria-label', 'Duoblock Origin');
      } else {
        const span = document.createElement('span');
        span.textContent = 'DUOBLOCK ORIGIN';
        cloneAnchor.appendChild(span);
      }

      cloneAnchor.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openOptions();
      }, { capture: true });
    }

    if (moreParent && moreParent.parentElement) {
      moreParent.parentElement.insertBefore(cloneParent, moreParent);
    } else {
      parent.insertAdjacentElement('afterend', cloneParent);
    }
  }

  // Mobile: Find anchor <a href="/quests" aria-label>; duplicate it, replace image src with imglink,
  // and insert the duplicate directly after the original quests link.
  async function injectMobileShortcut() {
    const questsLink =
      document.querySelector('a[href="/quests"][aria-label]') ||
      await waitForElement('a[href="/quests"][aria-label]', { root: document, timeout: 8000 }).catch(() => null);

    if (!questsLink) return;

    if (questsLink.nextElementSibling && questsLink.nextElementSibling.id === 'duoblock-origin-mobile-shortcut') return;

    const cloneAnchor = questsLink.cloneNode(true);
    cloneAnchor.id = 'duoblock-origin-mobile-shortcut';
    cloneAnchor.setAttribute('href', '#'); // prevent navigation
    cloneAnchor.style.cursor = 'pointer';

    const imgs = cloneAnchor.querySelectorAll('img');
    imgs.forEach(img => {
      img.src = imglink;
      if (img.srcset) img.srcset = imglink;
    });

    cloneAnchor.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openOptions();
    }, { capture: true });

    questsLink.insertAdjacentElement('afterend', cloneAnchor);
  }

  const isMobileViewport = () => window.matchMedia('(max-width: 768px)').matches;

  async function injectShortcuts() {
    if (isMobileViewport()) {
      await injectMobileShortcut();
    } else {
      await injectDesktopShortcut();
    }
    // Try both in case detection is imperfect or layout changes
    await injectMobileShortcut();
    await injectDesktopShortcut();
  }

  try {
    const { mode, enableProfileShortcut } = await chrome.storage.sync.get(["mode", "enableProfileShortcut"]);
    const selectedMode = mode === "hard" ? "hard" : mode === "extreme" ? "extreme" : "soft";
    const url = chrome.runtime.getURL(
      selectedMode === "hard"
        ? "modes/hard-block.js"
        : selectedMode === "extreme"
        ? "modes/extreme-block.js"
        : "modes/soft-block.js"
    );

    const script = document.createElement("script");
    script.src = url;
    script.type = "text/javascript";
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
    script.onerror = (e) => {
      console.error("[Duoblock Origin] Failed to load mode script:", url, e);
    };

    const featureEnabled = enableProfileShortcut !== false; // default ON
    if (featureEnabled) {
      await injectShortcuts();

      const targetNode = await waitForBody();
      const observeNode = targetNode instanceof Node ? targetNode : document.documentElement;

      let scheduled = false;
      const mo = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        setTimeout(() => {
          injectShortcuts().finally(() => { scheduled = false; });
        }, 300);
      });
      mo.observe(observeNode, { childList: true, subtree: true });

      window.addEventListener('resize', () => {
        if (scheduled) return;
        scheduled = true;
        setTimeout(() => {
          injectShortcuts().finally(() => { scheduled = false; });
        }, 300);
      });
    }
  } catch (e) {
    console.error("[Duoblock Origin] Initialization error:", e);
  }
})();