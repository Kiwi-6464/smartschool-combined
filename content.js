/**
 * Smartschool Combined — checkpoint 3
 *
 * Shadow DOM host on documentElement (never body), zero-size and
 * click-through, so nothing can paint a bar over the page. Quiet-wait
 * before injecting, because Smartschool is an SPA and early injection
 * gets wiped by its render engine.
 */
(function () {
  "use strict";

  // Sign-in pages: do nothing at all (see guard.js).
  if (window.sscSkipPage) return;

  if (window.__sscLoaded) return; // guard: content scripts can run twice
  window.__sscLoaded = true;

  if (typeof window.sscGet !== "function") return;

  var HOST_ID = "ssc-root";
  // How long the page must stop changing before the panel is built, and the
  // cap for pages that never stop. Long waits only delayed the widgets and
  // the settings, so both are short.
  var QUIET_MS = 300;
  var MAX_WAIT_MS = 1200;

  var host = null;
  var shadow = null;
  var panelEl = null;
  var panelOpen = false;
  var settingsBody = null;

  /* ---------- quiet wait ---------- */

  function whenQuiet(cb) {
    var target = document.body;
    if (!target) {
      document.addEventListener("DOMContentLoaded", function () {
        whenQuiet(cb);
      }, { once: true });
      return;
    }

    var done = false;
    var timer = null;

    function finish() {
      if (done) return;
      done = true;
      observer.disconnect();
      clearTimeout(timer);
      clearTimeout(hardMax);
      cb();
    }

    function arm() {
      clearTimeout(timer);
      timer = setTimeout(finish, QUIET_MS);
    }

    var observer = new MutationObserver(arm);
    observer.observe(target, { childList: true, subtree: true });

    var hardMax = setTimeout(finish, MAX_WAIT_MS);
    arm();
  }

  /* ---------- styles ---------- */

  var STYLE = [
    ":host { all: initial; }",
    /*
     * Every colour below comes from the active theme, through the custom
     * properties layout.js writes on <html> (--ssc-base00/01/02/03, --ssc-text,
     * --ssc-accent). Custom properties inherit across the shadow boundary, so a
     * palette change repaints the whole panel with no JS and no re-open.
     *
     * The aliases are the only place a fallback is named. `Canvas` /
     * `CanvasText` are CSS system colours: when "geen thema" is active (the
     * theme vars are set to `initial`), the panel follows the browser's own
     * light/dark scheme instead of falling back to a hex that only looks right
     * on one of them. No literal surface colour exists in this stylesheet.
     */
    ".ssc-layer {",
    "  position: fixed;",
    "  inset: 0;",
    "  pointer-events: none;",
    "  z-index: 2147483000;",
    "  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;",
    "  --ssc-line: color-mix(in srgb, var(--ssc-text, #1a1a2e) 12%, transparent);",
    "  --ssc-muted: color-mix(in srgb, var(--ssc-text, #1a1a2e) 80%, transparent);",
    "  --ssc-surface: color-mix(in srgb, var(--ssc-base00, #ffffff) 92%, transparent);",
    "  --ssc-surface-2: color-mix(in srgb, var(--ssc-base01, #f0f2f5) 88%, transparent);",
    "  --ssc-border: var(--ssc-base03, #d1d5db);",
    "  --ssc-accent-ink: var(--ssc-accent, #2b6cb0);",
    "  --ssc-accent-soft: color-mix(in srgb, var(--ssc-accent, #2b6cb0) 16%, transparent);",
    "}",
    /*
     * Scrollbars in the theme's colours: the browser's default bar is a
     * white strip that stands out on a dark or coloured theme. A rounded
     * thumb in the text colour on a clear track, the accent on hover.
     */
    ".ssc-layer ::-webkit-scrollbar { width: 12px; height: 12px; }",
    ".ssc-layer ::-webkit-scrollbar-track, .ssc-layer ::-webkit-scrollbar-corner { background: transparent; }",
    ".ssc-layer ::-webkit-scrollbar-thumb {",
    "  border: 3px solid transparent; border-radius: 99px; background-clip: padding-box;",
    "  background-color: color-mix(in srgb, var(--ssc-text, #1a1a2e) 28%, transparent);",
    "}",
    ".ssc-layer ::-webkit-scrollbar-thumb:hover { background-color: color-mix(in srgb, var(--ssc-accent, #2b6cb0) 70%, transparent); }",
    ".ssc-layer ::-webkit-scrollbar-button { display: none; }",
    // Firefox has no ::-webkit-scrollbar; the standard pair does the same there.
    "@supports not selector(::-webkit-scrollbar) {",
    "  .ssc-layer * { scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--ssc-text, #1a1a2e) 28%, transparent) transparent; }",
    "}",
    /* the settings panel's visual treatment */
    ".ssc-panel {",
    "  border: 1px solid var(--ssc-line);",
    "  border-radius: 14px;",
    "  background: var(--ssc-surface);",
    "  color: var(--ssc-text, #1a1a2e);",
    "  backdrop-filter: blur(12px);",
    "  -webkit-backdrop-filter: blur(12px);",
    "  box-shadow: 0 8px 24px rgba(0, 0, 0, .4);",
    "  font-size: 14px;",
    "  line-height: 1.45;",
    "}",
    ".ssc-panel {",
    "  position: fixed;",
    // Above the Resultaten loading overlay (z-index 1, walkout.js), so
    // settings stay usable while the page is still loading.
    "  z-index: 2;",
    // A centred window like smpp's settings window: sidebar + page.
    "  top: 50%;",
    "  left: 50%;",
    "  transform: translate(-50%, -50%);",
    "  width: min(900px, calc(100vw - 32px));",
    "  height: min(600px, calc(100vh - 32px));",
    "  border-radius: 2rem;",
    "  display: none;",
    "  flex-direction: column;",
    "  pointer-events: auto;",
    "  overflow: hidden;",
    "}",
    ".ssc-panel[data-open='1'] { display: flex; }",
    ".ssc-window-body { flex: 1; min-height: 0; }",
    ".ssc-window-close { position: absolute; top: 1rem; right: 1rem; z-index: 1; font-size: 1.6rem; }",
    ".ssc-head {",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: space-between;",
    "  gap: 8px;",
    "  padding: 12px 16px;",
    "  border-bottom: 1px solid var(--ssc-line);",
    "}",
    ".ssc-title { margin: 0; font-size: 15px; font-weight: 700; }",
    ".ssc-close {",
    "  border: 0;",
    "  background: transparent;",
    "  color: var(--ssc-muted);",
    "  font-size: 18px;",
    "  line-height: 1;",
    "  cursor: pointer;",
    "  padding: 4px 6px;",
    "  border-radius: 6px;",
    "  pointer-events: auto;",
    "}",
    ".ssc-close:hover { background: var(--ssc-accent-soft); color: var(--ssc-text, #1a1a2e); }",
    ".ssc-tabs { display: flex; gap: 4px; padding: 8px 16px 0; flex-wrap: wrap; }",
    ".ssc-tab {",
    "  border: 0;",
    "  background: transparent;",
    "  color: var(--ssc-muted);",
    "  font-size: 13px;",
    "  font-weight: 600;",
    "  padding: 6px 10px;",
    "  border-radius: 8px 8px 0 0;",
    "  cursor: pointer;",
    "  pointer-events: auto;",
    "}",
    ".ssc-tab:hover { color: var(--ssc-text, #1a1a2e); }",
    ".ssc-tab[data-active='1'] { color: var(--ssc-accent-ink); background: var(--ssc-accent-soft); }",
    ".ssc-body { overflow: auto; padding: 16px; }",
    ".ssc-section { display: none; }",
    ".ssc-section[data-active='1'] { display: block; }",
    ".ssc-hint { color: var(--ssc-muted); font-size: 12px; margin-top: 10px; }",
    ".ssc-block { margin-bottom: 16px; }",
    ".ssc-block:last-child { margin-bottom: 0; }",
    ".ssc-block-title {",
    "  margin: 0 0 8px;",
    "  font-size: 12px;",
    "  font-weight: 700;",
    "  text-transform: uppercase;",
    "  letter-spacing: .05em;",
    "  color: var(--ssc-accent-ink);",
    "}",
    ".ssc-field { margin-bottom: 10px; }",
    ".ssc-label {",
    "  display: block;",
    "  font-size: 12px;",
    "  color: var(--ssc-muted);",
    "  margin-bottom: 4px;",
    "}",
    ".ssc-input {",
    "  width: 100%;",
    "  box-sizing: border-box;",
    "  font: inherit;",
    "  font-size: 13px;",
    "  padding: 6px 8px;",
    "  border: 1px solid var(--ssc-line);",
    "  border-radius: 8px;",
    "  background: var(--ssc-surface-2);",
    "  color: var(--ssc-text, #1a1a2e);",
    "  pointer-events: auto;",
    "}",
    ".ssc-input::placeholder { color: var(--ssc-muted); }",
    ".ssc-input:focus-visible { outline: 2px solid var(--ssc-accent-ink); outline-offset: 1px; }",
    ".ssc-input option { background-color: var(--ssc-base00, #ffffff); color: var(--ssc-text, #1a1a2e); }",
    ".ssc-textarea { resize: vertical; font-family: ui-monospace, Menlo, Consolas, monospace; }",
    ".ssc-range { flex: 1; accent-color: var(--ssc-accent-ink); pointer-events: auto; }",
    ".ssc-zoom-row { display: flex; align-items: center; gap: 10px; }",
    ".ssc-zoom-value {",
    "  font-size: 12px;",
    "  font-weight: 700;",
    "  color: var(--ssc-accent-ink);",
    "  min-width: 42px;",
    "  text-align: right;",
    "}",
    ".ssc-color-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }",
    ".ssc-color-label { font-size: 12px; color: var(--ssc-muted); }",
    ".ssc-color {",
    "  width: 44px;",
    "  height: 26px;",
    "  padding: 0;",
    "  border: 1px solid var(--ssc-line);",
    "  border-radius: 6px;",
    "  background: var(--ssc-surface-2);",
    "  cursor: pointer;",
    "  pointer-events: auto;",
    "}",
    ".ssc-custom-form {",
    "  margin-top: 8px;",
    "  padding: 10px;",
    "  border: 1px dashed var(--ssc-border);",
    "  border-radius: 10px;",
    "}",
    ".ssc-btn {",
    "  font: inherit;",
    "  font-size: 13px;",
    "  font-weight: 600;",
    "  padding: 7px 12px;",
    "  border: 0;",
    "  border-radius: 8px;",
    "  background: var(--ssc-accent-ink);",
    "  color: var(--ssc-base00, #ffffff);",
    "  cursor: pointer;",
    "  pointer-events: auto;",
    "}",
    ".ssc-btn:hover { filter: brightness(1.08); }",
    ".ssc-btn:disabled { opacity: .55; cursor: default; }",
    ".ssc-saved-themes { margin-top: 8px; }",
    ".ssc-saved-row { display: inline-block; margin: 0 4px 4px 0; }",
    ".ssc-saved-btn {",
    "  font: inherit;",
    "  font-size: 12px;",
    "  padding: 4px 9px;",
    "  border: 1px solid var(--ssc-line);",
    "  border-radius: 999px;",
    "  background: var(--ssc-surface-2);",
    "  color: var(--ssc-text, #1a1a2e);",
    "  cursor: pointer;",
    "  pointer-events: auto;",
    "}",
    ".ssc-saved-btn:hover { border-color: var(--ssc-accent-ink); color: var(--ssc-accent-ink); }",
    ".ssc-btn-ghost {",
    "  font: inherit;",
    "  font-size: 13px;",
    "  font-weight: 600;",
    "  padding: 7px 12px;",
    "  border: 1px solid var(--ssc-line);",
    "  border-radius: 8px;",
    "  background: var(--ssc-surface-2);",
    "  color: var(--ssc-text, #1a1a2e);",
    "  cursor: pointer;",
    "  pointer-events: auto;",
    "}",
    ".ssc-btn-ghost:hover { border-color: var(--ssc-accent-ink); color: var(--ssc-accent-ink); }",
    ".ssc-check-row {",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 7px;",
    "  margin-bottom: 8px;",
    "  font-size: 13px;",
    "  color: var(--ssc-text, #1a1a2e);",
    "  cursor: pointer;",
    "  user-select: none;",
    "}",
    ".ssc-check { width: 14px; height: 14px; margin: 0; accent-color: var(--ssc-accent-ink); }",
    /* --- widget section in the settings panel --- */
    ".ssc-widget-list { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }",
    ".ssc-widget-row {",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 8px;",
    "  padding: 7px 9px;",
    "  border: 1px solid var(--ssc-line);",
    "  border-radius: 8px;",
    "  background: var(--ssc-surface-2);",
    "  font-size: 13px;",
    "}",
    ".ssc-widget-row[data-drag='1'] { outline: 2px dashed var(--ssc-accent-ink); }",
    ".ssc-widget-grip {",
    "  flex: none;",
    "  cursor: grab;",
    "  color: var(--ssc-muted);",
    "  font-size: 13px;",
    "  letter-spacing: -2px;",
    "  user-select: none;",
    "  pointer-events: auto;",
    "}",
    ".ssc-widget-icon { flex: none; width: 20px; text-align: center; }",
    ".ssc-widget-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".ssc-widget-remove {",
    "  flex: none;",
    "  border: 0;",
    "  background: transparent;",
    "  color: var(--ssc-muted);",
    "  cursor: pointer;",
    "  font: inherit;",
    "  font-size: 15px;",
    "  line-height: 1;",
    "  padding: 0 4px;",
    "  pointer-events: auto;",
    "}",
    ".ssc-widget-remove:hover { color: var(--ssc-text, #1a1a2e); background: var(--ssc-accent-soft); border-radius: 6px; }",
    ".ssc-widget-empty {",
    "  padding: 10px;",
    "  border: 1px dashed var(--ssc-border);",
    "  border-radius: 8px;",
    "  color: var(--ssc-muted);",
    "  font-size: 12px;",
    "  text-align: center;",
    "}",
    /* --- widget picker modal (shadow DOM, same surface as the panel) --- */
    ".ssc-modal {",
    "  position: fixed;",
    "  inset: 0;",
    "  z-index: 2147483002;",
    "  display: none;",
    "  align-items: center;",
    "  justify-content: center;",
    "  padding: 16px;",
    "  background: color-mix(in srgb, var(--ssc-base00, #ffffff) 55%, transparent);",
    "  pointer-events: auto;",
    "}",
    ".ssc-modal[data-open='1'] { display: flex; }",
    ".ssc-modal-card {",
    "  width: min(520px, calc(100vw - 32px));",
    "  max-height: min(76vh, 660px);",
    "  display: flex;",
    "  flex-direction: column;",
    "  border: 1px solid var(--ssc-line);",
    "  border-radius: 14px;",
    "  background: var(--ssc-surface);",
    "  color: var(--ssc-text, #1a1a2e);",
    "  backdrop-filter: blur(12px);",
    "  -webkit-backdrop-filter: blur(12px);",
    "  box-shadow: 0 8px 24px rgba(0, 0, 0, .4);",
    "  overflow: hidden;",
    "}",
    ".ssc-modal-head {",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: space-between;",
    "  gap: 8px;",
    "  padding: 12px 16px;",
    "  border-bottom: 1px solid var(--ssc-line);",
    "  font-size: 13px;",
    "  font-weight: 700;",
    "}",
    ".ssc-modal-body { padding: 12px 16px 16px; overflow: auto; }",
    ".ssc-cat-title {",
    "  margin: 12px 0 8px;",
    "  font-size: 11px;",
    "  font-weight: 700;",
    "  text-transform: uppercase;",
    "  letter-spacing: .06em;",
    "  color: var(--ssc-accent-ink);",
    "}",
    ".ssc-cat-title:first-child { margin-top: 0; }",
    ".ssc-pick-row {",
    "  display: flex;",
    "  align-items: flex-start;",
    "  gap: 10px;",
    "  padding: 10px;",
    "  border: 1px solid var(--ssc-line);",
    "  border-radius: 10px;",
    "  background: var(--ssc-surface-2);",
    "  margin-bottom: 8px;",
    "}",
    ".ssc-pick-icon { flex: none; width: 26px; text-align: center; font-size: 20px; line-height: 1.2; }",
    ".ssc-pick-info { flex: 1; min-width: 0; }",
    ".ssc-pick-name { font-weight: 700; font-size: 13px; }",
    ".ssc-pick-desc { font-size: 12px; color: var(--ssc-muted); }",
    ".ssc-pick-add { flex: none; align-self: center; }",
    ".ssc-pick-empty { padding: 18px; text-align: center; color: var(--ssc-muted); font-size: 13px; }",
    "/* ---------- liquid glass window, premium buttons ---------- */",
    ".ssc-panel { background: linear-gradient(160deg, color-mix(in srgb, var(--ssc-base00, #ffffff) 66%, transparent), color-mix(in srgb, var(--ssc-base00, #ffffff) 44%, transparent));",
    "  -webkit-backdrop-filter: blur(28px) saturate(1.7); backdrop-filter: blur(28px) saturate(1.7);",
    "  border: 1px solid color-mix(in srgb, white 34%, transparent);",
    "  box-shadow: inset 0 1.5px 0 rgba(255,255,255,.5), inset 0 0 40px -14px rgba(255,255,255,.35), 0 40px 90px -30px rgba(0,0,0,.6); }",
    ".ssc-panel[data-open='1'] { animation: ssc-panel-in .45s cubic-bezier(.34,1.56,.64,1) both; }",
    "@keyframes ssc-panel-in { from { opacity: 0; scale: .96; } }",
    ".ssc-btn, .ssc-btn-ghost, .ssc-saved-btn, .ssc-wg-btn { transition: translate .4s cubic-bezier(.34,1.56,.64,1), scale .4s cubic-bezier(.34,1.56,.64,1), box-shadow .25s ease, filter .2s ease, border-color .2s ease, color .2s ease;",
    "  box-shadow: inset 0 1px 0 rgba(255,255,255,.32), 0 8px 16px -10px var(--ssc-shadow, rgba(0,0,0,.45)); }",
    ".ssc-btn { background: linear-gradient(180deg, color-mix(in srgb, var(--ssc-accent-ink) 86%, white), var(--ssc-accent-ink)); }",
    ".ssc-btn-ghost, .ssc-saved-btn, .ssc-wg-btn { background-image: linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,0)); }",
    ".ssc-btn:hover:not(:disabled), .ssc-btn-ghost:hover, .ssc-saved-btn:hover, .ssc-wg-btn:hover { translate: 0 -1px;",
    "  box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 12px 22px -10px var(--ssc-shadow, rgba(0,0,0,.55)); }",
    ".ssc-btn:active:not(:disabled), .ssc-btn-ghost:active, .ssc-saved-btn:active, .ssc-wg-btn:active { scale: .96; }",
  ].join("\n") +
    // settings-window.js loads first (manifest order) and owns its own rules.
    (window.sscSettingsWindow ? "\n" + window.sscSettingsWindow.CSS : "");

  /**
   * Loads an on-demand module (lazy.js). Resolves false instead of
   * rejecting, so callers only decide what to show when it is missing.
   */
  function loadModule(name) {
    if (typeof window.sscLoadModule !== "function") return Promise.resolve(false);
    return window.sscLoadModule(name).then(
      function () {
        return true;
      },
      function (e) {
        console.error("[SSC] module " + name + " failed to load", e);
        return false;
      }
    );
  }

  /** A lazily loaded module's stylesheet, added to the shadow root once. */
  function ensureModuleCss(name, css) {
    if (!shadow || !css || shadow.querySelector("style[data-ssc-mod='" + name + "']")) return;
    var style = document.createElement("style");
    style.setAttribute("data-ssc-mod", name);
    style.textContent = css;
    shadow.appendChild(style);
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  /* ---------- settings UI ---------- */

  /*
   * The panel body is Smartschool++'s settings window (settings-window.js):
   * a sidebar with Profiel / Uiterlijk / Widgets / Cijfers /
   * Overig and one page beside it. This file only owns the panel shell
   * (open/close, Escape, outside click, re-mount).
   *
   * Old callers still pass the previous tab names; they map onto pages.
   */
  var PAGE_FOR_TAB = {
    settings: null, // keep whatever page was open last
    cutscenes: "grades",
    profile: "profile",
    appearance: "appearance",
    topNav: "appearance", // the Navigatie page is gone
    widgets: "widgets",
    grades: "grades",
    other: "other",
  };

  function renderSettings(page) {
    if (!settingsBody) return;
    var sw = window.sscSettingsWindow;
    if (!sw) {
      settingsBody.textContent = "";
      settingsBody.appendChild(el("div", "ssc-hint", "De instellingen konden niet geladen worden."));
      return;
    }
    sw.render(settingsBody);
    if (page) sw.show(page);
  }

  /**
   * The panel's visibility has exactly three mirrors, written together by
   * setPanelState(): the in-memory `panelOpen` flag, the `data-open`
   * attribute (the one the stylesheet reads) and the `open` class. Reading
   * only one of them is how "sometimes the gear does nothing" happened: a
   * flag left at true made the next click take the close path while the
   * panel was already closed.
   */
  function setPanelState(open) {
    panelOpen = !!open;
    if (!panelEl) return;
    panelEl.setAttribute("data-open", open ? "1" : "0");
    if (open) panelEl.classList.add("open");
    else panelEl.classList.remove("open");
  }

  /** Authoritative "is it visible right now?", never the cached flag alone. */
  function isPanelOpen() {
    return !!(
      panelOpen &&
      panelEl &&
      panelEl.isConnected &&
      panelEl.getAttribute("data-open") === "1" &&
      panelEl.classList.contains("open")
    );
  }

  /**
   * If an SPA render detached the host or the panel, put them back before
   * showing anything. Cheap on the normal path: two isConnected checks.
   */
  function ensurePanelMounted() {
    if (host && !host.isConnected && document.documentElement) {
      document.documentElement.appendChild(host);
    }
    if (!shadow || !panelEl || panelEl.isConnected) return;

    var layer = shadow.querySelector(".ssc-layer");
    if (!layer) {
      layer = el("div", "ssc-layer");
      shadow.appendChild(layer);
    }
    if (!shadow.querySelector("style[data-ssc-base]")) {
      var style = document.createElement("style");
      style.setAttribute("data-ssc-base", "1");
      style.textContent = STYLE;
      shadow.insertBefore(style, shadow.firstChild);
    }
    layer.appendChild(panelEl);

    // The Team manager and the widgets grid live in the same layer and are
    // owned by other modules; they rescue themselves, but the layer must be
    // the same one, so a re-mount is announced rather than guessed at.
    if (typeof window.sscOnLayerRemount === "function") {
      try {
        window.sscOnLayerRemount(layer);
      } catch (e) {
        /* A module that cannot recover must not block the panel. */
      }
    }
  }

  function openPanel(tab) {
    // The gear is mounted before the page-quiet wait, so a fast click can
    // land before build() has run. Build on demand instead of doing nothing.
    if (!panelEl) build();
    ensurePanelMounted();
    if (!panelEl) return;

    // Bug 6: the full-screen Team manager and the hub are competing surfaces.
    if (typeof window.sscTeamClose === "function") window.sscTeamClose();
    if (typeof window.sscHubClose === "function") window.sscHubClose();

    if (tab === "team") {
      // The manager replaces the panel rather than living inside it.
      closePanel();
      loadModule("team").then(function (ok) {
        if (ok && typeof window.sscTeamOpen === "function") window.sscTeamOpen();
      });
      return;
    }

    setPanelState(true);
    // Re-read storage on every open, so the page never shows stale values.
    renderSettings(tab && PAGE_FOR_TAB[tab] ? PAGE_FOR_TAB[tab] : null);
  }

  function closePanel() {
    if (!panelEl) return;
    setPanelState(false);
  }

  /**
   * The full-screen Team manager is its own top-level surface (Bug 15), so it
   * is opened through here: everything else closes first (Bug 6), and the
   * team module stays unaware of the panel's internals.
   */
  window.sscTeamOpenSurfaces = function () {
    closePanel();
    if (typeof window.sscHubClose === "function") window.sscHubClose();
    loadModule("team").then(function (ok) {
      if (ok && typeof window.sscTeamOpen === "function") window.sscTeamOpen();
    });
  };

  /**
   * Bug 6's single "close everything else" primitive. Every module that owns
   * a full-screen or floating surface calls this before it opens, so no
   * combination of panel + team + hub + cutscene can ever be on screen
   * together. Closing a closed surface is a no-op in every case.
   */
  window.sscCloseSurfaces = function () {
    if (isPanelOpen()) closePanel();
    if (typeof window.sscTeamClose === "function") window.sscTeamClose();
    if (typeof window.sscHubClose === "function") window.sscHubClose();
  };

  /* The calculator lives inside the Hub now: this opens it on that view. */
  window.sscOpenCalc = function () {
    window.sscCloseSurfaces();
    loadModule("hub").then(function (ok) {
      if (ok && typeof window.sscHubOpen === "function") window.sscHubOpen("calc");
    });
  };

  function onPanelKey(e) {
    if (e.key !== "Escape") return;
    if (document.documentElement.getAttribute("data-ssc-team-open") === "1") {
      if (typeof window.sscTeamClose === "function") window.sscTeamClose();
      return;
    }
    if (!isPanelOpen()) return;
    // No preventDefault: a cutscene above the panel owns its own Escape and
    // must still get it.
    closePanel();
  }

  /* ---------- the topbar button (only way into the panel) ---------- */

  var TOPBAR_ATTR = "data-ssc-topbar-btn";
  var CALC_ATTR = "data-ssc-calc-btn";
  var HUB_ATTR = "data-ssc-hub-btn";

  /*
   * smpp's pattern, copied from dmenu.ts createQuickMenuButton(): a real
   * <button> carrying Smartschool's own pill class, inserted into the topbar.
   * The class is what makes it identical to its siblings — navigation.css
   * sets height 2.5rem, the 2px base02 border, the 10000px radius, the
   * 0.15rem/0.75rem padding, the flex centring and the hover fill for every
   * `.topnav__btn`.
   *
   * The glyphs are `currentColor` so they follow the pill's own colour on any
   * palette, with no icon asset to ship and no theme to keep in sync. The
   * pill's colour is `var(--ssc-text, #1a1a2e)` from navigation.css; the SSC additions
   * in themes.css point our two glyphs at `--ssc-topbar-text` as well.
   *
   * Gear = the settings/panel button. Material's filled settings glyph at the
   * same 24-unit box as smpp's bell and search icons, so the weight matches.
   */
  var TOPBAR_ICON =
    '<svg data-ssc-glyph="1" viewBox="0 0 24 24" width="20" height="20" focusable="false" aria-hidden="true" fill="currentColor">' +
    '<path d="M19.14,12.94a7.07,7.07,0,0,0,.06-.94,7.07,7.07,0,0,0-.06-.94l2.03-1.58a.49.49,0,0,0,.12-.61l-1.92-3.32a.49.49,0,0,0-.59-.22l-2.39,1a6.84,6.84,0,0,0-1.62-.94l-.36-2.54a.48.48,0,0,0-.48-.41h-3.84a.48.48,0,0,0-.47.41l-.36,2.54a7.11,7.11,0,0,0-1.63.94l-2.39-1a.48.48,0,0,0-.59.22L2.74,8.87a.48.48,0,0,0,.12.61l2.03,1.58a7.07,7.07,0,0,0-.06.94,7.07,7.07,0,0,0,.06.94L2.86,14.52a.49.49,0,0,0-.12.61l1.92,3.32a.49.49,0,0,0,.59.22l2.39-1a6.84,6.84,0,0,0,1.62.94l.36,2.54a.48.48,0,0,0,.48.41h3.84a.48.48,0,0,0,.47-.41l.36-2.54a7.11,7.11,0,0,0,1.63-.94l2.39,1a.48.48,0,0,0,.59-.22l1.92-3.32a.49.49,0,0,0-.12-.61ZM12,15.6A3.6,3.6,0,1,1,15.6,12,3.6,3.6,0,0,1,12,15.6Z"></path>' +
    "</svg>";

  /* The hub button is plain text, not an icon. */
  var HUB_LABEL = "Islands";
  /* A game controller, so the button reads as the games hub. currentColor like TOPBAR_ICON. */
  var GAMEPAD_ICON =
    '<svg data-ssc-glyph="1" viewBox="0 0 24 24" width="20" height="20" focusable="false" aria-hidden="true" fill="currentColor">' +
    '<path d="M7.5 6h9a5.5 5.5 0 0 1 5.4 4.6l.9 5.6a2.9 2.9 0 0 1-5 2.4l-2.2-2.5a1.5 1.5 0 0 0-1.1-.5H9.5a1.5 1.5 0 0 0-1.1.5l-2.2 2.5a2.9 2.9 0 0 1-5-2.4l.9-5.6A5.5 5.5 0 0 1 7.5 6Zm-.2 3.2a.8.8 0 0 0-.8.8v1H5.5a.8.8 0 0 0 0 1.6h1v1a.8.8 0 0 0 1.6 0v-1h1a.8.8 0 0 0 0-1.6h-1v-1a.8.8 0 0 0-.8-.8Zm9.2.3a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.200Zm2.600 2.200a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.200Z"/>' +
    "</svg>";
  var DONATE_ATTR = "data-ssc-donate-btn";
  var DONATE_LABEL = "Doneer";
  /* "Beheer": admin panel button next to Islands, for the owner's Smartschool id only (hub.js checks the id again). */
  var ADMIN_ATTR = "data-ssc-admin-btn";
  var ADMIN_IDS = ["4005_14660_0"];
  var adminKnown = false;
  var adminAsked = 0; // checks done so far
  var adminTimer = 0;
  /* Visible to the owner: by Smartschool id, or by the name Smartschool shows in the top bar (letters only, so "Iwert Dedijn" and "De Dijn Iwert" both match).
     This only decides whether the button shows; the database rules (/admins) decide whether an edit is allowed. */
  window.sscIsAdminUi = function (uid) {
    if (ADMIN_IDS.indexOf(uid) !== -1) return true;
    var node = document.querySelector(".js-btn-profile .hlp-vert-box span");
    var name = ((node && (node.getAttribute("data-ssc-orig-name") || node.textContent)) || "").toLowerCase().replace(/[^a-z]/g, "");
    return name.indexOf("iwert") !== -1 && name.indexOf("dijn") !== -1;
  };

  /*
   * The three right-hand glyphs, copied from smpp.
   *
   * main.ts:153-193 updateTopNavIcons() takes the bell, the home link, the
   * messages link and the search button and replaces their innerHTML with
   * smpp's own markup from fixes-utils/svgs.ts. That is why smpp has no CSS
   * rule for these icons: after init they are not Smartschool's icons at all
   * but smpp's SVGs, and their classes are painted by general.css rules that
   * are already in our verbatim copy — `.text-color-fill` (svgs.ts above),
   * `.text-stroke` and `.st5` (searchButtonSvg below).
   *
   *   svgs.ts:15-20  notfisSvg        -> .js-btn-notifs (bell)
   *   svgs.ts:109-115 searchButtonSvg -> .topnav__btn--icon--search (search)
   *   main.ts:112     changeLogoutText() -> .js-btn-logout, TEXT not an icon
   *
   * svgs.ts:16 has a stray text node inside notfisSvg
   * ("span.js-badge-msg.topnav__badge"); it renders nothing and is dropped.
   */
  var BELL_SVG = [
    '<svg data-ssc-glyph="1" xmlns="http://www.w3.org/2000/svg" width="20px" height="20px" viewBox="0 0 24 24" class="text-color-fill">',
    '<path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C9.9695 2 8.34903 2.72578 7.24822 3.98079C6.16397 5.21692 5.66667 6.87057 5.66667 8.6V10.3333C5.66667 10.5774 5.55716 10.8709 5.27166 11.2498C4.99798 11.6129 4.6427 11.9534 4.25022 12.3296L4.18372 12.3934C3.49997 13.0494 3 13.9996 3 15.1333C3 16.67 4.19824 18 5.77778 18H18.2222C19.8018 18 21 16.67 21 15.1333C21 13.9996 20.5 13.0494 19.8163 12.3934L19.7498 12.3296L19.7497 12.3296C19.3573 11.9534 19.002 11.6129 18.7283 11.2498C18.4428 10.8709 18.3333 10.5774 18.3333 10.3333V8.6C18.3333 6.87057 17.836 5.21692 16.7518 3.98079C15.651 2.72578 14.0305 2 12 2Z"/>',
    '<path fill-rule="evenodd" clip-rule="evenodd" d="M9.44303 19.1694C9.90172 18.8618 10.5229 18.9843 10.8305 19.443C10.9299 19.5912 11.0843 19.731 11.2919 19.8345C11.4998 19.938 11.7444 19.9964 12 19.9964C12.2556 19.9964 12.5002 19.938 12.7081 19.8345C12.9157 19.731 13.0701 19.5912 13.1695 19.443C13.4771 18.9843 14.0983 18.8618 14.557 19.1694C15.0157 19.4771 15.1381 20.0983 14.8305 20.557C14.5234 21.0149 14.0944 21.3783 13.6 21.6246C13.1058 21.8708 12.5546 21.9964 12 21.9964C11.4454 21.9964 10.8942 21.8708 10.4 21.6246C9.90564 21.3783 9.47658 21.0149 9.16946 20.557C8.86186 20.0983 8.98434 19.4771 9.44303 19.1694Z"/>',
    "</svg>",
  ].join("");

  var SEARCH_SVG = [
    '<svg data-ssc-glyph="1" class="searchIcon" width="25" height="25" viewBox="0 0 25 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">',
    '<path d="M16.0073 9.00364C16.0073 12.8716 12.8716 16.0073 9.00364 16.0073C5.13564 16.0073 2 12.8716 2 9.00364C2 5.13564 5.13564 2 9.00364 2C12.8716 2 16.0073 5.13564 16.0073 9.00364Z" class="text-stroke" stroke-width="4"></path>',
    '<rect x="16.594" y="12.8062" width="11.8729" height="3.95764" rx="1.97882" transform="rotate(45 16.594 12.8062)" class="st5"></rect>',
    "</svg>",
  ].join("");

  /* main.ts:112 changeLogoutText() — smpp replaces the log-out glyph with
     text and no icon at all. Dutch, since this is a Dutch platform. */
  var LOGOUT_TEXT = "Afmelden →";

  /**
   * smpp's updateTopNavIcons(), minus the settings-tab switches: it swaps
   * each button's innerHTML for an SVG that carries a class general.css
   * paints, and keeps the unread badge by re-appending the span it took out
   * (main.ts:158-160). Smartschool re-renders these buttons on navigation, so
   * the marker attribute is what makes a second pass a no-op.
   */
  /*
   * Only while a theme is active. The glyphs are painted by smpp's classes
   * (.text-color-fill, .text-stroke, .st5, the logout colour rule), and the
   * whole smpp sheet is gated behind html[data-ssc-theme]. On "Geen thema"
   * those rules are off, so a swapped glyph renders with the SVG default:
   * black. Geen thema means plain Smartschool, so the original icons go back.
   *
   * The original NODES are kept, not their HTML: Smartschool's own code holds
   * a reference to the unread badge span and updates it in place.
   */
  function themeActive() {
    return document.documentElement.hasAttribute("data-ssc-theme");
  }

  function swapIn(btn, html, keepBadge) {
    if (!btn || btn.__sscOrig) return;
    var badge = keepBadge ? btn.querySelector("span") : null;
    btn.__sscOrig = {
      nodes: Array.prototype.slice.call(btn.childNodes),
      badge: badge,
      badgeParent: badge ? badge.parentNode : null,
      badgeNext: badge ? badge.nextSibling : null,
    };
    while (btn.firstChild) btn.removeChild(btn.firstChild);
    btn.insertAdjacentHTML("beforeend", html);
    if (badge) btn.appendChild(badge);
  }

  function swapOut(btn) {
    if (!btn || !btn.__sscOrig) return;
    var orig = btn.__sscOrig;
    btn.__sscOrig = null;
    while (btn.firstChild) btn.removeChild(btn.firstChild);
    for (var i = 0; i < orig.nodes.length; i++) btn.appendChild(orig.nodes[i]);
    // A nested badge was lifted out of its parent; put it back in its place.
    if (orig.badge && orig.badgeParent && orig.badgeParent !== btn && btn.contains(orig.badgeParent)) {
      var next = orig.badgeNext && orig.badgeNext.parentNode === orig.badgeParent ? orig.badgeNext : null;
      orig.badgeParent.insertBefore(orig.badge, next);
    }
  }

  function applyTopbarGlyphs() {
    var nav = topbarNav();
    if (!nav) return;
    var bell = nav.querySelector(".js-btn-notifs");
    var search = nav.querySelector(".topnav__btn--icon--search") || nav.querySelector(".js-btn-search");
    var logout = nav.querySelector(".js-btn-logout");

    if (!themeActive()) {
      swapOut(bell);
      swapOut(search);
      swapOut(logout);
      if (logout) logout.removeAttribute("data-ssc-logout");
      return;
    }

    if (bell && !bell.querySelector("[data-ssc-glyph]")) swapIn(bell, BELL_SVG, true);
    if (search && !search.querySelector("[data-ssc-glyph]")) swapIn(search, SEARCH_SVG, false);

    if (logout && !logout.getAttribute("data-ssc-logout")) {
      logout.setAttribute("data-ssc-logout", "1");
      swapIn(logout, LOGOUT_TEXT, false);
    }
  }

  function topbarNav() {
    return (
      document.querySelector("nav.topnav") ||
      document.querySelector(".smsc-topnav") ||
      document.querySelector(".topnav")
    );
  }

  /**
   * Insert-or-repair. Called on boot and after every topbar re-render, so it
   * must be idempotent: an existing [data-ssc-topbar-btn] is reused, never
   * duplicated, and moved back into the bar if a render detached it.
   */
  function mountTopbarButton() {
    var nav = topbarNav();
    if (!nav) return false;

    var button = document.querySelector("[" + TOPBAR_ATTR + "]");
    if (button && !nav.contains(button) && button.parentNode) {
      // A re-render can leave the node attached to a bar that is on its way
      // out. Reuse the node rather than build a second one.
      button.parentNode.removeChild(button);
    }

    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "topnav__btn";
      button.setAttribute(TOPBAR_ATTR, "1");
      button.setAttribute("aria-label", "Smartschool Combined");
      button.title = "Smartschool Combined";
      button.innerHTML = TOPBAR_ICON;
    }

    /*
     * The hub button sits right after the gear (mountHubButton puts it
     * there). "In place" must allow for it; checking only
     * `button.nextSibling === anchor` was false every time once the hub
     * button existed, so the gear and the hub button were moved on every
     * observer tick, ~4x a second, forever. A click whose mousedown and
     * mouseup straddled one of those moves landed on the nav instead of the
     * gear, and nothing ran: the "opens 1 in 2" bug.
     */
    var hubNode = document.querySelector("[" + HUB_ATTR + "]");

    // The hub follows the gear; skipping them is what
    // keeps a correct bar from being rewritten on every observer tick.
    function afterOurs(node) {
      while (node && node === hubNode) node = node.nextSibling;
      return node;
    }

    function inPlaceBefore(anchor) {
      if (button.parentNode !== nav) return false;
      return afterOurs(button.nextSibling) === anchor;
    }

    function inPlaceAtEnd() {
      if (button.parentNode !== nav) return false;
      return afterOurs(button.nextSibling) === null;
    }

    /*
     * smpp's position, copied: its settings button goes into nav.topnav as a
     * direct child, immediately before the search button's wrapper —
     *   main.ts:353-359
     *     let searchButton = document.querySelector(".topnav__btn--icon--search");
     *     topNav.insertBefore(createQuickSettingsButton(), searchButton.parentElement);
     * and its quick-menu button goes before the element that pushes the rest
     * of the bar right —
     *   main.ts:363-374
     *     let pushRight = topNav.childNodes[2];
     *     topNav.insertBefore(createQuickMenuButton(), pushRight);
     * No wrapper of our own: smpp's button is a bare `.topnav__btn` too, and
     * the class is what makes it inline with its neighbours.
     */
    var searchButton =
      nav.querySelector(".topnav__btn--icon--search") || nav.querySelector(".js-btn-search");
    var searchWrap = searchButton && searchButton.parentElement;

    function placeBefore(anchor) {
      if (!anchor || anchor === button || anchor === hubNode || anchor.parentNode !== nav) return false;
      // Already in place: writing again would be a mutation for nothing, and
      // re-trigger our own observer.
      if (inPlaceBefore(anchor)) return true;
      nav.insertBefore(button, anchor);
      return true;
    }

    if (!placeBefore(searchWrap) && !placeBefore(nav.childNodes[2])) {
      if (!inPlaceAtEnd()) nav.appendChild(button);
    }

    mountHubButton(nav, button);
    mountAdminButton(nav);
    mountDonateButton(nav);

    applyTopbarGlyphs();
    // Eigen naam: Smartschool re-renders the bar and with it the name.
    if (typeof window.sscApplyCustomName === "function") window.sscApplyCustomName();
    // Widget pencil (widget-system.js): right before the gear, start page only.
    if (typeof window.sscMountWidgetEditButton === "function") window.sscMountWidgetEditButton();
    return true;
  }

  /**
   * The hub button is the settings button's adjacent sibling: same container,
   * same class. Insert-or-repair, so an SPA re-render cannot leave a second
   * copy behind. The old topbar calculator button is gone (the calculator is
   * a Hub panel now); a copy a previous version left in the bar is removed.
   */
  function mountHubButton(nav, settingsButton) {
    var stale = document.querySelector("[" + CALC_ATTR + "]");
    if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
    var hub = document.querySelector("[" + HUB_ATTR + "]");
    if (hub && !nav.contains(hub) && hub.parentNode) hub.parentNode.removeChild(hub);
    if (!hub) {
      hub = document.createElement("button");
      hub.type = "button";
      hub.className = "topnav__btn";
      hub.setAttribute(HUB_ATTR, "1");
      hub.setAttribute("aria-label", "Islands (hub)");
      hub.title = "Islands";
    }
    // Insert-or-repair the icon too: a button a previous version left behind is text only.
    if (!hub.querySelector("svg")) {
      hub.textContent = "";
      hub.insertAdjacentHTML("beforeend", GAMEPAD_ICON);
      var lab = document.createElement("span");
      lab.textContent = HUB_LABEL;
      hub.appendChild(lab);
    }
    if (!settingsButton || settingsButton.parentNode !== nav) return;
    if (hub.parentNode === nav && settingsButton.nextSibling === hub) return;
    nav.insertBefore(hub, settingsButton.nextSibling);
  }

  /** "Beheer": text button right after Islands, only when the signed-in id is an admin. Insert-or-repair like the others. */
  function mountAdminButton(nav) {
    var btn = document.querySelector("[" + ADMIN_ATTR + "]");
    // The id is read from the page (#datePickerMenu), which does not exist yet when the bar is first built, so ask again (at most every 1.5 s) until it is known.
    // A timer, not the page observer: nothing may change on the page after the id shows up, and then no new check would ever run. Gives up after ~2 minutes (a non-admin).
    if (adminKnown !== true && !adminTimer && adminAsked < 80 && typeof window.sscGetUserId === "function") {
      adminTimer = setTimeout(function () {
        adminTimer = 0;
        adminAsked++;
        Promise.resolve(window.sscGetUserId()).then(function (uid) {
          if (window.sscIsAdminUi(uid)) adminKnown = true;
          mountTopbarButton();
        }, function () {});
      }, adminAsked ? 1500 : 0);
    }
    if (!adminKnown) { if (btn && btn.parentNode) btn.parentNode.removeChild(btn); return; }
    var hub = document.querySelector("[" + HUB_ATTR + "]");
    if (!hub || hub.parentNode !== nav) return;
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "topnav__btn";
      btn.setAttribute(ADMIN_ATTR, "1");
      btn.title = "Beheer";
      btn.textContent = "Beheer";
    }
    if (btn.parentNode === nav && hub.nextSibling === btn) return;
    nav.insertBefore(btn, hub.nextSibling);
  }

  function openAdmin() {
    // The id is checked again here (the button may have been shown by the name check); the database rules decide what may be written.
    Promise.resolve(window.sscGetUserId && window.sscGetUserId()).then(function (uid) {
      if (!window.sscIsAdminUi || !window.sscIsAdminUi(uid)) return;
      loadModule("admin").then(function (ok) {
        if (ok && typeof window.sscAdminOpen === "function") window.sscAdminOpen();
      });
    });
  }

  /*
   * Messages the owner sends (admin board → Meldingen). Asks the database for messages newer than the last one this
   * student saw, at most every 3 minutes, and only loads the popup module when there is something to show. A student's
   * first check starts "from now": older messages are never replayed.
   */
  var ANN_EVERY_MS = 3 * 60 * 1000;
  var annTries = 0;

  function checkAnnouncements() {
    if (window.top !== window || typeof window.sscGetUserId !== "function") return;
    Promise.resolve(window.sscGetUserId()).then(function (uid) {
      if (!uid || uid === "anoniem") {
        // The id comes from the page (#datePickerMenu), which may not be there yet.
        if (annTries++ < 8) setTimeout(checkAnnouncements, 4000);
        return;
      }
      var key = "sscAnnounce_" + uid;
      chrome.storage.local.get([key], function (r) {
        if (chrome.runtime.lastError) return;
        var st = (r && r[key]) || {};
        var now = Date.now();
        if (!st.since) st.since = now;
        if (st.checkedAt && now - st.checkedAt < ANN_EVERY_MS - 5000) return;
        st.checkedAt = now;
        var save = function () { var o = {}; o[key] = st; chrome.storage.local.set(o); };
        save();
        chrome.runtime.sendMessage({ type: "ssc:announceGet", userId: uid, since: Math.max(st.since, st.seen || 0) }, function (res) {
          if (chrome.runtime.lastError || !res || !res.ok || !res.items || !res.items.length) return;
          // Tell the owner's board this message arrived.
          res.items.forEach(function (it) { chrome.runtime.sendMessage({ type: "ssc:announceSeen", id: it.id, userId: uid }, function () { void chrome.runtime.lastError; }); });
          loadModule("announce").then(function (ok) {
            if (!ok || typeof window.sscAnnounceShow !== "function") return;
            window.sscAnnounceShow(res.items, function (createdAt) {
              if (createdAt > (st.seen || 0)) { st.seen = createdAt; save(); }
            });
          });
        });
      });
    });
  }

  /**
   * "Doneer": plain text, no icon, left of the profile picture. Insert-or-repair
   * like the hub button, so an SPA re-render cannot leave two behind.
   */
  function mountDonateButton(nav) {
    var profile = nav.querySelector(".topnav__btn--profile, .js-btn-profile");
    while (profile && profile.parentNode !== nav) profile = profile.parentNode;
    var btn = document.querySelector("[" + DONATE_ATTR + "]");
    if (btn && !nav.contains(btn) && btn.parentNode) btn.parentNode.removeChild(btn);
    if (!profile) return;
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ssc-donate-link";
      btn.setAttribute(DONATE_ATTR, "1");
      btn.textContent = DONATE_LABEL;
    }
    if (btn.parentNode === nav && profile.previousSibling === btn) return;
    nav.insertBefore(btn, profile);
  }

  function openDonate() {
    loadModule("welcome").then(function (ok) {
      if (ok && window.sscWelcome) window.sscWelcome.showDonate();
    });
  }

  /** Once per version: the what-is-new modal. Marked seen only after it was shown. */
  function maybeWelcome() {
    if (!document.querySelector("nav.topnav")) return;
    var v = chrome.runtime.getManifest().version;
    chrome.storage.local.get(["sscWelcomeSeen"], function (r) {
      if (chrome.runtime.lastError || (r && r.sscWelcomeSeen === v)) return;
      loadModule("welcome").then(function (ok) {
        if (!ok || !window.sscWelcome) return;
        chrome.storage.local.set({ sscWelcomeSeen: v });
        window.sscWelcome.showWelcome();
      });
    });
  }

  function openHub() {
    window.sscCloseSurfaces();
    loadModule("hub").then(function (ok) {
      if (ok && typeof window.sscHubOpen === "function") window.sscHubOpen();
    });
  }

  /*
   * One delegated capture listener instead of a listener per button.
   *
   * A listener attached at creation time does not survive Smartschool
   * cloning or re-rendering the topbar: the clone carries the marker
   * attribute but not the handler, so the button looks right and does
   * nothing. Delegation is immune to that — the attribute is the contract,
   * and document never gets replaced. Capture also makes our click run
   * before anything the page has bound to the bar.
   */
  function closestWithAttr(node, attr) {
    while (node && node.nodeType === 1) {
      if (node.getAttribute && node.getAttribute(attr) !== null) return node;
      node = node.parentNode;
    }
    return null;
  }

  /**
   * Bug 1 — the gear opened on about one click in two.
   *
   * The delegation and the three state mirrors were already correct, so the
   * remaining cause had to be that a SINGLE physical click produced more than
   * one handled event: the button is a real `<button>` inside Smartschool's
   * own bar, and their component framework re-dispatches clicks on some of
   * those controls. Two handled events on a toggle = open then immediately
   * close, which the user sees as "nothing happened", roughly half the time.
   *
   * Two cheap guards, neither of which can swallow a deliberate second click:
   *   - the same Event object is handled once (a re-dispatch of the SAME
   *     event carries the same object),
   *   - a synthetic repeat within 120ms is ignored (faster than a human
   *     double-click, and a toggle has no legitimate use for it).
   */
  var lastGearAt = 0;

  function onGearClick(e) {
    if (e) {
      if (e.__sscGearHandled) return;
      e.__sscGearHandled = true;
      e.preventDefault();
      e.stopPropagation();
    }

    var now = performance.now();
    if (now - lastGearAt < 120) {
      return;
    }
    lastGearAt = now;

    // Decide from the live DOM, never from the flag alone: if the panel is
    // already gone, opening is the only sensible action — a "close" of a
    // closed panel is exactly the silent no-op being fixed.
    var open = isPanelOpen();
    if (open) closePanel();
    else openPanel("settings");
  }

  function onTopbarClick(e) {
    if (!e || !e.target) return;
    if (closestWithAttr(e.target, TOPBAR_ATTR)) {
      onGearClick(e);
      return;
    }
    if (closestWithAttr(e.target, HUB_ATTR)) {
      e.preventDefault();
      e.stopPropagation();
      openHub();
      return;
    }
    if (closestWithAttr(e.target, ADMIN_ATTR)) {
      e.preventDefault();
      e.stopPropagation();
      openAdmin();
      return;
    }
    if (closestWithAttr(e.target, DONATE_ATTR)) {
      e.preventDefault();
      e.stopPropagation();
      openDonate();
    }
  }

  /**
   * Bug 6: only one surface open at a time.
   *
   * Smartschool's own dropdown triggers (bell, courses, planner date picker,
   * search, profile) all live inside the topbar nav. A click anywhere in that
   * bar that is not one of OUR buttons means the user is opening one of
   * Smartschool's menus, so the panel closes first. Clicks inside the panel
   * itself are left alone — that is normal use, not a competing surface.
   */
  function onDocumentClickClosePanel(e) {
    if (!isPanelOpen() || !e || !e.target) return;

    var path = typeof e.composedPath === "function" ? e.composedPath() : [];
    if (path.indexOf(panelEl) !== -1) return;

    if (closestWithAttr(e.target, TOPBAR_ATTR)) return; // gear toggles itself
    if (closestWithAttr(e.target, HUB_ATTR)) return;    // the hub closes the panel itself

    // Any other click is the user starting a different task: opening one of
    // Smartschool's own menus, a result, a message, anything. The panel is a
    // dropdown and must behave like one. Clicks inside the shadow layer that
    // are not the panel (the team overlay, a cutscene) are
    // their own surfaces and are handled above.
    closePanel();
  }

  var topbarTimer = null;

  /**
   * Smartschool re-renders the topbar on every SPA navigation, which drops
   * anything that was inserted into it. One observer, throttled: the first
   * mutation of a burst schedules a repair 250ms later, and a repair that
   * finds the button already in place writes nothing, so it cannot loop.
   */
  function watchTopbar() {
    mountTopbarButton();
    if (typeof MutationObserver !== "function" || !document.body) return;

    var observer = new MutationObserver(function () {
      if (topbarTimer) return;
      topbarTimer = setTimeout(function () {
        topbarTimer = null;
        mountTopbarButton();
      }, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- calculator dropdown ---------- */

  var CALC_ACCESS_KEY = "sscCalculatorAccess";
  var CALC_TTL_MS = 24 * 60 * 60 * 1000;

  /*
   * The class this account has to be in. Matched loosely on purpose: the API
   * has been seen writing "5D twe", the timetable "5D-TWE" and the URL "5Dtwe".
   * Case, spaces, dashes, dots and underscores are all ignored, but the two
   * parts must be one token — "tweede" alone must never match.
   */
  var CLASS_RX = /5\s*[-_.]?\s*d\s*[-_.]?\s*t\s*[-_.]?\s*w\s*[-_.]?\s*e/i;

  var calcAccess = null; // last verified entry, also the synchronous open path

  function classMatches(value) {
    return CLASS_RX.test(String(value || ""));
  }

  function calcIsFresh(entry) {
    return !!(
      entry &&
      typeof entry.granted === "boolean" &&
      typeof entry.checkedAt === "number" &&
      Date.now() - entry.checkedAt < CALC_TTL_MS &&
      // An older build cached "granted" without a class; ask again instead of trusting it.
      !(entry.granted && !entry.className)
    );
  }

  /* --- cache: its own key, never inside sscSettings --- */

  function calcCacheGet() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get([CALC_ACCESS_KEY], function (res) {
          if (chrome.runtime.lastError) return resolve(null);
          resolve((res && res[CALC_ACCESS_KEY]) || null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  function calcCacheSet(entry) {
    try {
      var payload = {};
      payload[CALC_ACCESS_KEY] = entry;
      chrome.storage.local.set(payload);
    } catch (e) {
      /* Storage unavailable: the in-memory copy still works for this page. */
    }
  }

  function calcCacheClear() {
    try {
      chrome.storage.local.remove(CALC_ACCESS_KEY);
    } catch (e) {
      /* Nothing to clear. */
    }
  }

  /* --- the Hub's Rekentoestel view reads access through here --- */

  /**
   * Resolves { granted, className, checkedAt }. A fresh cache answers at once;
   * `force` ("Opnieuw controleren") drops it and asks Smartschool again.
   */
  window.sscCalcAccess = function (force) {
    if (force) {
      calcCacheClear();
      calcAccess = null;
    } else if (calcIsFresh(calcAccess)) {
      return Promise.resolve(calcAccess);
    }
    return (force ? Promise.resolve(null) : calcCacheGet()).then(function (cached) {
      if (calcIsFresh(cached)) {
        calcAccess = cached;
        return cached;
      }
      return checkCalculatorAccess().then(function (result) {
        var entry = {
          granted: !!result.granted,
          checkedAt: Date.now(),
          className: result.className || "",
        };
        calcAccess = entry;
        calcCacheSet(entry);
        return entry;
      });
    });
  };

  /**
   * What this account may see at all: { calc, league, className }. The league
   * is for TWE classes ("TWE" as its own token, the same test as league.js,
   * so "tweede" never matches), the calculator for the class above. Both are
   * false while the class is unknown: the Hub then hides them completely.
   */
  var LEAGUE_RX = /(^|[^a-z])twe([^a-z]|$)/i;

  window.sscClassAccess = function (force) {
    return window.sscCalcAccess(force).then(function (a) {
      var name = (a && a.className) || "";
      return { calc: !!(a && a.granted), league: LEAGUE_RX.test(name), className: name };
    });
  };

  /* --- the access check --- */

  /**
   * Smartschool's own evaluations endpoint, the first page only. The class of
   * the first grade is on `courses[].class`; every row is scanned because the
   * newest evaluation does not always carry one.
   */
  function classFromApi() {
    var url = location.origin + "/results/api/v1/evaluations/?pageNumber=1&itemsOnPage=25";
    return fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        var rows = Array.isArray(data)
          ? data
          : (data && (data.items || data.results)) || [];
        for (var i = 0; i < rows.length; i++) {
          var courses = (rows[i] && rows[i].courses) || [];
          for (var j = 0; j < courses.length; j++) {
            var cls = courses[j] && courses[j].class;
            if (!cls) continue;
            var name = cls.name || cls.description || "";
            if (name) return name;
          }
        }
        return "";
      });
  }

  /** Fallback 1: the topbar / profile menu shows the class on some schools. */
  function classFromDom() {
    var selectors = [
      "nav.topnav",
      "#profileMenu",
      ".topnav__menu",
      ".js-user",
      ".user-menu",
      ".profile",
    ];
    for (var i = 0; i < selectors.length; i++) {
      var node = null;
      try {
        node = document.querySelector(selectors[i]);
      } catch (e) {
        node = null;
      }
      if (!node) continue;
      var text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (text && classMatches(text)) return text.slice(0, 80);
    }
    return "";
  }

  function classFromUrl() {
    var url = location.pathname + location.search;
    return classMatches(url) ? decodeURIComponent(url).slice(0, 80) : "";
  }

  function checkCalculatorAccess() {
    function withoutApi(reason) {
      var domName = classFromDom();
      if (domName) return { granted: true, className: domName, method: "dom" };
      var urlName = classFromUrl();
      if (urlName) return { granted: true, className: urlName, method: "url" };
      // Unknown class: closed. Everyone outside the class must never see the calculator or the league.
      console.warn("[SSC] klas niet vastgesteld (" + reason + "); rekentoestel en competitie blijven verborgen.");
      return { granted: false, className: "", method: "fallback" };
    }

    return classFromApi().then(
      function (name) {
        // A name from the API is authoritative, including a negative result.
        if (name) return { granted: classMatches(name), className: name, method: "api" };
        return withoutApi("geen klas in de API-respons");
      },
      function (err) {
        return withoutApi("API-fout: " + ((err && err.message) || err));
      }
    );
  }

  /* ---------- build ---------- */

  function build() {
    if (document.getElementById(HOST_ID)) return;

    host = document.createElement("div");
    host.id = HOST_ID;
    // Host itself stays zero-size and click-through; only children opt in.
    host.style.cssText = [
      "all:initial",
      "position:fixed",
      "bottom:0",
      "right:0",
      "width:0",
      "height:0",
      "pointer-events:none",
      "z-index:99999",
    ].join(";");

    shadow = host.attachShadow({ mode: "open" });

    var style = document.createElement("style");
    style.setAttribute("data-ssc-base", "1");
    style.textContent = STYLE;

    var layer = el("div", "ssc-layer");

    panelEl = el("div", "ssc-panel");
    panelEl.id = "ssc-panel";

    panelEl.setAttribute("role", "dialog");
    panelEl.setAttribute("aria-label", "Instellingen");

    // smpp's window has no title bar, only a close control in the corner.
    var closeBtn = el("button", "ssc-close ssc-window-close", "✕");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Sluiten");
    closeBtn.addEventListener("click", closePanel);

    settingsBody = el("div", "ssc-window-body");
    settingsBody.id = "ssc-settings";

    panelEl.appendChild(settingsBody);
    panelEl.appendChild(closeBtn);

    layer.appendChild(panelEl);
    shadow.appendChild(style);
    shadow.appendChild(layer);

    // documentElement, never body — the white-bar bug.
    document.documentElement.appendChild(host);

    renderSettings();
  }

  /* ---------- boot ---------- */

  function applyAll(s) {
    if (typeof window.sscApplyLayout === "function") {
      try {
        window.sscApplyLayout(s);
      } catch (e) {
        // A broken custom-CSS or hide-selector line must not kill the panel.
        console.error("[SSC] layout failed", e);
      }
    }
    // Theme on/off changes whether the top bar shows smpp's glyphs or
    // Smartschool's own icons; layout just set or cleared data-ssc-theme.
    applyTopbarGlyphs();

    if (typeof window.sscPercentagesApply === "function") {
      try {
        window.sscPercentagesApply(s);
      } catch (e) {
        // A table Smartschool renders differently must not kill the panel.
        console.error("[SSC] percentages failed", e);
      }
    }
  }

  /**
   * Start the widget module at most once, and only where it can render:
   * the Smartschool start page. The URL test is deliberately loose, because
   * the module itself re-checks the DOM before painting anything.
   */
  var widgetsStarted = false;

  function maybeStartWidgets() {
    if (widgetsStarted) return;
    var path = String(location.pathname || "/");
    var onStart = path === "/" || /^\/(index|dashboard|home)(\.|$|\/)/i.test(path);
    if (!onStart && !document.querySelector(".home-main, .homepage__block")) return;

    widgetsStarted = true;
    loadModule("widgets").then(function (ok) {
      if (!ok || typeof window.sscWidgetsStart !== "function") {
        widgetsStarted = false;
        return;
      }
      try {
        window.sscWidgetsStart();
      } catch (e) {
        console.error("[SSC] widgets failed", e);
      }
    });
  }

  function start() {
    build();

    /*
     * Bug 11 (lazy load): the widget registry, its picker modal and its
     * per-widget renderers are only meaningful on the start page. Starting
     * them there — and only there — keeps the Resultaten page's script cost
     * to the parts it actually uses. They start on demand when the user
     * arrives at the start page later in the same session.
     */
    maybeStartWidgets();
    document.addEventListener("click", maybeStartWidgets, true);

    // Owner messages: shortly after load, then every few minutes while the tab is open.
    setTimeout(checkAnnouncements, 3000);
    setInterval(function () { if (!document.hidden) checkAnnouncements(); }, ANN_EVERY_MS);

    // Read once so the first calculator click inside the 24h window paints
    // the stored result without a spinner.
    calcCacheGet().then(function (entry) {
      if (calcIsFresh(entry)) calcAccess = entry;
      // A TI calculator this site may already use connects on page load.
      if (!calcIsFresh(entry) || !entry.granted || !navigator.usb || typeof navigator.usb.getDevices !== "function") return;
      navigator.usb.getDevices().then(function (list) {
        var ti = (list || []).some(function (d) {
          return d.vendorId === 0x0451;
        });
        if (!ti) return;
        loadModule("ti84").then(function (ok) {
          if (ok && window.sscTi84 && typeof window.sscTi84.autoConnect === "function") window.sscTi84.autoConnect();
        });
      }, function () {});
    });

    // Apply stored layout once, then live on every change.
    window.sscGet().then(function (s) {
      applyAll(s);
      if (typeof window.sscWalkoutStart === "function") {
        try {
          window.sscWalkoutStart(s);
        } catch (e) {
          console.error("[SSC] walkout failed", e);
        }
      }
    });

    window.sscOnChange(function (next) {
      // Apply live. The settings tab is NOT re-rendered here on purpose:
      // saving on every keystroke would rebuild the controls and steal focus
      // from whichever textarea the user is typing in. It refreshes on open.
      applyAll(next);
      if (typeof window.sscWalkoutStart === "function") {
        try {
          window.sscWalkoutStart(next);
        } catch (e) {
          console.error("[SSC] walkout failed", e);
        }
      }
    });

  }

  /*
   * The topbar button goes in before the page-quiet wait: it is the only way
   * into the panel, and ~1.5s of unreachable settings on every load is the
   * "missing gear" bug again in a new costume.
   */
  // Capture phase, on document: survives every topbar re-render and fires
  // even when a cloned button has lost its own listener.
  document.addEventListener("click", onTopbarClick, true);
  document.addEventListener("click", onDocumentClickClosePanel, true);
  watchTopbar();
  document.addEventListener("keydown", onPanelKey);
  setTimeout(maybeWelcome, 2500);

  /**
   * Things that do not need a quiet page start right away instead of after the
   * quiet wait below. The widgets (widget-system.js waits for the start page's
   * own containers). And Resultaten: the grades fetch already runs from
   * walkout.js, so the loader and the reveal queue start with it. The panel's
   * host sits on <html>, so building it this early is safe, and build() does
   * nothing the second time.
   */
  function earlyStart() {
    maybeStartWidgets();
    if (!/result/i.test(String(location.href) + String(location.hash))) return;
    build();
    window.sscGet().then(function (s) {
      if (typeof window.sscWalkoutStart !== "function") return;
      try {
        window.sscWalkoutStart(s);
      } catch (e) {
        console.error("[SSC] walkout failed", e);
      }
    });
  }
  if (document.readyState !== "loading") earlyStart();
  else document.addEventListener("DOMContentLoaded", earlyStart, { once: true });

  if (document.readyState === "complete" || document.readyState === "interactive") {
    whenQuiet(start);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      whenQuiet(start);
    }, { once: true });
  }
})();
