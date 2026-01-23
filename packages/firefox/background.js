// IOTA Names Resolver - Service Worker (Manifest V3)
// - Detect navigations to *.iota and resolve via JSON-RPC method iotax_iotaNamesLookup.
// - If a website record is found (configurable key list), redirect to it; otherwise show resolve.html.
// - Provides omnibox keyword "iota" to work around Browser treating bare "name.iota" as search.

const DEFAULTS = {
  network: "mainnet", // mainnet|testnet|devnet|custom
  rpcUrl: "https://api.mainnet.iota.cafe:443",
  // Opt-in: redirecting users away from the entered .iota URL must be explicitly enabled.
  autoRedirect: false,
  websiteKeys: ["website", "url", "web", "homepage", "link"],
  showDetailsWhenNoWebsite: true,
  cacheTtlMs: 5 * 60 * 1000,
  // Optional feature: allow resolving selected text via keyboard shortcut.
  // Requires optional permissions: activeTab + scripting.
  // Enable/disable context menu entries.
  contextMenusEnabled: true,
};

// --- Per-tab state ---
const LAST_PREFIX = "last:";

async function setLastForTab(tabId, payload) {
  return chrome.storage.local.set({ [LAST_PREFIX + tabId]: payload });
}

async function getLastForTab(tabId) {
  const key = LAST_PREFIX + tabId;
  const stored = await chrome.storage.local.get(key);
  return stored[key] ?? null;
}

async function clearLastForTab(tabId) {
  return chrome.storage.local.remove(LAST_PREFIX + tabId);
}

if (chrome?.tabs?.onRemoved?.addListener) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    clearLastForTab(tabId).catch(() => {});
  });
}

const cache = new Map(); // key -> {value, expiresAt}

function now() { return Date.now(); }

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

function isIotaHost(hostname) {
  return typeof hostname === "string" && hostname.toLowerCase().endsWith(".iota");
}

function hasNoRedirectHint(url) {
  try {
    const q = (
      url.searchParams.get("inr_no_redirect") ||
      url.searchParams.get("inrNoRedirect") ||
      url.searchParams.get("inr-no-redirect") ||
      ""
    ).toLowerCase();
    if (q && q !== "0" && q !== "false" && q !== "no") return true;

    const h = (url.hash || "").toLowerCase();
    if (h.includes("inr-no-redirect") || h.includes("inr_no_redirect")) return true;
  } catch (_) {}
  return false;
}

function normalizeHttpUrl(value) {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch (_) {
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) return "https://" + s;
  }
  return null;
}

function pickWebsiteUrl(dataObj, websiteKeys) {
  if (!dataObj || typeof dataObj !== "object") return null;

  for (const k of websiteKeys || []) {
    const v = dataObj[k];
    const url = normalizeHttpUrl(v);
    if (url) return url;
  }
  for (const v of Object.values(dataObj)) {
    const url = normalizeHttpUrl(String(v));
    if (url) return url;
  }
  return null;
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < now()) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, expiresAt: now() + ttlMs });
}

function inferIndexerUrl(rpcUrl) {
  // Per docs: https://api.NETWORK.iota.cafe:443 and https://indexer.NETWORK.iota.cafe:443
  try {
    const u = new URL(rpcUrl);
    u.hostname = u.hostname.replace(/^api\./, "indexer.");
    return u.toString();
  } catch (_) {
    return rpcUrl;
  }
}

async function rpcCall(url, method, params) {
  const body = { jsonrpc: "2.0", id: 1, method, params };
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.error) {
    const msg = json.error.message || "RPC error";
    const code = json.error.code;
    const err = new Error(`${msg} (code ${code})`);
    err.rpc = json.error;
    throw err;
  }
  return json.result;
}

async function resolveIotaName(name) {
  const settings = await getSettings();
  const cacheKey = `resolve:${settings.rpcUrl}:${name}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let result;
  try {
    result = await rpcCall(settings.rpcUrl, "iotax_iotaNamesLookup", [name]);
  } catch (e) {
    const fallback = inferIndexerUrl(settings.rpcUrl);
    if (fallback !== settings.rpcUrl) {
      result = await rpcCall(fallback, "iotax_iotaNamesLookup", [name]);
      await chrome.storage.sync.set({ rpcUrl: fallback });
    } else {
      throw e;
    }
  }

  cacheSet(cacheKey, result, settings.cacheTtlMs);
  return result;
}

function buildDetailsUrl(name, tabId) {
  const u = new URL(chrome.runtime.getURL("resolve.html"));
  u.searchParams.set("name", name);
  if (typeof tabId === "number") u.searchParams.set("tabId", String(tabId));
  return u.toString();
}

function buildRedirectPreviewUrl({ name, tabId, fromUrl, targetUrl }) {
  const u = new URL(chrome.runtime.getURL("redirect.html"));
  u.searchParams.set("name", name);
  u.searchParams.set("target", targetUrl);
  if (typeof tabId === "number") u.searchParams.set("tabId", String(tabId));
  if (fromUrl) u.searchParams.set("from", fromUrl);
  return u.toString();
}

// --- Context menu helpers ---


function selectionToIotaName(selectionText) {
  if (typeof selectionText !== "string") return null;
  let s = selectionText.trim();
  if (!s) return null;

  // Strip common surrounding punctuation/quotes.
  const STRIP = /^[\s"'()\[\]{}<>]+|[\s"'()\[\]{}<>.,;:!?…]+$/g;
  s = s.replace(STRIP, "");
  if (!s) return null;

  // If it's a URL, extract its hostname.
  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) {
      const u = new URL(s);
      s = u.hostname || "";
    }
  } catch (_) {
    // ignore
  }

  // If it's something like "name.iota/path", take the host part.
  s = s.split(/[\/\?#]/)[0];
  if (!s) return null;

  s = s.toLowerCase();

  // Reject userinfo or whitespace.
  if (/[\s@]/.test(s)) return null;

  // If it's a single label, add .iota; if it already ends with .iota keep it.
  if (!s.endsWith(".iota")) {
    if (s.includes(".")) return null; // avoid converting e.g. example.com
    s = `${s}.iota`;
  }

  // Basic hostname validation: labels 1..63, allowed chars a-z0-9- (punycode xn-- allowed).
  if (s.length > 253) return null;
  if (s.startsWith(".") || s.endsWith(".") || s.includes("..")) return null;

  const labels = s.split(".");
  if (labels.length < 2 || labels[labels.length - 1] !== "iota") return null;

  const labelRe = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?|xn--[a-z0-9-]{1,59})$/;
  for (const lab of labels) {
    if (!lab || lab.length > 63) return null;
    if (!labelRe.test(lab)) return null;
  }

  return s;
}

async function openIotaName(name, { details = false } = {}) {
  if (!name) return;
  const url = details ? `https://${name}/?inr_no_redirect=1` : `https://${name}/`;
  try {
    await chrome.tabs.create({ url });
  } catch (_) {
    try {
      await chrome.tabs.update({ url });
    } catch (_) {
      // ignore
    }
  }
}



const CONTEXT_MENU_IDS = {
  resolve: "inr_resolve",
  resolveDetails: "inr_resolve_details",
};

async function syncContextMenus() {
  if (!chrome?.contextMenus?.create) return;

  let enabled = true;
  try {
    const settings = await getSettings();
    enabled = settings.contextMenusEnabled !== false;
  } catch (_) {
    enabled = true;
  }

  try {
    await chrome.contextMenus.removeAll();
  } catch (_) {
    // ignore
  }

  if (!enabled) return;

  const titleResolve = chrome.i18n.getMessage("ctxResolve") || "Resolve IOTA Name: %s";
  const titleDetails = chrome.i18n.getMessage("ctxResolveDetails") || "Resolve IOTA Name (Details): %s";

  try {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.resolve,
      title: titleResolve,
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.resolveDetails,
      title: titleDetails,
      contexts: ["selection"],
    });
  } catch (_) {
    // ignore
  }
}

if (chrome?.runtime?.onInstalled?.addListener) {
  chrome.runtime.onInstalled.addListener(() => syncContextMenus());
}
if (chrome?.runtime?.onStartup?.addListener) {
  chrome.runtime.onStartup.addListener(() => syncContextMenus());
}
if (chrome?.storage?.onChanged?.addListener) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;
    if (changes && Object.prototype.hasOwnProperty.call(changes, "contextMenusEnabled")) {
      syncContextMenus();
    }
  });
}

if (chrome?.contextMenus?.onClicked?.addListener) {
  chrome.contextMenus.onClicked.addListener(async (info) => {
    const name = selectionToIotaName(info?.selectionText || "");
    if (!name) return;
    if (info.menuItemId === CONTEXT_MENU_IDS.resolve) return openIotaName(name, { details: false });
    if (info.menuItemId === CONTEXT_MENU_IDS.resolveDetails) return openIotaName(name, { details: true });
  });
}


async function handleNavigation(details) {
  try {
    if (details.frameId !== 0) return;
    if (!details.url) return;

    const url = new URL(details.url);
    if (!(url.protocol === "http:" || url.protocol === "https:")) return;

    // Avoid infinite loop on our internal pages.
    const internal = new URL(chrome.runtime.getURL("resolve.html"));
    if (url.origin === internal.origin) {
      if (url.pathname.endsWith("/resolve.html") || url.pathname.endsWith("/redirect.html")) return;
    }

    if (!isIotaHost(url.hostname)) return;

    const name = url.hostname;
    const settings = await getSettings();
    const noRedirectHint = hasNoRedirectHint(url);

    const record = await resolveIotaName(name);
    const websiteUrl = pickWebsiteUrl(record?.data, settings.websiteKeys);

    const payload = { name, record, websiteUrl, resolvedAt: new Date().toISOString() };
    await setLastForTab(details.tabId, payload);

    if (noRedirectHint) {
      await chrome.tabs.update(details.tabId, { url: buildDetailsUrl(name, details.tabId) });
      return;
    }

    if (settings.autoRedirect && websiteUrl) {
      // try to preserve path/query/hash when destination is origin-only
      let finalUrl = websiteUrl;
      try {
        const dest = new URL(websiteUrl);
        if ((dest.pathname === "/" || dest.pathname === "") && url.pathname && url.pathname !== "/") {
          dest.pathname = url.pathname;
        }
        if (!dest.search && url.search) dest.search = url.search;
        if (!dest.hash && url.hash) dest.hash = url.hash;
        finalUrl = dest.toString();
      } catch (_) {}
      // Show a short preview of the destination URL so the user can abort.
      const previewUrl = buildRedirectPreviewUrl({
        name,
        tabId: details.tabId,
        fromUrl: details.url,
        targetUrl: finalUrl,
      });
      await chrome.tabs.update(details.tabId, { url: previewUrl });
      return;
    }

    if (settings.showDetailsWhenNoWebsite) {
      await chrome.tabs.update(details.tabId, { url: buildDetailsUrl(name, details.tabId) });
    }
  } catch (e) {
    try {
      const u = new URL(details.url);
      const name = isIotaHost(u.hostname) ? u.hostname : "(unknown)";
      const payload = { name, error: String(e?.message || e), resolvedAt: new Date().toISOString() };
      await setLastForTab(details.tabId, payload);
      await chrome.tabs.update(details.tabId, { url: buildDetailsUrl(name, details.tabId) });
    } catch (_) {}
  }
}

if (chrome?.webNavigation?.onBeforeNavigate?.addListener) {
  try {
    chrome.webNavigation.onBeforeNavigate.addListener(handleNavigation, {
      url: [{ hostSuffix: "iota", schemes: ["http", "https"] }],
    });
  } catch (_) {
    // Some browsers (notably Safari) have partial support for webNavigation filters.
    chrome.webNavigation.onBeforeNavigate.addListener(handleNavigation);
  }
}

const hasOmnibox =
  chrome?.omnibox &&
  typeof chrome.omnibox.setDefaultSuggestion === "function" &&
  chrome.omnibox.onInputEntered &&
  typeof chrome.omnibox.onInputEntered.addListener === "function";

if (hasOmnibox) {
  // --- Omnibox integration ---
  // Usage: type "iota <name>" then Enter. Example: iota example.iota
  chrome.omnibox.setDefaultSuggestion({
    description: (chrome.i18n.getMessage("omniboxSuggestion", ["%s"]) || 'Resolve IOTA Name: %s (e.g. example.iota)').replace("%s", "<match>%s</match>")
  });

  chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
    const raw = (text || "").trim();
    if (!raw) return;

    const name = raw.toLowerCase().endsWith(".iota") ? raw : `${raw}.iota`;
    const target = `https://${name}/`;

    const openIn = async (url) => {
      if (disposition === "currentTab") {
        try {
          // No "tabs" permission needed: omit tabId to target the currently selected tab.
          return await chrome.tabs.update({ url });
        } catch (_) {
          return chrome.tabs.create({ url });
        }
      }
      if (disposition === "newForegroundTab") return chrome.tabs.create({ url });
      if (disposition === "newBackgroundTab") return chrome.tabs.create({ url, active: false });
      return chrome.tabs.create({ url });
    };

    await openIn(target);
  });

}

// Messaging API for popup/options/resolve
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "getLastForTab") {
      const tabId = msg.tabId ?? sender?.tab?.id;
      if (typeof tabId !== "number") return sendResponse({ ok: false, error: "No tabId" });
      const payload = await getLastForTab(tabId);
      return sendResponse({ ok: true, payload });
    }

    if (msg?.type === "resolveNow") {
      const name = msg.name;
      if (!name) return sendResponse({ ok: false, error: "No name" });
      const record = await resolveIotaName(name);
      const settings = await getSettings();
      const websiteUrl = pickWebsiteUrl(record?.data, settings.websiteKeys);
      return sendResponse({ ok: true, payload: { name, record, websiteUrl } });
    }

    return sendResponse({ ok: false, error: "Unknown message type" });
  })().catch((e) => sendResponse({ ok: false, error: String(e?.message || e) }));
  return true;
});
