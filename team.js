/**
 * Smartschool Combined — "Mijn Team" (FIFA-style grade collection).
 *
 * Every grade from sscFetchGrades() becomes a FIFA card. Its big number is a
 * FUT rating (1-100) from the grade AND the class average Smartschool
 * publishes for that evaluation (futRating() below):
 *
 *     rating = pct × 0,9 + (pct − classAvg) × 0,2
 *
 * The card's tier is the grade's own percentage (fifa-card.js); the badge in
 * the grid view is its *card value*, which says how far the grade sits from
 * this user's own overall average:
 *
 *     value = (grade% − classAverage%) + tierBonus
 *     tierBonus: bronze 0 · silver 5 · gold 15 · icon 30
 *
 * The class average is weighted by max, exactly like a real average would be:
 * sum(score) / sum(max) * 100 over every grade that carries a fraction. If no
 * grade does, the plain mean of the percentages is used instead.
 *
 * The cards are derived on every open, so they cannot go stale after a grade
 * is added in Smartschool. The line-up, the last imported opponent and the
 * battle points are stored per Smartschool user (see the manager below).
 */
(function () {
  "use strict";

  // Sign-in pages: do nothing at all (see guard.js).
  if (window.sscSkipPage) return;

  if (window.sscTeamRender) return;

  var TIER_LABEL = { bronze: "brons", silver: "zilver", gold: "goud", icon: "icon" };
  var TIER_BONUS = { bronze: 0, silver: 5, gold: 15, icon: 30 };

  /**
   * Subject → position strength (CLAUDE.md, Bug 15).
   *
   * Football logic, not an alphabetical split:
   *   DEF — subjects built on precision, rules and defensive reasoning
   *   MID — subjects that connect other knowledge and carry the build-up
   *   ATT — expressive, creative, performance-facing subjects
   *   GK  — one subject per user, the one that stands alone at the back:
   *         the hardest to be good at and the one everything depends on
   *
   * Lookup is normalised (lowercase, no accents) and matched by substring, so
   * "Frans (2e taal)" still lands on ATT. Unknown subjects fall back to MID,
   * which is the least wrong place for a subject we know nothing about.
   */
  var SSC_SUBJECT_POSITIONS = {
    wiskunde: "MID",
    fysica: "MID",
    natuurkunde: "MID",
    chemie: "MID",
    biologie: "DEF",        // systems and structures: the back line
    nederlands: "ATT",
    engels: "ATT",
    frans: "ATT",
    duits: "ATT",
    spaans: "ATT",
    italiaans: "ATT",
    latijn: "DEF",          // grammar and rules
    grieks: "DEF",
    geschiedenis: "DEF",
    aardrijkskunde: "DEF",
    godsdienst: "DEF",
    zedenleer: "DEF",
    economie: "MID",
    boekhouden: "MID",
    informatica: "MID",
    ict: "MID",
    techniek: "MID",
    wetenschappen: "MID",
    nawi: "MID",
    lo: "ATT",
    lichamelijke: "ATT",
    muziek: "ATT",
    muzische: "ATT",
    kunst: "ATT",
    plastische: "ATT",
    drama: "ATT",
    // A user with exactly one subject gets that subject in goal: an isolated
    // role with full responsibility, which is what "the only subject" is.
  };

  var GK_SUBJECT = "wiskunde"; // hard to fake, everything is built on it

  function normaliseSubject(name) {
    return String(name || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  }

  function positionFor(vak) {
    var key = normaliseSubject(vak);
    if (!key) return "MID";
    var names = Object.keys(SSC_SUBJECT_POSITIONS);
    for (var i = 0; i < names.length; i++) {
      if (key.indexOf(names[i]) !== -1) return SSC_SUBJECT_POSITIONS[names[i]];
    }
    return "MID"; // unknown subject: central, adaptable
  }

  var FORMATIONS = {
    "4-3-3": ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "ATT", "ATT", "ATT"],
    "4-4-2": ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "ATT", "ATT"],
    "3-5-2": ["GK", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "MID", "ATT", "ATT"],
    "5-3-2": ["GK", "DEF", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "ATT", "ATT"],
  };

  var view = {
    grades: null,
    loading: false,
    failed: "",
    sort: "value",
    tier: "all",
    value: "all",
    best11: false,
    seq: 0,
  };

  /* ---------- style ---------- */

  var CSS = [
    ".ssc-team-root { color: var(--ssc-text, #1a1a2e); }",
    ".ssc-team-head { display:flex; align-items:center; justify-content:space-between; gap:10px; }",
    ".ssc-team-title { margin:0; font-size:16px; font-weight:700; }",
    ".ssc-team-score { margin:2px 0 0; font-size:12px; color:var(--ssc-muted); }",
    ".ssc-team-score b { color:var(--ssc-accent-ink); font-variant-numeric:tabular-nums; }",
    ".ssc-team-refresh { flex:none; }",
    ".ssc-team-controls { display:flex; flex-direction:column; gap:8px; margin:12px 0 4px; }",
    ".ssc-team-line { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }",
    ".ssc-team-line-label { font-size:11px; font-weight:700; text-transform:uppercase;",
    "  letter-spacing:.05em; color:var(--ssc-muted); min-width:64px; }",
    ".ssc-team-chip {",
    "  font: inherit; font-size:11.5px; font-weight:600; padding:4px 9px;",
    "  border:1px solid var(--ssc-line); border-radius:999px;",
    "  background:var(--ssc-surface-2); color:var(--ssc-text, #1a1a2e);",
    "  cursor:pointer; pointer-events:auto;",
    "}",
    ".ssc-team-chip:hover { border-color:var(--ssc-accent-ink); }",
    ".ssc-team-chip[data-active='1'] {",
    "  background:var(--ssc-accent-soft); border-color:var(--ssc-accent-ink);",
    "  color:var(--ssc-accent-ink);",
    "}",
    ".ssc-team-select {",
    "  font:inherit; font-size:12px; padding:4px 8px; border-radius:8px;",
    "  border:1px solid var(--ssc-line); background:var(--ssc-surface-2);",
    "  color:var(--ssc-text, #1a1a2e); pointer-events:auto;",
    "}",
    ".ssc-team-select option { background-color:var(--ssc-base00, #ffffff); color:var(--ssc-text, #1a1a2e); }",
    ".ssc-team-grid {",
    "  display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));",
    "  gap:12px; margin-top:14px; align-items:start;",
    "}",
    ".ssc-team-card {",
    "  position:relative; min-width:0; max-width:200px; justify-self:center; width:100%;",
    "  cursor:pointer; pointer-events:auto; transition:transform 180ms ease;",
    "}",
    ".ssc-team-card:hover, .ssc-team-card:focus-visible { transform:translateY(-3px); }",
    ".ssc-team-card:focus-visible { outline:2px solid var(--ssc-accent-ink); outline-offset:4px; border-radius:14px; }",
    ".ssc-team-card .ssc-fc { width:100%; max-width:100%; height:auto; aspect-ratio:5/7; }",
    ".ssc-team-card .ssc-fc-wrap { filter:drop-shadow(0 10px 18px rgba(0,0,0,.4)); }",
    ".ssc-team-card[data-tier='gold']:hover .ssc-fc-wrap {",
    "  filter:drop-shadow(0 0 22px rgba(255,211,77,.55)) drop-shadow(0 10px 18px rgba(0,0,0,.4)); }",
    ".ssc-team-card[data-tier='icon']:hover .ssc-fc-wrap {",
    "  filter:drop-shadow(0 0 24px rgba(110,168,255,.6)) drop-shadow(0 10px 18px rgba(0,0,0,.4)); }",
    ".ssc-team-badge {",
    "  position:absolute; top:6px; right:6px; z-index:6;",
    "  display:inline-block; padding:2px 8px; border-radius:999px;",
    "  font-size:11px; font-weight:800; font-variant-numeric:tabular-nums;",
    "  border:1px solid transparent; cursor:help; pointer-events:auto;",
    "}",
    ".ssc-team-badge--up { background:rgba(74,222,128,.15); color:#4ade80; border-color:rgba(74,222,128,.35); }",
    ".ssc-team-badge--zero { background:rgba(148,163,184,.18); color:#a8b3c1; border-color:rgba(148,163,184,.35); }",
    ".ssc-team-badge--down { background:rgba(248,113,113,.15); color:#f87171; border-color:rgba(248,113,113,.35); }",
    ".ssc-team-tip {",
    "  position:absolute; top:30px; right:6px; z-index:7;",
    "  display:none; width:max-content; max-width:220px; padding:6px 8px;",
    "  border:1px solid var(--ssc-line); border-radius:8px;",
    "  background:var(--ssc-surface); color:var(--ssc-text, #1a1a2e);",
    "  font-size:11px; line-height:1.35; box-shadow:0 6px 16px rgba(0,0,0,.35);",
    "}",
    ".ssc-team-card:hover .ssc-team-tip, .ssc-team-badge:focus + .ssc-team-tip { display:block; }",
    ".ssc-team-meta { margin-top:6px; text-align:center; min-width:0; }",
    ".ssc-team-vak { font-size:12px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }",
    ".ssc-team-titel { font-size:11px; color:var(--ssc-muted); overflow:hidden;",
    "  text-overflow:ellipsis; white-space:nowrap; }",
    ".ssc-team-empty { padding:28px 12px; text-align:center; color:var(--ssc-muted); font-size:13px; line-height:1.6; }",
    ".ssc-team-loading { display:flex; align-items:center; gap:10px; padding:24px 4px; color:var(--ssc-muted); }",
    "@media (prefers-reduced-motion: reduce) {",
    "  .ssc-team-card { transition:none; }",
    "  .ssc-team-card:hover, .ssc-team-card:focus-visible { transform:none; }",
    "}",
  ].join("\n");

  function ensureStyle() {
    var host = document.getElementById("ssc-root");
    if (!host || !host.shadowRoot) return;
    if (host.shadowRoot.querySelector("style[data-ssc-team]")) return;
    var style = document.createElement("style");
    style.setAttribute("data-ssc-team", "1");
    style.textContent = CSS;
    host.shadowRoot.appendChild(style);
    if (window.sscFifaCard && window.sscFifaCard.ensureStyles) {
      window.sscFifaCard.ensureStyles(host.shadowRoot);
    }
  }

  /* ---------- small helpers ---------- */

  function h(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  /* Small line icons for buttons and badges (stroked, currentColor). */
  var TM_ICONS = {
    trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5v1.5A3.5 3.5 0 0 0 8 11M16 6h3.5v1.5A3.5 3.5 0 0 1 16 11M12 13v4M8.5 20.5h7M9.5 17h5v3.5h-5z",
    lock: "M6.5 11h11v9.5h-11zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 14.5v2.5",
    swords: "M4 4l9.5 9.5M4 4v3.5l8.3 8.3M4 4h3.5l8.3 8.3M20 4l-9.5 9.5M20 4v3.5l-3 3M20 4h-3.5l-3 3M6 18l3-3M18 18l-3-3M5 19.5l1-1M19 19.5l-1-1",
    close: "M6 6l12 12M18 6 6 18",
    ball: "M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6zM12 8.2l3.4 2.5-1.3 4h-4.2l-1.3-4zM12 8.2V3.4M15.4 10.7l4.6-1.5M14.1 14.7l2.8 3.9M9.9 14.7l-2.8 3.9M8.6 10.7 4 9.2",
  };
  var TM_NS = "http://www.w3.org/2000/svg";

  function tmIcon(name) {
    var svg = document.createElementNS(TM_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.9");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "ssc-tm-ico");
    var path = document.createElementNS(TM_NS, "path");
    path.setAttribute("d", TM_ICONS[name]);
    svg.appendChild(path);
    return svg;
  }

  /** h() with a leading icon: <tag class>[svg] text</tag>. */
  function hi(tag, cls, icon, text) {
    var node = h(tag, cls);
    node.appendChild(tmIcon(icon));
    node.appendChild(document.createTextNode(String(text)));
    return node;
  }

  function cardModule() {
    return window.sscFifaCard || null;
  }

  function tierOf(percent) {
    var mod = cardModule();
    if (mod && mod.tierForPercent) return mod.tierForPercent(percent);
    return {
      id: percent < 50 ? "bronze" : percent < 70 ? "silver" : percent < 85 ? "gold" : "icon",
      glow: "#999",
    };
  }

  function fmtNumber(value) {
    var n = Number(value);
    if (!isFinite(n)) return "–";
    return (Math.round(n * 10) / 10).toString().replace(".", ",");
  }

  function percentOf(grade) {
    if (typeof grade.percentage === "number" && isFinite(grade.percentage)) {
      return grade.percentage;
    }
    var score = Number(grade.ruweScore);
    var max = Number(grade.ruweMax);
    if (isFinite(score) && isFinite(max) && max > 0) return (score / max) * 100;
    return null;
  }

  function op20Of(grade) {
    var pct = percentOf(grade);
    if (pct === null) return null;
    return Math.round((pct / 100) * 20 * 10) / 10;
  }

  /** Weighted class average; plain mean of percentages as the fallback. */
  function classAverage(grades) {
    var score = 0;
    var max = 0;
    var sumPct = 0;
    var countPct = 0;

    for (var i = 0; i < grades.length; i++) {
      var g = grades[i];
      var s = Number(g.ruweScore);
      var m = Number(g.ruweMax);
      if (isFinite(s) && isFinite(m) && m > 0) {
        score += s;
        max += m;
      }
      var p = percentOf(g);
      if (p !== null) {
        sumPct += p;
        countPct++;
      }
    }

    if (max > 0) return (score / max) * 100;
    if (countPct) return sumPct / countPct;
    return null;
  }

  function dateKey(datum) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(datum || ""));
    return m ? Number(m[3] + m[2] + m[1]) : 0;
  }

  /* ---------- FUT rating (class average dependent) ---------- */

  /**
   * Rating = percentage × 0,9 + (percentage − class average) × 0,2,
   * rounded, clamped to 1..100.
   *   100% vs 90% → 92 · 100% vs 50% → 100 · 50% vs 70% → 41 · 75% vs 60% → 71
   * Without a class average (the teacher did not publish one) the second
   * term is 0: the card is rated on the grade alone, with no bonus or malus.
   */
  function futRating(percent, classAvg) {
    var p = Number(percent);
    if (!isFinite(p)) return null;
    var a = classAvg === null || classAvg === undefined || !isFinite(Number(classAvg)) ? p : Number(classAvg);
    var r = p * 0.9 + (p - a) * 0.2;
    return Math.max(1, Math.min(100, Math.round(r)));
  }

  /*
   * Class averages come from the evaluation's own detail call,
   *   GET /results/api/v1/evaluations/<identifier>  →  details.centralTendencies
   * (the reference library's ResultDetails; the list call does not carry it).
   * The entries' exact shape is not documented and is empty when the teacher
   * hides the average, so the parser accepts a plain string ("12,5/20",
   * "62%") as well as an object with a name/type and a graphic, value or
   * description. "Gemiddelde/average" wins over "mediaan/median".
   *
   * Cached per grade id in chrome.storage.local (sscClassAvg): a published
   * average does not change, so a number is kept; "none" is asked again after
   * a day, in case the teacher publishes it later.
   */
  var CLASS_AVG_KEY = "sscClassAvg";
  var CLASS_AVG_RETRY_MS = 24 * 60 * 60 * 1000;
  var CLASS_AVG_PARALLEL = 4;
  var classAvgCache = null;

  function readClassAvgCache() {
    if (classAvgCache) return Promise.resolve(classAvgCache);
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get([CLASS_AVG_KEY], function (res) {
          classAvgCache = (res && res[CLASS_AVG_KEY]) || {};
          resolve(classAvgCache);
        });
      } catch (e) {
        classAvgCache = {};
        resolve(classAvgCache);
      }
    });
  }

  function writeClassAvgCache() {
    try {
      var payload = {};
      payload[CLASS_AVG_KEY] = classAvgCache || {};
      chrome.storage.local.set(payload);
    } catch (e) {
      /* Only costs a refetch next time. */
    }
  }

  function percentFromText(text) {
    var s = String(text || "").replace(/\s+/g, "");
    var frac = /(-?\d+(?:[.,]\d+)?)\/(\d+(?:[.,]\d+)?)/.exec(s);
    if (frac) {
      var a = parseFloat(frac[1].replace(",", "."));
      var b = parseFloat(frac[2].replace(",", "."));
      if (isFinite(a) && isFinite(b) && b > 0) return (a / b) * 100;
    }
    var pct = /(-?\d+(?:[.,]\d+)?)%/.exec(s);
    if (pct) return parseFloat(pct[1].replace(",", "."));
    return null;
  }

  function tendencyOf(entry) {
    if (entry === null || entry === undefined) return null;
    var label = "";
    var value = null;
    if (typeof entry === "string") {
      label = entry;
      value = percentFromText(entry);
    } else if (typeof entry === "number") {
      value = entry;
    } else if (typeof entry === "object") {
      label = [entry.name, entry.type, entry.label, entry.title, entry.kind].filter(Boolean).join(" ");
      var gr = entry.graphic && typeof entry.graphic === "object" ? entry.graphic : null;
      if (gr && gr.type === "percentage" && typeof gr.value === "number") value = gr.value;
      if (value === null && gr && gr.description) value = percentFromText(gr.description);
      if (value === null && typeof entry.percentage === "number") value = entry.percentage;
      if (value === null && entry.description) value = percentFromText(entry.description);
      if (value === null && typeof entry.value === "string") value = percentFromText(entry.value);
      if (value === null && typeof entry.value === "number") value = entry.value;
    }
    if (value === null || !isFinite(value) || value < 0 || value > 100) return null;
    var kind = /gemiddeld|average|avg|mean/i.test(label) ? "avg" : /mediaan|median/i.test(label) ? "median" : "other";
    return { kind: kind, pct: value };
  }

  function classAvgFromDetail(json) {
    var list = json && json.details && Array.isArray(json.details.centralTendencies)
      ? json.details.centralTendencies
      : [];
    var found = list.map(tendencyOf).filter(Boolean);
    var pick = found.filter(function (t) { return t.kind === "avg"; })[0] ||
      found.filter(function (t) { return t.kind === "median"; })[0] ||
      found[0];
    return pick ? pick.pct : null;
  }

  /** Resolves to a number, null (no average published) or undefined (failed). */
  function fetchClassAvg(id) {
    return fetch("/results/api/v1/evaluations/" + encodeURIComponent(id), {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(classAvgFromDetail, function () {
        return undefined;
      });
  }

  /**
   * id → class average (number or null) for every grade. Cached values come
   * back at once through `onUpdate`; missing ones are fetched four at a time
   * and `onUpdate` fires again after each batch.
   */
  function loadClassAverages(grades, onUpdate) {
    return readClassAvgCache().then(function (cache) {
      var now = Date.now();
      var map = {};
      var todo = [];
      grades.forEach(function (g) {
        if (!g || !g.id) return;
        var hit = cache[g.id];
        if (hit && typeof hit.v === "number") map[g.id] = hit.v;
        else if (hit && hit.v === null && now - Number(hit.t || 0) < CLASS_AVG_RETRY_MS) map[g.id] = null;
        else todo.push(g.id);
      });
      if (onUpdate) onUpdate(map, todo.length);
      var left = todo.slice();
      function batch() {
        if (!left.length) return Promise.resolve(map);
        var chunk = left.splice(0, CLASS_AVG_PARALLEL);
        return Promise.all(chunk.map(function (id) {
          return fetchClassAvg(id).then(function (v) {
            if (v === undefined) return; // network/HTTP error: ask again next open
            map[id] = v;
            cache[id] = { v: v, t: Date.now() };
          });
        })).then(function () {
          writeClassAvgCache();
          if (onUpdate) onUpdate(map, left.length);
          return batch();
        });
      }
      return batch();
    });
  }

  /* ---------- model ---------- */

  function decorate(grades, classAvgs) {
    var average = classAverage(grades);
    var avgs = classAvgs || {};
    var out = [];

    for (var i = 0; i < grades.length; i++) {
      var g = grades[i];
      var pct = percentOf(g);
      if (pct === null) continue;

      var tier = tierOf(pct);
      var bonus = TIER_BONUS[tier.id] || 0;
      var value = average === null ? null : Math.round(pct - average + bonus);
      var classAvg = typeof avgs[g.id] === "number" ? avgs[g.id] : null;

      out.push({
        grade: g,
        percent: pct,
        op20: op20Of(g),
        tier: tier,
        bonus: bonus,
        value: value,
        classAvg: classAvg,
        rating: futRating(pct, classAvg),
        above: average === null ? false : pct > average,
        below: average === null ? false : pct < average,
      });
    }

    return { cards: out, average: average };
  }

  function sorted(cards) {
    var list = cards.slice();
    list.sort(function (a, b) {
      switch (view.sort) {
        case "grade":
          return (b.op20 || 0) - (a.op20 || 0);
        case "subject":
          return String(a.grade.vak || "").localeCompare(String(b.grade.vak || "")) ||
            String(a.grade.titel || "").localeCompare(String(b.grade.titel || ""));
        case "recent":
          return dateKey(b.grade.datum) - dateKey(a.grade.datum);
        default:
          return (b.value === null ? -Infinity : b.value) -
            (a.value === null ? -Infinity : a.value);
      }
    });
    return list;
  }

  function filtered(cards) {
    return cards.filter(function (card) {
      if (view.tier !== "all" && card.tier.id !== view.tier) return false;
      if (view.value === "above" && !card.above) return false;
      if (view.value === "below" && !card.below) return false;
      return true;
    });
  }

  /* ---------- the cutscene click ---------- */

  function playCard(card) {
    if (typeof window.sscPlayCutscene !== "function") return;
    var g = card.grade;
    window.sscPlayCutscene({
      grade: card.op20 === null ? 0 : card.op20,
      percent: card.percent,
      vak: g.vak || "",
      titel: g.titel || "",
      datum: g.datum || "",
      periode: g.periode || "",
      score: g.ruweScore,
      max: g.ruweMax,
      type: g.type || "",
      hasNext: false,
      sound: true,
    });
  }

  /* ---------- rendering ---------- */

  function chip(label, active, onClick) {
    var btn = h("button", "ssc-team-chip", label);
    btn.type = "button";
    btn.setAttribute("data-active", active ? "1" : "0");
    btn.addEventListener("click", onClick);
    return btn;
  }

  function controls(root, average) {
    var wrap = h("div", "ssc-team-controls");

    // sort
    var sortLine = h("div", "ssc-team-line");
    sortLine.appendChild(h("span", "ssc-team-line-label", "Sorteer op"));
    var select = h("select", "ssc-team-select");
    var options = [
      ["value", "Kaartwaarde"],
      ["grade", "Cijfer"],
      ["subject", "Vak"],
      ["recent", "Recent"],
    ];
    for (var i = 0; i < options.length; i++) {
      var opt = h("option", null, options[i][1]);
      opt.value = options[i][0];
      select.appendChild(opt);
    }
    select.value = view.sort;
    select.addEventListener("change", function () {
      view.sort = select.value;
      paint(root);
    });
    sortLine.appendChild(select);
    wrap.appendChild(sortLine);

    // tier chips
    var tierLine = h("div", "ssc-team-line");
    tierLine.appendChild(h("span", "ssc-team-line-label", "Tier"));
    var tiers = [
      ["all", "Alle"],
      ["bronze", "Brons"],
      ["silver", "Zilver"],
      ["gold", "Goud"],
      ["icon", "Icon"],
    ];
    for (var t = 0; t < tiers.length; t++) {
      (function (key, label) {
        tierLine.appendChild(
          chip(label, view.tier === key, function () {
            view.tier = key;
            paint(root);
          })
        );
      })(tiers[t][0], tiers[t][1]);
    }
    wrap.appendChild(tierLine);

    // value chips
    var valueLine = h("div", "ssc-team-line");
    valueLine.appendChild(h("span", "ssc-team-line-label", "Waarde"));
    var values = [
      ["all", "Alle"],
      ["above", "Boven gemiddelde"],
      ["below", "Onder gemiddelde"],
    ];
    for (var v = 0; v < values.length; v++) {
      (function (key, label) {
        valueLine.appendChild(
          chip(label, view.value === key, function () {
            view.value = key;
            paint(root);
          })
        );
      })(values[v][0], values[v][1]);
    }
    wrap.appendChild(valueLine);

    // best 11
    var bestLine = h("div", "ssc-team-line");
    bestLine.appendChild(
      chip("Toon alleen beste 11", view.best11, function () {
        view.best11 = !view.best11;
        paint(root);
      })
    );
    if (average !== null) {
      bestLine.appendChild(
        h(
          "span",
          "ssc-team-line-label",
          "Klasgemiddelde " + fmtNumber(average) + "%"
        )
      );
    }
    wrap.appendChild(bestLine);

    return wrap;
  }

  function tooltipText(card, average) {
    if (card.value === null || average === null) {
      return "Geen klasgemiddelde beschikbaar.";
    }
    var tierName = TIER_LABEL[card.tier.id] || card.tier.id;
    var sign = card.bonus >= 0 ? " + " : " − ";
    return (
      fmtNumber(card.percent) + "% − " + fmtNumber(average) +
      "% gemiddelde" + sign + Math.abs(card.bonus) + " (" + tierName + ") = " +
      (card.value > 0 ? "+" : "") + card.value
    );
  }

  function cardNode(card, average) {
    var node = h("div", "ssc-team-card");
    node.setAttribute("data-tier", card.tier.id);
    node.setAttribute("role", "button");
    node.setAttribute("tabindex", "0");
    node.setAttribute("aria-label", (card.grade.vak || "Cijfer") + " " + fmtNumber(card.op20));

    var cardMod = cardModule();
    if (cardMod) {
      var built = cardMod.build(
        {
          op20: card.op20,
          percentage: card.percent,
          vak: card.grade.vak || "",
          titel: card.grade.titel || "",
          datum: card.grade.datum || "",
          periode: card.grade.periode || "",
          score: card.grade.ruweScore,
          max: card.grade.ruweMax,
          type: card.grade.type || "",
        },
        { fill: false, animateShine: false, enter: false, rating: card.rating }
      );
      if (built.numNode) built.numNode.textContent = built.ratingText;
      node.appendChild(built.node);
    } else {
      node.appendChild(h("div", "ssc-hint", "Kaart niet beschikbaar"));
    }

    var value = card.value === null ? 0 : card.value;
    var cls =
      value > 0
        ? "ssc-team-badge ssc-team-badge--up"
        : value < 0
          ? "ssc-team-badge ssc-team-badge--down"
          : "ssc-team-badge ssc-team-badge--zero";
    var badge = h(
      "span",
      cls,
      card.value === null ? "–" : (value > 0 ? "+" : "") + value
    );
    badge.tabIndex = 0;
    badge.setAttribute("aria-label", "Kaartwaarde: " + tooltipText(card, average));
    node.appendChild(badge);

    node.appendChild(h("div", "ssc-team-tip", tooltipText(card, average)));

    var meta = h("div", "ssc-team-meta");
    meta.appendChild(h("div", "ssc-team-vak", card.grade.vak || "Cijfer"));
    meta.appendChild(
      h("div", "ssc-team-titel", card.grade.titel || card.grade.type || "")
    );
    node.appendChild(meta);

    node.addEventListener("click", function (e) {
      if (e.target === badge) return;
      playCard(card);
    });
    node.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        playCard(card);
      }
    });

    return node;
  }

  function paint(root) {
    ensureStyle();
    root.textContent = "";

    var wrap = h("div", "ssc-team-root");

    var head = h("div", "ssc-team-head");
    var titles = h("div");
    titles.appendChild(h("h2", "ssc-team-title", "Mijn Team"));
    var score = h("p", "ssc-team-score");
    titles.appendChild(score);
    head.appendChild(titles);

    var refresh = h("button", "ssc-btn-ghost ssc-team-refresh", "Vernieuwen");
    refresh.type = "button";
    refresh.addEventListener("click", function () {
      load(root, true);
    });
    head.appendChild(refresh);
    wrap.appendChild(head);

    if (view.loading) {
      var loading = h("div", "ssc-team-loading");
      loading.appendChild(h("span", "ssc-spinner"));
      loading.appendChild(h("span", null, "Cijfers ophalen…"));
      wrap.appendChild(loading);
      root.appendChild(wrap);
      return;
    }

    if (view.failed) {
      wrap.appendChild(
        h(
          "div",
          "ssc-team-empty",
          "Kon je cijfers niet ophalen. Open de Resultaten-pagina en probeer opnieuw."
        )
      );
      root.appendChild(wrap);
      return;
    }

    var data = decorate(view.grades || []);
    var total = data.cards.reduce(function (sum, card) {
      return sum + (card.value !== null && card.value > 0 ? card.value : 0);
    }, 0);
    score.appendChild(document.createTextNode("Teamscore "));
    score.appendChild(h("b", null, "+" + total));

    if (!data.cards.length) {
      wrap.appendChild(
        h(
          "div",
          "ssc-team-empty",
          "Nog geen cijfers. Open je Resultaten-pagina om je eerste kaarten te verdienen."
        )
      );
      root.appendChild(wrap);
      return;
    }

    wrap.appendChild(controls(root, data.average));

    var list = filtered(data.cards);
    // "Starting XI": the eleven most valuable cards, whatever the display
    // order is. The sort dropdown then orders that eleven, not the whole set.
    if (view.best11) {
      list = list
        .slice()
        .sort(function (a, b) {
          return (b.value === null ? -Infinity : b.value) -
            (a.value === null ? -Infinity : a.value);
        })
        .slice(0, 11);
    }
    list = sorted(list);

    if (!list.length) {
      wrap.appendChild(
        h("div", "ssc-team-empty", "Geen kaarten voor deze filters.")
      );
      root.appendChild(wrap);
      return;
    }

    var grid = h("div", "ssc-team-grid");
    for (var i = 0; i < list.length; i++) {
      grid.appendChild(cardNode(list[i], data.average));
    }
    wrap.appendChild(grid);

    root.appendChild(wrap);
  }

  /* ---------- data ---------- */

  function load(root, force) {
    if (typeof window.sscFetchGrades !== "function") {
      view.failed = "geen fetcher";
      paint(root);
      return;
    }
    if (view.loading) return;
    if (view.grades && !force) {
      paint(root);
      return;
    }

    view.loading = true;
    view.failed = "";
    paint(root);

    var seq = ++view.seq;
    window.sscFetchGrades().then(
      function (grades) {
        if (seq !== view.seq) return;
        view.loading = false;
        view.grades = Array.isArray(grades) ? grades : [];
        paint(root);
      },
      function () {
        if (seq !== view.seq) return;
        view.loading = false;
        view.failed = "fetch";
        paint(root);
      }
    );
  }

  function sscTeamRender(body) {
    if (!body) return;
    ensureStyle();
    // Reset the filter state on every open: a filter left over from last time
    // reads as "my grades disappeared" rather than as a remembered choice.
    view.sort = "value";
    view.tier = "all";
    view.value = "all";
    view.best11 = false;
    view.grades = null;
    load(body, true);
  }

  /* ==================================================================
   * Full-screen manager (Bug 15)
   *
   * Left: the bench, every card you own as a small FUT card. Centre: a green
   * pitch with formation slots, filled slots show the same small card.
   * Right: full details of the selected card. Bottom: the action bar, with
   * Deel Team / Importeer Team / Battle.
   * Opened from the new "Team" item in Smartschool's own sub-navigation bar,
   * never from the panel.
   *
   * Storage, per Smartschool user (sscGetUserId; "anon" when unknown):
   *   sscTeam_<user>          { formation, slots: { "DEF0": gradeId } }
   *   sscOpponent_<user>      the last imported opponent
   *   sscBattlePoints_<user>  number
   * ================================================================== */

  var TEAM_PREFIX = "sscTeam_";
  var LEGACY_SQUAD_KEY = "sscTeamSquad";
  var OPPONENT_PREFIX = "sscOpponent_";
  var POINTS_PREFIX = "sscBattlePoints_";
  var POINTS_FOR = { win: 3, draw: 1, loss: 0 };

  var squad = { formation: "4-3-3", slots: {} }; // slots: { "DEF0": gradeId }
  var squadUser = null;
  var managerEl = null;
  var selectedCard = null; // { card } waiting to be placed, or null
  var selectedSlot = null; // key of the slot open in the detail panel
  var managerCards = [];
  var managerGrades = [];
  var classAvgMap = {};
  var classAvgPending = 0;
  var opponent = null; // decoded share code
  var battlePoints = 0;
  var modalEl = null;
  var battle = null; // running battle state
  var LEAGUE_PREFIX = "sscLeague_";
  var leagueInfo = null; // { className, joinedAt } once this user joined
  var leagueBusy = false;
  var leagueMsg = null; // { text, tone: "good" | "bad" | "info" } in the footer
  var managerTab = "team"; // "team" | "league"
  // The class league as last read: { members, matches } (null = not loaded).
  var leagueView = { loading: false, error: "", members: null, matches: null, busy: false };

  var MANAGER_CSS = [
    "#ssc-team-overlay {",
    "  position: fixed; inset: 0; z-index: 2147483100; display: none;",
    // Always light text: the overlay is always the dark pitch-green, whatever
    // the theme. var(--ssc-text) was near-black on Geen thema.
    "  pointer-events: auto; color: #eaf5ee;",
    "  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;",
    "  background: radial-gradient(120% 120% at 50% 0%, #0d1a13 0%, #070b0a 70%);",
    "}",
    "#ssc-team-overlay[data-open='1'] { display: flex; flex-direction: column; }",
    ".ssc-tm-head {",
    "  display: flex; align-items: center; justify-content: space-between; gap: 12px;",
    "  padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,.1);",
    "  background: rgba(8,14,10,.82); backdrop-filter: blur(10px); flex: none;",
    "}",
    ".ssc-tm-title { margin: 0; font-size: 18px; font-weight: 800; letter-spacing: .02em; color: #fff; }",
    ".ssc-tm-sub { font-size: 12px; color: #9fb4a7; margin-top: 2px; }",
    ".ssc-tm-close {",
    "  border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.06);",
    "  color: inherit; font: inherit; font-size: 16px; line-height: 1;",
    "  padding: 8px 12px; border-radius: 9px; cursor: pointer;",
    "}",
    ".ssc-tm-close:hover { background: rgba(255,255,255,.14); }",
    ".ssc-tm-body {",
    "  flex: 1; min-height: 0; display: grid;",
    "  grid-template-columns: 260px minmax(320px, 1fr) 300px; gap: 14px; padding: 14px 20px;",
    "}",
    "@media (max-width: 1100px) { .ssc-tm-body { grid-template-columns: 220px 1fr 240px; } }",
    "@media (max-width: 900px) { .ssc-tm-body { grid-template-columns: 1fr; grid-template-rows: auto 1fr auto; overflow: auto; } }",
    ".ssc-tm-panel {",
    "  min-height: 0; min-width: 0; display: flex; flex-direction: column; gap: 10px;",
    "  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09);",
    "  border-radius: 14px; padding: 12px; overflow: hidden;",
    "}",
    ".ssc-tm-panel-title { font-size: 11px; font-weight: 800; letter-spacing: .08em;",
    "  text-transform: uppercase; color: #8fa697; flex: none; }",

    /* ---- the small FUT card (bench, pitch, battle) ---- */
    ".ssc-mc { container-type: inline-size; position: relative; width: 100%; aspect-ratio: 5 / 7;",
    "  box-sizing: border-box; overflow: hidden;",
    "  clip-path: polygon(2.5% 12.3%,5.5% 12.3%,8.5% 11.3%,11.5% 10%,14.5% 5%,17.5% 4.3%,20.5% 3.7%,23.5% 3.3%,26.5% 3%,29.5% 2.7%,32.5% 2.3%,35.5% 2%,38.5% 1.7%,41.5% 1.7%,44.5% 1.7%,47.5% 1.7%,50.5% 1.3%,53.5% 1.7%,56.5% 1.7%,59.5% 1.7%,62.5% 2%,65.5% 2%,68.5% 2.3%,71.5% 2.7%,74.5% 3.3%,77.5% 3.7%,80.5% 4.3%,83.5% 5%,86.5% 9%,89.5% 11%,92.5% 12%,95.5% 12.3%,97% 13%,97% 84.7%,94% 88%,91% 89%,88% 89.7%,85% 90.3%,82% 91%,79% 91.3%,76% 92%,73% 92.7%,70% 93.3%,67% 94%,64% 94.7%,61% 95.3%,58% 96%,55% 97%,52% 98%,49% 98.7%,46% 97.3%,43% 96.3%,40% 95.7%,37% 95%,34% 94.3%,31% 93.7%,28% 93%,25% 92.3%,22% 91.7%,19% 91%,16% 90.7%,13% 90%,10% 89.3%,7% 88.3%,4% 86.7%,2.5% 85.3%);",
    "  font-family: 'Bahnschrift','Segoe UI',system-ui,sans-serif; }",
    ".ssc-mc::before { content: ''; position: absolute; inset: 0; pointer-events: none;",
    "  background: radial-gradient(circle at 30% 18%, rgba(255,255,255,.45), transparent 55%); }",
    ".ssc-mc.tier-bronze { background: linear-gradient(160deg,#efc08c 0%,#b87a43 45%,#6a4120 100%); color: #2e1a08; }",
    ".ssc-mc.tier-silver { background: linear-gradient(160deg,#fafbfc 0%,#b4bcc7 48%,#707987 100%); color: #1f2630; }",
    ".ssc-mc.tier-gold { background: linear-gradient(160deg,#fff0b0 0%,#e0b030 46%,#8c6314 100%); color: #35240a; }",
    ".ssc-mc.tier-icon { background: linear-gradient(160deg,#b8f1ff 0%,#5a7dff 44%,#2a1a7c 100%); color: #fff; }",
    // Rating centred over the position, bold and condensed, like FUT.
    ".ssc-mc-top { position: absolute; left: 7cqw; top: 11cqw; width: 34cqw;",
    "  display: flex; flex-direction: column; align-items: center; line-height: 1; }",
    ".ssc-mc-rate { display: block; width: 100%; text-align: center; font-size: 30cqw; font-weight: 900;",
    "  font-stretch: condensed; font-variation-settings: 'wdth' 75; letter-spacing: -.03em;",
    "  font-variant-numeric: tabular-nums; }",
    ".ssc-mc-rate[data-wide='1'] { font-size: 24cqw; }",
    ".ssc-mc-pos { display: block; font-size: 11cqw; font-weight: 800; margin-top: 2cqw; letter-spacing: .04em; }",
    ".ssc-mc-emoji { position: absolute; right: 9cqw; top: 13cqw; font-size: 30cqw; line-height: 1;",
    "  filter: drop-shadow(0 2cqw 2cqw rgba(0,0,0,.25)); }",
    ".ssc-mc-emoji svg { display: block; width: 32cqw; height: 32cqw; opacity: .88; }",
    // The name can NEVER leave the card: block, full width, one line, ellipsis.
    ".ssc-mc-name { position: absolute; left: 7cqw; right: 7cqw; top: 63cqw; display: block; max-width: 100%;",
    "  box-sizing: border-box; text-align: center; font-size: 13.5cqw; font-weight: 800; text-transform: uppercase;",
    "  font-stretch: condensed; letter-spacing: .01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".ssc-mc-line { position: absolute; left: 16cqw; right: 16cqw; top: 81cqw; height: 1cqw; background: currentColor; opacity: .35; }",
    ".ssc-mc-stat { position: absolute; left: 6cqw; right: 6cqw; top: 87cqw; display: block; text-align: center;",
    "  font-size: 10.5cqw; font-weight: 800; font-stretch: condensed; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".ssc-mc-stat span { font-size: 8cqw; font-weight: 600; opacity: .75; margin-left: 2cqw; }",

    /* ---- bench ---- */
    ".ssc-tm-bench { overflow-y: auto; overflow-x: hidden; display: grid;",
    "  grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 8px; padding: 2px 4px 4px 2px; align-content: start; }",
    ".ssc-tm-benchcard { all: unset; box-sizing: border-box; display: block; min-width: 0; width: 100%;",
    "  cursor: pointer; transition: transform .15s ease, filter .15s ease, opacity .15s ease;",
    "  filter: drop-shadow(0 6px 10px rgba(0,0,0,.45)); }",
    ".ssc-tm-benchcard:hover { transform: translateY(-3px); }",
    ".ssc-tm-benchcard:focus-visible { outline: 2px solid #58c98a; outline-offset: 3px; }",
    ".ssc-tm-benchcard[data-placed='1'] { opacity: .4; }",
    ".ssc-tm-benchcard[data-selected='1'] { filter: drop-shadow(0 0 7px #58c98a) drop-shadow(0 0 2px #58c98a); }",

    /* ---- pitch ---- */
    ".ssc-tm-pitch {",
    "  position: relative; border-radius: 14px; overflow: hidden; min-height: 420px; min-width: 0;",
    "  container-type: size;",
    "  background: repeating-linear-gradient(0deg, #1d6b3f 0 8%, #1a6038 8% 16%);",
    "  border: 2px solid rgba(255,255,255,.18);",
    "}",
    ".ssc-tm-pitch::before {",
    "  content: ''; position: absolute; inset: 6%; border: 2px solid rgba(255,255,255,.22); border-radius: 4px;",
    "}",
    ".ssc-tm-pitch::after {",
    "  content: ''; position: absolute; left: 6%; right: 6%; top: 50%; height: 2px; background: rgba(255,255,255,.22);",
    "}",
    // Size from the pitch itself: four rows of cards always fit, in height
    // and (with five defenders) in width.
    ".ssc-tm-slot {",
    "  all: unset; box-sizing: border-box; position: absolute; z-index: 1; transform: translate(-50%, -50%);",
    "  width: min(84px, 15cqh, 16cqw); cursor: pointer;",
    "  filter: drop-shadow(0 6px 10px rgba(0,0,0,.45)); transition: filter .15s ease;",
    "}",
    ".ssc-tm-slot:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }",
    ".ssc-tm-slot[data-target='1'] { filter: drop-shadow(0 0 6px #ffd34d) drop-shadow(0 0 2px #ffd34d); }",
    ".ssc-tm-slot-empty { width: 100%; aspect-ratio: 5 / 7; box-sizing: border-box; border-radius: 10px;",
    "  border: 1.5px dashed rgba(255,255,255,.5); background: rgba(0,0,0,.28);",
    "  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;",
    "  font-size: 10px; font-weight: 800; letter-spacing: .06em; color: #cfe3d6; }",
    ".ssc-tm-slot:hover .ssc-tm-slot-empty { background: rgba(0,0,0,.45); border-color: #fff; }",
    ".ssc-tm-slot-plus { font-size: 18px; line-height: 1; opacity: .8; }",

    /* ---- details ---- */
    ".ssc-tm-detail { font-size: 12.5px; line-height: 1.55; color: #dbe8e0; overflow-y: auto; min-width: 0; }",
    ".ssc-tm-detail h3 { margin: 0 0 4px; font-size: 15px; color: #fff; overflow-wrap: anywhere; }",
    ".ssc-tm-detail dl { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; margin: 10px 0 0; }",
    ".ssc-tm-detail dt { color: #8fa697; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }",
    ".ssc-tm-detail dd { margin: 0; font-size: 12.5px; overflow-wrap: anywhere; }",
    ".ssc-tm-formula { margin-top: 10px; padding: 8px 10px; border-radius: 9px; background: rgba(0,0,0,.25);",
    "  font-size: 11.5px; color: #b9cdc1; font-variant-numeric: tabular-nums; }",
    ".ssc-tm-empty { color: #8fa697; font-size: 12px; padding: 12px 4px; }",

    /* ---- footer ---- */
    ".ssc-tm-foot {",
    "  flex: none; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;",
    "  padding: 12px 20px 16px; border-top: 1px solid rgba(255,255,255,.1);",
    "  background: rgba(8,14,10,.82); backdrop-filter: blur(10px);",
    "}",
    ".ssc-tm-btn {",
    "  font: inherit; font-size: 13px; font-weight: 700; padding: 9px 15px; border-radius: 10px;",
    "  border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.07);",
    "  color: inherit; cursor: pointer;",
    "}",
    ".ssc-tm-btn:hover { background: rgba(255,255,255,.15); }",
    ".ssc-tm-ico { display: inline-block; width: 1.15em; height: 1.15em; vertical-align: -0.2em; margin-right: .4em; flex: none; }",
    ".ssc-tm-btn:disabled { opacity: .4; cursor: default; }",
    ".ssc-tm-btn--primary { background: #1f9d5c; border-color: #2ec57a; }",
    ".ssc-tm-btn--primary:hover { background: #25b76c; }",
    ".ssc-tm-btn--battle { background: linear-gradient(135deg,#b3261e,#e3542b); border-color: #ff8a5c; }",
    ".ssc-tm-btn--battle:hover:not(:disabled) { background: linear-gradient(135deg,#c93228,#f06a3c); }",
    ".ssc-tm-select {",
    "  font: inherit; font-size: 13px; padding: 8px 10px; border-radius: 10px;",
    "  border: 1px solid rgba(255,255,255,.2); background: #12251b; color: inherit;",
    "}",
    ".ssc-tm-select option { background: #12251b; }",
    ".ssc-tm-spacer { flex: 1; }",
    ".ssc-tm-status { font-size: 11.5px; color: #9fb4a7; }",
    ".ssc-tm-status[data-tone='good'] { color: #7fe0a8; font-weight: 700; }",
    ".ssc-tm-status[data-tone='bad'] { color: #ff8a80; font-weight: 700; }",
    ".ssc-tm-btn--league { border-color: #e3c04a; color: #f3dd8c; }",

    /* ---- tabs ---- */
    ".ssc-tm-tabs { display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: rgba(0,0,0,.35);",
    "  border: 1px solid rgba(255,255,255,.08); margin-left: auto; margin-right: 8px; }",
    ".ssc-tm-tab { font: inherit; font-size: 13px; font-weight: 800; letter-spacing: .02em; padding: 7px 16px;",
    "  border-radius: 9px; border: 0; background: transparent; color: #9fb4a7; cursor: pointer; }",
    ".ssc-tm-tab:hover { color: #fff; }",
    ".ssc-tm-tab[aria-selected='true'] { background: linear-gradient(135deg,#e3c04a,#b8901c); color: #1d1500;",
    "  box-shadow: 0 2px 10px rgba(227,192,74,.35); }",

    /* ---- locked cards (league rules) ---- */
    // Pitch slots are already absolutely positioned; only bench cards need it.
    ".ssc-tm-benchcard[data-block] { position: relative; }",
    ".ssc-tm-benchcard[data-block] { cursor: not-allowed; }",
    ".ssc-tm-benchcard[data-block] .ssc-mc, .ssc-tm-slot[data-block] .ssc-mc { filter: grayscale(.9) brightness(.6); }",
    ".ssc-tm-benchcard[data-block='expired'] { opacity: .45; }",
    ".ssc-tm-benchcard[data-block='expired'] .ssc-mc { filter: grayscale(1) brightness(.45); }",
    ".ssc-tm-lock { position: absolute; left: 4%; right: 4%; top: 40%; z-index: 2; display: block;",
    "  padding: 3px 2px; border-radius: 6px; background: rgba(0,0,0,.78); color: #ffd34d;",
    "  font: 800 9.5px/1.2 system-ui, sans-serif; letter-spacing: .04em; text-align: center;",
    "  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }",
    ".ssc-tm-benchcard[data-block='expired'] .ssc-tm-lock, .ssc-tm-slot[data-block='expired'] .ssc-tm-lock { color: #ff8a80; }",

    /* ---- Competitie ---- */
    ".ssc-lg-body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr);",
    "  gap: 14px; padding: 14px 20px; }",
    "@media (max-width: 900px) { .ssc-lg-body { grid-template-columns: 1fr; overflow: auto; } }",
    ".ssc-lg-panel { overflow-y: auto; background: linear-gradient(180deg, rgba(227,192,74,.06), rgba(255,255,255,.03)); }",
    ".ssc-lg-title { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }",
    ".ssc-lg-title-main { font-size: 15px; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; color: #fff; }",
    ".ssc-lg-title-sub { font-size: 11px; font-weight: 800; color: #e3c04a; letter-spacing: .08em; }",
    ".ssc-lg-sub-title { margin-top: 10px; font-size: 12px; color: #9fb4a7; }",
    ".ssc-lg-table-wrap { overflow-x: auto; }",
    ".ssc-lg-table { width: 100%; border-collapse: separate; border-spacing: 0 4px; font-size: 13px; font-variant-numeric: tabular-nums; }",
    ".ssc-lg-table th { font-size: 10.5px; font-weight: 800; letter-spacing: .08em; color: #8fa697; text-align: center; padding: 4px 6px; }",
    ".ssc-lg-table th:nth-child(2) { text-align: left; }",
    ".ssc-lg-table td { padding: 8px 6px; text-align: center; background: rgba(255,255,255,.04);",
    "  border-top: 1px solid rgba(255,255,255,.05); border-bottom: 1px solid rgba(255,255,255,.05); }",
    ".ssc-lg-table td:first-child { border-left: 1px solid rgba(255,255,255,.05); border-radius: 10px 0 0 10px; }",
    ".ssc-lg-table td:last-child { border-right: 1px solid rgba(255,255,255,.05); border-radius: 0 10px 10px 0; }",
    ".ssc-lg-table tr[data-me='1'] td { background: linear-gradient(90deg, rgba(227,192,74,.32), rgba(227,192,74,.12));",
    "  border-color: rgba(227,192,74,.6); color: #fff3c4; }",
    ".ssc-lg-name { text-align: left !important; font-weight: 700; max-width: 180px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".ssc-lg-pts { font-weight: 900; font-size: 15px; color: #fff; }",
    ".ssc-lg-rank { display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%;",
    "  font-weight: 900; font-size: 12px; background: rgba(255,255,255,.08); }",
    ".ssc-lg-rank[data-medal='gold'] { background: linear-gradient(135deg,#ffe58a,#c99a1c); color: #2b1d00; }",
    ".ssc-lg-rank[data-medal='silver'] { background: linear-gradient(135deg,#f4f6f8,#9aa3ae); color: #1f2630; }",
    ".ssc-lg-rank[data-medal='bronze'] { background: linear-gradient(135deg,#f0c38f,#a5652f); color: #2e1a08; }",
    ".ssc-lg-when { font-size: 12px; color: #b9cdc1; text-transform: capitalize; }",
    ".ssc-lg-fixtures { display: flex; flex-direction: column; gap: 6px; }",
    ".ssc-lg-fixture { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); align-items: center; gap: 10px;",
    "  padding: 9px 12px; border-radius: 10px; background: rgba(0,0,0,.28); border: 1px solid rgba(255,255,255,.07); }",
    ".ssc-lg-fixture[data-me='1'] { border-color: rgba(227,192,74,.7); box-shadow: 0 0 0 1px rgba(227,192,74,.35) inset; }",
    ".ssc-lg-team { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".ssc-lg-home { text-align: right; }",
    ".ssc-lg-score { min-width: 58px; text-align: center; font-size: 16px; font-weight: 900; padding: 3px 8px; border-radius: 8px;",
    "  background: #0b1610; color: #fff; font-variant-numeric: tabular-nums; }",
    ".ssc-lg-score[data-open='1'] { font-size: 11px; color: #e3c04a; letter-spacing: .1em; }",
    ".ssc-lg-bye, .ssc-lg-note { font-size: 11.5px; color: #8fa697; padding: 2px 4px; }",
    ".ssc-lg-rules { margin-top: auto; padding: 10px 12px; border-radius: 10px; background: rgba(0,0,0,.25);",
    "  font-size: 11.5px; line-height: 1.5; color: #b9cdc1; display: flex; flex-direction: column; gap: 4px; }",
    ".ssc-lg-rules b { color: #e3c04a; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }",
    ".ssc-lg-banner { padding: 12px; border-radius: 10px; background: rgba(255,107,94,.12); color: #ffb3ab; font-size: 13px; }",
    ".ssc-lg-gate { grid-column: 1 / -1; align-self: center; justify-self: center; text-align: center; padding: 40px 24px;",
    "  border-radius: 18px; background: rgba(0,0,0,.35); border: 1px solid rgba(227,192,74,.35); max-width: 520px; }",
    ".ssc-lg-gate-icon { display: grid; place-items: center; }",
    ".ssc-lg-gate-icon .ssc-tm-ico { width: 44px; height: 44px; margin: 0; }",
    ".ssc-lg-gate-text { margin-top: 10px; font-size: 16px; font-weight: 800; color: #fff; }",
    ".ssc-lg-gate-sub { margin-top: 6px; font-size: 12px; color: #9fb4a7; }",
    ".ssc-tm-btn--league:hover:not(:disabled) { background: rgba(227,192,74,.15); }",
    ".ssc-tm-points { font-size: 12px; font-weight: 800; color: #ffd34d; }",

    /* ---- modal (share / import) ---- */
    ".ssc-tm-modal { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center;",
    "  background: rgba(0,0,0,.6); backdrop-filter: blur(4px); }",
    ".ssc-tm-modal-box { width: min(520px, calc(100vw - 40px)); box-sizing: border-box; padding: 18px;",
    "  border-radius: 16px; background: #102018; border: 1px solid rgba(255,255,255,.14);",
    "  box-shadow: 0 20px 60px rgba(0,0,0,.6); display: flex; flex-direction: column; gap: 10px; }",
    ".ssc-tm-modal-title { margin: 0; font-size: 16px; font-weight: 800; color: #fff; }",
    ".ssc-tm-modal-text { margin: 0; font-size: 12.5px; color: #b9cdc1; line-height: 1.5; }",
    ".ssc-tm-code { width: 100%; box-sizing: border-box; min-height: 110px; resize: vertical; padding: 10px;",
    "  border-radius: 10px; border: 1px solid rgba(255,255,255,.18); background: #0a140f; color: #dff0e6;",
    "  font: 12px/1.45 ui-monospace, Consolas, monospace; word-break: break-all; }",
    ".ssc-tm-modal-row { display: flex; gap: 8px; justify-content: flex-end; align-items: center; flex-wrap: wrap; }",
    ".ssc-tm-modal-msg { margin-right: auto; font-size: 12px; color: #9fb4a7; }",
    ".ssc-tm-modal-msg[data-bad='1'] { color: #ff8a80; }",

    /* ---- battle ---- */
    ".ssc-bt { position: absolute; inset: 0; z-index: 15; display: flex; flex-direction: column;",
    "  background: radial-gradient(120% 90% at 50% 40%, #13281c 0%, #050807 75%); overflow: hidden; }",
    ".ssc-bt-head { flex: none; display: flex; align-items: center; gap: 14px; padding: 14px 20px;",
    "  border-bottom: 1px solid rgba(255,255,255,.1); background: rgba(0,0,0,.35); }",
    ".ssc-bt-team { flex: 1; min-width: 0; }",
    ".ssc-bt-team:last-of-type { text-align: right; }",
    ".ssc-bt-team-name { font-size: 15px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".ssc-bt-team-sub { font-size: 11.5px; color: #9fb4a7; }",
    ".ssc-bt-score { flex: none; font-size: 34px; font-weight: 900; color: #fff; font-variant-numeric: tabular-nums;",
    "  padding: 2px 18px; border-radius: 12px; background: rgba(255,255,255,.08); letter-spacing: .04em; }",
    ".ssc-bt-score.pop { animation: ssc-bt-pop .45s ease; }",
    "@keyframes ssc-bt-pop { 0% { transform: scale(1); } 40% { transform: scale(1.25); } 100% { transform: scale(1); } }",
    ".ssc-bt-body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0,1fr) minmax(300px, 1.1fr) minmax(0,1fr);",
    "  gap: 14px; padding: 14px 20px; }",
    ".ssc-bt-pitch { min-height: 300px; }",
    ".ssc-bt-pitch .ssc-tm-slot { cursor: default; transition: filter .2s ease, opacity .2s ease, transform .2s ease; }",
    ".ssc-bt-pitch .ssc-tm-slot[data-active='1'] { z-index: 3; transform: translate(-50%, -50%) scale(1.15);",
    "  filter: drop-shadow(0 0 8px #ffd34d) drop-shadow(0 0 3px #ffd34d); }",
    ".ssc-bt-pitch .ssc-tm-slot[data-played='1'] { opacity: .45; }",
    ".ssc-bt-stage { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; min-width: 0; }",
    ".ssc-bt-round { font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #9fb4a7; }",
    ".ssc-bt-attr { font-size: 20px; font-weight: 900; letter-spacing: .16em; color: #ffd34d; min-height: 26px; text-align: center; }",
    ".ssc-bt-attr.spin { animation: ssc-bt-flicker .12s steps(2) infinite; }",
    "@keyframes ssc-bt-flicker { 50% { opacity: .35; } }",
    ".ssc-bt-vs { display: flex; align-items: center; justify-content: center; gap: 16px; width: 100%; }",
    ".ssc-bt-fighter { width: min(150px, 34%); transition: transform .35s ease, opacity .35s ease, filter .35s ease; }",
    ".ssc-bt-fighter.in-left { animation: ssc-bt-in-left .45s cubic-bezier(.2,1.1,.3,1) both; }",
    ".ssc-bt-fighter.in-right { animation: ssc-bt-in-right .45s cubic-bezier(.2,1.1,.3,1) both; }",
    "@keyframes ssc-bt-in-left { from { opacity: 0; transform: translateX(-60px) rotate(-8deg); } to { opacity: 1; transform: none; } }",
    "@keyframes ssc-bt-in-right { from { opacity: 0; transform: translateX(60px) rotate(8deg); } to { opacity: 1; transform: none; } }",
    ".ssc-bt-fighter.won { transform: scale(1.08); filter: drop-shadow(0 0 16px #58c98a) drop-shadow(0 0 4px #58c98a); }",
    ".ssc-bt-fighter.lost { opacity: .4; transform: scale(.92); filter: grayscale(.7); }",
    ".ssc-bt-vs-mark { flex: none; font-size: 30px; font-weight: 900; font-style: italic; color: #fff;",
    "  text-shadow: 0 0 18px rgba(255,90,40,.9); }",
    ".ssc-bt-verdict { min-height: 22px; font-size: 14px; font-weight: 800; text-align: center; color: #fff; }",
    ".ssc-bt-verdict[data-who='me'] { color: #7fe0a8; }",
    ".ssc-bt-verdict[data-who='them'] { color: #ff8a80; }",
    ".ssc-bt-note { font-size: 11.5px; color: #9fb4a7; text-align: center; min-height: 16px; }",
    ".ssc-bt-foot { flex: none; display: flex; justify-content: center; gap: 10px; padding: 12px 20px 16px; }",
    ".ssc-bt-result { position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column;",
    "  align-items: center; justify-content: center; gap: 12px; background: rgba(0,0,0,.72); backdrop-filter: blur(6px); }",
    ".ssc-bt-result-word { font-size: clamp(48px, 10vw, 110px); font-weight: 900; letter-spacing: .06em; line-height: 1;",
    "  animation: ssc-bt-slam .6s cubic-bezier(.2,1.4,.3,1) both; }",
    ".ssc-bt-result-word[data-r='win'] { color: #58c98a; text-shadow: 0 0 40px rgba(88,201,138,.7); }",
    ".ssc-bt-result-word[data-r='loss'] { color: #ff6b5e; text-shadow: 0 0 40px rgba(255,107,94,.6); }",
    ".ssc-bt-result-word[data-r='draw'] { color: #ffd34d; text-shadow: 0 0 40px rgba(255,211,77,.6); }",
    "@keyframes ssc-bt-slam { from { opacity: 0; transform: scale(2.2); } to { opacity: 1; transform: none; } }",
    ".ssc-bt-result-score { font-size: 28px; font-weight: 900; color: #fff; font-variant-numeric: tabular-nums; }",
    ".ssc-bt-result-points { font-size: 14px; font-weight: 800; color: #ffd34d; }",
    "@media (max-width: 900px) { .ssc-bt-body { grid-template-columns: 1fr; overflow: auto; } .ssc-bt-pitch { min-height: 260px; } }",
    "/* ---------- premium pass: glass, foil cards, pitch, bench bar ---------- */",
    "#ssc-team-overlay { background: radial-gradient(60% 50% at 12% 0%, rgba(46,197,122,.22), transparent 70%),",
    "  radial-gradient(50% 45% at 92% 8%, rgba(227,192,74,.16), transparent 70%),",
    "  radial-gradient(70% 60% at 50% 110%, rgba(40,110,220,.14), transparent 70%),",
    "  radial-gradient(120% 120% at 50% 0%, #0d1a13 0%, #070b0a 70%); }",
    "#ssc-team-overlay[data-open='1'] { animation: ssc-tm-open .45s cubic-bezier(.34,1.56,.64,1) both; }",
    "@keyframes ssc-tm-open { from { opacity: 0; transform: scale(.97); } }",
    ".ssc-tm-swap { animation: ssc-tm-rise .45s cubic-bezier(.34,1.56,.64,1) both; }",
    "@keyframes ssc-tm-rise { from { opacity: 0; transform: translateY(14px); } }",
    ".ssc-tm-panel { border-radius: 18px; border-color: rgba(255,255,255,.14);",
    "  background: linear-gradient(155deg, rgba(255,255,255,.1), rgba(255,255,255,.03) 55%);",
    "  box-shadow: inset 0 1px 0 rgba(255,255,255,.22), inset 0 -1px 0 rgba(0,0,0,.25), 0 24px 48px -28px rgba(0,0,0,.8); }",
    ".ssc-lg-panel { background: linear-gradient(170deg, rgba(227,192,74,.1), rgba(255,255,255,.035) 45%); }",
    ".ssc-tm-close { display: inline-flex; align-items: center; font-size: 13px; font-weight: 700; }",
    ".ssc-tm-btn, .ssc-tm-close { transition: transform .4s cubic-bezier(.34,1.56,.64,1), background .2s ease; }",
    ".ssc-tm-btn:hover:not(:disabled), .ssc-tm-close:hover { transform: translateY(-1px); }",
    ".ssc-tm-btn:active:not(:disabled), .ssc-tm-close:active { transform: scale(.95); }",
    ".ssc-tm-tabs { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.14);",
    "  backdrop-filter: blur(12px) saturate(1.5); box-shadow: inset 0 1px 0 rgba(255,255,255,.2); }",
    ".ssc-tm-tab { transition: background .3s ease, color .2s ease, transform .45s cubic-bezier(.34,1.56,.64,1); }",
    ".ssc-tm-tab:hover { transform: translateY(-1px); } .ssc-tm-tab:active { transform: scale(.93); }",
    ".ssc-mc.tier-bronze{background:radial-gradient(130% 80% at 22% 0%,rgba(255,236,214,.6),transparent 56%),linear-gradient(155deg,#f4cfa4 0%,#d99a62 20%,#a8683a 42%,#e3ae78 55%,#935a2f 76%,#5f3a1c 100%);color:#2e1a08;}",
    ".ssc-mc.tier-silver{background:radial-gradient(130% 80% at 22% 0%,rgba(255,255,255,.75),transparent 56%),linear-gradient(155deg,#ffffff 0%,#dfe5ec 20%,#a9b3c0 42%,#eef1f5 55%,#8993a2 76%,#5b6573 100%);color:#1f2630;}",
    ".ssc-mc.tier-gold{background:radial-gradient(130% 80% at 22% 0%,rgba(255,250,214,.75),transparent 56%),linear-gradient(155deg,#fff6c4 0%,#f3d160 20%,#c8921c 42%,#f8e082 55%,#b17a14 76%,#7a520e 100%);color:#35240a;}",
    ".ssc-mc.tier-icon{background:radial-gradient(130% 80% at 22% 0%,rgba(255,255,255,.8),transparent 56%),radial-gradient(90% 60% at 85% 85%,rgba(120,210,255,.35),transparent 60%),radial-gradient(80% 50% at 10% 90%,rgba(255,150,220,.3),transparent 60%),linear-gradient(155deg,#fffdf2 0%,#f4e6b6 30%,#e6d39a 52%,#f9f0cf 70%,#cdb877 100%);color:#3a2c0a;}",
    ".ssc-mc[class*='tier-']{box-shadow:inset 0 0 0 1px rgba(255,255,255,.5),inset 0 0 26px rgba(255,255,255,.3);}",
    ".ssc-mc[class*='tier-']::before{display:block;content:'';position:absolute;inset:0;pointer-events:none;z-index:1;mix-blend-mode:soft-light;background:radial-gradient(90% 55% at 50% 118%,rgba(255,255,255,.55),transparent 60%),radial-gradient(70% 45% at 50% 38%,rgba(255,255,255,.35),transparent 70%),repeating-linear-gradient(115deg,rgba(255,255,255,.16) 0 .6cqw,transparent .6cqw 2.4cqw);}",
    ".ssc-mc.tier-bronze, .ssc-mc.tier-silver, .ssc-mc.tier-gold { text-shadow: 0 1px 0 rgba(255,255,255,.45); }",
    ".ssc-mc.tier-icon { color: #3a2c0a; text-shadow: 0 1px 0 rgba(255,255,255,.55); }",
    ".ssc-mc-line { display: none; }",
    ".ssc-mc-top { left: 10cqw; top: 17cqw; } .ssc-mc-emoji { right: 12cqw; top: 20cqw; }",
    ".ssc-mc-name { left: 9cqw; right: 9cqw; top: 69cqw; } .ssc-mc-stat { left: 14cqw; right: 14cqw; top: 87cqw; }",
    ".ssc-mc-sil { position: absolute; right: 4cqw; top: 11cqw; width: 56cqw; height: 56cqw; opacity: .1; pointer-events: none; }",
    ".ssc-mc-holo { position: absolute; inset: 0; pointer-events: none; opacity: 0; mix-blend-mode: color-dodge; transition: opacity .35s ease;",
    "  background: radial-gradient(circle at var(--mx,50%) var(--my,30%),rgba(255,255,255,.6),transparent 42%),linear-gradient(115deg,transparent 18%,rgba(255,60,160,.42) 34%,rgba(60,220,255,.42) 48%,rgba(255,235,90,.36) 60%,transparent 78%); background-size: 100% 100%, 260% 260%; background-position: 0 0, var(--mx,50%) var(--my,50%); }",
    ".ssc-mc:hover .ssc-mc-holo, .ssc-bt-fighter.won .ssc-mc-holo { opacity: .8; }",
    "/* bench: a narrow column beside the pitch, so the pitch gets the full height */",
    ".ssc-tm-body { grid-template-columns: 196px minmax(320px, 1fr) 300px; grid-template-rows: minmax(0, 1fr); }",
    ".ssc-tm-benchbar { gap: 4px; padding: 10px 8px 6px; min-height: 0; }",
    ".ssc-tm-benchbar .ssc-tm-bench { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 10px; padding: 10px 6px 12px;",
    "  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.25) transparent; }",
    ".ssc-tm-benchbar .ssc-tm-benchcard { aspect-ratio: 5 / 7; }",
    ".ssc-tm-benchcard { transition: translate .45s cubic-bezier(.34,1.56,.64,1), filter .15s ease, opacity .15s ease; }",
    ".ssc-tm-benchcard:hover { transform: none; translate: 0 -6px; }",
    "@media (max-width: 1100px) { .ssc-tm-body { grid-template-columns: 168px minmax(0, 1fr) 240px; } }",
    // Narrow: one column, pitch first, bench as a horizontal strip under it.
    "@media (max-width: 900px) { .ssc-tm-body { grid-template-columns: 1fr; grid-template-rows: auto auto auto; }",
    "  .ssc-tm-benchbar { order: 2; min-height: max-content; } .ssc-tm-body > .ssc-tm-panel:last-child { order: 3; }",
    "  .ssc-tm-benchbar .ssc-tm-bench { display: flex; align-items: flex-start; gap: 16px; overflow-x: auto; overflow-y: hidden; }",
    "  .ssc-tm-benchbar .ssc-tm-benchcard { flex: 0 0 78px; width: 78px; } }",
    ".ssc-tm-pitch { min-height: 380px; border-radius: 18px; border: 1px solid rgba(255,255,255,.18);",
    "  background: radial-gradient(90% 55% at 50% 0%, rgba(255,255,255,.2), transparent 62%),",
    "    radial-gradient(120% 80% at 50% 112%, rgba(0,0,0,.5), transparent 62%),",
    "    repeating-linear-gradient(0deg, #1f7d47 0 7.14%, #1a6b3c 7.14% 14.28%);",
    "  box-shadow: inset 0 0 70px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.25), 0 26px 50px -26px rgba(0,0,0,.85); }",
    "@media (max-width: 900px) { .ssc-tm-pitch { min-height: 420px; } }",
    ".ssc-tm-pitch::before, .ssc-tm-pitch::after { display: none; }",
    ".ssc-tm-lines { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;",
    "  filter: drop-shadow(0 0 3px rgba(255,255,255,.35)); }",
    ".ssc-tm-circle { position: absolute; left: 50%; top: 50%; width: 24cqmin; aspect-ratio: 1; transform: translate(-50%, -50%);",
    "  border: 2px solid rgba(255,255,255,.34); border-radius: 50%; pointer-events: none; }",
    ".ssc-tm-circle::after { content: ''; position: absolute; left: 50%; top: 50%; width: 6px; height: 6px; margin: -3px;",
    "  border-radius: 50%; background: rgba(255,255,255,.5); }",
    ".ssc-tm-slot { transition: filter .15s ease, translate .45s cubic-bezier(.34,1.56,.64,1); }",
    ".ssc-tm-slot:hover { translate: 0 -4px; z-index: 2; }",
    ".ssc-tm-slot::after { content: ''; position: absolute; left: 14%; right: 14%; bottom: -5%; height: 9%; z-index: -1;",
    "  border-radius: 50%; background: rgba(0,0,0,.5); filter: blur(4px); }",
    ".ssc-tm-slot-empty { border-radius: 12px; background: rgba(0,0,0,.22); backdrop-filter: blur(4px);",
    "  box-shadow: inset 0 1px 0 rgba(255,255,255,.18); }",
    ".ssc-lg-table { border-spacing: 0 6px; }",
    ".ssc-lg-table td { background: linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.035));",
    "  border-top-color: rgba(255,255,255,.24); border-bottom-color: rgba(0,0,0,.28); transition: background .25s ease; }",
    ".ssc-lg-table tbody tr:hover td { background: linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.07)); }",
    ".ssc-lg-table tr[data-me='1'] td, .ssc-lg-table tbody tr[data-me='1']:hover td {",
    "  background: linear-gradient(180deg, rgba(227,192,74,.36), rgba(227,192,74,.13)); border-color: rgba(255,222,120,.85);",
    "  box-shadow: 0 0 18px -4px rgba(227,192,74,.7); animation: ssc-lg-me 2.6s ease-in-out infinite; }",
    "@keyframes ssc-lg-me { 50% { box-shadow: 0 0 26px -2px rgba(255,214,90,.95); } }",
    ".ssc-lg-rank { width: 26px; height: 26px; box-shadow: inset 0 1px 0 rgba(255,255,255,.25); }",
    ".ssc-lg-rank[data-medal] { text-shadow: 0 1px 0 rgba(255,255,255,.5);",
    "  box-shadow: inset 0 1.5px 1px rgba(255,255,255,.75), inset 0 -2px 2px rgba(0,0,0,.28), 0 0 0 2px rgba(0,0,0,.25), 0 0 12px -1px var(--medal); }",
    ".ssc-lg-rank[data-medal='gold'] { --medal: #ffd34d; } .ssc-lg-rank[data-medal='silver'] { --medal: #dfe4ea; }",
    ".ssc-lg-rank[data-medal='bronze'] { --medal: #e0975a; }",
    "/* premium pass: floating glass pill rows, spring lift, own row glows in the accent */",
    ".ssc-lg-table { border-spacing: 0 8px; }",
    ".ssc-lg-table td { backdrop-filter: blur(14px) saturate(160%); -webkit-backdrop-filter: blur(14px) saturate(160%);",
    "  border-top: 1px solid rgba(255,255,255,.3); border-bottom: 1px solid rgba(255,255,255,.08); padding: 10px 8px; }",
    ".ssc-lg-table td:first-child { border-radius: 99px 0 0 99px; padding-left: 12px; }",
    ".ssc-lg-table td:last-child { border-radius: 0 99px 99px 0; padding-right: 16px; }",
    ".ssc-lg-table tbody tr { transition: transform .45s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter .3s ease; }",
    ".ssc-lg-table tbody tr:hover { transform: translateY(-2px) scale(1.012); filter: drop-shadow(0 10px 14px rgba(0,0,0,.35)); }",
    ".ssc-lg-table tr[data-me='1'] td { border-color: color-mix(in srgb, var(--ssc-accent, #e3c04a) 85%, white); }",
    ".ssc-lg-table tbody tr[data-me='1'] td, .ssc-lg-table tbody tr[data-me='1']:hover td { box-shadow: none; animation: none; }",
    ".ssc-lg-table tbody tr[data-me='1'] { filter: drop-shadow(0 0 9px color-mix(in srgb, var(--ssc-accent, #e3c04a) 75%, transparent)); animation: ssc-lg-me-glow 2.6s ease-in-out infinite; }",
    "@keyframes ssc-lg-me-glow { 50% { filter: drop-shadow(0 0 16px color-mix(in srgb, var(--ssc-accent, #ffd65a) 95%, transparent)); } }",
    ".ssc-lg-rank { width: 28px; height: 28px; font-weight: 900; letter-spacing: -0.02em; }",
    ".ssc-lg-rank[data-medal='gold'] { background: linear-gradient(145deg,#fff3b0,#f0c030 45%,#a8760f); }",
    ".ssc-lg-rank[data-medal='silver'] { background: linear-gradient(145deg,#ffffff,#cfd6df 45%,#7f8997); }",
    ".ssc-lg-rank[data-medal='bronze'] { background: linear-gradient(145deg,#f7d2aa,#d18a4d 45%,#8a4f22); }",
    ".ssc-lg-fixture { background: linear-gradient(180deg, rgba(255,255,255,.1), rgba(255,255,255,.03));",
    "  border-color: rgba(255,255,255,.14); box-shadow: inset 0 1px 0 rgba(255,255,255,.16); transition: transform .45s cubic-bezier(.34,1.56,.64,1); }",
    ".ssc-lg-fixture:hover { transform: translateY(-2px); }",
    ".ssc-lg-fixture[data-me='1'] { box-shadow: 0 0 0 1px rgba(227,192,74,.35) inset, 0 0 16px -4px rgba(227,192,74,.6); }",
    ".ssc-lg-live { display: inline-flex; align-items: center; gap: 6px; margin-right: auto; padding: 3px 9px; border-radius: 99px;",
    "  font-size: 10.5px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; color: #fff;",
    "  background: rgba(227,52,43,.92); box-shadow: 0 0 14px rgba(227,52,43,.7); }",
    ".ssc-lg-live::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: #fff; animation: ssc-lg-blink 1s ease-in-out infinite; }",
    "@keyframes ssc-lg-blink { 50% { opacity: .25; transform: scale(.7); } }",
    ".ssc-mc[data-off] .ssc-mc-rate, .ssc-mc[data-off] .ssc-mc-pos { color: #b3261e; text-shadow: 0 1px 0 rgba(255,255,255,.6); }",
    "/* ---------- pass 3: spacing, liquid glass league ---------- */",
    ".ssc-tm-slot { width: min(96px, 14cqh, 13cqw); }",
    ".ssc-tm-body { overflow: auto; }",
    ".ssc-bt-pitch { min-height: 300px; }",
    ".ssc-lg-body { position: relative; isolation: isolate; overflow: hidden; }",
    ".ssc-lg-body::before { content: ''; position: absolute; inset: -20%; z-index: -1; pointer-events: none;",
    "  background: radial-gradient(34% 30% at 22% 28%, rgba(46,197,122,.55), transparent 70%),",
    "    radial-gradient(30% 28% at 78% 22%, rgba(227,192,74,.5), transparent 70%),",
    "    radial-gradient(36% 34% at 62% 80%, rgba(60,130,255,.45), transparent 70%),",
    "    repeating-linear-gradient(118deg, rgba(255,255,255,.05) 0 2px, transparent 2px 46px);",
    "  animation: ssc-lg-aurora 22s ease-in-out infinite alternate; }",
    "@keyframes ssc-lg-aurora { to { transform: translate3d(4%, -3%, 0) rotate(6deg) scale(1.08); } }",
    ".ssc-lg-panel { border-radius: 24px; padding: 18px; border: 1px solid rgba(255,255,255,.22);",
    "  background: linear-gradient(155deg, rgba(255,255,255,.14), rgba(255,255,255,.04) 55%), rgba(10,18,14,.42);",
    "  -webkit-backdrop-filter: blur(18px) saturate(1.6); backdrop-filter: url(#ssc-liquid) blur(18px) saturate(1.6);",
    "  box-shadow: inset 0 1.5px 0 rgba(255,255,255,.4), inset 0 -1px 0 rgba(0,0,0,.3), inset 0 0 30px -10px rgba(255,255,255,.25),",
    "    0 30px 60px -30px rgba(0,0,0,.9); }",
    ".ssc-lg-title-main { font-size: 17px; }",
    ".ssc-lg-title-sub { padding: 4px 10px; border-radius: 99px; background: rgba(227,192,74,.14); box-shadow: inset 0 0 0 1px rgba(227,192,74,.4); }",
    ".ssc-lg-table { border-spacing: 0 8px; font-size: 14px; }",
    ".ssc-lg-table td { padding: 11px 8px; background: linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.05));",
    "  border-top-color: rgba(255,255,255,.34); border-bottom-color: rgba(0,0,0,.3); }",
    ".ssc-lg-table td:first-child { border-radius: 16px 0 0 16px; padding-left: 12px; } .ssc-lg-table td:last-child { border-radius: 0 16px 16px 0; padding-right: 14px; }",
    ".ssc-lg-table tbody tr { transition: translate .45s cubic-bezier(.34,1.56,.64,1); } .ssc-lg-table tbody tr:hover { translate: 4px 0; }",
    ".ssc-lg-pos { position: relative; z-index: 0; width: 44px; }",
    ".ssc-lg-rank { position: relative; width: 30px; height: 30px; font-size: 13px; }",
    ".ssc-lg-rank[data-medal]::after { content: ''; position: absolute; left: 50%; top: 62%; width: 16px; height: 16px; translate: -50% 0; z-index: -1;",
    "  background: linear-gradient(90deg, #d2463a 50%, #2f6fd0 50%); clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%); }",
    ".ssc-lg-who { display: flex; align-items: center; gap: 10px; min-width: 0; }",
    ".ssc-lg-who span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; }",
    ".ssc-lg-av { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; font-size: 12px; font-weight: 900; color: #fff;",
    "  background: linear-gradient(150deg, hsl(var(--h) 70% 58%), hsl(calc(var(--h) + 30) 65% 38%)); box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 3px 8px -3px rgba(0,0,0,.6); }",
    ".ssc-lg-pts { font-size: 16px; }",
    ".ssc-lg-fixtures { gap: 8px; }",
    ".ssc-lg-fixture { padding: 12px 14px; border-radius: 16px; background: linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,.05));",
    "  border-color: rgba(255,255,255,.24); box-shadow: inset 0 1px 0 rgba(255,255,255,.3), 0 10px 22px -16px rgba(0,0,0,.8); }",
    ".ssc-lg-score { border-radius: 10px; background: linear-gradient(180deg, #14241b, #060d09); box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 0 0 1px rgba(255,255,255,.08); }",
    ".ssc-lg-rules { border-radius: 16px; background: rgba(0,0,0,.28); box-shadow: inset 0 1px 0 rgba(255,255,255,.1); }",
    ".ssc-tm-btn { box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 8px 16px -10px rgba(0,0,0,.8);",
    "  background-image: linear-gradient(180deg, rgba(255,255,255,.1), rgba(255,255,255,0)); }",
    ".ssc-tm-btn:hover:not(:disabled) { box-shadow: inset 0 1px 0 rgba(255,255,255,.34), 0 12px 22px -10px rgba(0,0,0,.9); }",
  ].join("\n");

  function ensureManagerStyle(shadow) {
    if (!shadow) return;
    var style = shadow.querySelector("style[data-ssc-team-manager]");
    if (!style) {
      style = document.createElement("style");
      style.setAttribute("data-ssc-team-manager", "1");
      shadow.appendChild(style);
    }
    if (style.textContent !== MANAGER_CSS) style.textContent = MANAGER_CSS;
    if (!shadow.getElementById("ssc-liquid")) {
      var lens = document.createElement("div");
      lens.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
      lens.innerHTML = '<svg width="0" height="0" aria-hidden="true"><filter id="ssc-liquid" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.009 0.013" numOctaves="2" seed="11" result="n"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="n" scale="40" xChannelSelector="R" yChannelSelector="G"/></filter></svg>';
      shadow.appendChild(lens);
    }
  }

  /* ---------- per-user storage ---------- */

  function teamUserId() {
    var get = typeof window.sscGetUserId === "function" ? window.sscGetUserId() : Promise.resolve(null);
    return get.then(function (id) {
      return !id || id === "anoniem" ? "anon" : String(id);
    });
  }

  function storageGet(keys) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(keys, function (res) {
          resolve(res || {});
        });
      } catch (e) {
        resolve({});
      }
    });
  }

  function storageSet(obj) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.set(obj, function () {
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });
  }

  function validSquad(stored) {
    return stored && stored.formation && FORMATIONS[stored.formation]
      ? { formation: stored.formation, slots: Object.assign({}, stored.slots || {}) }
      : null;
  }

  /**
   * Loads this user's team, opponent and battle points. The one shared
   * sscTeamSquad of older builds moves to the first user who opens the
   * manager and is then removed, so a second account starts empty.
   */
  function readSquad() {
    return teamUserId().then(function (uid) {
      if (squadUser === uid) return squad;
      var teamKey = TEAM_PREFIX + uid;
      var oppKey = OPPONENT_PREFIX + uid;
      var ptsKey = POINTS_PREFIX + uid;
      var leagueKey = LEAGUE_PREFIX + uid;
      return storageGet([teamKey, LEGACY_SQUAD_KEY, oppKey, ptsKey, leagueKey]).then(function (res) {
        squadUser = uid;
        squad = validSquad(res[teamKey]) || { formation: "4-3-3", slots: {} };
        opponent = validateTeamCode(res[oppKey]);
        battlePoints = Number(res[ptsKey]) || 0;
        var league = res[leagueKey];
        leagueInfo = league && typeof league.className === "string" ? league : null;
        leagueMsg = null;
        var legacy = validSquad(res[LEGACY_SQUAD_KEY]);
        if (!res[teamKey] && legacy) {
          squad = legacy;
          writeSquad();
          try {
            chrome.storage.local.remove(LEGACY_SQUAD_KEY);
          } catch (e) {
            /* Left behind is harmless: the per-user key wins from now on. */
          }
        }
        return squad;
      });
    });
  }

  function writeSquad() {
    var payload = {};
    payload[TEAM_PREFIX + (squadUser || "anon")] = squad;
    return storageSet(payload).then(function () {
      return squad;
    });
  }

  function cardScore(card) {
    return card.rating === null || card.rating === undefined ? -1e9 : card.rating;
  }

  /* ---------- league card rules ---------- */

  function league() {
    return window.sscLeague || null;
  }

  /** Test hook (extension console): window.sscLeagueTestNow = "2026-10-31T14:00". */
  function leagueNow() {
    var t = window.sscLeagueTestNow;
    var d = t ? new Date(t) : new Date();
    return isNaN(d.getTime()) ? new Date() : d;
  }

  function leagueAllowed() {
    var L = league();
    return !!L && L.classAllowed(myClassName());
  }

  /** The card rules only apply to players who are in the league. */
  function leagueRulesActive() {
    return !!leagueInfo && leagueAllowed();
  }

  /**
   * Why a card cannot play the league this weekend: { kind: "expired" }
   * (test older than 3 months) or { kind: "cooldown", until } (played last
   * weekend), else null.
   */
  function cardBlockOf(card) {
    var L = league();
    if (!L || !card || !leagueRulesActive()) return null;
    var cooldowns = leagueView.matches ? L.cooldownsFor(squadUser, leagueView.matches) : {};
    return L.cardBlock({ id: card.grade.id, date: card.grade.datum }, cooldowns, leagueNow());
  }

  function blockLabel(block) {
    if (!block) return "";
    if (block.kind === "expired") return "VERLOPEN";
    var d = new Date(block.until);
    return "RUST TOT " + d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" }).toUpperCase();
  }

  function blockMessage(card, block) {
    var name = (card && card.grade.vak) || "Deze kaart";
    if (block.kind === "expired") {
      return name + " is verlopen: de toets is ouder dan 3 maanden en mag niet meer spelen in de league.";
    }
    return name + " speelde vorig weekend en rust tot " +
      new Date(block.until).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" }) + ".";
  }

  /** Best available card for a position by rating, never reusing one placed. */
  function pickFor(role) {
    var placed = {};
    Object.keys(squad.slots).forEach(function (key) {
      placed[squad.slots[key]] = true;
    });
    var best = null;
    for (var i = 0; i < managerCards.length; i++) {
      var card = managerCards[i];
      if (placed[card.grade.id] || cardBlockOf(card)) continue;
      if (positionFor(card.grade.vak) !== role) continue;
      if (!best || cardScore(card) > cardScore(best)) best = card;
    }
    // No natural fit: fall back to the best card of any position, which is
    // what a real manager does when the squad is thin.
    if (!best) {
      for (var j = 0; j < managerCards.length; j++) {
        var c = managerCards[j];
        if (placed[c.grade.id] || cardBlockOf(c)) continue;
        if (!best || cardScore(c) > cardScore(best)) best = c;
      }
    }
    return best;
  }

  /**
   * "Nieuw team opstellen": every card that may not play this weekend goes
   * back to the bench, and the empty places are filled with cards that may.
   */
  function newLeagueTeam() {
    Object.keys(squad.slots).forEach(function (k) {
      if (cardBlockOf(cardById(squad.slots[k]))) delete squad.slots[k];
    });
    var counts = {};
    (FORMATIONS[squad.formation] || FORMATIONS["4-3-3"]).forEach(function (role) {
      counts[role] = (counts[role] || 0) + 1;
      var key = role + (counts[role] - 1);
      if (squad.slots[key]) return;
      var best = pickFor(role);
      if (best) squad.slots[key] = best.grade.id;
    });
    writeSquad();
  }

  function blockedOnPitch() {
    return Object.keys(squad.slots).filter(function (k) {
      return !!cardBlockOf(cardById(squad.slots[k]));
    }).length;
  }

  function autoFill() {
    var roles = FORMATIONS[squad.formation] || FORMATIONS["4-3-3"];
    squad.slots = {};
    var counts = {};
    for (var i = 0; i < roles.length; i++) {
      var role = roles[i];
      counts[role] = (counts[role] || 0) + 1;
      var key = role + (counts[role] - 1);
      var best = pickFor(role);
      if (best) squad.slots[key] = best.grade.id;
    }
    writeSquad();
  }

  function cardById(id) {
    for (var i = 0; i < managerCards.length; i++) {
      if (managerCards[i].grade.id === id) return managerCards[i];
    }
    return null;
  }

  function slotKeyList(formation) {
    var roles = FORMATIONS[formation || squad.formation] || FORMATIONS["4-3-3"];
    var counts = {};
    var out = [];
    for (var i = 0; i < roles.length; i++) {
      var role = roles[i];
      counts[role] = (counts[role] || 0) + 1;
      out.push({ key: role + (counts[role] - 1), role: role, index: i });
    }
    return out;
  }

  /**
   * Where a slot sits on the pitch. The pitch is drawn vertically: our goal at
   * the bottom, the opponent's at the top — the way a manager looks at it.
   * Each role gets a row, and the members of a row are spread evenly. The rows
   * leave room for a whole card above the top row and below the keeper.
   */
  function slotPosition(role, indexInRole, countInRole) {
    var rows = { GK: 86, DEF: 64, MID: 41, ATT: 17 };
    var top = rows[role] || 50;
    var left = ((indexInRole + 1) / (countInRole + 1)) * 100;
    return { left: left, top: top };
  }

  function slotCounts(formation) {
    var roles = FORMATIONS[formation || squad.formation] || FORMATIONS["4-3-3"];
    var counts = {};
    for (var i = 0; i < roles.length; i++) counts[roles[i]] = (counts[roles[i]] || 0) + 1;
    return counts;
  }

  /** This user's starting XI as plain players (for sharing and battles). */
  function myPlayers() {
    var out = [];
    slotKeyList().forEach(function (e) {
      var card = squad.slots[e.key] ? cardById(squad.slots[e.key]) : null;
      if (!card || card.rating === null) return;
      var L = league();
      out.push({
        slot: e.key,
        role: e.role,
        // Out of position counts everywhere this team goes: battles, league, team rating.
        rating: ratingAt(card.rating, card.grade.vak, e.role),
        vak: card.grade.vak || "Cijfer",
        pct: Math.round(card.percent),
        // For the league: which card (cooldown) and how old (expiry).
        id: card.grade.id || "",
        date: L ? L.toIsoDate(card.grade.datum) : "",
      });
    });
    return out;
  }

  var LINE = { GK: 0, DEF: 1, MID: 2, ATT: 3 };

  /**
   * A card out of position is worth less: one line away (DEF-MID, MID-ATT)
   * 10% off, two lines (DEF-ATT) 20%. No subject is a keeper, so the goal
   * takes any card at full value; only a real keeper card loses 35% in the field.
   */
  function positionFactor(vak, role) {
    var own = positionFor(vak);
    if (!role || own === role) return 1;
    if (role === "GK") return 1;
    if (own === "GK") return 0.65;
    return Math.abs(LINE[own] - LINE[role]) === 1 ? 0.9 : 0.8;
  }

  function ratingAt(rating, vak, role) {
    if (rating === null || rating === undefined) return rating;
    return Math.max(1, Math.round(rating * positionFactor(vak, role)));
  }

  function teamRating(players) {
    if (!players.length) return null;
    var sum = players.reduce(function (s, p) {
      return s + p.rating;
    }, 0);
    return Math.round(sum / players.length);
  }

  /* ---------- the small FUT card ---------- */

  /**
   * p: { rating, pct, vak, role }. The tier colour follows the percentage,
   * like the big card (fifa-card.js); without one, the rating.
   */
  function miniCard(p) {
    var basis = typeof p.pct === "number" && isFinite(p.pct) ? p.pct : p.rating;
    var tier = tierOf(basis);
    var card = h("div", "ssc-mc tier-" + (tier.id || "bronze"));
    var art = cardModule();
    card.appendChild(h("div", "ssc-mc-holo"));
    if (art && art.trackHolo) art.trackHolo(card);
    var top = h("div", "ssc-mc-top");
    var rateText = p.rating === null || p.rating === undefined ? "–" : String(p.rating);
    var rate = h("span", "ssc-mc-rate", rateText);
    if (rateText.length > 2) rate.setAttribute("data-wide", "1");
    if (p.off) {
      card.setAttribute("data-off", "1");
      card.title = "Verkeerde positie: " + p.off + " wordt " + rateText + " (beste positie " + positionFor(p.vak) + ")";
    }
    top.appendChild(rate);
    top.appendChild(h("span", "ssc-mc-pos", p.role || positionFor(p.vak)));
    card.appendChild(top);
    var mod = cardModule();
    var emoji = h("div", "ssc-mc-emoji");
    if (mod && mod.iconFor) emoji.appendChild(mod.iconFor(p.vak));
    emoji.setAttribute("aria-hidden", "true");
    card.appendChild(emoji);
    var name = h("div", "ssc-mc-name", p.vak || "Cijfer");
    name.title = p.vak || "Cijfer";
    card.appendChild(name);
    card.appendChild(h("div", "ssc-mc-line"));
    if (typeof p.pct === "number" && isFinite(p.pct)) {
      var stat = h("div", "ssc-mc-stat", Math.round(p.pct) + "%");
      stat.appendChild(h("span", null, "PUNT"));
      card.appendChild(stat);
    }
    return card;
  }

  function playerOfCard(card, role) {
    return {
      rating: ratingAt(card.rating, card.grade.vak, role),
      off: positionFactor(card.grade.vak, role) < 1 ? card.rating : null,
      pct: card.percent,
      vak: card.grade.vak || "Cijfer",
      role: role || positionFor(card.grade.vak),
    };
  }

  /**
   * A pitch with the formation's slots. `fill(entry)` returns the player for
   * a slot or null; `onSlot(entry, node)` wires it up (optional).
   */
  /** Touchlines, halfway line and both boxes; stretches with the pitch. */
  function pitchLines() {
    var svg = document.createElementNS(TM_NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 140");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("class", "ssc-tm-lines");
    svg.setAttribute("aria-hidden", "true");
    var p = document.createElementNS(TM_NS, "path");
    p.setAttribute("d", "M5 5h90v130H5zM5 70h90M27 5v20h46V5M40 5v8h20V5M27 135v-20h46v20M40 135v-8h20v8");
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", "rgba(255,255,255,.34)");
    p.setAttribute("stroke-width", "2");
    p.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(p);
    return svg;
  }

  function buildPitch(formation, fill, onSlot, extraClass) {
    var pitch = h("div", "ssc-tm-pitch" + (extraClass ? " " + extraClass : ""));
    pitch.appendChild(pitchLines());
    pitch.appendChild(h("div", "ssc-tm-circle"));
    var counts = slotCounts(formation);
    var seen = {};
    slotKeyList(formation).forEach(function (entry) {
      seen[entry.role] = (seen[entry.role] || 0) + 1;
      var geo = slotPosition(entry.role, seen[entry.role] - 1, counts[entry.role]);
      var slot = h("button", "ssc-tm-slot");
      slot.type = "button";
      slot.style.left = geo.left + "%";
      slot.style.top = geo.top + "%";
      slot.setAttribute("data-slot", entry.key);
      var player = fill(entry);
      slot.setAttribute("data-filled", player ? "1" : "0");
      if (player) {
        slot.appendChild(miniCard(player));
        slot.setAttribute("aria-label", entry.role + ": " + player.vak + " " + player.rating);
      } else {
        var empty = h("div", "ssc-tm-slot-empty");
        empty.appendChild(h("span", "ssc-tm-slot-plus", "+"));
        empty.appendChild(h("span", null, entry.role));
        slot.appendChild(empty);
        slot.setAttribute("aria-label", entry.role + ": leeg");
      }
      if (onSlot) onSlot(entry, slot, player);
      pitch.appendChild(slot);
    });
    return pitch;
  }

  /* ---------- manager ---------- */

  var benchScrollX = 0, benchScrollY = 0;

  function renderManager() {
    if (!managerEl) return;
    if (battle) return; // the battle screen owns the overlay until it closes
    managerEl.textContent = "";
    modalEl = null;

    var head = h("div", "ssc-tm-head");
    var titles = h("div");
    titles.appendChild(h("h2", "ssc-tm-title", "Mijn Team"));
    var mine = myPlayers();
    var tr = teamRating(mine);
    titles.appendChild(h(
      "div",
      "ssc-tm-sub",
      managerCards.length + " kaarten · teamrating " + (tr === null ? "–" : tr) + " · formatie " + squad.formation
    ));
    head.appendChild(titles);

    // Other classes never see the league: no tab at all, not even a "no access" notice.
    var inLeague = leagueAllowed();
    if (!inLeague && managerTab === "league") managerTab = "team";
    var tabs = h("div", "ssc-tm-tabs");
    tabs.setAttribute("role", "tablist");
    [["team", "Team"], ["league", "Competitie"]].filter(function (t) {
      return t[0] !== "league" || inLeague;
    }).forEach(function (t) {
      var tab = t[0] === "league" ? hi("button", "ssc-tm-tab", "trophy", t[1]) : h("button", "ssc-tm-tab", t[1]);
      tab.type = "button";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", managerTab === t[0] ? "true" : "false");
      tab.addEventListener("click", function () {
        if (managerTab === t[0]) return;
        managerTab = t[0];
        leagueMsg = null;
        if (managerTab === "league" && leagueAllowed() && !leagueView.loading) loadLeague();
        renderManager();
        var swapped = managerEl.querySelector(".ssc-tm-body, .ssc-lg-body");
        if (swapped) swapped.classList.add("ssc-tm-swap");
      });
      tabs.appendChild(tab);
    });
    if (inLeague) head.appendChild(tabs); // a lone "Team" tab would be pointless

    var close = hi("button", "ssc-tm-close", "close", "Sluiten");
    close.type = "button";
    close.addEventListener("click", closeManager);
    head.appendChild(close);
    managerEl.appendChild(head);

    if (managerTab === "league") {
      renderLeagueTab();
      return;
    }

    var body = h("div", "ssc-tm-body");

    /* ---- left: the bench ---- */
    var left = h("div", "ssc-tm-panel ssc-tm-benchbar");
    left.appendChild(panelTitle("Bank"));
    var bench = h("div", "ssc-tm-bench");
    // Every click re-renders: keep the bar where the user scrolled it.
    bench.addEventListener("scroll", function () { benchScrollX = bench.scrollLeft; benchScrollY = bench.scrollTop; });
    bench.addEventListener("wheel", function (e) {
      if (!e.deltaY || e.shiftKey || bench.scrollWidth <= bench.clientWidth) return;
      bench.scrollLeft += e.deltaY;
      e.preventDefault();
    });
    Promise.resolve().then(function () { bench.scrollLeft = benchScrollX; bench.scrollTop = benchScrollY; });
    var placedIds = {};
    Object.keys(squad.slots).forEach(function (k) {
      placedIds[squad.slots[k]] = true;
    });
    var available = managerCards.slice().sort(function (a, b) {
      return cardScore(b) - cardScore(a);
    });
    if (!available.length) {
      bench.appendChild(h("div", "ssc-tm-empty", "Nog geen kaarten. Open je Resultaten-pagina."));
    }
    available.forEach(function (card) {
      var item = h("button", "ssc-tm-benchcard");
      item.type = "button";
      item.setAttribute("data-placed", placedIds[card.grade.id] ? "1" : "0");
      var isSel = selectedCard && selectedCard.grade.id === card.grade.id;
      item.setAttribute("data-selected", isSel ? "1" : "0");
      item.setAttribute("aria-label", (card.grade.vak || "Cijfer") + ", rating " + card.rating);
      item.title = (card.grade.vak || "Cijfer") + (card.grade.titel ? " — " + card.grade.titel : "");
      item.appendChild(miniCard(playerOfCard(card)));
      var block = cardBlockOf(card);
      if (block) {
        item.setAttribute("data-block", block.kind);
        item.appendChild(block.kind === "expired" ? h("span", "ssc-tm-lock", blockLabel(block)) : hi("span", "ssc-tm-lock", "lock", blockLabel(block)));
        item.title = blockMessage(card, block);
      }
      item.addEventListener("click", function () {
        if (block) {
          // A resting or expired card cannot be picked for the league team.
          setLeagueMsg(blockMessage(card, block), "bad");
          return;
        }
        selectedCard = isSel ? null : card;
        selectedSlot = null;
        renderManager();
      });
      bench.appendChild(item);
    });
    left.appendChild(bench);
    body.appendChild(left);

    /* ---- centre: the pitch ---- */
    var pitch = buildPitch(
      squad.formation,
      function (entry) {
        var card = squad.slots[entry.key] ? cardById(squad.slots[entry.key]) : null;
        return card ? playerOfCard(card, entry.role) : null;
      },
      function (entry, slot) {
        if (selectedCard || selectedSlot === entry.key) slot.setAttribute("data-target", "1");
        var onPitch = squad.slots[entry.key] ? cardById(squad.slots[entry.key]) : null;
        var pitchBlock = cardBlockOf(onPitch);
        if (pitchBlock) {
          slot.setAttribute("data-block", pitchBlock.kind);
          slot.appendChild(pitchBlock.kind === "expired" ? h("span", "ssc-tm-lock", "VERLOPEN") : hi("span", "ssc-tm-lock", "lock", "RUST"));
          slot.title = blockMessage(onPitch, pitchBlock);
        }
        slot.addEventListener("click", function () {
          if (selectedCard) {
            squad.slots[entry.key] = selectedCard.grade.id;
            // Remove the same card from its previous slot: one grade, one place.
            Object.keys(squad.slots).forEach(function (k) {
              if (k !== entry.key && squad.slots[k] === squad.slots[entry.key]) delete squad.slots[k];
            });
            selectedCard = null;
            writeSquad();
          } else {
            selectedSlot = selectedSlot === entry.key ? null : entry.key;
          }
          renderManager();
        });
      }
    );
    body.appendChild(pitch);

    /* ---- right: details ---- */
    var right = h("div", "ssc-tm-panel");
    right.appendChild(panelTitle("Details"));
    var detail = h("div", "ssc-tm-detail");

    var focusCard = selectedCard || (selectedSlot && squad.slots[selectedSlot]
      ? cardById(squad.slots[selectedSlot])
      : null);

    if (!focusCard) {
      detail.appendChild(h("div", "ssc-tm-empty", "Kies een kaart op de bank, dan een positie op het veld."));
    } else {
      var g = focusCard.grade;
      detail.appendChild(h("h3", null, g.vak || "Cijfer"));
      var dl = h("dl");
      var addRow = function (label, value) {
        if (!value && value !== 0) return;
        dl.appendChild(h("dt", null, label));
        dl.appendChild(h("dd", null, value));
      };
      addRow("Rating", focusCard.rating === null ? "" : String(focusCard.rating));
      addRow("Titel", g.titel);
      addRow("Percentage", focusCard.percent === null ? "" : fmtNumber(focusCard.percent) + "%");
      addRow(
        "Klasgemiddelde",
        focusCard.classAvg !== null
          ? fmtNumber(focusCard.classAvg) + "%"
          : classAvgPending
            ? "wordt geladen…"
            : "niet gedeeld door de leerkracht"
      );
      addRow("Op 20", focusCard.op20 === null ? "" : fmtNumber(focusCard.op20));
      addRow("Datum", g.datum);
      addRow("Periode", g.periode);
      addRow("Leerkracht", g.leerkracht);
      addRow("Tier", TIER_LABEL[focusCard.tier.id] || focusCard.tier.id);
      addRow("Beste positie", positionFor(g.vak));
      addRow("Elders", "1 linie verder -10%, 2 linies -20%, in doel geen straf");
      detail.appendChild(dl);

      var p = focusCard.percent;
      var a = focusCard.classAvg === null ? p : focusCard.classAvg;
      detail.appendChild(h(
        "div",
        "ssc-tm-formula",
        fmtNumber(p) + " × 0,9 + (" + fmtNumber(p) + " − " + fmtNumber(a) + ") × 0,2 = " + focusCard.rating
      ));

      if (selectedSlot) {
        var removeBtn = h("button", "ssc-tm-btn", "Positie leegmaken");
        removeBtn.type = "button";
        removeBtn.style.marginTop = "12px";
        removeBtn.addEventListener("click", function () {
          delete squad.slots[selectedSlot];
          selectedSlot = null;
          writeSquad();
          renderManager();
        });
        detail.appendChild(removeBtn);
      }
    }
    right.appendChild(detail);
    body.appendChild(right);

    managerEl.appendChild(body);

    /* ---- bottom action bar ---- */
    var foot = h("div", "ssc-tm-foot");

    var openPack = h("button", "ssc-tm-btn", "Open pakket");
    openPack.type = "button";
    openPack.addEventListener("click", function () {
      // "Opening the pack" is the same reveal the Resultaten page uses: play
      // the highest-rated card not yet in the squad.
      var placed = {};
      Object.keys(squad.slots).forEach(function (k) {
        placed[squad.slots[k]] = true;
      });
      var pool = managerCards.filter(function (c) {
        return !placed[c.grade.id];
      });
      if (!pool.length) pool = managerCards;
      if (!pool.length) return;
      playCard(pool.slice().sort(function (x, y) {
        return cardScore(y) - cardScore(x);
      })[0]);
    });
    foot.appendChild(openPack);

    var form = h("select", "ssc-tm-select");
    form.setAttribute("aria-label", "Formatie");
    Object.keys(FORMATIONS).forEach(function (name) {
      var opt = h("option", null, name);
      opt.value = name;
      if (name === squad.formation) opt.selected = true;
      form.appendChild(opt);
    });
    form.addEventListener("change", function () {
      squad.formation = form.value;
      // Slots are keyed by role+index, so a new formation keeps every player
      // whose role still exists and drops the rest.
      var keep = {};
      slotKeyList().forEach(function (e) {
        if (squad.slots[e.key]) keep[e.key] = squad.slots[e.key];
      });
      squad.slots = keep;
      selectedSlot = null;
      writeSquad();
      renderManager();
    });
    foot.appendChild(form);

    var auto = h("button", "ssc-tm-btn", "Auto-opstellen");
    auto.type = "button";
    auto.addEventListener("click", function () {
      autoFill();
      renderManager();
    });
    foot.appendChild(auto);

    var share = h("button", "ssc-tm-btn", "Deel Team");
    share.type = "button";
    share.disabled = !mine.length;
    share.addEventListener("click", openShareModal);
    foot.appendChild(share);

    var join = hi(
      "button",
      "ssc-tm-btn ssc-tm-btn--league",
      "trophy",
      leagueInfo ? "Team bijwerken (" + leagueInfo.className + ")" : "Inschrijven"
    );
    join.type = "button";
    var allowed = leagueAllowed();
    join.disabled = leagueBusy || !allowed;
    join.title = !allowed
      ? (league() ? league().ACCESS_MESSAGE : "")
      : leagueInfo
        ? "Je staat in de competitie van " + leagueInfo.className + ". Klik om je huidige team door te sturen."
        : "Schrijf je in voor de competitie van je klas.";
    join.addEventListener("click", function () {
      joinLeague();
    });
    if (allowed) foot.appendChild(join); // other classes get no league button at all

    var blocked = blockedOnPitch();
    if (blocked) {
      var renew = h("button", "ssc-tm-btn ssc-tm-btn--league", "Nieuw team opstellen");
      renew.type = "button";
      renew.title = blocked + (blocked === 1 ? " speler mag" : " spelers mogen") + " dit weekend niet spelen.";
      renew.addEventListener("click", function () {
        newLeagueTeam();
        leagueMsg = null;
        joinLeague({ quiet: true });
        renderManager();
      });
      foot.appendChild(renew);
    }

    var importBtn = h("button", "ssc-tm-btn", "Importeer Team");
    importBtn.type = "button";
    importBtn.addEventListener("click", openImportModal);
    foot.appendChild(importBtn);

    var fight = hi("button", "ssc-tm-btn ssc-tm-btn--battle", "swords", opponent ? "Battle vs " + opponent.naam : "Battle");
    fight.type = "button";
    fight.disabled = !opponent || !mine.length;
    fight.title = !opponent
      ? "Importeer eerst het team van een klasgenoot."
      : !mine.length
        ? "Zet eerst spelers op het veld."
        : "Speel 5 rondes tegen " + opponent.naam + ".";
    fight.addEventListener("click", startBattle);
    foot.appendChild(fight);

    foot.appendChild(h("span", "ssc-tm-spacer"));

    foot.appendChild(hi("span", "ssc-tm-points", "trophy", battlePoints + " battlepunten"));

    var status = h("span", "ssc-tm-status");
    var filled = Object.keys(squad.slots).length;
    status.textContent = classAvgPending
      ? "Klasgemiddelden ophalen… nog " + classAvgPending
      : filled + " / " + slotKeyList().length + " posities ingevuld";
    if (blocked && !leagueMsg) {
      status.textContent = blocked + (blocked === 1 ? " speler op het veld mag" : " spelers op het veld mogen") +
        " dit weekend niet spelen in de league.";
      status.setAttribute("data-tone", "bad");
    }
    if (leagueMsg) {
      status.textContent = leagueMsg.text;
      status.setAttribute("data-tone", leagueMsg.tone);
    }
    foot.appendChild(status);

    var save = h("button", "ssc-tm-btn ssc-tm-btn--primary", "Opslaan");
    save.type = "button";
    save.addEventListener("click", function () {
      writeSquad().then(function () {
        // In the league, saving also sends the new team to the class table.
        if (leagueRulesActive()) {
          joinLeague({ savedText: true });
          return;
        }
        status.textContent = "Opgeslagen.";
      });
    });
    foot.appendChild(save);

    managerEl.appendChild(foot);
  }

  function panelTitle(text) {
    return h("div", "ssc-tm-panel-title", text);
  }

  /* ---------- share codes (no server) ---------- */

  /*
   * A team code is Base64 of UTF-8 JSON:
   *   { v: 1, naam, f: formation, s: [[slot, rating, vak, pct], ...] }
   * Decoding validates every field and caps every length: the code comes from
   * someone else, so nothing in it is trusted, and it is only ever rendered
   * through textContent.
   */
  function toBase64(text) {
    var bytes = new TextEncoder().encode(text);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function fromBase64(code) {
    var bin = atob(code);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  function myName() {
    var node = document.querySelector(".js-btn-profile .hlp-vert-box span");
    var name = node && (node.textContent || "").trim();
    return name || "Klasgenoot";
  }

  function encodeTeam() {
    var data = {
      v: 1,
      naam: myName().slice(0, 40),
      f: squad.formation,
      s: myPlayers().map(function (p) {
        return [p.slot, p.rating, p.vak.slice(0, 60), p.pct, p.id, p.date];
      }),
    };
    return toBase64(JSON.stringify(data));
  }

  /** Accepts a decoded object (storage) or a raw code (paste). Null if bad. */
  function validateTeamCode(input) {
    var data = input;
    if (typeof input === "string") {
      try {
        data = JSON.parse(fromBase64(input.replace(/\s+/g, "")));
      } catch (e) {
        return null;
      }
    }
    if (!data || typeof data !== "object" || data.v !== 1) return null;
    if (!FORMATIONS[data.f] || !Array.isArray(data.s) || !data.s.length || data.s.length > 11) return null;
    var valid = {};
    slotKeyList(data.f).forEach(function (e) {
      valid[e.key] = e.role;
    });
    var seen = {};
    var players = [];
    for (var i = 0; i < data.s.length; i++) {
      var row = data.s[i];
      if (!Array.isArray(row)) return null;
      var slot = row[0];
      var rating = row[1];
      var vak = row[2];
      var pct = row[3];
      if (typeof slot !== "string" || !valid[slot] || seen[slot]) return null;
      if (typeof rating !== "number" || rating % 1 !== 0 || rating < 1 || rating > 100) return null;
      if (typeof vak !== "string" || !vak.trim()) return null;
      if (pct !== undefined && pct !== null && (typeof pct !== "number" || pct < 0 || pct > 100)) return null;
      // Optional since the league: the card's grade id and test date.
      var cardId = row[4];
      var date = row[5];
      if (cardId !== undefined && cardId !== null && cardId !== "" &&
        (typeof cardId !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(cardId))) return null;
      if (date !== undefined && date !== null && date !== "" &&
        (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))) return null;
      seen[slot] = true;
      players.push({
        slot: slot,
        role: valid[slot],
        rating: rating,
        vak: vak.trim().slice(0, 60),
        pct: typeof pct === "number" ? pct : null,
        id: cardId || "",
        date: date || "",
      });
    }
    var naam = typeof data.naam === "string" && data.naam.trim() ? data.naam.trim().slice(0, 40) : "Tegenstander";
    return { v: 1, naam: naam, f: data.f, s: data.s, players: players };
  }

  /* ---------- online league: joining (Phase 1) ---------- */

  /**
   * The student's class, as Smartschool names it ("5D-TWE"): every grade
   * carries period.class.name (settings.js keeps it as `klas`). The most
   * frequent one wins, so a stray grade from another class cannot move you.
   */
  function myClassName() {
    var count = {};
    var best = "";
    managerGrades.forEach(function (g) {
      var k = g && typeof g.klas === "string" ? g.klas.trim() : "";
      if (!k) return;
      count[k] = (count[k] || 0) + 1;
      if (!best || count[k] > count[best]) best = k;
    });
    return best;
  }

  function setLeagueMsg(text, tone) {
    leagueMsg = { text: text, tone: tone || "info" };
    renderManager();
  }

  function leagueError(res, what) {
    var action = what || "Inschrijven";
    if (!res) return "Kan de extensie niet bereiken. Herlaad de pagina en probeer opnieuw.";
    switch (res.error) {
      case "network":
        return "Geen verbinding met de competitieserver. Controleer je internet en probeer opnieuw.";
      case "bad_user":
        return "Je Smartschool-gebruiker is niet gevonden. Herlaad de pagina.";
      case "bad_class":
        return "Je klas is niet gevonden in je resultaten.";
      case "not_allowed":
        return league() ? league().ACCESS_MESSAGE : "De league is niet beschikbaar voor jouw klas.";
      case "bad_team":
        return "Je team kon niet worden doorgestuurd. Zet je spelers opnieuw op het veld.";
      case "bad_weekend":
        return "Het speelweekend kon niet worden opgeslagen (ongeldige gegevens).";
      case "exists":
        return "Dit weekend is al gespeeld door een klasgenoot. De stand is bijgewerkt.";
      case "http":
        if (res.status === 403 || res.status === 401) {
          return "De competitieserver weigert dit (fout " + res.status + ").";
        }
        return action + " mislukt (fout " + res.status + " van de competitieserver).";
      default:
        return action + " mislukt. Probeer later opnieuw.";
    }
  }

  /** chrome.runtime.sendMessage with every failure turned into `null`. */
  function sendBackground(msg, done) {
    try {
      chrome.runtime.sendMessage(msg, function (res) {
        if (chrome.runtime.lastError) {
          done(null);
          return;
        }
        done(res);
      });
    } catch (e) {
      // "Extension context invalidated": the extension was reloaded under
      // this page.
      done(null);
    }
  }

  /**
   * Sends this user's team to leagues/{class}/members/{userId} through the
   * service worker (background.js does the database call).
   * opts.quiet: no "busy" message; opts.savedText: "Opgeslagen" wording.
   */
  function joinLeague(opts) {
    var o = opts || {};
    if (leagueBusy) return;
    if (!leagueAllowed()) {
      setLeagueMsg(league() ? league().ACCESS_MESSAGE : "De league is niet beschikbaar.", "bad");
      return;
    }
    if (!myPlayers().length) {
      setLeagueMsg("Zet eerst spelers op het veld voor je inschrijft.", "bad");
      return;
    }
    if (!squadUser || squadUser === "anon") {
      setLeagueMsg("Je Smartschool-gebruiker is niet gevonden. Herlaad de pagina.", "bad");
      return;
    }
    var klas = myClassName();
    if (!klas) {
      setLeagueMsg("Je klas is niet gevonden in je resultaten. Open Resultaten en probeer opnieuw.", "bad");
      return;
    }

    leagueBusy = true;
    if (!o.quiet) setLeagueMsg((leagueInfo ? "Team doorsturen naar " : "Inschrijven in de competitie van ") + klas + "…", "info");

    sendBackground({
      type: "ssc:leagueJoin",
      userId: squadUser,
      displayName: myName(),
      className: klas,
      teamData: encodeTeam(),
    }, function (res) {
      leagueBusy = false;
      if (res && res.ok) {
        leagueInfo = { className: res.className || klas, joinedAt: Date.now() };
        var payload = {};
        payload[LEAGUE_PREFIX + squadUser] = leagueInfo;
        storageSet(payload);
        // Keep the open table in step with what was just sent.
        if (leagueView.members) loadLeague();
        setLeagueMsg(
          o.savedText
            ? "Opgeslagen. Je team staat ook in de competitie van " + leagueInfo.className + "."
            : res.updated
              ? "Je team in de competitie van " + leagueInfo.className + " is bijgewerkt."
              : "Ingeschreven in de competitie van " + leagueInfo.className + "!",
          "good"
        );
      } else {
        setLeagueMsg(leagueError(res), "bad");
      }
    });
  }

  /* ---------- online league: table, fixtures, weekend (Competitie) ---------- */

  function loadLeague(then) {
    var klas = myClassName();
    if (!klas || !leagueAllowed()) return;
    leagueView.loading = true;
    leagueView.error = "";
    renderManager();
    sendBackground({ type: "ssc:leagueGet", className: klas }, function (res) {
      leagueView.loading = false;
      if (res && res.ok) {
        leagueView.members = res.members || {};
        leagueView.matches = res.matches || {};
        // A member entry in the database is the truth about having joined:
        // it also covers joining from another browser.
        if (squadUser && leagueView.members[squadUser] && !leagueInfo) {
          leagueInfo = { className: klas, joinedAt: Date.now() };
        }
      } else {
        leagueView.error = leagueError(res, "Laden");
      }
      renderManager();
      if (then) then(res);
    });
  }

  function decodeForLeague(code) {
    return validateTeamCode(code) || { players: [] };
  }

  function memberName(id) {
    var m = leagueView.members && leagueView.members[id];
    return m && typeof m.displayName === "string" && m.displayName ? m.displayName : "Speler";
  }

  function fmtDay(ms, withWeekday) {
    return new Date(ms).toLocaleDateString("nl-BE", withWeekday
      ? { weekday: "short", day: "numeric", month: "short" }
      : { day: "numeric", month: "short" });
  }

  /**
   * "Simuleer Weekend": read the league fresh, play every pairing of this
   * weekend with league.js (same result on every client), store it once.
   */
  function simulateWeekendClick() {
    var L = league();
    var klas = myClassName();
    if (!L || leagueView.busy) return;
    if (!leagueAllowed()) {
      setLeagueMsg(L.ACCESS_MESSAGE, "bad");
      return;
    }
    leagueView.busy = true;
    setLeagueMsg("Speeldag wordt gesimuleerd…", "info");
    loadLeague(function (res) {
      if (!res || !res.ok) {
        leagueView.busy = false;
        setLeagueMsg(leagueError(res, "Simuleren"), "bad");
        return;
      }
      var now = leagueNow();
      var wk = L.weekId(L.weekendStart(now));
      if (leagueView.matches[wk]) {
        leagueView.busy = false;
        setLeagueMsg("Dit weekend is al gespeeld.", "info");
        return;
      }
      var data = L.simulateWeekend(klas, leagueView.members, leagueView.matches, now, decodeForLeague);
      if (!Object.keys(data.matches).length) {
        leagueView.busy = false;
        setLeagueMsg("Er zijn minstens 2 spelers nodig voor een speeldag.", "bad");
        return;
      }
      sendBackground({ type: "ssc:leagueSaveWeekend", className: klas, weekId: wk, data: data }, function (save) {
        leagueView.busy = false;
        if (save && save.ok) {
          loadLeague();
          setLeagueMsg("Speeldag " + wk + " is gespeeld! Bekijk de uitslagen.", "good");
        } else {
          if (save && save.error === "exists") loadLeague();
          setLeagueMsg(leagueError(save, "Simuleren"), save && save.error === "exists" ? "info" : "bad");
        }
      });
    });
  }

  function leagueTable(rows) {
    var table = h("table", "ssc-lg-table");
    var thead = h("thead");
    var hr = h("tr");
    [["#", "Positie"], ["Naam", ""], ["G", "Gespeeld"], ["W", "Gewonnen"], ["GL", "Gelijk"], ["V", "Verloren"], ["DS", "Duelsaldo"], ["Ptn", "Punten"]]
      .forEach(function (c) {
        var th = h("th", null, c[0]);
        if (c[1]) th.title = c[1];
        hr.appendChild(th);
      });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = h("tbody");
    rows.forEach(function (r, i) {
      var tr = h("tr");
      if (r.userId === squadUser) tr.setAttribute("data-me", "1");
      var pos = h("td", "ssc-lg-pos");
      var badge = h("span", "ssc-lg-rank", String(i + 1));
      if (i < 3) badge.setAttribute("data-medal", ["gold", "silver", "bronze"][i]);
      pos.appendChild(badge);
      tr.appendChild(pos);
      var name = h("td", "ssc-lg-name");
      name.title = r.name;
      var who = h("div", "ssc-lg-who");
      var av = h("span", "ssc-lg-av", String(r.name || "?").trim().charAt(0).toUpperCase());
      av.style.setProperty("--h", String((String(r.name).length * 47 + String(r.name).charCodeAt(0) * 13) % 360));
      av.setAttribute("aria-hidden", "true");
      who.appendChild(av);
      who.appendChild(h("span", null, r.name));
      name.appendChild(who);
      tr.appendChild(name);
      var diff = r.duelsFor - r.duelsAgainst;
      [r.played, r.won, r.drawn, r.lost, (diff > 0 ? "+" : "") + diff].forEach(function (v) {
        tr.appendChild(h("td", "ssc-lg-num", String(v)));
      });
      tr.appendChild(h("td", "ssc-lg-pts", String(r.points)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function fixtureRow(homeId, awayId, result) {
    var row = h("div", "ssc-lg-fixture");
    if (homeId === squadUser || awayId === squadUser) row.setAttribute("data-me", "1");
    row.appendChild(h("span", "ssc-lg-team ssc-lg-home", memberName(homeId)));
    var mid = h("span", "ssc-lg-score", result ? result.score1 + " – " + result.score2 : "vs");
    if (!result) mid.setAttribute("data-open", "1");
    row.appendChild(mid);
    row.appendChild(h("span", "ssc-lg-team ssc-lg-away", memberName(awayId)));
    return row;
  }

  function renderLeagueTab() {
    var L = league();
    var body = h("div", "ssc-lg-body");
    var klas = myClassName();

    if (!L) {
      body.appendChild(h("div", "ssc-lg-banner", "De league kon niet worden geladen."));
      managerEl.appendChild(body);
      return;
    }
    if (!leagueAllowed()) {
      var gate = h("div", "ssc-lg-gate");
      var gateIcon = h("div", "ssc-lg-gate-icon");
      gateIcon.appendChild(tmIcon("lock"));
      gate.appendChild(gateIcon);
      gate.appendChild(h("div", "ssc-lg-gate-text", L.ACCESS_MESSAGE));
      if (klas) gate.appendChild(h("div", "ssc-lg-gate-sub", "Jouw klas: " + klas));
      body.appendChild(gate);
      managerEl.appendChild(body);
      renderLeagueFoot(false, false);
      return;
    }

    var now = leagueNow();
    var start = L.weekendStart(now);
    var wk = L.weekId(start);
    var played = leagueView.matches && leagueView.matches[wk];

    /* ---- left: the table ---- */
    var left = h("div", "ssc-tm-panel ssc-lg-panel");
    var title = h("div", "ssc-lg-title");
    title.appendChild(h("span", "ssc-lg-title-main", "Competitie " + klas));
    if (leagueView.busy) title.appendChild(h("span", "ssc-lg-live", "Live"));
    title.appendChild(h("span", "ssc-lg-title-sub", "Speeldag " + wk));
    left.appendChild(title);

    if (leagueView.loading && !leagueView.members) {
      left.appendChild(h("div", "ssc-tm-empty", "Stand wordt geladen…"));
    } else if (leagueView.error) {
      left.appendChild(h("div", "ssc-lg-banner", leagueView.error));
    } else if (leagueView.members) {
      var rows = L.standings(leagueView.members, leagueView.matches);
      if (!rows.length) {
        left.appendChild(h("div", "ssc-tm-empty", "Nog niemand ingeschreven. Wees de eerste: Team → Inschrijven."));
      } else {
        var wrap = h("div", "ssc-lg-table-wrap");
        wrap.appendChild(leagueTable(rows));
        left.appendChild(wrap);
      }
    }
    body.appendChild(left);

    /* ---- right: fixtures ---- */
    var right = h("div", "ssc-tm-panel ssc-lg-panel");
    right.appendChild(h("div", "ssc-lg-title-main", "Speelschema"));
    var when = h("div", "ssc-lg-when");
    var sunday = new Date(start.getTime());
    sunday.setDate(sunday.getDate() + 1);
    when.textContent = fmtDay(start.getTime(), true) + " – " + fmtDay(sunday.getTime(), true) +
      (played ? " · gespeeld" : " · " + (L.isWeekend(now) ? "speelweekend!" : "nog te spelen"));
    right.appendChild(when);

    var list = h("div", "ssc-lg-fixtures");
    if (played) {
      Object.keys(played.matches || {}).sort(function (a, b) {
        return Number(a.slice(1)) - Number(b.slice(1));
      }).forEach(function (k) {
        var m = played.matches[k];
        list.appendChild(fixtureRow(m.user1, m.user2, m));
      });
      if (played.bye) list.appendChild(h("div", "ssc-lg-bye", memberName(played.bye) + " is vrij dit weekend."));
    } else if (leagueView.members) {
      var ids = Object.keys(leagueView.members);
      if (ids.length < 2) {
        list.appendChild(h("div", "ssc-tm-empty", "Minstens 2 spelers nodig voor een speeldag."));
      } else {
        // Same strength-based draw the simulation will make (league.js).
        var strengths = {};
        var wkStart = L.weekendStart(leagueNow());
        ids = ids.filter(function (id) {
          return leagueView.members[id] && typeof leagueView.members[id].teamData === "string";
        });
        ids.forEach(function (id) {
          strengths[id] = L.teamStrength(L.eligiblePlayers(decodeForLeague(leagueView.members[id].teamData), L.cooldownsFor(id, leagueView.matches), wkStart));
        });
        var draw = L.pairMembers(ids, klas, wk, strengths);
        draw.pairs.forEach(function (p) {
          list.appendChild(fixtureRow(p[0], p[1], null));
        });
        if (draw.bye) list.appendChild(h("div", "ssc-lg-bye", memberName(draw.bye) + " is vrij dit weekend."));
        list.appendChild(h("div", "ssc-lg-note", "Voorlopig: wie zich nog inschrijft, schuift mee in de loting."));
      }
    }
    right.appendChild(list);

    // The last weekend that was played, under the coming one.
    var past = Object.keys(leagueView.matches || {}).filter(function (k) {
      return k !== wk;
    }).sort().pop();
    if (past) {
      right.appendChild(h("div", "ssc-lg-title-main ssc-lg-sub-title", "Vorige speeldag · " + past));
      var prev = h("div", "ssc-lg-fixtures");
      var pm = leagueView.matches[past].matches || {};
      Object.keys(pm).forEach(function (k) {
        prev.appendChild(fixtureRow(pm[k].user1, pm[k].user2, pm[k]));
      });
      right.appendChild(prev);
    }

    var rules = h("div", "ssc-lg-rules");
    rules.appendChild(h("b", null, "Regels"));
    rules.appendChild(h("div", null, "11 duels: jouw beste aanval tegen hun beste verdediging, en omgekeerd, de lijst af. Meeste duels gewonnen = winst."));
    rules.appendChild(h("div", null, "Een kaart die speelde, rust het volgende weekend. Toetsen ouder dan 3 maanden mogen niet meer spelen."));
    right.appendChild(rules);
    body.appendChild(right);

    managerEl.appendChild(body);

    var canSimulate = L.isWeekend(now) && !played && !!leagueView.members &&
      Object.keys(leagueView.members).length >= 2;
    renderLeagueFoot(true, canSimulate);
  }

  function renderLeagueFoot(allowed, canSimulate) {
    var foot = h("div", "ssc-tm-foot");
    var join = hi("button", "ssc-tm-btn ssc-tm-btn--league", "trophy", leagueInfo ? "Team bijwerken" : "Inschrijven");
    join.type = "button";
    join.disabled = !allowed || leagueBusy;
    join.addEventListener("click", function () {
      joinLeague();
    });
    if (allowed) foot.appendChild(join); // other classes get no league button at all

    if (canSimulate) {
      var sim = hi("button", "ssc-tm-btn ssc-tm-btn--battle", "ball", "Simuleer Weekend");
      sim.type = "button";
      sim.disabled = leagueView.busy;
      sim.addEventListener("click", simulateWeekendClick);
      foot.appendChild(sim);
    }

    var refresh = h("button", "ssc-tm-btn", "Vernieuwen");
    refresh.type = "button";
    refresh.disabled = !allowed || leagueView.loading;
    refresh.addEventListener("click", function () {
      leagueMsg = null;
      loadLeague();
    });
    foot.appendChild(refresh);

    foot.appendChild(h("span", "ssc-tm-spacer"));
    var status = h("span", "ssc-tm-status");
    if (!allowed) {
      status.textContent = league() ? league().ACCESS_MESSAGE : "";
      status.setAttribute("data-tone", "bad");
    } else if (leagueMsg) {
      status.textContent = leagueMsg.text;
      status.setAttribute("data-tone", leagueMsg.tone);
    } else if (!canSimulate && league() && !league().isWeekend(leagueNow())) {
      status.textContent = "Simuleren kan op zaterdag en zondag.";
    } else if (!leagueInfo) {
      status.textContent = "Schrijf je in om mee te spelen.";
    }
    foot.appendChild(status);
    managerEl.appendChild(foot);
  }

  function closeModal() {
    if (modalEl) modalEl.remove();
    modalEl = null;
  }

  function openModal(title, text) {
    closeModal();
    modalEl = h("div", "ssc-tm-modal");
    modalEl.addEventListener("click", function (e) {
      if (e.target === modalEl) closeModal();
    });
    modalEl.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeModal();
      }
    });
    var box = h("div", "ssc-tm-modal-box");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", title);
    box.appendChild(h("h3", "ssc-tm-modal-title", title));
    box.appendChild(h("p", "ssc-tm-modal-text", text));
    modalEl.appendChild(box);
    managerEl.appendChild(modalEl);
    return box;
  }

  function openShareModal() {
    var box = openModal(
      "Deel Team",
      "Stuur deze code naar een klasgenoot. Die plakt hem bij \"Importeer Team\" en kan dan tegen jouw team spelen."
    );
    var area = h("textarea", "ssc-tm-code");
    area.readOnly = true;
    area.value = encodeTeam();
    area.setAttribute("aria-label", "Teamcode");
    box.appendChild(area);
    var row = h("div", "ssc-tm-modal-row");
    var msg = h("span", "ssc-tm-modal-msg", myPlayers().length + " spelers · teamrating " + teamRating(myPlayers()));
    row.appendChild(msg);
    var copy = h("button", "ssc-tm-btn ssc-tm-btn--primary", "Kopieer");
    copy.type = "button";
    copy.addEventListener("click", function () {
      function fallback() {
        area.focus();
        area.select();
        var ok = false;
        try {
          ok = document.execCommand("copy");
        } catch (e) {
          ok = false;
        }
        msg.textContent = ok ? "Gekopieerd!" : "Selecteer de code en kopieer met Ctrl+C.";
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(area.value).then(function () {
          msg.textContent = "Gekopieerd!";
        }, fallback);
      } else {
        fallback();
      }
    });
    row.appendChild(copy);
    var done = h("button", "ssc-tm-btn", "Sluiten");
    done.type = "button";
    done.addEventListener("click", closeModal);
    row.appendChild(done);
    box.appendChild(row);
    area.focus();
    area.select();
  }

  function openImportModal() {
    var box = openModal("Importeer Team", "Plak hier de teamcode van je klasgenoot.");
    var area = h("textarea", "ssc-tm-code");
    area.placeholder = "eyJ2IjoxLCJuYWFtIjoi…";
    area.setAttribute("aria-label", "Teamcode van je tegenstander");
    box.appendChild(area);
    var row = h("div", "ssc-tm-modal-row");
    var msg = h("span", "ssc-tm-modal-msg", "");
    row.appendChild(msg);
    var load = h("button", "ssc-tm-btn ssc-tm-btn--primary", "Laden");
    load.type = "button";
    load.addEventListener("click", function () {
      var team = validateTeamCode(area.value);
      if (!team) {
        msg.setAttribute("data-bad", "1");
        msg.textContent = "Deze code klopt niet. Kopieer hem opnieuw, helemaal.";
        return;
      }
      opponent = team;
      var payload = {};
      payload[OPPONENT_PREFIX + (squadUser || "anon")] = { v: team.v, naam: team.naam, f: team.f, s: team.s };
      storageSet(payload);
      closeModal();
      renderManager();
    });
    row.appendChild(load);
    var cancel = h("button", "ssc-tm-btn", "Annuleren");
    cancel.type = "button";
    cancel.addEventListener("click", closeModal);
    row.appendChild(cancel);
    box.appendChild(row);
    area.focus();
  }

  /* ---------- battle (Madfut style) ---------- */

  var ATTRIBUTES = ["AANVAL", "CONTROLE", "VERDEDIGING"];
  var BATTLE_ROUNDS = 5;
  var CLOSE_GAP = 5;

  /** Random player not used yet this match; all used → everyone again. */
  function drawPlayer(players, used, rng) {
    var free = [];
    for (var i = 0; i < players.length; i++) if (!used[i]) free.push(i);
    if (!free.length) {
      for (var k in used) delete used[k];
      for (var j = 0; j < players.length; j++) free.push(j);
    }
    var pick = free[Math.floor(rng() * free.length)];
    used[pick] = true;
    return players[pick];
  }

  /**
   * Five rounds. Each round: a random player per side and a random attribute.
   * The higher rating is the favourite (1.5% per point, 10-90%), never certain.
   * Returns every round and the result, so the screen only plays it back.
   */
  function simulateBattle(mine, theirs, rng) {
    var random = rng || Math.random;
    var usedA = {};
    var usedB = {};
    var score = { me: 0, them: 0 };
    var rounds = [];
    for (var r = 0; r < BATTLE_ROUNDS && mine.length && theirs.length; r++) {
      var a = drawPlayer(mine, usedA, random);
      var b = drawPlayer(theirs, usedB, random);
      var attr = ATTRIBUTES[Math.floor(random() * ATTRIBUTES.length)];
      var diff = a.rating - b.rating;
      var close = Math.abs(diff) <= CLOSE_GAP;
      // Same curve as the league: 50% + 1.5% per rating point, never below 10% or above 90%.
      var winner = random() < Math.max(0.1, Math.min(0.9, 0.5 + diff * 0.015)) ? "me" : "them";
      score[winner]++;
      rounds.push({ me: a, them: b, attr: attr, close: close, winner: winner, score: { me: score.me, them: score.them } });
    }
    var result = score.me > score.them ? "win" : score.me < score.them ? "loss" : "draw";
    return { rounds: rounds, score: score, result: result };
  }

  function addBattlePoints(n) {
    battlePoints += n;
    var payload = {};
    payload[POINTS_PREFIX + (squadUser || "anon")] = battlePoints;
    return storageSet(payload);
  }

  function clearBattleTimers() {
    if (!battle) return;
    battle.timers.forEach(function (t) {
      window.clearTimeout(t);
    });
    battle.timers = [];
  }

  function endBattleScreen() {
    clearBattleTimers();
    battle = null;
    renderManager();
  }

  function startBattle() {
    var mine = myPlayers();
    if (!opponent || !mine.length) return;
    closeModal();
    var sim = simulateBattle(mine, opponent.players);
    battle = { sim: sim, step: -1, timers: [], done: false, awarded: false };
    renderBattle();
    nextRound();
  }

  function later(fn, ms) {
    if (!battle) return;
    var b = battle;
    b.timers.push(window.setTimeout(function () {
      if (battle === b) fn();
    }, ms));
  }

  function renderBattle() {
    managerEl.textContent = "";
    var sim = battle.sim;
    var mine = myPlayers();
    var root = h("div", "ssc-bt");

    var head = h("div", "ssc-bt-head");
    var a = h("div", "ssc-bt-team");
    a.appendChild(h("div", "ssc-bt-team-name", "Jij"));
    a.appendChild(h("div", "ssc-bt-team-sub", "teamrating " + teamRating(mine) + " · " + squad.formation));
    head.appendChild(a);
    var score = h("div", "ssc-bt-score", "0 – 0");
    head.appendChild(score);
    var b = h("div", "ssc-bt-team");
    b.appendChild(h("div", "ssc-bt-team-name", opponent.naam));
    b.appendChild(h("div", "ssc-bt-team-sub", "teamrating " + teamRating(opponent.players) + " · " + opponent.f));
    head.appendChild(b);
    root.appendChild(head);

    var body = h("div", "ssc-bt-body");
    var bySlotMine = {};
    mine.forEach(function (p) {
      bySlotMine[p.slot] = p;
    });
    var bySlotThem = {};
    opponent.players.forEach(function (p) {
      bySlotThem[p.slot] = p;
    });
    var pitchMine = buildPitch(squad.formation, function (e) {
      return bySlotMine[e.key] || null;
    }, null, "ssc-bt-pitch");
    var pitchThem = buildPitch(opponent.f, function (e) {
      return bySlotThem[e.key] || null;
    }, null, "ssc-bt-pitch");

    var stage = h("div", "ssc-bt-stage");
    var roundLabel = h("div", "ssc-bt-round", "");
    var attr = h("div", "ssc-bt-attr", "");
    var vs = h("div", "ssc-bt-vs");
    var verdict = h("div", "ssc-bt-verdict", "");
    var note = h("div", "ssc-bt-note", "");
    stage.appendChild(roundLabel);
    stage.appendChild(attr);
    stage.appendChild(vs);
    stage.appendChild(verdict);
    stage.appendChild(note);

    body.appendChild(pitchMine);
    body.appendChild(stage);
    body.appendChild(pitchThem);
    root.appendChild(body);

    var foot = h("div", "ssc-bt-foot");
    var skip = h("button", "ssc-tm-btn", "Overslaan");
    skip.type = "button";
    skip.addEventListener("click", function () {
      clearBattleTimers();
      battle.step = sim.rounds.length - 1;
      showResult();
    });
    foot.appendChild(skip);
    var back = h("button", "ssc-tm-btn", "Terug naar team");
    back.type = "button";
    back.addEventListener("click", function () {
      // Leaving early still counts the match: the outcome was decided at kick-off.
      awardOnce();
      endBattleScreen();
    });
    foot.appendChild(back);
    root.appendChild(foot);

    managerEl.appendChild(root);
    battle.ui = {
      root: root, score: score, pitchMine: pitchMine, pitchThem: pitchThem,
      roundLabel: roundLabel, attr: attr, vs: vs, verdict: verdict, note: note, skip: skip,
    };
  }

  function markSlot(pitch, slot, state) {
    var node = pitch.querySelector("[data-slot='" + slot + "']");
    if (!node) return;
    if (state === "active") node.setAttribute("data-active", "1");
    else {
      node.removeAttribute("data-active");
      node.setAttribute("data-played", "1");
    }
  }

  function nextRound() {
    if (!battle) return;
    var sim = battle.sim;
    battle.step++;
    if (battle.step >= sim.rounds.length) {
      showResult();
      return;
    }
    var round = sim.rounds[battle.step];
    var ui = battle.ui;
    ui.roundLabel.textContent = "Ronde " + (battle.step + 1) + " / " + sim.rounds.length;
    ui.verdict.textContent = "";
    ui.verdict.removeAttribute("data-who");
    ui.note.textContent = "";
    markSlot(ui.pitchMine, round.me.slot, "active");
    markSlot(ui.pitchThem, round.them.slot, "active");

    // Attribute "roulette", then it lands on the round's attribute.
    ui.attr.classList.add("spin");
    var spin = 0;
    (function tick() {
      if (!battle || battle.ui !== ui) return;
      ui.attr.textContent = ATTRIBUTES[spin++ % ATTRIBUTES.length];
      if (spin < 8) later(tick, 90);
      else {
        ui.attr.classList.remove("spin");
        ui.attr.textContent = round.attr;
      }
    })();

    ui.vs.textContent = "";
    var left = h("div", "ssc-bt-fighter in-left");
    left.appendChild(miniCard(round.me));
    var right = h("div", "ssc-bt-fighter in-right");
    right.appendChild(miniCard(round.them));
    ui.vs.appendChild(left);
    ui.vs.appendChild(h("div", "ssc-bt-vs-mark", "VS"));
    ui.vs.appendChild(right);

    later(function () {
      var meWon = round.winner === "me";
      left.classList.add(meWon ? "won" : "lost");
      right.classList.add(meWon ? "lost" : "won");
      ui.verdict.setAttribute("data-who", round.winner);
      ui.verdict.textContent = meWon ? "Jij wint deze ronde!" : opponent.naam + " wint deze ronde.";
      ui.note.textContent = round.close
        ? round.me.rating + " vs " + round.them.rating + " · te dicht bij elkaar: opgooien beslist"
        : round.me.rating + " vs " + round.them.rating + " · hoogste rating wint";
      ui.score.textContent = round.score.me + " – " + round.score.them;
      ui.score.classList.remove("pop");
      void ui.score.offsetWidth;
      ui.score.classList.add("pop");
    }, 1300);

    later(function () {
      markSlot(ui.pitchMine, round.me.slot, "played");
      markSlot(ui.pitchThem, round.them.slot, "played");
      nextRound();
    }, 2900);
  }

  function awardOnce() {
    if (!battle || battle.awarded) return;
    battle.awarded = true;
    addBattlePoints(POINTS_FOR[battle.sim.result] || 0);
  }

  function showResult() {
    if (!battle || battle.done) return;
    battle.done = true;
    var sim = battle.sim;
    var ui = battle.ui;
    awardOnce();
    ui.score.textContent = sim.score.me + " – " + sim.score.them;
    ui.skip.disabled = true;

    var word = sim.result === "win" ? "WINST" : sim.result === "loss" ? "VERLIES" : "GELIJKSPEL";
    var overlay = h("div", "ssc-bt-result");
    var w = h("div", "ssc-bt-result-word", word);
    w.setAttribute("data-r", sim.result);
    overlay.appendChild(w);
    overlay.appendChild(h("div", "ssc-bt-result-score", "Jij " + sim.score.me + " – " + sim.score.them + " " + opponent.naam));
    var gained = POINTS_FOR[sim.result] || 0;
    overlay.appendChild(h(
      "div",
      "ssc-bt-result-points",
      "+" + gained + " battlepunten · totaal " + battlePoints
    ));
    var row = h("div", "ssc-tm-modal-row");
    var again = h("button", "ssc-tm-btn ssc-tm-btn--battle", "Opnieuw spelen");
    again.type = "button";
    again.addEventListener("click", function () {
      clearBattleTimers();
      battle = null;
      startBattle();
    });
    row.appendChild(again);
    var back = h("button", "ssc-tm-btn", "Terug naar team");
    back.type = "button";
    back.addEventListener("click", endBattleScreen);
    row.appendChild(back);
    overlay.appendChild(row);
    ui.root.appendChild(overlay);
  }

  /* ---------- open / close ---------- */

  function ensureManager() {
    var host = document.getElementById("ssc-root");
    if (!host || !host.shadowRoot) return null;
    var layer = host.shadowRoot.querySelector(".ssc-layer");
    if (!layer) return null;
    ensureManagerStyle(host.shadowRoot);
    ensureStyle();

    if (!managerEl || !managerEl.isConnected) {
      managerEl = document.createElement("div");
      managerEl.id = "ssc-team-overlay";
      managerEl.setAttribute("role", "dialog");
      managerEl.setAttribute("aria-modal", "true");
      managerEl.setAttribute("aria-label", "Mijn Team");
      managerEl.setAttribute("data-open", "0");
      layer.appendChild(managerEl);
    }
    return managerEl;
  }

  function applyClassAverages() {
    managerCards = decorate(managerGrades, classAvgMap).cards;
    renderManager();
  }

  function sscTeamOpen(retries) {
    var el = ensureManager();
    if (!el) {
      // The shadow host is built by content.js after its page-quiet wait. A
      // click in the sub-nav before that would otherwise do nothing at all,
      // which is the "missing gear" symptom in a new place. Bounded, so a
      // page where the host never appears cannot spin forever.
      var left = typeof retries === "number" ? retries : 12;
      if (left <= 0) return false;
      window.setTimeout(function () {
        sscTeamOpen(left - 1);
      }, 250);
      return false;
    }
    el.setAttribute("data-open", "1");
    document.documentElement.setAttribute("data-ssc-team-open", "1");
    selectedCard = null;
    selectedSlot = null;
    leagueMsg = null;
    managerTab = "team";
    clearBattleTimers();
    battle = null;

    readSquad().then(function () {
      if (typeof window.sscFetchGrades !== "function") return;
      window.sscFetchGrades().then(
        function (grades) {
          managerGrades = Array.isArray(grades) ? grades : [];
          var first = true;
          loadClassAverages(managerGrades, function (map, pending) {
            classAvgMap = map;
            classAvgPending = pending;
            if (first) {
              first = false;
              managerCards = decorate(managerGrades, classAvgMap).cards;
              if (!Object.keys(squad.slots).length) autoFill();
              renderManager();
              // The class table also tells which cards rest this weekend.
              if (leagueAllowed()) loadLeague();
            } else {
              applyClassAverages();
            }
          });
        },
        function () {
          managerCards = [];
          renderManager();
        }
      );
    });
    return true;
  }

  function closeManager() {
    clearBattleTimers();
    battle = null;
    closeModal();
    if (managerEl) managerEl.setAttribute("data-open", "0");
    document.documentElement.removeAttribute("data-ssc-team-open");
  }

  function sscTeamClose() {
    closeManager();
  }

  // For tests in the console: the exact formula and the code round trip.
  window.sscTeamDebug = {
    futRating: futRating,
    encode: function (team) {
      return toBase64(JSON.stringify(team));
    },
    decode: validateTeamCode,
    simulate: simulateBattle,
    tendency: classAvgFromDetail,
  };

  /* The full-screen manager is a child of the shadow layer, so a layer
     rebuild detaches it. Forget it and rebuild the nav item in the new bar. */
  var previousLayerHookTeam = window.sscOnLayerRemount;
  window.sscOnLayerRemount = function (layer) {
    if (previousLayerHookTeam) {
      try {
        previousLayerHookTeam(layer);
      } catch (e) {
        /* Another module's failure is not ours. */
      }
    }
    var wasOpen = managerEl && managerEl.getAttribute("data-open") === "1";
    managerEl = null;
    if (wasOpen) sscTeamOpen();
  };

  window.sscTeamRender = sscTeamRender;
  window.sscTeamOpen = sscTeamOpen;
  window.sscTeamClose = sscTeamClose;
  window.sscTeamPositions = SSC_SUBJECT_POSITIONS;
  window.sscTeamPositionFor = positionFor;

})();
