/**
 * Smartschool Combined — the "Gezien" flow.
 *
 * What this replaces:
 *   Old versions 01 and 02 polled the page with setInterval every 400ms and
 *   rebuilt their own grade cards. Both are gone. This file never wraps,
 *   replaces or moves a Smartschool element: it finds the row that already
 *   exists and inserts one <label> checkbox after it.
 *
 * The flow:
 *   1. On the Resultaten page, every grade that has a number gets a small
 *      "Gezien" checkbox, blended into the row.
 *   2. Any grade whose box is UNCHECKED plays its cutscene automatically,
 *      one after another, when the page settles.
 *   3. Finishing a cutscene ticks the box (and writes sscSeen).
 *   4. Unticking a box only writes storage. Nothing plays: the grade joins
 *      the queue the NEXT time Resultaten is opened, like any unseen grade.
 *      Playing on uncheck used to fire the cutscene for a grade captured at
 *      injection time, which is how the wrong card could appear after the
 *      detail view re-rendered the list.
 *
 * Storage is the sscSeen map from settings.js — one key per grade id, under
 * the current user id. The panel's checklist reads the same map, so the two
 * never disagree.
 */
(function () {
  "use strict";

  // Sign-in pages: do nothing at all (see guard.js).
  if (window.sscSkipPage) return;

  if (window.sscWalkoutStart) return;

  var STYLE_ID = "ssc-seen-style";
  var TOGGLE_CLASS = "ssc-seen-toggle";
  var ID_ATTR = "data-ssc-grade-id";

  var GAP_MS = 250;
  var SCAN_DEBOUNCE_MS = 300;

  var queue = {
    running: false,
    list: [],
    index: 0,
    aborted: false,
  };

  var audioGated = false;

  /* ---------- small helpers ---------- */

  function shadowLayer() {
    var host = document.getElementById("ssc-root");
    if (!host || !host.shadowRoot) return null;
    return host.shadowRoot.querySelector(".ssc-layer");
  }

  function container() {
    // CLAUDE.md: observe <main> rather than document.body.
    return document.querySelector("main") || document.body;
  }

  /**
   * The grades API answers on every page, but fetching it on the homepage
   * would be a request for nothing and a queue start where there is nothing
   * to show. Smartschool's results view lives under a "results" URL.
   */
  function isResultsPage() {
    var href = String(location.href || "");
    var hash = String(location.hash || "");
    return /result/i.test(href) || /result/i.test(hash);
  }

  function seenIds() {
    return typeof window.sscGetSeen === "function" ? window.sscGetSeen() : Promise.resolve({});
  }

  function markSeen(id) {
    if (typeof window.sscMarkSeen === "function") return window.sscMarkSeen(id);
    return Promise.resolve({});
  }

  function markUnseen(id) {
    if (typeof window.sscMarkUnseen === "function") return window.sscMarkUnseen(id);
    return Promise.resolve({});
  }

  function onTwenty(g) {
    if (!g) return null;
    if (typeof g.ruweScore === "number" && typeof g.ruweMax === "number" && g.ruweMax > 0) {
      return typeof window.sscGradeToTwenty === "function"
        ? window.sscGradeToTwenty(g.ruweScore, g.ruweMax)
        : Math.round((g.ruweScore / g.ruweMax) * 20 * 10) / 10;
    }
    if (typeof g.percentage === "number") {
      return Math.round((g.percentage / 100) * 20 * 10) / 10;
    }
    return null;
  }

  function dateValue(datum) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(datum || ""));
    if (m) return Number(m[3] + m[2] + m[1]);
    return 0;
  }

  function normalise(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^\x20-\x7e]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  /* ---------- checkbox styling ---------- */

  /**
   * Light-DOM stylesheet, appended to documentElement (never body).
   *
   * Every selector is scoped to our own class, so nothing here can reach a
   * Smartschool element. No !important: the rule only needs to beat the
   * default label styling of whatever row it lands in, and the row styles are
   * on the row, not on a bare label.
   */
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "." + TOGGLE_CLASS + "{",
      "  display:inline-flex;align-items:center;gap:6px;margin:6px 0 0 4px;",
      "  padding:2px 7px 2px 5px;border-radius:999px;vertical-align:middle;",
      "  font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:11px;",
      "  line-height:1.6;color:#6b7787;background:rgba(120,135,155,.12);",
      "  border:1px solid rgba(120,135,155,.28);cursor:pointer;user-select:none;",
      "  transition:background-color 140ms ease,border-color 140ms ease,color 140ms ease;",
      "}",
      "." + TOGGLE_CLASS + ":hover{background:rgba(120,135,155,.22);border-color:rgba(120,135,155,.45);}",
      "." + TOGGLE_CLASS + " input{",
      "  width:12px;height:12px;margin:0;accent-color:#4a9d76;cursor:pointer;",
      "}",
      "." + TOGGLE_CLASS + "[data-seen='1']{color:#3f7f60;background:rgba(88,170,128,.14);",
      "  border-color:rgba(88,170,128,.42);}",
      "@media (prefers-color-scheme:dark){",
      "  ." + TOGGLE_CLASS + "{color:#9aa7b8;background:rgba(160,175,195,.1);",
      "    border-color:rgba(160,175,195,.22);}",
      "}",
      "@media (prefers-reduced-motion:reduce){",
      "  ." + TOGGLE_CLASS + "{transition:none;}",
      "}",
    ].join("\n");
    document.documentElement.appendChild(style);
  }

  /* ---------- finding the rows ---------- */

  var FRACTION = /(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/;

  /**
   * Innermost elements whose text carries a score, paired with the row-like
   * ancestor above each one.
   *
   * A results table renders the score once per row, usually in its own cell;
   * the element that holds the fraction and nothing else is the one to climb
   * from, and it is also where the checkbox belongs. Climbing stops at a
   * tr/li/article, or at the first ancestor whose text is long enough to be a
   * whole row.
   *
   * Returns [{ row, score }].
   */
  function findRows(root) {
    if (!root) return [];

    var all = root.querySelectorAll("td, span, div, strong, b, a, p");
    var scoreNodes = [];

    for (var i = 0; i < all.length; i++) {
      var node = all[i];
      if (node.closest("script, style, noscript, ." + TOGGLE_CLASS)) continue;
      if (node.querySelector("td, span, div, strong, b")) continue; // not innermost
      var text = (node.textContent || "").trim();
      if (!text || text.length > 40) continue;
      if (!FRACTION.test(text)) continue;
      scoreNodes.push(node);
    }

    var found = [];
    var seenRows = [];

    for (var j = 0; j < scoreNodes.length; j++) {
      var score = scoreNodes[j];
      var row = score.closest("tr, li, article");

      if (!row) {
        var up = score.parentElement;
        var guard = 0;
        while (up && guard++ < 6) {
          var rowText = (up.textContent || "").replace(/\s+/g, " ").trim();
          if (rowText.length >= 12 && rowText.length <= 600) break;
          up = up.parentElement;
        }
        row = up;
      }

      if (!row || row === document.body || row === document.documentElement) continue;
      if (seenRows.indexOf(row) !== -1) continue;

      seenRows.push(row);
      found.push({ row: row, score: score });
    }

    return found;
  }

  /**
   * Ties a page row to an API grade. Score text is the strongest signal;
   * the subject name breaks ties when a page shows 15/20 three times.
   */
  function gradeForRow(row, grades) {
    var raw = (row.textContent || "").replace(/\s+/g, " ").trim();
    var m = FRACTION.exec(raw);
    if (!m) return null;

    var achieved = m[1].replace(",", ".");
    var total = m[2].replace(",", ".");
    var haystack = normalise(raw);

    var scored = [];
    for (var i = 0; i < grades.length; i++) {
      var g = grades[i];
      if (typeof g.ruweScore !== "number" || typeof g.ruweMax !== "number") continue;
      if (String(g.ruweScore).replace(".", ",") !== achieved.replace(".", ",")) continue;
      if (String(g.ruweMax).replace(".", ",") !== total.replace(".", ",")) continue;

      var score = 1;
      var vak = normalise(g.vak);
      if (vak && haystack.indexOf(vak) !== -1) score += 10;
      var titel = normalise(g.titel);
      if (titel && titel.length > 3 && haystack.indexOf(titel) !== -1) score += 6;
      scored.push({ grade: g, score: score });
    }

    if (!scored.length) return null;
    scored.sort(function (a, b) {
      return b.score - a.score;
    });
    return scored[0].grade;
  }

  /**
   * Inserts one checkbox per grade, as a sibling right after the row's score
   * cell — never wrapping, never replacing. An existing checkbox for the same
   * id (a re-render, or a second scan) is left alone.
   */
  function injectToggles(grades, seen) {
    if (!Array.isArray(grades) || !grades.length) return 0;
    ensureStyle();

    var rows = findRows(container());
    var added = 0;
    var claimed = {};

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i].row;
      var grade = gradeForRow(row, grades);
      if (!grade || !grade.id || claimed[grade.id]) continue;
      claimed[grade.id] = true;

      var existing = document.querySelector('[data-ssc-seen-for="' + cssEscape(grade.id) + '"]');
      if (existing && row.contains(existing)) {
        syncToggle(existing, !!seen[grade.id]);
        continue;
      }
      // A box for this id exists, but it now sits in a row that displays a
      // different grade (Smartschool re-rendered after the detail view
      // opened). Its change handler still closes over the OLD grade object —
      // exactly how un-ticking "this" row could reveal "that" card. Drop the
      // stale box and let this loop build a fresh one in the right row.
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

      // Right after the score itself, so the box reads as part of that cell
      // rather than as a new row underneath the card.
      var anchor = rows[i].score || row;
      var toggle = buildToggle(grade, !!seen[grade.id]);
      if (anchor.parentNode) anchor.parentNode.insertBefore(toggle, anchor.nextSibling);
      else anchor.appendChild(toggle);
      added++;
    }

    return added;
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function buildToggle(grade, isSeen) {
    var label = document.createElement("label");
    label.className = TOGGLE_CLASS;
    label.setAttribute(ID_ATTR, grade.id);
    label.setAttribute("data-ssc-seen-for", grade.id);
    label.setAttribute("data-seen", isSeen ? "1" : "0");
    label.title = "Gezien — vink uit om de cutscene opnieuw te spelen";

    var box = document.createElement("input");
    box.type = "checkbox";
    box.checked = isSeen;
    box.setAttribute(ID_ATTR, grade.id);
    label.appendChild(box);
    label.appendChild(document.createTextNode("Gezien"));

    box.addEventListener("change", function (e) {
      // The checkbox lives in Smartschool's DOM; a bubbling change event would
      // otherwise reach their handlers.
      e.stopPropagation();
      var id = grade.id;
      if (box.checked) {
        markSeen(id);
        syncToggle(label, true);
        return;
      }
      // Un-ticking ONLY updates stored state. The card is not played here:
      // it plays the next time Resultaten is opened, from a fresh fetch, so
      // the revealed grade can never be a stale object captured at
      // injection time.
      markUnseen(id);
      syncToggle(label, false);
    });

    label.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    return label;
  }

  function syncToggle(node, isSeen) {
    if (!node) return;
    var box = node.querySelector ? node.querySelector("input") : null;
    if (box) box.checked = isSeen;
    node.setAttribute("data-seen", isSeen ? "1" : "0");
  }

  /** Keeps every checkbox in step with storage, including the panel's. */
  function syncAll(seen) {
    var nodes = document.querySelectorAll("[data-ssc-seen-for]");
    for (var i = 0; i < nodes.length; i++) {
      var id = nodes[i].getAttribute(ID_ATTR);
      syncToggle(nodes[i], !!(seen && seen[id]));
    }
  }

  /* ---------- audio gate ---------- */

  /**
   * One "Klik om te beginnen" screen per page load, and only when sound is on.
   * An AudioContext may not start without a gesture, so without this the
   * whole queue would be silent.
   */
  function showAudioGate() {
    var layer = shadowLayer();
    if (!layer) return Promise.resolve(false);

    return new Promise(function (resolve) {
      var overlay = document.createElement("div");
      overlay.className = "ssc-gate";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", "Geluid aanzetten");

      var box = document.createElement("div");
      box.className = "ssc-gate-box";
      box.appendChild(textEl("h2", "ssc-gate-title", "Cijfers onthuld"));
      box.appendChild(
        textEl(
          "p",
          "ssc-gate-text",
          "Klik om te beginnen. Daarna heb je geluid bij elke kaart."
        )
      );

      var go = document.createElement("button");
      go.type = "button";
      go.className = "ssc-gate-btn";
      go.textContent = "Klik om te beginnen";
      box.appendChild(go);

      var mute = document.createElement("button");
      mute.type = "button";
      mute.className = "ssc-gate-mute";
      mute.textContent = "Verder zonder geluid";
      box.appendChild(mute);

      overlay.appendChild(box);
      layer.appendChild(overlay);

      function finish(withSound) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (withSound && typeof window.sscUnlockAudio === "function") {
          window.sscUnlockAudio();
        }
        audioGated = true;
        resolve(withSound);
      }

      go.addEventListener("click", function () {
        finish(true);
      });
      mute.addEventListener("click", function () {
        finish(false);
      });
    });
  }

  function textEl(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    node.textContent = text;
    return node;
  }

  function ensureGateStyle() {
    var layer = shadowLayer();
    if (!layer) return;
    var shadow = layer.getRootNode();
    if (!shadow || !shadow.querySelector) return;
    if (shadow.querySelector("style[data-ssc-gate]")) return;

    var style = document.createElement("style");
    style.setAttribute("data-ssc-gate", "1");
    style.textContent = [
      ".ssc-gate{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;",
      "  padding:24px;background:rgba(7,9,13,.9);backdrop-filter:blur(10px);pointer-events:auto;",
      "  font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#f5f7fa;}",
      ".ssc-gate-box{max-width:420px;padding:32px 28px;border-radius:16px;text-align:center;",
      "  border:1px solid rgba(255,255,255,.12);background:linear-gradient(160deg,#1b2432,#10161f);",
      "  box-shadow:0 28px 70px rgba(0,0,0,.55);}",
      ".ssc-gate-title{margin:0 0 10px;font-size:22px;font-weight:650;}",
      ".ssc-gate-text{margin:0 0 22px;color:#b6c1d0;font-size:14px;line-height:1.55;}",
      ".ssc-gate-btn,.ssc-gate-mute{display:block;width:100%;min-height:44px;margin-top:10px;",
      "  border-radius:9px;font:inherit;font-size:14px;cursor:pointer;}",
      ".ssc-gate-btn{border:1px solid #e4eaf3;background:#e4eaf3;color:#121720;font-weight:600;}",
      ".ssc-gate-btn:hover{background:#fff;}",
      ".ssc-gate-mute{border:1px solid rgba(255,255,255,.16);background:transparent;color:#aab6c6;}",
      ".ssc-gate-mute:hover{background:rgba(255,255,255,.06);}",
    ].join("\n");
    shadow.appendChild(style);
  }

  /* ---------- the queue ---------- */

  function orderGrades(grades, order) {
    var copy = grades.slice();
    copy.sort(function (a, b) {
      var da = dateValue(a.datum);
      var db = dateValue(b.datum);
      if (order === "oldest") return da - db;
      if (da === db) return 0;
      return db - da; // newest first
    });
    return copy;
  }

  /**
   * Plays one grade's cutscene with the queue plumbing attached.
   * `ctx` is { index, total, onDone, onStop } — omitted for a single replay.
   */
  function play(grade, ctx) {
    var context = ctx || {};
    var twenty = onTwenty(grade);
    if (twenty === null) {
      if (context.onDone) context.onDone();
      return;
    }

    if (typeof window.sscPlayCutscene !== "function") {
      if (context.onDone) context.onDone();
      return;
    }

    window.sscPlayCutscene({
      grade: twenty,
      percent: typeof grade.percentage === "number" ? grade.percentage : undefined,
      vak: grade.vak || "",
      titel: grade.titel || "",
      datum: grade.datum || "",
      periode: grade.periode || "",
      score: grade.ruweScore,
      max: grade.ruweMax,
      type: grade.type || "",
      index: context.index || 0,
      total: context.total || 0,
      hasNext: !!(context.total && context.index < context.total),
      sound: context.sound !== false,
      onComplete: function () {
        if (grade.id) markSeen(grade.id);
        syncAllById(grade.id, true);
      },
      onStop: function () {
        queue.aborted = true;
      },
      // Queue only: "Skip alles" marks this grade and every one still waiting
      // as seen, in one write, and ends the queue. Nothing else plays.
      onSkipAll: context.total
        ? function () {
            skipAllRemaining(grade);
          }
        : undefined,
      onClose: function () {
        if (context.onDone) context.onDone();
      },
    });
  }

  function skipAllRemaining(current) {
    queue.aborted = true;
    var ids = [];
    if (current && current.id) ids.push(current.id);
    for (var i = queue.index; i < queue.list.length; i++) {
      if (queue.list[i] && queue.list[i].id) ids.push(queue.list[i].id);
    }
    if (!ids.length || typeof window.sscGetSeen !== "function") return;
    window.sscGetSeen().then(function (map) {
      var next = Object.assign({}, map || {});
      var now = Date.now();
      for (var j = 0; j < ids.length; j++) if (!next[ids[j]]) next[ids[j]] = now;
      return window.sscSetSeen(next);
    }).then(function () {
      for (var k = 0; k < ids.length; k++) syncAllById(ids[k], true);
    });
  }

  function syncAllById(id, isSeen) {
    var nodes = document.querySelectorAll('[data-ssc-seen-for="' + cssEscape(id) + '"]');
    for (var i = 0; i < nodes.length; i++) syncToggle(nodes[i], isSeen);
  }

  function step() {
    if (queue.aborted || queue.index >= queue.list.length) {
      finishQueue();
      return;
    }

    var grade = queue.list[queue.index];
    var index = queue.index;
    queue.index++;

    play(grade, {
      index: index + 1,
      total: queue.list.length,
      sound: queue.sound,
      onDone: function () {
        if (queue.aborted || queue.index >= queue.list.length) {
          finishQueue();
          return;
        }
        // A short breath between cards, so two cutscenes never read as one.
        window.setTimeout(step, GAP_MS);
      },
    });
  }

  function finishQueue() {
    liftPreload();
    queue.running = false;
    queue.list = [];
    queue.index = 0;
    queue.aborted = false;
  }

  /**
   * "Alles weer als ongelezen" in the panel: clear the map and start the
   * queue again, without a page reload.
   */
  function sscWalkoutRequeue() {
    if (queue.running) return;
    if (!lastSettings || !state.grades.length) return;
    seenIds().then(function (seen) {
      state.seen = seen || {};
      syncAll(state.seen);
      maybeStart(lastSettings, state.grades, state.seen);
    });
  }

  /**
   * Entry point after the page settles.
   *
   * @param {Object} settings  sscSettings
   * @param {Array}  grades    normalised API grades
   * @param {Object} seen      sscSeen map
   */
  /** Lifts preload.js's cover (document_start). Safe to call repeatedly. */
  function liftPreload(delay) {
    if (typeof window.sscPreloadDone === "function") window.sscPreloadDone(delay);
  }

  function maybeStart(settings, grades, seen) {
    if (!settings || !settings.cutsceneAuto) return liftPreload();

    var pending = grades.filter(function (g) {
      if (!g.id) return false;
      if (seen[g.id]) return false;
      return onTwenty(g) !== null;
    });

    if (!pending.length) return liftPreload();

    var ordered = orderGrades(pending, settings.queueOrder);

    var soundOn = settings.cutsceneSound !== false;

    function begin(withSound) {
      queue.running = true;
      queue.list = ordered;
      queue.index = 0;
      queue.aborted = false;
      queue.sound = withSound;

      // The preload cover stays up for the whole queue (cutscenes draw above
      // it), so no unseen grade shows before, between or behind the cards.
      // finishQueue() lifts it; until then its failsafe timer is paused.
      if (typeof window.sscPreloadHold === "function") window.sscPreloadHold();
      // One frame so the gate (if any) is gone before the overlay mounts.
      window.requestAnimationFrame(step);
    }

    if (!soundOn) {
      begin(false);
      return;
    }
    if (audioGated) {
      begin(true);
      return;
    }

    ensureGateStyle();
    showAudioGate().then(function (withSound) {
      begin(withSound);
    });
  }

  /* ---------- first install ---------- */

  /**
   * The very first run marks everything already on the page as seen, so the
   * user is not greeted with a queue of thirty old grades. One toast, once.
   */
  function firstRun(grades) {
    if (typeof window.sscSeenInitialized !== "function") return Promise.resolve(false);

    return window.sscSeenInitialized().then(function (done) {
      if (done) return false;

      var map = {};
      for (var i = 0; i < grades.length; i++) {
        if (grades[i].id) map[grades[i].id] = Date.now();
      }

      return Promise.resolve(window.sscSetSeen(map))
        .then(function () {
          return window.sscSetSeenInitialized();
        })
        .then(function () {
          toast("Eerste keer: alle bestaande cijfers gemarkeerd als gezien");
          return true;
        });
    });
  }

  function toast(message) {
    var layer = shadowLayer();
    if (!layer) return;
    if (!layer.getRootNode().querySelector("style[data-ssc-toast]")) {
      var style = document.createElement("style");
      style.setAttribute("data-ssc-toast", "1");
      style.textContent = [
        ".ssc-toast{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);",
        "  z-index:2147482999;max-width:min(520px,90vw);padding:12px 18px;border-radius:10px;",
        "  border:1px solid rgba(255,255,255,.14);background:rgba(18,24,33,.96);color:#eef3f9;",
        "  font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:13px;line-height:1.5;",
        "  box-shadow:0 16px 40px rgba(0,0,0,.45);pointer-events:auto;opacity:0;",
        "  transition:opacity 240ms ease,transform 240ms ease;}",
        ".ssc-toast[data-in='1']{opacity:1;transform:translateX(-50%) translateY(-6px);}",
      ].join("\n");
      layer.getRootNode().appendChild(style);
    }

    var node = textEl("div", "ssc-toast", message);
    layer.appendChild(node);
    window.requestAnimationFrame(function () {
      node.setAttribute("data-in", "1");
    });
    window.setTimeout(function () {
      node.removeAttribute("data-in");
      window.setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 300);
    }, 6000);
  }

  /* ---------- loading overlay (Bug 11) ---------- */

  /**
   * A full-screen blur over the CONTENT area while the Resultaten page
   * settles. The topbar is deliberately left uncovered: it is the only way
   * into the panel, and a loader that blocks settings turns a slow page into
   * a locked page.
   *
   * `sscLoadingStage` is the public stage string; the loader reads it and the
   * dismissal rule is "everything that is needed before the first card exists
   * has been done".
   */
  var LOADER_ID = "ssc-loader";
  var loaderEl = null;
  var loaderStatusEl = null;
  var loaderSlowEl = null;
  var loaderErrorEl = null;
  var loaderStartedAt = 0;
  var loaderHideTimer = null;
  var loaderFailTimer = null;
  var loaderRetry = null;

  window.sscLoadingStage = "";

  function setStage(stage) {
    window.sscLoadingStage = stage || "";
    if (loaderStatusEl) loaderStatusEl.textContent = stage || "";
  }

  function ensureLoaderStyle() {
    var layer = shadowLayer();
    if (!layer) return;
    var root = layer.getRootNode();
    if (!root || !root.querySelector || root.querySelector("style[data-ssc-loader]")) return;
    var style = document.createElement("style");
    style.setAttribute("data-ssc-loader", "1");
    style.textContent = [
      /*
       * Sits BELOW the panel and the calculator (z-index 2/3 in content.js's
       * stylesheet) on purpose: the loader must cover Smartschool's content,
       * never our own UI. A user who opens settings while the page is still
       * loading must be able to use it.
       */
      "#" + LOADER_ID + "{",
      "  position:fixed;left:0;right:0;bottom:0;z-index:1;",
      "  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;",
      "  background:rgba(0,0,0,.55);backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);",
      "  pointer-events:auto;opacity:0;transition:opacity 300ms ease;",
      "  font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#f2f6fa;text-align:center;padding:24px;",
      "}",
      "#" + LOADER_ID + "[data-in='1']{opacity:1;}",
      "#" + LOADER_ID + "[data-out='1']{opacity:0;pointer-events:none;}",
      ".ssc-loader-ring{",
      "  width:46px;height:46px;border-radius:50%;",
      "  border:3px solid rgba(255,255,255,.2);border-top-color:#fff;",
      "  animation:ssc-loader-spin .9s linear infinite;",
      "}",
      "@keyframes ssc-loader-spin{to{transform:rotate(360deg);}}",
      ".ssc-loader-title{font-size:17px;font-weight:650;}",
      ".ssc-loader-status{font-size:12.5px;color:#b9c6d4;min-height:1.2em;}",
      ".ssc-loader-slow{font-size:12px;font-style:italic;color:#9fadb9;}",
      ".ssc-loader-error{display:none;flex-direction:column;align-items:center;gap:12px;font-size:14px;}",
      ".ssc-loader-error[data-on='1']{display:flex;}",
      ".ssc-loader-retry{",
      "  font:inherit;font-size:13px;font-weight:650;padding:8px 16px;border-radius:9px;",
      "  border:1px solid #dbe6f0;background:#dbe6f0;color:#121720;cursor:pointer;",
      "}",
      "@media (prefers-reduced-motion:reduce){",
      "  .ssc-loader-ring{animation-duration:2.6s;}",
      "  #" + LOADER_ID + "{transition:none;}",
      "}",
    ].join("\n");
    root.appendChild(style);
  }

  /** Measured, not guessed: Smartschool's bar changes height per build. */
  function topbarHeight() {
    var bar =
      document.querySelector("nav.topnav") ||
      document.querySelector(".smsc-topnav");
    if (!bar) return 0;
    var rect = bar.getBoundingClientRect();
    return rect.height > 0 ? Math.round(rect.bottom) : 0;
  }

  /**
   * Set when a load starts before the shadow host exists. The prefetch runs
   * at document_idle, but the host is only built after content.js's
   * quiet-wait — so the overlay has to be re-requested once it is up, or the
   * whole "blur until loaded" requirement silently does nothing on a cold
   * start (the exact case Bug 11 describes).
   */
  var loaderPending = false;

  function showLoader(retry) {
    var layer = shadowLayer();
    loaderRetry = retry || loaderRetry;
    if (!layer) {
      loaderPending = true;
      return;
    }
    loaderPending = false;
    ensureLoaderStyle();

    if (!loaderEl || !loaderEl.isConnected) {
      loaderEl = document.createElement("div");
      loaderEl.id = LOADER_ID;
      loaderEl.setAttribute("role", "status");
      loaderEl.setAttribute("aria-live", "polite");

      var ring = document.createElement("div");
      ring.className = "ssc-loader-ring";
      loaderEl.appendChild(ring);

      loaderEl.appendChild(textEl("div", "ssc-loader-title", "Resultaten laden…"));
      loaderStatusEl = textEl("div", "ssc-loader-status", "");
      loaderEl.appendChild(loaderStatusEl);
      loaderSlowEl = textEl("div", "ssc-loader-slow", "");
      loaderEl.appendChild(loaderSlowEl);

      loaderErrorEl = document.createElement("div");
      loaderErrorEl.className = "ssc-loader-error";
      loaderErrorEl.appendChild(
        textEl("div", null, "Het laden is mislukt. Controleer je verbinding.")
      );
      var retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.className = "ssc-loader-retry";
      retryBtn.textContent = "Opnieuw proberen";
      retryBtn.addEventListener("click", function () {
        if (typeof loaderRetry === "function") loaderRetry();
      });
      loaderErrorEl.appendChild(retryBtn);
      loaderEl.appendChild(loaderErrorEl);

      layer.appendChild(loaderEl);
    }

    loaderErrorEl.setAttribute("data-on", "0");
    loaderEl.removeAttribute("data-out");
    loaderEl.style.top = topbarHeight() + "px";
    loaderEl.setAttribute("data-in", "1");
    loaderStartedAt = Date.now();
    if (loaderStatusEl) loaderStatusEl.textContent = window.sscLoadingStage || "";

    window.clearTimeout(loaderSlowEl.__timer);
    loaderSlowEl.textContent = "";
    loaderSlowEl.__timer = window.setTimeout(function () {
      if (loaderSlowEl && loaderEl && loaderEl.getAttribute("data-in") === "1") {
        loaderSlowEl.textContent = "Dit duurt langer dan normaal…";
      }
    }, 5000);

    window.clearTimeout(loaderFailTimer);
    loaderFailTimer = window.setTimeout(function () {
      if (!loaderEl || loaderEl.getAttribute("data-in") !== "1") return;
      if (loaderErrorEl) loaderErrorEl.setAttribute("data-on", "1");
    }, 8000);
  }

  function hideLoader() {
    loaderPending = false;
    window.clearTimeout(loaderSlowEl && loaderSlowEl.__timer);
    window.clearTimeout(loaderFailTimer);
    if (!loaderEl || loaderEl.getAttribute("data-in") !== "1") return;
    // A floor of one frame, so the overlay never flashes on a warm cache.
    var waited = Date.now() - loaderStartedAt;
    var wait = waited < 120 ? 120 - waited : 0;
    window.clearTimeout(loaderHideTimer);
    loaderHideTimer = window.setTimeout(function () {
      if (!loaderEl) return;
      loaderEl.setAttribute("data-in", "0");
      loaderEl.setAttribute("data-out", "1");
      window.setTimeout(function () {
        if (loaderEl && loaderEl.parentNode) loaderEl.parentNode.removeChild(loaderEl);
        loaderEl = null;
        loaderStatusEl = null;
        loaderSlowEl = null;
        loaderErrorEl = null;
      }, 320);
    }, wait);
  }

  /* ---------- page watching ---------- */

  var observer = null;
  var scanTimer = null;
  var state = { grades: [], seen: {} };

  function scan() {
    if (!state.grades.length) return;
    seenIds().then(function (seen) {
      state.seen = seen || {};
      injectToggles(state.grades, state.seen);
    });
  }

  function scheduleScan() {
    if (scanTimer) window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(function () {
      scanTimer = null;
      scan();
    }, SCAN_DEBOUNCE_MS);
  }

  /** Only observes while the feature is on, per CLAUDE.md. */
  function watch() {
    if (observer) return;
    if (typeof MutationObserver !== "function") return;
    observer = new MutationObserver(function (records) {
      checkUrl();

      // Our own insertions must not re-trigger the scan. Records from our own
      // work have only our label in addedNodes, so inspecting addedNodes is
      // exact where inspecting `target` was not.
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        var foreign = false;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node.nodeType !== 1) continue;
          if (node.classList && node.classList.contains(TOGGLE_CLASS)) continue;
          // A wrapper inserted by Smartschool that happens to contain our
          // label is still Smartschool's change.
          foreign = true;
          break;
        }
        if (foreign) {
          scheduleScan();
          return;
        }
      }
    });
    observer.observe(container(), { childList: true, subtree: true });
  }

  function unwatch() {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  }

  var booted = false;
  var started = false;
  var lastHref = "";
  var lastSettings = null;

  /**
   * Smartschool navigates client-side, so arriving at Resultaten for the
   * first time never re-runs the content script.
   *
   * The check rides on the MutationObserver that is already watching the
   * page rather than a timer: the brief forbids the setInterval that old
   * versions used, and a URL comparison inside a callback that already fires
   * is free. `history.pushState` is deliberately NOT wrapped — a content
   * script lives in an isolated world, so a wrapper installed here would not
   * see the page's own calls anyway.
   */
  function checkUrl() {
    if (location.href === lastHref) return;
    var wasResults = /result/i.test(lastHref);
    lastHref = location.href;
    var nowResults = isResultsPage();

    if (!nowResults) {
      // Leaving Resultaten: the loader must not survive the navigation, and
      // returning later deserves a fresh fetch (Bug 11: the loader appears
      // again on SPA navigation back to Resultaten).
      if (wasResults) {
        hideLoader();
        started = false;
        pendingFetch = null;
        state.grades = [];
      }
      return;
    }

    if (!started && lastSettings) sscWalkoutStart(lastSettings);
  }

  /**
   * Bug 11 part B3: on a cold load of Resultaten, start the fetch before the
   * page-quiet wait instead of after it. Fetching touches no DOM, so it is
   * safe this early, and the loader is shown immediately so the user sees
   * progress instead of an unchanging page.
   *
   * The promise is stored, not consumed here: loadResults() picks it up so
   * there is still exactly one place that saves, injects and queues.
   */
  var pendingFetch = null;

  function prefetchOnResults() {
    if (!isResultsPage()) return;
    if (typeof window.sscFetchGrades !== "function") return;
    if (pendingFetch || started) return;

    // Audio is NOT warmed here: whether it is needed at all depends on
    // whether any grade is unseen, which is only known after the fetch
    // (CLAUDE.md: skip the preload entirely when there is nothing to reveal).
    lastHref = location.href;
    setStage("Cijfers ophalen…");
    showLoader(function () {
      started = false;
      pendingFetch = null;
      if (lastSettings) sscWalkoutStart(lastSettings);
    });

    pendingFetch = (typeof window.sscFetchGradesCached === "function"
      ? window.sscFetchGradesCached()
      : window.sscFetchGrades()
    ).then(
      function (grades) {
        return grades;
      },
      function (err) {
        pendingFetch = null;
        throw err;
      }
    );
    // A rejection nobody has attached to yet would be an unhandled rejection
    // while the page is still quiet-waiting.
    pendingFetch.catch(function () {});
  }

  if (typeof window.sscGet === "function") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", prefetchOnResults, { once: true });
    } else {
      prefetchOnResults();
    }
  }

  /**
   * Public entry: called from content.js once the page is quiet, and again
   * on every settings change.
   *
   * It is idempotent on purpose. content.js re-applies settings on every
   * keystroke in the panel; if each call re-fetched the grades we would hit
   * the API once per character typed, and if each call re-registered the
   * seen-change listener every tick would fire N times.
   */
  function sscWalkoutStart(settings) {
    var current = settings || {};
    lastSettings = current;

    if (current.cutsceneAuto === false) {
      unwatch();
      // The loader belongs to this feature; with auto-play off there is
      // nothing to wait for, so it must never stay on screen.
      hideLoader();
      liftPreload();
      started = false;
      pendingFetch = null;
      return;
    }

    if (!isResultsPage()) {
      hideLoader();
      liftPreload();
      return;
    }

    var host = container();
    if (!host) return;

    // A load requested before the shadow host existed asks for its overlay
    // again now that it does.
    if (loaderPending) showLoader(loaderRetry);

    watch();
    scheduleScan();

    // --- one-time wiring ---
    if (!booted) {
      booted = true;

      if (typeof window.sscOnSeenChange === "function") {
        window.sscOnSeenChange(function (next) {
          state.seen = next || {};
          syncAll(state.seen);
        });
      }

      lastHref = location.href;
      window.addEventListener("popstate", checkUrl);
      window.addEventListener("hashchange", checkUrl);
    }

    // --- one-time data load and queue start ---
    if (started) return;
    if (!isResultsPage()) return;
    if (typeof window.sscFetchGrades !== "function") return;
    started = true;

    loadResults(current);
  }

  /**
   * Bug 11. Three things happen in this order, and the loader is dismissed
   * only after all of them:
   *
   *   1. a cached fetch is painted immediately (warm start),
   *   2. the real fetch runs in parallel and replaces it when it lands,
   *   3. the cutscene assets are preloaded BEFORE the first card, so the
   *      overlay never waits on a decode.
   *
   * A failure keeps `started` false and shows the retry button, which is the
   * only way a user can recover without a page reload.
   */
  function loadResults(settings) {
    setStage("Cijfers ophalen…");
    showLoader(function () {
      started = false;
      if (lastSettings) sscWalkoutStart(lastSettings);
    });

    var haveCache = typeof window.sscGetGradesCache === "function";

    // Warm paint: cached rows and checkboxes appear while the API answers.
    var cachePromise = haveCache
      ? window.sscGetGradesCache().then(function (entry) {
          if (!entry || !entry.grades || !entry.grades.length) return null;
          state.grades = entry.grades;
          setStage("Animaties voorbereiden…");
          return seenIds().then(function (seen) {
            state.seen = seen || {};
            injectToggles(state.grades, state.seen);
            return entry.grades;
          });
        })
      : Promise.resolve(null);

    // The prefetch that started before the quiet-wait is reused, not repeated.
    var fetchSource = pendingFetch || (typeof window.sscFetchGradesCached === "function"
      ? window.sscFetchGradesCached()
      : window.sscFetchGrades());
    pendingFetch = null;

    var fetchPromise = fetchSource.then(
      function (grades) {
        state.grades = Array.isArray(grades) ? grades : [];
        setStage("Animaties voorbereiden…");
        return firstRun(state.grades).then(function (wasFirstRun) {
          return seenIds().then(function (seen) {
            state.seen = seen || {};
            injectToggles(state.grades, state.seen);
            return { grades: state.grades, seen: state.seen, first: wasFirstRun };
          });
        });
      },
      function () {
        // Leave `started` false so the retry button (and a later settings
        // change) can try again on a page where the session was not ready.
        started = false;
        throw new Error("grades");
      }
    );

    Promise.all([cachePromise, fetchPromise]).then(
      function (results) {
        var outcome = results[1];
        if (!outcome) return;

        var pending = outcome.grades.filter(function (g) {
          return g.id && !outcome.seen[g.id] && onTwenty(g) !== null;
        });

        if (!pending.length) {
          // Nothing to reveal: no reason to hold the screen for audio.
          setStage("Klaar");
          hideLoader();
          liftPreload();
          return;
        }

        setStage("Animaties voorbereiden…");
        preloadRevealAssets().then(function () {
          setStage("Klaar om te onthullen…");
          hideLoader();
          if (!outcome.first) maybeStart(settings, outcome.grades, outcome.seen);
          else liftPreload();
        });
      },
      function () {
        // The loader stays up and shows its own error state after 8s; the
        // retry button re-enters through sscWalkoutStart.
        if (window.sscLoadingStage !== "Fout") setStage("Fout bij het laden…");
      }
    );
  }

  /**
   * Audio buffers and the theme image, in parallel with the fetch finishing.
   * Both are best-effort: a failure means a silent cutscene, not a blocked
   * loader.
   */
  function preloadRevealAssets() {
    var jobs = [];

    if (typeof window.sscPreloadAudio === "function") {
      try {
        jobs.push(Promise.resolve(window.sscPreloadAudio()));
      } catch (e) {
        /* Silent cutscene. */
      }
    }

    var theme = window.sscThemeState;
    if (theme && theme.background) {
      jobs.push(
        new Promise(function (resolve) {
          try {
            var img = new Image();
            img.onload = function () {
              resolve(true);
            };
            img.onerror = function () {
              resolve(false);
            };
            img.src = theme.background;
          } catch (e) {
            resolve(false);
          }
        })
      );
    }

    if (!jobs.length) return Promise.resolve();
    // A stuck decode must not hold the loader forever.
    return Promise.race([
      Promise.all(jobs),
      new Promise(function (resolve) {
        window.setTimeout(resolve, 2500);
      }),
    ]);
  }

  /**
   * Diagnostic for the unverified part: which rows were found, which grade
   * each row matched, and which checkbox landed where. Run from the console
   * when a page renders no boxes.
   */
  function sscDiagnoseRows() {
    var rows = findRows(container());
    var report = rows.map(function (entry) {
      var row = entry.row;
      var grade = gradeForRow(row, state.grades);
      return {
        tag: row.tagName.toLowerCase(),
        cls: typeof row.className === "string" ? row.className : "",
        text: (row.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90),
        scoreTag: entry.score.tagName.toLowerCase(),
        scoreCls: typeof entry.score.className === "string" ? entry.score.className : "",
        matched: grade ? grade.id + " · " + (grade.vak || "") : null,
        hasToggle: !!row.querySelector("[data-ssc-seen-for]"),
      };
    });
    return report;
  }

  window.sscWalkoutStart = sscWalkoutStart;
  window.sscWalkoutRequeue = sscWalkoutRequeue;
  window.sscDiagnoseRows = sscDiagnoseRows;
  window.sscWalkoutQueue = queue;
})();
