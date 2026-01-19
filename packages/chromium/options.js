window.__i18n?.apply?.();
const DEFAULTS = {
  network: "mainnet",
  rpcUrl: "https://api.mainnet.iota.cafe:443",
  // Opt-in: redirecting to a resolved website must be explicitly enabled by the user.
  autoRedirect: false,
  websiteKeys: ["website", "url", "web", "homepage", "link"],
  showDetailsWhenNoWebsite: true,
  cacheTtlMs: 5 * 60 * 1000,
};

const $ = (id) => document.getElementById(id);

const BACK_REFERRERS = ["resolve.html", "redirect.html"]; 

function initBackButton() {
  const btn = $("backBtn");
  if (!btn) return;

  let show = false;
  try {
    const ref = document.referrer || "";
    if (ref) {
      const u = new URL(ref);
      show = (u.origin === location.origin) && BACK_REFERRERS.some(p => (u.pathname || "").endsWith(p));
    }
  } catch (_) {
    // ignore
  }

  // Fallback: if history has a previous entry, allow going back.
  if (!show && window.history.length > 1) {
    show = true;
  }

  if (show) {
    btn.hidden = false;
    btn.addEventListener("click", () => {
      // Prefer browser history so the user returns to the exact previous page.
      if (window.history.length > 1) {
        window.history.back();
      } else {
        // As a fallback, try the referrer.
        const ref = document.referrer;
        if (ref) location.href = ref;
      }
    });
  }
}

let __saveFlashTimer = null;

function flashSaveButton() {
  const btn = $("saveBtn");
  if (!btn) return;

  // Capture the current (localized) label once so we can restore it.
  if (!btn.dataset.defaultLabel) btn.dataset.defaultLabel = btn.textContent || (chrome.i18n.getMessage("save") || "Save");

  const base = (chrome.i18n.getMessage("saved") || "Saved").toString().trim();
  const clean = base.replace(/[.!。…]+\s*$/, "");
  btn.textContent = `✔ ${clean}`;

  btn.classList.add("flash-saved");
  if (__saveFlashTimer) clearTimeout(__saveFlashTimer);
  __saveFlashTimer = setTimeout(() => {
    btn.classList.remove("flash-saved");
    btn.textContent = btn.dataset.defaultLabel;
  }, 1400);
}

function applyNetworkPreset(network) {
  if (network === "custom") return;
  $("rpcUrl").value = `https://api.${network}.iota.cafe:443`;
}

async function load() {
  initBackButton();
  const stored = await chrome.storage.sync.get(DEFAULTS);
  $("network").value = stored.network || "mainnet";
  $("rpcUrl").value = stored.rpcUrl || DEFAULTS.rpcUrl;
  $("autoRedirect").checked = !!stored.autoRedirect;
  $("showDetailsWhenNoWebsite").checked = !!stored.showDetailsWhenNoWebsite;
  $("websiteKeys").value = (stored.websiteKeys || DEFAULTS.websiteKeys).join(",");
  $("cacheTtlSec").value = Math.round((stored.cacheTtlMs ?? DEFAULTS.cacheTtlMs) / 1000);

  $("network").addEventListener("change", () => {
    const n = $("network").value;
    if (n !== "custom") applyNetworkPreset(n);
  });

  $("saveBtn").addEventListener("click", save);
  $("testBtn").addEventListener("click", testResolve);
}

async function save() {
  const network = $("network").value;
  const rpcUrl = $("rpcUrl").value.trim();
  const websiteKeys = $("websiteKeys").value.split(",").map(s => s.trim()).filter(Boolean);
  const cacheTtlSec = Number($("cacheTtlSec").value || 0);

  const payload = {
    network,
    rpcUrl,
    autoRedirect: $("autoRedirect").checked,
    showDetailsWhenNoWebsite: $("showDetailsWhenNoWebsite").checked,
    websiteKeys: websiteKeys.length ? websiteKeys : DEFAULTS.websiteKeys,
    cacheTtlMs: Math.max(0, Math.floor(cacheTtlSec * 1000)),
  };

  await chrome.storage.sync.set(payload);

  flashSaveButton();
  $("status").textContent = chrome.i18n.getMessage("saved") || "Saved.";
  setTimeout(() => $("status").textContent = "", 1500);
}

async function testResolve() {
  const name = ($("testName").value || "").trim();
  if (!name) return;
  $("testOut").textContent = chrome.i18n.getMessage("resolving") || "Resolving…";
  const res = await chrome.runtime.sendMessage({ type: "resolveNow", name });
  $("testOut").textContent = JSON.stringify(res, null, 2);
}

load();
