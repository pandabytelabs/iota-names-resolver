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

function applyNetworkPreset(network) {
  if (network === "custom") return;
  $("rpcUrl").value = `https://api.${network}.iota.cafe:443`;
}

async function load() {
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
