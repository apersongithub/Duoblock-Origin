(function () {
  'use strict';
  const log = (msg) => console.log(`[Duo Unlocker] ${msg}`);

  // Idempotent guard
  if (window.__duoSoftInjected) { log('Soft mode already injected; skipping.'); return; }
  window.__duoSoftInjected = true;

  // --- 1. CSS Hiding ---
  try {
    const style = document.createElement('style');
    style.innerHTML = `.MGk8p{display:none!important;}`;
    (document.head || document.documentElement).appendChild(style);
  } catch {}

  // --- 2. Duo Proxy (avoid locking non-configurable props) ---
  function installDuoProxy() {
    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    win.duo = win.duo || {};

    const target = win.duo;
    const proxy = new Proxy(target, {
      get(t, p, r) {
        if (p === 'disableMonetization') return true;
        if (p === 'hasPlus' || p === 'has_plus' || p === 'isSuper') return true;
        return Reflect.get(t, p, r);
      },
      set(t, p, v, r) {
        if (p === 'disableMonetization') return true; // ignore writes to keep true
        return Reflect.set(t, p, v, r);
      }
    });

    const duoDesc = Object.getOwnPropertyDescriptor(win, 'duo');
    if (!duoDesc || duoDesc.writable || duoDesc.configurable) {
      win.duo = proxy;
      log('Installed duo Proxy (Soft mode).');
    } else {
      log('Cannot replace window.duo; continuing without Proxy.');
    }
  }
  installDuoProxy();
  window.addEventListener('load', installDuoProxy, { once: true });

  // --- 3. API Interception ---
  const TARGET_REGEX = /(\/users\/\d+|\/shop-items)/;

  function modifyJson(jsonText) {
    try {
      const data = JSON.parse(jsonText);
      if (data && typeof data === 'object') {
        // PROFILE DATA (User Config)
        if ('hasPlus' in data || 'has_plus' in data) {
          log('Patching Profile...');
          data.hasPlus = true;
          data.has_plus = true;
          data.isSuper = true;

          data.adsConfig = null;
          data.adsEnabled = null;

          if (Array.isArray(data.roles) && !data.roles.includes('PLUS_SUBSCRIBER')) {
            data.roles.push('PLUS_SUBSCRIBER');
          }
        }
      }
      return JSON.stringify(data);
    } catch {
      return jsonText;
    }
  }

  // Hook Fetch (guard)
  if (!window.__duoSoftFetchHooked) {
    window.__duoSoftFetchHooked = true;
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
  if (!window.__duoSoftXhrHooked) {
    window.__duoSoftXhrHooked = true;
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (m, u) {
      this._url = u;
      return originalOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      if (this._url && TARGET_REGEX.test(this._url)) {
        const xhr = this;
        const prev = xhr.onreadystatechange;
        xhr.onreadystatechange = function () {
          if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300) {
            try {
              const modified = modifyJson(xhr.responseText);
              Object.defineProperty(xhr, 'responseText', { value: modified });
              Object.defineProperty(xhr, 'response', { value: modified });
            } catch {}
          }
          if (prev) prev.apply(this, arguments);
        };
      }
      return originalSend.apply(this, arguments);
    };
  }
})();