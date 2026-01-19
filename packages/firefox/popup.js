const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  network: "mainnet",
  rpcUrl: "https://api.mainnet.iota.cafe:443",
  // Opt-in: redirecting to a resolved website must be explicitly enabled by the user.
  autoRedirect: false,
};

let __saveFlashTimer = null;
let __initialRpcState = null;

function getSavedLabel() {
  const base = (chrome.i18n.getMessage("saved") || "Saved").toString().trim();
  return base.replace(/[.!。…]+\s*$/, "");
}

function measureButtonWidth(btn, text) {
  const cs = getComputedStyle(btn);
  const span = document.createElement("span");
  span.style.position = "absolute";
  span.style.visibility = "hidden";
  span.style.whiteSpace = "nowrap";
  span.style.font = cs.font;
  span.textContent = text;
  document.body.appendChild(span);
  const textW = span.getBoundingClientRect().width;
  span.remove();

  const pad =
    parseFloat(cs.paddingLeft) +
    parseFloat(cs.paddingRight) +
    parseFloat(cs.borderLeftWidth) +
    parseFloat(cs.borderRightWidth);

  return textW + pad;
}

function initSaveButtonSizing() {
  const btn = $("saveRpc");
  if (!btn) return;

  if (!btn.dataset.defaultLabel) {
    btn.dataset.defaultLabel = btn.textContent || (chrome.i18n.getMessage("save") || "Save");
  }

  const def = btn.dataset.defaultLabel;
  const saved = `✔ ${getSavedLabel()}`;

  requestAnimationFrame(() => {
    const w = Math.ceil(Math.max(measureButtonWidth(btn, def), measureButtonWidth(btn, saved)) + 1);
    btn.style.minWidth = `${w}px`;
  });
}

function flashSaveButton() {
  const btn = $("saveRpc");
  if (!btn) return;

  if (!btn.dataset.defaultLabel) {
    btn.dataset.defaultLabel = btn.textContent || (chrome.i18n.getMessage("save") || "Save");
  }

  btn.textContent = `✔ ${getSavedLabel()}`;
  btn.classList.add("flash-saved");

  if (__saveFlashTimer) clearTimeout(__saveFlashTimer);
  __saveFlashTimer = setTimeout(() => {
    btn.classList.remove("flash-saved");
    btn.textContent = btn.dataset.defaultLabel;
  }, 1400);
}

function serializeRpcState() {
  const rpcUrl = ($("rpcUrl")?.value || "").trim() || DEFAULTS.rpcUrl;
  const network = $("network")?.value || DEFAULTS.network;
  return JSON.stringify({ rpcUrl, network });
}

function setDirty(isDirty) {
  const btn = $("saveRpc");
  if (!btn) return;
  btn.classList.toggle("unsaved", !!isDirty);
}

function initUnsavedTracking() {
  const watchIds = ["network", "rpcUrl"];

  const update = () => {
    if (__initialRpcState == null) return;
    setDirty(serializeRpcState() !== __initialRpcState);
  };

  for (const id of watchIds) {
    const el = $(id);
    if (!el) continue;
    el.addEventListener("input", update);
    el.addEventListener("change", update);
  }

  __initialRpcState = serializeRpcState();
  setDirty(false);
}

function buildRedirectPreviewUrl(name, targetUrl) {
  const u = new URL(chrome.runtime.getURL("redirect.html"));
  u.searchParams.set("name", name);
  u.searchParams.set("target", targetUrl);
  return u.toString();
}

function presetRpcUrl(network) {
  if (!network || network === "custom") return null;
  return `https://api.${network}.iota.cafe:443`;
}

function setStatus(text) {
  const el = $("out");
  if (el) el.textContent = text || "";
}

function openOptionsPage() {
  try {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
      return;
    }
  } catch (_) {
    // ignore
  }

  try {
    window.open(chrome.runtime.getURL("options.html"), "_blank", "noopener,noreferrer");
  } catch (_) {
    // ignore
  }
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
  const openOptsEl = $("openOptions");

  if (!redirectEl || !rpcEl || !netEl || !goEl || !nameEl || !saveEl) {
    setStatus("Popup UI is missing required elements. Please reload the extension.");
    return;
  }

  if (openOptsEl) {
    openOptsEl.addEventListener("click", (e) => {
      e.preventDefault();
      openOptionsPage();
    });
  }

  redirectEl.checked = !!stored.autoRedirect;
  rpcEl.value = stored.rpcUrl || DEFAULTS.rpcUrl;
  netEl.value = stored.network || DEFAULTS.network;

  netEl.addEventListener("change", () => {
    const p = presetRpcUrl(netEl.value);
    if (p) rpcEl.value = p;
  });

  initSaveButtonSizing();
  initUnsavedTracking();

  goEl.addEventListener("click", go);
  nameEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") go();
  });

  saveEl.addEventListener("click", () => saveAll({ flash: true }));
}

async function saveAll(opts = { flash: true }) {
  const rpcUrl = ($("rpcUrl")?.value || "").trim() || DEFAULTS.rpcUrl;
  const network = $("network")?.value || DEFAULTS.network;
  // Note: auto-redirect toggle in the popup is intentionally temporary and is not persisted.

  await chrome.storage.sync.set({ rpcUrl, network });

  // Establish new baseline for unsaved tracking.
  __initialRpcState = JSON.stringify({ rpcUrl, network });
  setDirty(false);

  // Remove any prior non-error status text in the popup.
  const status = $("status");
  if (status) {
    status.textContent = "";
    status.hidden = true;
  }

  if (opts?.flash) flashSaveButton();
}

async function go() {
  const raw = ($("name")?.value || "").trim();
  if (!raw) return;

  const name = raw.toLowerCase().endsWith(".iota") ? raw.toLowerCase() : `${raw.toLowerCase()}.iota`;

  await saveAll({ flash: false });

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
  // - If a website is present and auto-redirect is enabled -> go to website (via preview)
  // - Otherwise -> open the extension details page
  const targetUrl = (autoRedirect && payload.websiteUrl)
    ? buildRedirectPreviewUrl(name, payload.websiteUrl)
    : chrome.runtime.getURL(`resolve.html?name=${encodeURIComponent(name)}`);

  try {
    // No "tabs" permission needed: omit tabId to target the currently selected tab.
    await chrome.tabs.update({ url: targetUrl });
  } catch (_) {
    // Fallback: open a new tab if the current tab cannot be updated.
    await chrome.tabs.create({ url: targetUrl });
  }
  window.close();
}

document.addEventListener("DOMContentLoaded", () => {
  load().catch((e) => setStatus(String(e?.message || e || "Failed to load")));
});
