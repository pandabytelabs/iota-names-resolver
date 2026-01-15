// Simple i18n helper for WebExtensions.
// Uses chrome.i18n and data-i18n / data-i18n-attr attributes in HTML.
(function () {
  function msg(key, substitutions) {
    try {
      return chrome.i18n.getMessage(key, substitutions) || "";
    } catch (e) {
      return "";
    }
  }

  function apply(root = document) {
    // text nodes
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const val = msg(key);
      if (val) el.textContent = val;
    });

    // attributes: data-i18n-attr='{"placeholder":"key1","title":"key2"}'
    root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      let spec = null;
      try { spec = JSON.parse(el.getAttribute("data-i18n-attr")); } catch (_) {}
      if (!spec) return;
      for (const [attr, key] of Object.entries(spec)) {
        const val = msg(key);
        if (val) el.setAttribute(attr, val);
      }
    });
  }

  window.__i18n = { msg, apply };
})();
