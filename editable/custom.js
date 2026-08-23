/* Stable customization layer. Add site behavior here. */
(function () {
  const applied = new WeakMap();

  function routeMatches(rulePath) {
    if (!rulePath || rulePath === "*") return true;
    if (rulePath instanceof RegExp) return rulePath.test(location.pathname);
    return location.pathname.replace(/\/$/, "") === String(rulePath).replace(/\/$/, "");
  }

  function applyContentOverrides() {
    for (const [index, rule] of (window.TRESMARES_CONTENT || []).entries()) {
      if (!rule || !rule.selector || !routeMatches(rule.path)) continue;
      document.querySelectorAll(rule.selector).forEach((element) => {
        const key = `${location.pathname}:${index}`;
        if (applied.get(element) === key) return;
        if (Object.prototype.hasOwnProperty.call(rule, "html")) element.innerHTML = rule.html;
        else if (Object.prototype.hasOwnProperty.call(rule, "text")) element.textContent = rule.text;
        for (const [name, value] of Object.entries(rule.attrs || {})) {
          if (value == null) element.removeAttribute(name);
          else element.setAttribute(name, value);
        }
        applied.set(element, key);
      });
    }
  }

  applyContentOverrides();
  document.addEventListener("DOMContentLoaded", applyContentOverrides, { once: true });
  new MutationObserver(applyContentOverrides).observe(document.documentElement, { childList: true, subtree: true });
})();
