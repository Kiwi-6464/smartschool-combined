/**
 * Smartschool Combined — popup for messages the owner sends (lazy.js module "announce").
 *
 *   window.sscAnnounceShow(items, onSeen)
 *     items   [{ id, title, body, createdAt }], shown one after the other
 *     onSeen  called with the createdAt of each message once the student closes it
 *
 * Plain text only (textContent, never HTML), in its own shadow root so the page and theme cannot restyle it.
 */
(function () {
  "use strict";

  if (window.sscAnnounceShow) return;

  var CSS = [
    ":host { all: initial; }",
    "* { box-sizing: border-box; }",
    ".dim { position: fixed; inset: 0; background: rgba(8,10,16,.55); display: grid; place-items: center; padding: 20px; font: 14px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; color: var(--ssc-text, #1a1a2e); animation: in .18s ease-out; }",
    "@keyframes in { from { opacity: 0; } }",
    ".card { width: min(440px, 100%); border-radius: 22px; padding: 22px 24px 20px; background: var(--ssc-base00, #fff); box-shadow: 0 30px 80px -20px rgba(0,0,0,.55), 0 0 0 1px rgba(128,128,128,.25); animation: pop .22s cubic-bezier(.34,1.56,.64,1); }",
    "@keyframes pop { from { transform: scale(.94); opacity: 0; } }",
    ".head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }",
    ".ico { flex: none; width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center; font-size: 20px; color: #fff; background: linear-gradient(135deg,#f59e0b,#eab308); }",
    "h1 { margin: 0; font-size: 18px; line-height: 1.25; overflow-wrap: anywhere; }",
    "p { margin: 0 0 16px; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 50vh; overflow: auto; }",
    ".foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; }",
    ".n { font-size: 12px; opacity: .6; }",
    "button { font: inherit; font-weight: 600; color: var(--on-accent, #fff); background: var(--ssc-accent, #2b6cb0); border: 0; border-radius: 10px; padding: 9px 18px; cursor: pointer; }",
    "button:hover { filter: brightness(1.08); } button:focus-visible { outline: 2px solid var(--ssc-accent, #2b6cb0); outline-offset: 2px; }",
  ].join("\n");

  var queue = [];
  var current = null;

  function show(items, onSeen) {
    (items || []).forEach(function (it) {
      if (it && typeof it.title === "string" && typeof it.body === "string") queue.push({ it: it, onSeen: onSeen });
    });
    if (!current) next();
  }

  function next() {
    var entry = queue.shift();
    if (!entry) { current = null; return; }
    var it = entry.it;
    var host = document.createElement("div");
    host.setAttribute("data-ssc-announce", "1");
    host.style.cssText = "position:fixed;inset:0;z-index:2147483200";
    var shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = CSS;
    var dim = document.createElement("div"); dim.className = "dim";
    // dark text on a light theme accent, white on a dark one
    var probe = document.createElement("span"); probe.style.color = "var(--ssc-accent, #2b6cb0)"; shadow.appendChild(probe);
    var rgb = (getComputedStyle(probe).color.match(/[\d.]+/g) || [43, 108, 176]).map(Number); probe.remove();
    dim.style.setProperty("--on-accent", (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 > 0.58 ? "#111" : "#fff");
    dim.setAttribute("role", "dialog"); dim.setAttribute("aria-modal", "true");
    var card = document.createElement("div"); card.className = "card";
    var head = document.createElement("div"); head.className = "head";
    var ico = document.createElement("div"); ico.className = "ico"; ico.textContent = "🔔";
    var h = document.createElement("h1"); h.textContent = it.title;
    head.appendChild(ico); head.appendChild(h);
    var p = document.createElement("p"); p.textContent = it.body;
    var foot = document.createElement("div"); foot.className = "foot";
    var n = document.createElement("span"); n.className = "n";
    n.textContent = queue.length ? queue.length + " meer" : "";
    var ok = document.createElement("button"); ok.type = "button"; ok.textContent = queue.length ? "Volgende" : "Begrepen";
    foot.appendChild(n); foot.appendChild(ok);
    card.appendChild(head); card.appendChild(p); card.appendChild(foot); dim.appendChild(card);
    shadow.appendChild(style); shadow.appendChild(dim);
    document.documentElement.appendChild(host);
    current = host;
    ok.focus();

    function done() {
      document.removeEventListener("keydown", onKey, true);
      host.remove();
      current = null;
      try { if (typeof entry.onSeen === "function") entry.onSeen(it.createdAt, it.id); } catch (e) { /* the popup must never break the page */ }
      next();
    }
    function onKey(e) { if (e.key === "Escape" || e.key === "Enter") { e.stopPropagation(); done(); } }
    ok.addEventListener("click", done);
    document.addEventListener("keydown", onKey, true);
  }

  window.sscAnnounceShow = show;
})();
