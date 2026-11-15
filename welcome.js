/**
 * Smartschool Combined - welcome and donate modals (lazy module "welcome").
 *
 *   window.sscWelcome.showWelcome()   what is new, shown once per version
 *   window.sscWelcome.showDonate()    "Steun de ontwikkeling" with the donate link
 *
 * Own shadow host, so no Smartschool style touches it. Colours come from the
 * active theme's --ssc-* properties, with the browser's system colours as the
 * fallback (same approach as hub.js).
 */
(function () {
  "use strict";

  if (window.sscSkipPage) return;
  if (window.sscWelcome) return;

  /* The ONLY place the donation links live; nothing else in the extension needs to change. */
  var DONATE_URL = "https://ko-fi.com/smartschoolcombined";
  var PAYPAL_URL = "https://paypal.me/smartschoolcombined";

  /* The league and the calculator are only for one class; everyone else must not read about them. */
  function features(access) {
    return [
      ["Thema's en live achtergronden", "Kies een stijl, ook met bewegende wallpaper."],
      ["Islands", "Eén hub met Arcade, School, Stadion, Boerderij, Schaken" + (access.calc ? " en je rekentoestel." : " en meer.")],
      ["Ultimate Team", "Verzamel kaarten, bouw je team en bekijk de walkout-animaties."],
      access.league && ["Competitie", "Vergelijk je team met je klas in een echte ranglijst."],
      ["Schaken", "Tegen bots met klok en analyse, of samen op één scherm."],
      ["Arcade", "Snake, 2048, Mines, Plinko, Roulette en Blackjack."],
    ].filter(Boolean);
  }

  function classAccess() {
    var none = { calc: false, league: false };
    var ask = typeof window.sscClassAccess === "function" ? window.sscClassAccess() : Promise.resolve(none);
    return Promise.race([
      ask.then(function (a) { return a || none; }, function () { return none; }),
      new Promise(function (resolve) { setTimeout(function () { resolve(none); }, 2000); }),
    ]);
  }

  var host = null;
  var returnFocus = null;

  var CSS = [
    ":host { all: initial; }",
    ".wl { --bg: var(--ssc-base00, Canvas); --ink: var(--ssc-text, CanvasText); --acc: var(--ssc-accent, Highlight);",
    "  --muted: color-mix(in srgb, var(--ink) 62%, transparent); --line: color-mix(in srgb, var(--ink) 14%, transparent);",
    "  position: fixed; inset: 0; z-index: 2147483600; display: grid; place-items: center; padding: 16px;",
    "  font-family: system-ui, -apple-system, 'Segoe UI Variable Display', 'Segoe UI', Roboto, sans-serif; letter-spacing: -0.011em; color: var(--ink);",
    "  background: color-mix(in srgb, black 34%, transparent); backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%);",
    "  opacity: 0; transition: opacity .35s cubic-bezier(0.175, 0.885, 0.32, 1.275); }",
    ".wl[data-open='1'] { opacity: 1; }",
    ".wl *, .wl *::before, .wl *::after { box-sizing: border-box; }",
    ".wl-card { position: relative; width: min(460px, 100%); max-height: calc(100vh - 32px); overflow-x: hidden; overflow-y: auto; scrollbar-width: thin; padding: 28px 26px 22px; border-radius: 30px;",
    "  background: color-mix(in srgb, var(--bg) 80%, transparent); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%);",
    "  border: 1px solid color-mix(in srgb, white 34%, transparent);",
    "  box-shadow: inset 0 1.5px 0 color-mix(in srgb, white 55%, transparent), 0 2px 6px color-mix(in srgb, black 18%, transparent), 0 40px 80px -24px color-mix(in srgb, black 55%, transparent);",
    "  transform: translateY(26px) scale(.94); transition: transform .55s cubic-bezier(0.175, 0.885, 0.32, 1.275); }",
    ".wl[data-open='1'] .wl-card { transform: none; }",
    ".wl-glow { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: .55;",
    "  background: radial-gradient(120% 60% at 50% -10%, color-mix(in srgb, var(--acc) 38%, transparent), transparent 60%); }",
    ".wl-kicker { position: relative; font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--acc); margin: 0 0 6px; }",
    ".wl-title { position: relative; margin: 0 0 6px; font-size: 28px; line-height: 1.12; font-weight: 800; letter-spacing: -0.03em; }",
    ".wl-sub { position: relative; margin: 0 0 18px; font-size: 14.5px; line-height: 1.45; color: var(--muted); }",
    ".wl-list { position: relative; list-style: none; margin: 0 0 20px; padding: 4px 0; border-radius: 18px; background: color-mix(in srgb, var(--ink) 6%, transparent);",
    "  border: 1px solid var(--line); }",
    ".wl-list li { padding: 11px 16px; } .wl-list li + li { border-top: 1px solid var(--line); }",
    ".wl-list b { display: block; font-size: 14.5px; font-weight: 700; } .wl-list span { display: block; margin-top: 1px; font-size: 13px; color: var(--muted); }",
    ".wl-row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; }",
    ".wl-btn { font: inherit; font-weight: 700; font-size: 15px; letter-spacing: -0.011em; color: inherit; cursor: pointer; border: 0; border-radius: 99px; padding: 12px 22px;",
    "  text-decoration: none; display: inline-flex; align-items: center; justify-content: center;",
    "  transition: transform .4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow .3s ease, background .2s ease; }",
    ".wl-btn:hover { transform: translateY(-2px) scale(1.03); } .wl-btn:active { transform: scale(.95); }",
    ".wl-btn:focus-visible, .wl-quiet:focus-visible { outline: 2px solid var(--acc); outline-offset: 3px; }",
    ".wl-btn--main { color: var(--bg); background: var(--acc); box-shadow: 0 10px 24px -10px var(--acc), inset 0 1px 0 color-mix(in srgb, white 45%, transparent); }",
    ".wl-btn--soft { background: color-mix(in srgb, var(--ink) 9%, transparent); box-shadow: inset 0 0 0 1px var(--line); }",
    ".wl-pay { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px; }",
    ".wl-pay .wl-btn { padding: 12px 14px; gap: 7px; }",
    ".wl-ic { display: inline-grid; place-items: center; width: 18px; height: 18px; flex: none; } .wl-ic svg { width: 100%; height: 100%; }",
    ".wl-ic--pp { padding: 2px; border-radius: 50%; background: #fff; }",
    ".wl-give { position: relative; display: flex; flex-direction: column; gap: 12px; margin: 0 0 18px; padding: 14px 16px; border-radius: 18px;",
    "  background: color-mix(in srgb, var(--acc) 12%, transparent); border: 1px solid color-mix(in srgb, var(--acc) 30%, transparent); }",
    ".wl-give p { flex: 1; margin: 0; font-size: 13px; line-height: 1.4; color: var(--muted); } .wl-give b { display: block; font-size: 14px; color: var(--ink); }",
    ".wl-give .wl-pay { margin: 0; gap: 8px; }",
    ".wl-give .wl-btn { padding: 9px 13px; font-size: 13.5px; }",
    ".wl-quiet { font: inherit; font-size: 12.5px; color: var(--muted); background: none; border: 0; padding: 6px 4px; cursor: pointer; border-radius: 8px;",
    "  transition: color .2s ease, transform .4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }",
    ".wl-quiet:hover { color: var(--ink); transform: translateY(-1px); }",
    ".wl-x { position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; display: grid; place-items: center; font-size: 18px; line-height: 1; z-index: 1;",
    "  border: 0; border-radius: 50%; cursor: pointer; color: var(--muted); background: color-mix(in srgb, var(--ink) 9%, transparent);",
    "  transition: transform .4s cubic-bezier(0.175, 0.885, 0.32, 1.275), background .2s ease; }",
    ".wl-x:hover { transform: scale(1.12); background: color-mix(in srgb, var(--ink) 16%, transparent); }",
    ".wl-note { position: relative; margin: 12px 0 0; font-size: 12px; text-align: center; color: var(--muted); }",
    "@media (prefers-reduced-motion: reduce) { .wl, .wl-card, .wl-btn, .wl-quiet, .wl-x { transition-duration: .01ms !important; } }",
  ].join("\n");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function close() {
    if (!host) return;
    var h = host;
    host = null;
    document.removeEventListener("keydown", onKey, true);
    var layer = h.shadowRoot && h.shadowRoot.querySelector(".wl");
    if (layer) layer.removeAttribute("data-open");
    setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h); }, 380);
    if (returnFocus && returnFocus.focus) { try { returnFocus.focus(); } catch (e) { /* gone */ } }
    returnFocus = null;
  }

  function onKey(e) {
    if (e.key === "Escape") { e.stopPropagation(); close(); }
  }

  /** Builds the shared shell: layer, card, close button. */
  function open(label) {
    if (host) close();
    returnFocus = document.activeElement;
    host = document.createElement("div");
    host.setAttribute("data-ssc-welcome-host", "1");
    var shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    style.textContent = CSS;
    shadow.appendChild(style);
    var layer = el("div", "wl");
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-label", label);
    var card = el("div", "wl-card");
    card.appendChild(el("div", "wl-glow"));
    var x = el("button", "wl-x", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Sluiten");
    x.addEventListener("click", close);
    card.appendChild(x);
    layer.appendChild(card);
    layer.addEventListener("pointerdown", function (e) { if (e.target === layer) close(); });
    shadow.appendChild(layer);
    document.documentElement.appendChild(host);
    document.addEventListener("keydown", onKey, true);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { layer.setAttribute("data-open", "1"); });
    });
    return { card: card, layer: layer, x: x };
  }

  function showDonate() {
    var m = open("Steun de ontwikkeling van Smartschool Combined");
    m.card.appendChild(el("p", "wl-kicker", "Doneer"));
    m.card.appendChild(el("h2", "wl-title", "Steun de ontwikkeling van Smartschool Combined"));
    m.card.appendChild(el("p", "wl-sub", "Smartschool Combined is gratis en blijft gratis. Wil je de ontwikkeling toch steunen, dan helpt elke bijdrage om het te blijven verbeteren."));
    var pay = payLinks("wl-btn--main");
    m.card.appendChild(pay);
    m.card.appendChild(el("p", "wl-note", "Kies Ko-fi (trakteer op een koffie) of PayPal. Je verlaat Smartschool."));
    pay.firstChild.focus();
  }

  /* Inline marks (no network): a coffee cup in the text colour, and the PayPal "P" in its brand blues. */
  var CUP_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3c-.6.8-.6 1.7 0 2.5M12 3c-.6.8-.6 1.7 0 2.5"/></svg>';
  var PAYPAL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="#003087" d="M8.3 21.5H4.6a.5.5 0 0 1-.5-.6L6.9 3.3a.7.7 0 0 1 .7-.6h6.1c3.5 0 5.4 1.8 4.9 4.9-.6 3.7-3 5.4-6.6 5.4H10a.7.7 0 0 0-.7.6l-1 7.9z"/>' +
    '<path fill="#009cde" d="M19.6 8.2c-.6 3.8-3.1 5.6-6.8 5.6h-1.5a.7.7 0 0 0-.7.6l-.9 6.3a.5.5 0 0 1-.5.4H7.6l-.1.4a.4.4 0 0 0 .4.5h3a.6.6 0 0 0 .6-.5l.6-4a.6.6 0 0 1 .6-.5h1c3.3 0 5.6-1.5 6.2-5 .3-1.7 0-3-.9-3.8z"/></svg>';

  /** Ko-fi and PayPal side by side; Ko-fi gets `kofiCls`, PayPal the soft style. */
  function payLinks(kofiCls) {
    var wrap = el("div", "wl-pay");
    [["Koffie via Ko-fi", DONATE_URL, kofiCls, CUP_SVG], ["PayPal", PAYPAL_URL, "wl-btn--soft", PAYPAL_SVG]].forEach(function (p) {
      var a = el("a", "wl-btn " + p[2]);
      var ic = el("span", p[3] === PAYPAL_SVG ? "wl-ic wl-ic--pp" : "wl-ic");
      ic.innerHTML = p[3]; // fixed markup from this file, never user data
      a.appendChild(ic);
      a.appendChild(document.createTextNode(p[0]));
      a.href = p[1];
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      wrap.appendChild(a);
    });
    return wrap;
  }

  function showWelcome(done) {
    classAccess().then(function (access) {
      renderWelcome(access, done);
    });
  }

  function renderWelcome(access, done) {
    var m = open("Welkom bij Smartschool Combined");
    m.card.appendChild(el("p", "wl-kicker", "Nieuw in " + (chrome.runtime.getManifest().version)));
    m.card.appendChild(el("h2", "wl-title", "Welkom bij Smartschool Combined"));
    m.card.appendChild(el("p", "wl-sub", "Dit zit er nu in. Open de Islands-knop bovenaan om te beginnen."));
    var ul = el("ul", "wl-list");
    features(access).forEach(function (f) {
      var li = el("li");
      li.appendChild(el("b", null, f[0]));
      li.appendChild(el("span", null, f[1]));
      ul.appendChild(li);
    });
    m.card.appendChild(ul);
    var give = el("div", "wl-give");
    var txt = el("p", null, "De extensie is gratis. Een koffie helpt om ze te blijven verbeteren.");
    txt.insertBefore(el("b", null, "Steun Smartschool Combined"), txt.firstChild);
    give.appendChild(txt);
    give.appendChild(payLinks("wl-btn--soft"));
    m.card.appendChild(give);
    var row = el("div", "wl-row");
    row.appendChild(el("span", "wl-quiet", "Later terugvinden: Doneer, links bovenaan."));
    var go = el("button", "wl-btn wl-btn--main", "Aan de slag");
    go.type = "button";
    go.addEventListener("click", close);
    row.appendChild(go);
    m.card.appendChild(row);
    go.focus();
    if (typeof done === "function") done();
  }

  window.sscWelcome = { showWelcome: showWelcome, showDonate: showDonate, DONATE_URL: DONATE_URL, PAYPAL_URL: PAYPAL_URL };
})();
