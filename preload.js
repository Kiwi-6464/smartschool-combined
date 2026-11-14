/**
 * Smartschool Combined — document_start: runs before Smartschool has
 * painted anything. Two jobs.
 *
 * 1. Theme. layout.js runs at document_idle and saves what it applied
 *    (sscThemeBoot); this file puts that palette and photograph on <html>
 *    right away, so a themed page never flashes Smartschool's own colours
 *    first. layout.js re-applies the real settings when it runs.
 *
 * 2. Resultaten cover. Opening Resultaten is a full page load, and everything else in the
 * extension starts at document_idle. Without this file the grades are on
 * screen for a moment before walkout.js gets to blur them. Here a stylesheet
 * and a solid cover go onto <html> before <body> even exists; walkout.js
 * lifts them (window.sscPreloadDone) once the reveal is ready, and a timer
 * lifts them on its own if the rest of the extension never gets that far.
 *
 * 3. Sign-in pages (/login, /account-verification, /2fa). Nothing else of
 *    the extension runs there (guard.js), but the theme should: the same
 *    snapshot goes on <html>, plus a sheet that themes the page around the
 *    form and keeps every input opaque and readable.
 *
 * Only our own ids are added, both straight onto documentElement (never
 * body). The !important rules are scoped to html[data-ssc-preload], which
 * only exists while the cover is up, and html[data-ssc-login], which only
 * exists on a themed sign-in page.
 */
(function () {
  "use strict";

  var STYLE_ID = "ssc-preload-style";
  var COVER_ID = "ssc-preload-cover";
  var ATTR = "data-ssc-preload";
  // The cover's z-index is just below the shadow host (99999, content.js),
  // so our loader, audio prompt and cutscenes all draw on top of it.
  var COVER_Z = 99998;
  // Long enough for a slow API, short enough that a broken load never locks
  // the page: walkout.js shows its own retry screen after 8s.
  var FAILSAFE_MS = 15000;

  // Same test as walkout.js, so the cover and the reveal agree on the page.
  function isResultsPage() {
    return /result/i.test(String(location.href || ""));
  }

  var LOGIN_PATH = /^\/(login|account-verification|2fa)(\/|$)/i;
  var onLogin = LOGIN_PATH.test(location.pathname);

  var root = document.documentElement;
  var wantCover = !onLogin && isResultsPage();

  /* ---------- 3. the sign-in page ---------- */

  var LOGIN_STYLE_ID = "ssc-login-style";

  /*
   * Modelled on Smartschool++ (src/styles/fixes/login.css + login.ts): the
   * left half with Smartschool's big photograph goes, the bottom strip goes,
   * and the form stands alone in the middle of the page on a glass card. The
   * page behind it is the active theme's photograph (or wallpaper); without
   * a theme it is our own palette, dark or light with the system.
   *
   * Smartschool's sign-in CSS sets its own colours, so these rules need
   * !important; every one of them is behind html[data-ssc-login]. Inputs
   * stay solid (base00 with the theme's text colour) whatever the glass does.
   */
  // Every text field on the sign-in form (see the Fields rules below).
  var F = ":is(#ssc-login-field,input:not([type='checkbox']):not([type='radio']):not([type='hidden'])" +
    ":not([type='submit']):not([type='button']):not([type='image']),select,textarea)";

  var LOGIN_CSS = [
    // Our palette when no theme is active, following the system's scheme.
    "html[data-ssc-login]:not([data-ssc-theme]){--ssc-base00:#f4f6fb;--ssc-base01:#ffffff;--ssc-base02:#e2e7f0;",
    "  --ssc-text:#18202c;--ssc-accent:#4f5bd5;}",
    "@media (prefers-color-scheme:dark){html[data-ssc-login]:not([data-ssc-theme]){--ssc-base00:#0d1016;--ssc-base01:#161b24;",
    "  --ssc-base02:#252d3a;--ssc-text:#e8edf5;--ssc-accent:#8b97ff;}}",
    // The fields' fill: the theme's own background, nudged a little toward
    // its card colour. Both are background tones, so the theme's text reads on it.
    "html[data-ssc-login]{--ssc-login-field:color-mix(in srgb,var(--ssc-base00) 82%,var(--ssc-base01));}",

    // The page: the theme's photograph, or a soft mesh in the theme's colours.
    "html[data-ssc-login]{background-color:var(--ssc-base00) !important;min-height:100%;}",
    "html[data-ssc-login]:not([data-ssc-theme-has-bg]){background-image:",
    "  radial-gradient(ellipse 60% 55% at 12% 8%,color-mix(in srgb,var(--ssc-accent) 34%,transparent),transparent 70%),",
    "  radial-gradient(ellipse 55% 60% at 92% 96%,color-mix(in srgb,var(--ssc-accent) 22%,transparent),transparent 70%),",
    "  linear-gradient(160deg,var(--ssc-base01),var(--ssc-base00)) !important;background-attachment:fixed !important;}",
    "html[data-ssc-login] body{background:transparent !important;color:var(--ssc-text) !important;min-height:100vh;}",
    // A vignette over the photograph so the card always reads.
    "html[data-ssc-login][data-ssc-theme-has-bg] body::before{content:'';position:fixed;top:0;left:0;width:100vw;height:100vh;",
    "  pointer-events:none;z-index:0;background:radial-gradient(ellipse 70% 70% at 50% 50%,transparent 30%,rgba(0,0,0,.45));}",

    // Smartschool's own sign-in chrome: the photo half, the strip under the
    // form and every background of its own.
    "html[data-ssc-login] :is(.login-app__left,.login-app__bottom,.login-app__school-logo){display:none !important;}",
    "html[data-ssc-login] :is(.login-app,.login-app__container,.login-app__right,#smscMain){",
    "  background-color:transparent !important;background-image:none !important;box-shadow:none !important;}",
    "html[data-ssc-login] :is(.login-app,.login-app__container){position:relative;z-index:1;display:flex !important;",
    "  align-items:center !important;justify-content:center !important;min-height:100vh;width:100% !important;}",
    "html[data-ssc-login] #smscMain:has(.login-app){display:flex !important;align-items:center !important;justify-content:center !important;}",
    "html[data-ssc-login] .login-app__right{width:min(440px,92vw) !important;max-width:none !important;flex:none !important;",
    "  padding:24px 0 !important;margin:0 auto !important;}",

    // The card: glass in the theme's colours, a lit edge, a soft entrance.
    "html[data-ssc-login] .login-app__top{position:relative;box-sizing:border-box;width:100% !important;",
    "  padding:34px 32px 28px !important;border-radius:28px !important;color:var(--ssc-text) !important;",
    "  background:color-mix(in srgb,var(--ssc-base01) 70%,transparent) !important;",
    "  -webkit-backdrop-filter:blur(22px) saturate(1.4);backdrop-filter:blur(22px) saturate(1.4);",
    "  border:1px solid color-mix(in srgb,var(--ssc-text) 14%,transparent) !important;",
    "  box-shadow:0 30px 80px -24px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.14) !important;",
    "  animation:ssc-login-in 520ms cubic-bezier(.2,.9,.25,1) both;}",
    "@keyframes ssc-login-in{from{opacity:0;transform:translateY(14px) scale(.985);}}",
    "@media (prefers-reduced-motion:reduce){html[data-ssc-login] .login-app__top{animation:none;}}",
    // The accent line along the top edge.
    "html[data-ssc-login] .login-app__top::after{content:'';position:absolute;left:12%;right:12%;top:-1px;height:2px;",
    "  border-radius:2px;background:linear-gradient(90deg,transparent,var(--ssc-accent),transparent);}",
    // Our mark and a greeting above Smartschool's own title.
    "html[data-ssc-login] .login-app__top::before{content:var(--ssc-login-greeting,'Welkom');display:block;",
    "  padding-top:64px;margin:0 0 6px;text-align:center;font:700 13px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;",
    "  letter-spacing:.16em;text-transform:uppercase;color:color-mix(in srgb,var(--ssc-text) 72%,transparent);",
    "  background:var(--ssc-login-logo) center top/52px 52px no-repeat;}",
    "html[data-ssc-login] .login-app__platform-indicator{background:transparent !important;height:auto !important;",
    "  padding:0 !important;margin:0 0 18px !important;text-align:center !important;}",
    "html[data-ssc-login] .login-app__platform-indicator :is(h1,h2,span,div),html[data-ssc-login] .logintitle{",
    "  color:var(--ssc-text) !important;font-size:26px !important;font-weight:750 !important;line-height:1.25 !important;margin:0 !important;}",
    "html[data-ssc-login] .login-app__top :is(h1,h2,h3,h4,p,label,legend,[class*='title'],[class*='label']){",
    "  color:var(--ssc-text) !important;}",
    "html[data-ssc-login] .login-app__title--separator{text-align:center !important;margin:12px 0 6px !important;color:color-mix(in srgb,var(--ssc-text) 60%,transparent) !important;}",
    "html[data-ssc-login] .login-app a:not(.smscButton){color:var(--ssc-text) !important;",
    "  text-decoration:underline !important;text-decoration-color:var(--ssc-accent) !important;text-underline-offset:3px;}",

    /*
     * Fields. Every rule starts from the same selector, F, which carries an
     * id's weight (the #ssc-login-field branch never matches; :is() takes the
     * heaviest branch). That puts these rules above Smartschool's own,
     * id-based ones included, and keeps hover, focus and autofill in order:
     * each adds one pseudo-class to the same base, so each wins over it.
     */
    "html[data-ssc-login] " + F + "{",
    "  background-color:var(--ssc-login-field) !important;background-image:none !important;",
    "  color:var(--ssc-text) !important;-webkit-text-fill-color:var(--ssc-text) !important;",
    "  caret-color:var(--ssc-accent) !important;opacity:1 !important;",
    "  border:1.5px solid color-mix(in srgb,var(--ssc-text) 20%,transparent) !important;border-radius:16px !important;",
    "  min-height:52px !important;box-sizing:border-box !important;font-size:15px !important;font-weight:500 !important;",
    "  box-shadow:inset 0 1px 3px rgba(0,0,0,.16),0 1px 0 color-mix(in srgb,var(--ssc-text) 6%,transparent) !important;",
    "  outline:none !important;transition:border-color .18s ease,box-shadow .18s ease,background-color .18s ease;}",
    "html[data-ssc-login] " + F + ":hover{border-color:color-mix(in srgb,var(--ssc-text) 36%,transparent) !important;}",
    "html[data-ssc-login] " + F + ":focus{border-color:var(--ssc-accent) !important;",
    "  box-shadow:inset 0 1px 3px rgba(0,0,0,.12),0 0 0 4px color-mix(in srgb,var(--ssc-accent) 30%,transparent),",
    "    0 8px 24px -10px var(--ssc-accent) !important;}",
    // Browser autofill (Edge fills the username): its pale fill is painted
    // over with ours, and the text keeps the theme's colour.
    "html[data-ssc-login] " + F + ":is(:-webkit-autofill,:autofill){",
    "  -webkit-box-shadow:0 0 0 1000px var(--ssc-login-field) inset !important;",
    "  box-shadow:0 0 0 1000px var(--ssc-login-field) inset !important;",
    "  -webkit-text-fill-color:var(--ssc-text) !important;caret-color:var(--ssc-accent) !important;",
    "  transition:background-color 99999s ease 0s,border-color .18s ease;}",
    "html[data-ssc-login] " + F + ":is(:-webkit-autofill,:autofill):focus{",
    "  -webkit-box-shadow:0 0 0 1000px var(--ssc-login-field) inset,0 0 0 4px color-mix(in srgb,var(--ssc-accent) 30%,transparent) !important;",
    "  box-shadow:0 0 0 1000px var(--ssc-login-field) inset,0 0 0 4px color-mix(in srgb,var(--ssc-accent) 30%,transparent) !important;}",
    "html[data-ssc-login] " + F + "::placeholder{color:color-mix(in srgb,var(--ssc-text) 58%,transparent) !important;",
    "  -webkit-text-fill-color:color-mix(in srgb,var(--ssc-text) 58%,transparent) !important;opacity:1 !important;}",
    // Whatever wraps a field draws no box of its own: the field is the box.
    "html[data-ssc-login] .login-app :is(div,span,label,fieldset):has(> " + F + "){",
    "  background:transparent !important;border:0 !important;box-shadow:none !important;outline:none !important;}",
    // The floating label sits on the field: the field's own text colour, softer.
    "html[data-ssc-login] :is(#ssc-login-field,.float-label__label,.float-label label){",
    "  color:color-mix(in srgb,var(--ssc-text) 72%,transparent) !important;",
    "  -webkit-text-fill-color:color-mix(in srgb,var(--ssc-text) 72%,transparent) !important;",
    "  background-color:transparent !important;text-shadow:none !important;z-index:1;}",

    // The sign-in button: the accent, with whichever ink reads on it
    // (--ssc-login-on-accent, measured in preload.js).
    "html[data-ssc-login] :is(.smscButton.blue,button[type='submit'],input[type='submit']){",
    "  min-height:48px;border-radius:999px !important;border:0 !important;font-weight:700 !important;",
    "  background:var(--ssc-accent) !important;color:var(--ssc-login-on-accent,#fff) !important;",
    "  -webkit-text-fill-color:var(--ssc-login-on-accent,#fff) !important;text-shadow:none !important;",
    "  box-shadow:0 10px 24px -10px var(--ssc-accent) !important;transition:transform .15s ease,box-shadow .15s ease,filter .15s ease;}",
    "html[data-ssc-login] :is(.smscButton.blue,button[type='submit'],input[type='submit']):hover{",
    "  transform:translateY(-1px);filter:brightness(1.06);box-shadow:0 14px 30px -10px var(--ssc-accent) !important;}",
    // Other sign-in routes (Microsoft, Google, itsme…) stay, quieter.
    "html[data-ssc-login] .smscButton:not(.blue){border-radius:999px !important;background-color:color-mix(in srgb,var(--ssc-base02) 80%,transparent) !important;",
    "  color:var(--ssc-text) !important;border:1px solid color-mix(in srgb,var(--ssc-text) 16%,transparent) !important;}",
    // Each route as a full-width pill: the brand logo (Smartschool's own 16px icon) next to the name, centred together.
    "html[data-ssc-login] a.smscButton:not(.blue){display:flex !important;align-items:center !important;justify-content:center !important;gap:10px !important;",
    "  box-sizing:border-box !important;width:100% !important;min-height:44px !important;margin:8px 0 0 !important;padding:0 18px !important;",
    "  font-weight:600 !important;text-decoration:none !important;transition:background-color .15s ease,transform .15s ease;}",
    "html[data-ssc-login] a.smscButton:not(.blue):hover{background-color:var(--ssc-base02) !important;transform:translateY(-1px);}",
    "html[data-ssc-login] .login-app__button-icon{flex:none !important;float:none !important;width:18px !important;height:18px !important;min-width:18px !important;",
    "  background-size:18px 18px !important;background-repeat:no-repeat !important;background-position:center !important;opacity:1 !important;}",
    "html[data-ssc-login] .login-app__button-icon + span{flex:none !important;}",
    "html[data-ssc-login] .login-app__title--sign-in-with{display:block !important;text-align:center !important;margin:6px 0 2px !important;font-size:13px !important;",
    "  color:color-mix(in srgb,var(--ssc-text) 64%,transparent) !important;}",
    "html[data-ssc-login] :is(.smscButton,button,input[type='submit']):focus-visible{",
    "  outline:2px solid var(--ssc-accent) !important;outline-offset:3px !important;}",
    "/* Floating labels, one layout of ours. Smartschool's own offsets assume its box and fight ours:",
    "   the label fell below the field, collided with the border, and its placeholder showed through twice.",
    "   The label lives inside the field; it rises when the field is focused or filled (required + :valid,",
    "   like Smartschool, plus autofill). The placeholder is hidden: the label is the hint. */",
    "html[data-ssc-login] .login-app .float-label{position:relative !important;display:block !important;margin:14px 0 !important;padding:0 !important;height:auto !important;}",
    "html[data-ssc-login] .login-app .float-label " + F + "{height:56px !important;min-height:56px !important;width:100% !important;margin:0 !important;padding:22px 16px 6px !important;line-height:1.2 !important;}",
    "html[data-ssc-login] .login-app .float-label " + F + "::placeholder{color:transparent !important;-webkit-text-fill-color:transparent !important;opacity:0 !important;}",
    "html[data-ssc-login] .login-app .float-label :is(label,.float-label__label){position:absolute !important;left:17px !important;right:17px !important;top:0 !important;bottom:auto !important;",
    "  height:56px !important;margin:0 !important;padding:0 !important;display:flex !important;align-items:center !important;pointer-events:none !important;",
    "  font:500 15px/1 system-ui,-apple-system,'Segoe UI',sans-serif !important;letter-spacing:-0.011em !important;white-space:nowrap;transform-origin:left center;",
    "  transition:transform .28s cubic-bezier(0.175,0.885,0.32,1.275),color .2s ease !important;}",
    "html[data-ssc-login] .login-app .float-label :is(label,.float-label__label) > span{position:static !important;display:inline !important;top:auto !important;left:auto !important;",
    "  margin:0 !important;padding:0 !important;font:inherit !important;color:inherit !important;-webkit-text-fill-color:currentColor !important;transform:none !important;transition:none !important;}",
    "html[data-ssc-login] .login-app .float-label :is(input:focus,input:valid,input:-webkit-autofill,input:autofill) ~ :is(label,.float-label__label){",
    "  transform:translateY(-14px) scale(.76) !important;color:color-mix(in srgb,var(--ssc-text) 62%,transparent) !important;}",
    "html[data-ssc-login] .login-app .float-label input:focus ~ :is(label,.float-label__label){color:var(--ssc-accent) !important;-webkit-text-fill-color:var(--ssc-accent) !important;}",
    "@media (prefers-reduced-motion:reduce){html[data-ssc-login] .login-app .float-label :is(label,.float-label__label){transition:none !important;}}",
  ].join("\n");

  /** "#fff" or "#111", whichever reads on the given colour (any CSS colour). */
  function inkFor(color) {
    try {
      var canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      var g = canvas.getContext("2d");
      g.fillStyle = "#808080";
      g.fillStyle = String(color);
      g.fillRect(0, 0, 1, 1);
      var p = g.getImageData(0, 0, 1, 1).data;
      var lin = function (c) {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      var lum = 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
      // Contrast against white vs against near-black: take the larger.
      return 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.06 ? "#fff" : "#111";
    } catch (e) {
      return "#fff";
    }
  }

  function greeting() {
    var hour = new Date().getHours();
    return hour < 6 ? "Goedenacht" : hour < 12 ? "Goedemorgen" : hour < 18 ? "Goedemiddag" : "Goedenavond";
  }

  /** Puts the sign-in sheet up. Safe to call again once the theme arrives. */
  function applyLoginTheme(boot) {
    if (!root.hasAttribute("data-ssc-login")) root.setAttribute("data-ssc-login", "1");
    root.style.setProperty("--ssc-login-greeting", JSON.stringify(greeting()));
    try {
      root.style.setProperty("--ssc-login-logo", 'url("' + chrome.runtime.getURL("assets/icons/logo.svg") + '")');
    } catch (e) {
      /* No logo: the greeting still sits above the title. */
    }
    var accent = (boot && boot.active && boot.vars && boot.vars["--ssc-accent"]) || "";
    if (!accent) {
      var dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      accent = dark ? "#8b97ff" : "#4f5bd5";
    }
    root.style.setProperty("--ssc-login-on-accent", inkFor(accent));
    if (document.getElementById(LOGIN_STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = LOGIN_STYLE_ID;
    style.textContent = LOGIN_CSS;
    root.appendChild(style);
  }

  /*
   * The user's own wallpaper on the sign-in page. layout.js does not run
   * here (guard.js), so an uploaded image, GIF or video would never show:
   * the boot snapshot only carries a video's still, and an uploaded image
   * has none. The file is read from the same IndexedDB (this page has the
   * school's origin, like every other Smartschool page) and drawn by a
   * fixed layer at z-index -1, under the glass card, exactly like
   * layout.js's live layer. Performance mode keeps the still only.
   */
  var LOGIN_WALL_ID = "ssc-login-wallpaper";

  function mountLoginWallpaper(boot, settings) {
    if (!boot || !boot.active || !boot.live || document.getElementById(LOGIN_WALL_ID)) return;
    var wanted = settings && typeof settings.backgroundUrl === "string" ? settings.backgroundUrl : "";
    if (wanted && wanted.indexOf("ssc-media:") !== 0 && !/\.(mp4|webm|m4v|gif)(?:[?#]|$)/i.test(wanted)) return;
    var still = !!(settings && settings.performanceMode);

    function show(src, kind) {
      var host = document.createElement("div");
      host.id = LOGIN_WALL_ID;
      host.setAttribute("aria-hidden", "true");
      host.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;overflow:hidden;";
      var shadow = host.attachShadow({ mode: "open" });
      var style = document.createElement("style");
      style.textContent =
        ":host{all:initial;}" +
        ".m{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;opacity:0;transition:opacity .7s ease;}" +
        ".m[data-ready]{opacity:1;}";
      shadow.appendChild(style);
      var media;
      if (kind === "video") {
        if (still) return;
        media = document.createElement("video");
        media.muted = true;
        media.defaultMuted = true;
        media.loop = true;
        media.playsInline = true;
        media.autoplay = !document.hidden;
        media.setAttribute("muted", "");
        media.setAttribute("playsinline", "");
        media.addEventListener("loadeddata", function () {
          media.setAttribute("data-ready", "1");
        }, { once: true });
        document.addEventListener("visibilitychange", function () {
          if (document.hidden) media.pause();
          else {
            var p = media.play();
            if (p && p.catch) p.catch(function () {});
          }
        });
      } else {
        media = document.createElement("img");
        media.alt = "";
        media.decoding = "async";
        media.addEventListener("load", function () {
          media.setAttribute("data-ready", "1");
        }, { once: true });
      }
      media.className = "m";
      media.src = src;
      shadow.appendChild(media);
      root.setAttribute("data-ssc-theme-has-bg", "1");
      root.appendChild(host);
    }

    // A video or GIF by URL needs no database.
    if (wanted && wanted.indexOf("ssc-media:") !== 0) {
      show(wanted, /\.gif(?:[?#]|$)/i.test(wanted) ? "gif" : "video");
      return;
    }
    try {
      var req = indexedDB.open("ssc-wallpaper", 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore("media");
      };
      req.onsuccess = function () {
        var db = req.result;
        try {
          var get = db.transaction("media", "readonly").objectStore("media").get("current");
          get.onsuccess = function () {
            db.close();
            var blob = get.result;
            if (!blob || !blob.type) return;
            show(URL.createObjectURL(blob), /^video\//.test(blob.type) ? "video" : "image");
          };
          get.onerror = function () {
            db.close();
          };
        } catch (e) {
          db.close();
        }
      };
    } catch (e) {
      /* No database: the theme's still or colours stay. */
    }
  }

  // Up before Smartschool paints, so its big photograph never shows; the
  // theme's colours follow as soon as storage answers.
  if (onLogin) applyLoginTheme(null);

  /* ---------- 1. the theme, from layout.js's last snapshot ---------- */

  function applyBootTheme(boot) {
    // layout.js already ran (an extension reload on an open page): its
    // values are the real ones.
    if (!boot || !boot.active || !boot.vars || root.hasAttribute("data-ssc-theme")) return;
    Object.keys(boot.vars).forEach(function (k) {
      if (/^--ssc-[\w-]+$/.test(k)) root.style.setProperty(k, String(boot.vars[k]));
    });
    if (boot.background) {
      root.style.setProperty("background-image", 'url("' + String(boot.background).replace(/["\\]/g, "") + '")');
      root.style.setProperty("background-size", "cover");
      root.style.setProperty("background-position", "center");
      root.style.setProperty("background-attachment", "fixed");
      root.style.setProperty("background-repeat", "no-repeat");
      root.style.setProperty("--background-color", "transparent");
      root.setAttribute("data-ssc-theme-has-bg", "1");
    } else if (boot.live) {
      // Live wallpaper without a captured still yet: the surfaces go
      // see-through now, layout.js mounts the video behind them.
      root.style.setProperty("--background-color", "transparent");
      root.setAttribute("data-ssc-theme-has-bg", "1");
    }
    root.setAttribute("data-ssc-theme", "1");
  }

  try {
    chrome.storage.local.get(["sscThemeBoot", "sscSettings"], function (res) {
      applyBootTheme(res && res.sscThemeBoot);
      if (onLogin) {
        applyLoginTheme(res && res.sscThemeBoot);
        mountLoginWallpaper(res && res.sscThemeBoot, res && res.sscSettings);
      }
      // With the reveal switched off there is nothing to wait for.
      var s = res && res.sscSettings;
      if (wantCover && s && s.cutsceneAuto === false) sscPreloadDone();
    });
  } catch (e) {
    /* Storage unavailable: layout.js themes the page, the walkout or the
       failsafe lifts the cover. */
  }

  if (!onLogin) {
    document.addEventListener("DOMContentLoaded", function () {
      if (!document.querySelector(".login-app")) return;
      onLogin = true;
      try {
        chrome.storage.local.get(["sscThemeBoot", "sscSettings"], function (res) {
          applyLoginTheme(res && res.sscThemeBoot);
          mountLoginWallpaper(res && res.sscThemeBoot, res && res.sscSettings);
        });
      } catch (e) {
        applyLoginTheme(null);
      }
    }, { once: true });
  }

  /* ---------- 2. the Resultaten cover ---------- */

  if (!wantCover) {
    window.sscPreloadDone = function () {};
    window.sscPreloadHold = function () {};
    return;
  }

  var timer = 0;
  var done = false;

  var CSS = [
    "html[" + ATTR + "] body{overflow:hidden !important;}",
    "html[" + ATTR + "] main,",
    "html[" + ATTR + "] table,",
    "html[" + ATTR + "] [class*='evaluation'],",
    "html[" + ATTR + "] [class*='grade'],",
    "html[" + ATTR + "] [class*='result']{",
    "  filter:blur(30px) !important;opacity:0 !important;",
    "}",
    "#" + COVER_ID + "{",
    "  position:fixed;inset:0;z-index:" + COVER_Z + ";",
    "  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;",
    "  background:var(--ssc-base00,#0f1720);color:var(--ssc-text,#eef3f8);",
    "  font:600 17px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;",
    "  transition:opacity 260ms ease;",
    "}",
    "#" + COVER_ID + "[data-out]{opacity:0;pointer-events:none;}",
    "#" + COVER_ID + " img{width:72px;height:72px;animation:ssc-preload-pulse 1.6s ease-in-out infinite;}",
    "@keyframes ssc-preload-pulse{50%{transform:scale(1.06);filter:drop-shadow(0 0 14px rgba(244,205,107,.45));}}",
    "#" + COVER_ID + " i{",
    "  width:42px;height:42px;border-radius:50%;",
    "  border:3px solid rgba(255,255,255,.18);border-top-color:var(--ssc-accent,#46c37b);",
    "  animation:ssc-preload-spin .85s linear infinite;",
    "}",
    "@keyframes ssc-preload-spin{to{transform:rotate(360deg);}}",
    "@media (prefers-reduced-motion:reduce){#" + COVER_ID + " i{animation-duration:2.4s;}#" + COVER_ID + " img{animation:none;}}",
  ].join("\n");

  function mount() {
    root.setAttribute(ATTR, "1");
    if (!document.getElementById(STYLE_ID)) {
      var style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      root.appendChild(style);
    }
    if (!document.getElementById(COVER_ID)) {
      var cover = document.createElement("div");
      cover.id = COVER_ID;
      cover.setAttribute("role", "status");
      cover.setAttribute("aria-live", "polite");
      try {
        var logo = document.createElement("img");
        logo.alt = "";
        logo.src = chrome.runtime.getURL("assets/icons/logo.svg");
        cover.appendChild(logo);
      } catch (e) {
        /* No logo, still a cover. */
      }
      cover.appendChild(document.createElement("i"));
      cover.appendChild(document.createTextNode("Cijfers laden…"));
      root.appendChild(cover);
    }
  }

  /**
   * Lifts the cover. `delay` lets the caller keep it up a little longer, for
   * example until the first cutscene is on screen.
   */
  function sscPreloadDone(delay) {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    window.setTimeout(function () {
      var cover = document.getElementById(COVER_ID);
      root.removeAttribute(ATTR);
      if (cover) cover.setAttribute("data-out", "1");
      window.setTimeout(function () {
        var c = document.getElementById(COVER_ID);
        var s = document.getElementById(STYLE_ID);
        if (c) c.remove();
        if (s) s.remove();
      }, 300);
    }, Math.max(0, Number(delay) || 0));
  }

  mount();
  window.sscPreloadDone = sscPreloadDone;
  // The reveal queue can take longer than the failsafe; walkout.js pauses
  // it while cards are playing and lifts the cover itself at the end.
  window.sscPreloadHold = function () {
    window.clearTimeout(timer);
  };
  timer = window.setTimeout(sscPreloadDone, FAILSAFE_MS);

  // Smartschool replaces nodes while it boots; put ours back if they go.
  if (typeof MutationObserver === "function") {
    var mo = new MutationObserver(function () {
      if (done) return mo.disconnect();
      if (!document.getElementById(COVER_ID) || !root.hasAttribute(ATTR)) mount();
    });
    mo.observe(root, { childList: true, attributes: true, attributeFilter: [ATTR] });
  }

})();
