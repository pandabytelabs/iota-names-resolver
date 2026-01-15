const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  network: "mainnet",
  rpcUrl: "https://api.mainnet.iota.cafe:443",
  autoRedirect: true,
};

function presetRpcUrl(network) {
  if (!network || network === "custom") return null;
  return `https://api.${network}.iota.cafe:443`;
}

function setStatus(text) {
  const el = $("out");
  if (el) el.textContent = text || "";
}

async function load() {
  // Apply i18n once the DOM exists.
  window.__i18n?.apply?.();

  const stored = await chrome.storage.sync.get(DEFAULTS);

  const redirectEl = $("redirect");
  const rpcEl = $("rpcUrl");
  const netEl = $("network");
  const goEl = $("go");
  const nameEl = $("name");
  const saveEl = $("saveRpc");

  if (!redirectEl || !rpcEl || !netEl || !goEl || !nameEl || !saveEl) {
    setStatus("Popup UI is missing required elements. Please reload the extension.");
    return;
  }

  redirectEl.checked = !!stored.autoRedirect;
  rpcEl.value = stored.rpcUrl || DEFAULTS.rpcUrl;
  netEl.value = stored.network || DEFAULTS.network;

  netEl.addEventListener("change", () => {
    const p = presetRpcUrl(netEl.value);
    if (p) rpcEl.value = p;
  });

  goEl.addEventListener("click", go);
  nameEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") go();
  });

  saveEl.addEventListener("click", saveAll);
}

async function saveAll() {
  const rpcUrl = ($("rpcUrl")?.value || "").trim() || DEFAULTS.rpcUrl;
  const network = $("network")?.value || DEFAULTS.network;
  const autoRedirect = !!$("redirect")?.checked;

  await chrome.storage.sync.set({ rpcUrl, network, autoRedirect });

  const status = $("status");
  if (status) {
    status.textContent = chrome.i18n.getMessage("saved") || "Saved.";
    setTimeout(() => (status.textContent = ""), 1200);
  }
}

async function go() {
  const raw = ($("name")?.value || "").trim();
  if (!raw) return;

  const name = raw.toLowerCase().endsWith(".iota") ? raw.toLowerCase() : `${raw.toLowerCase()}.iota`;

  await saveAll();

  setStatus(chrome.i18n.getMessage("resolving") || "Resolving…");

  let res = null;
  try {
    res = await chrome.runtime.sendMessage({ type: "resolveNow", name });
  } catch (e) {
    setStatus(String(e?.message || e || "Message failed"));
    return;
  }

  if (!res?.ok) {
    setStatus(res?.error || chrome.i18n.getMessage("unknownError") || "Unknown error");
    return;
  }

  const payload = res.payload || {};
  const autoRedirect = !!$("redirect")?.checked;

  // Always navigate somewhere visible:
  // - If a website is present and auto-redirect is enabled -> go to website
  // - Otherwise -> open the extension details page
  const targetUrl = (autoRedirect && payload.websiteUrl)
    ? payload.websiteUrl
    : chrome.runtime.getURL(`resolve.html?name=${encodeURIComponent(name)}`);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await chrome.tabs.update(tab.id, { url: targetUrl });
    window.close();
    return;
  }

  // Fallback: open a new tab if no active tab is available
  await chrome.tabs.create({ url: targetUrl });
  window.close();
}

document.addEventListener("DOMContentLoaded", () => {
  
function setAdvOut(text) {
  const el = document.getElementById("advOut");
  if (!el) return;
  const t = (text || "").toString().trim();
  if (!t) {
    el.textContent = "";
    el.hidden = true;
    return;
  }
  el.textContent = t;
  el.hidden = false;
}

load().catch((e) => setStatus(String(e?.message || e || "Failed to load")));
});
