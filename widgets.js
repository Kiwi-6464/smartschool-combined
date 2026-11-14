/**
 * Smartschool Combined — start-page widgets.
 *
 * Ported UX from inspiration/smpp/src/widgets/widgets.ts + widgets.css:
 *
 *   - a registry of widget definitions (`registerWidget` / WidgetBase.name /
 *     WidgetBase.category in widgets.ts:32-359), grouped by category in the
 *     bag (widgets.ts:696-728), each group a wrapping flex row
 *     (widgets.css:315-321);
 *   - one saved layout of names plus their order, persisted through the
 *     background (widgets.ts:642-671). smpp saves left/right panels; we have
 *     a single grid, so `widgetOrder` is the flat equivalent;
 *   - a drag handle on the card itself, dragging into the bag removes it
 *     (widgets.ts:92-101, 210-218, 673-694). Our explicit × button does the
 *     removal; dragging is used for reordering only.
 *
 * What is deliberately different: smpp's "bag" is a full-width drawer that
 * previews every widget at full size and requires entering an edit mode. The
 * spec for this project asks for a settings list + a "+ Widget toevoegen"
 * picker modal inside the panel, so the picker is a modal and the list is
 * compact. The grouping and the "add one at a time" flow are the same.
 *
 * Everything lives in the existing shadow root. `#ssc-widgets` is anchored to
 * the page's own widget container and follows it on scroll; it is hidden on
 * every page that has no `#container` (i.e. anything but the start page).
 */
(function () {
  "use strict";

  // Sign-in pages: do nothing at all (see guard.js).
  if (window.sscSkipPage) return;

  if (window.sscWidgetsStart) return;

  var DATA_KEY = "sscWidgetData";

  var CATEGORY_LABEL = {
    productiviteit: "Productiviteit",
    school: "School",
    fun: "Fun",
    overig: "Overig",
  };
  var CATEGORY_ORDER = ["productiviteit", "school", "fun", "overig"];

  /* ---------- widget data (content, not enable/order) ---------- */

  var dataCache = null;
  var dataTimer = null;

  function readData(cb) {
    if (dataCache) {
      cb(dataCache);
      return;
    }
    try {
      chrome.storage.local.get([DATA_KEY], function (res) {
        if (chrome.runtime.lastError) {
          dataCache = {};
        } else {
          dataCache = (res && res[DATA_KEY]) || {};
        }
        cb(dataCache);
      });
    } catch (e) {
      dataCache = {};
      cb(dataCache);
    }
  }

  function patchData(patch) {
    readData(function (cur) {
      var next = Object.assign({}, cur, patch);
      dataCache = next;
      if (dataTimer) window.clearTimeout(dataTimer);
      dataTimer = window.setTimeout(function () {
        var payload = {};
        payload[DATA_KEY] = dataCache;
        try {
          chrome.storage.local.set(payload);
        } catch (e) {
          /* The page still works; the note just will not survive a reload. */
        }
      }, 300);
    });
  }

  function getData(key, fallback) {
    var value = dataCache ? dataCache[key] : undefined;
    return value === undefined ? fallback : value;
  }

  /* ---------- planner API (same endpoint as smpp) ---------- */

  /*
   * smpp's getUserId() (fixes-utils/utils.ts:35-86), ported as is:
   * #datePickerMenu[plannerurl] first, and when found it is remembered in a
   * 30-day `plannerUrl` cookie, because the element is not on every page and
   * not always rendered yet. Without the element, that cookie. The id is
   * segment 4 of the URL. It is NOT digits only (it can look like
   * "1234_567_0"): the old digits-only check threw every real id away, which
   * is why Planner, Taken and Volgend lesuur stayed empty.
   */
  function plannerUser() {
    var url = null;
    var menu = document.getElementById("datePickerMenu");
    var attr = menu && menu.getAttribute("plannerurl");
    if (attr) {
      url = attr;
      try {
        var expires = new Date();
        expires.setDate(expires.getDate() + 30);
        document.cookie = "plannerUrl=" + attr + ";expires=" + expires.toUTCString() + ";path=/";
      } catch (e) {
        /* A blocked cookie only costs the fallback. */
      }
    } else {
      var m = /(?:^|;\s*)plannerUrl=([^;]+)/.exec(document.cookie || "");
      if (m) url = decodeURIComponent(m[1]);
    }
    if (!url) return null;
    var user = url.split("/")[4];
    return user ? user : null;
  }

  /*
   * #datePickerMenu is part of the topbar and can arrive after the widgets.
   * Up to ~4s of retries before a widget reports "no user id".
   */
  function whenPlannerUser(cb) {
    var tries = 0;
    (function attempt() {
      var user = plannerUser();
      if (user || tries >= 8) {
        cb(user);
        return;
      }
      tries++;
      window.setTimeout(attempt, 500);
    })();
  }

  function dateString(offsetDays) {
    var d = new Date();
    d.setDate(d.getDate() + (offsetDays || 0));
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    if (m.length < 2) m = "0" + m;
    if (day.length < 2) day = "0" + day;
    return d.getFullYear() + "-" + m + "-" + day;
  }

  /**
   * `/planner/api/v1/planned-elements/user/<id>?from=&to=&types=` — the exact
   * call smpp's assignments.ts:42-46 and planner.ts:46 make.
   */
  function fetchPlanned(types, fromOffset, toOffset) {
    return new Promise(function (resolve) {
      whenPlannerUser(resolve);
    }).then(function (user) {
      if (!user) {
        var err = new Error("no user");
        err.sscReason = "user";
        throw err;
      }
      var url =
        location.origin +
        "/planner/api/v1/planned-elements/user/" + user +
        "?from=" + dateString(fromOffset) +
        "&to=" + dateString(toOffset) +
        (types ? "&types=" + types : "");
      return fetch(url, { credentials: "include", headers: { Accept: "application/json" } })
        .then(function (r) {
          if (!r.ok) {
            var e = new Error("HTTP " + r.status);
            e.sscReason = "http";
            e.sscStatus = r.status;
            throw e;
          }
          return r.json();
        })
        .then(function (data) {
          return Array.isArray(data) ? data : [];
        });
    });
  }

  /** Dutch error line for a failed planner call. */
  function plannerError(what, err) {
    if (err && err.sscReason === "user") {
      return "Laden van " + what + " mislukt: je Smartschool-gebruiker is niet gevonden. Herlaad de pagina.";
    }
    if (err && err.sscReason === "http") {
      return "Laden van " + what + " mislukt (fout " + err.sscStatus + " van Smartschool). Probeer later opnieuw.";
    }
    return "Laden van " + what + " mislukt: geen verbinding met Smartschool.";
  }

  function roomsOf(element) {
    return (element.locations || [])
      .map(function (l) {
        return l && (l.title || l.name);
      })
      .filter(Boolean);
  }

  function teachersOf(element) {
    var users = (element.organisers && element.organisers.users) || [];
    return users
      .map(function (u) {
        return u && u.name && (u.name.startingWithFirstName || u.name.startingWithLastName);
      })
      .filter(Boolean);
  }

  /** smpp's colour classes: "red-200" → c-red-combo--200 (Smartschool's CSS). */
  function colorClass(element) {
    if (!element.color || element.color.indexOf("-") < 0) return null;
    var parts = element.color.split("-");
    return "c-" + parts[0] + "-combo--" + parts[1];
  }

  function timeOf(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return (
      String(d.getHours()).padStart(2, "0") +
      ":" +
      String(d.getMinutes()).padStart(2, "0")
    );
  }

  function subjectOf(element) {
    if (element.name) return element.name;
    if (element.courses && element.courses[0]) {
      return element.courses[0].name || "Opdracht";
    }
    return "Opdracht";
  }


  /* ---------- line icons ---------- */

  /*
   * One stroked 24-unit icon per widget and per glyph the widgets show
   * (weather, shortcuts). currentColor, so they follow the theme's ink.
   * Entries are [tag, attrs]; a bare string is a path.
   */
  var WICONS = {
    notes: ["M6 3.5h9l3.5 3.5v13.5H6z", "M14.5 3.5V7.5h4M9 11h6M9 14.5h6M9 18h3.5"],
    clock: [["circle", { cx: 12, cy: 12, r: 8.5 }], "M12 7.5V12l3 2"],
    hourglass: ["M7 3.5h10M7 20.5h10M8 3.5c0 4.5 8 4.5 8 8.5s-8 4-8 8.5M16 3.5c0 4.5-8 4.5-8 8.5s8 4 8 8.5"],
    check: [["rect", { x: 3.5, y: 3.5, width: 17, height: 17, rx: 4 }], "M8 12.3l2.8 2.7L16.2 9"],
    sun: [["circle", { cx: 12, cy: 12, r: 4 }], "M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"],
    paw: ["M12 13.2c-2.9 0-5.2 2.4-5.2 4.6 0 1.6 1.3 2.4 2.7 2.4.9 0 1.6-.5 2.5-.5s1.6.5 2.5.5c1.4 0 2.7-.8 2.7-2.4 0-2.2-2.3-4.6-5.2-4.6z",
      ["circle", { cx: 6.4, cy: 10.6, r: 1.8 }], ["circle", { cx: 9.6, cy: 6.7, r: 1.8 }], ["circle", { cx: 14.4, cy: 6.7, r: 1.8 }], ["circle", { cx: 17.6, cy: 10.6, r: 1.8 }]],
    drop: ["M12 3.5c3.6 4.3 5.6 7.4 5.6 10.1a5.6 5.6 0 0 1-11.2 0c0-2.7 2-5.8 5.6-10.1z"],
    cloudSun: ["M7.5 3v1.5M3 7.5h1.5M4.3 4.3l1 1M10.7 4.3l-1 1", "M5.5 10.2A3.5 3.5 0 0 1 11 6.4", "M8 20h9a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.6A3.3 3.3 0 0 0 8 20z"],
    cloud: ["M7 19h10.5a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.3 11.5 3.8 3.8 0 0 0 7 19z"],
    fog: ["M7 13h10.5a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.3 5.5 3.8 3.8 0 0 0 7 13z", "M4 17h16M6.5 20.5h11"],
    drizzle: ["M7 15h10.5a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.3 7.5 3.8 3.8 0 0 0 7 15z", "M9 18.5v1M13 18.5v1M17 18.5v1"],
    rain: ["M7 14h10.5a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.3 6.5 3.8 3.8 0 0 0 7 14z", "M8.5 17l-1 3M12.5 17l-1 3M16.5 17l-1 3"],
    snow: ["M7 13.5h10.5a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.3 6 3.8 3.8 0 0 0 7 13.5z", "M8.5 17.5h.01M12 19h.01M15.5 17.5h.01M10 21h.01M14 21h.01"],
    storm: ["M7 14h10.5a4.5 4.5 0 0 0 .4-9A6 6 0 0 0 6.3 6.5 3.8 3.8 0 0 0 7 14z", "M12.5 14.5l-2.5 4h3.5l-2 3.5"],
    thermo: ["M10 4.5a2 2 0 0 1 4 0v9.3a4 4 0 1 1-4 0z", "M12 10v6"],
    calendar: [["rect", { x: 3.5, y: 5, width: 17, height: 15.5, rx: 3 }], "M3.5 10h17M8 3v4M16 3v4M7.5 14h2M11 14h2M14.5 14h2M7.5 17.5h2M11 17.5h2"],
    sprout: ["M12 20.5v-8", "M12 12.5c0-4 2.6-6.5 7-6.5 0 4.2-2.7 6.5-7 6.5z", "M12 15c0-3-2.2-5-5.5-5 0 3.2 2.2 5 5.5 5z", "M7.5 20.5h9"],
    star: ["M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"],
    chart: ["M3.5 3.5v17h17", "M7.5 15l4-4.5 3 3 5.5-6.5", "M15.5 7h4.5v4.5"],
    calc: [["rect", { x: 5, y: 2.5, width: 14, height: 19, rx: 2.5 }], ["rect", { x: 8, y: 5.5, width: 8, height: 4, rx: 1 }],
      "M8.5 13.5h.01M12 13.5h.01M15.5 13.5h.01M8.5 17.5h.01M12 17.5h.01M15.5 17.5h.01"],
    beach: ["M3.5 20.5h17", "M12.5 20.5L9 9", "M3.8 11.2a8 8 0 0 1 14.6-4.4z", "M9 9c.5-2.7 2.3-4.8 5-5.7"],
    party: ["M4 20l5-13 8 8z", "M9 7l8 8", "M14 3.5c.5 1.5 0 2.5-1 3M20.5 10c-1.5-.5-2.5 0-3 1M17 4.5h.01M20 7h.01M19 3h.01"],
    link: ["M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2", "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"],
    mail: [["rect", { x: 3, y: 5.5, width: 18, height: 13, rx: 2.5 }], "M3.5 7l8.5 6 8.5-6"],
    chat: ["M20.5 11.5a8 8 0 0 1-11.7 7.1L3.5 20.5l1.8-4.9a8 8 0 1 1 15.2-4.1z"],
    users: [["circle", { cx: 9, cy: 8.5, r: 3.5 }], "M2.5 20a6.5 6.5 0 0 1 13 0", "M16 5.3a3.5 3.5 0 0 1 0 6.4M18.5 20a6.5 6.5 0 0 0-2.4-5"],
    list: ["M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"],
    snake: ["M4 17.5c0 2 1.6 3 3.5 3h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6H17", "M17 8.5h1.5a2 2 0 0 0 0-4H17", "M17.6 6.5h.01"],
    tiles: [["rect", { x: 3.5, y: 3.5, width: 7.5, height: 7.5, rx: 2 }], ["rect", { x: 13, y: 3.5, width: 7.5, height: 7.5, rx: 2 }],
      ["rect", { x: 3.5, y: 13, width: 7.5, height: 7.5, rx: 2 }], ["rect", { x: 13, y: 13, width: 7.5, height: 7.5, rx: 2 }]],
  };

  var WSVG_NS = "http://www.w3.org/2000/svg";

  function wicon(name) {
    var svg = document.createElementNS(WSVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "ssc-wicon");
    (WICONS[name] || WICONS.star).forEach(function (part) {
      var tag = typeof part === "string" ? "path" : part[0];
      var attrs = typeof part === "string" ? { d: part } : part[1];
      var node = document.createElementNS(WSVG_NS, tag);
      Object.keys(attrs).forEach(function (k) {
        node.setAttribute(k, String(attrs[k]));
      });
      svg.appendChild(node);
    });
    return svg;
  }

  /** A span holding an icon, for places that used to hold an emoji. */
  function iconSpan(cls, name) {
    var span = h("span", cls);
    span.appendChild(wicon(name));
    return span;
  }

  /* ---------- registry ---------- */

  var SSC_WIDGETS = [
    {
      id: "notes",
      name: "Notities",
      icon: "notes",
      description: "Een kleine notitieblok op je startpagina.",
      category: "productiviteit",
      render: renderNotes,
    },
    {
      id: "nextLesson",
      name: "Volgend lesuur",
      icon: "clock",
      description: "Toont je volgende les met tijd en lokaal.",
      category: "school",
      render: renderNextLesson,
    },
    {
      id: "countdown",
      name: "Aftellen",
      icon: "hourglass",
      description: "Tel af naar een datum die jij kiest.",
      category: "productiviteit",
      render: renderCountdown,
    },
    {
      id: "assignments",
      name: "Taken",
      icon: "check",
      description: "Toont je aankomende taken.",
      category: "school",
      render: renderAssignments,
    },
    {
      id: "weather",
      name: "Weer",
      icon: "sun",
      description: "Actueel weer voor je gekozen stad.",
      category: "overig",
      render: renderWeather,
    },
    {
      id: "planner",
      name: "Planner",
      icon: "calendar",
      description: "Vandaag in je agenda.",
      category: "school",
      render: renderPlanner,
    },
    {
      id: "favorites",
      name: "Favorieten",
      icon: "star",
      description: "Snelkoppelingen naar je favoriete pagina's.",
      category: "productiviteit",
      render: renderFavorites,
    },
    {
      id: "gradeAverage",
      name: "Cijfer Gemiddelde",
      icon: "chart",
      description: "Je gewogen totaalgemiddelde over alle cijfers.",
      category: "school",
      render: renderGradeAverage,
    },
    {
      id: "calculator",
      name: "Rekenmachine",
      icon: "calc",
      description: "Een kleine rekenmachine, met toetsen of typen.",
      category: "productiviteit",
      render: renderCalculator,
    },
    {
      id: "holiday",
      name: "Aftellen naar Vakantie",
      icon: "beach",
      description: "Dagen tot de volgende schoolvakantie, of tot je eigen datum.",
      category: "fun",
      render: renderHoliday,
    },
    {
      id: "shortcuts",
      name: "Snelkoppelingen",
      icon: "link",
      description: "Vier knoppen: Resultaten, Agenda, Berichten, Teams.",
      category: "productiviteit",
      render: renderShortcuts,
    },
  ];

  /*
   * Snake and 2048 live in the Hub's Arcade; the Hub still renders them through
   * kit.render(), so they stay renderable but are NOT in SSC_WIDGETS: no picker,
   * no bag, no start page grid. Plant and pet are the Hub farm's own scene.
   */
  var HUB_ONLY = {
    snake: { id: "snake", name: "Snake", icon: "snake", render: function (body) { renderGame("snake", body); } },
    game2048: { id: "game2048", name: "2048", icon: "tiles", render: function (body) { renderGame("g2048", body); } },
  };

  var BY_ID = {};
  for (var ri = 0; ri < SSC_WIDGETS.length; ri++) BY_ID[SSC_WIDGETS[ri].id] = SSC_WIDGETS[ri];

  /* ---------- state ---------- */

  var settings = null;
  var widgetsEl = null;
  // The list element of the panel's Widgets section, so adding a widget from
  // the picker can repaint it without rebuilding the whole settings tab.
  var settingsListEl = null;
  var modalEl = null;
  var modalBody = null;
  var modalOpen = false;
  var routeTimer = null;
  var positionFrame = 0;
  var intervals = [];
  var wasOnPage = null;

  function h(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function live() {
    var host = document.getElementById("ssc-root");
    if (!host || !host.shadowRoot) return null;
    var layer = host.shadowRoot.querySelector(".ssc-layer");
    if (!layer) return null;
    return { shadow: host.shadowRoot, layer: layer };
  }

  /**
   * The start page used to be recognised by `#container` plus one of the
   * three column containers. That pair is Smartschool's classic homepage
   * markup; the current renderer does not always ship it, which is why the
   * grid never switched on (Bug 13).
   *
   * Three independent signals now, any one of which is enough:
   *   1. the classic id pair;
   *   2. the modern `.home-main` / `.homepage` wrappers;
   *   3. the URL — the start page is the root path or Smartschool's
   *      dashboard route, and no other page carries a homepage container.
   */
  function isStartPage() {
    if (document.getElementById("container")) {
      if (
        document.getElementById("centercontainer") ||
        document.getElementById("leftcontainer") ||
        document.getElementById("rightcontainer")
      ) {
        return true;
      }
    }
    if (document.querySelector(".home-main, .homepage, .homepage__block")) return true;
    var path = String(location.pathname || "/");
    return path === "/" || /^\/(index|dashboard|home)(\.|$|\/)/i.test(path);
  }

  /** The element the grid is aligned to. First existing candidate wins. */
  function homepageAnchor() {
    var candidates = [
      "container",
      "centercontainer",
      "leftcontainer",
      "rightcontainer",
    ];
    for (var i = 0; i < candidates.length; i++) {
      var node = document.getElementById(candidates[i]);
      if (node) {
        var rect = node.getBoundingClientRect();
        if (rect.width) return node;
      }
    }
    return document.querySelector(".home-main, .homepage") || document.getElementById("container");
  }

  /* ---------- normalised enabled list / order ---------- */

  function flagEnabled(id) {
    var state = (settings && settings.widgets) || {};
    var entry = state[id];
    return !!(entry && entry.enabled);
  }

  function enabledIds() {
    var out = [];
    for (var i = 0; i < SSC_WIDGETS.length; i++) {
      if (flagEnabled(SSC_WIDGETS[i].id)) out.push(SSC_WIDGETS[i].id);
    }
    return out;
  }

  /**
   * Saved ids first (known ones only, no duplicates), then any enabled widget
   * the array lost. The old build stored Dutch ids ("notities", "lesuur", …)
   * that no registry knows; that array normalises to just the enabled ones.
   */
  function orderIds() {
    var saved = (settings && Array.isArray(settings.widgetOrder)) ? settings.widgetOrder : [];
    var out = [];
    var seen = {};

    for (var i = 0; i < saved.length; i++) {
      var id = saved[i];
      if (!BY_ID[id] || seen[id] || !flagEnabled(id)) continue;
      seen[id] = true;
      out.push(id);
    }
    var enabled = enabledIds();
    for (var j = 0; j < enabled.length; j++) {
      if (!seen[enabled[j]]) out.push(enabled[j]);
    }
    return out;
  }

  function saveWidgets(nextWidgets, nextOrder) {
    var patch = { widgets: nextWidgets };
    if (nextOrder) patch.widgetOrder = nextOrder;
    return window.sscSet(patch);
  }

  function enableWidget(id, on) {
    var state = Object.assign({}, (settings && settings.widgets) || {});
    state[id] = Object.assign({}, state[id], { enabled: !!on });
    var order = orderIds();
    if (on && order.indexOf(id) === -1) order.push(id);
    if (!on) {
      order = order.filter(function (x) {
        return x !== id;
      });
    }
    return saveWidgets(state, order);
  }

  /* ---------- style ---------- */

  var CSS = [
    "#ssc-widgets {",
    "  position: absolute; top: 0; left: 0; display: none; box-sizing: border-box;",
    "  pointer-events: none; color: var(--ssc-text, #1a1a2e);",
    "}",
    "#ssc-widgets[data-on='1'] { display: block; }",
    ".ssc-wg-grid {",
    "  display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));",
    "  gap: 14px; pointer-events: auto;",
    "}",
    /*
     * The frosted card treatment is the one the spec pins down; every colour
     * still comes from the theme. `18%` base00 over the page is the same
     * translucency Smartschool's own dashboard blocks use with a theme on.
     */
    ".ssc-wg {",
    "  position: relative; box-sizing: border-box; min-width: 0;",
    "  padding: 14px; border-radius: 10px;",
    "  background-color: color-mix(in srgb, var(--ssc-base00, #ffffff) 18%, transparent);",
    "  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);",
    "  border: 1px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 10%, transparent);",
    "  color: var(--ssc-text, #1a1a2e);",
    "  pointer-events: auto;",
    "  transition: transform 160ms ease, border-color 160ms ease;",
    "}",
    ".ssc-wg:hover { border-color: color-mix(in srgb, var(--ssc-text, #1a1a2e) 22%, transparent); }",
    ".ssc-wg[data-drag='1'] { outline: 2px dashed var(--ssc-accent-ink); opacity: .85; }",
    ".ssc-wg-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }",
    ".ssc-wg-grip {",
    "  flex: none; cursor: grab; color: var(--ssc-muted); font-size: 13px;",
    "  letter-spacing: -2px; user-select: none; touch-action: none; pointer-events: auto;",
    "}",
    ".ssc-wg-icon { flex: none; font-size: 15px; }",
    ".ssc-wg-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 700;",
    "  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".ssc-wg-close {",
    "  flex: none; border: 0; background: transparent; color: var(--ssc-muted);",
    "  font: inherit; font-size: 15px; line-height: 1; padding: 0 4px;",
    "  cursor: pointer; pointer-events: auto; border-radius: 6px;",
    "}",
    ".ssc-wg-close:hover { color: var(--ssc-text, #1a1a2e); background: var(--ssc-accent-soft); }",
    ".ssc-wg-body { font-size: 13px; line-height: 1.5; color: var(--ssc-text, #1a1a2e); }",
    ".ssc-wg-muted { color: var(--ssc-muted); font-size: 12px; }",
    ".ssc-wg-big { font-size: 30px; font-weight: 800; font-variant-numeric: tabular-nums; }",
    ".ssc-wg-row { display: flex; align-items: baseline; gap: 8px; margin: 4px 0; min-width: 0; }",
    ".ssc-wg-row b { font-variant-numeric: tabular-nums; flex: none; }",
    ".ssc-wg-row span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".ssc-wg-input {",
    "  width: 100%; box-sizing: border-box; font: inherit; font-size: 12px; padding: 5px 7px;",
    "  border: 1px solid var(--ssc-line); border-radius: 7px;",
    "  background: color-mix(in srgb, var(--ssc-base00, #ffffff) 30%, transparent);",
    "  color: var(--ssc-text, #1a1a2e); pointer-events: auto; resize: vertical;",
    "}",
    ".ssc-wg-input::placeholder { color: var(--ssc-muted); }",
    ".ssc-wg-textarea { min-height: 76px; font-family: inherit; }",
    ".ssc-wg-btn {",
    "  font: inherit; font-size: 11.5px; font-weight: 600; padding: 4px 8px;",
    "  border: 1px solid var(--ssc-line); border-radius: 7px;",
    "  background: color-mix(in srgb, var(--ssc-base01, #f0f2f5) 55%, transparent);",
    "  color: var(--ssc-text, #1a1a2e); cursor: pointer; pointer-events: auto;",
    "}",
    ".ssc-wg-btn:hover { border-color: var(--ssc-accent-ink); color: var(--ssc-accent-ink); }",
    ".ssc-wg-link {",
    "  display: flex; align-items: center; gap: 8px; padding: 5px 6px; margin: 2px -6px;",
    "  border-radius: 7px; color: var(--ssc-text, #1a1a2e); text-decoration: none;",
    "  pointer-events: auto;",
    "}",
    ".ssc-wg-link:hover { background: var(--ssc-accent-soft); color: var(--ssc-accent-ink); }",
    ".ssc-wg-countdown { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }",
    ".ssc-wg-countdown b { font-size: 26px; font-variant-numeric: tabular-nums; }",
    "@media (prefers-reduced-motion: reduce) { .ssc-wg { transition: none; } }",
  ].join("\n");

  function ensureStyles(shadow) {
    if (!shadow) return;
    if (shadow.querySelector("style[data-ssc-widgets]")) return;
    var style = document.createElement("style");
    style.setAttribute("data-ssc-widgets", "1");
    style.textContent = CSS;
    shadow.appendChild(style);
  }

  /* ---------- geometry ---------- */

  function position() {
    if (!widgetsEl) return;
    positionFrame = 0;
    if (!isStartPage()) {
      widgetsEl.setAttribute("data-on", "0");
      return;
    }
    var anchor = homepageAnchor();
    if (!anchor) {
      widgetsEl.setAttribute("data-on", "0");
      return;
    }
    var rect = anchor.getBoundingClientRect();
    if (!rect.width) {
      widgetsEl.setAttribute("data-on", "0");
      return;
    }

    // Show first, then measure: offsetHeight is 0 while display:none, and the
    // "above" placement needs the real grid height.
    var has = orderIds().length > 0;
    widgetsEl.setAttribute("data-on", has ? "1" : "0");
    if (!has) return;

    var height = widgetsEl.offsetHeight || 260;
    var gap = 20;
    var above = !!(settings && settings.widgetsAbove);
    var top = above ? rect.top - gap - height : rect.bottom + gap;

    widgetsEl.style.left = Math.round(rect.left) + "px";
    widgetsEl.style.width = Math.round(rect.width) + "px";
    widgetsEl.style.top = Math.round(top) + "px";
  }

  function schedulePosition() {
    if (positionFrame) return;
    positionFrame = window.requestAnimationFrame(position);
  }

  /* ---------- card DOM ---------- */

  function clearIntervals() {
    for (var i = 0; i < intervals.length; i++) window.clearInterval(intervals[i]);
    intervals = [];
  }

  /*
   * While kit.render() runs, intervals belong to the card being rendered:
   * they pause while that card is detached (in the bag, mid-drag) and are
   * cleared by the dispose function render() returns.
   */
  var renderBucket = null;
  var renderBody = null;
  var renderDisposers = null;

  /*
   * The games (widget-games.js) get storage and a cleanup hook. Their
   * timers are tracked here, so removing the card from the page or into the
   * bag never leaves a loop or a pending timeout behind.
   */
  function renderGame(name, body) {
    var games = window.sscWidgetGames;
    if (!games || typeof games[name] !== "function") {
      body.appendChild(h("div", "ssc-wg-muted", "Dit spel kon niet laden."));
      return;
    }
    var disposers = renderDisposers || [];
    // The game may start after an async data read, when kit.render() has
    // already returned: its intervals still belong to this card.
    var owner = renderBody;
    var bucket = renderBucket;
    var timeouts = [];
    var api = {
      get: function (key, fallback) {
        return getData(key, fallback);
      },
      patch: function (key, partial) {
        var patch = {};
        patch[key] = Object.assign({}, getData(key, {}) || {}, partial);
        patchData(patch);
      },
      later: function (fn, ms) {
        var id = window.setTimeout(function () {
          timeouts = timeouts.filter(function (t) {
            return t !== id;
          });
          fn();
        }, ms);
        timeouts.push(id);
        return id;
      },
      every: function (fn, ms) {
        var prevBody = renderBody;
        var prevBucket = renderBucket;
        renderBody = owner;
        renderBucket = bucket;
        try {
          addInterval(fn, ms);
        } finally {
          renderBody = prevBody;
          renderBucket = prevBucket;
        }
      },
      onDispose: function (fn) {
        disposers.push(fn);
      },
    };
    disposers.push(function () {
      timeouts.forEach(function (t) {
        window.clearTimeout(t);
      });
      timeouts = [];
    });
    // High scores live in the widget data; read it before the first paint.
    readData(function () {
      games[name](body, api);
    });
  }

  function addInterval(fn, ms) {
    var owner = renderBody;
    var id = window.setInterval(function () {
      if (owner ? !owner.isConnected : !widgetsEl || !widgetsEl.isConnected) return;
      try {
        fn();
      } catch (e) {
        /* A single widget must not kill the clock. */
      }
    }, ms);
    if (renderBucket) renderBucket.push(id);
    else intervals.push(id);
  }

  function cardFor(def) {
    var card = h("div", "ssc-wg");
    card.setAttribute("data-id", def.id);

    var head = h("div", "ssc-wg-head");
    var grip = h("span", "ssc-wg-grip", "⋮⋮");
    grip.title = "Sleep om te herordenen";
    grip.setAttribute("aria-hidden", "true");
    head.appendChild(grip);
    head.appendChild(h("span", "ssc-wg-icon", def.icon));
    head.appendChild(h("span", "ssc-wg-title", def.name));

    var close = h("button", "ssc-wg-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Widget " + def.name + " verwijderen");
    close.addEventListener("click", function () {
      enableWidget(def.id, false);
    });
    head.appendChild(close);
    card.appendChild(head);

    var body = h("div", "ssc-wg-body");
    card.appendChild(body);
    try {
      def.render(body);
    } catch (e) {
      body.appendChild(h("div", "ssc-wg-muted", "Deze widget kon niet laden."));
    }

    return card;
  }

  function renderGrid() {
    if (!widgetsEl) return;
    clearIntervals();

    var list = orderIds();
    widgetsEl.textContent = "";

    if (!list.length) {
      widgetsEl.setAttribute("data-on", "0");
      return;
    }

    var grid = h("div", "ssc-wg-grid");
    for (var i = 0; i < list.length; i++) {
      var def = BY_ID[list[i]];
      if (def) grid.appendChild(cardFor(def));
    }
    widgetsEl.appendChild(grid);
    enableGridDrag(grid);
    schedulePosition();
  }

  /* ---------- drag reorder ---------- */

  function rectCenter(node) {
    var r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /**
   * Pointer-event reorder. Works for the start-page grid (2D) and for the
   * compact settings list (1D): in both cases the dragged row is inserted at
   * the index of the sibling whose centre is nearest to the pointer, which is
   * what a drag placeholder would do without needing one.
   */
  function enableDrag(container, gripSelector, rowSelector, onDone) {
    container.addEventListener("pointerdown", function (e) {
      var grip = e.target.closest ? e.target.closest(gripSelector) : null;
      if (!grip) return;
      var dragged = grip.closest(rowSelector);
      if (!dragged || dragged.parentNode !== container) return;

      e.preventDefault();
      dragged.setAttribute("data-drag", "1");
      try {
        grip.setPointerCapture(e.pointerId);
      } catch (err) {
        /* Older engines: document listeners below still drive the drag. */
      }

      function onMove(ev) {
        var siblings = [];
        for (var i = 0; i < container.children.length; i++) {
          if (container.children[i] !== dragged) siblings.push(container.children[i]);
        }
        if (!siblings.length) return;

        var best = null;
        var bestDistance = Infinity;
        for (var s = 0; s < siblings.length; s++) {
          var c = rectCenter(siblings[s]);
          var d = (c.x - ev.clientX) * (c.x - ev.clientX) +
            (c.y - ev.clientY) * (c.y - ev.clientY);
          if (d < bestDistance) {
            bestDistance = d;
            best = siblings[s];
          }
        }
        if (!best) return;

        var br = best.getBoundingClientRect();
        var before;
        if (container.classList.contains("ssc-wg-grid")) {
          // Same visual row → order by column; otherwise order by row, so a
          // pointer below a card moves past its whole row instead of sticking.
          var sameRow = ev.clientY > br.top && ev.clientY < br.bottom;
          before = sameRow
            ? ev.clientX < br.left + br.width / 2
            : ev.clientY < br.top + br.height / 2;
        } else {
          before = ev.clientY < br.top + br.height / 2;
        }

        var ref = before ? best : best.nextSibling;
        // `ref === dragged.nextSibling` is the current position: move nothing.
        if (ref === dragged || ref === dragged.nextSibling) return;
        if (ref) container.insertBefore(dragged, ref);
        else container.appendChild(dragged);
      }

      function finish() {
        dragged.removeAttribute("data-drag");
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", finish);
        document.removeEventListener("pointercancel", finish);
        if (onDone) onDone();
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", finish);
      document.addEventListener("pointercancel", finish);
    });
  }

  function enableGridDrag(grid) {
    enableDrag(grid, ".ssc-wg-grip", ".ssc-wg", function () {
      var order = [];
      for (var i = 0; i < grid.children.length; i++) {
        var id = grid.children[i].getAttribute("data-id");
        if (id && BY_ID[id]) order.push(id);
      }
      if (settings) settings.widgetOrder = order;
      saveWidgets((settings && settings.widgets) || {}, order);
      schedulePosition();
    });
  }

  /* ---------- settings block ---------- */

  function widgetStateSnapshot() {
    return Object.assign({}, (settings && settings.widgets) || {});
  }

  function renderSettingsList(listEl) {
    listEl.textContent = "";
    var ids = orderIds();

    if (!ids.length) {
      listEl.appendChild(
        h("div", "ssc-widget-empty", "Nog geen widgets op je startpagina.")
      );
      return;
    }

    for (var i = 0; i < ids.length; i++) {
      (function (id) {
        var def = BY_ID[id];
        if (!def) return;
        var row = h("div", "ssc-widget-row");
        row.setAttribute("data-id", id);
        var grip = h("span", "ssc-widget-grip", "⋮⋮");
        grip.title = "Sleep om te herordenen";
        row.appendChild(grip);
        row.appendChild(iconSpan("ssc-widget-icon", def.icon));
        row.appendChild(h("span", "ssc-widget-name", def.name));
        var remove = h("button", "ssc-widget-remove", "×");
        remove.type = "button";
        remove.setAttribute("aria-label", def.name + " verwijderen");
        remove.addEventListener("click", function () {
          enableWidget(id, false).then(function () {
            readSettings(true);
            renderSettingsList(listEl);
            renderGrid();
          });
        });
        row.appendChild(remove);
        listEl.appendChild(row);
      })(ids[i]);
    }

    // The list element survives re-renders, so bind the drag once instead of
    // stacking a new pointerdown listener on every add/remove.
    if (!listEl.__sscDrag) {
      listEl.__sscDrag = true;
      enableDrag(listEl, ".ssc-widget-grip", ".ssc-widget-row", function () {
        var order = [];
        for (var j = 0; j < listEl.children.length; j++) {
          var id = listEl.children[j].getAttribute("data-id");
          if (id && BY_ID[id]) order.push(id);
        }
        if (settings) settings.widgetOrder = order;
        saveWidgets(widgetStateSnapshot(), order);
        renderGrid();
      });
    }
  }

  /** "Widgets van Smartschool": one row per block currently in the DOM. */
  function renderSmartschoolList(listEl) {
    if (!listEl) return;
    listEl.textContent = "";
    var blocks = smartschoolWidgetBounds();
    var hidden = hiddenSmartschoolIds();

    if (!blocks.length) {
      listEl.appendChild(
        h("div", "ssc-widget-empty", "Geen widgets van Smartschool gevonden op deze pagina.")
      );
      return;
    }

    for (var i = 0; i < blocks.length; i++) {
      (function (entry) {
        var row = h("div", "ssc-widget-row");
        var title = entry.el.querySelector(".widgetName, .homepage__block__title, h2, h3");
        var label = (title && title.textContent) || entry.el.id || "Widget";
        row.appendChild(h("span", "ssc-widget-name", String(label).trim().slice(0, 40)));

        var isHidden = hidden.indexOf(entry.id) !== -1;
        var btn = h("button", "ssc-widget-remove", isHidden ? "+" : "×");
        btn.type = "button";
        btn.setAttribute(
          "aria-label",
          isHidden ? "Widget weer tonen" : "Widget verbergen"
        );
        btn.addEventListener("click", function () {
          setSmartschoolHidden(entry.id, !isHidden).then(function () {
            renderSmartschoolList(listEl);
          });
        });
        row.appendChild(btn);
        listEl.appendChild(row);
      })(blocks[i]);
    }
  }

  function sscWidgetsSettings(root) {
    if (!root) return;

    var block = h("div", "ssc-block");
    block.appendChild(h("h3", "ssc-block-title", "Widgets"));
    block.appendChild(
      h(
        "div",
        "ssc-hint",
        "Sleep om te herordenen. Klik × om te verwijderen. Klik + om toe te voegen."
      )
    );

    var list = h("div", "ssc-widget-list");
    settingsListEl = list;
    block.appendChild(list);

    var add = h("button", "ssc-btn-ghost", "+ Widget toevoegen");
    add.type = "button";
    add.addEventListener("click", openPicker);
    block.appendChild(add);

    var above = h("input", "ssc-check");
    above.type = "checkbox";
    above.addEventListener("change", function () {
      window.sscSet({ widgetsAbove: above.checked }).then(function () {
        readSettings(true);
        schedulePosition();
      });
    });
    var aboveRow = h("label", "ssc-check-row");
    aboveRow.appendChild(above);
    aboveRow.appendChild(document.createTextNode(" Widgets boven"));
    block.appendChild(aboveRow);

    // Bug 14: Smartschool's own blocks are hideable, one by one, and this is
    // the single place they all come back. The list is derived from the DOM
    // so a block that Smartschool no longer renders cannot keep an entry
    // alive forever.
    var smWrap = h("div", "ssc-block");
    smWrap.appendChild(h("h3", "ssc-block-title", "Widgets van Smartschool"));
    var smList = h("div", "ssc-widget-list");
    smWrap.appendChild(smList);
    renderSmartschoolList(smList);

    var showAll = h("button", "ssc-btn-ghost", "Toon alle widgets weer");
    showAll.type = "button";
    showAll.addEventListener("click", function () {
      window.sscSet({ hiddenSmartschoolWidgets: [] }).then(function (next) {
        settings = next;
        applySmartschoolVisibility();
        renderSmartschoolList(smList);
      });
    });
    smWrap.appendChild(showAll);
    smWrap.appendChild(
      h("div", "ssc-hint", "Zweef over een blok van Smartschool en klik × om het te verbergen.")
    );
    block.appendChild(smWrap);

    block.appendChild(
      h(
        "div",
        "ssc-hint",
        "Widgets staan op je startpagina, onder die van Smartschool."
      )
    );

    root.appendChild(block);

    // The panel rebuilds this block on open, so read the current flags then.
    readSettings(false).then(function () {
      above.checked = !!(settings && settings.widgetsAbove);
      renderSettingsList(list);
    });
  }

  function readSettings(force) {
    return new Promise(function (resolve) {
      if (settings && !force) {
        resolve(settings);
        return;
      }
      window.sscGet().then(function (s) {
        settings = s;
        resolve(s);
      });
    });
  }

  /* ---------- picker modal ---------- */

  function ensureModal() {
    var l = live();
    if (!l) return false;

    if (!modalEl || !modalEl.isConnected) {
      modalEl = h("div", "ssc-modal");
      modalEl.id = "ssc-widget-modal";
      modalEl.setAttribute("role", "dialog");
      modalEl.setAttribute("aria-modal", "true");
      modalEl.setAttribute("aria-label", "Widget toevoegen");
      modalEl.setAttribute("data-open", "0");

      var card = h("div", "ssc-modal-card");
      var head = h("div", "ssc-modal-head");
      head.appendChild(h("span", null, "Widget toevoegen"));
      var close = h("button", "ssc-close", "✕");
      close.type = "button";
      close.setAttribute("aria-label", "Sluiten");
      close.addEventListener("click", closePicker);
      head.appendChild(close);
      card.appendChild(head);

      modalBody = h("div", "ssc-modal-body");
      card.appendChild(modalBody);
      modalEl.appendChild(card);

      modalEl.addEventListener("click", function (e) {
        if (e.target === modalEl) closePicker();
      });

      l.layer.appendChild(modalEl);
    }
    return true;
  }

  function openPicker() {
    if (!ensureModal()) return;
    renderPicker();
    modalOpen = true;
    modalEl.setAttribute("data-open", "1");
    document.addEventListener("keydown", onModalKey, true);
  }

  function closePicker() {
    if (!modalEl) return;
    modalOpen = false;
    modalEl.setAttribute("data-open", "0");
    document.removeEventListener("keydown", onModalKey, true);
  }

  function onModalKey(e) {
    if (!modalOpen || e.key !== "Escape") return;
    // Capture + stop: content.js's panel listener must not also see this
    // Escape, or closing the picker would close the panel behind it.
    e.preventDefault();
    e.stopPropagation();
    closePicker();
  }

  function renderPicker() {
    if (!modalBody) return;
    modalBody.textContent = "";

    readSettings(true).then(function () {
      var available = SSC_WIDGETS.filter(function (def) {
        return !flagEnabled(def.id);
      });

      if (!available.length) {
        modalBody.appendChild(
          h("div", "ssc-pick-empty", "Alle widgets staan al op je startpagina.")
        );
        return;
      }

      for (var c = 0; c < CATEGORY_ORDER.length; c++) {
        var key = CATEGORY_ORDER[c];
        var group = available.filter(function (def) {
          return def.category === key;
        });
        if (!group.length) continue;

        modalBody.appendChild(
          h("div", "ssc-cat-title", CATEGORY_LABEL[key] || key)
        );

        for (var i = 0; i < group.length; i++) {
          (function (def) {
            var row = h("div", "ssc-pick-row");
            row.appendChild(iconSpan("ssc-pick-icon", def.icon));
            var info = h("div", "ssc-pick-info");
            info.appendChild(h("div", "ssc-pick-name", def.name));
            info.appendChild(h("div", "ssc-pick-desc", def.description));
            row.appendChild(info);

            var add = h("button", "ssc-btn ssc-pick-add", "+ Toevoegen");
            add.type = "button";
            add.addEventListener("click", function () {
              enableWidget(def.id, true).then(function () {
                closePicker();
                readSettings(true).then(function () {
                  renderGrid();
                  // Repaint the section even if it is closed: `listEl` is the
                  // element the next open re-attaches, so its rows stay fresh.
                  if (settingsListEl) renderSettingsList(settingsListEl);
                });
              });
            });
            row.appendChild(add);
            modalBody.appendChild(row);
          })(group[i]);
        }
      }
    });
  }

  /* ---------- widget bodies ---------- */

  function renderNotes(body) {
    var area = h("textarea", "ssc-wg-input ssc-wg-textarea");
    area.placeholder = "Typ hier je notities…";
    body.appendChild(area);

    readData(function () {
      area.value = getData("notes", "") || "";
    });

    var timer = null;
    area.addEventListener("input", function () {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        patchData({ notes: area.value });
      }, 450);
    });
  }

  function emptyLine(text) {
    return h("div", "ssc-wg-muted", text);
  }

  function renderNextLesson(body) {
    var line = h("div", "ssc-wg-muted", "Je rooster wordt geladen…");
    body.appendChild(line);

    function load() {
      fetchPlanned(null, 0, 0).then(
        function (elements) {
          var now = Date.now();
          var lessons = elements
            .filter(function (el) {
              var p = el.period || {};
              return p.dateTimeFrom && !p.wholeDay;
            })
            .sort(function (a, b) {
              return new Date(a.period.dateTimeFrom) - new Date(b.period.dateTimeFrom);
            });

          // Same test as smpp's volgende-vak.ts:149: the first lesson that has
          // not started yet. A lesson already in progress is not "next".
          var next = null;
          for (var i = 0; i < lessons.length; i++) {
            var start = new Date(lessons[i].period.dateTimeFrom).getTime();
            if (start > now) {
              next = lessons[i];
              break;
            }
          }

          line.textContent = "";
          if (!next) {
            line.appendChild(
              emptyLine("Geen les meer vandaag. Fijn!")
            );
            return;
          }
          var row = h("div", "ssc-wg-row");
          row.appendChild(h("b", null, timeOf(next.period.dateTimeFrom)));
          row.appendChild(h("span", null, subjectOf(next)));
          line.textContent = "";
          line.className = "";
          line.appendChild(row);
          if (next.period.dateTimeTo) {
            line.appendChild(
              h("div", "ssc-wg-muted", "tot " + timeOf(next.period.dateTimeTo))
            );
          }
          var rooms = roomsOf(next);
          if (rooms.length) {
            line.appendChild(h("div", "ssc-wg-muted", rooms.join(", ")));
          }
        },
        function (err) {
          line.textContent = "";
          line.className = "ssc-wg-error";
          line.textContent = plannerError("je rooster", err);
        }
      );
    }

    load();
    addInterval(load, 60000);
  }

  function renderCountdown(body) {
    readData(function () {
      var data = getData("countdown", null);
      body.textContent = "";

      if (!data || !data.date) {
        var hint = h("div", "ssc-wg-muted", "Kies een moment om naar af te tellen.");
        body.appendChild(hint);

        var dateInput = h("input", "ssc-wg-input");
        dateInput.type = "datetime-local";
        body.appendChild(dateInput);

        var labelInput = h("input", "ssc-wg-input");
        labelInput.type = "text";
        labelInput.placeholder = "Label (optioneel)";
        body.appendChild(labelInput);

        var save = h("button", "ssc-wg-btn", "Opslaan");
        save.type = "button";
        save.style.marginTop = "8px";
        save.addEventListener("click", function () {
          patchData({
            countdown: { date: dateInput.value, label: labelInput.value || "" },
          });
          renderCountdown(body);
        });
        body.appendChild(save);
        return;
      }

      var target = new Date(data.date).getTime();
      var wrap = h("div", "ssc-wg-countdown");
      body.appendChild(wrap);
      if (data.label) body.appendChild(h("div", "ssc-wg-muted", data.label));

      function paint() {
        var remaining = target - Date.now();
        wrap.textContent = "";
        if (remaining <= 0) {
          wrap.appendChild(h("b", null, "Nu!"));
          return;
        }
        var days = Math.floor(remaining / 86400000);
        var hours = Math.floor((remaining % 86400000) / 3600000);
        var minutes = Math.floor((remaining % 3600000) / 60000);
        [
          [days, "d"],
          [hours, "u"],
          [minutes, "m"],
        ].forEach(function (pair) {
          var cell = h("span");
          cell.appendChild(h("b", null, String(pair[0])));
          cell.appendChild(document.createTextNode(" " + pair[1]));
          wrap.appendChild(cell);
        });
      }
      paint();
      addInterval(paint, 30000);

      var edit = h("button", "ssc-wg-btn", "Wijzigen");
      edit.type = "button";
      edit.style.marginTop = "8px";
      edit.addEventListener("click", function () {
        patchData({ countdown: null });
        renderCountdown(body);
      });
      body.appendChild(edit);
    });
  }

  function sameDay(a, b) {
    return a.toDateString() === b.toDateString();
  }

  /** "Vandaag" / "Morgen" / "Overmorgen" / "donderdag 30 oktober", as smpp. */
  function dayLabel(date) {
    var today = new Date();
    var plus1 = new Date(today);
    plus1.setDate(today.getDate() + 1);
    var plus2 = new Date(today);
    plus2.setDate(today.getDate() + 2);
    if (sameDay(date, today)) return "Vandaag";
    if (sameDay(date, plus1)) return "Morgen";
    if (sameDay(date, plus2)) return "Overmorgen";
    return date.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });
  }

  /*
   * smpp's TakenWidget (assignments.ts): planned-assignments and
   * planned-to-dos for the next 28 days, resolved ones out, sorted by date.
   * We show the first 3.
   */
  var TASK_FORESIGHT_DAYS = 28;
  var TASK_LIMIT = 3;

  function renderAssignments(body) {
    var list = h("div", "ssc-wg-muted", "Taken worden geladen…");
    body.appendChild(list);

    function load() {
      fetchPlanned("planned-assignments,planned-to-dos", 0, TASK_FORESIGHT_DAYS).then(
        function (elements) {
          var open = elements
            .filter(function (el) {
              return el && el.resolvedStatus !== "resolved" && el.period && el.period.dateTimeFrom;
            })
            .sort(function (a, b) {
              return new Date(a.period.dateTimeFrom) - new Date(b.period.dateTimeFrom);
            })
            .slice(0, TASK_LIMIT);

          list.textContent = "";
          list.className = "ssc-wg-tasks";
          if (!open.length) {
            list.appendChild(emptyLine("Geen taken gevonden"));
            return;
          }
          open.forEach(function (task) {
            var row = h("div", "ssc-wg-task");
            var chip = h("span", "ssc-wg-task-chip");
            var cls = colorClass(task);
            if (cls) chip.classList.add(cls);
            var abbr = task.assignmentType && task.assignmentType.abbreviation;
            chip.textContent = abbr || (task.plannedElementType === "planned-to-dos" ? "✓" : "?");
            row.appendChild(chip);

            var info = h("div", "ssc-wg-task-info");
            var course = (task.courses && task.courses[0] && task.courses[0].name) || "To-do";
            info.appendChild(h("div", "ssc-wg-task-course", course));
            info.appendChild(h("div", "ssc-wg-task-title", task.name || "Taak"));
            var when = new Date(task.period.dateTimeFrom);
            info.appendChild(h("div", "ssc-wg-muted", dayLabel(when) + " · " + timeOf(task.period.dateTimeFrom)));
            row.appendChild(info);
            list.appendChild(row);
          });
        },
        function (err) {
          list.textContent = "";
          list.className = "ssc-wg-error";
          list.textContent = plannerError("je taken", err);
        }
      );
    }

    load();
    addInterval(load, 120000);
  }

  /*
   * smpp's PlannerWidget (planner.ts): planned-elements for one day, with
   * day back/forward buttons. smpp draws a timeline; here it is a list, one
   * row per element: time, course, teacher, room, colour chip.
   */
  var PLANNER_VISIBLE = 4;

  function renderPlanner(body) {
    var offset = 0;

    var nav = h("div", "ssc-wg-pl-nav");
    var back = h("button", "ssc-wg-pl-btn", "‹");
    back.type = "button";
    back.title = "Vorige dag";
    var title = h("div", "ssc-wg-pl-day", "");
    var fwd = h("button", "ssc-wg-pl-btn", "›");
    fwd.type = "button";
    fwd.title = "Volgende dag";
    nav.appendChild(back);
    nav.appendChild(title);
    nav.appendChild(fwd);
    body.appendChild(nav);
    var count = h("div", "ssc-wg-pl-count", "");
    body.appendChild(count);

    var list = h("div", "ssc-wg-muted", "Planner wordt geladen…");
    body.appendChild(list);

    back.addEventListener("click", function () {
      offset--;
      load();
    });
    fwd.addEventListener("click", function () {
      offset++;
      load();
    });

    var seq = 0;
    function load() {
      var mine = ++seq;
      var day = new Date();
      day.setDate(day.getDate() + offset);
      title.textContent = dayLabel(day);
      fetchPlanned(null, offset, offset).then(
        function (elements) {
          if (mine !== seq) return;
          var items = elements
            .filter(function (el) {
              return el && el.period && el.period.dateTimeFrom;
            })
            .sort(function (a, b) {
              var wa = a.period.wholeDay ? 0 : 1;
              var wb = b.period.wholeDay ? 0 : 1;
              if (wa !== wb) return wa - wb;
              return new Date(a.period.dateTimeFrom) - new Date(b.period.dateTimeFrom);
            });

          list.textContent = "";
          list.className = "ssc-wg-pl-list";
          if (!items.length) {
            list.appendChild(emptyLine("Niets gepland op deze dag."));
            return;
          }
          // More than four rows: a fixed-height list that scrolls inside the
          // card, so a full day never stretches the column (or the page).
          var scrolls = items.length > PLANNER_VISIBLE;
          if (scrolls) list.classList.add("ssc-wg-pl-list--scroll");
          count.textContent = items.length + (items.length === 1 ? " item" : " items");
          var nowMs = Date.now();
          var current = null;
          items.forEach(function (el) {
            var row = h("div", "ssc-wg-pl-item");
            if (!el.period.wholeDay && el.period.dateTimeTo) {
              var from = new Date(el.period.dateTimeFrom).getTime();
              var to = new Date(el.period.dateTimeTo).getTime();
              if (nowMs >= from && nowMs < to) {
                row.setAttribute("data-now", "1");
                current = current || row;
              } else if (nowMs >= to) {
                row.setAttribute("data-past", "1");
              } else if (!current && offset === 0) {
                current = row;
              }
            }
            var bar = h("span", "ssc-wg-pl-bar");
            var cls = colorClass(el);
            if (cls) bar.classList.add(cls);
            row.appendChild(bar);

            var time = el.period.wholeDay
              ? "Hele dag"
              : timeOf(el.period.dateTimeFrom) + (el.period.dateTimeTo ? " – " + timeOf(el.period.dateTimeTo) : "");
            row.appendChild(h("div", "ssc-wg-pl-time", time));

            var info = h("div", "ssc-wg-pl-info");
            var course = (el.courses && el.courses[0] && el.courses[0].name) || el.name || "Les";
            info.appendChild(h("div", "ssc-wg-pl-course", course));
            var meta = teachersOf(el).concat(roomsOf(el));
            if (el.name && el.name !== course) meta.unshift(el.name);
            if (meta.length) info.appendChild(h("div", "ssc-wg-muted", meta.join(" · ")));
            row.appendChild(info);
            list.appendChild(row);
          });
          // Today: open the scroll on the lesson that is on (or next).
          if (scrolls && current && offset === 0) {
            list.scrollTop = Math.max(0, current.offsetTop - list.offsetTop - 4);
          }
        },
        function (err) {
          if (mine !== seq) return;
          list.textContent = "";
          list.className = "ssc-wg-error";
          list.textContent = plannerError("je planner", err);
        }
      );
    }

    load();
    addInterval(load, 300000);
  }

  var WEATHER_TEXT = {
    0: ["sun", "Helder"],
    1: ["cloudSun", "Meestal helder"],
    2: ["cloudSun", "Half bewolkt"],
    3: ["cloud", "Bewolkt"],
    45: ["fog", "Mist"],
    48: ["fog", "Mist"],
    51: ["drizzle", "Motregen"],
    53: ["drizzle", "Motregen"],
    55: ["drizzle", "Motregen"],
    61: ["rain", "Regen"],
    63: ["rain", "Regen"],
    65: ["rain", "Zware regen"],
    71: ["snow", "Sneeuw"],
    73: ["snow", "Sneeuw"],
    75: ["snow", "Sneeuw"],
    80: ["drizzle", "Buien"],
    81: ["rain", "Buien"],
    82: ["storm", "Zware buien"],
    95: ["storm", "Onweer"],
    96: ["storm", "Onweer"],
    99: ["storm", "Onweer"],
  };

  function renderWeather(body) {
    readData(function () {
      var data = getData("weather", null) || {};
      body.textContent = "";

      var cityWrap = h("div", "ssc-wg-row");
      var city = h("input", "ssc-wg-input");
      city.type = "text";
      city.placeholder = "Stad";
      city.value = data.city || "Brussel";
      city.style.maxWidth = "150px";
      var go = h("button", "ssc-wg-btn", "Toon");
      go.type = "button";
      cityWrap.appendChild(city);
      cityWrap.appendChild(go);
      body.appendChild(cityWrap);

      var out = h("div", "ssc-wg-muted", "Weer wordt geladen…");
      body.appendChild(out);

      function run() {
        var name = (city.value || "").trim() || "Brussel";
        patchData({ weather: { city: name } });
        loadWeather(name, out);
      }

      go.addEventListener("click", run);
      city.addEventListener("keydown", function (e) {
        if (e.key === "Enter") run();
      });
      run();
    });
  }

  function loadWeather(city, out) {
    out.textContent = "Weer wordt geladen…";
    var geo =
      "https://geocoding-api.open-meteo.com/v1/search?count=1&language=nl&format=json&name=" +
      encodeURIComponent(city);

    fetch(geo)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        var hit = data && data.results && data.results[0];
        if (!hit) throw new Error("no city");
        var url =
          "https://api.open-meteo.com/v1/forecast?latitude=" + hit.latitude +
          "&longitude=" + hit.longitude +
          "&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto";
        return fetch(url).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        }).then(function (forecast) {
          var current = (forecast && forecast.current) || {};
          var info = WEATHER_TEXT[current.weather_code] || ["thermo", "Weer"];
          out.textContent = "";
          out.className = "";
          var row = h("div", "ssc-wg-weather");
          row.appendChild(iconSpan("ssc-wg-weather-icon", info[0]));
          var temp = h("div", "ssc-wg-weather-main");
          temp.appendChild(h("b", "ssc-wg-weather-temp", Math.round(current.temperature_2m) + "°"));
          temp.appendChild(h("span", null, info[1]));
          row.appendChild(temp);
          out.appendChild(row);
          out.appendChild(
            h(
              "div",
              "ssc-wg-muted",
              hit.name + " · wind " + Math.round(current.wind_speed_10m || 0) + " km/u"
            )
          );
        });
      })
      .catch(function () {
        out.textContent = "";
        out.className = "ssc-wg-muted";
        out.appendChild(
          emptyLine("Het weer kon niet worden opgehaald. Controleer je verbinding.")
        );
      });
  }

  var FAVORITES = [
    ["chart", "Resultaten", "/results"],
    ["calendar", "Agenda", "/agenda"],
    ["chat", "Berichten", "/messages"],
    ["list", "Planner", "/planner"],
  ];

  function renderFavorites(body) {
    for (var i = 0; i < FAVORITES.length; i++) {
      var link = h("a", "ssc-wg-link");
      link.href = location.origin + FAVORITES[i][2];
      link.appendChild(iconSpan("ssc-wg-link-icon", FAVORITES[i][0]));
      link.appendChild(h("span", null, FAVORITES[i][1]));
      body.appendChild(link);
    }
  }

  /* ---------- Cijfer Gemiddelde ---------- */

  function fmtComma(n, digits) {
    return n.toFixed(digits).replace(".", ",");
  }

  /**
   * Weighted overall average: every counting grade adds its own points and
   * its own maximum, so a test on 50 weighs five times a test on 10 — the
   * way Smartschool's own totals work. Only when no grade has raw points is
   * it the plain mean of the percentages.
   */
  function overallAverage(grades) {
    var score = 0;
    var max = 0;
    var sumPct = 0;
    var count = 0;
    grades.forEach(function (g) {
      if (!g || g.doesCount === false) return;
      var pct = typeof g.percentage === "number" && isFinite(g.percentage) ? g.percentage : null;
      if (pct === null) return;
      count++;
      sumPct += pct;
      var s = Number(g.ruweScore);
      var m = Number(g.ruweMax);
      if (isFinite(s) && isFinite(m) && m > 0) {
        score += s;
        max += m;
      }
    });
    if (!count) return null;
    return { percent: max > 0 ? (score / max) * 100 : sumPct / count, count: count };
  }

  function renderGradeAverage(body) {
    var out = h("div", "ssc-wg-muted", "Cijfers worden geladen…");
    body.appendChild(out);

    function paint(grades) {
      var avg = overallAverage(grades || []);
      out.textContent = "";
      if (!avg) {
        out.className = "ssc-wg-muted";
        out.textContent = "Nog geen cijfers met punten gevonden.";
        return;
      }
      out.className = "ssc-wg-avg";
      var level = avg.percent >= 70 ? "good" : avg.percent >= 50 ? "ok" : "bad";
      out.setAttribute("data-level", level);
      var big = h("div", "ssc-wg-avg-big", fmtComma(avg.percent, 1) + "%");
      out.appendChild(big);
      out.appendChild(h("div", "ssc-wg-avg-sub", fmtComma((avg.percent / 100) * 20, 1) + " / 20"));
      var bar = h("div", "ssc-wg-avg-bar");
      var fill = h("span");
      fill.style.width = Math.max(0, Math.min(100, avg.percent)) + "%";
      bar.appendChild(fill);
      out.appendChild(bar);
      out.appendChild(h("div", "ssc-wg-muted", "Gewogen over " + avg.count + (avg.count === 1 ? " cijfer" : " cijfers")));
    }

    function fail() {
      out.textContent = "";
      out.className = "ssc-wg-error";
      out.textContent = "Laden van je cijfers mislukt. Probeer later opnieuw.";
    }

    // The cache (12h, per user) paints at once; the fresh fetch replaces it.
    var painted = false;
    var cached = typeof window.sscGetGradesCache === "function" ? window.sscGetGradesCache() : Promise.resolve(null);
    cached.then(function (entry) {
      if (entry && entry.grades && entry.grades.length) {
        painted = true;
        paint(entry.grades);
      }
    });
    if (typeof window.sscFetchGradesCached === "function") {
      window.sscFetchGradesCached().then(paint, function () {
        if (!painted) fail();
      });
    } else if (!painted) {
      fail();
    }
  }

  /* ---------- Rekenmachine ---------- */

  /**
   * + − × ÷ and brackets, with a comma or a dot as the decimal sign. A small
   * recursive-descent parser instead of eval(): the input is typed by the
   * user and must never run as code.
   */
  function calcEvaluate(text) {
    var src = String(text).replace(/,/g, ".").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s+/g, "");
    var pos = 0;
    function peek() {
      return src.charAt(pos);
    }
    function number() {
      var m = /^\d*\.?\d+(?:e[+-]?\d+)?|^\d+\./i.exec(src.slice(pos));
      if (!m) throw new Error("getal verwacht");
      pos += m[0].length;
      return parseFloat(m[0]);
    }
    function factor() {
      var c = peek();
      if (c === "+") {
        pos++;
        return factor();
      }
      if (c === "-") {
        pos++;
        return -factor();
      }
      if (c === "(") {
        pos++;
        var v = expr();
        if (peek() !== ")") throw new Error(") verwacht");
        pos++;
        return v;
      }
      return number();
    }
    function term() {
      var v = factor();
      for (;;) {
        var c = peek();
        if (c === "*") {
          pos++;
          v *= factor();
        } else if (c === "/") {
          pos++;
          var d = factor();
          if (d === 0) throw new Error("delen door nul");
          v /= d;
        } else if (c === "%") {
          pos++;
          v /= 100;
        } else {
          return v;
        }
      }
    }
    function expr() {
      var v = term();
      for (;;) {
        var c = peek();
        if (c === "+") {
          pos++;
          v += term();
        } else if (c === "-") {
          pos++;
          v -= term();
        } else {
          return v;
        }
      }
    }
    if (!src) return null;
    var result = expr();
    if (pos !== src.length) throw new Error("onverwacht teken");
    if (!isFinite(result)) throw new Error("geen getal");
    return result;
  }

  function calcFormat(n) {
    var r = Math.round(n * 1e10) / 1e10;
    return String(r).replace(".", ",");
  }

  var CALC_KEYS = [
    ["C", "(", ")", "÷"],
    ["7", "8", "9", "×"],
    ["4", "5", "6", "−"],
    ["1", "2", "3", "+"],
    ["0", ",", "⌫", "="],
  ];

  function renderCalculator(body) {
    var input = h("input", "ssc-wg-input ssc-wg-calc-input");
    input.type = "text";
    input.inputMode = "decimal";
    input.placeholder = "0";
    input.spellcheck = false;
    input.setAttribute("aria-label", "Berekening");
    var result = h("div", "ssc-wg-calc-result", "");
    body.appendChild(input);
    body.appendChild(result);

    function compute(final) {
      try {
        var v = calcEvaluate(input.value);
        result.classList.remove("ssc-wg-calc-err");
        if (v === null) {
          result.textContent = "";
          return;
        }
        if (final) {
          input.value = calcFormat(v);
          result.textContent = "";
        } else {
          result.textContent = "= " + calcFormat(v);
        }
      } catch (e) {
        // Half-typed sums ("3 +") are normal while typing; only "=" complains.
        result.textContent = final ? "Fout: " + e.message : "";
        result.classList.toggle("ssc-wg-calc-err", !!final);
      }
    }

    input.addEventListener("input", function () {
      compute(false);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        compute(true);
      } else if (e.key === "Escape") {
        input.value = "";
        compute(false);
      }
    });

    var pad = h("div", "ssc-wg-calc-pad");
    CALC_KEYS.forEach(function (row) {
      row.forEach(function (key) {
        var b = h("button", "ssc-wg-calc-key", key);
        b.type = "button";
        if (/[÷×−+=]/.test(key)) b.classList.add("ssc-wg-calc-op");
        if (key === "C" || key === "⌫") b.classList.add("ssc-wg-calc-fn");
        b.addEventListener("click", function () {
          if (key === "C") input.value = "";
          else if (key === "⌫") input.value = input.value.slice(0, -1);
          else if (key === "=") {
            compute(true);
            return;
          } else input.value += key;
          compute(false);
        });
        pad.appendChild(b);
      });
    });
    body.appendChild(pad);
  }

  /* ---------- Aftellen naar Vakantie ---------- */

  function atMidnight(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(d, n) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  }

  /** Gregorian Easter Sunday (anonymous algorithm). */
  function easterSunday(y) {
    var a = y % 19;
    var b = Math.floor(y / 100);
    var c = y % 100;
    var d = Math.floor(b / 4);
    var e = b % 4;
    var f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var hh = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4);
    var k = c % 4;
    var l = (32 + 2 * e + 2 * i - hh - k) % 7;
    var m = Math.floor((a + 11 * hh + 22 * l) / 451);
    var month = Math.floor((hh + l - 7 * m + 114) / 31);
    var day = ((hh + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }

  /**
   * Flemish school holidays of calendar year y, by the rules of the
   * calendar reform (since 2022-2023). Each holiday is { name, start, end },
   * `end` being the last free day.
   *   krokus  2 weeks from the Monday 7 weeks before Easter
   *   paas    2 weeks: Easter in March → from Easter Monday; Easter up to
   *           15 April → from the first Monday of April; later Easter → the
   *           two weeks before Easter Monday (which is free too)
   *   zomer   1 July – 31 August
   *   herfst  2 weeks from the Monday of the week of 1 November
   *   kerst   2 weeks from the Monday of the week of 25 December (the Monday
   *           after, when Christmas is on a weekend)
   */
  function flemishHolidays(y) {
    var easter = easterSunday(y);
    var easterMonday = addDays(easter, 1);
    var list = [];

    var krokus = addDays(easter, -48);
    list.push({ name: "Krokusvakantie", start: krokus, end: addDays(krokus, 13) });

    var paasStart;
    var paasEnd;
    if (easter.getMonth() === 2) {
      paasStart = easterMonday;
      paasEnd = addDays(paasStart, 13);
    } else if (easter.getDate() <= 15) {
      var april1 = new Date(y, 3, 1);
      paasStart = addDays(april1, (8 - april1.getDay()) % 7);
      paasEnd = addDays(paasStart, 13);
    } else {
      paasStart = addDays(easterMonday, -14);
      paasEnd = easterMonday;
    }
    list.push({ name: "Paasvakantie", start: paasStart, end: paasEnd });

    list.push({ name: "Zomervakantie", start: new Date(y, 6, 1), end: new Date(y, 7, 31) });

    var nov1 = new Date(y, 10, 1);
    var herfst = addDays(nov1, -((nov1.getDay() + 6) % 7));
    list.push({ name: "Herfstvakantie", start: herfst, end: addDays(herfst, 13) });

    var xmas = new Date(y, 11, 25);
    var dow = xmas.getDay();
    var kerst = dow === 6 ? addDays(xmas, 2) : dow === 0 ? addDays(xmas, 1) : addDays(xmas, -(dow - 1));
    list.push({ name: "Kerstvakantie", start: kerst, end: addDays(kerst, 13) });

    return list;
  }

  /** The holiday we are in, else the next one. */
  function currentOrNextHoliday(now) {
    var today = atMidnight(now);
    var all = flemishHolidays(today.getFullYear() - 1)
      .concat(flemishHolidays(today.getFullYear()), flemishHolidays(today.getFullYear() + 1))
      .sort(function (a, b) {
        return a.start - b.start;
      });
    for (var i = 0; i < all.length; i++) {
      if (all[i].end >= today) return all[i];
    }
    return null;
  }

  function daysBetween(a, b) {
    return Math.round((atMidnight(b) - atMidnight(a)) / 86400000);
  }

  function shortDate(d) {
    return d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
  }

  function renderHoliday(body) {
    readData(function () {
      body.textContent = "";
      var custom = getData("holiday", null);
      var now = new Date();

      var view = h("div", "ssc-wg-holiday");
      body.appendChild(view);

      function paint() {
        view.textContent = "";
        var today = atMidnight(new Date());
        if (custom && custom.date) {
          var target = new Date(custom.date + "T00:00:00");
          var left = daysBetween(today, target);
          view.appendChild(h("div", "ssc-wg-holiday-name", custom.label || "Mijn vakantie"));
          if (left > 0) {
            view.appendChild(h("div", "ssc-wg-holiday-big", String(left)));
            view.appendChild(h("div", "ssc-wg-muted", (left === 1 ? "dag" : "dagen") + " tot " + shortDate(target)));
          } else if (left === 0) {
            view.appendChild(iconSpan("ssc-wg-holiday-big ssc-wg-holiday-party", "party"));
            view.appendChild(h("div", "ssc-wg-muted", "Vandaag!"));
          } else {
            view.appendChild(h("div", "ssc-wg-muted", "Deze datum is voorbij."));
          }
          return;
        }

        var hol = currentOrNextHoliday(now);
        if (!hol) {
          view.appendChild(h("div", "ssc-wg-muted", "Geen vakantie gevonden."));
          return;
        }
        var range = shortDate(hol.start) + " – " + shortDate(hol.end);
        if (hol.start <= today) {
          var rest = daysBetween(today, hol.end) + 1;
          view.appendChild(h("div", "ssc-wg-holiday-name", hol.name + "!"));
          view.appendChild(h("div", "ssc-wg-holiday-big", String(rest)));
          view.appendChild(h("div", "ssc-wg-muted", (rest === 1 ? "dag" : "dagen") + " vrij, tot " + shortDate(hol.end)));
        } else {
          var until = daysBetween(today, hol.start);
          view.appendChild(h("div", "ssc-wg-holiday-name", hol.name));
          view.appendChild(h("div", "ssc-wg-holiday-big", String(until)));
          view.appendChild(h("div", "ssc-wg-muted", (until === 1 ? "dag" : "dagen") + " te gaan · " + range));
        }
      }

      paint();
      addInterval(paint, 600000);

      var actions = h("div", "ssc-wg-holiday-actions");
      body.appendChild(actions);

      if (custom && custom.date) {
        var reset = h("button", "ssc-wg-btn", "Schoolvakanties");
        reset.type = "button";
        reset.addEventListener("click", function () {
          patchData({ holiday: null });
          renderHoliday(body);
        });
        actions.appendChild(reset);
        return;
      }

      var own = h("button", "ssc-wg-btn", "Eigen datum");
      own.type = "button";
      own.addEventListener("click", function () {
        actions.textContent = "";
        var date = h("input", "ssc-wg-input");
        date.type = "date";
        var label = h("input", "ssc-wg-input");
        label.type = "text";
        label.placeholder = "Naam (bv. Skireis)";
        var save = h("button", "ssc-wg-btn", "Opslaan");
        save.type = "button";
        save.addEventListener("click", function () {
          if (!date.value) {
            date.focus();
            return;
          }
          var value = { date: date.value, label: label.value.trim() };
          patchData({ holiday: value });
          renderHoliday(body);
        });
        actions.appendChild(date);
        actions.appendChild(label);
        actions.appendChild(save);
      });
      actions.appendChild(own);
    });
  }

  /* ---------- Snelkoppelingen ---------- */

  /*
   * Four big buttons. Smartschool paths as its own topbar uses them
   * (/results, /planner, the Messages module); Berichten prefers the href of
   * the topbar's own messages button when it is there. Teams is Microsoft
   * Teams, in a new tab.
   */
  var SHORTCUTS = [
    { icon: "chart", label: "Resultaten", path: "/results" },
    { icon: "calendar", label: "Agenda", path: "/planner" },
    { icon: "mail", label: "Berichten", path: "/?module=Messages&file=index&function=main", topbar: ".js-btn-messages" },
    { icon: "users", label: "Teams", url: "https://teams.microsoft.com/", external: true },
  ];

  function renderShortcuts(body) {
    var grid = h("div", "ssc-wg-shortcuts");
    SHORTCUTS.forEach(function (s) {
      var a = h("a", "ssc-wg-shortcut");
      var href = s.url;
      if (!href) {
        var own = s.topbar && document.querySelector(s.topbar);
        var ownHref = own && own.getAttribute("href");
        href = ownHref ? new URL(ownHref, location.origin).href : location.origin + s.path;
      }
      a.href = href;
      if (s.external) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      a.appendChild(iconSpan("ssc-wg-shortcut-icon", s.icon));
      a.appendChild(h("span", "ssc-wg-shortcut-label", s.label));
      grid.appendChild(a);
    });
    body.appendChild(grid);
  }

  /* ---------- Smartschool's own widgets (Bug 14) ---------- */

  /**
   * smpp's approach, minus the rebuild: it reads every `#leftcontainer`
   * `#rightcontainer` `.homepage__block`, gives each one a registry entry and
   * then re-serialises the whole grid (widgets.ts:605-637). The rebuild is
   * what breaks on us: Smartschool's renderer owns those nodes and drops them
   * on the next paint.
   *
   * So we never move anything. A block gets a marker attribute when the user
   * hides it, one scoped rule supplies the `display:none`, and the list of
   * hidden ids lives in settings — which makes it survive a re-render, a
   * reload and a restart. `display:none !important` is CLAUDE.md's one
   * sanctioned `!important`: the user explicitly asked for the element to go.
   */
  var SM_HIDDEN_ATTR = "data-ssc-sm-hidden";
  var SM_BTN_ATTR = "data-ssc-sm-hidebtn";

  function smartschoolWidgetBounds() {
    var out = [];
    var roots = ["leftcontainer", "rightcontainer", "centercontainer"];
    for (var i = 0; i < roots.length; i++) {
      var root = document.getElementById(roots[i]);
      if (!root) continue;
      var blocks = root.querySelectorAll(".homepage__block");
      for (var j = 0; j < blocks.length; j++) {
        var block = blocks[j];
        var id = block.id || block.getAttribute("data-widget-id") || "";
        if (!id) {
          // A block without an id cannot be remembered. Give it a stable one
          // from its position in its own column.
          id = roots[i] + "-block-" + j;
        }
        out.push({ el: block, id: id });
      }
    }
    return out;
  }

  function hiddenSmartschoolIds() {
    var list = settings && Array.isArray(settings.hiddenSmartschoolWidgets)
      ? settings.hiddenSmartschoolWidgets
      : [];
    return list;
  }

  function setSmartschoolHidden(id, hide) {
    var list = hiddenSmartschoolIds().slice();
    var at = list.indexOf(id);
    if (hide && at === -1) list.push(id);
    if (!hide && at !== -1) list.splice(at, 1);
    return window.sscSet({ hiddenSmartschoolWidgets: list }).then(function (next) {
      settings = next;
      applySmartschoolVisibility();
    });
  }

  function ensureSmartschoolStyle(shadow) {
    if (!shadow || shadow.querySelector("style[data-ssc-smwidgets]")) return;
    var style = document.createElement("style");
    style.setAttribute("data-ssc-smwidgets", "1");
    style.textContent = [
      '[' + SM_HIDDEN_ATTR + '="1"] { display: none !important; }',
      '.' + SM_BTN_ATTR + ' {',
      '  position: absolute; top: 6px; right: 6px; z-index: 3;',
      '  width: 22px; height: 22px; line-height: 1; padding: 0;',
      '  border-radius: 50%; border: 1px solid rgba(128,138,152,.45);',
      '  background: rgba(16,22,31,.72); color: #e8eef6; font-size: 13px;',
      '  cursor: pointer; opacity: 0; transition: opacity 140ms ease;',
      '}',
      '.homepage__block:hover .' + SM_BTN_ATTR + ' { opacity: 1; }',
      '.' + SM_BTN_ATTR + ':focus-visible { opacity: 1; }',
      '@media (prefers-reduced-motion: reduce) { .' + SM_BTN_ATTR + ' { transition: none; } }',
    ].join("\n");
    shadow.appendChild(style);
  }

  /** Marks every block the user hid, and gives the rest a hide button. */
  function applySmartschoolVisibility() {
    var l = live();
    if (!l) return;
    ensureSmartschoolStyle(l.shadow);

    var hidden = hiddenSmartschoolIds();
    var blocks = smartschoolWidgetBounds();

    for (var i = 0; i < blocks.length; i++) {
      var entry = blocks[i];
      var isHidden = hidden.indexOf(entry.id) !== -1;
      // Conditional writes only: setAttribute with the value it already has
      // still produces a mutation record, and this function runs inside a
      // MutationObserver callback.
      if (isHidden && entry.el.getAttribute(SM_HIDDEN_ATTR) !== "1") {
        entry.el.setAttribute(SM_HIDDEN_ATTR, "1");
      } else if (!isHidden && entry.el.hasAttribute(SM_HIDDEN_ATTR)) {
        entry.el.removeAttribute(SM_HIDDEN_ATTR);
      }

      if (isHidden) {
        // No button on a hidden block — it would be invisible anyway.
        var stale = entry.el.querySelector("." + SM_BTN_ATTR);
        if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
        continue;
      }
      if (entry.el.querySelector("." + SM_BTN_ATTR)) continue;

      // The block has to be a positioning context for the button.
      if (!entry.el.getAttribute("data-ssc-sm-pos")) {
        if (window.getComputedStyle(entry.el).position === "static") {
          entry.el.style.position = "relative";
          entry.el.setAttribute("data-ssc-sm-pos", "1");
        }
      }

      var btn = h("button", SM_BTN_ATTR, "×");
      btn.type = "button";
      btn.title = "Widget van Smartschool verbergen";
      btn.setAttribute("aria-label", "Widget van Smartschool verbergen");
      (function (id) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          setSmartschoolHidden(id, true);
        });
      })(entry.id);
      entry.el.appendChild(btn);
    }
  }

  /* ---------- boot ---------- */

  function ensureWidgetsElement() {
    var l = live();
    if (!l) return false;
    if (widgetsEl && widgetsEl.isConnected) return true;

    ensureStyles(l.shadow);
    widgetsEl = h("div");
    widgetsEl.id = "ssc-widgets";
    widgetsEl.setAttribute("data-on", "0");
    // First child, so the panel/calc/modal that follow in the layer paint over
    // the grid without needing a z-index fight inside the shadow root.
    l.layer.insertBefore(widgetsEl, l.layer.firstChild);
    return true;
  }

  function refresh() {
    if (!ensureWidgetsElement()) return;
    renderGrid();
    schedulePosition();
    applySmartschoolVisibility();
  }

  function checkPage() {
    var on = isStartPage();
    if (on === wasOnPage) {
      // Same page, but Smartschool may have repainted its own blocks away.
      // Re-applying the markers is two attribute reads per block and makes
      // a hide survive their re-render (Bug 14).
      if (on) applySmartschoolVisibility();
      return;
    }
    wasOnPage = on;
    refresh();
  }

  function hookRoute() {
    function schedule() {
      if (routeTimer) window.clearTimeout(routeTimer);
      routeTimer = window.setTimeout(checkPage, 250);
    }
    try {
      ["pushState", "replaceState"].forEach(function (name) {
        var original = history[name];
        if (typeof original !== "function" || original.__ssc) return;
        var wrapped = function () {
          var result = original.apply(this, arguments);
          schedule();
          return result;
        };
        wrapped.__ssc = true;
        history[name] = wrapped;
      });
    } catch (e) {
      /* A locked-down history object still leaves the popstate path. */
    }
    window.addEventListener("popstate", schedule);

    // Smartschool's renderer does not always route through history, so a
    // pure pushState/popstate hook misses renders. The old code polled once a
    // second; an observer on <main> (the renderer's own subtree) plus the
    // throttle that is already here does the same job without a timer, and
    // CLAUDE.md asks for observers over polling.
    var target = document.querySelector("main") || document.body;
    if (!target || typeof MutationObserver !== "function") {
      window.setInterval(checkPage, 1000);
      return;
    }
    var mo = new MutationObserver(schedule);
    mo.observe(target, { childList: true, subtree: true });
  }

  /**
   * content.js rebuilds the shadow layer when an SPA render detaches it.
   * The grid element and the picker modal are children of that layer, so they
   * die with it; this hook re-creates them in the new one instead of waiting
   * for the next scroll to notice they are gone.
   */
  var previousLayerHook = window.sscOnLayerRemount;

  window.sscOnLayerRemount = function (layer) {
    widgetsEl = null;
    modalEl = null;
    if (previousLayerHook) {
      try {
        previousLayerHook(layer);
      } catch (e) {
        /* Another module's failure is not ours. */
      }
    }
    // The widgets live in the page now (widget-system.js), not in the
    // layer, so a remount has nothing of ours to re-create.
  };

  /*
   * The start page grid is Smartschool++'s widget system now
   * (widget-system.js): pencil, bag, drag in/out, Smartschool's own blocks
   * in the same columns. This module only owns the 8 widgets themselves
   * (registry, renderers, their data) and hands them over through
   * window.sscWidgetKit. The old overlay grid drew the widgets below the
   * bottom edge of #container, i.e. off-screen, and its close buttons hid
   * blocks with a style that lived in the shadow root and never applied.
   */
  function sscWidgetsStart() {
    readData(function () {
      if (typeof window.sscWidgetSystemStart === "function") window.sscWidgetSystemStart();
    });
  }

  /* Only the inner card styles; the frame comes from widget-system.js. */
  var KIT_CSS = [
    ".ssc-wg-card {",
    "  --ssc-line: color-mix(in srgb, var(--ssc-text, #1a1a2e) 14%, transparent);",
    "  --ssc-muted: color-mix(in srgb, var(--ssc-text, #1a1a2e) 62%, transparent);",
    "  --ssc-accent-ink: var(--ssc-accent, #2b6cb0);",
    "  --ssc-accent-soft: color-mix(in srgb, var(--ssc-accent, #2b6cb0) 14%, transparent);",
    "  color: var(--ssc-text, #1a1a2e); font-size: 13px; line-height: 1.5;",
    "}",
    ".ssc-wg-card .ssc-wg-head { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }",
    ".ssc-wg-card .ssc-wg-icon { flex: none; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px;",
    "  color: var(--ssc-accent-ink); background: var(--ssc-accent-soft);",
    "  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ssc-accent-ink) 22%, transparent); }",
    ".ssc-wg-card .ssc-wicon, .ssc-widget-icon .ssc-wicon, .ssc-pick-icon .ssc-wicon { width: 16px; height: 16px; display: block; }",
    ".ssc-wg-card .ssc-wg-link-icon { display: inline-grid; place-items: center; width: 22px; color: var(--ssc-accent-ink); }",
    /* Weer */
    ".ssc-wg-card .ssc-wg-weather { display: flex; align-items: center; gap: 12px; margin: 6px 0 4px; }",
    ".ssc-wg-card .ssc-wg-weather-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; flex: none;",
    "  color: var(--ssc-accent-ink); background: var(--ssc-accent-soft); }",
    ".ssc-wg-card .ssc-wg-weather-icon .ssc-wicon { width: 28px; height: 28px; }",
    ".ssc-wg-card .ssc-wg-weather-main { display: flex; flex-direction: column; min-width: 0; }",
    ".ssc-wg-card .ssc-wg-weather-temp { font-size: 24px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }",
    /* Plant */
    /* Vakantie */
    ".ssc-wg-card .ssc-wg-holiday-party .ssc-wicon { width: 38px; height: 38px; }",
    ".ssc-wg-card .ssc-wg-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 700;",
    "  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".ssc-wg-card .ssc-wg-error { color: var(--ssc-red, #c0392b); font-size: 12px; font-weight: 600; }",
    /* Taken */
    ".ssc-wg-card .ssc-wg-tasks { display: flex; flex-direction: column; gap: 8px; }",
    ".ssc-wg-card .ssc-wg-task { display: flex; gap: 10px; align-items: flex-start; min-width: 0; }",
    ".ssc-wg-card .ssc-wg-task-chip { flex: none; min-width: 26px; height: 26px; padding: 0 4px; box-sizing: border-box;",
    "  border-radius: 7px; display: inline-flex; align-items: center; justify-content: center;",
    "  font-size: 12px; font-weight: 700; }",
    ".ssc-wg-card .ssc-wg-task-chip:not([class*='c-']) { background: var(--ssc-accent-soft); color: var(--ssc-accent-ink); }",
    ".ssc-wg-card .ssc-wg-task-info { min-width: 0; flex: 1; }",
    ".ssc-wg-card .ssc-wg-task-course { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: var(--ssc-muted); }",
    ".ssc-wg-card .ssc-wg-task-title { font-weight: 600; overflow-wrap: anywhere; }",
    /* Planner */
    ".ssc-wg-card .ssc-wg-pl-nav { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }",
    ".ssc-wg-card .ssc-wg-pl-day { flex: 1; text-align: center; font-weight: 700; text-transform: capitalize; }",
    ".ssc-wg-card .ssc-wg-pl-btn { flex: none; width: 26px; height: 26px; border-radius: 8px; cursor: pointer; font: inherit; font-size: 16px; line-height: 1;",
    "  border: 1px solid var(--ssc-line); background: transparent; color: inherit; }",
    ".ssc-wg-card .ssc-wg-pl-btn:hover { background: var(--ssc-accent-soft); }",
    ".ssc-wg-card .ssc-wg-pl-list { display: flex; flex-direction: column; gap: 6px; }",
    ".ssc-wg-card .ssc-wg-pl-count { margin: -4px 0 8px; text-align: center; font-size: 11px; font-weight: 700; letter-spacing: .06em;",
    "  text-transform: uppercase; color: var(--ssc-muted); }",
    ".ssc-wg-card .ssc-wg-pl-count:empty { display: none; }",
    ".ssc-wg-card .ssc-wg-pl-list--scroll { max-height: 300px; overflow-y: auto; overscroll-behavior: contain; padding-right: 4px;",
    "  scrollbar-width: thin; scrollbar-color: color-mix(in srgb, var(--ssc-text, #1a1a2e) 25%, transparent) transparent;",
    "  -webkit-mask-image: linear-gradient(180deg, #000 calc(100% - 22px), transparent);",
    "  mask-image: linear-gradient(180deg, #000 calc(100% - 22px), transparent); padding-bottom: 14px; }",
    ".ssc-wg-card .ssc-wg-pl-item { padding: 4px 6px; margin: 0 -6px; border-radius: 8px; }",
    ".ssc-wg-card .ssc-wg-pl-item[data-now='1'] { background: var(--ssc-accent-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ssc-accent-ink) 30%, transparent); }",
    ".ssc-wg-card .ssc-wg-pl-item[data-past='1'] { opacity: .55; }",
    ".ssc-wg-card .ssc-wg-pl-item { display: flex; gap: 8px; align-items: stretch; min-width: 0; }",
    ".ssc-wg-card .ssc-wg-pl-bar { flex: none; width: 4px; border-radius: 4px; }",
    ".ssc-wg-card .ssc-wg-pl-bar:not([class*='c-']) { background: var(--ssc-accent-ink); }",
    ".ssc-wg-card .ssc-wg-pl-time { flex: none; width: 92px; font-variant-numeric: tabular-nums; font-size: 12px; font-weight: 600; padding-top: 1px; }",
    ".ssc-wg-card .ssc-wg-pl-info { min-width: 0; flex: 1; }",
    ".ssc-wg-card .ssc-wg-pl-course { font-weight: 600; overflow-wrap: anywhere; }",
    /* Cijfer Gemiddelde */
    ".ssc-wg-card .ssc-wg-avg { --lvl: var(--ssc-accent-ink); }",
    ".ssc-wg-card .ssc-wg-avg[data-level='good'] { --lvl: #2f9e6a; }",
    ".ssc-wg-card .ssc-wg-avg[data-level='ok'] { --lvl: #d98a1c; }",
    ".ssc-wg-card .ssc-wg-avg[data-level='bad'] { --lvl: #d64545; }",
    ".ssc-wg-card .ssc-wg-avg-big { font-size: 34px; font-weight: 800; line-height: 1.1; color: var(--lvl); font-variant-numeric: tabular-nums; }",
    ".ssc-wg-card .ssc-wg-avg-sub { font-size: 13px; font-weight: 600; margin-bottom: 8px; }",
    ".ssc-wg-card .ssc-wg-avg-bar { height: 6px; border-radius: 6px; background: var(--ssc-line); overflow: hidden; margin-bottom: 6px; }",
    ".ssc-wg-card .ssc-wg-avg-bar > span { display: block; height: 100%; border-radius: 6px; background: var(--lvl); }",
    /* Rekenmachine */
    ".ssc-wg-card .ssc-wg-calc-input { font-size: 16px; text-align: right; font-variant-numeric: tabular-nums; }",
    ".ssc-wg-card .ssc-wg-calc-result { min-height: 18px; text-align: right; font-size: 12px; color: var(--ssc-muted); margin: 3px 2px 6px; font-variant-numeric: tabular-nums; }",
    ".ssc-wg-card .ssc-wg-calc-result.ssc-wg-calc-err { color: #d64545; }",
    ".ssc-wg-card .ssc-wg-calc-pad { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; }",
    ".ssc-wg-card .ssc-wg-calc-key { font: inherit; font-size: 14px; font-weight: 600; height: 32px; border-radius: 8px; cursor: pointer;",
    "  border: 1px solid var(--ssc-line); background: transparent; color: inherit; }",
    ".ssc-wg-card .ssc-wg-calc-key:hover { background: var(--ssc-accent-soft); }",
    ".ssc-wg-card .ssc-wg-calc-key:active { transform: scale(0.95); }",
    ".ssc-wg-card .ssc-wg-calc-op { color: var(--ssc-accent-ink); background: var(--ssc-accent-soft); }",
    ".ssc-wg-card .ssc-wg-calc-fn { color: var(--ssc-muted); }",
    /* Aftellen naar Vakantie */
    ".ssc-wg-card .ssc-wg-holiday-name { font-weight: 700; }",
    ".ssc-wg-card .ssc-wg-holiday-big { font-size: 38px; font-weight: 800; line-height: 1.1; color: var(--ssc-accent-ink); font-variant-numeric: tabular-nums; }",
    ".ssc-wg-card .ssc-wg-holiday-actions { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; align-items: flex-start; }",
    /* Snelkoppelingen */
    ".ssc-wg-card .ssc-wg-shortcuts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }",
    ".ssc-wg-card .ssc-wg-shortcut { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;",
    "  min-height: 58px; padding: 6px; border-radius: 10px; text-decoration: none; color: inherit;",
    "  border: 1px solid var(--ssc-line); background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 3%, transparent); }",
    ".ssc-wg-card .ssc-wg-shortcut:hover { background: var(--ssc-accent-soft); color: var(--ssc-accent-ink); border-color: transparent; }",
    ".ssc-wg-card .ssc-wg-shortcut-icon { font-size: 20px; line-height: 1; }",
    ".ssc-wg-card .ssc-wg-shortcut-label { font-size: 12px; font-weight: 600; }",
    ".ssc-wg-card .ssc-wg-shortcut-icon .ssc-wicon { width: 20px; height: 20px; }",
  ].concat(window.sscWidgetGamesCss ? [window.sscWidgetGamesCss] : []).concat(window.sscWidget3dCss ? [window.sscWidget3dCss] : []).concat(CSS.split(/\}\n/).map(function (rule) {
    return rule + "}";
  }).filter(function (rule) {
    // Whole rules only: re-use the renderer styles, drop the old overlay,
    // grid, grip, close button and outer card frame.
    var selector = rule.split("{")[0].trim();
    return !/#ssc-widgets|ssc-wg-grid|ssc-wg-grip|ssc-wg-close|^\.ssc-wg$|^\.ssc-wg:hover|ssc-wg\[data-drag|^@media/.test(selector);
  })).join("\n");

  window.sscWidgetKit = {
    defs: SSC_WIDGETS.map(function (d) {
      return { id: d.id, name: d.name, icon: d.icon, description: d.description, category: d.category };
    }),
    CSS: KIT_CSS,
    /** Default set for a first layout: whatever was switched on before. */
    defaultIds: function () {
      return window.sscGet().then(function (s) {
        settings = s;
        return orderIds();
      });
    },
    /**
     * Renders widget `id` into a new card element. Returns { node, dispose }.
     * The card has no close button: removal is dragging it into the bag.
     */
    render: function (id) {
      var def = BY_ID[id] || HUB_ONLY[id];
      var card = h("div", "ssc-wg-card");
      if (!def) return { node: card, dispose: function () {} };
      card.setAttribute("data-widget", id);
      var head = h("div", "ssc-wg-head");
      head.appendChild(iconSpan("ssc-wg-icon", def.icon));
      head.appendChild(h("span", "ssc-wg-title", def.name));
      card.appendChild(head);
      var body = h("div", "ssc-wg-body");
      card.appendChild(body);
      var bucket = [];
      var disposers = [];
      renderBucket = bucket;
      renderBody = card;
      renderDisposers = disposers;
      try {
        def.render(body);
      } catch (e) {
        body.appendChild(h("div", "ssc-wg-muted", "Deze widget kon niet laden."));
      } finally {
        renderBucket = null;
        renderBody = null;
        renderDisposers = null;
      }
      return {
        node: card,
        dispose: function () {
          for (var i = 0; i < bucket.length; i++) window.clearInterval(bucket[i]);
          bucket.length = 0;
          for (var j = 0; j < disposers.length; j++) {
            try {
              disposers[j]();
            } catch (e) {
              /* One cleanup must not stop the rest. */
            }
          }
          disposers.length = 0;
        },
      };
    },
  };

  /*
   * Data API for the settings window (settings-window.js → Widgets tab). It
   * draws its own rows in smpp's control style; this module stays the owner
   * of the registry, the storage shape and the start-page grid.
   *
   * list() returns ALL widgets: enabled ones first in their saved order, then
   * the disabled ones (in saved order where known, else registry order).
   * widgetOrder may hold disabled ids too, so a widget switched back on
   * returns to the place it had.
   */
  function allIdsInOrder() {
    var saved = (settings && Array.isArray(settings.widgetOrder)) ? settings.widgetOrder : [];
    var enabled = orderIds();
    var seen = {};
    var out = [];
    for (var i = 0; i < enabled.length; i++) {
      seen[enabled[i]] = true;
      out.push(enabled[i]);
    }
    for (var j = 0; j < saved.length; j++) {
      if (BY_ID[saved[j]] && !seen[saved[j]]) {
        seen[saved[j]] = true;
        out.push(saved[j]);
      }
    }
    for (var k = 0; k < SSC_WIDGETS.length; k++) {
      if (!seen[SSC_WIDGETS[k].id]) out.push(SSC_WIDGETS[k].id);
    }
    return out;
  }

  function afterChange() {
    return readSettings(true).then(function () {
      renderGrid();
      schedulePosition();
    });
  }

  window.sscWidgetsApi = {
    list: function () {
      return readSettings(true).then(function () {
        return allIdsInOrder().map(function (id) {
          var def = BY_ID[id];
          return { id: id, name: def.name, icon: def.icon, enabled: flagEnabled(id) };
        });
      });
    },
    setEnabled: function (id, on) {
      if (!BY_ID[id]) return Promise.resolve();
      return readSettings(true).then(function () {
        return enableWidget(id, on);
      }).then(afterChange);
    },
    setOrder: function (ids) {
      var clean = (ids || []).filter(function (id) { return !!BY_ID[id]; });
      return readSettings(true).then(function () {
        if (settings) settings.widgetOrder = clean;
        return saveWidgets(widgetStateSnapshot(), clean);
      }).then(afterChange);
    },
    above: function () {
      return readSettings(true).then(function () { return !!(settings && settings.widgetsAbove); });
    },
    setAbove: function (on) {
      return window.sscSet({ widgetsAbove: !!on }).then(afterChange);
    },
    enableDrag: enableDrag,
  };

  window.SSC_WIDGETS = SSC_WIDGETS;
  window.sscWidgetsStart = sscWidgetsStart;
  window.sscWidgetsSettings = sscWidgetsSettings;
})();
