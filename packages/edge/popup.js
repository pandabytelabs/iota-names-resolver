const $ = (id) => document.getElementById(id);

window.__i18n?.apply?.();

const DEFAULTS = {
  network: "mainnet",
  rpcUrl: "https://api.mainnet.iota.cafe:443",
  autoRedirect: true,
};

function presetRpcUrl(network) {
  if (!network || network === "custom") return null;
  return `https://api.${network}.iota.cafe:443`;
}

async function load() {
  const stored = await chrome.storage.sync.get(DEFAULTS);

  $("redirect").checked = !!stored.autoRedirect;
  $("rpcUrl").value = stored.rpcUrl || DEFAULTS.rpcUrl;
  $("network").value = stored.network || DEFAULTS.network;

  $("network").addEventListener("change", () => {
    const p = presetRpcUrl($("network").value);
    if (p) $("rpcUrl").value = p;
  });

  $("go").addEventListener("click", go);
  $("name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") go();
  });

  $("saveRpc").addEventListener("click", saveAll);
}

async function saveAll() {
  const rpcUrl = ($("rpcUrl").value || "").trim() || DEFAULTS.rpcUrl;
  const network = $("network").value || DEFAULTS.network;

  await chrome.storage.sync.set({
    rpcUrl,
    network,
    autoRedirect: $("redirect").checked,
  });

  $("status").textContent = chrome.i18n.getMessage("saved") || "Saved.";
  setTimeout(() => ($("status").textContent = ""), 1200);
}

async function go() {
  const raw = ($("name").value || "").trim();
  if (!raw) return;

  const name = raw.toLowerCase().endsWith(".iota") ? raw : `${raw}.iota`;

  await saveAll();

  $("out").textContent = chrome.i18n.getMessage("resolving") || "Resolving…";
  const res = await chrome.runtime.sendMessage({ type: "resolveNow", name });

  if (!res?.ok) {
    $("out").textContent = res?.error || chrome.i18n.getMessage("unknownError") || "Unknown error";
    return;
  }

  $("out").textContent = JSON.stringify(res.payload, null, 2);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await chrome.tabs.update(tab.id, { url: `https://${name}/` });
    window.close();
  }
}

load();
