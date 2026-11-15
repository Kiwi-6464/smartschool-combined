/**
 * Smartschool Combined — the Hub.
 *
 * A full-screen overlay opened from the topbar's hub button. Five floating
 * islands in a bento grid:
 *
 *   Arcade        the game lobby (Snake, 2048, Mines, Plinko, Roulette, Blackjack)
 *   School        Smartschool's own Resultaten page
 *   Stadion       the Ultimate Team manager (team.js)
 *   Boerderij     the 3D farm: plant and pet on a grass field (hub-farm.js)
 *   Rekentoestel  the TI-84 programs, as a panel inside the hub (ti84.js)
 *
 * Snake and 2048 are the start page widgets themselves, rendered through
 * window.sscWidgetKit, so their high scores are the same ones. The farm reads
 * and writes the same sscPlantWidget_{userId} / sscPetWidget_{userId} saves as
 * the start page widgets. Mines, Plinko, Roulette and Blackjack come from
 * hub-games.js and share ONE play balance ("munten", in the per-user
 * sscUserEconomy_{userId} economy, never real money).
 *
 * Every colour is a theme variable (--ssc-*) with a system-colour fallback, so
 * a light theme gives a light hub, a dark one a dark hub, and a wallpaper
 * shows through the glass.
 *
 * Everything lives in one shadow root on <html>. Animations are transform and
 * opacity only; the overlay is display:none while closed, so nothing runs in
 * the background, and the browser holds rAF while the tab is hidden.
 *
 * Loaded lazily (lazy.js module "hub") on the first click on the button.
 */
(function () {
  "use strict";

  if (window.sscSkipPage) return;
  if (window.sscHubOpen) return;

  function h(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function btn(cls, text) {
    var b = h("button", cls, text);
    b.type = "button";
    return b;
  }

  function fmt(n) {
    return Math.round(n).toLocaleString("nl-BE");
  }

  function storageGet(keys) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(keys, function (res) {
          resolve(chrome.runtime.lastError ? {} : res || {});
        });
      } catch (e) {
        resolve({});
      }
    });
  }

  function storageRemove(key) {
    try {
      chrome.storage.local.remove(key);
    } catch (e) {
      /* Extension reloaded: nothing to remove from this page. */
    }
  }

  function storageSet(key, value) {
    try {
      var payload = {};
      payload[key] = value;
      chrome.storage.local.set(payload);
    } catch (e) {
      /* Extension reloaded: this page keeps its copy until the next load. */
    }
  }

  function loadModule(name) {
    if (typeof window.sscLoadModule !== "function") return Promise.resolve(false);
    return window.sscLoadModule(name).then(function () {
      return true;
    }, function () {
      return false;
    });
  }

  var ARROW_LEFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ARROW_RIGHT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

  function icon(markup) {
    var s = h("span", "hub-ico");
    s.innerHTML = markup;
    return s;
  }

  /*
   * Island art: 3D renders (Blender, poly.pizza CC-BY models, see CREDITS.md) in
   * assets/islands/<id>.webp, 720x615 with a transparent background.
   */

  /* c1 / c2 tint each island from the theme's own palette. */
  var ISLANDS = [
    { id: "arcade", kicker: "Spellen", title: "Arcade", sub: "Zes spellen, één speelhal. Verbreek je records.", c1: "var(--hb-acc)", c2: "var(--hb-red)" },
    { id: "school", kicker: "Resultaten", title: "School", sub: "Je punten en evaluaties.", c1: "var(--hb-blue)", c2: "var(--hb-acc)" },
    { id: "stadion", kicker: "Ultimate Team", title: "Stadion", sub: "Je team en de competitie.", c1: "var(--hb-green)", c2: "var(--hb-gold)" },
    { id: "farm", kicker: "Bouw & oogst", title: "Boerderij", sub: "Zaai, oogst, bak en lever bestellingen.", c1: "var(--hb-orange)", c2: "var(--hb-red)" },
    { id: "chess", kicker: "Denksport", title: "Schaken", sub: "Tegen bots of een vriend.", c1: "var(--hb-ink)", c2: "var(--hb-acc)" },
    { id: "calc", kicker: "TI-84", title: "Rekentoestel", sub: "Programma's op je rekenmachine.", c1: "var(--hb-blue)", c2: "var(--hb-ink)" },
  ];

  /* ================================================================ */
  /* Arcade data                                                       */
  /* ================================================================ */

  /*
   * One economy per Smartschool user: sscUserEconomy_{userId} ("local" when anonymous).
   * It holds the arcade balance (munten, never real money) and what the farm bought
   * with it. The numbers (not the per-game records) also sync to economies/{userId}.
   */
  var ARCADE_KEY = "sscUserEconomy";
  var OLD_KEY = "sscArcade";
  var arcadeKey = ARCADE_KEY;
  var START_COINS = 1000;
  var arcade = { coins: START_COINS, best: {}, peak: START_COINS, barn: 0, toys: 0, fert: 0, updatedAt: 0 };
  var arcadeLoaded = null;
  var coinListeners = [];
  var economyUid = "";

  function num(v, fallback) {
    v = Number(v);
    return isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
  }

  function takeEconomy(v) {
    if (!v || typeof v !== "object") return;
    arcade.coins = num(v.coins, START_COINS);
    arcade.best = v.best && typeof v.best === "object" ? v.best : arcade.best;
    arcade.peak = num(v.peak, arcade.coins) || arcade.coins;
    arcade.barn = Math.min(3, num(v.barn, 0));
    arcade.toys = num(v.toys, 0) & 7;
    arcade.fert = num(v.fert, 0);
    arcade.updatedAt = num(v.updatedAt, 0);
  }

  function askBackground(msg) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(msg, function (res) {
          resolve(chrome.runtime.lastError ? null : res);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  function loadArcade() {
    if (!arcadeLoaded) {
      arcadeLoaded = userKeySuffix().then(function (uid) {
        economyUid = uid;
        arcadeKey = ARCADE_KEY + "_" + uid;
        var oldKey = OLD_KEY + "_" + uid;
        return storageGet([arcadeKey, oldKey, OLD_KEY]);
      }).then(function (res) {
        var v = res[arcadeKey];
        // The arcade-only balance (sscArcade_{userId}, or the even older shared one) moves in once.
        if (!v) {
          v = res[OLD_KEY + "_" + economyUid] || res[OLD_KEY];
          if (v && typeof v === "object") storageSet(arcadeKey, v);
        }
        takeEconomy(v);
        if (economyUid === "local") return null;
        return askBackground({ type: "ssc:stateGet", kind: "economy", userId: economyUid }).then(function (reply) {
          var server = reply && reply.ok && reply.state;
          if (server && num(server.updatedAt, 0) > arcade.updatedAt) {
            takeEconomy(Object.assign({ best: arcade.best }, server));
            storageSet(arcadeKey, snapshot());
          } else if (reply && reply.ok && arcade.updatedAt) {
            pushEconomy();
          }
        });
      });
    }
    return arcadeLoaded;
  }

  function snapshot() {
    return { coins: arcade.coins, best: arcade.best, peak: arcade.peak, barn: arcade.barn, toys: arcade.toys, fert: arcade.fert, updatedAt: arcade.updatedAt };
  }

  function pushEconomy() {
    if (economyUid && economyUid !== "local") {
      askBackground({
        type: "ssc:stateSave", kind: "economy", userId: economyUid,
        state: { coins: arcade.coins, peak: arcade.peak, barn: arcade.barn, toys: arcade.toys, fert: arcade.fert, updatedAt: arcade.updatedAt },
      });
    }
  }

  var saveTimer = 0;
  function saveArcade() {
    clearTimeout(saveTimer);
    arcade.updatedAt = Date.now();
    saveTimer = setTimeout(function () {
      storageSet(arcadeKey, snapshot());
      pushEconomy();
    }, 250);
    coinListeners.forEach(function (fn) {
      fn(arcade.coins);
    });
  }

  /* The farm spends the same coins the arcade wins: window.sscHubEconomy. */
  window.sscHubEconomy = {
    ready: function () {
      return loadArcade();
    },
    coins: function () {
      return arcade.coins;
    },
    take: function (n) {
      n = Math.floor(n);
      if (!(n > 0) || n > arcade.coins) return false;
      arcade.coins -= n;
      saveArcade();
      return true;
    },
    /** Adds coins. The farm never calls this: coins are won in the arcade and only spent on the farm. */
    give: function (n) {
      n = Math.floor(n);
      if (!(n > 0)) return;
      arcade.coins += n;
      arcade.peak = Math.max(arcade.peak, arcade.coins);
      saveArcade();
    },
    /** The Smartschool user the economy belongs to, and the per-user storage the farm game saves in. */
    uid: function () {
      return economyUid || "local";
    },
    load: function (key) {
      return storageGet([key]).then(function (res) {
        return res[key] || null;
      });
    },
    save: function (key, value) {
      storageSet(key, value);
    },
    ask: askBackground,
    farm: function () {
      return { barn: arcade.barn, toys: arcade.toys, fert: arcade.fert };
    },
    setFarm: function (patch) {
      if (patch.barn !== undefined) arcade.barn = Math.max(0, Math.min(3, Math.floor(patch.barn)));
      if (patch.toys !== undefined) arcade.toys = Math.floor(patch.toys) & 7;
      if (patch.fert !== undefined) arcade.fert = Math.max(0, Math.floor(patch.fert));
      saveArcade();
    },
    onChange: function (fn) {
      coinListeners.push(fn);
      return function () {
        coinListeners = coinListeners.filter(function (f) {
          return f !== fn;
        });
      };
    },
  };

  /* The widget games keep their records in the widget data. */
  function widgetBest() {
    return storageGet(["sscWidgetData"]).then(function (res) {
      var d = res.sscWidgetData || {};
      return {
        snake: Number((d.snake || {}).best) || 0,
        g2048: Number((d.g2048 || {}).best) || 0,
      };
    });
  }

  /* ================================================================ */
  /* Shell                                                             */
  /* ================================================================ */

  var host = null;
  var shadow = null;
  var root = null;
  var stageEl = null;
  var clockEl = null;
  var greetEl = null;
  var viewDispose = [];
  var view = "home";
  var subBack = null; // what Escape does inside a sub view
  var goneTimer = 0;
  var clockTimer = 0;

  function greeting() {
    var hr = new Date().getHours();
    return hr < 6 ? "Goedenacht" : hr < 12 ? "Goedemorgen" : hr < 18 ? "Goedemiddag" : "Goedenavond";
  }

  function paintClock() {
    if (!clockEl) return;
    var d = new Date();
    var two = function (n) {
      return (n < 10 ? "0" : "") + n;
    };
    clockEl.textContent = d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" }) + " · " + two(d.getHours()) + ":" + two(d.getMinutes());
    greetEl.textContent = greeting();
  }

  function build() {
    if (host) return;
    host = document.createElement("div");
    host.id = "ssc-hub-host";
    shadow = host.attachShadow({ mode: "open" });
    var style = document.createElement("style");
    var kit = window.sscWidgetKit && window.sscWidgetKit.CSS ? window.sscWidgetKit.CSS : "";
    style.textContent = CSS + "\n" + (window.sscHubGamesCss || "");
    shadow.appendChild(style);
    // The widget card styles arrive with the widgets module, later.
    var kitStyle = document.createElement("style");
    kitStyle.setAttribute("data-kit", "1");
    kitStyle.textContent = kit;
    shadow.appendChild(kitStyle);

    root = h("div", "hub");
    // Liquid glass lens for the islands (see .isl-glass): static noise, so it costs one filter pass.
    var fx = h("div", "hub-fx");
    fx.innerHTML = '<svg width="0" height="0" aria-hidden="true"><filter id="hub-liquid" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.009 0.013" numOctaves="2" seed="7" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G"/></filter></svg>';
    root.appendChild(fx);
    root.setAttribute("data-open", "0");
    root.setAttribute("data-gone", "1");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Hub");

    var bg = h("div", "hub-bg");
    bg.appendChild(h("span", "hub-blob hub-blob--a"));
    bg.appendChild(h("span", "hub-blob hub-blob--b"));
    bg.appendChild(h("span", "hub-blob hub-blob--c"));
    bg.appendChild(h("span", "hub-grid-lines"));
    root.appendChild(bg);

    var shell = h("div", "hub-shell");
    var top = h("header", "hub-top");
    var brand = h("div", "hub-brand");
    var logo = h("img", "hub-logo");
    try {
      logo.src = chrome.runtime.getURL("assets/icons/logo.svg");
    } catch (e) {
      logo.hidden = true;
    }
    logo.alt = "";
    brand.appendChild(logo);
    var words = h("div", "hub-brand-words");
    greetEl = h("span", "hub-greet", greeting());
    words.appendChild(greetEl);
    words.appendChild(h("span", "hub-title", "Hub"));
    brand.appendChild(words);
    top.appendChild(brand);
    var right = h("div", "hub-top-right");
    clockEl = h("span", "hub-clock");
    right.appendChild(clockEl);
    var close = btn("hub-round");
    close.setAttribute("aria-label", "Sluiten");
    close.title = "Sluiten (Esc)";
    close.appendChild(icon(CLOSE));
    close.addEventListener("click", closeHub);
    right.appendChild(close);
    top.appendChild(right);
    shell.appendChild(top);

    stageEl = h("main", "hub-stage");
    shell.appendChild(stageEl);
    root.appendChild(shell);
    shadow.appendChild(root);
  }

  function ensureKitCss() {
    var tag = shadow && shadow.querySelector("style[data-kit]");
    if (tag && !tag.textContent && window.sscWidgetKit && window.sscWidgetKit.CSS) tag.textContent = window.sscWidgetKit.CSS;
  }

  function clearView() {
    var list = viewDispose;
    viewDispose = [];
    list.forEach(function (fn) {
      try {
        fn();
      } catch (e) {
        /* One cleanup must not block the next view. */
      }
    });
    subBack = null;
    if (stageEl) stageEl.textContent = "";
  }

  function onKey(e) {
    if (!isOpen() || e.key !== "Escape") return;
    e.stopPropagation();
    e.preventDefault();
    if (puzzleClose) puzzleClose();
    else if (subBack) subBack();
    else closeHub();
  }

  function isOpen() {
    return !!root && root.getAttribute("data-open") === "1";
  }

  function openHub(initial) {
    build();
    if (!host.isConnected) document.documentElement.appendChild(host);
    clearTimeout(goneTimer);
    root.removeAttribute("data-gone");
    void root.offsetWidth; // start the fade from the hidden state
    root.setAttribute("data-open", "1");
    document.addEventListener("keydown", onKey, true);
    paintClock();
    clearInterval(clockTimer);
    clockTimer = setInterval(paintClock, 20000);
    if (initial === "calc") {
      // The calculator only exists for its class; anyone else lands on the islands.
      homeAccess().then(function (a) {
        if (!isOpen()) return;
        if (a.calc) showCalc();
        else showHome();
      });
    } else showHome();
    root.scrollTop = 0;
  }

  function closeHub() {
    if (!isOpen()) return;
    root.setAttribute("data-open", "0");
    document.removeEventListener("keydown", onKey, true);
    clearInterval(clockTimer);
    clearView();
    goneTimer = setTimeout(function () {
      root.setAttribute("data-gone", "1");
    }, 320);
  }

  /* ================================================================ */
  /* Home: the islands                                                 */
  /* ================================================================ */

  function attachTilt(card, tilt, shine) {
    var frame = 0;
    var px = 0.5;
    var py = 0.5;
    function apply() {
      frame = 0;
      tilt.style.transform = "rotateX(" + ((0.5 - py) * 9).toFixed(2) + "deg) rotateY(" + ((px - 0.5) * 12).toFixed(2) + "deg)";
      shine.style.transform = "translate3d(" + (px * 100).toFixed(1) + "%, " + (py * 100).toFixed(1) + "%, 0)";
    }
    card.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      var r = card.getBoundingClientRect();
      px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      card.setAttribute("data-hover", "1");
      if (!frame) frame = requestAnimationFrame(apply);
    });
    card.addEventListener("pointerleave", function () {
      card.removeAttribute("data-hover");
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      tilt.style.transform = "";
    });
  }

  function islandCard(def, i) {
    var card = h("div", "isl isl--" + def.id);
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", def.title + ": " + def.sub);
    card.style.setProperty("--i", String(i));
    card.style.setProperty("--c1", def.c1);
    card.style.setProperty("--c2", def.c2);

    var tilt = h("div", "isl-tilt");
    tilt.appendChild(h("div", "isl-glass"));
    var text = h("div", "isl-text");
    text.appendChild(h("span", "isl-kicker", def.kicker));
    text.appendChild(h("h3", "isl-title", def.title));
    text.appendChild(h("p", "isl-sub", def.sub));
    var meta = h("div", "isl-meta");
    text.appendChild(meta);
    tilt.appendChild(text);

    var art = h("div", "isl-art");
    var float = h("div", "isl-float");
    var img = h("img");
    img.src = chrome.runtime.getURL("assets/islands/" + def.id + ".webp");
    img.alt = "";
    img.decoding = "async";
    img.draggable = false;
    float.appendChild(img);
    art.appendChild(h("div", "isl-shadow"));
    art.appendChild(float);
    tilt.appendChild(art);

    var go = h("span", "isl-go");
    go.appendChild(icon(ARROW_RIGHT));
    tilt.appendChild(go);

    var shineWrap = h("div", "isl-shine");
    var shine = h("i");
    shineWrap.appendChild(shine);
    tilt.appendChild(shineWrap);
    card.appendChild(tilt);
    attachTilt(card, tilt, shine);

    function activate() {
      card.setAttribute("data-press", "1");
      setTimeout(function () {
        card.removeAttribute("data-press");
        // Esc or a second click during the press animation must not open a view twice or in a closed hub.
        if (isOpen() && view === "home" && card.isConnected) ACTIONS[def.id]();
      }, 140);
    }
    card.addEventListener("click", activate);
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
    return { node: card, meta: meta };
  }

  function chip(text, cls) {
    return h("span", "isl-chip" + (cls ? " " + cls : ""), text);
  }

  var homeToken = 0;

  /** { calc, league } for this account; closed (both false) when unknown or slow, so other classes never see them. */
  function homeAccess() {
    var none = { calc: false, league: false };
    var ask = typeof window.sscClassAccess === "function" ? window.sscClassAccess() : Promise.resolve(none);
    return Promise.race([
      ask.then(function (a) { return a || none; }, function () { return none; }),
      new Promise(function (resolve) { setTimeout(function () { resolve(none); }, 2500); }),
    ]);
  }

  function showHome() {
    clearView();
    view = "home";
    var token = ++homeToken;
    homeAccess().then(function (access) {
      if (token === homeToken && isOpen() && view === "home") renderHome(access);
    });
  }

  /*
   * The calculator and the league are only for one class. Everyone else gets
   * no trace of them: no calculator island, no "competitie" on the stadium.
   * Chess then takes the small square and the calculator, when there, is the
   * wide bar at the bottom.
   */
  function renderHome(access) {
    var grid = h("div", "hub-home hub-view");
    if (access.calc) grid.setAttribute("data-calc", "1");
    var metas = {};
    ISLANDS.filter(function (def) {
      return def.id !== "calc" || access.calc;
    }).forEach(function (def, i) {
      if (def.id === "stadion" && !access.league) def = Object.assign({}, def, { sub: "Je team en je kaarten." });
      var c = islandCard(def, i);
      metas[def.id] = c.meta;
      grid.appendChild(c.node);
    });
    stageEl.appendChild(grid);

    // Live facts on the islands.
    ["Snake", "2048", "Mines", "Plinko", "Roulette", "Blackjack"].forEach(function (n) {
      metas.arcade.appendChild(chip(n));
    });
    Promise.all([loadArcade(), widgetBest()]).then(function (out) {
      var coins = chip(fmt(arcade.coins) + " munten", "isl-chip--gold");
      metas.arcade.appendChild(coins);
      if (out[1].snake) metas.arcade.appendChild(chip("Snake-record " + fmt(out[1].snake)));
    });
    metas.school.appendChild(chip(/\/results/.test(location.pathname) ? "Je bent hier" : "Naar je punten"));
    metas.stadion.appendChild(chip(access.league ? "Team · competitie" : "Team"));
    if (metas.calc) metas.calc.appendChild(chip("Verbind via USB"));
    ["6 bots", "Klok", "Analyse"].forEach(function (n) {
      metas.chess.appendChild(chip(n));
    });
    farmFacts().then(function (facts) {
      facts.forEach(function (f) {
        metas.farm.appendChild(chip(f));
      });
    });
    var first = grid.querySelector(".isl");
    if (first) setTimeout(function () {
      if (isOpen() && view === "home") first.focus({ preventScroll: true });
    }, 60);
  }

  function userKeySuffix() {
    var get = window.sscGetUserId;
    return (typeof get === "function" ? Promise.resolve(get()) : Promise.resolve(null)).then(function (uid) {
      return uid && uid !== "anoniem" ? uid : "local";
    }, function () {
      return "local";
    });
  }

  function farmFacts() {
    return userKeySuffix().then(function (uid) {
      var fk = "sscFarm3_" + uid;
      return storageGet([fk]).then(function (res) {
        var f = res[fk];
        if (!f || !f.level) return ["Begin je boerderij"];
        return ["Niveau " + f.level, (Array.isArray(f.objs) ? f.objs.length : 0) + " dingen op je erf"];
      });
    });
  }

  var ACTIONS = {
    arcade: function () {
      showArcade();
    },
    farm: function () {
      showFarm();
    },
    school: function () {
      closeHub();
      if (!/^\/results/.test(location.pathname)) location.assign(location.origin + "/results");
    },
    stadion: function () {
      closeHub();
      if (typeof window.sscTeamOpenSurfaces === "function") window.sscTeamOpenSurfaces();
    },
    calc: function () {
      showCalc();
    },
    chess: function () {
      showChess();
    },
  };

  /* ================================================================ */
  /* Sub views: shared header                                          */
  /* ================================================================ */

  function subHead(kicker, title, onBack, backLabel) {
    var head = h("div", "hub-subhead");
    var back = btn("hub-back");
    back.appendChild(icon(ARROW_LEFT));
    back.appendChild(h("span", null, backLabel || "Hub"));
    back.addEventListener("click", onBack);
    head.appendChild(back);
    var words = h("div", "hub-subwords");
    words.appendChild(h("span", "hub-subkicker", kicker));
    words.appendChild(h("h2", "hub-subtitle", title));
    head.appendChild(words);
    head.appendChild(h("span", "hub-spacer"));
    subBack = onBack;
    return head;
  }

  /* ================================================================ */
  /* Puzzle: the only way to top up, +100 for a right answer          */
  /* ================================================================ */

  var PUZZLE_REWARD = 100;
  var puzzleClose = null;

  function pick(n) {
    return Math.floor(Math.random() * n);
  }
  function between(a, b) {
    return a + pick(b - a + 1);
  }

  /*
   * Reasoning puzzles, no calculator: each is generated at random, solved by
   * brute force here and only kept when it has exactly ONE solution, so the
   * answer is always deducible. A maker returns { q, s (monospace block), a }.
   */
  var NAMES = ["A", "B", "C", "D", "E"];

  function shuffled(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(i);
    for (var j = n - 1; j > 0; j--) {
      var k = pick(j + 1);
      var t = a[j];
      a[j] = a[k];
      a[k] = t;
    }
    return a;
  }

  function perms(n) {
    var out = [];
    (function rec(cur, rest) {
      if (!rest.length) return out.push(cur);
      rest.forEach(function (x, i) {
        rec(cur.concat(x), rest.slice(0, i).concat(rest.slice(i + 1)));
      });
    })([], shuffled(n).sort());
    return out;
  }

  /** Five people stand in a row; clues are added until only one order fits. */
  function rowPuzzle() {
    var N = 5;
    var pos = shuffled(N); // pos[person] = place 0..4
    var all = perms(N).map(function (order) {
      var p = [];
      order.forEach(function (person, place) {
        p[person] = place;
      });
      return p;
    });
    function clue() {
      var x = pick(N), y = pick(N);
      if (x === y) return null;
      var t = pick(5);
      if (t === 0 && pos[x] < pos[y]) return { t: NAMES[x] + " staat ergens links van " + NAMES[y] + ".", ok: function (p) { return p[x] < p[y]; } };
      if (t === 1 && Math.abs(pos[x] - pos[y]) === 1) return { t: NAMES[x] + " staat direct naast " + NAMES[y] + ".", ok: function (p) { return Math.abs(p[x] - p[y]) === 1; } };
      if (t === 2) { var k = pick(N); if (pos[x] !== k) return { t: NAMES[x] + " staat niet op plek " + (k + 1) + ".", ok: function (p) { return p[x] !== k; } }; }
      if (t === 3 && pos[x] !== pos[y]) { var g = Math.abs(pos[x] - pos[y]) - 1; return { t: "Tussen " + NAMES[x] + " en " + NAMES[y] + (g === 1 ? " staat precies 1 persoon." : " staan precies " + g + " mensen."), ok: function (p) { return Math.abs(p[x] - p[y]) - 1 === g; } }; }
      if (t === 4 && (pos[x] === 0 || pos[x] === N - 1)) return { t: NAMES[x] + " staat helemaal aan een uiteinde.", ok: function (p) { return p[x] === 0 || p[x] === N - 1; } };
      return null;
    }
    var clues = [], left = all;
    for (var tries = 0; tries < 400 && left.length > 1; tries++) {
      var c = clue();
      if (!c || clues.some(function (d) { return d.t === c.t; })) continue;
      var nl = left.filter(c.ok);
      if (nl.length < left.length) { clues.push(c); left = nl; }
    }
    if (left.length !== 1 || clues.length > 9) return null;
    var who = pick(N);
    return {
      q: "Vijf mensen (A t/m E) staan naast elkaar op de plekken 1 t/m 5, van links naar rechts. Je weet:\n- " + clues.map(function (c) { return c.t; }).join("\n- ") + "\n\nOp welke plek (1-5) staat " + NAMES[who] + "?",
      a: pos[who] + 1,
    };
  }

  /** One of five did it; everybody makes a statement and exactly N statements are true. */
  function liarPuzzle() {
    var N = 5, culprit = pick(N), says = [];
    for (var i = 0; i < N; i++) {
      var p = pick(N);
      says.push({ p: p, not: pick(2) === 1 });
    }
    function trueCount(c) {
      return says.reduce(function (n, st) {
        return n + ((st.p === c) !== st.not ? 1 : 0);
      }, 0);
    }
    var want = trueCount(culprit);
    var fits = [0, 1, 2, 3, 4].filter(function (c) { return trueCount(c) === want; });
    if (fits.length !== 1 || want < 1 || want > 3) return null;
    return {
      q: "Eén van A t/m E heeft de koekjes gepakt. Iedereen zegt iets, en precies " + want + " van de 5 uitspraken " + (want === 1 ? "is" : "zijn") + " waar:\n- " +
        says.map(function (st, i) { return NAMES[i] + ": \"" + (st.not ? "Het was " + NAMES[st.p] + " niet." : "Het was " + NAMES[st.p] + ".") + "\""; }).join("\n- ") +
        "\n\nWie was het? Antwoord met een nummer: A=1, B=2, C=3, D=4, E=5.",
      a: culprit + 1,
    };
  }

  /** 4 × 4 sudoku (rows, columns and the four 2 × 2 blocks hold 1-4 once); one cell is asked. */
  function sudokuPuzzle() {
    function ok(g, i, v) {
      var r = (i / 4) | 0, c = i % 4;
      for (var k = 0; k < 4; k++) {
        if (g[r * 4 + k] === v || g[k * 4 + c] === v) return false;
      }
      var br = r - (r % 2), bc = c - (c % 2);
      for (var y = 0; y < 2; y++) for (var x = 0; x < 2; x++) if (g[(br + y) * 4 + bc + x] === v) return false;
      return true;
    }
    function solve(g, limit, keep) {
      var i = g.indexOf(0);
      if (i < 0) return 1;
      var n = 0, vals = keep ? shuffled(4).map(function (v) { return v + 1; }) : [1, 2, 3, 4];
      for (var k = 0; k < 4 && n < limit; k++) {
        if (ok(g, i, vals[k])) {
          g[i] = vals[k];
          n += solve(g, limit - n, keep);
          if (keep && n) return n; // keep the solved grid filled in
          g[i] = 0;
        }
      }
      return n;
    }
    var full = [];
    for (var z = 0; z < 16; z++) full.push(0);
    solve(full, 1, true);
    // The random first fill above only randomises the first cell; shuffle digits, rows and columns for variety.
    var map = shuffled(4).map(function (v) { return v + 1; });
    full = full.map(function (v) { return map[v - 1]; });
    var puzzle = full.slice(), order = shuffled(16), blanks = [];
    order.forEach(function (i) {
      var keep = puzzle[i];
      puzzle[i] = 0;
      if (solve(puzzle.slice(), 2, false) === 1 && blanks.length < 9) blanks.push(i);
      else puzzle[i] = keep;
    });
    if (blanks.length < 6) return null;
    var ask = blanks[pick(blanks.length)], rows = [];
    for (var r = 0; r < 4; r++) {
      var line = [];
      for (var c = 0; c < 4; c++) {
        var i = r * 4 + c;
        line.push(i === ask ? "?" : puzzle[i] ? String(puzzle[i]) : "·");
        if (c === 1) line.push("|");
      }
      rows.push(line.join(" "));
      if (r === 1) rows.push("- - + - -");
    }
    return {
      q: "Vul het sudoku-raster aan: in elke rij, kolom en elk blok van 2 × 2 staan de cijfers 1 t/m 4 precies één keer. Welk cijfer hoort op de plek van het vraagteken?",
      s: rows.join("\n"),
      a: full[ask],
    };
  }

  /*
   * Track puzzle: a PN × PN grid of straight and corner pieces. A random
   * self-avoiding walk from the left arrow to the right arrow is laid first,
   * the rest is filled with decoys, then every piece is turned at random. The
   * player clicks pieces to turn them (90° clockwise) until the track runs.
   * Sides are bits: N=1, E=2, S=4, W=8.
   */
  var PN = 5, P_N = 1, P_E = 2, P_S = 4, P_W = 8;
  var STEP = { 1: [-1, 0], 2: [0, 1], 4: [1, 0], 8: [0, -1] };

  function turnSides(m, k) {
    for (k = ((k % 4) + 4) % 4; k > 0; k--) m = ((m << 1) | (m >> 3)) & 15;
    return m;
  }

  /** Follows the track from the left arrow; ok when it leaves through the right arrow. */
  function pipeTrace(p) {
    var lit = {}, r = p.start, c = 0, from = P_W;
    for (var n = 0; n < PN * PN; n++) {
      var i = r * PN + c, m = turnSides(p.base[i], p.turns[i]);
      if (!(m & from) || lit[i]) break;
      lit[i] = true;
      var out = m & ~from, s = STEP[out];
      r += s[0];
      c += s[1];
      if (r < 0 || r >= PN || c < 0 || c >= PN) return { lit: lit, ok: out === P_E && r === p.exit };
      from = turnSides(out, 2);
    }
    return { lit: lit, ok: false };
  }

  function pipePuzzle() {
    var start = pick(PN), path = [[start, 0]], seen = {}, budget = 3000;
    seen[start * PN] = true;
    function walk(r, c) {
      if (c === PN - 1 && path.length >= 9) return true;
      if (--budget < 0) return false;
      var dirs = shuffled(4);
      for (var k = 0; k < 4; k++) {
        var s = STEP[1 << dirs[k]], nr = r + s[0], nc = c + s[1], key = nr * PN + nc;
        if (nr < 0 || nr >= PN || nc < 0 || nc >= PN || seen[key]) continue;
        seen[key] = true;
        path.push([nr, nc]);
        if (walk(nr, nc)) return true;
        seen[key] = false;
        path.pop();
      }
      return false;
    }
    if (!walk(start, 0)) return null;
    function side(a, b) {
      return b[0] < a[0] ? P_N : b[0] > a[0] ? P_S : b[1] > a[1] ? P_E : P_W;
    }
    var base = [];
    for (var i = 0; i < PN * PN; i++) base.push([5, 10, 3, 6, 12, 9][pick(6)]);
    path.forEach(function (p, j) {
      var inn = j === 0 ? P_W : turnSides(side(path[j - 1], p), 2);
      var out = j === path.length - 1 ? P_E : side(p, path[j + 1]);
      base[p[0] * PN + p[1]] = inn | out;
    });
    var puzzle = { kind: "pipe", base: base, start: start, exit: path[path.length - 1][0], turns: [] };
    do {
      puzzle.turns = base.map(function () { return pick(4); });
    } while (pipeTrace(puzzle).ok);
    return puzzle;
  }

  var PUZZLES = [rowPuzzle, liarPuzzle, sudokuPuzzle];

  function makePuzzle() {
    // Mostly the track puzzle; now and then one of the reasoning puzzles (each equally often).
    var make = Math.random() < 0.7 ? pipePuzzle : PUZZLES[pick(PUZZLES.length)];
    for (var i = 0; i < 400; i++) {
      var p = make();
      if (p) return p;
    }
    return { q: "Welk cijfer ontbreekt: 1, 2, 3, ? , 5", a: 4 };
  }

  function openPuzzle() {
    if (!root || puzzleClose) return;
    var layer = h("div", "pz-layer");
    var card = h("div", "pz-card");
    var title = h("div", "pz-title", "Puzzel");
    var q = h("div", "pz-q");
    var seqLine = h("div", "pz-seq");
    var input = h("input", "pz-input");
    input.type = "number";
    input.inputMode = "numeric";
    input.placeholder = "Jouw antwoord";
    var msg = h("div", "pz-msg");
    var go = btn("hub-refill pz-go", "Controleer");
    var closeBtn = btn("pz-close", "");
    closeBtn.appendChild(icon(CLOSE));
    closeBtn.setAttribute("aria-label", "Sluiten");
    card.appendChild(closeBtn);
    var board = h("div", "pz-board");
    [title, q, seqLine, board, input, msg, go].forEach(function (n) {
      card.appendChild(n);
    });
    layer.appendChild(card);
    root.appendChild(layer);

    var cur = null;
    var done = false;
    function reward() {
      arcade.coins += PUZZLE_REWARD;
      arcade.peak = Math.max(arcade.peak, arcade.coins);
      saveArcade();
      msg.textContent = "Juist! +" + PUZZLE_REWARD + " munten.";
      msg.setAttribute("data-ok", "1");
      go.textContent = "Nieuwe puzzel";
    }
    function buildPipe() {
      board.textContent = "";
      board.removeAttribute("data-ok");
      board.style.setProperty("--pz-in", cur.start);
      board.style.setProperty("--pz-out", cur.exit);
      board.appendChild(h("span", "pz-mark pz-mark--in"));
      board.appendChild(h("span", "pz-mark pz-mark--out"));
      var grid = h("div", "pz-grid");
      board.appendChild(grid);
      var tiles = cur.base.map(function (m, i) {
        var t = btn("pz-tile", "");
        t.setAttribute("aria-label", "Draai stuk " + (((i / PN) | 0) + 1) + "-" + ((i % PN) + 1));
        var pipe = h("span", "pz-pipe");
        [P_N, P_E, P_S, P_W].forEach(function (d) {
          if (m & d) pipe.appendChild(h("span", "pz-arm pz-arm--" + d));
        });
        pipe.appendChild(h("span", "pz-dot"));
        t.appendChild(pipe);
        function paint() {
          pipe.style.transform = "rotate(" + cur.turns[i] * 90 + "deg)";
        }
        paint();
        t.addEventListener("click", function () {
          if (done) return;
          cur.turns[i]++;
          paint();
          light();
        });
        grid.appendChild(t);
        return t;
      });
      function light() {
        var tr = pipeTrace(cur);
        tiles.forEach(function (t, i) {
          t.toggleAttribute("data-on", !!tr.lit[i]);
        });
        if (tr.ok && !done) {
          done = true;
          board.setAttribute("data-ok", "1");
          reward();
        }
      }
      light();
    }
    function next() {
      cur = makePuzzle();
      done = false;
      var pipe = cur.kind === "pipe";
      q.textContent = pipe ? "Draai de stukken (klik erop) tot er één baan loopt van de pijl links naar de pijl rechts." : cur.q;
      seqLine.textContent = cur.s || "";
      seqLine.hidden = !cur.s;
      board.hidden = !pipe;
      input.hidden = pipe;
      input.value = "";
      input.disabled = false;
      msg.textContent = pipe ? "De baan licht op zover hij al loopt." : "Alleen een goed antwoord levert munten op. Je hebt één poging.";
      msg.removeAttribute("data-ok");
      go.textContent = pipe ? "Andere puzzel" : "Controleer";
      if (pipe) buildPipe();
      else input.focus();
    }
    function check() {
      if (done || cur.kind === "pipe") return next();
      if (input.value.trim() === "") return;
      done = true;
      input.disabled = true;
      if (Number(input.value) === cur.a) {
        reward();
        return;
      } else {
        msg.textContent = "Fout. Het antwoord was " + cur.a + ".";
        msg.setAttribute("data-ok", "0");
      }
      go.textContent = "Nieuwe puzzel";
    }
    function close() {
      puzzleClose = null;
      layer.remove();
    }
    puzzleClose = close;
    viewDispose.push(function () {
      if (puzzleClose === close) close();
    });
    go.addEventListener("click", check);
    closeBtn.addEventListener("click", close);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") check();
    });
    layer.addEventListener("click", function (e) {
      if (e.target === layer) close();
    });
    next();
  }

  function coinPill() {
    var pill = h("div", "hub-coins");
    pill.appendChild(h("span", "hub-coin"));
    var value = h("b", null, fmt(arcade.coins));
    pill.appendChild(value);
    var refill = btn("hub-refill", "Puzzel +" + PUZZLE_REWARD);
    refill.title = "Los een puzzel goed op en verdien " + PUZZLE_REWARD + " munten";
    refill.addEventListener("click", openPuzzle);
    pill.appendChild(refill);
    function paint(n) {
      value.textContent = fmt(n);
      pill.removeAttribute("data-bump");
      void pill.offsetWidth;
      pill.setAttribute("data-bump", "1");
    }
    paint(arcade.coins);
    pill.removeAttribute("data-bump");
    coinListeners.push(paint);
    viewDispose.push(function () {
      coinListeners = coinListeners.filter(function (f) {
        return f !== paint;
      });
    });
    return pill;
  }

  /* ================================================================ */
  /* Arcade                                                            */
  /* ================================================================ */

  var GAMES = [
    { id: "snake", name: "Snake", tag: "Eet, groei, en bijt jezelf niet.", kind: "widget", widget: "snake", best: "snake", unit: "punten", c: "var(--hb-green)" },
    { id: "g2048", name: "2048", tag: "Schuif en combineer tot 2048.", kind: "widget", widget: "game2048", best: "g2048", unit: "punten", c: "var(--hb-orange)" },
    { id: "mines", name: "Mines", tag: "Diamanten zoeken tussen de mijnen.", kind: "hub", c: "var(--hb-blue)" },
    { id: "plinko", name: "Plinko", tag: "Zwaartekracht, pinnen en een multiplier.", kind: "hub", c: "var(--hb-acc)" },
    { id: "roulette", name: "Roulette", tag: "Rood of zwart? Zet je fiches.", kind: "hub", c: "var(--hb-red)" },
    { id: "blackjack", name: "Blackjack", tag: "Versla de bank, kom zo dicht mogelijk bij 21.", kind: "hub", c: "var(--hb-gold)" },
  ];

  function gameArt(id) {
    if (id === "snake") {
      var cells = "";
      for (var x = 0; x < 12; x++) for (var y = 0; y < 8; y++) if ((x + y) % 2) cells += '<rect x="' + x * 10 + '" y="' + y * 10 + '" width="10" height="10" fill="#fff" opacity=".03"/>';
      return '<svg viewBox="0 0 120 80" aria-hidden="true">' + cells +
        '<path d="M15 55h30V35h30v20h20" fill="none" stroke="#22c55e" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity=".35" transform="translate(0 2)"/>' +
        '<path class="ga-snake" d="M15 55h30V35h30v20h20" fill="none" stroke="#4ade80" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="95" cy="55" r="1.4" fill="#052e16"/><circle cx="104" cy="25" r="5" fill="#f43f5e"/><path d="M104 20c1-3 3-4 5-4" stroke="#16a34a" stroke-width="1.6" fill="none"/></svg>';
    }
    if (id === "g2048") {
      var t = [["2", "#eee4da", "#5b4a3a"], ["8", "#f2944f", "#fff"], ["64", "#e8402a", "#fff"], ["2048", "#8a6bff", "#fff"]];
      var out = '<svg viewBox="0 0 120 80" aria-hidden="true">';
      t.forEach(function (v, i) {
        var x = 18 + (i % 2) * 44;
        var y = 6 + Math.floor(i / 2) * 36;
        out += '<rect x="' + x + '" y="' + (y + 2) + '" width="40" height="32" rx="6" fill="#000" opacity=".25"/>' +
          '<rect class="ga-tile" style="--d:' + i * 0.15 + 's" x="' + x + '" y="' + y + '" width="40" height="32" rx="6" fill="' + v[1] + '"/>' +
          '<text x="' + (x + 20) + '" y="' + (y + 21) + '" text-anchor="middle" font-size="' + (v[0].length > 2 ? 11 : 14) + '" font-weight="900" fill="' + v[2] + '" font-family="system-ui, sans-serif">' + v[0] + "</text>";
      });
      return out + "</svg>";
    }
    if (id === "mines") {
      return '<svg viewBox="0 0 120 80" aria-hidden="true">' +
        '<rect x="10" y="14" width="30" height="30" rx="6" fill="#3a4160"/><rect x="45" y="14" width="30" height="30" rx="6" fill="#151a2a" stroke="#3ee0c8" stroke-opacity=".7"/>' +
        '<rect x="80" y="14" width="30" height="30" rx="6" fill="#3a4160"/><rect x="27" y="48" width="30" height="30" rx="6" fill="#3a4160"/>' +
        '<rect x="62" y="48" width="30" height="30" rx="6" fill="#d63a4f" stroke="#ffb4a6" stroke-opacity=".85"/>' +
        '<path class="ga-gem" d="M53 22h14l6 7-13 12-13-12z" fill="#3ee0c8"/><path d="M53 22h14l-3 7h-8z" fill="#c9fff6" opacity=".8"/>' +
        '<circle cx="76" cy="65" r="8" fill="#161a26" stroke="#fff" stroke-opacity=".55" stroke-width="1"/><circle cx="73" cy="62" r="2" fill="#fff" opacity=".7"/><path d="M80 58c2-3 5-3 6-1" stroke="#f0d9a8" stroke-width="1.8" fill="none"/><circle cx="87" cy="56" r="2.4" fill="#ffd84a"/></svg>';
    }
    if (id === "plinko") {
      var dots = "";
      for (var r = 0; r < 5; r++) for (var i = 0; i < r + 3; i++) dots += '<circle cx="' + (60 + (i - (r + 2) / 2) * 13) + '" cy="' + (12 + r * 11) + '" r="2" fill="#e9ecf5" opacity=".85"/>';
      var cols = ["#ef4444", "#f97316", "#f59e0b", "#facc15", "#f59e0b", "#f97316", "#ef4444"];
      var b = "";
      cols.forEach(function (c, k) {
        b += '<rect x="' + (14 + k * 13.3) + '" y="68" width="11" height="8" rx="2" fill="' + c + '"/>';
      });
      return '<svg viewBox="0 0 120 80" aria-hidden="true">' + dots + b + '<circle class="ga-ball" cx="60" cy="6" r="4" fill="#ff7ac3"/></svg>';
    }
    if (id === "blackjack") {
      var face = function (x, rot, rank, suit, tone, cls) {
        return '<g class="ga-card ' + cls + '" style="--r:' + rot + 'deg"><rect x="' + x + '" y="12" width="42" height="58" rx="6" fill="#fbfaf5" stroke="#0b1020" stroke-opacity=".35"/>' +
          '<rect x="' + (x + 1) + '" y="13" width="40" height="56" rx="5" fill="none" stroke="' + (tone === "red" ? "#d6204a" : "#1b1f2a") + '" stroke-opacity=".18"/>' +
          '<text x="' + (x + 6) + '" y="28" font-size="12" font-weight="900" fill="' + (tone === "red" ? "#d6204a" : "#1b1f2a") + '" font-family="system-ui, sans-serif">' + rank + "</text>" +
          '<text x="' + (x + 21) + '" y="54" text-anchor="middle" font-size="24" fill="' + (tone === "red" ? "#d6204a" : "#1b1f2a") + '" font-family="system-ui, sans-serif">' + suit + "</text></g>";
      };
      return '<svg viewBox="0 0 120 80" aria-hidden="true">' + face(24, -12, "K", "♥", "red", "ga-card--b") + face(54, 9, "A", "♠", "black", "") +
        '<circle cx="22" cy="68" r="6" style="fill:var(--hb-gold)"/><circle cx="22" cy="68" r="3.6" fill="none" style="stroke:var(--hb-black);stroke-opacity:.4" stroke-width="1"/></svg>';
    }
    // roulette
    var seg = "";
    var n = 18;
    for (var s = 0; s < n; s++) {
      var a0 = (s / n) * Math.PI * 2;
      var a1 = ((s + 1) / n) * Math.PI * 2;
      var p = function (a, r) {
        return (60 + Math.cos(a) * r).toFixed(2) + " " + (40 + Math.sin(a) * r).toFixed(2);
      };
      seg += '<path d="M' + p(a0, 18) + "L" + p(a0, 34) + "A34 34 0 0 1 " + p(a1, 34) + "L" + p(a1, 18) + 'A18 18 0 0 0 ' + p(a0, 18) + 'z" fill="' + (s === 0 ? "#0f9d58" : s % 2 ? "#c8102e" : "#262b38") + '" stroke="#e7c46b" stroke-opacity=".35" stroke-width=".5"/>';
    }
    return '<svg viewBox="0 0 120 80" aria-hidden="true"><circle cx="60" cy="40" r="38" fill="#5a2d14"/><g class="ga-wheel">' + seg +
      '</g><circle cx="60" cy="40" r="34" fill="none" stroke="#e7c46b" stroke-width="1.2"/><circle cx="60" cy="40" r="17" fill="#7a4220"/>' +
      '<circle cx="60" cy="40" r="4" fill="#e7c46b"/><circle cx="60" cy="11" r="3" fill="#f1f5f9"/></svg>';
  }

  function showArcade() {
    clearView();
    view = "arcade";
    var wrap = h("div", "hub-sub hub-view");
    var head = subHead("Arcade", "Speelhal", showHome);
    wrap.appendChild(head);
    stageEl.appendChild(wrap);
    var lobby = h("div", "arc-lobby");
    wrap.appendChild(lobby);
    Promise.all([loadArcade(), widgetBest()]).then(function (out) {
      if (view !== "arcade") return;
      head.appendChild(coinPill());
      var wbest = out[1];
      GAMES.forEach(function (g, i) {
        var card = h("button", "gc gc--" + g.id);
        card.type = "button";
        card.style.setProperty("--c", g.c);
        card.style.setProperty("--i", String(i));
        var art = h("div", "gc-art");
        art.innerHTML = gameArt(g.id);
        card.appendChild(art);
        var info = h("div", "gc-info");
        info.appendChild(h("span", "gc-name", g.name));
        info.appendChild(h("span", "gc-tag", g.tag));
        var rec = g.kind === "widget" ? wbest[g.best] : Number(arcade.best[g.id]) || 0;
        info.appendChild(h("span", "gc-best", rec ? "Record: " + fmt(rec) + (g.kind === "widget" ? " punten" : " munten winst") : "Nog geen record"));
        card.appendChild(info);
        var play = h("span", "gc-play");
        play.appendChild(icon('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>'));
        card.appendChild(play);
        card.addEventListener("click", function () {
          showGame(g);
        });
        lobby.appendChild(card);
      });
    });
  }

  function showGame(g) {
    clearView();
    view = "game";
    var wrap = h("div", "hub-sub hub-view");
    var head = subHead("Arcade", g.name, showArcade, "Lobby");
    wrap.appendChild(head);
    stageEl.appendChild(wrap);

    if (g.kind === "hub") {
      loadArcade().then(function () {
        if (view !== "game") return;
        head.appendChild(coinPill());
        var layout = h("div", "hg-layout hg-layout--" + g.id);
        var stage = h("div", "hg-panel hg-stage");
        var side = h("div", "hg-panel hg-side");
        var rec = h("div", "hg-record");
        function paintRec() {
          var v = Number(arcade.best[g.id]) || 0;
          rec.textContent = v ? "Record: +" + fmt(v) + " munten" : "Nog geen record";
        }
        paintRec();
        side.appendChild(rec);
        layout.appendChild(stage);
        layout.appendChild(side);
        wrap.appendChild(layout);
        var disposers = [];
        viewDispose.push(function () {
          disposers.forEach(function (fn) {
            fn();
          });
        });
        var games = window.sscHubGames || {};
        if (typeof games[g.id] !== "function") {
          stage.appendChild(h("div", "hub-empty", "Dit spel kon niet laden."));
          return;
        }
        games[g.id](stage, side, {
          coins: function () {
            return arcade.coins;
          },
          take: function (n) {
            n = Math.floor(n);
            if (!(n > 0) || n > arcade.coins) return false;
            arcade.coins -= n;
            saveArcade();
            return true;
          },
          give: function (n) {
            n = Math.floor(n);
            if (!(n > 0)) return;
            arcade.coins += n;
            arcade.peak = Math.max(arcade.peak || 0, arcade.coins);
            saveArcade();
          },
          record: function (n) {
            if (n > (Number(arcade.best[g.id]) || 0)) {
              arcade.best[g.id] = Math.floor(n);
              saveArcade();
              paintRec();
              rec.setAttribute("data-new", "1");
            }
          },
          onDispose: function (fn) {
            disposers.push(fn);
          },
        });
      });
      return;
    }

    // Snake and 2048: the start page widgets themselves.
    loadArcade().then(function () {
      if (view === "game") head.appendChild(coinPill()); // they pay coins now, so the balance shows here too
    });
    var holder = h("div", "arc-widget");
    holder.appendChild(h("div", "hub-loading", "Laden…"));
    wrap.appendChild(holder);
    renderWidget(g.widget, holder, function (card) {
      var focusable = card.querySelector("[tabindex], .ssc-gm-stage");
      if (focusable) focusable.focus({ preventScroll: true });
    });
  }

  /** Renders start page widget `id` into holder; the card is disposed with the view. */
  function renderWidget(id, holder, after) {
    var token = {};
    viewDispose.push(function () {
      token.dead = true;
    });
    loadModule("widgets").then(function (ok) {
      if (token.dead) return;
      holder.textContent = "";
      var kit = window.sscWidgetKit;
      if (!ok || !kit || typeof kit.render !== "function") {
        holder.appendChild(h("div", "hub-empty", "Dit onderdeel kon niet laden."));
        return;
      }
      ensureKitCss();
      var made = kit.render(id);
      holder.appendChild(made.node);
      viewDispose.push(made.dispose);
      if (after) setTimeout(function () {
        if (!token.dead) after(made.node);
      }, 80);
    });
  }

  /* ================================================================ */
  /* Rekentoestel: the TI-84 programs as a hub panel                   */
  /* ================================================================ */

  /*
   * No popup any more. content.js still owns the class check and its 24h
   * cache (window.sscCalcAccess); ti84.js renders the program list. This view
   * only hosts them, so Back / Esc return to the islands.
   */
  function showCalc() {
    clearView();
    view = "calc";
    var wrap = h("div", "hub-sub hub-view calc-view");
    wrap.appendChild(subHead("Rekentoestel", "TI-84 programma's", showHome));
    var panel = h("div", "hg-panel calc-panel");
    var body = h("div", "calc-body");
    panel.appendChild(body);
    wrap.appendChild(panel);
    stageEl.appendChild(wrap);
    var token = {};
    viewDispose.push(function () {
      token.dead = true;
    });

    function loading() {
      body.textContent = "";
      var row = h("div", "calc-state");
      row.appendChild(h("span", "calc-spin"));
      row.appendChild(h("span", null, "Controleren of je toegang hebt…"));
      body.appendChild(row);
    }

    function recheck() {
      var again = btn("calc-recheck", "Opnieuw controleren");
      again.addEventListener("click", function () {
        check(true);
      });
      body.appendChild(again);
    }

    function paint(entry) {
      body.textContent = "";
      if (entry && entry.granted) {
        var target = h("div", "calc-target");
        body.appendChild(target);
        loadModule("ti84").then(function (ok) {
          if (token.dead || !target.isConnected) return;
          if (ok && window.sscTi84 && typeof window.sscTi84.render === "function") {
            ensureTiCss();
            window.sscTi84.render(target, { className: entry.className });
          } else {
            target.appendChild(h("div", "ssc-calc-empty", "Er zijn nog geen programmas beschikbaar"));
          }
        });
      } else {
        body.appendChild(h("div", "calc-denied", "Dit is niet beschikbaar voor jouw klas."));
      }
      recheck();
    }

    function check(force) {
      loading();
      var ask = typeof window.sscCalcAccess === "function" ? window.sscCalcAccess(force) : Promise.resolve(null);
      ask.then(
        function (entry) {
          if (!token.dead) paint(entry);
        },
        function () {
          if (!token.dead) paint(null);
        }
      );
    }
    check(false);
  }

  function ensureTiCss() {
    if (!shadow || shadow.querySelector("style[data-ti]") || !window.sscTi84 || !window.sscTi84.CSS) return;
    var tag = document.createElement("style");
    tag.setAttribute("data-ti", "1");
    tag.textContent = window.sscTi84.CSS;
    shadow.appendChild(tag);
  }

  /* ================================================================ */
  /* Farm: the immersive 3D scene lives in hub-farm.js                 */
  /* ================================================================ */

  function showFarm() {
    clearView();
    view = "farm";
    var wrap = h("div", "hub-sub hub-view farm-wrap");
    wrap.appendChild(subHead("Boerderij", "Jouw boerderij", showHome));
    var holder = h("div", "farm-holder");
    holder.appendChild(h("div", "hub-loading", "Laden…"));
    wrap.appendChild(holder);
    stageEl.appendChild(wrap);
    var token = {};
    viewDispose.push(function () {
      token.dead = true;
    });
    loadModule("farm").then(function (ok) {
      if (token.dead) return;
      holder.textContent = "";
      if (!ok || !window.sscHubFarm || typeof window.sscHubFarm.mount !== "function") {
        holder.appendChild(h("div", "hub-empty", "De boerderij kon niet laden."));
        return;
      }
      ensureKitCss();
      var farm = window.sscHubFarm.mount(holder, shadow);
      viewDispose.push(farm.dispose);
    });
  }

  /* Chess: board, bots and review live in hub-chess.js */
  function showChess() {
    clearView();
    view = "chess";
    var wrap = h("div", "hub-sub hub-view");
    wrap.appendChild(subHead("Schaken", "Schaakbord", showHome));
    var holder = h("div", "chess-holder");
    holder.appendChild(h("div", "hub-loading", "Laden…"));
    wrap.appendChild(holder);
    stageEl.appendChild(wrap);
    var token = {};
    viewDispose.push(function () {
      token.dead = true;
    });
    loadModule("chess").then(function (ok) {
      if (token.dead) return;
      holder.textContent = "";
      if (!ok || !window.sscHubChess) {
        holder.appendChild(h("div", "hub-empty", "Schaken kon niet laden."));
        return;
      }
      viewDispose.push(window.sscHubChess.mount(holder, shadow).dispose);
    });
  }

  /* ================================================================ */
  /* Styles                                                            */
  /* ================================================================ */

  var CSS = [
    ":host { all: initial; }",
    /*
     * Every colour comes from the active theme through the custom properties
     * layout.js writes on <html> (--ssc-base00..03, --ssc-text, --ssc-accent and
     * the named palette). They inherit into this shadow root, so a theme switch
     * repaints the hub with no JS. The --hb-* layer below is the ONLY place a
     * fallback is named, and fallbacks are CSS system colours (Canvas,
     * CanvasText, Highlight) or colour names: with "Geen thema" the hub follows
     * the browser's own light/dark scheme. No hex colour exists in this sheet.
     */
    ".hub {",
    "  --hb-bg: var(--ssc-base00, Canvas);",
    "  --hb-bg2: var(--ssc-base01, color-mix(in srgb, Canvas 90%, CanvasText));",
    "  --hb-ink: var(--ssc-text, CanvasText);",
    "  --hb-acc: var(--ssc-accent, Highlight);",
    "  --hb-on-acc: var(--hb-bg);",
    "  --hb-red: var(--ssc-red, crimson);",
    "  --hb-green: var(--ssc-green, seagreen);",
    "  --hb-blue: var(--ssc-blue, royalblue);",
    "  --hb-orange: var(--ssc-orange, darkorange);",
    "  --hb-gold: var(--ssc-yellow, gold);",
    "  --hb-black: var(--ssc-black, black);",
    "  --ink: var(--hb-ink);",
    "  --muted: color-mix(in srgb, var(--hb-ink) 64%, transparent);",
    "  --line: color-mix(in srgb, var(--hb-ink) 14%, transparent);",
    "  --hb-fill: color-mix(in srgb, var(--hb-ink) 7%, transparent);",
    "  --hb-fill2: color-mix(in srgb, var(--hb-ink) 14%, transparent);",
    "  --hb-field: color-mix(in srgb, var(--hb-ink) 9%, transparent);",
    "  --hb-glass: color-mix(in srgb, var(--hb-bg) 58%, transparent);",
    "  --hb-glass2: color-mix(in srgb, var(--hb-bg) 74%, transparent);",
    "  --hb-hi: color-mix(in srgb, white 15%, transparent);",
    "  --hb-shade: color-mix(in srgb, black 42%, transparent);",
    "  position: fixed; inset: 0; z-index: 2147483050; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain;",
    "  font-family: ui-sans-serif, 'Segoe UI Variable Display', 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif;",
    "  font-size: 14px; line-height: 1.45; color: var(--ink); -webkit-font-smoothing: antialiased;",
    // Glass: the theme's own base colour, see-through, over a blurred page and
    // wallpaper. A custom wallpaper therefore shows through the hub.
    "  background: color-mix(in srgb, var(--hb-bg) 62%, transparent); backdrop-filter: blur(22px) saturate(1.3); -webkit-backdrop-filter: blur(22px) saturate(1.3);",
    "  opacity: 0; transition: opacity .3s ease; }",
    ".hub[data-open='1'] { opacity: 1; }",
    ".hub[data-gone] { display: none; }",
    ".hub *, .hub *::before, .hub *::after { box-sizing: border-box; }",
    ":where(.hub) button { font: inherit; color: inherit; }", // :where keeps this below every button class rule
    ".hub-ico { display: inline-grid; place-items: center; width: 18px; height: 18px; flex: none; }",
    ".hub-ico svg { width: 100%; height: 100%; display: block; }",
    ".hub ::-webkit-scrollbar { width: 12px; height: 12px; } .hub ::-webkit-scrollbar-track { background: transparent; }",
    ".hub ::-webkit-scrollbar-thumb { border: 3px solid transparent; border-radius: 99px; background-clip: padding-box; background-color: var(--hb-fill2); }",
    ".hub ::-webkit-scrollbar-thumb:hover { background-color: color-mix(in srgb, var(--hb-acc) 60%, transparent); }",

    /* background */
    ".hub-bg { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }",
    ".hub-blob { position: absolute; width: 70vmax; height: 70vmax; border-radius: 50%; opacity: .5; will-change: transform; }",
    ".hub-blob--a { left: -20vmax; top: -30vmax; background: radial-gradient(circle, color-mix(in srgb, var(--hb-acc) 50%, transparent), transparent 62%); animation: hub-drift-a 26s ease-in-out infinite alternate; }",
    ".hub-blob--b { right: -25vmax; top: -10vmax; background: radial-gradient(circle, color-mix(in srgb, var(--hb-blue) 42%, transparent), transparent 62%); animation: hub-drift-b 32s ease-in-out infinite alternate; }",
    ".hub-blob--c { left: 10vmax; bottom: -45vmax; background: radial-gradient(circle, color-mix(in srgb, var(--hb-red) 34%, transparent), transparent 62%); animation: hub-drift-c 38s ease-in-out infinite alternate; }",
    "@keyframes hub-drift-a { to { transform: translate3d(14vmax, 10vmax, 0) scale(1.15); } }",
    "@keyframes hub-drift-b { to { transform: translate3d(-12vmax, 14vmax, 0) scale(.9); } }",
    "@keyframes hub-drift-c { to { transform: translate3d(10vmax, -12vmax, 0) scale(1.1); } }",
    ".hub-grid-lines { position: absolute; inset: 0; opacity: .5;",
    "  background-image: linear-gradient(var(--hb-fill) 1px, transparent 1px), linear-gradient(90deg, var(--hb-fill) 1px, transparent 1px);",
    "  background-size: 56px 56px; -webkit-mask-image: radial-gradient(ellipse at 50% 30%, black 20%, transparent 75%); mask-image: radial-gradient(ellipse at 50% 30%, black 20%, transparent 75%); }",

    /* shell */
    ".hub-shell { position: relative; display: flex; flex-direction: column; gap: 22px; width: 100%; max-width: 1240px; min-height: 100%; margin: 0 auto; padding: 24px 32px 36px; }",
    ".hub-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; }",
    ".hub-brand { display: flex; align-items: center; gap: 12px; }",
    ".hub-logo { width: 42px; height: 42px; border-radius: 12px; box-shadow: 0 10px 24px -8px var(--hb-shade); }",
    ".hub-brand-words { display: flex; flex-direction: column; }",
    ".hub-greet { font-size: 12px; font-weight: 600; color: var(--muted); letter-spacing: .02em; }",
    ".hub-title { font-size: 26px; font-weight: 800; letter-spacing: -.02em; line-height: 1.05;",
    "  background: linear-gradient(90deg, var(--hb-ink), var(--hb-acc)); -webkit-background-clip: text; background-clip: text; color: transparent; }",
    ".hub-top-right { display: flex; align-items: center; gap: 10px; }",
    ".hub-clock { font-size: 12.5px; font-weight: 600; color: var(--muted); padding: 8px 14px; border-radius: 99px; background: var(--hb-glass);",
    "  box-shadow: inset 0 0 0 1px var(--line); text-transform: capitalize; white-space: nowrap; }",
    ".hub-round { display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 50%; cursor: pointer;",
    "  background: var(--hb-glass); box-shadow: inset 0 0 0 1px var(--line), 0 8px 18px -8px var(--hb-shade); transition: transform .2s ease, background .2s ease; }",
    ".hub-round:hover { background: var(--hb-fill2); transform: rotate(90deg); }",
    ".hub-round:focus-visible, .hub-back:focus-visible, .isl:focus-visible, .gc:focus-visible { outline: 2px solid var(--hb-acc); outline-offset: 3px; }",
    ".hub-stage { flex: 1; display: flex; flex-direction: column; min-height: 0; }",
    ".hub-view { animation: hub-view-in .5s cubic-bezier(.2,.9,.25,1) both; }",
    "@keyframes hub-view-in { from { opacity: 0; transform: translate3d(0, 16px, 0); } }",

    /* islands grid */
    ".hub-home { flex: 1; display: grid; gap: 20px; grid-template-columns: repeat(4, minmax(0, 1fr));",
    "  grid-template-rows: repeat(2, minmax(260px, 1fr)); grid-template-areas: 'arcade arcade school stadion' 'arcade arcade farm chess'; }",
    /* only when the calculator is allowed (set by hub.js): it becomes the wide bar underneath */
    ".hub-home[data-calc] { grid-template-rows: repeat(2, minmax(260px, 1fr)) minmax(200px, auto);",
    "  grid-template-areas: 'arcade arcade school stadion' 'arcade arcade farm chess' 'calc calc calc calc'; }",
    ".isl--arcade { grid-area: arcade; } .isl--school { grid-area: school; } .isl--stadion { grid-area: stadion; }",
    ".isl--farm { grid-area: farm; } .isl--chess { grid-area: chess; } .isl--calc { grid-area: calc; min-height: 200px; }",
    "@media (max-width: 980px) { .hub-home, .hub-home[data-calc] { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: none; grid-auto-rows: minmax(250px, auto);",
    "  grid-template-areas: 'arcade arcade' 'school stadion' 'farm chess'; } .hub-home[data-calc] { grid-template-areas: 'arcade arcade' 'school stadion' 'farm chess' 'calc calc'; }",
    "  .hub-shell { padding: 18px 16px 28px; } .hub-clock { display: none; } }",
    "@media (max-width: 560px) { .hub-home, .hub-home[data-calc] { grid-template-columns: minmax(0, 1fr); grid-template-areas: 'arcade' 'school' 'stadion' 'farm' 'chess'; }",
    "  .hub-home[data-calc] { grid-template-areas: 'arcade' 'school' 'stadion' 'farm' 'chess' 'calc'; } .isl--arcade { min-height: 320px; } }",

    ".isl { position: relative; perspective: 1100px; cursor: pointer; outline: none; border-radius: 30px; min-height: 250px;",
    "  animation: isl-in .8s cubic-bezier(.2,.9,.25,1) both; animation-delay: calc(var(--i) * 70ms + 60ms); }",
    "@keyframes isl-in { from { opacity: 0; transform: translate3d(0, 46px, 0) scale(.94); } }",
    ".isl-tilt { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .7s cubic-bezier(.2,.9,.25,1); }",
    ".isl[data-hover] .isl-tilt { transition: transform .18s ease-out; }",
    ".isl[data-press] .isl-tilt { transform: scale(.97) !important; transition: transform .12s ease; }",
    ".isl-glass { position: absolute; inset: 0; border-radius: 30px;",
    "  background: linear-gradient(155deg, var(--hb-fill2), var(--hb-fill) 52%),",
    "    radial-gradient(110% 80% at 88% 100%, color-mix(in srgb, var(--c1) 40%, transparent), transparent 62%),",
    "    radial-gradient(80% 70% at 0% 0%, color-mix(in srgb, var(--c2) 24%, transparent), transparent 60%), var(--hb-glass);",
    "  box-shadow: inset 0 1px 0 var(--hb-hi), inset 0 0 0 1px var(--line),",
    "    0 34px 60px -26px var(--hb-shade), 0 14px 30px -18px color-mix(in srgb, var(--c1) 60%, transparent); }",
    ".isl-glass::after { content: ''; position: absolute; inset: 0; border-radius: inherit; opacity: 0; transition: opacity .3s ease;",
    "  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c1) 60%, var(--hb-hi)), 0 0 40px -6px color-mix(in srgb, var(--c1) 55%, transparent); }",
    ".isl:hover .isl-glass::after, .isl:focus-visible .isl-glass::after { opacity: 1; }",
    ".isl-text { position: absolute; left: 24px; top: 22px; right: 24px; transform: translateZ(28px); pointer-events: none; }",
    ".isl-kicker { display: inline-block; font-size: 10.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; padding: 4px 9px; border-radius: 99px;",
    "  color: var(--hb-ink); background: color-mix(in srgb, var(--c1) 22%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c1) 40%, transparent); }",
    ".isl-title { margin: 10px 0 2px; font-size: 25px; font-weight: 800; letter-spacing: -.02em; line-height: 1.1; color: var(--hb-ink); }",
    ".isl--arcade .isl-title { font-size: 40px; }",
    ".isl-sub { margin: 0; max-width: 62%; font-size: 13px; color: var(--muted); }",
    ".isl--arcade .isl-sub { max-width: 46%; font-size: 14.5px; }",
    ".isl-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; max-width: 64%; }",
    ".isl--arcade .isl-meta { max-width: 46%; margin-top: 18px; }",
    ".isl-chip { font-size: 11px; font-weight: 700; padding: 4px 9px; border-radius: 99px; color: var(--hb-ink); background: var(--hb-fill2);",
    "  box-shadow: inset 0 0 0 1px var(--line); white-space: nowrap; animation: hub-view-in .4s ease both; }",
    ".isl-chip--gold { color: var(--hb-black); background: var(--hb-gold); box-shadow: none; }",
    ".isl-art { position: absolute; right: 3%; bottom: 4%; width: 54%; max-width: 230px; transform: translateZ(64px); pointer-events: none; }",
    ".isl--arcade .isl-art { right: 3%; bottom: 8%; width: 56%; max-width: 470px; }",
    /* the wide chess card: size the render by height so it never leaves the card */
    ".isl--calc .isl-art { width: auto; height: 86%; max-width: none; right: 4%; bottom: 6%; } .isl--calc .isl-float, .isl--calc .isl-float img { height: 100%; width: auto; }",
    ".isl-float { position: relative; animation: isl-bob 6.5s ease-in-out infinite; animation-delay: calc(var(--i) * -1.3s); will-change: transform; }",
    ".isl-float img { display: block; width: 100%; height: auto; user-select: none; }",
    ".isl-shadow { position: absolute; left: 22%; right: 22%; bottom: -6%; height: 12%; border-radius: 50%;",
    "  background: radial-gradient(closest-side, var(--hb-shade), transparent); animation: isl-shadow 6.5s ease-in-out infinite; animation-delay: calc(var(--i) * -1.3s); }",
    "@keyframes isl-bob { 0%, 100% { transform: translate3d(0, 0, 0) rotate(-.7deg); } 50% { transform: translate3d(0, -12px, 0) rotate(.7deg); } }",
    "@keyframes isl-shadow { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(.8); opacity: .6; } }",
    ".isl:hover .isl-float { animation-duration: 3.2s; }",
    ".isl-go { position: absolute; left: 24px; bottom: 22px; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%;",
    "  transform: translateZ(40px); color: var(--hb-on-acc); background: var(--c1);",
    "  box-shadow: 0 10px 20px -8px var(--c1), inset 0 1px 0 var(--hb-hi); transition: transform .3s cubic-bezier(.3,1.6,.5,1); }",
    ".isl:hover .isl-go { transform: translateZ(40px) translateX(4px) scale(1.08); }",
    ".isl-shine { position: absolute; inset: 0; border-radius: 30px; overflow: hidden; pointer-events: none; transform: translateZ(1px); }",
    ".isl-shine i { position: absolute; left: -40%; top: -40%; width: 80%; height: 80%; border-radius: 50%; opacity: 0; transition: opacity .3s ease;",
    "  background: radial-gradient(closest-side, var(--hb-hi), transparent); }",
    ".isl[data-hover] .isl-shine i { opacity: 1; }",

    /* sub views */
    ".hub-sub { flex: 1; display: flex; flex-direction: column; gap: 18px; position: relative; }",
    ".hub-subhead { position: relative; z-index: 2; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }",
    ".hub-back { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px 9px 10px; border: 0; border-radius: 99px; cursor: pointer;",
    "  font-size: 13px; font-weight: 700; background: var(--hb-glass); box-shadow: inset 0 0 0 1px var(--line); transition: background .2s, transform .2s; }",
    ".hub-back:hover { background: var(--hb-fill2); transform: translateX(-2px); }",
    ".hub-subwords { display: flex; flex-direction: column; }",
    ".hub-subkicker { font-size: 10.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }",
    ".hub-subtitle { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -.02em; line-height: 1.1; }",
    ".hub-spacer { flex: 1; }",
    ".hub-coins { display: inline-flex; align-items: center; gap: 8px; padding: 6px 6px 6px 12px; border-radius: 99px;",
    "  background: var(--hb-glass); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hb-gold) 45%, transparent); }",
    ".hub-coins[data-bump='1'] b { animation: hub-bump .35s ease; }",
    "@keyframes hub-bump { 40% { transform: scale(1.18); } }",
    ".hub-coins b { display: inline-block; font-size: 15px; font-variant-numeric: tabular-nums; min-width: 40px; }",
    ".hub-coin { width: 18px; height: 18px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--hb-gold) 35%, white), var(--hb-gold) 45%, color-mix(in srgb, var(--hb-gold) 55%, black));",
    "  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--hb-gold) 50%, black); }",
    ".hub-refill { border: 0; cursor: pointer; padding: 6px 11px; border-radius: 99px; font-size: 12px; font-weight: 800; color: var(--hb-black); background: var(--hb-gold); }",
    ".hub-refill[hidden] { display: none; }",
    ".pz-layer { position: absolute; inset: 0; z-index: 50; display: grid; place-items: center; padding: 16px; background: rgb(0 0 0 / .55); backdrop-filter: blur(6px); }",
    ".pz-card { position: relative; display: flex; flex-direction: column; gap: 12px; width: min(100%, 460px); padding: 22px; border-radius: 22px; color: var(--hb-ink); background-color: Canvas; background-image: linear-gradient(var(--hb-bg), var(--hb-bg));",
    "  box-shadow: 0 24px 60px rgb(0 0 0 / .45), inset 0 0 0 1px var(--line); }",
    ".pz-title { font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }",
    ".pz-q { font-size: 15px; font-weight: 600; line-height: 1.45; white-space: pre-line; max-height: 50vh; overflow: auto; }",
    ".pz-seq { font: 900 24px/1.35 ui-monospace, Menlo, Consolas, monospace; white-space: pre; text-align: center; }",
    ".pz-input { font: inherit; font-size: 18px; font-weight: 800; padding: 10px 12px; border-radius: 12px; border: 0; color: var(--hb-ink); background: var(--hb-field); box-shadow: inset 0 0 0 1px var(--line); outline: none; }",
    ".pz-msg { min-height: 20px; font-size: 13px; color: var(--muted); }",
    ".pz-msg[data-ok='1'] { color: var(--hb-green); font-weight: 800; } .pz-msg[data-ok='0'] { color: var(--hb-red); font-weight: 800; }",
    ".pz-go { padding: 11px 16px; font-size: 14px; }",
    ".pz-board { --pz-t: 52px; --pz-g: 5px; position: relative; align-self: center; padding: 0 20px; }",
    ".pz-board[hidden], .pz-input[hidden] { display: none; }",
    ".pz-grid { display: grid; grid-template-columns: repeat(5, var(--pz-t)); gap: var(--pz-g); }",
    ".pz-tile { position: relative; width: var(--pz-t); height: var(--pz-t); padding: 0; border: 0; border-radius: 12px; cursor: pointer; color: var(--hb-ink); background: var(--hb-field); box-shadow: inset 0 0 0 1px var(--line); }",
    ".pz-tile:not([data-on]) .pz-pipe { opacity: .45; }", // fade the whole pipe, a translucent color would stack where arms overlap
    ".pz-tile:focus-visible { outline: 2px solid var(--hb-acc); outline-offset: 2px; }",
    ".pz-tile[data-on] { color: var(--hb-gold); } .pz-board[data-ok] .pz-tile[data-on] { color: var(--hb-green); }",
    ".pz-pipe { position: absolute; inset: 0; transition: transform .18s cubic-bezier(.3,1.4,.5,1); }",
    ".pz-arm, .pz-dot { position: absolute; background: currentColor; }",
    ".pz-arm--1, .pz-arm--4 { left: calc(50% - 6px); width: 12px; height: 50%; } .pz-arm--1 { top: 0; } .pz-arm--4 { bottom: 0; }",
    ".pz-arm--2, .pz-arm--8 { top: calc(50% - 6px); height: 12px; width: 50%; } .pz-arm--2 { right: 0; } .pz-arm--8 { left: 0; }",
    ".pz-dot { left: calc(50% - 6px); top: calc(50% - 6px); width: 12px; height: 12px; }",
    ".pz-mark { position: absolute; width: 0; height: 0; border: 9px solid transparent; border-left: 13px solid var(--hb-acc); }",
    ".pz-mark--in { left: 4px; top: calc((var(--pz-t) + var(--pz-g)) * var(--pz-in) + var(--pz-t) / 2 - 9px); }",
    ".pz-mark--out { right: 4px; top: calc((var(--pz-t) + var(--pz-g)) * var(--pz-out) + var(--pz-t) / 2 - 9px); }",
    ".pz-board[data-ok] .pz-mark { border-left-color: var(--hb-green); }",
    "@media (prefers-reduced-motion: reduce) { .pz-pipe { transition: none; } }",
    ".pz-close { position: absolute; right: 12px; top: 12px; width: 30px; height: 30px; border: 0; border-radius: 50%; cursor: pointer; color: var(--hb-ink); background: var(--hb-fill2); }",
    ".hub-loading, .hub-empty { padding: 30px; text-align: center; color: var(--muted); }",

    /* arcade lobby: six games, three to a row */
    ".arc-lobby { display: grid; gap: 18px; grid-template-columns: repeat(3, minmax(0, 1fr)); }",
    ".gc { position: relative; display: flex; flex-direction: column; text-align: left; padding: 0; border: 0; cursor: pointer;",
    "  border-radius: 26px; overflow: hidden; background: linear-gradient(160deg, var(--hb-fill2), var(--hb-fill)), var(--hb-glass);",
    "  box-shadow: inset 0 1px 0 var(--hb-hi), inset 0 0 0 1px var(--line), 0 26px 50px -26px var(--hb-shade);",
    "  transition: transform .35s cubic-bezier(.2,.9,.25,1), box-shadow .35s ease; animation: isl-in .7s cubic-bezier(.2,.9,.25,1) both; animation-delay: calc(var(--i) * 60ms); }",
    ".gc:hover { transform: translate3d(0, -6px, 0); box-shadow: inset 0 1px 0 var(--hb-hi), inset 0 0 0 1px color-mix(in srgb, var(--c) 55%, transparent),",
    "  0 30px 60px -24px color-mix(in srgb, var(--c) 55%, black); }",
    ".gc-art { position: relative; height: 170px; display: grid; place-items: center;",
    "  background: radial-gradient(90% 120% at 50% 100%, color-mix(in srgb, var(--c) 38%, transparent), transparent 70%), var(--hb-bg2); }",
    ".gc-art svg { height: 82%; width: auto; max-width: 92%; transition: transform .5s cubic-bezier(.3,1.5,.5,1); }",
    ".gc:hover .gc-art svg { transform: scale(1.07) translate3d(0, -3px, 0); }",
    ".gc-info { display: flex; flex-direction: column; gap: 2px; padding: 16px 18px 18px; }",
    ".gc-name { font-size: 19px; font-weight: 800; letter-spacing: -.01em; }",
    ".gc-tag { font-size: 12.5px; color: var(--muted); }",
    ".gc-best { margin-top: 8px; font-size: 11.5px; font-weight: 800; color: color-mix(in srgb, var(--c) 70%, var(--hb-ink)); }",
    ".gc-play { position: absolute; right: 16px; top: 146px; display: grid; place-items: center; width: 46px; height: 46px; border-radius: 50%;",
    "  color: var(--hb-on-acc); background: var(--c); box-shadow: 0 12px 24px -8px var(--c), inset 0 1px 0 var(--hb-hi);",
    "  transition: transform .35s cubic-bezier(.3,1.6,.5,1); }",
    ".gc:hover .gc-play { transform: scale(1.12); }",
    ".ga-snake { stroke-dasharray: 140; animation: ga-snake 3s ease-in-out infinite alternate; }",
    "@keyframes ga-snake { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }",
    ".ga-tile { transform-box: fill-box; transform-origin: center; animation: ga-tile 2.6s ease-in-out infinite; animation-delay: var(--d); }",
    "@keyframes ga-tile { 10% { transform: scale(1.1); } 20% { transform: scale(1); } }",
    ".ga-gem { transform-box: fill-box; transform-origin: center; animation: ga-tile 2.2s ease-in-out infinite; }",
    ".ga-ball { animation: ga-ball 2.4s cubic-bezier(.5,0,.8,1) infinite; }",
    "@keyframes ga-ball { 0% { transform: translate3d(0,0,0); } 25% { transform: translate3d(-6px,18px,0); } 50% { transform: translate3d(2px,34px,0); }",
    "  75% { transform: translate3d(-4px,50px,0); } 100% { transform: translate3d(0,62px,0); opacity: 0; } }",
    ".ga-wheel { transform-origin: 60px 40px; animation: ga-wheel 9s linear infinite; } @keyframes ga-wheel { to { transform: rotate(360deg); } }",
    ".ga-card { transform-box: fill-box; transform-origin: 50% 100%; animation: ga-card 3.4s ease-in-out infinite; } .ga-card--b { animation-delay: -1.7s; }",
    "@keyframes ga-card { 0%, 100% { transform: rotate(var(--r)) translate3d(0,0,0); } 50% { transform: rotate(var(--r)) translate3d(0,-4px,0); } }",
    "@media (max-width: 860px) { .arc-lobby { grid-template-columns: repeat(2, minmax(0, 1fr)); } }",
    "@media (max-width: 520px) { .arc-lobby { grid-template-columns: minmax(0, 1fr); } }",

    /* a game */
    ".hg-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 18px; align-items: start; }",
    "@media (max-width: 860px) { .hg-layout { grid-template-columns: minmax(0, 1fr); } }",
    ".hg-panel { position: relative; border-radius: 26px; padding: 20px; background: linear-gradient(160deg, var(--hb-fill2), var(--hb-fill)), var(--hb-glass);",
    "  box-shadow: inset 0 1px 0 var(--hb-hi), inset 0 0 0 1px var(--line), 0 26px 50px -26px var(--hb-shade); }",
    ".hg-side { display: flex; flex-direction: column; gap: 14px; }",
    ".hg-record { font-size: 12px; font-weight: 800; color: color-mix(in srgb, var(--hb-gold) 70%, var(--hb-ink)); }",
    ".hg-record[data-new='1'] { animation: hub-bump .5s ease; }",
    ".arc-widget { display: flex; justify-content: center; }",
    /* The widget cards (Snake, 2048) keep the theme's own text and accent. */
    ".arc-widget .ssc-wg-card { width: min(100%, 540px); padding: 22px; border-radius: 28px; color: var(--hb-ink);",
    "  background: linear-gradient(160deg, var(--hb-fill2), var(--hb-fill)), var(--hb-glass);",
    "  box-shadow: inset 0 1px 0 var(--hb-hi), inset 0 0 0 1px var(--line), 0 30px 60px -28px var(--hb-shade); }",

    /* Rekentoestel: a panel of the hub, not a popup */
    ".calc-view { gap: 18px; }",
    ".calc-panel { padding: 24px 26px 18px; min-height: 380px; }",
    ".calc-intro { margin: 0 0 16px; font-size: 13px; color: var(--muted); }",
    ".calc-state { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 60px 8px; color: var(--muted); }",
    ".calc-spin { flex: none; width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--line); border-top-color: var(--hb-acc); animation: calc-spin .8s linear infinite; }",
    "@keyframes calc-spin { to { transform: rotate(360deg); } }",
    ".calc-denied { padding: 56px 12px; text-align: center; color: var(--muted); }",
    ".calc-recheck { display: block; margin: 16px auto 0; padding: 5px 8px; border: 0; background: transparent; cursor: pointer; font-size: 11.5px;",
    "  color: var(--muted); } .calc-recheck:hover { color: var(--hb-ink); text-decoration: underline; }",
    ".ssc-calc-empty { padding: 24px 8px; text-align: center; font-style: italic; color: var(--muted); }",

    "/* liquid glass: the backdrop is bent by a noise displacement map, then frosted */",
    ".hub-fx { position: absolute; width: 0; height: 0; overflow: hidden; }",
    ".isl { animation: isl-in .8s cubic-bezier(.2,.9,.25,1) both, isl-bob 8s ease-in-out infinite;",
    "  animation-delay: calc(var(--i) * 70ms + 60ms), calc(var(--i) * -1.3s); }",
    "@keyframes isl-bob { 50% { translate: 0 -5px; } }",
    ".isl-tilt { transition: transform .7s cubic-bezier(.34,1.56,.64,1); }",
    ".isl-glass { background: linear-gradient(155deg, var(--hb-fill2), transparent 52%),",
    "    radial-gradient(110% 80% at 88% 100%, color-mix(in srgb, var(--c1) 40%, transparent), transparent 62%),",
    "    radial-gradient(80% 70% at 0% 0%, color-mix(in srgb, var(--c2) 24%, transparent), transparent 60%),",
    "    color-mix(in srgb, var(--hb-bg) 36%, transparent);",
    "  -webkit-backdrop-filter: blur(14px) saturate(1.7); backdrop-filter: url(#hub-liquid) blur(14px) saturate(1.7);",
    "  box-shadow: inset 0 1.5px 0 color-mix(in srgb, white 26%, transparent), inset 0 -1px 0 color-mix(in srgb, black 22%, transparent),",
    "    inset 0 0 0 1px var(--line), inset 0 0 26px -8px color-mix(in srgb, white 14%, transparent),",
    "    0 34px 60px -26px var(--hb-shade), 0 14px 30px -18px color-mix(in srgb, var(--c1) 60%, transparent); }",
    ".isl-glass::before { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;",
    "  background: linear-gradient(125deg, color-mix(in srgb, white 12%, transparent), transparent 24%, transparent 76%, color-mix(in srgb, white 5%, transparent)); }",
    ".gc { transition: transform .5s cubic-bezier(.34,1.56,.64,1), box-shadow .35s ease; }",
    ".hub-view { animation: hub-view-in .55s cubic-bezier(.34,1.56,.64,1) both; }",
    ".hub-back, .hub-round { transition: background .2s ease, transform .45s cubic-bezier(.34,1.56,.64,1); }",
    ".pz-close { display: grid; place-items: center; }",
    ".isl-glass { box-shadow: inset 0 1.5px 0 color-mix(in srgb, white 30%, transparent), inset 0 -1px 0 color-mix(in srgb, black 22%, transparent),",
    "    inset 0 0 0 1px color-mix(in srgb, var(--c1) 55%, var(--hb-hi)), inset 0 0 34px -8px color-mix(in srgb, var(--c1) 45%, transparent),",
    "    0 0 38px -8px color-mix(in srgb, var(--c1) 70%, transparent), 0 34px 60px -26px var(--hb-shade); }",
    ".isl-glass::after { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--c1) 80%, white), 0 0 60px -4px color-mix(in srgb, var(--c1) 85%, transparent); }",
    ".gc, .hg-panel { box-shadow: inset 0 1.5px 0 color-mix(in srgb, white 24%, transparent), inset 0 0 0 1px var(--line), inset 0 0 26px -10px color-mix(in srgb, white 12%, transparent), 0 26px 50px -26px var(--hb-shade); }",
    ".hub button { transition: translate .4s cubic-bezier(.34,1.56,.64,1), scale .4s cubic-bezier(.34,1.56,.64,1), background .2s ease, box-shadow .25s ease, opacity .15s ease; }",
    ".hub button:hover:not(:disabled) { translate: 0 -1px; } .hub button:active:not(:disabled) { scale: .96; }",
    ".hub-back, .hub-round, .hub-refill, .hg-mini, .hg-ghost { box-shadow: inset 0 1px 0 var(--hb-hi), inset 0 0 0 1px var(--line), 0 8px 16px -10px var(--hb-shade); }",
    "/* AAA lobby: a glowing border that sweeps around each game card (in its own colour), brighter on hover */",
    ".hub { font-family: system-ui, -apple-system, 'Segoe UI Variable Display', 'Segoe UI', Roboto, sans-serif; letter-spacing: -0.011em; }",
    ".gc::after { content: ''; position: absolute; inset: 0; border-radius: inherit; padding: 1.5px; pointer-events: none; z-index: 3;",
    "  background: linear-gradient(115deg, transparent 20%, var(--c) 38%, color-mix(in srgb, var(--c) 40%, white) 50%, var(--c) 62%, transparent 80%) 0 0 / 300% 100%;",
    "  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude;",
    "  opacity: .45; animation: gc-sweep 5s linear infinite; animation-delay: calc(var(--i) * -700ms); transition: opacity .4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }",
    ".gc:hover::after, .gc:focus-visible::after { opacity: 1; animation-duration: 2.2s; }",
    ".gc:hover { transform: translate3d(0, -8px, 0) scale(1.015); }",
    ".gc { transition: transform .5s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow .35s ease; }",
    "@keyframes gc-sweep { from { background-position: 150% 0; } to { background-position: -150% 0; } }",
    "@media (prefers-reduced-motion: reduce) { .hub *, .hub *::before, .hub *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; }",
    "  .isl-tilt { transform: none !important; } }",
  ].join("\n");

  window.sscHubOpen = openHub;
  window.sscHubClose = closeHub;
})();
