// IOTA Names Resolver - Service Worker (Manifest V3)
// - Detect navigations to *.iota and resolve via JSON-RPC method iotax_iotaNamesLookup.
// - If a website record is found (configurable key list), redirect to it; otherwise show resolve.html.
// - Provides omnibox keyword "iota" to work around Brave treating bare "name.iota" as search.

const DEFAULTS = {
  network: "mainnet", // mainnet|testnet|devnet|custom
  rpcUrl: "https://api.mainnet.iota.cafe:443",
  autoRedirect: true,
  websiteKeys: ["website", "url", "web", "homepage", "link"],
  showDetailsWhenNoWebsite: true,
  cacheTtlMs: 5 * 60 * 1000,
};

const cache = new Map(); // key -> {value, expiresAt}

function now() { return Date.now(); }

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

function isIotaHost(hostname) {
  return typeof hostname === "string" && hostname.toLowerCase().endsWith(".iota");
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

function buildDetailsUrl(name) {
  const u = new URL(chrome.runtime.getURL("resolve.html"));
  u.searchParams.set("name", name);
  return u.toString();
}

async function handleNavigation(details) {
  try {
    if (details.frameId !== 0) return;
    if (!details.url) return;

    const url = new URL(details.url);
    if (!(url.protocol === "http:" || url.protocol === "https:")) return;

    // Avoid infinite loop on our internal page.
    const internal = new URL(chrome.runtime.getURL("resolve.html"));
    if (url.origin === internal.origin && url.pathname.endsWith("/resolve.html")) return;

    if (!isIotaHost(url.hostname)) return;

    const name = url.hostname;
    const settings = await getSettings();

    const record = await resolveIotaName(name);
    const websiteUrl = pickWebsiteUrl(record?.data, settings.websiteKeys);

    const payload = { name, record, websiteUrl, resolvedAt: new Date().toISOString() };
    await (chrome.storage.session || chrome.storage.local).set({ [`last:${details.tabId}`]: payload });

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
      await chrome.tabs.update(details.tabId, { url: finalUrl });
      return;
    }

    if (settings.showDetailsWhenNoWebsite) {
      await chrome.tabs.update(details.tabId, { url: buildDetailsUrl(name) });
    }
  } catch (e) {
    try {
      const u = new URL(details.url);
      const name = isIotaHost(u.hostname) ? u.hostname : "(unknown)";
      const payload = { name, error: String(e?.message || e), resolvedAt: new Date().toISOString() };
      await (chrome.storage.session || chrome.storage.local).set({ [`last:${details.tabId}`]: payload });
      await chrome.tabs.update(details.tabId, { url: buildDetailsUrl(name) });
    } catch (_) {}
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(handleNavigation, {
  url: [{ hostSuffix: "iota", schemes: ["http", "https"] }],
});

// --- Omnibox integration ---
// Usage: type "iota <name>" then Enter. Example: iota foundation.iota
chrome.omnibox.setDefaultSuggestion({
  description: (chrome.i18n.getMessage("omniboxSuggestion", ["%s"]) || 'Resolve IOTA Name: %s (e.g. foundation.iota)').replace("%s", "<match>%s</match>")
});

chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const raw = (text || "").trim();
  if (!raw) return;

  const name = raw.toLowerCase().endsWith(".iota") ? raw : `${raw}.iota`;
  const target = `https://${name}/`;

  const openIn = async (url) => {
    if (disposition === "currentTab") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) return chrome.tabs.update(tab.id, { url });
      return chrome.tabs.create({ url });
    }
    if (disposition === "newForegroundTab") return chrome.tabs.create({ url });
    if (disposition === "newBackgroundTab") return chrome.tabs.create({ url, active: false });
    return chrome.tabs.create({ url });
  };

  await openIn(target);
});

// Messaging API for popup/options/resolve
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === "getLastForTab") {
      const tabId = msg.tabId ?? sender?.tab?.id;
      if (typeof tabId !== "number") return sendResponse({ ok: false, error: "No tabId" });
      const key = `last:${tabId}`;
      const stored = await (chrome.storage.session || chrome.storage.local).get(key);
      return sendResponse({ ok: true, payload: stored[key] ?? null });
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
