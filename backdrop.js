/**
 * Smartschool Combined — cinematic backdrop for both cutscene styles.
 *
 * The reel and the walkout tunnel both used to play on a flat dark scrim.
 * This paints the active theme's own background behind them instead: the
 * theme photograph, blurred hard and dimmed, drifting in slowly for the
 * length of the cutscene. Themes without a photograph (and the default
 * palette) get the same colour-mix gradient the page itself falls back to,
 * so the cutscene always matches the page it interrupts.
 *
 * It is one module rather than two copies because the two styles must not
 * drift apart: the same blur radius, the same dim, the same drift curve.
 *
 * Nothing here touches Smartschool's DOM. The backdrop is a fixed-position
 * child of the cutscene overlay, inside the shadow root.
 */
(function () {
  "use strict";

  // Sign-in pages: do nothing at all (see guard.js).
  if (window.sscSkipPage) return;

  if (window.sscCutsceneBackdrop) return;

  var BLUR = "20px";
  var DIM = 0.4;

  /**
   * How far the photograph drifts over the whole cutscene. Inset on the
   * element (-10%) buys the room, so the slow zoom never exposes an edge.
   */
  var DRIFT_TO = 1.08;
  var INSET = "-10%";

  var CSS = [
    ".ssc-cine{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;",
    "  contain:strict;}",
    ".ssc-cine-art{position:absolute;inset:" + INSET + ";",
    "  filter:blur(" + BLUR + ") brightness(" + DIM + ") saturate(1.1);",
    "  transform:scale(1);transform-origin:center;will-change:transform;}",
    ".ssc-cine[data-motion='1'] .ssc-cine-art{",
    "  animation:ssc-cine-drift var(--cine-ms,12000ms) cubic-bezier(.25,.6,.35,1) both;}",
    "@keyframes ssc-cine-drift{",
    "  from{transform:scale(1);}",
    "  to{transform:scale(" + DRIFT_TO + ");}",
    "}",
    ".ssc-cine-art--image{background-size:cover;background-position:center;",
    "  background-repeat:no-repeat;}",
    // Same five-stop gradient as the page layer in layout.js. Custom
    // properties inherit through the shadow boundary, so the theme's own
    // palette is picked up without passing colours through JavaScript.
    ".ssc-cine-art--gradient{background-image:linear-gradient(45deg,",
    "  color-mix(in srgb, var(--ssc-base00, #141414) 95%, var(--ssc-accent, #3ba37a) 5%) 0%,",
    "  color-mix(in srgb, var(--ssc-base00, #141414) 90%, var(--ssc-accent, #3ba37a) 10%) 15%,",
    "  color-mix(in srgb, var(--ssc-base01, #1f1f1f) 93%, var(--ssc-accent, #3ba37a) 7%) 45%,",
    "  color-mix(in srgb, var(--ssc-base01, #1f1f1f) 95%, var(--ssc-accent, #3ba37a) 5%) 55%,",
    "  color-mix(in srgb, var(--ssc-base01, #1f1f1f) 98%, var(--ssc-accent, #3ba37a) 2%) 100%);}",
    // Readability scrim over the art: darkest at the edges where the type
    // sits closest to the frame, lighter in the middle where the stage is.
    ".ssc-cine-scrim{position:absolute;inset:0;",
    "  background:radial-gradient(ellipse 82% 74% at 50% 46%,",
    "    rgba(4,6,10,.34) 0%,rgba(4,6,10,.62) 62%,rgba(4,6,10,.86) 100%);}",
    "@media not all{" /* was prefers-reduced-motion: cutscenes always play in full */,
    "  .ssc-cine[data-motion='1'] .ssc-cine-art{animation:none;}",
    "}",
  ].join("\n");

  function ensureCss(shadow) {
    if (!shadow) return;
    if (shadow.querySelector("style[data-ssc-cine]")) return;
    var style = document.createElement("style");
    style.setAttribute("data-ssc-cine", "1");
    style.textContent = CSS;
    shadow.appendChild(style);
  }

  /**
   * layout.js publishes the resolved theme here every time it applies one.
   * Reading it synchronously matters: the cutscene starts inside a click
   * handler, and awaiting chrome.storage there would lose the gesture the
   * audio unlock depends on.
   */
  function currentTheme() {
    var state = window.sscThemeState || {};
    var theme = state.theme || "";
    var background = state.background || "";
    if (!theme || theme === "default" || theme === "custom") background = "";
    return { theme: theme, background: background };
  }

  /**
   * @param {ShadowRoot} shadow
   * @param {HTMLElement} overlay  the cutscene overlay to sit behind
   * @param {Object} [options] { totalMs, reduced }
   */
  function mount(shadow, overlay, options) {
    var opts = options || {};
    if (!overlay) return null;

    ensureCss(shadow);

    var theme = currentTheme();
    var art = document.createElement("div");
    art.className = "ssc-cine-art";

    if (theme.background) {
      art.classList.add("ssc-cine-art--image");
      art.style.backgroundImage = 'url("' + theme.background + '")';
    } else {
      art.classList.add("ssc-cine-art--gradient");
    }
    art.setAttribute("aria-hidden", "true");

    var scrim = document.createElement("div");
    scrim.className = "ssc-cine-scrim";
    scrim.setAttribute("aria-hidden", "true");

    var cine = document.createElement("div");
    cine.className = "ssc-cine";
    cine.setAttribute("aria-hidden", "true");
    cine.style.setProperty("--cine-ms", (opts.totalMs || 12000) + "ms");
    if (!opts.reduced) cine.setAttribute("data-motion", "1");

    cine.appendChild(art);
    cine.appendChild(scrim);

    // First child, so it paints under the header, stage and footer. The
    // overlay's own background is a scrim on top of it.
    if (overlay.firstChild) overlay.insertBefore(cine, overlay.firstChild);
    else overlay.appendChild(cine);

    return cine;
  }

  window.sscCutsceneBackdrop = mount;
  window.sscCutsceneBackdropCss = CSS;
})();
