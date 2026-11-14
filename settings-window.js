/**
 * Smartschool Combined — settings window (Pass 1).
 *
 * The layout and the control builders are Smartschool++'s settings window,
 * ported from inspiration/smpp/src/main-features/settings/main-settings.ts
 * and appearance/ui.ts:
 *   - a left sidebar: the profile button first, then one radio + label per
 *     category, each with our own inline SVG icon;
 *   - a right page (#settings-page) built from the same helpers smpp uses:
 *     createMainTitle, createSectionTitle, createDescription,
 *     createSettingsButtonWithLabel (the toggle row), createTextInput,
 *     createLabeledSlider.
 * Class names are smpp's, so Pass 2 can paste smpp's CSS with only the
 * `--color-*` → `--ssc-*` rename. The CSS below is the functional subset.
 *
 * Tabs, in smpp's order with our "Cijfers" added after Widgets:
 *   Profiel · Uiterlijk · Widgets · Cijfers · Instellingen
 *
 * Every control writes straight to sscSettings through window.sscSet; the
 * page reads storage when it is shown, so an open never shows stale values.
 */
(function () {
  "use strict";

  // Sign-in pages: do nothing at all (see guard.js).
  if (window.sscSkipPage) return;
  if (window.sscSettingsWindow) return;

  /* ---------- categories (smpp settingsSideBarCategories + Cijfers) ---------- */

  /*
   * Each icon is our own 24×24 line drawing on a coloured tile (`hue`).
   * No "Navigatie" (it never had a setting) and no "Ultimate Team": the
   * top bar has its own Team button.
   */
  var CATEGORIES = [
    { id: "appearance", name: "Uiterlijk", icon: "palette", hue: 280 },
    { id: "widgets", name: "Widgets", icon: "grid", hue: 160 },
    { id: "grades", name: "Cijfers", icon: "chart", hue: 35 },
    { id: "other", name: "Instellingen", icon: "sliders", hue: 225 },
  ];

  // [tag, attributes] per shape; strokes use currentColor.
  var ICONS = {
    palette: [
      ["path", { d: "M12 3.2a8.8 8.8 0 1 0 0 17.6c1.1 0 1.9-.8 1.9-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8h2a4.1 4.1 0 0 0 4.1-4.1C20.8 6.6 16.9 3.2 12 3.2z" }],
      ["circle", { cx: 7.6, cy: 11.6, r: 1.3, fill: "currentColor", stroke: "none" }],
      ["circle", { cx: 9.9, cy: 7.6, r: 1.3, fill: "currentColor", stroke: "none" }],
      ["circle", { cx: 14.6, cy: 7.6, r: 1.3, fill: "currentColor", stroke: "none" }],
    ],
    grid: [
      ["rect", { x: 3.6, y: 3.6, width: 7, height: 7, rx: 2 }],
      ["rect", { x: 13.4, y: 3.6, width: 7, height: 7, rx: 2 }],
      ["rect", { x: 3.6, y: 13.4, width: 7, height: 7, rx: 2 }],
      ["circle", { cx: 16.9, cy: 16.9, r: 3.5 }],
    ],
    chart: [
      ["path", { d: "M3.5 20.5h17" }],
      ["path", { d: "M6.5 17v-5.5M12 17V6.5M17.5 17v-8" }],
      ["path", { d: "M5 8.5l5-3.5 4 2.5 5-3.5", "stroke-width": 1.6 }],
    ],
    upload: [
      ["path", { d: "M12 15.5V4.5M7.5 9 12 4.5 16.5 9" }],
      ["path", { d: "M4.5 14.5v3.2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.2" }],
    ],
    trash: [
      ["path", { d: "M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" }],
      ["path", { d: "M6.5 7l.8 11.3a2 2 0 0 0 2 1.7h5.4a2 2 0 0 0 2-1.7L17.5 7M10.2 11v5.5M13.8 11v5.5" }],
    ],
    link: [
      ["path", { d: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" }],
      ["path", { d: "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" }],
    ],
    play: [
      ["circle", { cx: 12, cy: 12, r: 8.8 }],
      ["path", { d: "M10.2 8.6v6.8l5.4-3.4z", fill: "currentColor", stroke: "none" }],
    ],
    plus: [["path", { d: "M12 5v14M5 12h14" }]],
    pencil: [["path", { d: "M14.5 5.5l4 4M4.5 19.5l1-4.6 10.6-10.6a1.9 1.9 0 0 1 2.7 0l.9.9a1.9 1.9 0 0 1 0 2.7L9.1 18.5z" }]],
    shuffle: [["path", { d: "M4 7h3.5c2 0 3.2 1 4.5 3l1 1.6c1.3 2 2.5 3.4 4.5 3.4H20M17 12l3 3-3 3M4 17h3.5c1.3 0 2.2-.4 3-1.2M13.5 8.2c.8-.8 1.7-1.2 3-1.2H20M17 4l3 3-3 3" }]],
    check: [["path", { d: "M5 12.5l4.5 4.5L19 7.5" }]],
    close: [["path", { d: "M6.5 6.5l11 11M17.5 6.5l-11 11" }]],
    sliders: [
      ["path", { d: "M4 6.5h9M17.5 6.5H20M4 12h3M11.5 12H20M4 17.5h11M19.5 17.5h.5" }],
      ["circle", { cx: 15.3, cy: 6.5, r: 2.1 }],
      ["circle", { cx: 9.2, cy: 12, r: 2.1 }],
      ["circle", { cx: 17.3, cy: 17.5, r: 2.1 }],
    ],
  };

  var SVG_NS = "http://www.w3.org/2000/svg";

  function iconSvg(name) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.9");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    (ICONS[name] || []).forEach(function (shape) {
      var node = document.createElementNS(SVG_NS, shape[0]);
      Object.keys(shape[1]).forEach(function (k) {
        node.setAttribute(k, String(shape[1][k]));
      });
      svg.appendChild(node);
    });
    return svg;
  }

  var PAGES = { profile: 1, appearance: 1, widgets: 1, grades: 1, other: 1 };

  var currentPage = "appearance"; // smpp: currentPage = "appearance"
  var rootEl = null;
  var sidebarEl = null;
  var pageEl = null;

  /* ---------- CSS (functional subset of smpp settings.css / ui.css) ---------- */

  var CSS = [
    "#settings-window { display: flex; flex-direction: row; height: 100%; min-height: 0; }",

    /* sidebar — settings.css .settings-sidebar */
    ".settings-sidebar {",
    "  display: flex; flex-direction: column; gap: 1rem;",
    "  width: 20rem; flex: none; padding: 1rem; padding-right: 0;",
    "  box-sizing: border-box; overflow-y: auto;",
    "}",
    ".settings-radio { display: none; }",
    ".settings-category-button, .profile-settings-button {",
    "  box-sizing: border-box; width: 100%; display: flex; flex-direction: row;",
    "  align-items: center; justify-content: start; gap: 1rem;",
    "  border: 2px solid transparent; border-radius: 1rem;",
    "  background-color: var(--ssc-base01, #f0f2f5); color: var(--ssc-text, #1a1a2e);",
    "  cursor: pointer; pointer-events: auto;",
    "}",
    ".settings-category-button { padding: 0.75rem 1rem; font-size: 1.6rem; }",
    ".profile-settings-button { padding: 1rem; padding-right: 0.5rem; text-align: left; }",
    ".settings-category-button-js { box-shadow: 0 5px 10px 0 var(--ssc-shadow, rgba(0,0,0,.2)); margin: 0; }",
    ".settings-category-button-js:hover { background-color: var(--ssc-base02, #e5e7eb); }",
    ".settings-category-button-js:focus-visible { border-color: var(--ssc-accent, #2b6cb0); outline: none; }",
    ".settings-radio:checked + label {",
    "  border-color: var(--ssc-base03, #d1d5db); background-color: var(--ssc-base02, #e5e7eb);",
    "  color: var(--ssc-accent, #2b6cb0); font-weight: 600;",
    "}",
    ".category-button-icon {",
    "  aspect-ratio: 1; width: 3.5rem; flex: none; display: grid; place-items: center;",
    "  border-radius: 1.1rem; color: #fff;",
    "  background: linear-gradient(150deg, hsl(var(--ssc-tile-hue, 210) 78% 62%), hsl(calc(var(--ssc-tile-hue, 210) + 25) 70% 42%));",
    "  box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 2px 6px hsl(var(--ssc-tile-hue, 210) 60% 30% / .35);",
    "}",
    ".category-button-icon svg { width: 62%; height: 62%; display: block; }",
    "button.settings-category-button { font-family: inherit; text-align: left; }",
    ".profile-picture-settings {",
    "  width: 3.5rem; aspect-ratio: 1; flex: none; border-radius: 10000px;",
    "  background-size: cover; background-position: center; background-repeat: no-repeat;",
    "  display: flex; align-items: center; justify-content: center;",
    "  font-weight: 700; font-size: 1.4rem;",
    "  background-color: var(--ssc-base02, #e5e7eb); color: var(--ssc-accent, #2b6cb0);",
    "}",
    ".profile-settings-label { display: flex; flex-direction: column; gap: 0.25rem; justify-content: center; overflow: hidden; }",
    "#profile-settings-label-title { margin: 0; font-size: 1.5rem; white-space: nowrap; }",
    ".profile-settings-label-description { margin: 0; opacity: .75; }",

    /* page — settings.css #settings-page */
    "#settings-page {",
    "  flex: 1; min-width: 0; box-sizing: border-box;",
    "  padding: 1rem 0.25rem 2rem 1.5rem; overflow-y: auto;",
    "  display: flex; flex-direction: column; align-items: flex-start;",
    "}",
    // A scrolling flex column shrinks its children to fit: textareas went to
    // one line. Children keep their own height; the page scrolls instead.
    "#settings-page > * { flex-shrink: 0; }",
    ".settings-page-main-title { font-size: 2.25rem; font-weight: 700; margin: 0; }",
    ".settings-page-main-title:not(:first-child) { margin-top: 2rem; }",
    ".settings-page-section-title { font-size: 1.6rem; font-weight: 600; margin: 2rem 0 0.1rem; }",
    ".settings-page-description { opacity: .8; font-weight: 400; max-width: 30rem; font-size: 1rem; margin: 0 0 0.75rem; }",

    /* toggle row — ui.css .ssc-input-with-label + settings.css */
    ".ssc-input-with-label {",
    "  box-sizing: border-box; border-radius: 999999px; min-width: 20rem; max-width: 30rem;",
    "  background-color: var(--ssc-base01, #f0f2f5); border: 2px solid var(--ssc-base02, #e5e7eb);",
    "  padding: 0.75rem 1rem; display: flex; flex-direction: row; align-items: center;",
    "  justify-content: space-between; gap: 1rem; font-size: 1.4rem;",
    "  margin: 0 0 1rem; box-shadow: 0 2px 10px 0 var(--ssc-shadow, rgba(0,0,0,.15));",
    "  cursor: pointer; pointer-events: auto;",
    "}",
    ".ssc-input-with-label:focus-visible { border-color: var(--ssc-base03, #d1d5db); outline: none; }",
    ".ssc-input-with-label > .switch { margin-left: auto; }",

    /* switch — smpp general.css .switch / .slider */
    ".switch { position: relative; display: inline-block; width: 4.5rem; height: 2.5rem; flex: none; }",
    ".switch input { opacity: 0; width: 0; height: 0; }",
    ".slider { position: absolute; cursor: pointer; inset: 0; background-color: var(--ssc-base02, #e5e7eb); border-radius: 34px; }",
    ".slider:before {",
    "  position: absolute; content: ''; height: 2rem; width: 2rem; left: 0.25rem; top: 0.25rem;",
    "  background-color: var(--ssc-base03, #d1d5db); border-radius: 50%;",
    "}",
    ".ssc-anim .slider, .ssc-anim .slider:before { transition: transform .1s, background-color .1s; }",
    "input:checked + .slider { background-color: var(--ssc-base03, #d1d5db); }",
    "input:checked + .slider:before { background-color: var(--ssc-accent, #2b6cb0); transform: translateX(2rem); }",

    /* text input — settings.css .ssc-text-input */
    ".ssc-text-input {",
    "  box-sizing: border-box; font: inherit; font-size: 1.2rem; width: 20rem;",
    "  padding: 0.6rem 0.8rem; border-radius: 1rem;",
    "  background-color: var(--ssc-base01, #f0f2f5); color: var(--ssc-text, #1a1a2e);",
    "  border: 2px solid var(--ssc-base02, #e5e7eb); margin: 0 0 1rem;",
    "  box-shadow: 0 2px 10px 0 var(--ssc-shadow, rgba(0,0,0,.15)); pointer-events: auto;",
    "}",
    ".ssc-text-input:focus-visible { border-color: var(--ssc-base03, #d1d5db); outline: none; }",
    "select.ssc-text-input option { background: var(--ssc-base00, #ffffff); color: var(--ssc-text, #1a1a2e); }",
    "textarea.ssc-text-input { width: 30rem; max-width: 100%; resize: vertical; font-family: ui-monospace, Menlo, Consolas, monospace; }",

    /* labeled slider — settings.css .settings-page-slider-container */
    ".settings-page-slider-container {",
    "  box-sizing: border-box; display: flex; flex-direction: row; align-items: center; gap: 1rem;",
    "  height: 4rem; max-width: 30rem; min-width: 20rem; padding: 0 1rem; margin: 0 0 1rem;",
    "  border-radius: 1000px; background-color: var(--ssc-base01, #f0f2f5);",
    "  border: 2px solid var(--ssc-base02, #e5e7eb); box-shadow: 0 2px 10px 0 var(--ssc-shadow, rgba(0,0,0,.15));",
    "}",
    ".settings-page-slider-label { flex-grow: 1; font-size: 1.4rem; }",
    ".settings-page-slider { flex: none; width: 9rem; accent-color: var(--ssc-accent, #2b6cb0); pointer-events: auto; }",
    ".settings-page-live-value { flex: none; min-width: 3.5rem; text-align: right; font-size: 1.4rem; font-weight: 300; }",

    /* buttons — settings.css .settings-page-reset-button */
    ".settings-page-reset-button {",
    "  font: inherit; font-size: 1.4rem; font-weight: 500; padding: 1rem 1.5rem; margin: 0 0 1rem;",
    "  border-radius: 1000rem; border: 2px solid var(--ssc-base02, #e5e7eb);",
    "  background-color: var(--ssc-base01, #f0f2f5); color: var(--ssc-text, #1a1a2e);",
    "  cursor: pointer; pointer-events: auto;",
    "}",
    ".settings-page-reset-button:hover:not(:disabled) { background-color: var(--ssc-base02, #e5e7eb); border-color: var(--ssc-base03, #d1d5db); }",
    ".settings-page-reset-button:disabled { opacity: .5; cursor: not-allowed; }",
    ".ssc-sw-small-btn { font-size: 1.1rem; padding: 0.5rem 1rem; margin: 0; }",
    ".ssc-sw-row-buttons { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0 0 1rem; }",
    ".ssc-sw-status { font-size: 1rem; opacity: .75; margin: -0.5rem 0 1rem; }",
    ".ssc-sw-confirm {",
    "  max-width: 30rem; box-sizing: border-box; padding: 1rem; margin: 0 0 1rem; border-radius: 1rem;",
    "  border: 2px solid var(--ssc-accent, #2b6cb0); background: var(--ssc-base01, #f0f2f5); font-size: 1.2rem;",
    "}",

    /* theme selector — themes.ts ThemeSelector (folders → tiles) */
    ".theme-top-container { display: flex; align-items: center; gap: 0.75rem; margin: 0.5rem 0 0.75rem; }",
    ".theme-top-container button {",
    "  font: inherit; font-size: 1.4rem; line-height: 1; width: 2.75rem; height: 2.75rem;",
    "  border-radius: 1rem; border: 2px solid var(--ssc-base02, #e5e7eb);",
    "  background: var(--ssc-base01, #f0f2f5); color: var(--ssc-text, #1a1a2e); cursor: pointer; pointer-events: auto;",
    "}",
    ".current-category { margin: 0; font-size: 1.6rem; font-weight: 600; }",
    ".theme-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr)); gap: 1rem; width: 100%; padding-right: 1rem; box-sizing: border-box; }",
    ".theme-tile {",
    "  display: flex; flex-direction: column; overflow: hidden; padding: 0; text-align: left;",
    "  border-radius: 1.25rem; border: 3px solid var(--ssc-base02, #e5e7eb);",
    "  background: var(--ssc-base01, #f0f2f5); color: var(--ssc-text, #1a1a2e);",
    "  font: inherit; cursor: pointer; pointer-events: auto;",
    "}",
    ".theme-tile:hover { border-color: var(--ssc-base03, #d1d5db); }",
    ".theme-tile.is-selected { border-color: var(--ssc-accent, #2b6cb0); }",
    ".theme-tile .image-container {",
    "  aspect-ratio: 16 / 10; width: 100%; background-size: cover; background-position: center;",
    "  display: flex; align-items: center; justify-content: center; font-size: 2.5rem;",
    "}",
    ".theme-tile-bottom { padding: 0.5rem 0.75rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }",
    ".theme-tile-title { font-size: 1.2rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".theme-tile-count { font-size: 1rem; opacity: .7; flex: none; }",
    /* "+ Eigen thema": the last tile of the grid, and the builder it opens */
    "#settings-window { position: relative; }",
    ".theme-tile--add { border-style: dashed; background: transparent; }",
    ".theme-tile--add .image-container { background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 5%, transparent); }",
    ".theme-tile--add:hover, .theme-tile--add:focus-visible { border-color: var(--ssc-accent, #2b6cb0); outline: none; }",
    ".theme-tile--add .ssc-tile-glyph { width: 34%; height: 34%; transition: transform .2s ease; }",
    ".theme-tile--add:hover .ssc-tile-glyph { transform: scale(1.12) rotate(90deg); }",
    /* custom theme tiles: Bewerken / Verwijderen on top, a confirm on the tile */
    ".theme-tile-wrap { position: relative; display: flex; min-width: 0; }",
    ".theme-tile-wrap > .theme-tile { flex: 1; min-width: 0; }",
    ".theme-tile-actions { position: absolute; top: .6rem; right: .6rem; display: flex; gap: .4rem; opacity: 0; transition: opacity .15s ease; }",
    ".theme-tile-wrap:hover .theme-tile-actions, .theme-tile-wrap:focus-within .theme-tile-actions { opacity: 1; }",
    "@media (hover: none) { .theme-tile-actions { opacity: 1; } }",
    ".theme-tile-action { width: 2.8rem; height: 2.8rem; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%;",
    "  background: rgba(0,0,0,.6); color: #fff; cursor: pointer; pointer-events: auto; backdrop-filter: blur(6px);",
    "  box-shadow: 0 2px 8px rgba(0,0,0,.3); transition: background-color .15s ease, transform .15s ease; }",
    ".theme-tile-action svg { width: 1.4rem; height: 1.4rem; }",
    ".theme-tile-action:hover, .theme-tile-action:focus-visible { background: var(--ssc-accent, #2b6cb0); transform: scale(1.08); outline: none; }",
    ".theme-tile-action--danger:hover, .theme-tile-action--danger:focus-visible { background: #d93838; }",
    ".theme-tile-confirm { position: absolute; inset: 0; z-index: 1; display: none; flex-direction: column; align-items: center; justify-content: center;",
    "  gap: .8rem; padding: 1rem; box-sizing: border-box; border-radius: 1.25rem; text-align: center; font-size: 1.25rem; font-weight: 700;",
    "  background: color-mix(in srgb, var(--ssc-base00, #fff) 92%, transparent); color: var(--ssc-text, #1a1a2e);",
    "  border: 3px solid #d93838; backdrop-filter: blur(4px); }",
    ".theme-tile-wrap[data-confirm='1'] .theme-tile-confirm { display: flex; }",
    ".theme-tile-wrap[data-confirm='1'] .theme-tile-actions { display: none; }",
    ".theme-tile-confirm div { display: flex; gap: .5rem; flex-wrap: wrap; justify-content: center; }",
    ".theme-tile-confirm button { font: inherit; font-size: 1.15rem; font-weight: 700; padding: .5rem 1rem; border-radius: 99rem; cursor: pointer; pointer-events: auto;",
    "  border: 1.5px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 20%, transparent); background: var(--ssc-base01, #f0f2f5); color: inherit; }",
    ".theme-tile-confirm .theme-tile-confirm-yes { background: #d93838; border-color: #d93838; color: #fff; }",
    ".theme-tile-confirm button:focus-visible { outline: 2px solid var(--ssc-accent, #2b6cb0); outline-offset: 2px; }",

    /* the builder dialog */
    ".ssc-ct-modal { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; padding: 1.6rem;",
    "  box-sizing: border-box; background: rgba(0,0,0,.5); backdrop-filter: blur(3px); animation: ssc-ct-in .16s ease; }",
    "@keyframes ssc-ct-in { from { opacity: 0; } }",
    ".ssc-ct-dialog { box-sizing: border-box; width: min(68rem, 100%); max-height: 100%; overflow: auto; padding: 2.2rem 2.4rem;",
    "  display: grid; gap: 1.8rem; border-radius: 2rem; border: 1px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 12%, transparent);",
    "  background: var(--ssc-base00, #fff); color: var(--ssc-text, #1a1a2e);",
    "  box-shadow: 0 30px 80px -20px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06);",
    "  animation: ssc-ct-pop .22s cubic-bezier(.2,1.2,.4,1); }",
    "@keyframes ssc-ct-pop { from { transform: translateY(10px) scale(.97); } }",
    ".ssc-ct-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }",
    ".ssc-ct-head h2 { margin: 0; font-size: 2rem; font-weight: 750; }",
    ".ssc-ct-close { flex: none; width: 3.4rem; height: 3.4rem; display: grid; place-items: center; padding: 0;",
    "  border-radius: 50%; border: 1.5px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 16%, transparent); background: var(--ssc-base01, #f0f2f5);",
    "  color: var(--ssc-text, #1a1a2e); cursor: pointer; pointer-events: auto; transition: border-color .15s ease, transform .15s ease; }",
    ".ssc-ct-close:hover, .ssc-ct-close:focus-visible { border-color: var(--ssc-accent, #2b6cb0); transform: rotate(90deg); outline: none; }",
    ".ssc-ct-close svg { width: 1.6rem; height: 1.6rem; }",
    ".ssc-ct-body { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 2.2rem; align-items: start; }",
    "@media (max-width: 760px) { .ssc-ct-body { grid-template-columns: minmax(0, 1fr); } }",
    ".ssc-ct-editor { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }",
    ".ssc-ct-label { display: block; font-size: 1.1rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;",
    "  color: color-mix(in srgb, var(--ssc-text, #1a1a2e) 65%, transparent); }",
    ".ssc-ct-editor > .ssc-ct-label:not(:first-child), .ssc-ct-row-head { margin-top: .6rem; }",
    ".ssc-ct-row-head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }",
    ".ssc-ct-input { box-sizing: border-box; width: 100%; height: 4rem; padding: 0 1.3rem; border-radius: 1.2rem;",
    "  border: 1.5px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 16%, transparent); background: var(--ssc-base01, #f0f2f5);",
    "  color: var(--ssc-text, #1a1a2e); font: inherit; font-size: 1.45rem; font-weight: 600; pointer-events: auto;",
    "  transition: border-color .15s ease, box-shadow .15s ease; }",
    ".ssc-ct-input::placeholder { color: color-mix(in srgb, var(--ssc-text, #1a1a2e) 45%, transparent); font-weight: 500; }",
    ".ssc-ct-input:focus, .ssc-ct-hex:focus { outline: none; border-color: var(--ssc-accent, #2b6cb0);",
    "  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ssc-accent, #2b6cb0) 25%, transparent); }",
    ".ssc-ct-link { display: inline-flex; align-items: center; gap: .5rem; padding: .4rem .9rem; border-radius: 99rem; border: 0;",
    "  background: color-mix(in srgb, var(--ssc-accent, #2b6cb0) 14%, transparent); color: var(--ssc-text, #1a1a2e);",
    "  font: inherit; font-size: 1.2rem; font-weight: 700; cursor: pointer; pointer-events: auto; }",
    ".ssc-ct-link:hover, .ssc-ct-link:focus-visible { background: color-mix(in srgb, var(--ssc-accent, #2b6cb0) 26%, transparent); outline: none; }",
    ".ssc-ct-link svg { width: 1.4rem; height: 1.4rem; }",
    ".ssc-ct-presets { display: flex; flex-wrap: wrap; gap: .6rem; }",
    ".ssc-ct-preset { display: inline-flex; align-items: center; gap: 0; padding: .5rem 1rem .5rem .6rem; border-radius: 99rem;",
    "  border: 1.5px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 14%, transparent); background: var(--ssc-base01, #f0f2f5);",
    "  color: var(--ssc-text, #1a1a2e); font: inherit; font-size: 1.2rem; font-weight: 650; cursor: pointer; pointer-events: auto;",
    "  transition: border-color .15s ease, transform .15s ease; }",
    ".ssc-ct-preset:hover, .ssc-ct-preset:focus-visible { border-color: var(--ssc-accent, #2b6cb0); transform: translateY(-1px); outline: none; }",
    ".ssc-ct-preset i { width: 1.6rem; height: 1.6rem; border-radius: 50%; box-shadow: 0 0 0 2px var(--ssc-base01, #f0f2f5), inset 0 0 0 1px rgba(0,0,0,.15); }",
    ".ssc-ct-preset i + i { margin-left: -.5rem; }",
    ".ssc-ct-preset span { margin-left: .7rem; }",
    ".ssc-ct-colors { display: grid; gap: .6rem; }",
    ".ssc-ct-color { display: grid; grid-template-columns: 4.4rem minmax(0, 1fr) 10rem; align-items: center; gap: 1.2rem;",
    "  padding: .7rem .8rem .7rem .7rem; border-radius: 1.4rem; background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 4%, transparent);",
    "  border: 1px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 8%, transparent); }",
    ".ssc-ct-swatch { position: relative; width: 4.4rem; height: 4.4rem; border-radius: 1.1rem; overflow: hidden; cursor: pointer; pointer-events: auto;",
    "  box-shadow: inset 0 0 0 1px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.25), 0 3px 8px rgba(0,0,0,.25); transition: transform .15s ease; }",
    ".ssc-ct-swatch:hover { transform: scale(1.06); }",
    ".ssc-ct-swatch:focus-within { outline: 3px solid var(--ssc-accent, #2b6cb0); outline-offset: 2px; }",
    // The native picker covers the swatch, invisible: a click on the colour opens it.
    ".ssc-ct-swatch input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; opacity: 0; cursor: pointer; }",
    ".ssc-ct-color-text { min-width: 0; display: flex; flex-direction: column; gap: .1rem; }",
    ".ssc-ct-color-text b { font-size: 1.35rem; font-weight: 700; }",
    ".ssc-ct-color-text small { font-size: 1.1rem; color: color-mix(in srgb, var(--ssc-text, #1a1a2e) 62%, transparent);",
    "  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".ssc-ct-hex { box-sizing: border-box; width: 100%; height: 3.4rem; padding: 0 1rem; border-radius: 1rem; text-align: center;",
    "  border: 1.5px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 16%, transparent); background: var(--ssc-base00, #fff);",
    "  color: var(--ssc-text, #1a1a2e); font: 650 1.3rem/1 ui-monospace, Consolas, monospace; letter-spacing: .04em; text-transform: uppercase;",
    "  pointer-events: auto; transition: border-color .15s ease, box-shadow .15s ease; }",
    ".ssc-ct-hex[aria-invalid='true'] { border-color: #d93838; }",
    ".ssc-ct-side { display: flex; flex-direction: column; gap: 1rem; position: sticky; top: 0; min-width: 0; }",
    // The preview: a tiny page in the chosen colours, redrawn on every change.
    ".ssc-ct-preview { aspect-ratio: 4 / 3; border-radius: 1.4rem; overflow: hidden; display: grid; grid-template-rows: 17% 1fr;",
    "  border: 1px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 14%, transparent); box-shadow: 0 14px 34px -14px rgba(0,0,0,.5); }",
    ".ssc-ct-preview-bar { display: flex; align-items: center; gap: .6rem; padding: 0 1rem; }",
    ".ssc-ct-preview-bar i { width: 1.4rem; height: 1.4rem; border-radius: 50%; background: rgba(255,255,255,.85); }",
    ".ssc-ct-preview-page { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 1.2rem; }",
    ".ssc-ct-preview-card { border-radius: .9rem; border: 2px solid; padding: .9rem; display: grid; gap: .5rem; align-content: start; }",
    ".ssc-ct-preview-card b { font-size: 1.2rem; }",
    ".ssc-ct-preview-card span { height: .6rem; border-radius: 99rem; opacity: .55; }",
    ".ssc-ct-preview-card em { justify-self: start; margin-top: .3rem; padding: .2rem .8rem; border-radius: 99rem; font-style: normal; font-size: 1rem; font-weight: 700; }",
    // The readability check: text against page and cards, WCAG ratio.
    ".ssc-ct-contrast { display: flex; align-items: center; gap: 1rem; padding: .9rem 1.1rem; border-radius: 1.2rem; font-size: 1.2rem; font-weight: 600; line-height: 1.35;",
    "  border: 1.5px solid transparent; }",
    ".ssc-ct-contrast b { flex: none; font: 800 1.3rem/1 ui-monospace, Consolas, monospace; padding: .5rem .7rem; border-radius: .8rem; }",
    ".ssc-ct-contrast[data-level='great'], .ssc-ct-contrast[data-level='good'] { background: rgba(47,158,106,.12); border-color: rgba(47,158,106,.4); }",
    ".ssc-ct-contrast[data-level='great'] b, .ssc-ct-contrast[data-level='good'] b { background: #2f9e6a; color: #fff; }",
    ".ssc-ct-contrast[data-level='weak'] { background: rgba(224,150,32,.14); border-color: rgba(224,150,32,.45); }",
    ".ssc-ct-contrast[data-level='weak'] b { background: #b86e00; color: #fff; }",
    ".ssc-ct-contrast[data-level='bad'] { background: rgba(217,56,56,.12); border-color: rgba(217,56,56,.45); }",
    ".ssc-ct-contrast[data-level='bad'] b { background: #c62828; color: #fff; }",
    ".ssc-ct-foot { display: flex; align-items: center; gap: .8rem; flex-wrap: wrap; padding-top: 1.6rem;",
    "  border-top: 1px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 12%, transparent); }",
    ".ssc-ct-spacer { flex: 1; }",
    ".ssc-ct-btn { display: inline-flex; align-items: center; justify-content: center; gap: .6rem; height: 4rem; padding: 0 2rem; border-radius: 99rem;",
    "  border: 1.5px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 18%, transparent); background: var(--ssc-base01, #f0f2f5);",
    "  color: var(--ssc-text, #1a1a2e); font: inherit; font-size: 1.4rem; font-weight: 700; cursor: pointer; pointer-events: auto;",
    "  transition: border-color .15s ease, transform .15s ease, filter .15s ease, box-shadow .15s ease; }",
    ".ssc-ct-btn svg { width: 1.6rem; height: 1.6rem; }",
    ".ssc-ct-btn:hover { border-color: color-mix(in srgb, var(--ssc-text, #1a1a2e) 36%, transparent); transform: translateY(-1px); }",
    ".ssc-ct-btn:focus-visible { outline: 2px solid var(--ssc-accent, #2b6cb0); outline-offset: 3px; }",
    ".ssc-ct-btn:disabled { opacity: .55; cursor: default; transform: none; }",
    // The ink is measured against the window's accent (windowAccentInk).
    ".ssc-ct-btn--primary { border-color: transparent; background: var(--ssc-accent, #2b6cb0); color: var(--ssc-ct-ink, #fff);",
    "  box-shadow: 0 10px 24px -10px var(--ssc-accent, #2b6cb0); }",
    ".ssc-ct-btn--primary:hover { border-color: transparent; filter: brightness(1.07); box-shadow: 0 14px 30px -10px var(--ssc-accent, #2b6cb0); }",
    ".ssc-ct-btn--danger { background: transparent; color: #d93838; border-color: color-mix(in srgb, #d93838 45%, transparent); }",
    ".ssc-ct-btn--danger:hover { background: rgba(217,56,56,.1); border-color: #d93838; }",
    ".ssc-ct-btn--danger[data-sure='1'] { background: #d93838; color: #fff; border-color: #d93838; }",
    "@media (prefers-reduced-motion: reduce) { .ssc-ct-modal, .ssc-ct-dialog { animation: none; } }",
    /* wallpaper picker: one compact row inside the custom theme dialog */
    ".ssc-wp-card { box-sizing: border-box; width: 100%; padding-top: 1.4rem;",
    "  display: grid; grid-template-columns: 12rem minmax(0, 1fr); gap: 1.2rem; align-items: start;",
    "  border-top: 1px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 12%, transparent); }",
    ".ssc-wp-drop { position: relative; width: 100%; box-sizing: border-box; aspect-ratio: 16 / 9; border-radius: 1rem; overflow: hidden; cursor: pointer; pointer-events: auto;",
    "  border: 2px dashed color-mix(in srgb, var(--ssc-text, #1a1a2e) 28%, transparent);",
    "  background: repeating-linear-gradient(45deg, color-mix(in srgb, var(--ssc-text, #1a1a2e) 4%, transparent) 0 10px, transparent 10px 20px), var(--ssc-base00, #fff);",
    "  display: grid; place-items: center; transition: border-color .15s ease, transform .15s ease; }",
    ".ssc-wp-drop:hover, .ssc-wp-drop:focus-visible { border-color: var(--ssc-accent, #2b6cb0); outline: none; }",
    ".ssc-wp-drop[data-over='1'] { border-color: var(--ssc-accent, #2b6cb0); transform: scale(1.01);",
    "  box-shadow: 0 0 0 4px color-mix(in srgb, var(--ssc-accent, #2b6cb0) 30%, transparent); }",
    ".ssc-wp-drop[data-has='1'] { border-style: solid; border-color: transparent; }",
    ".ssc-wp-media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }",
    ".ssc-wp-empty { display: grid; place-items: center; color: var(--ssc-accent, #2b6cb0); }",
    ".ssc-wp-empty svg { width: 2.4rem; height: 2.4rem; }",
    ".ssc-wp-badge { position: absolute; left: .4rem; bottom: .4rem; display: inline-flex; align-items: center; gap: .3rem;",
    "  padding: .15rem .5rem; border-radius: 99rem; font-size: .85rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;",
    "  color: #fff; background: rgba(0,0,0,.62); backdrop-filter: blur(6px); text-shadow: 0 1px 3px rgba(0,0,0,.8); }",
    ".ssc-wp-badge svg { width: 1rem; height: 1rem; }",
    ".ssc-wp-side { display: flex; flex-direction: column; gap: .7rem; min-width: 0; }",
    ".ssc-wp-title { margin: 0; font-size: 1.4rem; font-weight: 700; color: var(--ssc-text, #1a1a2e); }",
    ".ssc-wp-actions { display: flex; flex-wrap: wrap; gap: .6rem; }",
    ".ssc-wp-btn { display: inline-flex; align-items: center; gap: .5rem; padding: .55rem 1.1rem; border-radius: .9rem; font: inherit; font-size: 1.2rem; font-weight: 700;",
    "  cursor: pointer; pointer-events: auto; border: 1px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 16%, transparent);",
    "  background: var(--ssc-base02, #e5e7eb); color: var(--ssc-text, #1a1a2e); transition: filter .15s ease, transform .1s ease; }",
    ".ssc-wp-btn:hover { filter: brightness(1.08); }",
    ".ssc-wp-btn:active { transform: translateY(1px); }",
    ".ssc-wp-btn:focus-visible { outline: 2px solid var(--ssc-accent, #2b6cb0); outline-offset: 2px; }",
    ".ssc-wp-btn:disabled { opacity: .5; cursor: default; }",
    ".ssc-wp-btn svg { width: 1.4rem; height: 1.4rem; }",
    ".ssc-wp-btn--primary { border-color: transparent; color: #fff;",
    "  background: linear-gradient(180deg, color-mix(in srgb, var(--ssc-accent, #2b6cb0) 85%, #fff), var(--ssc-accent, #2b6cb0));",
    "  box-shadow: 0 6px 16px -6px var(--ssc-accent, #2b6cb0), inset 0 1px 0 rgba(255,255,255,.25); text-shadow: 0 1px 2px rgba(0,0,0,.35); }",
    ".ssc-wp-url { display: flex; gap: .6rem; align-items: center; }",
    ".ssc-wp-url .ssc-text-input { flex: 1; min-width: 0; margin: 0; }",
    ".ssc-wp-url svg { width: 1.5rem; height: 1.5rem; flex: none; opacity: .7; }",
    ".ssc-wp-hint { margin: 0; font-size: 1rem; color: color-mix(in srgb, var(--ssc-text, #1a1a2e) 66%, transparent); }",
    ".ssc-wp-status { margin: 0; min-height: 1.4rem; font-size: 1.1rem; font-weight: 600; color: var(--ssc-accent, #2b6cb0); }",
    "@media (max-width: 520px) { .ssc-wp-card { grid-template-columns: 1fr; } .ssc-wp-drop { max-width: 16rem; } }",
    ".ssc-wp-status[data-error='1'] { color: #d93838; }",
    ".ssc-tile-glyph { width: 40%; height: 40%; color: var(--ssc-accent, #2b6cb0); }",

    /* widget rows */
    ".ssc-sw-list { display: flex; flex-direction: column; width: 100%; max-width: 30rem; }",
    ".ssc-sw-row { cursor: default; }",
    ".ssc-sw-row[data-drag='1'] { outline: 2px dashed var(--ssc-accent, #2b6cb0); }",
    ".ssc-sw-grip { cursor: grab; opacity: .6; letter-spacing: -2px; user-select: none; pointer-events: auto; }",
    ".ssc-sw-name { flex: 1; display: flex; align-items: center; gap: 0.75rem; }",

    /* punten list */
    ".ssc-pt-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; width: 100%; max-width: 46rem; margin: 0 0 0.75rem; }",
    ".ssc-pt-count { font-size: 1.2rem; font-weight: 600; }",
    ".ssc-pt-chips { display: flex; gap: 0.5rem; margin: 0 0 0.75rem; }",
    ".ssc-pt-chip {",
    "  font: inherit; font-size: 1.1rem; padding: 0.35rem 0.9rem; border-radius: 999px; cursor: pointer; pointer-events: auto;",
    "  border: 2px solid var(--ssc-base02, #e5e7eb); background: var(--ssc-base01, #f0f2f5); color: var(--ssc-text, #1a1a2e);",
    "}",
    ".ssc-pt-chip[aria-pressed='true'] { border-color: var(--ssc-accent, #2b6cb0); color: var(--ssc-accent, #2b6cb0); font-weight: 600; }",
    ".ssc-pt-list { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; max-width: 46rem; padding-right: 1rem; box-sizing: border-box; }",
    ".ssc-pt-row {",
    "  display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 0.75rem;",
    "  padding: 0.6rem 0.9rem; border-radius: 1rem; border: 2px solid var(--ssc-base02, #e5e7eb);",
    "  border-left-width: 2px; background: var(--ssc-base01, #f0f2f5); cursor: pointer; pointer-events: auto;",
    "}",
    ".ssc-pt-row.is-unseen { border-left: 6px solid var(--ssc-accent, #2b6cb0); }",
    ".ssc-pt-row input { width: 1.4rem; height: 1.4rem; margin: 0; accent-color: var(--ssc-accent, #2b6cb0); cursor: pointer; }",
    ".ssc-pt-main { min-width: 0; display: flex; flex-direction: column; }",
    ".ssc-pt-vak { font-weight: 700; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem; }",
    ".ssc-pt-titel { font-size: 1.1rem; opacity: .65; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".ssc-pt-new { font-size: 0.9rem; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 999px; background: var(--ssc-accent, #2b6cb0); color: var(--ssc-base00, #ffffff); }",
    ".ssc-pt-meta { font-size: 1rem; opacity: .7; text-align: right; white-space: nowrap; }",
    ".ssc-pt-score { display: flex; align-items: center; gap: 0.5rem; justify-content: flex-end; white-space: nowrap; font-size: 1.2rem; font-weight: 700; }",
    ".ssc-pt-badge { font-size: 0.9rem; font-weight: 700; padding: 0.1rem 0.5rem; border-radius: 0.5rem; color: #111; }",
    ".ssc-pt-empty { font-size: 1.2rem; opacity: .7; padding: 1rem 0; }",
    "/* ---------- liquid glass ---------- */",
    ".settings-sidebar { margin: 0.75rem 0 0.75rem 0.75rem; padding: 1rem; border-radius: 1.6rem; width: 20.5rem;",
    "  background: linear-gradient(170deg, color-mix(in srgb, var(--ssc-base00, #fff) 46%, transparent), color-mix(in srgb, var(--ssc-base00, #fff) 18%, transparent));",
    "  border: 1px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 10%, transparent);",
    "  box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 18px 40px -24px var(--ssc-shadow, rgba(0,0,0,.5)); }",
    ".settings-category-button, .profile-settings-button, .ssc-input-with-label, .ssc-text-input, .settings-page-slider-container, .settings-page-reset-button {",
    "  background: linear-gradient(155deg, color-mix(in srgb, var(--ssc-base01, #f0f2f5) 70%, transparent), color-mix(in srgb, var(--ssc-base01, #f0f2f5) 38%, transparent)); border-color: color-mix(in srgb, var(--ssc-text, #1a1a2e) 12%, transparent); box-shadow: inset 0 1px 0 rgba(255,255,255,.4), inset 0 -1px 0 rgba(0,0,0,.08), 0 10px 24px -14px var(--ssc-shadow, rgba(0,0,0,.4)); }",
    ".settings-category-button, .profile-settings-button, .settings-page-reset-button, .ssc-input-with-label { transition: translate .4s cubic-bezier(.34,1.56,.64,1), scale .4s cubic-bezier(.34,1.56,.64,1), box-shadow .25s ease, border-color .2s ease; }",
    ".settings-category-button-js:hover, .settings-page-reset-button:hover:not(:disabled), .ssc-input-with-label:hover { background: linear-gradient(155deg, color-mix(in srgb, var(--ssc-base02, #e5e7eb) 85%, transparent), color-mix(in srgb, var(--ssc-base01, #f0f2f5) 55%, transparent)); translate: 0 -1px; }",
    ".settings-category-button-js:active, .settings-page-reset-button:active:not(:disabled) { scale: .97; }",
    ".settings-radio:checked + label { background: linear-gradient(155deg, color-mix(in srgb, var(--ssc-base02, #e5e7eb) 85%, transparent), color-mix(in srgb, var(--ssc-base01, #f0f2f5) 55%, transparent)); border-color: color-mix(in srgb, var(--ssc-accent, #2b6cb0) 55%, transparent);",
    "  box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 0 0 3px color-mix(in srgb, var(--ssc-accent, #2b6cb0) 16%, transparent), 0 12px 26px -14px color-mix(in srgb, var(--ssc-accent, #2b6cb0) 70%, transparent); }",
    ".slider { box-shadow: inset 0 1px 3px rgba(0,0,0,.25); } .slider:before { box-shadow: 0 2px 6px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.5); }",
    "/* iOS Settings pass: grouped glass lists with hairline dividers, pill switches with a spring knob */",
    "#settings-window { font-family: system-ui, -apple-system, 'Segoe UI Variable Text', 'Segoe UI', Roboto, sans-serif; letter-spacing: -0.011em; }",
    ".settings-page-main-title, .settings-page-section-title { letter-spacing: -0.03em; }",
    ".settings-page-section-title { margin-bottom: 0.5rem; }",
    ".ssc-input-with-label { border-radius: 0; margin: 0; border: 0; border-bottom: 1px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 12%, transparent);",
    "  box-shadow: none; min-width: 24rem; width: min(32rem, 100%); max-width: 32rem; padding: 0.9rem 1.3rem;",
    "  backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); }",
    ".ssc-input-with-label:hover { translate: none; scale: none; }",
    ".ssc-input-with-label:active { scale: none; background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 8%, transparent); }",
    ".ssc-input-with-label:not(.ssc-input-with-label + .ssc-input-with-label) { border-radius: 1.5rem 1.5rem 0 0; }",
    ".ssc-input-with-label:not(:has(+ .ssc-input-with-label)) { border-radius: 0 0 1.5rem 1.5rem; border-bottom-color: transparent; margin-bottom: 1rem; }",
    ".ssc-input-with-label:not(.ssc-input-with-label + .ssc-input-with-label):not(:has(+ .ssc-input-with-label)) { border-radius: 1.5rem; }",
    ".switch { width: 5.1rem; height: 3.1rem; }",
    ".slider { background-color: color-mix(in srgb, var(--ssc-text, #1a1a2e) 24%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ssc-text, #1a1a2e) 8%, transparent);",
    "  transition: background-color .35s cubic-bezier(0.175, 0.885, 0.32, 1.275); }",
    ".slider:before { width: 2.7rem; height: 2.7rem; left: 0.2rem; top: 0.2rem; background-color: #fff; box-shadow: 0 3px 8px rgba(0,0,0,.3), 0 1px 1px rgba(0,0,0,.2);",
    "  transition: transform .4s cubic-bezier(0.175, 0.885, 0.32, 1.275), width .25s cubic-bezier(0.175, 0.885, 0.32, 1.275); }",
    "input:checked + .slider { background-color: var(--ssc-switch-on, #34c759); }",
    "input:checked + .slider:before { background-color: #fff; transform: translateX(2rem); }",
    ".switch:active .slider:before { width: 3.2rem; } .switch:active input:checked + .slider:before { transform: translateX(1.5rem); }",
    "input:focus-visible + .slider { outline: 2px solid var(--ssc-accent, #2b6cb0); outline-offset: 2px; }",
    "@media (prefers-reduced-motion: reduce) { .slider, .slider:before { transition-duration: .01ms !important; } }",
  ].join("\n");

  /* ---------- tiny helpers ---------- */

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function save(patch) {
    if (typeof window.sscSet === "function") return window.sscSet(patch);
    return Promise.resolve();
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () {
        fn.apply(null, args);
      }, ms);
    };
  }

  /* ---------- smpp control builders (main-settings.ts / ui.ts) ---------- */

  function createMainTitle(text) {
    return el("h1", "settings-page-main-title", text);
  }

  function createSectionTitle(text) {
    return el("h2", "settings-page-section-title", text);
  }

  function createDescription(text) {
    return el("p", "settings-page-description", text);
  }

  /** ui.ts createButton: label.switch > input.popupinput + span.slider.round */
  function createButton(id) {
    var outerSwitch = el("label", "switch");
    var innerButton = el("input", "popupinput");
    innerButton.tabIndex = -1;
    innerButton.type = "checkbox";
    innerButton.id = id;
    var innerSwitch = el("span", "slider round");
    outerSwitch.appendChild(innerButton);
    outerSwitch.appendChild(innerSwitch);
    return outerSwitch;
  }

  /**
   * ui.ts createButtonWithLabel + main-settings.ts
   * createSettingsButtonWithLabel. Saves through onChange instead of smpp's
   * page-wide storePage().
   */
  function createSettingsButtonWithLabel(id, text, checked, onChange) {
    var container = el("label", "ssc-input-with-label settings-page-button-label-container");
    container.htmlFor = id;
    container.tabIndex = 0;
    var label = el("span", null, text);
    var button = createButton(id);
    var input = button.querySelector("input");
    input.checked = !!checked;
    input.addEventListener("change", function () {
      onChange(input.checked);
    });
    container.addEventListener("keydown", function (e) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        input.click();
        container.focus();
      }
    });
    container.appendChild(label);
    container.appendChild(button);
    return container;
  }

  function createTextInput(id, placeholder) {
    var textInput = el("input", "ssc-text-input");
    textInput.id = id;
    textInput.type = "text";
    textInput.placeholder = placeholder || "";
    textInput.spellcheck = false;
    return textInput;
  }

  function createLabeledSlider(min, max, step, id, text, value, format, onInput) {
    var container = el("div", "settings-page-slider-container ssc-input-with-label");
    var textContainer = el("span", "settings-page-slider-label", text);
    var slider = el("input", "settings-page-slider settings-page-labeled-slider");
    slider.id = id;
    slider.type = "range";
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(value);
    var currentValue = el("span", "settings-page-live-value", format(value));
    slider.addEventListener("input", function () {
      currentValue.textContent = format(Number(slider.value));
      onInput(Number(slider.value));
    });
    container.appendChild(textContainer);
    container.appendChild(slider);
    container.appendChild(currentValue);
    return container;
  }

  function createSelect(id, options, value, onChange) {
    var select = el("select", "ssc-text-input");
    select.id = id;
    for (var i = 0; i < options.length; i++) {
      var o = el("option", null, options[i][1]);
      o.value = options[i][0];
      select.appendChild(o);
    }
    select.value = value;
    select.addEventListener("change", function () {
      onChange(select.value);
    });
    return select;
  }

  function createTextArea(id, placeholder, value, onInput) {
    var area = el("textarea", "ssc-text-input");
    area.id = id;
    area.rows = 4;
    area.placeholder = placeholder;
    area.spellcheck = false;
    area.value = value || "";
    area.addEventListener("input", function () {
      onInput(area.value);
    });
    return area;
  }

  function createActionButton(text, onClick, extraClass) {
    var b = el("button", "settings-page-reset-button" + (extraClass ? " " + extraClass : ""), text);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  /* ---------- sidebar ---------- */

  function topbarAvatarUrl() {
    var selectors = [
      ".js-btn-profile img",
      "#profileMenu img",
      "nav.topnav img[class*='avatar']",
      "nav.topnav img[src*='avatar']",
      "nav.topnav img[src*='userpicture']",
    ];
    for (var i = 0; i < selectors.length; i++) {
      var img = null;
      try {
        img = document.querySelector(selectors[i]);
      } catch (e) {
        img = null;
      }
      if (img && img.src) return img.src;
    }
    return "";
  }

  function displayName(settings) {
    var custom = settings && typeof settings.customName === "string" ? settings.customName.trim() : "";
    if (custom) return custom;
    var orig = typeof window.sscOriginalName === "function" ? window.sscOriginalName() : "";
    return String(orig || "").trim();
  }

  function initials(name) {
    var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    var first = parts[0].charAt(0);
    var last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (first + last).toUpperCase();
  }

  function radioFor(id) {
    var radio = el("input", "settings-radio");
    radio.type = "radio";
    radio.name = "ssc-settings-page";
    radio.value = id;
    radio.id = "ssc-settings-" + id;
    return radio;
  }

  function keyboardSelect(label, radio) {
    label.addEventListener("keydown", function (e) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        radio.click();
      }
    });
  }

  var profileTitleEl = null;
  var profilePicEl = null;

  function updateProfileButton(settings) {
    if (!profileTitleEl || !profilePicEl) return;
    var name = displayName(settings);
    profileTitleEl.textContent = (name.split(" ")[0] || "Profiel");
    var avatar = topbarAvatarUrl();
    if (avatar) {
      profilePicEl.style.backgroundImage = 'url("' + avatar.replace(/"/g, "%22") + '")';
      profilePicEl.textContent = "";
    } else {
      profilePicEl.style.backgroundImage = "";
      profilePicEl.textContent = initials(name);
    }
  }

  function createProfileButton() {
    var radio = radioFor("profile");
    var label = el("label", "profile-settings-button settings-category-button-js");
    label.htmlFor = radio.id;
    label.tabIndex = 0;
    keyboardSelect(label, radio);

    profilePicEl = el("div", "profile-picture-settings");
    var text = el("div", "profile-settings-label");
    profileTitleEl = el("h2", null, "Profiel");
    profileTitleEl.id = "profile-settings-label-title";
    text.appendChild(profileTitleEl);
    text.appendChild(el("p", "profile-settings-label-description", "profiel bekijken"));
    label.appendChild(profilePicEl);
    label.appendChild(text);

    var wrap = el("div");
    wrap.appendChild(radio);
    wrap.appendChild(label);
    return wrap;
  }

  function categoryIcon(cat) {
    var tile = el("span", "category-button-icon");
    tile.style.setProperty("--ssc-tile-hue", String(cat.hue || 210));
    tile.appendChild(iconSvg(cat.icon));
    return tile;
  }

  function createCategory(cat) {
    var radio = radioFor(cat.id);
    var label = el("label", "settings-category-button settings-category-button-js");
    label.htmlFor = radio.id;
    label.tabIndex = 0;
    keyboardSelect(label, radio);

    label.appendChild(categoryIcon(cat));
    label.appendChild(el("span", null, cat.name));

    var wrap = el("div");
    wrap.appendChild(radio);
    wrap.appendChild(label);
    return wrap;
  }

  function buildSidebar() {
    var side = el("div", "settings-sidebar");
    side.appendChild(createProfileButton());
    for (var i = 0; i < CATEGORIES.length; i++) side.appendChild(createCategory(CATEGORIES[i]));
    side.addEventListener("change", function (e) {
      var t = e.target;
      if (t && t.type === "radio" && PAGES[t.value]) show(t.value);
    });
    return side;
  }

  function syncSidebar() {
    if (!sidebarEl) return;
    var radio = sidebarEl.querySelector("#ssc-settings-" + currentPage);
    if (radio) radio.checked = true;
  }

  /* ---------- page: Profiel ---------- */

  function pageProfile(s) {
    pageEl.appendChild(createMainTitle("Profiel"));
    pageEl.appendChild(createSectionTitle("Eigen naam"));
    pageEl.appendChild(createDescription("Pas je naam aan, zichtbaar linksboven in de bovenbalk. Leeg = je naam van Smartschool."));
    var input = createTextInput("ssc-settings-username-input", displayNameFallback());
    input.value = s.customName || "";
    var store = debounce(function (v) {
      save({ customName: v.trim() }).then(function (next) {
        updateProfileButton(next || s);
      });
    }, 300);
    input.addEventListener("input", function () {
      store(input.value);
    });
    pageEl.appendChild(input);
  }

  function displayNameFallback() {
    var orig = typeof window.sscOriginalName === "function" ? window.sscOriginalName() : "";
    return String(orig || "Gebruikersnaam").trim();
  }

  /* ---------- page: Uiterlijk ---------- */

  var THEME_CATEGORY_ORDER = ["dark", "light", "mountain", "japan", "car", "space", "seasonal", "animal", "other"];
  var THEME_CATEGORY_NAMES = {
    dark: "Donker",
    light: "Licht",
    mountain: "Bergen",
    japan: "Japan",
    car: "Auto's",
    space: "Ruimte",
    seasonal: "Seizoenen",
    animal: "Dieren",
    other: "Overig",
    custom: "Eigen",
  };
  var SKIP_THEMES = { defaultCustom: true };
  var themeCategory = "all"; // smpp ThemeSelector.currentCategory

  /** smpp's "default" palette is reachable as "deluxe" here (themes.js). */
  function themeKey(key) {
    return key === "default" ? "deluxe" : key;
  }

  function themesIn(category) {
    var themes = window.SSC_THEMES || {};
    var cats = window.SSC_THEME_CATEGORIES || {};
    var out = [];
    var seen = {};
    var list = cats[category] || [];
    for (var i = 0; i < list.length; i++) {
      var id = themeKey(list[i]);
      if (seen[id] || SKIP_THEMES[id] || !themes[id]) continue;
      seen[id] = true;
      out.push(id);
    }
    return out;
  }

  /** Themes no category lists still have to be reachable: they go to "other". */
  function leftoverThemes() {
    var themes = window.SSC_THEMES || {};
    var placed = {};
    for (var c = 0; c < THEME_CATEGORY_ORDER.length; c++) {
      var ids = themesIn(THEME_CATEGORY_ORDER[c]);
      for (var i = 0; i < ids.length; i++) placed[ids[i]] = true;
    }
    return Object.keys(themes).filter(function (k) {
      return !placed[k] && !SKIP_THEMES[k] && k !== "default";
    });
  }

  function themeIdsFor(category) {
    var ids = themesIn(category);
    if (category === "other") ids = ids.concat(leftoverThemes());
    return ids;
  }

  function themePreviewStyle(node, id) {
    var url = typeof window.sscThemeBackground === "function" ? window.sscThemeBackground(id) : "";
    if (url) {
      node.style.backgroundImage = 'url("' + url + '")';
      return;
    }
    var t = (window.SSC_THEMES || {})[id];
    var css = (t && t.css) || {};
    var a = css["--ssc-base00"] || "#222";
    var b = css["--ssc-accent"] || "#888";
    node.style.backgroundImage = "linear-gradient(135deg, " + a + " 55%, " + b + ")";
  }

  function themeTile(title, onClick, selected, decorate, count) {
    var tile = el("button", "theme-tile" + (selected ? " is-selected" : ""));
    tile.type = "button";
    var img = el("div", "image-container");
    if (decorate) decorate(img);
    var bottom = el("div", "theme-tile-bottom");
    bottom.appendChild(el("span", "theme-tile-title", title));
    if (count !== undefined) bottom.appendChild(el("span", "theme-tile-count", String(count)));
    tile.appendChild(img);
    tile.appendChild(bottom);
    tile.addEventListener("click", onClick);
    return tile;
  }

  function renderThemeSelector(container, s) {
    container.textContent = "";
    var top = el("div", "theme-top-container");
    if (themeCategory !== "all") {
      var back = el("button", null, "‹");
      back.type = "button";
      back.setAttribute("aria-label", "Terug naar alle categorieën");
      back.addEventListener("click", function () {
        themeCategory = "all";
        renderThemeSelector(container, s);
      });
      top.appendChild(back);
    }
    var titleText = themeCategory === "all"
      ? "Alle thema's"
      : (THEME_CATEGORY_NAMES[themeCategory] || themeCategory) + " thema's";
    top.appendChild(el("h2", "current-category", titleText));
    container.appendChild(top);

    var grid = el("div", "theme-tiles");
    container.appendChild(grid);
    var active = s.theme || "default";

    function choose(patch) {
      save(patch).then(function (next) {
        renderThemeSelector(container, next || s);
      });
    }

    if (themeCategory === "all") {
      // "Geen thema": Smartschool's own colours.
      grid.appendChild(themeTile("Geen thema", function () {
        choose({ theme: "default" });
      }, active === "default", function (img) {
        img.style.backgroundImage = "linear-gradient(135deg, #ff520e, #ffb08a)";
      }));
      var cats = THEME_CATEGORY_ORDER.concat(["custom"]);
      for (var c = 0; c < cats.length; c++) {
        (function (cat) {
          var ids = cat === "custom" ? (s.customThemes || []) : themeIdsFor(cat);
          if (!ids.length) return;
          var holds = cat === "custom"
            ? active === "custom"
            : ids.indexOf(active) !== -1;
          grid.appendChild(themeTile(THEME_CATEGORY_NAMES[cat] || cat, function () {
            themeCategory = cat;
            renderThemeSelector(container, s);
          }, holds, function (img) {
            if (cat === "custom") {
              img.textContent = "";
              var paletteIcon = iconSvg("palette");
              paletteIcon.setAttribute("class", "ssc-tile-glyph");
              img.appendChild(paletteIcon);
              img.style.backgroundImage = "linear-gradient(135deg, var(--ssc-base02, #e5e7eb), var(--ssc-base01, #f0f2f5))";
            } else {
              // Folder cover: the first theme that has a photograph.
              var cover = ids[0];
              for (var i = 0; i < ids.length; i++) {
                if (typeof window.sscThemeBackground === "function" && window.sscThemeBackground(ids[i])) {
                  cover = ids[i];
                  break;
                }
              }
              themePreviewStyle(img, cover);
            }
          }, ids.length));
        })(cats[c]);
      }
      grid.appendChild(addThemeTile(container, s));
      return;
    }

    if (themeCategory === "custom") {
      var list = s.customThemes || [];
      for (var k = 0; k < list.length; k++) {
        grid.appendChild(customThemeTile(container, s, list[k], active === "custom" && s.customThemeId === list[k].id, choose));
      }
      grid.appendChild(addThemeTile(container, s));
      return;
    }

    var ids2 = themeIdsFor(themeCategory);
    var themes = window.SSC_THEMES || {};
    for (var j = 0; j < ids2.length; j++) {
      (function (id) {
        grid.appendChild(themeTile((themes[id] && themes[id].name) || id, function () {
          choose({ theme: id });
        }, active === id, function (img) {
          themePreviewStyle(img, id);
        }));
      })(ids2[j]);
    }
  }

  /**
   * A custom theme's tile, with Bewerken and Verwijderen on top of it. The
   * two are siblings of the tile button, not inside it (no button in a
   * button). Verwijderen asks once, on the tile itself.
   */
  function customThemeTile(container, s, entry, selected, choose) {
    var wrap = el("div", "theme-tile-wrap");
    var tile = themeTile(entry.name || "Eigen thema", function () {
      choose({ theme: "custom", customThemeId: entry.id });
    }, selected, function (img) {
      img.style.backgroundImage =
        "linear-gradient(135deg, " + (entry.bg || "#141414") + " 0 52%, " + (entry.card || "#1f1f1f") + " 52% 74%, " +
        (entry.accent || "#3ba37a") + " 74%)";
    });
    wrap.appendChild(tile);

    var actions = el("div", "theme-tile-actions");
    function action(icon, label, onClick, cls) {
      var b = el("button", "theme-tile-action" + (cls ? " " + cls : ""));
      b.type = "button";
      b.setAttribute("aria-label", label + ": " + (entry.name || "Eigen thema"));
      b.title = label;
      b.appendChild(iconSvg(icon));
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        onClick();
      });
      actions.appendChild(b);
      return b;
    }
    action("pencil", "Bewerken", function () {
      openCustomThemeDialog(tile, s, function (next) {
        renderThemeSelector(container, next);
      }, entry);
    });
    action("trash", "Verwijderen", function () {
      wrap.setAttribute("data-confirm", "1");
      yes.focus();
    }, "theme-tile-action--danger");
    wrap.appendChild(actions);

    var confirm = el("div", "theme-tile-confirm");
    confirm.setAttribute("role", "alertdialog");
    confirm.appendChild(el("span", null, "\"" + (entry.name || "Eigen thema") + "\" verwijderen?"));
    var row = el("div");
    var yes = el("button", "theme-tile-confirm-yes", "Verwijderen");
    yes.type = "button";
    yes.addEventListener("click", function (e) {
      e.stopPropagation();
      deleteCustomTheme(entry.id).then(function (next) {
        if (!(next && next.customThemes && next.customThemes.length)) themeCategory = "all";
        renderThemeSelector(container, next || s);
      });
    });
    var no = el("button", "theme-tile-confirm-no", "Annuleren");
    no.type = "button";
    no.addEventListener("click", function (e) {
      e.stopPropagation();
      wrap.removeAttribute("data-confirm");
      tile.focus();
    });
    row.appendChild(yes);
    row.appendChild(no);
    confirm.appendChild(row);
    wrap.appendChild(confirm);
    return wrap;
  }

  /** Removes one custom theme; the page falls back to no theme if it was on. */
  function deleteCustomTheme(id) {
    return window.sscGet().then(function (cur) {
      var patch = {
        customThemes: (cur.customThemes || []).filter(function (t) {
          return t.id !== id;
        }),
      };
      if (cur.theme === "custom" && cur.customThemeId === id) {
        patch.theme = "default";
        patch.customThemeId = "";
      }
      return save(patch);
    });
  }

  /** The dashed "+" tile at the end of the grid; it opens the builder. */
  function addThemeTile(container, s) {
    var tile = themeTile("Eigen thema", function () {
      openCustomThemeDialog(tile, s, function (next) {
        themeCategory = "custom";
        renderThemeSelector(container, next);
      });
    }, false, function (img) {
      var plus = iconSvg("plus");
      plus.setAttribute("class", "ssc-tile-glyph");
      img.appendChild(plus);
    });
    tile.classList.add("theme-tile--add");
    tile.setAttribute("aria-label", "Eigen thema maken");
    tile.setAttribute("aria-haspopup", "dialog");
    return tile;
  }

  /* ---------- the custom theme builder ---------- */

  var CT_FIELDS = [
    { key: "bg", label: "Achtergrond", hint: "De pagina zelf" },
    { key: "card", label: "Kaarten", hint: "Vakken, menu's en widgets" },
    { key: "text", label: "Tekst", hint: "Alle tekst" },
    { key: "accent", label: "Accent", hint: "Knoppen, links en markeringen" },
    { key: "border", label: "Rand", hint: "Lijnen rond de kaarten" },
  ];

  // Starting points: [name, bg, card, text, accent, border].
  var CT_PRESETS = [
    ["Nacht", "#0f1420", "#182032", "#e6ecf7", "#6c8cff", "#26324a"],
    ["Oceaan", "#071b2c", "#0d2a40", "#d6ecf5", "#33b3d6", "#1c3e57"],
    ["Bos", "#0f1a14", "#16261d", "#dcebdf", "#4fbf7f", "#25392c"],
    ["Zonsondergang", "#1e0f14", "#2d1820", "#ffe4d6", "#ff7a59", "#45242f"],
    ["Lavendel", "#f4f1fb", "#ffffff", "#2b2440", "#7b5cd6", "#ddd5f0"],
    ["Papier", "#f6f3ec", "#fffdf8", "#2f2a22", "#c46a2b", "#e4dccb"],
  ];

  var HEX_RX = /^#[0-9a-f]{6}$/i;

  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function luminance(hex) {
    var c = hexToRgb(hex).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contrast(a, b) {
    var la = luminance(a);
    var lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /** Black or white, whichever reads on `hex`. */
  function inkOnHex(hex) {
    return contrast(hex, "#ffffff") >= contrast(hex, "#111111") ? "#ffffff" : "#111111";
  }

  function hslToHex(hue, sat, light) {
    sat /= 100;
    light /= 100;
    var k = function (n) {
      return (n + hue / 30) % 12;
    };
    var a = sat * Math.min(light, 1 - light);
    var f = function (n) {
      var v = light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return ("0" + Math.round(v * 255).toString(16)).slice(-2);
    };
    return "#" + f(0) + f(8) + f(4);
  }

  /** A random palette that holds together: one hue, dark or light. */
  function surprisePalette() {
    var hue = Math.floor(Math.random() * 360);
    var accentHue = (hue + 20 + Math.floor(Math.random() * 40)) % 360;
    if (Math.random() < 0.7) {
      return { bg: hslToHex(hue, 28, 9), card: hslToHex(hue, 24, 14), text: hslToHex(hue, 30, 92),
        accent: hslToHex(accentHue, 78, 64), border: hslToHex(hue, 20, 24) };
    }
    return { bg: hslToHex(hue, 30, 95), card: hslToHex(hue, 40, 99), text: hslToHex(hue, 30, 16),
      accent: hslToHex(accentHue, 65, 46), border: hslToHex(hue, 22, 84) };
  }

  /** The settings window's own accent, and the ink that reads on it. */
  function windowAccentInk() {
    try {
      var accent = getComputedStyle(rootEl).getPropertyValue("--ssc-accent").trim() || "#2b6cb0";
      var canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      var g = canvas.getContext("2d");
      g.fillStyle = accent;
      g.fillRect(0, 0, 1, 1);
      var p = g.getImageData(0, 0, 1, 1).data;
      var hex = "#" + [p[0], p[1], p[2]].map(function (v) {
        return ("0" + v.toString(16)).slice(-2);
      }).join("");
      return inkOnHex(hex);
    } catch (e) {
      return "#ffffff";
    }
  }

  /**
   * The custom theme builder: a dialog over the settings window. Name,
   * starting points and five colours (a big swatch that opens the colour
   * picker, plus a hex field) on the left; a small page drawn in those
   * colours and a readability check on the right; the wallpaper picker
   * underneath; Opslaan / Annuleren (and Verwijderen when editing) at the
   * bottom. Escape, the close button or a click beside it closes it; focus
   * goes back to whatever opened it.
   *
   * @param {Object} [entry] an existing custom theme to edit
   */
  function openCustomThemeDialog(opener, s, onSaved, entry) {
    if (!rootEl) return;
    var editing = !!entry;
    var vals = {
      bg: (entry && entry.bg) || "#141414",
      card: (entry && entry.card) || "#1f1f1f",
      text: (entry && entry.text) || "#e8e8e8",
      accent: (entry && entry.accent) || "#3ba37a",
      border: (entry && entry.border) || "#383838",
    };

    var scrim = el("div", "ssc-ct-modal");
    var dialog = el("div", "ssc-ct-dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "ssc-ct-title");
    dialog.style.setProperty("--ssc-ct-ink", windowAccentInk());

    var head = el("div", "ssc-ct-head");
    var title = el("h2", null, editing ? "Thema bewerken" : "Eigen thema maken");
    title.id = "ssc-ct-title";
    head.appendChild(title);
    var closeBtn = el("button", "ssc-ct-close");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Sluiten");
    closeBtn.appendChild(iconSvg("close"));
    head.appendChild(closeBtn);
    dialog.appendChild(head);

    var body = el("div", "ssc-ct-body");
    var editor = el("div", "ssc-ct-editor");

    // Name
    var nameLabel = el("label", "ssc-ct-label", "Naam");
    var name = el("input", "ssc-ct-input");
    name.type = "text";
    name.id = "ssc-custom-name";
    name.maxLength = 40;
    name.placeholder = "Bijvoorbeeld: Middernacht";
    name.value = (entry && entry.name) || "";
    nameLabel.htmlFor = name.id;
    editor.appendChild(nameLabel);
    editor.appendChild(name);

    // Starting points
    var presetHead = el("div", "ssc-ct-row-head");
    presetHead.appendChild(el("span", "ssc-ct-label", "Snel beginnen"));
    var surprise = el("button", "ssc-ct-link");
    surprise.type = "button";
    surprise.appendChild(iconSvg("shuffle"));
    surprise.appendChild(document.createTextNode("Verras me"));
    presetHead.appendChild(surprise);
    editor.appendChild(presetHead);
    var presets = el("div", "ssc-ct-presets");
    CT_PRESETS.forEach(function (p) {
      var chip = el("button", "ssc-ct-preset");
      chip.type = "button";
      [p[1], p[4], p[3]].forEach(function (c) {
        var dot = el("i");
        dot.style.background = c;
        chip.appendChild(dot);
      });
      chip.appendChild(el("span", null, p[0]));
      chip.addEventListener("click", function () {
        setAll({ bg: p[1], card: p[2], text: p[3], accent: p[4], border: p[5] });
      });
      presets.appendChild(chip);
    });
    editor.appendChild(presets);

    // Colours
    editor.appendChild(el("span", "ssc-ct-label", "Kleuren"));
    var colors = el("div", "ssc-ct-colors");
    var rows = {};
    CT_FIELDS.forEach(function (f) {
      var row = el("div", "ssc-ct-color");
      var swatch = el("label", "ssc-ct-swatch");
      var picker = el("input");
      picker.type = "color";
      picker.id = "ssc-custom-" + f.key;
      picker.setAttribute("aria-label", f.label + ": kleur kiezen");
      swatch.appendChild(picker);
      var text = el("div", "ssc-ct-color-text");
      text.appendChild(el("b", null, f.label));
      text.appendChild(el("small", null, f.hint));
      var hex = el("input", "ssc-ct-hex");
      hex.type = "text";
      hex.maxLength = 7;
      hex.spellcheck = false;
      hex.setAttribute("aria-label", f.label + ": hex-code");
      picker.addEventListener("input", function () {
        set(f.key, picker.value);
      });
      hex.addEventListener("input", function () {
        var v = hex.value.trim();
        if (v && v.charAt(0) !== "#") v = "#" + v;
        var ok = HEX_RX.test(v);
        hex.setAttribute("aria-invalid", ok ? "false" : "true");
        if (ok) set(f.key, v.toLowerCase(), hex);
      });
      hex.addEventListener("blur", function () {
        hex.value = vals[f.key].toUpperCase();
        hex.setAttribute("aria-invalid", "false");
      });
      row.appendChild(swatch);
      row.appendChild(text);
      row.appendChild(hex);
      colors.appendChild(row);
      rows[f.key] = { swatch: swatch, picker: picker, hex: hex };
    });
    editor.appendChild(colors);

    // Preview + readability
    var side = el("div", "ssc-ct-side");
    side.appendChild(el("span", "ssc-ct-label", "Voorbeeld"));
    var preview = el("div", "ssc-ct-preview");
    preview.setAttribute("aria-hidden", "true");
    var bar = el("div", "ssc-ct-preview-bar");
    bar.appendChild(el("i"));
    var page = el("div", "ssc-ct-preview-page");
    var cards = [];
    for (var i = 0; i < 2; i++) {
      var card = el("div", "ssc-ct-preview-card");
      card.appendChild(el("b", null, i ? "Planner" : "Berichten"));
      card.appendChild(el("span"));
      card.appendChild(el("span"));
      card.appendChild(el("em", null, i ? "8:25" : "Nieuw"));
      cards.push(card);
      page.appendChild(card);
    }
    preview.appendChild(bar);
    preview.appendChild(page);
    side.appendChild(preview);
    var check = el("div", "ssc-ct-contrast");
    check.setAttribute("role", "status");
    side.appendChild(check);

    body.appendChild(editor);
    body.appendChild(side);
    dialog.appendChild(body);
    dialog.appendChild(buildWallpaperCard(s || {}));

    // Footer
    var foot = el("div", "ssc-ct-foot");
    if (editing) {
      var del = el("button", "ssc-ct-btn ssc-ct-btn--danger");
      del.type = "button";
      del.appendChild(iconSvg("trash"));
      del.appendChild(document.createTextNode("Verwijderen"));
      del.addEventListener("click", function () {
        if (del.getAttribute("data-sure") !== "1") {
          del.setAttribute("data-sure", "1");
          del.lastChild.textContent = "Zeker? Klik nog eens";
          return;
        }
        deleteCustomTheme(entry.id).then(function (next) {
          if (!(next && next.customThemes && next.customThemes.length)) themeCategory = "all";
          close();
          onSaved(next);
        });
      });
      foot.appendChild(del);
    }
    foot.appendChild(el("span", "ssc-ct-spacer"));
    var cancel = el("button", "ssc-ct-btn", "Annuleren");
    cancel.type = "button";
    foot.appendChild(cancel);
    var saveBtn = el("button", "ssc-ct-btn ssc-ct-btn--primary");
    saveBtn.type = "button";
    saveBtn.appendChild(iconSvg("check"));
    saveBtn.appendChild(document.createTextNode(editing ? "Wijzigingen opslaan" : "Thema opslaan"));
    foot.appendChild(saveBtn);
    dialog.appendChild(foot);
    scrim.appendChild(dialog);

    function set(key, value, from) {
      vals[key] = value;
      var r = rows[key];
      r.swatch.style.background = value;
      if (r.picker.value !== value) r.picker.value = value;
      if (from !== r.hex) r.hex.value = value.toUpperCase();
      paint();
    }

    function setAll(next) {
      CT_FIELDS.forEach(function (f) {
        set(f.key, next[f.key]);
      });
    }

    function paint() {
      bar.style.background = vals.accent;
      page.style.background = vals.bg;
      cards.forEach(function (c) {
        c.style.background = vals.card;
        c.style.borderColor = vals.border;
        c.style.color = vals.text;
        c.querySelectorAll("span").forEach(function (line) {
          line.style.background = vals.text;
        });
        var pill = c.querySelector("em");
        pill.style.background = vals.accent;
        pill.style.color = inkOnHex(vals.accent);
      });
      // Text has to read on both the page and the cards: the worse one counts.
      var ratio = Math.min(contrast(vals.text, vals.bg), contrast(vals.text, vals.card));
      var level = ratio >= 7 ? "great" : ratio >= 4.5 ? "good" : ratio >= 3 ? "weak" : "bad";
      var words = {
        great: "Uitstekend leesbaar",
        good: "Goed leesbaar",
        weak: "Matig leesbaar: maak tekst en achtergrond meer verschillend",
        bad: "Slecht leesbaar: tekst en achtergrond lijken te veel op elkaar",
      };
      check.setAttribute("data-level", level);
      check.textContent = "";
      check.appendChild(el("b", null, ratio.toFixed(1).replace(".", ",") + " : 1"));
      check.appendChild(el("span", null, words[level]));
    }

    function close() {
      scrim.remove();
      if (opener && opener.isConnected) opener.focus();
    }

    saveBtn.addEventListener("click", function () {
      saveBtn.disabled = true;
      var themeName = (name.value || "").trim() || "Eigen thema";
      window.sscGet().then(function (cur) {
        var list = (cur.customThemes || []).slice();
        var id = editing ? entry.id : "custom-" + Date.now();
        var next = { id: id, name: themeName, bg: vals.bg, card: vals.card, text: vals.text, accent: vals.accent, border: vals.border };
        var at = -1;
        for (var j = 0; j < list.length; j++) if (list[j].id === id) at = j;
        if (at >= 0) list[at] = next;
        else list.push(next);
        return save({ customThemes: list, theme: "custom", customThemeId: id });
      }).then(function (next) {
        close();
        onSaved(next);
      }, function () {
        saveBtn.disabled = false;
      });
    });
    cancel.addEventListener("click", close);
    closeBtn.addEventListener("click", close);
    surprise.addEventListener("click", function () {
      setAll(surprisePalette());
    });
    scrim.addEventListener("click", function (e) {
      if (e.target === scrim) close();
    });
    scrim.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      // Only the dialog closes, not the settings panel behind it.
      e.preventDefault();
      e.stopPropagation();
      close();
    });

    setAll(vals);
    rootEl.appendChild(scrim);
    name.focus();
  }

  var WALLPAPER_MAX_BYTES = 80 * 1024 * 1024;
  var WALLPAPER_TYPES = /^(image\/(png|jpe?g|webp|gif|avif)|video\/(mp4|webm))$/i;

  /*
   * The wallpaper picker, inside the custom theme dialog: a small drop
   * target with a live thumbnail (the video plays muted, a GIF animates),
   * Uploaden and Wissen, and a link field. A change applies straight away,
   * to whichever theme is active. Files go to IndexedDB through layout.js
   * (sscWallpaper); only "ssc-media:<stamp>" is saved in the settings.
   */
  function buildWallpaperCard(s) {
    var api = window.sscWallpaper;
    var card = el("section", "ssc-wp-card");
    card.setAttribute("aria-label", "Achtergrond");

    var drop = el("div", "ssc-wp-drop");
    drop.tabIndex = 0;
    drop.setAttribute("role", "button");
    drop.setAttribute("aria-label", "Achtergrond uploaden");

    var side = el("div", "ssc-wp-side");
    side.appendChild(el("h3", "ssc-wp-title", "Achtergrond"));

    var actions = el("div", "ssc-wp-actions");
    function iconButton(icon, text, primary) {
      var b = el("button", "ssc-wp-btn" + (primary ? " ssc-wp-btn--primary" : ""));
      b.type = "button";
      b.appendChild(iconSvg(icon));
      b.appendChild(document.createTextNode(text));
      return b;
    }
    var uploadBtn = iconButton("upload", "Uploaden", true);
    var clearBtn = iconButton("trash", "Wissen", false);
    actions.appendChild(uploadBtn);
    actions.appendChild(clearBtn);
    side.appendChild(actions);

    var urlRow = el("div", "ssc-wp-url");
    urlRow.appendChild(iconSvg("link"));
    var url = createTextInput("ssc-settings-wallpaper-url", "of plak een link (https://… .jpg, .gif, .mp4, .webm)");
    var current = s.backgroundUrl || "";
    url.value = /^(data:|ssc-media:)/.test(current) ? "" : current;
    urlRow.appendChild(url);
    side.appendChild(urlRow);

    side.appendChild(el("p", "ssc-wp-hint", "Foto, GIF of video (MP4, WebM) · max 80 MB · ook slepen kan"));
    var status = el("p", "ssc-wp-status", "");
    status.setAttribute("role", "status");
    side.appendChild(status);

    card.appendChild(drop);
    card.appendChild(side);

    var file = el("input");
    file.type = "file";
    file.accept = "image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm";
    file.hidden = true;
    card.appendChild(file);

    var previewUrl = "";
    function setStatus(text, isError) {
      status.textContent = text || "";
      if (isError) status.setAttribute("data-error", "1");
      else status.removeAttribute("data-error");
    }

    function showPreview(value) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = "";
      }
      drop.textContent = "";
      drop.removeAttribute("data-has");
      clearBtn.disabled = !value;
      var empty = el("div", "ssc-wp-empty");
      empty.appendChild(iconSvg("upload"));
      if (!value || !api) {
        drop.appendChild(empty);
        return;
      }
      api.preview(value).then(function (info) {
        if (!info) {
          drop.appendChild(empty);
          return;
        }
        if (info.blob) previewUrl = info.src;
        var media;
        if (info.kind === "video") {
          media = el("video", "ssc-wp-media");
          media.muted = true;
          media.loop = true;
          media.autoplay = true;
          media.playsInline = true;
          media.setAttribute("muted", "");
        } else {
          media = el("img", "ssc-wp-media");
          media.alt = "";
        }
        media.src = info.src;
        drop.appendChild(media);
        drop.setAttribute("data-has", "1");
        var badge = el("span", "ssc-wp-badge");
        badge.appendChild(iconSvg(info.kind === "image" ? "palette" : "play"));
        badge.appendChild(document.createTextNode(info.kind === "video" ? "Live video" : info.kind === "gif" ? "Live GIF" : "Afbeelding"));
        drop.appendChild(badge);
      }, function () {
        drop.appendChild(empty);
      });
    }
    showPreview(current);
    if (!s.theme || s.theme === "default") {
      setStatus("Werkt met een thema: sla dit thema op of kies er een.", false);
    }

    function useFile(f) {
      if (!f) return;
      if (!WALLPAPER_TYPES.test(f.type || "")) {
        setStatus("Dit bestandstype wordt niet ondersteund.", true);
        return;
      }
      if (f.size > WALLPAPER_MAX_BYTES) {
        setStatus("Te groot (max 80 MB). Kies een kleiner bestand.", true);
        return;
      }
      if (!api) {
        setStatus("Opslaan lukt niet op deze pagina.", true);
        return;
      }
      setStatus("Opslaan…", false);
      uploadBtn.disabled = true;
      api.store(f).then(function (value) {
        url.value = "";
        return save({ backgroundUrl: value }).then(function () {
          showPreview(value);
          var mb = (f.size / 1048576).toFixed(1).replace(".", ",");
          setStatus("Ingesteld: " + (f.name || "bestand") + " (" + mb + " MB)", false);
        });
      }).catch(function () {
        setStatus("Opslaan mislukt. Is er genoeg schijfruimte?", true);
      }).then(function () {
        uploadBtn.disabled = false;
      });
    }

    file.addEventListener("change", function () {
      var f = file.files && file.files[0];
      file.value = "";
      useFile(f);
    });
    uploadBtn.addEventListener("click", function () {
      file.click();
    });
    drop.addEventListener("click", function () {
      file.click();
    });
    drop.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        file.click();
      }
    });
    drop.addEventListener("dragover", function (e) {
      e.preventDefault();
      drop.setAttribute("data-over", "1");
    });
    drop.addEventListener("dragleave", function () {
      drop.removeAttribute("data-over");
    });
    drop.addEventListener("drop", function (e) {
      e.preventDefault();
      drop.removeAttribute("data-over");
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      useFile(f);
    });

    clearBtn.addEventListener("click", function () {
      url.value = "";
      var done = api ? api.clear() : Promise.resolve();
      done.then(function () {
        return save({ backgroundUrl: "" });
      }).then(function () {
        showPreview("");
        setStatus("Achtergrond gewist.", false);
      });
    });

    url.addEventListener("change", function () {
      var v = url.value.trim();
      if (v && !/^https?:\/\//i.test(v)) {
        setStatus("Gebruik een link die met http:// of https:// begint.", true);
        return;
      }
      save({ backgroundUrl: v }).then(function () {
        showPreview(v);
        setStatus(v ? "Link ingesteld." : "Achtergrond gewist.", false);
      });
    });

    return card;
  }

  function pageAppearance(s) {
    pageEl.appendChild(createMainTitle("Uiterlijk"));

    pageEl.appendChild(createSectionTitle("Thema"));
    var selector = el("div", "ssc-theme-selector");
    selector.style.width = "100%";
    renderThemeSelector(selector, s);
    pageEl.appendChild(selector);

    pageEl.appendChild(createSectionTitle("Bovenbalk"));
    pageEl.appendChild(createDescription("Maak de bovenbalk transparant."));
    pageEl.appendChild(createSettingsButtonWithLabel(
      "settings-page-topnav-background-button", "Transparante bovenbalk", !!s.topbarTransparent,
      function (on) {
        save({ topbarTransparent: on });
      }
    ));

    pageEl.appendChild(createSectionTitle("Glass"));
    pageEl.appendChild(createDescription("Geef de pagina een glazen effect."));
    pageEl.appendChild(createSettingsButtonWithLabel(
      "settings-page-glass-button", "Glass", !!s.glass,
      function (on) {
        save({ glass: on });
      }
    ));
  }

  /* ---------- page: Widgets ---------- */

  /*
   * Widgets are placed on the start page itself (widget-system.js, smpp's
   * edit mode): this tab only opens that editor.
   */
  var WIDGET_COLUMNS = [["3", "3 kolommen"], ["4", "4 kolommen"], ["5", "5 kolommen"]];

  function pageWidgets(s) {
    pageEl.appendChild(createMainTitle("Widgets"));
    pageEl.appendChild(createDescription(
      "Sleep widgets van en naar je startpagina. Sleep een widget naar de tas bovenaan om hem weg te halen."
    ));
    pageEl.appendChild(createActionButton("Widgets bewerken", function () {
      // The editor is an on-demand module (lazy.js); off the start page,
      // open() goes to the start page and enters edit mode there.
      var load = typeof window.sscLoadModule === "function"
        ? window.sscLoadModule("widgets")
        : Promise.resolve();
      load.then(function () {
        if (window.sscWidgetEditor) window.sscWidgetEditor.open();
      }, function (e) {
        console.error("[SSC] widgets failed to load", e);
      });
    }));

    pageEl.appendChild(createSectionTitle("Kolommen"));
    pageEl.appendChild(createDescription("Hoeveel widgets naast elkaar op je startpagina staan."));
    var cols = String((s && s.widgetColumns) || 4);
    pageEl.appendChild(createSelect("ssc-widget-columns", WIDGET_COLUMNS, cols, function (v) {
      save({ widgetColumns: Number(v) });
    }));
  }

  /* ---------- page: Cijfers ---------- */

  var CUTSCENE_STYLES = [
    ["reel", "Reel (CS:GO)"],
    ["tunnel", "Walkout (FIFA)"],
    ["flip", "Kaart (Magister-style flip)"],
    ["scratch", "Kraskaart"],
    ["slot", "Slotmachine"],
    ["roulette", "Roulettewiel"],
    ["pack", "Kaartenpakket"],
  ];

  var TIER_NAMES = { bronze: "Brons", silver: "Zilver", gold: "Goud", icon: "Icoon" };

  // Grade data shared by the Skip-all button and the Punten list.
  var grades = [];
  var seen = {};
  var gradesLoaded = false;
  var puntenFilter = "all";
  var puntenListEl = null;
  var puntenCountEl = null;
  var skipWrapEl = null;
  var seenListenerBound = false;

  function unseenGrades() {
    return grades.filter(function (g) {
      return g.id && !seen[g.id];
    });
  }

  function loadGrades() {
    var cached = typeof window.sscGetGradesCache === "function"
      ? window.sscGetGradesCache()
      : Promise.resolve(null);
    var seenP = typeof window.sscGetSeen === "function" ? window.sscGetSeen() : Promise.resolve({});

    Promise.all([cached, seenP]).then(function (out) {
      seen = out[1] || {};
      if (out[0] && Array.isArray(out[0].grades) && out[0].grades.length) {
        grades = out[0].grades;
        gradesLoaded = true;
        refreshGradeViews();
      }
    });

    var fresh = typeof window.sscFetchGradesCached === "function"
      ? window.sscFetchGradesCached()
      : typeof window.sscFetchGrades === "function"
        ? window.sscFetchGrades()
        : Promise.resolve(null);
    fresh.then(function (list) {
      if (Array.isArray(list)) {
        grades = list;
        gradesLoaded = true;
        refreshGradeViews();
      }
    }, function () {
      if (!gradesLoaded && puntenListEl) {
        puntenListEl.textContent = "";
        puntenListEl.appendChild(el("p", "ssc-pt-empty", "Cijfers ophalen mislukt. Probeer opnieuw."));
      }
    });

    if (!seenListenerBound && typeof window.sscOnSeenChange === "function") {
      seenListenerBound = true;
      window.sscOnSeenChange(function (next) {
        seen = next || {};
        refreshGradeViews();
      });
    }
  }

  function refreshGradeViews() {
    if (puntenListEl && puntenListEl.isConnected) renderPuntenList();
    if (skipWrapEl && skipWrapEl.isConnected) renderSkipAll();
  }

  /** Mark many grades at once, in one storage write. No cutscene plays. */
  function markMany(ids, asSeen) {
    if (typeof window.sscGetSeen !== "function" || typeof window.sscSetSeen !== "function") {
      return Promise.resolve();
    }
    return window.sscGetSeen().then(function (map) {
      var next = Object.assign({}, map || {});
      var now = Date.now();
      for (var i = 0; i < ids.length; i++) {
        if (asSeen) {
          if (!next[ids[i]]) next[ids[i]] = now;
        } else {
          delete next[ids[i]];
        }
      }
      seen = next;
      refreshGradeViews();
      return window.sscSetSeen(next);
    });
  }

  function allGradeIds() {
    return grades.map(function (g) {
      return g.id;
    }).filter(Boolean);
  }

  function renderSkipAll() {
    skipWrapEl.textContent = "";
    var n = unseenGrades().length;
    var btn = createActionButton("Alles als gezien markeren", function () {
      skipWrapEl.textContent = "";
      var box = el("div", "ssc-sw-confirm");
      box.appendChild(el("p", null,
        "Markeer alle " + n + " ongelezen cijfers als gezien? Er worden geen animaties gespeeld."));
      var row = el("div", "ssc-sw-row-buttons");
      row.appendChild(createActionButton("Ja", function () {
        markMany(unseenGrades().map(function (g) {
          return g.id;
        }), true);
      }, "ssc-sw-small-btn"));
      row.appendChild(createActionButton("Annuleren", function () {
        renderSkipAll();
      }, "ssc-sw-small-btn"));
      box.appendChild(row);
      skipWrapEl.appendChild(box);
    });
    if (!gradesLoaded) {
      btn.disabled = true;
      btn.title = "Cijfers laden…";
    } else if (n === 0) {
      btn.disabled = true;
      btn.title = "Alle cijfers zijn al gezien";
    }
    skipWrapEl.appendChild(btn);
  }

  function dateValue(datum) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(datum || ""));
    return m ? Number(m[3] + m[2] + m[1]) : 0;
  }

  function fmtNum(n) {
    if (typeof n !== "number" || !isFinite(n)) return "";
    return n % 1 === 0 ? String(n) : n.toFixed(1).replace(".", ",");
  }

  function percentOfGrade(g) {
    if (typeof g.percentage === "number" && isFinite(g.percentage)) return g.percentage;
    if (typeof g.ruweScore === "number" && typeof g.ruweMax === "number" && g.ruweMax > 0) {
      return (g.ruweScore / g.ruweMax) * 100;
    }
    return null;
  }

  function tierFor(pct) {
    var card = window.sscFifaCard;
    if (card && typeof card.tierForPercent === "function" && pct !== null) return card.tierForPercent(pct);
    return null;
  }

  function renderPuntenList() {
    var total = grades.length;
    var unseen = unseenGrades().length;
    if (puntenCountEl) {
      puntenCountEl.textContent = gradesLoaded
        ? total + " cijfers totaal · " + unseen + " ongelezen"
        : "Cijfers laden…";
    }
    puntenListEl.textContent = "";
    if (!gradesLoaded) {
      puntenListEl.appendChild(el("p", "ssc-pt-empty", "Cijfers laden…"));
      return;
    }

    var rows = grades.filter(function (g) {
      if (!g.id) return false;
      if (puntenFilter === "unseen") return !seen[g.id];
      if (puntenFilter === "seen") return !!seen[g.id];
      return true;
    }).sort(function (a, b) {
      return dateValue(b.datum) - dateValue(a.datum);
    });

    if (!rows.length) {
      puntenListEl.appendChild(el("p", "ssc-pt-empty", "Geen cijfers in deze lijst."));
      return;
    }

    for (var i = 0; i < rows.length; i++) {
      (function (g) {
        var isSeen = !!seen[g.id];
        var row = el("label", "ssc-pt-row" + (isSeen ? "" : " is-unseen"));
        var box = el("input");
        box.type = "checkbox";
        box.checked = isSeen;
        box.title = "Gezien";
        box.addEventListener("change", function () {
          // No cutscene here: it plays the next time Resultaten opens.
          if (box.checked) {
            seen[g.id] = Date.now();
            if (typeof window.sscMarkSeen === "function") window.sscMarkSeen(g.id);
          } else {
            delete seen[g.id];
            if (typeof window.sscMarkUnseen === "function") window.sscMarkUnseen(g.id);
          }
          refreshGradeViews();
        });
        row.appendChild(box);

        var main = el("div", "ssc-pt-main");
        var vak = el("div", "ssc-pt-vak", g.vak || "Vak");
        if (!isSeen) vak.appendChild(el("span", "ssc-pt-new", "Nieuw"));
        main.appendChild(vak);
        main.appendChild(el("div", "ssc-pt-titel", g.titel || ""));
        row.appendChild(main);

        var meta = [g.datum, g.periode].filter(Boolean).join(" · ");
        row.appendChild(el("div", "ssc-pt-meta", meta));

        var score = el("div", "ssc-pt-score");
        var pct = percentOfGrade(g);
        var tier = tierFor(pct);
        var frac = (typeof g.ruweScore === "number" && typeof g.ruweMax === "number")
          ? fmtNum(g.ruweScore) + "/" + fmtNum(g.ruweMax)
          : "";
        var text = el("span", null, [frac, pct !== null ? Math.round(pct) + "%" : ""].filter(Boolean).join(" · "));
        if (tier) text.style.color = tier.glow;
        score.appendChild(text);
        if (tier) {
          var badge = el("span", "ssc-pt-badge", TIER_NAMES[tier.id] || tier.id);
          badge.style.backgroundColor = tier.glow;
          score.appendChild(badge);
        }
        row.appendChild(score);
        puntenListEl.appendChild(row);
      })(rows[i]);
    }
  }

  function pageGrades(s) {
    pageEl.appendChild(createMainTitle("Cijfers"));

    /* --- reveal --- */
    pageEl.appendChild(createSectionTitle("Onthulling"));
    pageEl.appendChild(createDescription("Hoe een nieuw cijfer onthuld wordt als je Resultaten opent."));
    pageEl.appendChild(createSelect("ssc-cutscene-style", CUTSCENE_STYLES, s.cutsceneStyle || "reel", function (v) {
      save({ cutsceneStyle: v });
    }));
    pageEl.appendChild(createSettingsButtonWithLabel("ssc-cutscene-auto", "Automatisch afspelen bij nieuwe cijfers",
      s.cutsceneAuto !== false, function (on) {
        save({ cutsceneAuto: on });
      }));
    pageEl.appendChild(createSettingsButtonWithLabel("ssc-cutscene-sound", "Geluid aan",
      s.cutsceneSound !== false, function (on) {
        save({ cutsceneSound: on });
      }));
    pageEl.appendChild(createSelect("ssc-queue-order", [["newest", "Nieuwste eerst"], ["oldest", "Oudste eerst"]],
      s.queueOrder || "newest", function (v) {
        save({ queueOrder: v });
      }));

    pageEl.appendChild(createSectionTitle("Alles overslaan"));
    pageEl.appendChild(createDescription("Markeer alle ongelezen cijfers als gezien, zonder animaties."));
    skipWrapEl = el("div");
    pageEl.appendChild(skipWrapEl);
    renderSkipAll();

    /* --- percentages --- */
    pageEl.appendChild(createSectionTitle("Percentages"));
    pageEl.appendChild(createDescription("Toon het percentage naast elk vak in de puntenlijst. Groen vanaf 70%, oranje vanaf 50%."));
    pageEl.appendChild(createSettingsButtonWithLabel("ssc-table-percentages", "Percentages tonen in de puntenlijst",
      s.tablePercentages !== false, function (on) {
        save({ tablePercentages: on });
      }));
    var pctStatus = el("p", "ssc-sw-status", "");
    function pctText(count) {
      if (!count) return "Geen percentages op deze pagina. Open Resultaten.";
      return count + (count === 1 ? " percentage op deze pagina" : " percentages op deze pagina");
    }
    pctStatus.textContent = pctText(typeof window.sscPercentagesCount === "function" ? window.sscPercentagesCount() : 0);
    var recalc = createActionButton("Herbereken percentages", function () {
      recalc.disabled = true;
      var done = function (count) {
        recalc.disabled = false;
        pctStatus.textContent = pctText(count);
      };
      if (typeof window.sscPercentagesRefresh === "function") {
        window.sscPercentagesRefresh().then(done, function () {
          done(typeof window.sscPercentagesCount === "function" ? window.sscPercentagesCount() : 0);
        });
      } else {
        done(0);
      }
    }, "ssc-sw-small-btn");
    pageEl.appendChild(recalc);
    pageEl.appendChild(pctStatus);

    /* --- punten --- */
    pageEl.appendChild(createSectionTitle("Punten"));
    pageEl.appendChild(createDescription("Vink een cijfer uit om de onthulling opnieuw te zien de volgende keer dat je Resultaten opent."));
    var head = el("div", "ssc-pt-head");
    puntenCountEl = el("span", "ssc-pt-count", "Cijfers laden…");
    head.appendChild(puntenCountEl);
    var bulk = el("div", "ssc-sw-row-buttons");
    bulk.style.margin = "0";
    bulk.appendChild(createActionButton("Alles als gezien", function () {
      markMany(allGradeIds(), true);
    }, "ssc-sw-small-btn"));
    bulk.appendChild(createActionButton("Alles als ongelezen", function () {
      markMany(allGradeIds(), false);
    }, "ssc-sw-small-btn"));
    head.appendChild(bulk);
    pageEl.appendChild(head);

    var chips = el("div", "ssc-pt-chips");
    [["all", "Alle"], ["unseen", "Ongelezen"], ["seen", "Gezien"]].forEach(function (c) {
      var chip = el("button", "ssc-pt-chip", c[1]);
      chip.type = "button";
      chip.setAttribute("aria-pressed", puntenFilter === c[0] ? "true" : "false");
      chip.addEventListener("click", function () {
        puntenFilter = c[0];
        var all = chips.querySelectorAll(".ssc-pt-chip");
        for (var i = 0; i < all.length; i++) all[i].setAttribute("aria-pressed", "false");
        chip.setAttribute("aria-pressed", "true");
        renderPuntenList();
      });
      chips.appendChild(chip);
    });
    pageEl.appendChild(chips);

    puntenListEl = el("div", "ssc-pt-list");
    pageEl.appendChild(puntenListEl);
    renderPuntenList();

    /* --- page layout tools --- */
    pageEl.appendChild(createSectionTitle("Pagina"));
    pageEl.appendChild(createDescription("Zoom, elementen verbergen en eigen CSS."));
    pageEl.appendChild(createLabeledSlider(70, 150, 5, "ssc-zoom-slider", "Paginazoom", s.pageZoom || 100,
      function (v) {
        return v + "%";
      },
      debounce(function (v) {
        save({ pageZoom: v });
      }, 150)));
    pageEl.appendChild(createDescription("Elementen verbergen (CSS-selector, één per regel)"));
    pageEl.appendChild(createTextArea("ssc-hide-selectors", "#selector\n.andere-selector", s.hideSelectors, debounce(function (v) {
      save({ hideSelectors: v });
    }, 300)));
    pageEl.appendChild(createDescription("Eigen CSS"));
    pageEl.appendChild(createTextArea("ssc-custom-css", "/* Eigen CSS */", s.customCss, debounce(function (v) {
      save({ customCss: v });
    }, 300)));

    loadGrades();
  }

  /* ---------- page: Overig ---------- */

  function pageOther(s) {
    pageEl.appendChild(createMainTitle("Overig"));
    pageEl.appendChild(createSectionTitle("Prestaties"));
    pageEl.appendChild(createDescription("Zet animaties uit voor betere prestaties op tragere toestellen."));
    pageEl.appendChild(createSettingsButtonWithLabel(
      "settings-page-performance-mode-button", "Prestatiemodus", !!s.performanceMode,
      function (on) {
        save({ performanceMode: on });
      }
    ));
  }

  /* ---------- page switching ---------- */

  function renderPage() {
    if (!pageEl) return;
    var page = currentPage;
    window.sscGet().then(function (s) {
      // A newer show() may have switched pages while storage was read.
      if (page !== currentPage) return;
      pageEl.textContent = "";
      pageEl.scrollTop = 0;
      puntenListEl = null;
      puntenCountEl = null;
      skipWrapEl = null;
      updateProfileButton(s);
      switch (page) {
        case "profile": pageProfile(s); break;
        case "appearance": pageAppearance(s); break;
        case "widgets": pageWidgets(s); break;
        case "grades": pageGrades(s); break;
        case "other": pageOther(s); break;
      }
    });
  }

  function show(page) {
    if (page && PAGES[page]) {
      if (page !== currentPage && page === "appearance") themeCategory = "all";
      currentPage = page;
    }
    syncSidebar();
    renderPage();
  }

  /**
   * Builds the window into `container` (the panel body). Idempotent: a second
   * call with the same container only re-renders the current page.
   */
  function render(container) {
    if (rootEl && rootEl.parentNode === container) {
      renderPage();
      return;
    }
    rootEl = el("div");
    rootEl.id = "settings-window";
    sidebarEl = buildSidebar();
    pageEl = el("div");
    pageEl.id = "settings-page";
    rootEl.appendChild(sidebarEl);
    rootEl.appendChild(pageEl);
    container.textContent = "";
    container.appendChild(rootEl);
    syncSidebar();
    renderPage();
  }

  window.sscSettingsWindow = {
    CSS: CSS,
    render: render,
    show: show,
    refresh: renderPage,
    current: function () {
      return currentPage;
    },
  };
})();
