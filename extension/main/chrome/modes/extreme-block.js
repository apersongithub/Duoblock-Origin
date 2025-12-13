(function () {
  'use strict';
  const log = (msg) => console.log(`[Duo Extreme] ${msg}`);

  // Idempotent guard
  if (window.__duoExtremeInjected) { log('Extreme mode already injected; skipping.'); return; }
  window.__duoExtremeInjected = true;

  // --- 1. Duo Proxy to force upsell suppression without redefining non-configurable props ---
  function installDuoProxy() {
    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    win.duo = win.duo || {};

    const target = win.duo;
    const proxy = new Proxy(target, {
      get(t, p, r) {
        if (p === 'disableMonetization') return true; // the app checks this
        return Reflect.get(t, p, r);
      },
      set(t, p, v, r) {
        if (p === 'disableMonetization') return true; // ignore any attempt to change
        return Reflect.set(t, p, v, r);
      }
    });

    const duoDesc = Object.getOwnPropertyDescriptor(win, 'duo');
    if (!duoDesc || duoDesc.writable || duoDesc.configurable) {
      win.duo = proxy;
      log('Installed duo Proxy (Extreme mode).');
    } else {
      log('Cannot replace window.duo; continuing without Proxy.');
    }
  }

  installDuoProxy();
  window.addEventListener('load', installDuoProxy, { once: true });

  // --- 2. Block Third-Party Ads via API Interception (same as hard-block) ---
  const TARGET_REGEX = /\/users\/\d+/;

  function modifyJson(jsonText) {
    try {
      const data = JSON.parse(jsonText);

      // If this is the user profile payload
      if (data && typeof data === 'object' && (data.hasOwnProperty('adsConfig') || data.hasOwnProperty('advertising'))) {
        log('Nuking ad configuration...');
        data.adsConfig = null;
        data.advertising = null;
        data.adsEnabled = false;

        // Keep user as free (mirror hard-block behavior)
        data.hasPlus = false;
        data.has_plus = false;
        data.isSuper = false;

        if (Array.isArray(data.roles)) {
          data.roles = data.roles.filter(r =>
            r !== "PLUS_SUBSCRIBER" &&
            r !== "GOLD_SUBSCRIBER"
          );
        }
        if (Array.isArray(data.shopItems)) {
          log('Cleaning Inventory/Shop...');
          data.shopItems = data.shopItems.filter(item =>
            item?.itemName &&
            item.itemName !== 'premium_subscription' &&
            item.itemName !== 'gold_subscription' &&
            !item.itemName.includes('immersive_subscription')
          );
        }
      }
      return JSON.stringify(data);
    } catch (e) {
      return jsonText;
    }
  }

  // Hook Fetch (guard)
  if (!window.__duoExtremeFetchHooked) {
    window.__duoExtremeFetchHooked = true;
    const originalFetch = window.fetch;
    window.fetch = function (resource) {
      const url = resource instanceof Request ? resource.url : resource;
      if (typeof url === 'string' && TARGET_REGEX.test(url)) {
        return originalFetch.apply(this, arguments).then(async (response) => {
          const clone = response.clone();
          try {
            const text = await clone.text();
            const modified = modifyJson(text);
            return new Response(modified, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
          } catch {
            return response;
          }
        });
      }
      return originalFetch.apply(this, arguments);
    };
  }

  // Hook XHR (guard)
  if (!window.__duoExtremeXhrHooked) {
    window.__duoExtremeXhrHooked = true;
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this._url = url;
      return originalOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      if (this._url && TARGET_REGEX.test(this._url)) {
        const xhr = this;
        const originalOnReadyStateChange = xhr.onreadystatechange;
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
            try {
              const modified = modifyJson(xhr.responseText);
              Object.defineProperty(xhr, 'responseText', { value: modified });
              Object.defineProperty(xhr, 'response', { value: modified });
            } catch { }
          }
          if (originalOnReadyStateChange) originalOnReadyStateChange.apply(this, arguments);
        };
      }
      return originalSend.apply(this, arguments);
    };
  }

  // --- 3. Remove upsell offer UI aggressively: find [data-test="plus-offer-logo"], go 1 parent up, remove that element ---
  function removePlusOfferContainers() {
    const logos = document.querySelectorAll('[data-test="plus-offer-logo"]');
    logos.forEach(el => {
      const target = el && el.parentElement; // one parent up
      if (target && !target.__duoExtremeRemoved) {
        target.__duoExtremeRemoved = true;
        try {
          target.remove();
          log('Removed a plus offer container (1 parent above logo).');
        } catch {
          target.style.display = 'none';
          log('Hidden a plus offer container (fallback).');
        }
      }
    });
  }

  function observePlusOffers() {
    const node = document.body || document.documentElement;
    const mo = new MutationObserver(() => {
      removePlusOfferContainers();
    });
    mo.observe(node, { childList: true, subtree: true });
  }

  // Run now and on load
  removePlusOfferContainers();
  window.addEventListener('DOMContentLoaded', removePlusOfferContainers, { once: true });
  window.addEventListener('load', removePlusOfferContainers, { once: true });
  observePlusOffers();
})();