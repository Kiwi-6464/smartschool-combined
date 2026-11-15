/**
 * Smartschool Combined — shared settings, storage helpers and grade fetching.
 *
 * Loaded as a content script BEFORE content.js. Everything hangs off `window`
 * so the DevTools console can call it while testing.
 */
(function () {
  "use strict";

  // Sign-in pages: do nothing at all (see guard.js).
  if (window.sscSkipPage) return;

  if (window.sscGet) return; // already loaded

  var STORAGE_KEY = "sscSettings";
  var PAGE_SIZE = 50; // mirrors RESULTS_PER_PAGE in the reference library

  /* ---------- defaults ---------- */

  var SSC_DEFAULTS = {
    theme: "default",
    customThemes: [],
    customName: "",
    backgroundUrl: "",
    backgroundOpacity: 0.25,
    glass: false,
    performanceMode: false,
    pageZoom: 100,
    hideSelectors: "",
    customCss: "",
    gridEnabled: false,
    gridSelector: "",
    gridColumns: 3,
    gridGap: 16,
    tablePercentages: true,
    cutsceneAuto: true,
    cutsceneSound: true,
    cutsceneStyle: "reel",
    topbarTransparent: false,
    queueOrder: "newest",
    // Widget state lives under one key per widget, never as a list of flags
    // beside a second list of ids: adding a widget then means writing one
    // entry, and the order array is the only thing a drag has to rewrite.
    widgets: {
      notes: { enabled: true },
      nextLesson: { enabled: true },
    },
    widgetOrder: ["notes", "nextLesson"],
    widgetsAbove: false,
    // Start page grid (widget-system.js): 3, 4 or 5 columns.
    widgetColumns: 4,
    gamesEnabled: false,
  };

  /* ---------- storage ---------- */

  function sscGet() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(STORAGE_KEY, function (res) {
          if (chrome.runtime.lastError) {
            resolve(Object.assign({}, SSC_DEFAULTS));
            return;
          }
          resolve(Object.assign({}, SSC_DEFAULTS, (res && res[STORAGE_KEY]) || {}));
        });
      } catch (e) {
        resolve(Object.assign({}, SSC_DEFAULTS));
      }
    });
  }

  function sscSet(patch) {
    return sscGet().then(function (current) {
      var next = Object.assign({}, current, patch);
      return new Promise(function (resolve) {
        var payload = {};
        payload[STORAGE_KEY] = next;
        chrome.storage.local.set(payload, function () {
          resolve(next);
        });
      });
    });
  }

  /**
   * One-time cleanup for builds that stored keys this one no longer reads:
   * the removed reveal picker's keys, and the widget flags that predate the
   * registry (they were ids "notities"/"lesuur"/… with no registry entry).
   *
   * The defaults above no longer mention them, but the merge in sscGet()
   * preserves whatever the stored blob already holds. Removing the keys here
   * means "delete the manual selector storage" is true of the disk, not only
   * of the code that reads it.
   */
  function sscPurgeLegacyRevealKeys() {
    try {
      chrome.storage.local.get(STORAGE_KEY, function (res) {
        var cur = res && res[STORAGE_KEY];
        if (!cur) return;
        var keys = ["revealMode", "revealSelectors", "revealMask", "widgetsEnabled"];
        var touched = false;
        for (var i = 0; i < keys.length; i++) {
          if (Object.prototype.hasOwnProperty.call(cur, keys[i])) {
            delete cur[keys[i]];
            touched = true;
          }
        }
        if (!touched) return;
        var payload = {};
        payload[STORAGE_KEY] = cur;
        chrome.storage.local.set(payload);
      });
    } catch (e) {
      /* Storage unavailable (an exotic frame) — nothing to purge. */
    }
  }

  sscPurgeLegacyRevealKeys();

  function sscOnChange(cb) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local" || !changes[STORAGE_KEY]) return;
      cb(Object.assign({}, SSC_DEFAULTS, changes[STORAGE_KEY].newValue || {}));
    });
  }

  /* ---------- normalisation ---------- */

  function parseFraction(description) {
    // PercentageGraphic.description is "achieved/max", e.g. "15/20".
    if (typeof description !== "string") return null;
    var parts = description.split("/");
    if (parts.length !== 2) return null;
    var a = parseFloat(parts[0].replace(",", "."));
    var b = parseFloat(parts[1].replace(",", "."));
    if (isNaN(a) || isNaN(b)) return null;
    return { achieved: a, total: b };
  }

  /**
   * Smartschool answers in camelCase (name.startingWithFirstName), even though
   * the reference Python library models it in snake_case. camelCase wins;
   * snake_case stays as a fallback.
   */
  function personName(person) {
    if (!person) return "";
    if (typeof person === "string") return person;

    var n = typeof person.name === "string" ? person.name : person.name || null;
    var d = person.description && typeof person.description === "object" ? person.description : null;

    // 1, 2 — the nested name object, camelCase
    if (n && n.startingWithFirstName) return n.startingWithFirstName;
    if (n && n.startingWithLastName) return n.startingWithLastName;

    // 3 — name given as a plain string
    if (typeof n === "string" && n) return n;

    // 4, 5 — direkt op het person-object
    if (person.startingWithFirstName) return person.startingWithFirstName;
    if (person.startingWithLastName) return person.startingWithLastName;

    // 6, 7 — via description
    if (d && d.startingWithFirstName) return d.startingWithFirstName;
    if (d && d.startingWithLastName) return d.startingWithLastName;

    // snake_case fallbacks, for any endpoint that still uses the library's shape
    if (n && n.starting_with_first_name) return n.starting_with_first_name;
    if (n && n.starting_with_last_name) return n.starting_with_last_name;
    if (person.starting_with_first_name) return person.starting_with_first_name;
    if (person.starting_with_last_name) return person.starting_with_last_name;
    if (d && d.starting_with_first_name) return d.starting_with_first_name;
    if (d && d.starting_with_last_name) return d.starting_with_last_name;
    if (typeof person.description === "string" && person.description) return person.description;

    return "";
  }

  function nameOf(node) {
    if (!node) return "";
    return personName(node);
  }

  /**
   * Ordered fallbacks. Smartschool's payload is not documented and the
   * reference library is one rendering of it; take the first non-empty path.
   */
  function resolveTeacher(item) {
    var candidates = [
      nameOf(item.gradebook_owner),
      nameOf(item.gradebookOwner),
      item.gradebook_owner && item.gradebook_owner.startingWithLastName,
      item.gradebookOwner && item.gradebookOwner.startingWithLastName,
      item.gradebook_owner && item.gradebook_owner.starting_with_last_name,
      item.teachers && nameOf(item.teachers[0]),
      nameOf(item.teacher),
      nameOf(item.owner),
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i]) return candidates[i];
    }
    return "";
  }

  function feedbackFrom(list) {
    if (!Array.isArray(list)) return "";
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      if (!entry) continue;
      if (typeof entry === "string") {
        if (entry) out.push(entry);
      } else if (entry.text) {
        out.push(entry.text);
      } else if (entry.description) {
        out.push(entry.description);
      } else if (entry.value) {
        out.push(entry.value);
      }
    }
    return out.join(" ");
  }

  function resolveFeedback(item) {
    var candidates = [
      feedbackFrom(item.feedbacks),
      feedbackFrom(item.feedback),
      typeof item.feedback === "string" ? item.feedback : "",
      feedbackFrom(item.comments),
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i]) return candidates[i];
    }
    return "";
  }

  function formatDate(value) {
    if (!value) return "";
    if (typeof value !== "string") return String(value);
    // Keep only the date part of an ISO timestamp; the UI does not need a clock.
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (m) return m[3] + "/" + m[2] + "/" + m[1];
    return value;
  }

  function sscNormalizeGrade(raw) {
    var graphic = raw.graphic || {};
    var frac = parseFraction(graphic.description);
    var percentage = null;

    if (graphic.type === "percentage") {
      if (typeof graphic.value === "number") percentage = graphic.value;
      if (percentage === null && frac && frac.total) percentage = (frac.achieved / frac.total) * 100;
    } else if (graphic.type === "text") {
      // Text grades have no number; description may still hold "a/m" occasionally.
      if (frac && frac.total) percentage = (frac.achieved / frac.total) * 100;
    }
    // IconGraphic carries no score at all — leave percentage null rather than
    // inventing zero, which would drag the average down.

    var courses = raw.courses || [];

    return {
      id: raw.identifier || "",
      type: raw.type || "",
      graphicType: graphic.type || "",
      vak: courses.length && courses[0].name ? courses[0].name : "",
      titel: raw.name || "",
      score: graphic.type === "percentage" && frac ? frac.achieved : (graphic.value || ""),
      max: graphic.type === "percentage" && frac ? frac.total : "",
      percentage: percentage,
      datum: formatDate(raw.date || raw.availabilityDate || raw.availability_date || ""),
      periode: raw.period && raw.period.name ? raw.period.name : "",
      // The student's class ("3ENW"): period.class, else the course's class.
      klas:
        (raw.period && raw.period.class && raw.period.class.name) ||
        (courses.length && courses[0].class && courses[0].class.name) ||
        "",
      leerkracht:
        resolveTeacher(raw) ||
        personName(courses.length && courses[0].teachers && courses[0].teachers[0]) ||
        "",
      feedback: resolveFeedback(raw),
      ruweScore: frac ? frac.achieved : null,
      ruweMax: frac ? frac.total : null,
      doesCount:
        (raw.doesCount !== undefined ? raw.doesCount : raw.does_count) !== false,
    };
  }

  /* ---------- fetching ---------- */

  function rawPagesDirect() {
    function page(n) {
      var url = "/results/api/v1/evaluations/?pageNumber=" + n + "&itemsOnPage=" + PAGE_SIZE;
      return fetch(url, {
        credentials: "include",
        headers: { Accept: "application/json" },
      }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status + " on page " + n);
        return r.json();
      });
    }
    return paginate(page);
  }

  /*
   * Pages come in waves of four requests at once instead of one after the other
   * (a student with 150+ grades used to wait for 4+ round trips in a row). A page
   * past the end may answer with an error: that is only ignored when an earlier
   * page of the same wave was already short, i.e. the list really ended there.
   */
  function paginate(fetchPage) {
    var WAVE = 4;
    var all = [];
    function wave(start, size) {
      var jobs = [];
      for (var i = 0; i < size; i++) {
        jobs.push(fetchPage(start + i).then(function (rows) { return { rows: rows }; }, function (err) { return { err: err }; }));
      }
      return Promise.all(jobs).then(function (pages) {
        for (var j = 0; j < pages.length; j++) {
          if (pages[j].err) throw pages[j].err; // every earlier page was full, so this one should exist
          var rows = Array.isArray(pages[j].rows) ? pages[j].rows : [];
          all = all.concat(rows);
          if (rows.length < PAGE_SIZE) return all;
        }
        return wave(start + size, WAVE);
      });
    }
    return wave(1, 1); // most students fit on page 1: do not spend 3 more requests on them
  }

  function askBackground() {
    return new Promise(function (resolve, reject) {
      try {
        chrome.runtime.sendMessage({ type: "ssc:fetchGrades" }, function (res) {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          if (!res || !res.ok) return reject(new Error((res && res.error) || "background failed"));
          resolve(res.raw);
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Returns a promise of normalised grades. Tries the service worker first
   * (as the spec asks), falls back to a same-origin page fetch, which always
   * carries the Smartschool session cookie.
   */
  // The widgets, the unboxing, the percentages and the team all ask at page load. They share
  // one request, and a result stays valid for 20 s, so a page does not fetch every grade 3 times.
  var rawShared = null;
  var rawAt = 0;
  var rawRaw = null;
  var RAW_TTL_MS = 20000;

  function sscFetchRawGrades() {
    if (rawRaw && Date.now() - rawAt < RAW_TTL_MS) return Promise.resolve(rawRaw);
    if (rawShared) return rawShared;
    rawShared = askBackground()
      .catch(function () {
        return rawPagesDirect();
      })
      .then(
        function (raw) {
          rawRaw = raw;
          rawAt = Date.now();
          rawShared = null;
          return raw;
        },
        function (err) {
          rawShared = null;
          throw err;
        }
      );
    return rawShared;
  }

  function sscFetchGrades() {
    return sscFetchRawGrades().then(function (raw) {
      return raw.map(sscNormalizeGrade).filter(function (g) {
        return g.id;
      });
    });
  }

  /* ---------- grade cache (Bug 11, part B) ---------- */

  /**
   * The Resultaten page used to wait for the API on every visit. The last
   * successful fetch is kept under its own key so a cold navigation paints
   * immediately while the real request runs in parallel.
   *
   * Twelve hours is the ceiling: a grade entered yesterday evening must be
   * there by morning, and a cache older than that is more likely stale than
   * useful. The cache is per user, for the same reason sscSeen is.
   */
  var CACHE_KEY = "sscGradesCache";
  var CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

  function sscGetGradesCache() {
    return Promise.all([sscGetUserId(), new Promise(function (resolve) {
      try {
        chrome.storage.local.get([CACHE_KEY], function (res) {
          resolve((res && res[CACHE_KEY]) || null);
        });
      } catch (e) {
        resolve(null);
      }
    })]).then(function (out) {
      var uid = out[0];
      var entry = out[1];
      if (!entry || !Array.isArray(entry.grades)) return null;
      if (entry.userId && entry.userId !== uid) return null;
      var age = Date.now() - Number(entry.fetchedAt || 0);
      if (!isFinite(age) || age < 0 || age > CACHE_MAX_AGE_MS) return null;
      return entry;
    });
  }

  function sscSetGradesCache(grades) {
    return Promise.all([sscGetUserId()]).then(function (out) {
      return new Promise(function (resolve) {
        var payload = {};
        payload[CACHE_KEY] = {
          grades: Array.isArray(grades) ? grades : [],
          fetchedAt: Date.now(),
          userId: out[0],
        };
        try {
          chrome.storage.local.set(payload, function () {
            resolve(true);
          });
        } catch (e) {
          resolve(false);
        }
      });
    });
  }

  /**
   * Fetch, and on success remember it. All callers go through this so the
   * cache is never written by one path and read by another with a different
   * shape.
   */
  function sscFetchGradesCached() {
    return sscFetchGrades().then(function (grades) {
      if (grades && grades.length) sscSetGradesCache(grades);
      return grades;
    });
  }

  /* ---------- "Gezien" state ---------- */

  /**
   * A SEPARATE storage key, not a field inside sscSettings.
   *
   * Ticking a checkbox would otherwise rewrite the whole settings blob
   * (themes, custom CSS, 70 palettes' worth of pointers) on every click, and
   * a queue write would race a settings save. One grade = one key here.
   *
   * Shape: { "<grade id>": <epoch ms when marked> }
   * Presence means seen. The timestamp costs nothing and keeps a future
   * "recently opened" view possible without a migration.
   */
  var SEEN_KEY = "sscSeen";
  var SEEN_INIT_KEY = "sscSeenInitialized";

  /**
   * The seen map is namespaced by Smartschool user id:
   *   { "<userId>": { "<gradeId>": <epoch ms> }, ... }
   * Two accounts sharing one school laptop must not share checkboxes, and a
   * stored grade id from another user is meaningless anyway.
   *
   * The id comes from the same two sources Smartschool++ uses: the
   * #datePickerMenu element's plannerurl attribute, then the plannerUrl
   * cookie that is written from it. Only a real id is cached — a temporary
   * miss (the topbar not rendered yet) must not poison the whole page.
   */
  var cachedUserId = null;
  var ANON_USER = "anoniem";

  function findUserId() {
    var raw = null;
    try {
      var node = document.getElementById("datePickerMenu");
      raw = node && node.getAttribute("plannerurl");
    } catch (e) {
      raw = null;
    }
    if (!raw) {
      try {
        var m = /(?:^|;\s*)plannerUrl=([^;]+)/.exec(document.cookie || "");
        if (m) raw = decodeURIComponent(m[1]);
      } catch (e) {
        raw = null;
      }
    }
    if (!raw) return null;
    var parts = String(raw).split("/");
    return parts[4] || null;
  }

  function sscGetUserId() {
    if (cachedUserId) return Promise.resolve(cachedUserId);
    var found = findUserId();
    if (found) {
      cachedUserId = found;
      return Promise.resolve(found);
    }
    return Promise.resolve(ANON_USER);
  }

  /** Old build: the blob WAS the grade map. New build: it is keyed by user. */
  function isLegacySeenBlob(blob) {
    if (!blob || typeof blob !== "object") return false;
    var keys = Object.keys(blob);
    if (!keys.length) return false;
    for (var i = 0; i < keys.length; i++) {
      if (typeof blob[keys[i]] !== "number") return false;
    }
    return true;
  }

  function readSeenBlob() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get([SEEN_KEY], function (res) {
          if (chrome.runtime.lastError) {
            resolve({});
            return;
          }
          resolve((res && res[SEEN_KEY]) || {});
        });
      } catch (e) {
        resolve({});
      }
    });
  }

  function writeSeenBlob(blob) {
    return new Promise(function (resolve) {
      var payload = {};
      payload[SEEN_KEY] = blob || {};
      try {
        chrome.storage.local.set(payload, function () {
          resolve(blob || {});
        });
      } catch (e) {
        resolve(blob || {});
      }
    });
  }

  function sscGetSeen() {
    return Promise.all([sscGetUserId(), readSeenBlob()]).then(function (out) {
      var uid = out[0];
      var blob = out[1];

      if (isLegacySeenBlob(blob)) {
        // One-time migration: wrap the flat map under the current user and
        // keep it, so nobody loses their checkboxes on upgrade.
        var migrated = {};
        migrated[uid] = blob;
        return writeSeenBlob(migrated).then(function () {
          return blob;
        });
      }

      return (blob && blob[uid]) || {};
    });
  }

  /**
   * Writes only the current user's slice. Read-modify-write runs on a single
   * promise chain so two rapid checkbox clicks cannot clobber each other.
   */
  var seenWriteChain = Promise.resolve();

  function sscSetSeen(map) {
    seenWriteChain = seenWriteChain
      .then(function () {
        return Promise.all([sscGetUserId(), readSeenBlob()]);
      })
      .then(function (out) {
        var uid = out[0];
        var blob = out[1] || {};
        if (isLegacySeenBlob(blob)) blob = {};
        blob[uid] = map || {};
        return writeSeenBlob(blob).then(function () {
          return map || {};
        });
      })
      // A failed write must not poison the chain: without this catch, every
      // later checkbox click would replay the same rejection.
      .catch(function () {
        return map || {};
      });
    return seenWriteChain;
  }

  function sscMarkSeen(id) {
    if (!id) return Promise.resolve({});
    return sscGetSeen().then(function (map) {
      if (map[id]) return map;
      map[id] = Date.now();
      return sscSetSeen(map);
    });
  }

  function sscMarkUnseen(id) {
    if (!id) return Promise.resolve({});
    return sscGetSeen().then(function (map) {
      if (!map[id]) return map;
      delete map[id];
      return sscSetSeen(map);
    });
  }

  function sscIsSeenId(map, id) {
    return !!(map && id && map[id]);
  }

  function sscOnSeenChange(cb) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local" || !changes[SEEN_KEY]) return;
      // The stored blob is keyed by user; listeners want the current slice.
      sscGetSeen().then(function (map) {
        cb(map || {});
      });
    });
  }

  /** True once per install: the very first run marks everything as seen. */
  function sscSeenInitialized() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get([SEEN_INIT_KEY], function (res) {
          resolve(!!(res && res[SEEN_INIT_KEY]));
        });
      } catch (e) {
        resolve(true);
      }
    });
  }

  function sscSetSeenInitialized() {
    return new Promise(function (resolve) {
      var payload = {};
      payload[SEEN_INIT_KEY] = true;
      try {
        chrome.storage.local.set(payload, function () {
          resolve(true);
        });
      } catch (e) {
        resolve(false);
      }
    });
  }

  /* ---------- export to window ---------- */

  window.SSC_DEFAULTS = SSC_DEFAULTS;
  window.sscGet = sscGet;
  window.sscSet = sscSet;
  window.sscOnChange = sscOnChange;
  window.sscFetchGrades = sscFetchGrades;
  window.sscFetchGradesCached = sscFetchGradesCached;
  window.sscGetGradesCache = sscGetGradesCache;
  window.sscSetGradesCache = sscSetGradesCache;
  window.sscFetchRawGrades = sscFetchRawGrades;
  window.sscNormalizeGrade = sscNormalizeGrade;
  window.sscGetUserId = sscGetUserId;
  window.sscGetSeen = sscGetSeen;
  window.sscSetSeen = sscSetSeen;
  window.sscMarkSeen = sscMarkSeen;
  window.sscMarkUnseen = sscMarkUnseen;
  window.sscIsSeenId = sscIsSeenId;
  window.sscOnSeenChange = sscOnSeenChange;
  window.sscSeenInitialized = sscSeenInitialized;
  window.sscSetSeenInitialized = sscSetSeenInitialized;
})();
