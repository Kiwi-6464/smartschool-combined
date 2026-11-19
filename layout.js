/**
 * Smartschool Combined — layout.
 *
 * Page zoom, hiding elements, custom CSS and theming.
 *
 * THE THEME LAYER IS NOT WRITTEN HERE ANY MORE. Every paint rule lives in
 * themes.css, which is Smartschool++'s own stylesheet copied verbatim
 * with `--color-` renamed to `--ssc-`. This file only:
 *   - writes the nine palette variables smpp's themes.json defines;
 *   - writes the two body classes smpp's stylesheet keys off;
 *   - puts the theme photograph on `html` and sets `--background-color`;
 *   - applies page zoom, the user's hide selectors and their custom CSS.
 *
 * Two hard rules, both learned the hard way:
 *   1. Never write Smartschool's own CSS variables. They live on `html`
 *      (--color-base00 etc.) and their component framework reads them;
 *      overwriting them throws "Unable to render component because its
 *      element is undefined". We only ever write --ssc-* plus smpp's two
 *      unprefixed names.
 *   2. The only !important in this file is `display:none` for selectors the
 *      USER typed into the hide box, which CLAUDE.md allows explicitly.
 */
(function () {
  "use strict";

  // Sign-in pages: do nothing at all (see guard.js).
  if (window.sscSkipPage) return;

  if (window.sscApplyLayout) return;

  var HIDE_STYLE_ID = "ssc-hide-style";
  var CUSTOM_STYLE_ID = "ssc-custom-style";
  var THEME_STYLE_ID = "ssc-theme-style";
  var ZOOM_ATTR = "data-ssc-zoom";
  var THEME_ATTR = "data-ssc-theme";
  var BG_ATTR = "data-ssc-theme-has-bg";

  /* ---------- style tags on documentElement, never body ---------- */

  function ensureStyle(id) {
    var existing = document.getElementById(id);
    if (existing) return existing;
    var style = document.createElement("style");
    style.id = id;
    document.documentElement.appendChild(style);
    return style;
  }

  /* ---------- page zoom ---------- */

  /**
   * CLAUDE.md forbids `html { zoom }`. The body is scaled from the top-left
   * and its width compensated so no gap appears on the right.
   *
   * The shadow host lives on documentElement, outside body, so the panel is
   * unaffected at any zoom level.
   */
  function applyZoom(percent) {
    var body = document.body;
    if (!body) return;

    var pct = Number(percent);
    if (!isFinite(pct)) pct = 100;
    if (pct < 70) pct = 70;
    if (pct > 150) pct = 150;

    /*
     * At 100% the body must be COMPLETELY untouched — not even assigned an
     * empty string. Smartschool's renderer measures elements, and writing an
     * empty inline transform still changes computed style from "none" to
     * "none" via a different path, which is enough to invalidate its cache.
     *
     * So the only write at 100% is a cleanup, and only if a scale was
     * actually applied earlier (i.e. the user had zoomed and came back).
     */
    if (pct === 100) {
      if (body.style.transform !== "" || body.style.width !== "") {
        body.style.transform = "";
        body.style.transformOrigin = "";
        body.style.width = "";
        body.style.minHeight = "";
      }
      document.documentElement.removeAttribute(ZOOM_ATTR);
      return;
    }

    var scale = pct / 100;
    body.style.transformOrigin = "top left";
    body.style.transform = "scale(" + scale + ")";
    body.style.width = 100 / scale + "%";
    body.style.minHeight = 100 / scale + "vh";
    document.documentElement.setAttribute(ZOOM_ATTR, String(pct));
  }

  /* ---------- hide selectors ---------- */

  function splitSelectors(raw) {
    if (!raw) return [];
    var out = [];
    var parts = String(raw).split("\n");
    for (var i = 0; i < parts.length; i++) {
      var line = parts[i].trim();
      if (line) out.push(line);
    }
    return out;
  }

  /**
   * The one sanctioned !important: the user asked for these to disappear.
   * Written per-selector so a single malformed line cannot take the whole
   * sheet down.
   */
  function applyHide(rawSelectors) {
    var style = ensureStyle(HIDE_STYLE_ID);
    var selectors = splitSelectors(rawSelectors);

    if (!selectors.length) {
      style.textContent = "";
      document.documentElement.removeAttribute("data-ssc-hide");
      return;
    }

    var css = [];
    for (var i = 0; i < selectors.length; i++) {
      css.push(selectors[i] + " { display: none !important; }");
    }
    style.textContent = css.join("\n");
    document.documentElement.setAttribute("data-ssc-hide", "1");
  }

  /* ---------- custom css ---------- */

  function applyCustomCss(rawCss) {
    var style = ensureStyle(CUSTOM_STYLE_ID);
    style.textContent = rawCss || "";
  }

  /* ---------- theme variables ---------- */

  /**
   * The nine variables smpp's themes.json defines. themes.css is smpp's
   * own stylesheet with `--color-` renamed to `--ssc-`, so these are the only
   * names it expects from us — no more, no fewer. `--darken-background` is
   * smpp's own unprefixed name and stays unprefixed in both files.
   */
  var THEME_VARS = [
    "--ssc-base00",
    "--ssc-base01",
    "--ssc-base02",
    "--ssc-base03",
    "--ssc-text",
    "--ssc-accent",
    "--ssc-homepage-sidebars-bg",
    "--ssc-splashtext",
    "--darken-background",
    "--ssc-scrim",
  ];

  /**
   * One write per theme switch. The sheet reads them back out; nothing is
   * baked into a rule, so a palette change never rebuilds any CSS.
   */
  function applyThemeCssVars(cssProperties) {
    var root = document.documentElement;
    if (!cssProperties) return;
    for (var i = 0; i < THEME_VARS.length; i++) {
      var key = THEME_VARS[i];
      var value = cssProperties[key];
      if (typeof value === "string" && value) root.style.setProperty(key, value);
    }
  }

  /**
   * "Default (geen thema)".
   *
   * themes.css is injected by the manifest, so it is always in the page
   * and it declares its own fallbacks on `html` (a near-black base00 among
   * them). Removing our inline variables would therefore hand the page to
   * those fallbacks instead of to Smartschool.
   *
   * Setting each one to `initial` is the standard way to switch a custom
   * property off: the inline declaration wins the cascade, the property
   * becomes the guaranteed-invalid value, and every `var()` that reads it
   * makes its declaration invalid — which computes to "unset". The sheet is
   * still there, but it paints nothing.
   */
  function clearThemeCssVars() {
    var root = document.documentElement;
    for (var i = 0; i < THEME_VARS.length; i++) {
      root.style.setProperty(THEME_VARS[i], "initial");
    }
    // Set only while a photograph is behind the page (see below).
    root.style.removeProperty("--background-color");
  }

  /* ---------- custom themes ---------- */

  /**
   * The builder's five colours mapped onto the nine smpp names. Two of them
   * are reused rather than asking the user for colours smpp's builder does
   * not ask for either.
   */
  function customThemeToCss(theme) {
    if (!theme) return null;
    return {
      "--ssc-base00": theme.bg || "#141414",
      "--ssc-base01": theme.card || "#1f1f1f",
      "--ssc-base02": theme.card || "#2c2c2c",
      "--ssc-base03": theme.border || "#383838",
      "--ssc-text": theme.text || "#e8e8e8",
      "--ssc-accent": theme.accent || "#3ba37a",
      "--ssc-homepage-sidebars-bg": theme.card || "#1f1f1f",
      "--ssc-splashtext": theme.text || "#e8e8e8",
      "--darken-background": theme.border || "#383838",
    };
  }

  /* ---------- theme background ---------- */

  /**
   * smpp puts the photograph in an absolutely positioned, z-index:-1 element
   * on `body` (background-image.ts) and then sets `--background-color:
   * transparent`, which general.css uses for `#content-container` and
   * `#modal-content`. That single variable is the whole mechanism: the page
   * surfaces go see-through, the cards stay opaque.
   *
   * We keep the variable and put the image on `html` instead of inserting an
   * element into Smartschool's DOM. Same paint order — the html background
   * is the canvas, behind body and everything in it.
   */
  function applyThemeBackground(background, live) {
    var root = document.documentElement;
    if (!background && live) {
      // A live wallpaper with no still yet: the surfaces still go
      // see-through, the video layer behind them is the picture.
      root.style.removeProperty("background-image");
      root.style.setProperty("--background-color", "transparent");
      root.setAttribute(BG_ATTR, "1");
      return;
    }
    if (!background) {
      root.style.removeProperty("background-image");
      root.style.removeProperty("background-size");
      root.style.removeProperty("background-position");
      root.style.removeProperty("background-attachment");
      root.style.removeProperty("background-repeat");
      // Back to general.css's `--background-color: var(--color-base00)`.
      root.style.removeProperty("--background-color");
      root.removeAttribute(BG_ATTR);
      return;
    }
    root.style.setProperty("background-image", 'url("' + background + '")');
    root.style.setProperty("background-size", "cover");
    root.style.setProperty("background-position", "center");
    root.style.setProperty("background-attachment", "fixed");
    root.style.setProperty("background-repeat", "no-repeat");
    // smpp: the page surfaces go transparent so the photograph shows through,
    // while .tile and the dialogs stay solid base01.
    root.style.setProperty("--background-color", "transparent");
    root.setAttribute(BG_ATTR, "1");
    // Warm the cache so switching themes does not flash the colour layer
    // while the photograph decodes.
    preloadImage(background);
  }

  /**
   * Applies the theme's two body-level switches the way smpp applies them
   * (main.ts): `ssc-glass` turns the .ssc-glass rules on, `ssc-topbar-transparent`
   * is the exact class navigation.css:30 keys off. Without these two classes
   * a third of the ported stylesheet is dormant.
   *
   * Whatever a previous build of this extension wrote into #ssc-theme-style
   * is cleared first: an extension reload re-injects this script into pages
   * that still carry the old sheet, and two paint layers is exactly the
   * "patchy corners" symptom.
   */
  function applyTheme(active, settings, background, live) {
    var root = document.documentElement;
    var body = document.body;

    var stale = document.getElementById(THEME_STYLE_ID);
    if (stale) stale.textContent = "";

    if (body && body.classList) {
      if (settings && settings.glass) body.classList.add("ssc-glass");
      else body.classList.remove("ssc-glass");
      // smpp main.ts:294 — animations are on unless performance mode is.
      // Every `.ssc-anim …` rule in themes.css keys off this.
      if (settings && settings.performanceMode) body.classList.remove("ssc-anim");
      else body.classList.add("ssc-anim");
      if (settings && settings.topbarTransparent) body.classList.add("ssc-topbar-transparent");
      else body.classList.remove("ssc-topbar-transparent");
    }

    if (!active) {
      root.removeAttribute(THEME_ATTR);
      applyThemeBackground("");
      return;
    }
    root.setAttribute(THEME_ATTR, "1");
    applyThemeBackground(background, live);
  }

  var preloaded = {};

  function preloadImage(url) {
    if (!url || preloaded[url]) return;
    preloaded[url] = true;
    try {
      var img = new Image();
      img.src = url;
    } catch (e) {
      /* Decoding is an optimisation; never let it break the theme. */
    }
  }

  /* ---------- live wallpaper (video / GIF / uploaded file) ---------- */

  /*
   * Uploaded wallpapers are Blobs in IndexedDB, not data URLs in
   * chrome.storage: no base64 inflation, no 10 MB quota, and the settings
   * object (read on every page) stays small. The setting itself only holds
   * "ssc-media:<stamp>"; the stamp changes on every upload so an open tab
   * notices the new file.
   *
   * A video or GIF is drawn by a fixed layer on documentElement at
   * z-index -1: above the html canvas, below every Smartschool surface,
   * which a theme makes see-through. It lives in its own shadow root so the
   * page's CSS cannot touch the <video>. A JPEG still of the first frame is
   * kept in chrome.storage, so the next page paints it at document_start
   * (preload.js) instead of flashing the theme colour while the video loads.
   */
  var MEDIA_PREFIX = "ssc-media:";
  var IDB_NAME = "ssc-wallpaper";
  var IDB_STORE = "media";
  var IDB_KEY = "current";
  var POSTER_KEY = "sscWallpaperPoster";
  var LIVE_ID = "ssc-live-wallpaper";

  function idbOpen() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () {
        req.result.createObjectStore(IDB_STORE);
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  function idbRun(mode, fn) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, mode);
        var req = fn(tx.objectStore(IDB_STORE));
        tx.oncomplete = function () {
          db.close();
          resolve(req ? req.result : undefined);
        };
        tx.onerror = tx.onabort = function () {
          db.close();
          reject(tx.error);
        };
      });
    });
  }

  /** "video" | "gif" | "image" for a wallpaper source (URL or MIME type). */
  function mediaKind(urlOrType) {
    var v = String(urlOrType || "").toLowerCase();
    if (/^video\//.test(v) || /^data:video\//.test(v) || /\.(mp4|webm|m4v)(?:[?#]|$)/.test(v)) return "video";
    if (v === "image/gif" || /^data:image\/gif/.test(v) || /\.gif(?:[?#]|$)/.test(v)) return "gif";
    return "image";
  }

  /** True when this wallpaper is drawn by the layer rather than the html background. */
  function isLayerWallpaper(url) {
    if (!url) return false;
    if (url.indexOf(MEDIA_PREFIX) === 0) return true;
    return mediaKind(url) !== "image";
  }

  var poster = { id: "", data: "" };
  var posterLoaded = false;

  function loadPoster() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get([POSTER_KEY], function (res) {
          var p = res && res[POSTER_KEY];
          if (p && typeof p.id === "string" && typeof p.data === "string") poster = p;
          posterLoaded = true;
          resolve();
        });
      } catch (e) {
        posterLoaded = true;
        resolve();
      }
    });
  }

  function savePoster(id, data) {
    poster = { id: id, data: data };
    try {
      var payload = {};
      payload[POSTER_KEY] = poster;
      chrome.storage.local.set(payload);
    } catch (e) {
      /* Only the next page's first paint is affected. */
    }
    // The still is now the backdrop for cutscenes and the next boot.
    if (lastSettings) sscApplyLayout(lastSettings);
  }

  function posterFor(id) {
    return poster.id === id ? poster.data : "";
  }

  /** One frame of the playing video as a small JPEG, or "" if the canvas is tainted. */
  function grabFrame(video) {
    try {
      var w = video.videoWidth;
      var hgt = video.videoHeight;
      if (!w || !hgt) return "";
      var scale = Math.min(1, 1280 / w);
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(hgt * scale);
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.72);
    } catch (e) {
      return "";
    }
  }

  var live = { host: null, shadow: null, id: "", media: null, objectUrl: "", paused: false, token: 0 };

  var LIVE_CSS = [
    ":host{all:initial;}",
    ".frame{position:absolute;inset:0;opacity:0;transition:opacity .7s ease;}",
    ".frame[data-ready]{opacity:1;}",
    "video,img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;}",
    // Blend into the theme: a soft vignette in the theme's own base colour,
    // so the edges meet the page surfaces instead of a hard photo border.
    ".tint{position:absolute;inset:0;pointer-events:none;",
    "  background:radial-gradient(ellipse 80% 75% at 50% 45%,transparent 55%,",
    "    color-mix(in srgb,var(--ssc-base00,#000) 55%,transparent) 100%);}",
  ].join("");

  function ensureLiveHost() {
    if (live.host && live.host.isConnected) return live.host;
    var host = document.getElementById(LIVE_ID);
    if (!host) {
      host = document.createElement("div");
      host.id = LIVE_ID;
      host.setAttribute("aria-hidden", "true");
      host.style.cssText =
        "position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;contain:strict;";
      document.documentElement.appendChild(host);
    }
    live.host = host;
    live.shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    if (!live.shadow.querySelector("style")) {
      var style = document.createElement("style");
      style.textContent = LIVE_CSS;
      live.shadow.appendChild(style);
    }
    return host;
  }

  function releaseObjectUrl() {
    if (live.objectUrl) {
      try {
        URL.revokeObjectURL(live.objectUrl);
      } catch (e) {
        /* nothing to free */
      }
      live.objectUrl = "";
    }
  }

  function hideLive() {
    live.token++;
    live.id = "";
    if (live.media && live.media.tagName === "VIDEO") {
      live.media.pause();
      live.media.removeAttribute("src");
      live.media.load();
    }
    live.media = null;
    releaseObjectUrl();
    if (live.host && live.host.parentNode) live.host.parentNode.removeChild(live.host);
    live.host = null;
    live.shadow = null;
  }

  function resolveSource(id) {
    if (id.indexOf(MEDIA_PREFIX) !== 0) return Promise.resolve({ src: id, kind: mediaKind(id) });
    return idbRun("readonly", function (store) {
      return store.get(IDB_KEY);
    }).then(function (blob) {
      if (!blob) return null;
      releaseObjectUrl();
      live.objectUrl = URL.createObjectURL(blob);
      return { src: live.objectUrl, kind: mediaKind(blob.type) };
    });
  }

  function syncPlayback() {
    var v = live.media;
    if (!v || v.tagName !== "VIDEO") return;
    if (document.hidden || live.paused) v.pause();
    else {
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }
  }

  function showLive(id, settings) {
    // Performance mode keeps the still and does not decode video at all. So do
    // small machines (4 cores or 4 GB or less): decoding a looping video there is
    // what made the page feel laggy, without anyone having to find the switch.
    var weak = (navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    live.paused = !!((settings && settings.performanceMode) || weak);
    if (live.id === id && live.host && live.host.isConnected) {
      syncPlayback();
      return;
    }
    hideLive();
    live.id = id;
    var token = ++live.token;
    resolveSource(id).then(function (source) {
      if (token !== live.token) return;
      if (!source) {
        hideLive();
        return;
      }
      ensureLiveHost();
      var frame = document.createElement("div");
      frame.className = "frame";
      var media;
      if (source.kind === "video") {
        media = document.createElement("video");
        media.muted = true;
        media.defaultMuted = true;
        media.loop = true;
        media.playsInline = true;
        media.autoplay = !live.paused && !document.hidden;
        media.preload = "auto";
        media.setAttribute("muted", "");
        media.setAttribute("playsinline", "");
        var still = posterFor(id);
        if (still) media.poster = still;
        media.addEventListener("loadeddata", function () {
          if (token !== live.token) return;
          frame.setAttribute("data-ready", "1");
          if (!posterFor(id)) {
            var data = grabFrame(media);
            if (data) savePoster(id, data);
          }
        }, { once: true });
        media.addEventListener("error", function () {
          // A blocked or broken file: fall back to the still / theme photo.
          if (token === live.token) hideLive();
        }, { once: true });
        media.src = source.src;
      } else {
        media = document.createElement("img");
        media.alt = "";
        media.decoding = "async";
        media.addEventListener("load", function () {
          if (token === live.token) frame.setAttribute("data-ready", "1");
        }, { once: true });
        media.src = source.src;
      }
      frame.appendChild(media);
      var tint = document.createElement("div");
      tint.className = "tint";
      frame.appendChild(tint);
      live.shadow.appendChild(frame);
      live.media = media;
      syncPlayback();
    }).catch(function () {
      if (token === live.token) hideLive();
    });
  }

  document.addEventListener("visibilitychange", syncPlayback);

  /**
   * For the settings window: store an uploaded file and return the value
   * for settings.backgroundUrl.
   */
  function storeWallpaperFile(file) {
    return idbRun("readwrite", function (store) {
      return store.put(file, IDB_KEY);
    }).then(function () {
      return MEDIA_PREFIX + Date.now().toString(36);
    });
  }

  function clearWallpaperFile() {
    return idbRun("readwrite", function (store) {
      return store.delete(IDB_KEY);
    }).catch(function () {});
  }

  /** A preview URL + kind for any wallpaper value (caller revokes blob: URLs). */
  function previewWallpaper(url) {
    if (!url) return Promise.resolve(null);
    if (url.indexOf(MEDIA_PREFIX) !== 0) return Promise.resolve({ src: url, kind: mediaKind(url), blob: false });
    return idbRun("readonly", function (store) {
      return store.get(IDB_KEY);
    }).then(function (blob) {
      if (!blob) return null;
      return { src: URL.createObjectURL(blob), kind: mediaKind(blob.type), blob: true, size: blob.size, name: blob.name || "" };
    });
  }

  window.sscWallpaper = {
    store: storeWallpaperFile,
    clear: clearWallpaperFile,
    preview: previewWallpaper,
    kind: mediaKind,
    isLive: isLayerWallpaper,
  };

  /* ---------- topbar paint neutraliser ---------- */

  /**
   * The scan is gone on purpose.
   *
   * It used to walk every node in the bar and rewrite its resolved
   * background. That is what hid the icons: a glyph painted on its own
   * coloured box loses its contrast the moment the box is repainted, and a
   * `background-image` sprite loses it entirely when the image is blanked.
   * The bar's one colour is now a CSS rule on the bar itself; nothing inside
   * it is repainted. `restoreTopbarPaint` is kept so a build that had already
   * painted something puts it back on the next apply.
   */
  var PAINT_ATTR = "data-ssc-paint";
  var paintSaved = [];

  function restoreTopbarPaint() {
    for (var i = 0; i < paintSaved.length; i++) {
      var rec = paintSaved[i];
      var el = rec.el;
      if (!el || !el.style) continue;
      el.style.removeProperty("background-color");
      el.style.removeProperty("background-image");
      if (rec.colour) el.style.setProperty("background-color", rec.colour, rec.colourPrio);
      if (rec.image) el.style.setProperty("background-image", rec.image, rec.imagePrio);
      el.removeAttribute(PAINT_ATTR);
    }
    paintSaved = [];

    /*
     * The list above is memory, and memory dies with the page. What the old
     * scan WROTE does not: an extension reload re-injects this script into
     * the page it left behind, so those elements still carry an inline
     * background — which is what blanks a glyph or a sprite icon while the
     * button around it renders perfectly. The marker attribute is the only
     * record left, so sweep the DOM for it.
     */
    var marked;
    try {
      marked = document.querySelectorAll("[" + PAINT_ATTR + "]");
    } catch (e) {
      return;
    }
    for (var j = 0; j < marked.length; j++) {
      var node = marked[j];
      if (!node || !node.style) continue;
      node.style.removeProperty("background-color");
      node.style.removeProperty("background-image");
      node.removeAttribute(PAINT_ATTR);
    }
  }

  /* ---------- no runtime surface audit ---------- */
  //
  // There used to be one here: a walk over the content stack that glassed
  // anything painting an opaque fill, with a ring/frame clause and a 16x16
  // size floor. It produced the dark square inside a result circle, the
  // blurred "Ga naar" overlay and a repainted navigation — every one of them
  // a false positive.
  //
  // smpp has no equivalent. It fixes each surface with a named selector and
  // leaves everything else alone, which is the only approach that survives a
  // renderer whose class names change per page. Deleted rather than tuned.
  //
  // What is left of the old machinery is `restoreTopbarPaint` above, which
  // only exists to undo what an earlier build wrote into the page.

  /* ---------- single entry point ---------- */

  /**
   * What preload.js needs to paint the theme at document_start, before this
   * file runs: the palette, the photograph and whether a theme is on at all.
   * Written only when it changes, so applying settings on every keystroke
   * in the panel costs no storage write.
   */
  var BOOT_KEY = "sscThemeBoot";
  var lastBoot = "";

  function saveBootSnapshot(cssProperties, background, isLive) {
    var vars = {};
    if (cssProperties) {
      for (var i = 0; i < THEME_VARS.length; i++) {
        var v = cssProperties[THEME_VARS[i]];
        if (typeof v === "string" && v) vars[THEME_VARS[i]] = v;
      }
    }
    var boot = { active: !!cssProperties, vars: vars, background: background || "", live: !!isLive };
    var json = JSON.stringify(boot);
    if (json === lastBoot) return;
    lastBoot = json;
    try {
      var payload = {};
      payload[BOOT_KEY] = boot;
      chrome.storage.local.set(payload);
    } catch (e) {
      /* The next page load just paints a little later. */
    }
  }

  var lastSettings = null;

  function sscApplyLayout(settings) {
    if (!settings) return;
    lastSettings = settings;

    applyZoom(settings.pageZoom);

    var chosenCss = null;
    var themeId = settings.theme;

    if (themeId && themeId !== "default" && window.SSC_THEMES) {
      var builtin = window.SSC_THEMES[themeId];
      if (builtin && builtin.css) chosenCss = builtin.css;
    }

    if (!chosenCss && themeId === "custom" && settings.customThemes) {
      for (var i = 0; i < settings.customThemes.length; i++) {
        if (settings.customThemes[i].id === settings.customThemeId) {
          chosenCss = customThemeToCss(settings.customThemes[i]);
          break;
        }
      }
    }

    if (chosenCss) {
      applyThemeCssVars(chosenCss);
    } else {
      clearThemeCssVars();
    }

    // Backgrounds only exist for the built-in palettes; a custom theme has
    // colours only, and gets the gradient layer.
    var background = "";
    if (chosenCss && themeId !== "custom" && typeof window.sscThemeBackground === "function") {
      background = window.sscThemeBackground(themeId);
    }
    // Wallpaper (settings → Uiterlijk): the user's own image replaces the
    // theme photo. Like smpp it needs a theme: only a theme turns the page
    // surfaces see-through, so on Smartschool's own colours it would sit
    // behind opaque cards and never show.
    if (chosenCss && settings.backgroundUrl) background = String(settings.backgroundUrl);

    // A video, GIF or uploaded file is drawn by the live layer; the html
    // background then only carries its still (once one was captured).
    var liveId = chosenCss && isLayerWallpaper(background) ? background : "";
    if (liveId) background = posterFor(liveId);

    // Published for the cutscenes (backdrop.js). They start inside a click
    // handler and cannot await storage without losing the user gesture.
    window.sscThemeState = {
      theme: themeId || "default",
      background: background,
      active: !!chosenCss,
    };

    applyTheme(!!chosenCss, settings, background, !!liveId);
    if (liveId) showLive(liveId, settings);
    else hideLive();
    // Without the stored still the boot snapshot would wipe a good one.
    if (posterLoaded) saveBootSnapshot(chosenCss, background, !!liveId);


    // No scan, no observer: the sheet is the whole fix. Paint written by an
    // earlier build of this extension is the one thing that has to be undone,
    // and it has to be undone whether or not a theme is chosen — an inline
    // background hiding a glyph is wrong on Smartschool's own colours too.
    restoreTopbarPaint();

    applyHide(settings.hideSelectors);
    applyCustomCss(settings.customCss);
    applyCustomName(settings.customName);
  }

  /* ---------- eigen naam (settings → Profiel) ---------- */

  /*
   * smpp profile.ts displayUsernameTopNav: the name in the top bar is the
   * span inside `.js-btn-profile .hlp-vert-box`. The original text is kept on
   * the node so clearing the field puts Smartschool's own name back.
   * Written only when it differs: the topbar observer calls this on every
   * re-render, and an unchanged write must not cause a mutation.
   */
  var NAME_SELECTOR = ".js-btn-profile .hlp-vert-box span";
  var lastCustomName = "";

  function applyCustomName(name) {
    if (typeof name === "string") lastCustomName = name.trim();
    var node = document.querySelector(NAME_SELECTOR);
    if (!node) return;
    if (!node.hasAttribute("data-ssc-orig-name")) {
      node.setAttribute("data-ssc-orig-name", node.textContent || "");
    }
    var wanted = lastCustomName || node.getAttribute("data-ssc-orig-name") || "";
    if (node.textContent !== wanted) node.textContent = wanted;
  }

  /** Smartschool's own name, even while a custom one is showing. */
  function originalName() {
    var node = document.querySelector(NAME_SELECTOR);
    if (!node) return "";
    return node.getAttribute("data-ssc-orig-name") || node.textContent || "";
  }

  window.sscApplyCustomName = applyCustomName;
  window.sscOriginalName = originalName;
  window.sscApplyLayout = sscApplyLayout;
  window.sscApplyZoom = applyZoom;
  window.sscApplyHide = applyHide;
  window.sscApplyCustomCss = applyCustomCss;
  window.sscCustomThemeToCss = customThemeToCss;

  /**
   * Paint the stored palette before the panel's page-quiet wait ends.
   *
   * themes.css is injected by the manifest, so its own fallbacks on
   * `html` are live from the first frame — including a near-black base00.
   * content.js only calls into here after ~1.5s of DOM quiet, which would
   * show that fallback as a black flash on every navigation. This is the
   * same call it makes later, just earlier; every setter is idempotent.
   */
  if (typeof window.sscGet === "function") {
    try {
      Promise.all([window.sscGet(), loadPoster()]).then(function (res) {
        sscApplyLayout(res[0]);
      }).catch(function () {});
    } catch (e) {
      /* Storage unavailable (an exotic frame) — the panel's own apply stands. */
    }
  }
})();
