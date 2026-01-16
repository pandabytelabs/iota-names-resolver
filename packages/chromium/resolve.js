window.__i18n?.apply?.();
const $ = (id) => document.getElementById(id);

const ALLOWED_METADATA = {
  avatar: "avatar",
  twitterX: "twitter/x",
  discord: "discord",
  github: "github",
  email: "email",
  btc: "btc",
  eth: "eth",
  ltc: "ltc",
  doge: "doge",
  sol: "sol",
  sui: "sui",
  website: "website",
  ipfs: "ipfs",
  arweave: "arweave",
};

const GROUPS = [
  { id: "profile", title: "Profile", keys: ["avatar", "website", "email"] },
  { id: "social", title: "Social", keys: ["twitterX", "discord", "github"] },
  { id: "wallets", title: "Wallets", keys: ["btc", "eth", "ltc", "doge", "sol", "sui"] },
  { id: "storage", title: "Storage", keys: ["ipfs", "arweave"] },
];

function fmtTs(msStr) {
  if (!msStr) return "–";
  const n = Number(msStr);
  if (!Number.isFinite(n) || n <= 0) return "–";
  try { return new Date(n).toLocaleString(); } catch { return msStr; }
}

function safeText(s) {
  if (s === null || s === undefined) return "–";
  return String(s);
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

function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return `mailto:${s}`;
  if (s.toLowerCase().startsWith("mailto:")) return s;
  return null;
}

function normalizeTwitter(value) {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  const asUrl = normalizeHttpUrl(s);
  if (asUrl) return asUrl;
  // Handle @handle or handle
  const handle = s.replace(/^@/, "");
  if (/^[a-z0-9_]{1,15}$/i.test(handle)) return `https://x.com/${handle}`;
  return null;
}

function normalizeGithub(value) {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  const asUrl = normalizeHttpUrl(s);
  if (asUrl) return asUrl;
  const handle = s.replace(/^@/, "");
  if (/^[a-z0-9-]{1,39}$/i.test(handle)) return `https://github.com/${handle}`;
  return null;
}

function normalizeDiscord(value) {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  const asUrl = normalizeHttpUrl(s);
  if (asUrl) return asUrl;
  // Discord user tags or IDs are not reliably linkable; return null -> display as plain text + copy.
  return null;
}

function normalizeIpfs(value) {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  const asUrl = normalizeHttpUrl(s);
  if (asUrl) return asUrl;
  // ipfs://CID or raw CID
  if (s.toLowerCase().startsWith("ipfs://")) return s;
  // Very loose CID check; display as gateway link
  if (/^[a-z0-9]{46,}$/i.test(s)) return `https://ipfs.io/ipfs/${s}`;
  return null;
}

function normalizeArweave(value) {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  const asUrl = normalizeHttpUrl(s);
  if (asUrl) return asUrl;
  // ar:// or tx id
  if (s.toLowerCase().startsWith("ar://")) return s;
  if (/^[a-z0-9_-]{43}$/i.test(s)) return `https://arweave.net/${s}`;
  return null;
}

function normalizeAvatar(value) {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  const asUrl = normalizeHttpUrl(s);
  if (asUrl) return asUrl;
  // ipfs-style avatar
  if (s.toLowerCase().startsWith("ipfs://")) {
    const cid = s.slice("ipfs://".length);
    return `https://ipfs.io/ipfs/${cid}`;
  }
  return null;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    return false;
  }
}

function humanLabelForKey(keyId) {
  switch (keyId) {
    case "twitterX": return "Twitter / X";
    case "btc": return "Bitcoin (BTC)";
    case "eth": return "Ethereum (ETH)";
    case "ltc": return "Litecoin (LTC)";
    case "doge": return "Dogecoin (DOGE)";
    case "sol": return "Solana (SOL)";
    case "sui": return "Sui (SUI)";
    case "ipfs": return "IPFS";
    case "arweave": return "Arweave";
    default: return keyId.charAt(0).toUpperCase() + keyId.slice(1);
  }
}

function buildRenderable(keyId, rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) return { kind: "text", value: "" };

  if (keyId === "website") return { kind: "link", href: normalizeHttpUrl(value) || value, label: value };
  if (keyId === "email") return { kind: "link", href: normalizeEmail(value) || "", label: value, fallbackCopy: true };
  if (keyId === "twitterX") return { kind: "link", href: normalizeTwitter(value) || "", label: value, fallbackCopy: true };
  if (keyId === "github") return { kind: "link", href: normalizeGithub(value) || "", label: value, fallbackCopy: true };
  if (keyId === "discord") return { kind: "linkOrText", href: normalizeDiscord(value), label: value };
  if (keyId === "ipfs") return { kind: "linkOrText", href: normalizeIpfs(value), label: value };
  if (keyId === "arweave") return { kind: "linkOrText", href: normalizeArweave(value), label: value };
  if (keyId === "avatar") return { kind: "avatar", src: normalizeAvatar(value), label: value, fallbackCopy: true };

  // Wallet addresses: show text + copy
  if (["btc","eth","ltc","doge","sol","sui"].includes(keyId)) {
    return { kind: "wallet", value };
  }

  // Fallback: linkify http(s)
  const url = normalizeHttpUrl(value);
  if (url) return { kind: "link", href: url, label: value };
  return { kind: "text", value };
}

function renderMetadata(data) {
  const host = $("metadata");
  host.innerHTML = "";

  const obj = (data && typeof data === "object") ? data : {};
  const entries = Object.entries(obj);

  if (!entries.length) {
    host.textContent = chrome.i18n.getMessage("noRecords") || "No records set.";
    return;
  }

  // Map from on-chain key -> internal keyId
  const reverse = Object.fromEntries(Object.entries(ALLOWED_METADATA).map(([k, v]) => [v, k]));

  const known = new Map(); // keyId -> value
  const unknown = []; // [key, value]

  for (const [k, v] of entries) {
    const keyId = reverse[k];
    if (keyId) known.set(keyId, v);
    else unknown.push([k, v]);
  }

  // Helper to create section
  const makeSection = (title, subtitle) => {
    const sec = document.createElement("section");
    sec.className = "meta-section";

    const head = document.createElement("div");
    head.className = "meta-head";

    const h = document.createElement("div");
    const t = document.createElement("div");
    t.className = "meta-title";
    t.textContent = title;
    const s = document.createElement("div");
    s.className = "meta-sub";
    s.textContent = subtitle || "";
    h.appendChild(t);
    if (subtitle) h.appendChild(s);

    head.appendChild(h);
    sec.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "meta-grid";
    sec.appendChild(grid);

    host.appendChild(sec);
    return grid;
  };

  // Render known groups
  for (const g of GROUPS) {
    const present = g.keys.filter((k) => known.has(k) && String(known.get(k)).trim() !== "");
    if (!present.length) continue;

    const grid = makeSection(g.title, "");

    for (const keyId of present) {
      const chainKey = ALLOWED_METADATA[keyId];
      const rawValue = known.get(keyId);
      const rend = buildRenderable(keyId, rawValue);

      const row = document.createElement("div");
      row.className = "meta-item" + (keyId === "avatar" ? " avatar-row" : "");

      const keyEl = document.createElement("div");
      keyEl.className = "meta-key";
      keyEl.textContent = humanLabelForKey(keyId);

      const valEl = document.createElement("div");
      valEl.className = "meta-val";

      const actions = document.createElement("div");
      actions.className = "meta-actions";

      if (rend.kind === "avatar") {
        const img = document.createElement("img");
        img.className = "avatar";
        img.alt = "avatar";
        if (rend.src) img.src = rend.src;
        valEl.appendChild(img);

        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = chainKey;
        actions.appendChild(chip);

        const btn = document.createElement("button");
        btn.className = "btn-mini";
        btn.textContent = "Copy";
        btn.addEventListener("click", async () => {
          const ok = await copyToClipboard(String(rawValue));
          btn.textContent = ok ? "Copied" : "Copy";
          setTimeout(() => (btn.textContent = "Copy"), 900);
        });
        actions.appendChild(btn);
      } else if (rend.kind === "wallet") {
        valEl.textContent = rend.value;

        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = chainKey;
        actions.appendChild(chip);

        const btn = document.createElement("button");
        btn.className = "btn-mini";
        btn.textContent = "Copy";
        btn.addEventListener("click", async () => {
          const ok = await copyToClipboard(rend.value);
          btn.textContent = ok ? "Copied" : "Copy";
          setTimeout(() => (btn.textContent = "Copy"), 900);
        });
        actions.appendChild(btn);
      } else if (rend.kind === "link") {
        if (rend.href) {
          const a = document.createElement("a");
          a.href = rend.href;
          a.textContent = rend.label;
          a.target = "_blank";
          a.rel = "noreferrer";
          valEl.appendChild(a);
        } else {
          valEl.textContent = rend.label;
        }

        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = chainKey;
        actions.appendChild(chip);
      } else if (rend.kind === "linkOrText") {
        if (rend.href) {
          const a = document.createElement("a");
          a.href = rend.href;
          a.textContent = rend.label;
          a.target = "_blank";
          a.rel = "noreferrer";
          valEl.appendChild(a);
        } else {
          valEl.textContent = rend.label;
        }

        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = chainKey;
        actions.appendChild(chip);

        const btn = document.createElement("button");
        btn.className = "btn-mini";
        btn.textContent = "Copy";
        btn.addEventListener("click", async () => {
          const ok = await copyToClipboard(String(rawValue));
          btn.textContent = ok ? "Copied" : "Copy";
          setTimeout(() => (btn.textContent = "Copy"), 900);
        });
        actions.appendChild(btn);
      } else { // text
        valEl.textContent = rend.value;

        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = chainKey;
        actions.appendChild(chip);

        const btn = document.createElement("button");
        btn.className = "btn-mini";
        btn.textContent = "Copy";
        btn.addEventListener("click", async () => {
          const ok = await copyToClipboard(String(rawValue));
          btn.textContent = ok ? "Copied" : "Copy";
          setTimeout(() => (btn.textContent = "Copy"), 900);
        });
        actions.appendChild(btn);
      }

      row.appendChild(keyEl);
      row.appendChild(valEl);
      row.appendChild(actions);
      grid.appendChild(row);
    }
  }

  // Render unknown keys at the end
  if (unknown.length) {
    const grid = makeSection("Other", "Unrecognized keys are shown here.");
    for (const [k, v] of unknown) {
      const row = document.createElement("div");
      row.className = "meta-item";

      const keyEl = document.createElement("div");
      keyEl.className = "meta-key";
      keyEl.textContent = k;

      const valEl = document.createElement("div");
      valEl.className = "meta-val";
      const s = String(v ?? "");
      const url = normalizeHttpUrl(s);
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.textContent = s;
        a.target = "_blank";
        a.rel = "noreferrer";
        valEl.appendChild(a);
      } else {
        valEl.textContent = s;
      }

      const actions = document.createElement("div");
      actions.className = "meta-actions";
      const btn = document.createElement("button");
      btn.className = "btn-mini";
      btn.textContent = "Copy";
      btn.addEventListener("click", async () => {
        const ok = await copyToClipboard(String(v ?? ""));
        btn.textContent = ok ? "Copied" : "Copy";
        setTimeout(() => (btn.textContent = "Copy"), 900);
      });
      actions.appendChild(btn);

      row.appendChild(keyEl);
      row.appendChild(valEl);
      row.appendChild(actions);
      grid.appendChild(row);
    }
  }
}

function hasAnyRecordData(data) {
  return !!(data && typeof data === "object" && Object.keys(data).length > 0);
}

async function load() {
  const url = new URL(location.href);
  const name = url.searchParams.get("name") || "(.iota)";
  $("title").textContent = name;
  $("sub").textContent = chrome.i18n.getMessage("resolveSubtitle") || "Resolved via IOTA Names";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;

  let payload = null;
  if (typeof tabId === "number") {
    const res = await chrome.runtime.sendMessage({ type: "getLastForTab", tabId });
    if (res?.ok) payload = res.payload;
  }

  if (!payload || payload.name !== name) {
    const res = await chrome.runtime.sendMessage({ type: "resolveNow", name });
    if (res?.ok) payload = res.payload;
  }

  if (payload?.error) {
    $("errorCard").hidden = false;
    $("errorText").textContent = payload.error;
  }

  const record = payload?.record || null;
  const website = payload?.websiteUrl || null;

  $("nameVal").textContent = safeText(payload?.name || name);
  $("targetVal").textContent = safeText(record?.targetAddress ?? null);
  $("expVal").textContent = fmtTs(record?.expirationTimestampMs);
  $("nftVal").textContent = safeText(record?.nftId ?? null);
  $("webVal").textContent = safeText(website);

  const recordsDetails = $("recordsDetails");
  const rawDetails = $("rawDetails");
  const dataObj = record?.data;
  if (recordsDetails) {
    const show = hasAnyRecordData(dataObj);
    recordsDetails.hidden = !show;
    // Default: collapsed.
    recordsDetails.open = false;
    if (show) renderMetadata(dataObj);
  } else {
    // Fallback for older layouts
    renderMetadata(dataObj);
  }

  // Default: collapsed.
  if (rawDetails) rawDetails.open = false;
  $("raw").textContent = JSON.stringify(payload, null, 2);

  if (website) {
    $("openWebsiteBtn").hidden = false;
    $("openWebsiteBtn").addEventListener("click", () => chrome.tabs.update({ url: website }));
  }
}

load();
