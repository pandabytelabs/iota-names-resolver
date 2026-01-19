(function () {
  // Apply i18n once the DOM exists.
  window.__i18n?.apply?.();

  const params = new URL(location.href).searchParams;
  const name = (params.get("name") || "").trim();
  const targetRaw = (params.get("target") || "").trim();
  const tabIdParam = params.get("tabId");
  const tabId = (tabIdParam && /^\d+$/.test(tabIdParam)) ? Number(tabIdParam) : null;

  const badgeEl = document.getElementById("badge");
  const hostEl = document.getElementById("host");
  const fullEl = document.getElementById("full");
  const countdownEl = document.getElementById("countdownText");
  const cancelBtn = document.getElementById("cancel");
  const proceedBtn = document.getElementById("proceed");
  const copyBtn = document.getElementById("copy");

  const labelPause = chrome.i18n.getMessage("redirectPreviewProceed") || "Pause redirect";
  const labelContinue = chrome.i18n.getMessage("redirectPreviewContinue") || "Continue redirect";
  const textPaused = chrome.i18n.getMessage("redirectPreviewPaused") || "Redirect paused";

  if (badgeEl && name) badgeEl.textContent = name;

  function msgCountdown(seconds) {
    try {
      const m = chrome.i18n.getMessage("redirectPreviewCountdown", [String(seconds)]);
      if (m) return m;
    } catch (_) {}
    return `Redirecting in ${seconds} s`;
  }

  function safeDetailsUrl() {
    const u = new URL(chrome.runtime.getURL("resolve.html"));
    if (name) u.searchParams.set("name", name);
    if (typeof tabId === "number") u.searchParams.set("tabId", String(tabId));
    return u.toString();
  }

  function ensureNoRedirectLoop(urlStr) {
    try {
      const u = new URL(urlStr);
      if (u.hostname.toLowerCase().endsWith(".iota")) {
        u.searchParams.set("inr_no_redirect", "1");
        return u.toString();
      }
    } catch (_) {}
    return urlStr;
  }

  let targetUrl = null;
  try {
    const u = new URL(targetRaw);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("Unsupported protocol");
    targetUrl = u.toString();
    if (hostEl) hostEl.textContent = u.hostname;
    if (fullEl) fullEl.textContent = targetUrl;
  } catch (_) {
    if (hostEl) hostEl.textContent = "Invalid target URL";
    if (fullEl) fullEl.textContent = targetRaw || "(missing)";
    if (countdownEl) countdownEl.textContent = "";
    if (proceedBtn) proceedBtn.disabled = true;
  }

  let secondsLeft = 5;
  let timer = null;

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function proceed() {
    if (!targetUrl) return;
    stopTimer();
    location.href = ensureNoRedirectLoop(targetUrl);
  }

  function cancel() {
    stopTimer();
    location.href = safeDetailsUrl();
  }

  if (cancelBtn) cancelBtn.addEventListener("click", cancel);
  if (proceedBtn) {
    let paused = false;
    // Ensure initial label is the pause label (i18n applies too, but this keeps JS authoritative).
    proceedBtn.textContent = labelPause;

    proceedBtn.addEventListener("click", () => {
      if (!targetUrl) return;

      if (!paused) {
        paused = true;
        stopTimer();
        if (countdownEl) countdownEl.textContent = textPaused;
        proceedBtn.textContent = labelContinue;
        return;
      }

      proceed();
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      if (!targetUrl) return;
      try {
        await navigator.clipboard.writeText(targetUrl);
        const old = copyBtn.textContent;
        copyBtn.textContent = "Copied";
        setTimeout(() => (copyBtn.textContent = old), 900);
      } catch (_) {
        // Ignore.
      }
    });
  }

  if (targetUrl) {
    if (countdownEl) countdownEl.textContent = msgCountdown(secondsLeft);
    timer = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        proceed();
        return;
      }
      if (countdownEl) countdownEl.textContent = msgCountdown(secondsLeft);
    }, 1000);
  }
})();
