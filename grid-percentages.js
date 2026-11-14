/**
 * Smartschool Combined — percentages in the native results views.
 *
 * Two views, one setting ("Percentages tonen in de puntenlijst"):
 *   - the puntenboek / table view, where each subject row gets ONE badge in
 *     its name cell, right-aligned. Never in the score cell: the "Gezien"
 *     checkbox lives there, and a badge next to it is not where it belongs.
 *   - the grid/tile view, where each evaluation tile's own score text gets the
 *     same badge inline, right after the fraction.
 *
 * Ported in approach (not code) from inspiration/SmarterSmartchool: that
 * extension parsed Smartschool's own grade table in the page. This one adds a
 * small badge next to the score instead of rebuilding anything — the SPA's
 * table and tiles are Smartschool's, and wrapping or restructuring them is the
 * fastest way to make the renderer throw.
 *
 * Where the number comes from:
 *   - the row's own text, "15,8/20" → 79.0%, which is always right for what
 *     is on screen;
 *   - sscFetchGrades(), used as a cross-check when the API has a grade with
 *     the same course and the same score/max. The API is the authority on the
 *     percentage when both agree on the fraction, because it already applies
 *     Smartschool's own rounding.
 *
 * Everything is idempotent: the SPA may re-render the table on any filter or
 * page change, and each pass removes what it no longer needs and re-adds what
 * is missing.
 */
(function () {
  "use strict";

  // Sign-in pages: do nothing at all (see guard.js).
  if (window.sscSkipPage) return;

  if (window.sscPercentagesApply) return;

  var STYLE_ID = "ssc-pct-style";
  var BADGE_ATTR = "data-ssc-pct";
  var GRID_ATTR = "data-ssc-pct-grid";
  var TABLE_ATTR = "data-ssc-pct-table";

  var current = {
    on: false,
    count: 0,
    grades: null,
    gradeStamp: 0,
    observer: null,
    timer: null,
    roots: [],
    tables: [],
    grids: [],
  };

  /* ---------- stylesheet ---------- */

  /*
   * !important on the pill only. It is inserted into Smartschool's own cell,
   * whose rules reset font-size and margin on every inline child; without it
   * the pill renders at the cell's size and loses its spacing. Scoped to
   * .ssc-pct, which exists nowhere else on the page.
   *
   * One pill, inline, immediately after the thing it describes: after the
   * subject name in the puntenboek, after the score in a grid tile. No float,
   * no absolute positioning, no extra column.
   *
   * Colours are theme-driven: the tint and the border come from the theme's
   * own text colour through color-mix, and the tier's hue is the only fixed
   * part. Because every colour here reads a custom property on <html>, a theme
   * switch repaints the pill with no re-render — layout.js rewrites those
   * properties in place.
   *
   * The dark/light split is the one thing CSS cannot do by itself: the tier
   * colour must darken on a light page and lighten on a dark one. We compute
   * the scheme from --ssc-base00's luminance and put it on <html> as
   * data-ssc-scheme (see watchScheme below).
   */
  var CSS = [
    ".ssc-pct{",
    "  display:inline-block !important;",
    "  margin-left:6px !important;",
    "  padding:1px 6px !important;",
    "  border-radius:6px !important;",
    "  border:1px solid color-mix(in srgb, var(--ssc-text, #12151a) 12%, transparent) !important;",
    "  font-size:11px !important;",
    "  font-weight:700 !important;",
    "  line-height:1.45 !important;",
    "  letter-spacing:.01em;",
    "  vertical-align:middle !important;",
    "  white-space:nowrap !important;",
    "  text-shadow:none !important;",
    // Light-page defaults, used when no theme is active and the scheme
    // attribute has not been computed yet.
    "  color:#15803d !important;",
    "  background-color:color-mix(in srgb, #4ade80 20%, transparent) !important;",
    "}",
    ".ssc-pct[data-tier='mid']{",
    "  color:#b45309 !important;",
    "  background-color:color-mix(in srgb, #f59e0b 20%, transparent) !important;",
    "}",
    ".ssc-pct[data-tier='low']{",
    "  color:#b91c1c !important;",
    "  background-color:color-mix(in srgb, #f87171 20%, transparent) !important;",
    "}",
    // Dark page: the same three hues, lifted so they read against base00.
    "html[data-ssc-scheme='dark'] .ssc-pct{",
    "  color:#4ade80 !important;",
    "  background-color:color-mix(in srgb, #4ade80 20%, transparent) !important;",
    "}",
    "html[data-ssc-scheme='dark'] .ssc-pct[data-tier='mid']{",
    "  color:#f59e0b !important;",
    "  background-color:color-mix(in srgb, #f59e0b 20%, transparent) !important;",
    "}",
    "html[data-ssc-scheme='dark'] .ssc-pct[data-tier='low']{",
    "  color:#f87171 !important;",
    "  background-color:color-mix(in srgb, #f87171 20%, transparent) !important;",
    "}",
    // Grid tiles are smaller than table cells; the pill keeps its shape but
    // takes less room so it does not push a tile's layout around.
    ".ssc-pct.ssc-pct--grid{",
    "  margin-left:5px !important;",
    "  padding:0 6px !important;",
    "  font-size:10px !important;",
    "}",
  ].join("\n");

  function ensureStyle() {
    var style = document.getElementById(STYLE_ID);
    if (style) {
      if (style.textContent !== CSS) style.textContent = CSS;
      return style;
    }
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.documentElement.appendChild(style);
    return style;
  }

  /* ---------- dark / light detection ---------- */

  /**
   * The tier colours have to brighten on a dark page and darken on a light
   * one, and no CSS selector can compare two computed colours. So we measure:
   * --ssc-base00 is the page background in every theme, and layout.js writes
   * it as an inline custom property on <html>. Reading a custom property with
   * getComputedStyle returns the raw token ("#141414", "lch(4% 1 40)"), not an
   * rgb() we can parse — so the value is applied to a throwaway element's
   * background first, which makes the browser resolve it for us.
   */
  var schemeProbe = null;

  function baseLuminance() {
    var root = document.documentElement;
    if (!schemeProbe) {
      schemeProbe = document.createElement("i");
      schemeProbe.setAttribute("aria-hidden", "true");
      schemeProbe.style.cssText =
        "position:absolute;left:-9999px;top:-9999px;width:0;height:0;" +
        "pointer-events:none;visibility:hidden;";
      root.appendChild(schemeProbe);
    }
    // The fallback is white, so "no theme" reads as a light page.
    schemeProbe.style.backgroundColor = "var(--ssc-base00, #ffffff)";
    var rgb = "";
    try {
      rgb = getComputedStyle(schemeProbe).backgroundColor || "";
    } catch (e) {
      return null;
    }
    var m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(rgb);
    if (!m) return null;
    var r = Number(m[1]) / 255;
    var g = Number(m[2]) / 255;
    var b = Number(m[3]) / 255;
    // sRGB relative luminance, the WCAG definition.
    function lin(c) {
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function applyScheme() {
    var lum = baseLuminance();
    if (lum === null) return;
    var scheme = lum < 0.35 ? "dark" : "light";
    var root = document.documentElement;
    if (root.getAttribute("data-ssc-scheme") !== scheme) {
      root.setAttribute("data-ssc-scheme", scheme);
    }
  }

  /** A style-attribute write on <html> is exactly what a theme switch is. */
  var schemeObserver = null;

  function watchScheme() {
    applyScheme();
    if (schemeObserver || typeof MutationObserver !== "function") return;
    schemeObserver = new MutationObserver(function () {
      applyScheme();
    });
    try {
      schemeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["style", "data-ssc-theme"],
      });
    } catch (e) {
      schemeObserver = null;
    }
  }

  /* ---------- page detection ---------- */

  var RESULTS_URL = /(^|\/)(results?|skore|resultaten|punten)(\/|$|\?)/i;

  function looksLikeResultsPage() {
    try {
      if (RESULTS_URL.test(location.pathname)) return true;
      if (RESULTS_URL.test(location.hash)) return true;
    } catch (e) {
      /* location can throw in exotic frames */
    }
    return false;
  }

  function contentRoots() {
    var selectors = ["#smscMain", ".smscMain", ".home-main", "#centercontainer", "main"];
    var out = [];
    for (var i = 0; i < selectors.length; i++) {
      var found;
      try {
        found = document.querySelectorAll(selectors[i]);
      } catch (e) {
        continue;
      }
      for (var j = 0; j < found.length; j++) {
        if (out.indexOf(found[j]) === -1) out.push(found[j]);
      }
    }
    if (!out.length && document.body) out.push(document.body);
    return out;
  }

  /**
   * Every table on the results page is a candidate. The one we want holds at
   * least two scores written as "a/b"; a navigation table or a layout table
   * does not.
   */
  function findTables() {
    var out = [];
    var roots = contentRoots();
    current.roots = roots;
    for (var r = 0; r < roots.length; r++) {
      var tables;
      try {
        tables = roots[r].querySelectorAll("table");
      } catch (e) {
        continue;
      }
      for (var i = 0; i < tables.length; i++) {
        if (out.indexOf(tables[i]) !== -1) continue;
        if (countFractionCells(tables[i]) >= 2) out.push(tables[i]);
      }
    }
    return out;
  }

  /* ---------- row parsing ---------- */

  /** "15,8/20", "15 / 20", "9/10 (45%)" — the first fraction in the text. */
  var FRACTION = /(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/;

  function toNumber(text) {
    var n = parseFloat(String(text).replace(",", "."));
    return isFinite(n) ? n : null;
  }

  function readFraction(text) {
    var m = FRACTION.exec(String(text || ""));
    if (!m) return null;
    var a = toNumber(m[1]);
    var b = toNumber(m[2]);
    if (a === null || b === null || b <= 0) return null;
    return { score: a, max: b, pct: (a / b) * 100 };
  }

  function countFractionCells(table) {
    var cells = table.querySelectorAll("td");
    var seen = 0;
    for (var i = 0; i < cells.length; i++) {
      if (FRACTION.test(cells[i].textContent || "")) seen++;
      if (seen >= 2) return seen;
    }
    return seen;
  }

  function cellsOf(row) {
    var out = [];
    for (var i = 0; i < row.children.length; i++) {
      if (row.children[i].tagName === "TD") out.push(row.children[i]);
    }
    return out;
  }

  /**
   * The API's own percentage for the same fraction, when it has one. Used to
   * agree with Smartschool's rounding rather than re-deriving it.
   */
  function pctFromApi(fraction, rowText) {
    var grades = current.grades;
    if (!grades || !grades.length) return null;
    var best = null;
    for (var i = 0; i < grades.length; i++) {
      var g = grades[i];
      if (g.ruweMax === null || g.ruweScore === null) continue;
      if (Math.abs(g.ruweMax - fraction.max) > 0.001) continue;
      if (Math.abs(g.ruweScore - fraction.score) > 0.001) continue;
      if (g.percentage === null || g.percentage === undefined) continue;
      // A course name in the row breaks the tie when two grades share a score.
      if (g.vak && rowText.indexOf(g.vak) !== -1) return g.percentage;
      if (best === null) best = g.percentage;
    }
    return best;
  }

  function tierOf(pct) {
    if (pct >= 70) return "good";
    if (pct >= 50) return "mid";
    return "low";
  }

  function formatPct(pct) {
    // Dutch convention, one decimal: 79,0%.
    return pct.toFixed(1).replace(".", ",") + "%";
  }

  /* ---------- grid / tile parsing ---------- */

  /*
   * Smartschool's grid view is not documented and its class names have changed
   * between releases, so detection is layered:
   *
   *   1. known result containers / tile classes (see the two lists below);
   *   2. structural fallback: any element whose parent holds two or more
   *      siblings that each carry a fraction is treated as a tile.
   *
   * Both paths are scoped to the results content root and refuse anything
   * inside a <table> (the table path owns those) or inside the detail panel.
   * Only a badge is inserted — never a wrapper, never a moved node.
   */
  var GRID_CONTAINER_SELECTORS = [
    ".results-evaluations__content",
    ".results-evaluations",
    "[class*='results-evaluations--grid']",
    "[class*='evaluations-grid']",
    "[class*='evaluation-grid']",
    "[class*='results-grid']",
    "[class*='grid-view']",
    "#gridview",
    "#period-container",
    ".grid_course_evals",
    ".evaluation-tile",
    ".evaluation",
    ".tile",
    ".grid",
  ];

  // Classes that identify one evaluation card/tile rather than its container.
  // `results-evaluation--small/--wide` are deliberately NOT here: those are
  // layout modifiers on Smartschool's results container and detail panel, and
  // treating them as tiles would badge a summary line in the table view.
  var TILE_CLASS =
    /evaluation-tile|evaluation-list-item|evaluation-card|result-card|result-tile|grid-tile|grade-tile/i;

  // Elements worth looking at for the score text. Deliberately broad: the
  // score may be a <span>, a <strong>, or the tile button's own text.
  var CANDIDATE_SELECTOR =
    "span, strong, b, p, a, button, div, li, article, dt, dd, h1, h2, h3, h4, h5, h6";

  /**
   * A full date also matches FRACTION ("12/10/2025" → 12/10), and a tile
   * usually shows its date next to the score. The date's own element is
   * rejected; the score element, which carries one fraction, is still badged.
   */
  function looksLikeFullDate(text) {
    var compact = String(text || "").replace(/\s+/g, "");
    if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(compact)) return true;
    return false;
  }

  function classNameOf(node) {
    if (!node || node.nodeType !== 1) return "";
    var cls = node.getAttribute ? node.getAttribute("class") : node.className;
    return typeof cls === "string" ? cls : "";
  }

  /**
   * Anything we must not touch: Smartschool's table (the table path handles
   * it), the evaluation detail side panel, dialogs, and our own badges.
   */
  function isExcluded(node) {
    if (!node || !node.closest) return true;
    if (node.closest("script, style, noscript, table, tr, td, th")) return true;
    if (node.closest(".side-panel, [class*='side-panel'], dialog, [role='dialog']")) return true;
    if (node.closest("[" + BADGE_ATTR + "]")) return true;
    return false;
  }

  /**
   * Deepest elements whose text is a short fraction ("15/20").
   *
   * "Deepest" matters: a tile's text also contains the fraction, and badging
   * the tile would put the percentage after the entire card instead of after
   * the score. When a score is split over child elements ("15" + "/20") no
   * single leaf matches; the first ancestor that does is used instead.
   */
  function fractionNodesIn(root) {
    var out = [];
    var all;
    try {
      all = root.querySelectorAll(CANDIDATE_SELECTOR);
    } catch (e) {
      return out;
    }
    for (var i = 0; i < all.length; i++) {
      var node = all[i];
      if (isExcluded(node)) continue;
      var text = (node.textContent || "").trim();
      if (!text || text.length > 60) continue;
      if (!FRACTION.test(text)) continue;
      if (looksLikeFullDate(text)) continue;

      var childOwns = false;
      for (var c = 0; c < node.children.length; c++) {
        var child = node.children[c];
        if (child.nodeType !== 1) continue;
        if (FRACTION.test(child.textContent || "")) {
          childOwns = true;
          break;
        }
      }
      if (childOwns) continue;
      out.push(node);
    }
    return out;
  }

  /**
   * The tile that owns a score node. A known tile class wins; otherwise the
   * nearest ancestor that is one of two or more fraction-bearing siblings is
   * the tile. Returns null outside a plausible tile.
   */
  function tileOf(node) {
    var up = node;
    var guard = 0;

    while (up && up !== document.body && up !== document.documentElement && guard++ < 8) {
      if (isExcluded(up)) return null;
      if (TILE_CLASS.test(classNameOf(up))) return up;

      var parent = up.parentElement;
      if (!parent) return null;

      var total = 0;
      var withFraction = 0;
      for (var i = 0; i < parent.children.length; i++) {
        var sibling = parent.children[i];
        if (sibling.nodeType !== 1) continue;
        total++;
        if (FRACTION.test(sibling.textContent || "")) withFraction++;
      }
      // Two sibling cards with a score each: `up` is one of the tiles.
      if (total >= 2 && withFraction >= 2) return up;

      up = parent;
    }
    return null;
  }

  /** Drops containers that contain another container, so no tile is scanned twice. */
  function innermostOnly(nodes) {
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var nested = false;
      for (var j = 0; j < nodes.length; j++) {
        if (i !== j && nodes[i].contains(nodes[j])) {
          nested = true;
          break;
        }
      }
      if (!nested) out.push(nodes[i]);
    }
    return out;
  }

  /**
   * Grid roots to scan and observe. Known containers first; structural
   * detection only when none of them exist, so a page with a table and a
   * stray "15/20" elsewhere cannot produce phantom roots.
   */
  function findGridRoots() {
    var roots = contentRoots();
    current.roots = roots;
    var found = [];
    var r;
    var i;

    for (r = 0; r < roots.length; r++) {
      for (i = 0; i < GRID_CONTAINER_SELECTORS.length; i++) {
        var matches;
        try {
          matches = roots[r].querySelectorAll(GRID_CONTAINER_SELECTORS[i]);
        } catch (e) {
          continue;
        }
        for (var m = 0; m < matches.length; m++) {
          var node = matches[m];
          if (found.indexOf(node) !== -1) continue;
          if (isExcluded(node)) continue;
          // Cheap text test only. A container whose fractions all sit inside
          // a <table> (the table view with a grid-ish class) still gets
          // recorded here, but decorateGridRoots() finds no tile inside it
          // and adds nothing — the table path owns those rows.
          if (!FRACTION.test(node.textContent || "")) continue;
          found.push(node);
        }
      }
    }

    if (found.length) return innermostOnly(found);

    // Structural fallback. A tile parent is a container; one tile on its own
    // is not enough to call the page a grid.
    var tiles = [];
    for (r = 0; r < roots.length; r++) {
      var nodes = fractionNodesIn(roots[r]);
      for (i = 0; i < nodes.length; i++) {
        var tile = tileOf(nodes[i]);
        if (tile && tiles.indexOf(tile) === -1) tiles.push(tile);
      }
    }
    if (tiles.length < 2) return [];

    var parents = [];
    for (i = 0; i < tiles.length; i++) {
      var parent = tiles[i].parentElement;
      if (!parent || parent === document.body || parent === document.documentElement) continue;
      if (parents.indexOf(parent) === -1) parents.push(parent);
    }
    return parents;
  }

  /* ---------- injection ---------- */

  function badgeNode(pct) {
    var span = document.createElement("span");
    span.className = "ssc-pct";
    span.setAttribute(BADGE_ATTR, "1");
    span.setAttribute("data-tier", tierOf(pct));
    span.textContent = formatPct(pct);
    return span;
  }

  function gridBadgeNode(pct, fraction) {
    var span = badgeNode(pct);
    span.className = "ssc-pct ssc-pct--grid";
    // Separate attribute so a stale grid badge can be identified, while
    // removeBadges() still clears both views through BADGE_ATTR.
    span.setAttribute(GRID_ATTR, "1");
    // The fraction the badge was built from. If the SPA re-renders a tile with
    // a different score but leaves our badge in place, the badge is corrected
    // on the next pass instead of showing a stale percentage forever.
    span.setAttribute("data-ssc-pct-frac", fractionKey(fraction));
    return span;
  }

  function fractionKey(fraction) {
    return fraction.score + "/" + fraction.max;
  }

  function refreshGridBadge(badge, pct, fraction) {
    var key = fractionKey(fraction);
    if (badge.getAttribute("data-ssc-pct-frac") === key) return false;
    badge.setAttribute("data-ssc-pct-frac", key);
    badge.setAttribute("data-tier", tierOf(pct));
    badge.textContent = formatPct(pct);
    return true;
  }

  function removeBadges() {
    var existing = document.querySelectorAll("[" + BADGE_ATTR + "]");
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].parentNode) existing[i].parentNode.removeChild(existing[i]);
    }
    var marked = document.querySelectorAll("[" + TABLE_ATTR + "]");
    for (var j = 0; j < marked.length; j++) marked[j].removeAttribute(TABLE_ATTR);
    current.tables = [];
    current.grids = [];
    current.count = 0;
  }

  /**
   * Puts the pill immediately after the last character of the subject name.
   *
   * The rule is literal: find the text node that holds the name, and insert
   * the pill as its next sibling *inside that text node's own parent*. That
   * parent is inline content (an <a>, a <span>, a <th>'s text run), so the
   * pill flows right after the word — margin-left:6px is the only gap.
   *
   * Appending to the cell instead would land after whatever else the cell
   * contains (a date, a spacer, a hidden label), which is what read as "too
   * far to the right". Nothing here floats, positions, or changes layout
   * alignment; the pill is an inline child of an inline parent.
   */
  var NAME_STOPWORDS = /^(?:periode|period|semester|trim|jaar|jaar\s*\d|schooljaar|totaal|total|vak|vakken|punten|resultaten|gemiddelde|cursus)$/i;

  /**
   * The text node that actually renders the subject name inside a cell, or
   * null when this cell does not hold a name (a score, a date, a period).
   */
  function nameTextNode(cell) {
    var best = null;
    var walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var text = node.textContent;
      if (!text || !text.trim()) continue;
      // Skip our own pill and anything that already carries a percentage.
      var parent = node.parentNode;
      if (parent && parent.closest && parent.closest("[" + BADGE_ATTR + "]")) continue;
      if (text.indexOf("%") !== -1) continue;
      if (FRACTION.test(text)) continue;      // a score, not a name
      if (looksLikeFullDate(text)) continue;
      var trimmed = text.trim();
      if (trimmed.length < 2) continue;
      if (NAME_STOPWORDS.test(trimmed)) continue;
      // First qualifying run wins: the name is the first thing in the cell.
      best = node;
      break;
    }
    return best;
  }

  function appendAfterName(cell, badge) {
    var textNode = nameTextNode(cell);
    if (!textNode) {
      // Nothing that reads as a name in this cell: refuse to badge it rather
      // than appending after a date, a period label or a stray separator.
      return false;
    }
    var host = textNode.parentNode;
    if (!host || host.closest("[" + BADGE_ATTR + "]")) return false;
    host.insertBefore(badge, textNode.nextSibling);
    return true;
  }

  /**
   * One badge per table row, in the row's subject-name cell, so it reads as
   * "Wiskunde 79,0%".
   *
   * Why the first cell and not the score cell: the score cell is where the
   * "Gezien" checkbox is injected, so a badge appended there ends up to the
   * right of that checkbox, inside the score column. The puntenboek wants the
   * percentage beside the subject name on the right side of the name column.
   *
   * The number is the row's TOTAL percentage (sum of scores / sum of maxima),
   * which is what a subject-column summary means in the puntenboek. A row with
   * a single evaluation totals to that evaluation's own percentage, so both
   * shapes of table work.
   */
  function decorateTable(table) {
    var rows = table.querySelectorAll("tr");
    var added = 0;

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var seen = row.querySelector("[" + BADGE_ATTR + "]");
      if (seen) {
        // Already badged — but an earlier build put the badge in the score
        // cell, right of the Gezien checkbox. Move it to the name cell rather
        // than leaving it where the user reported it does not belong.
        var seenCell = seen.closest("td");
        if (seenCell && FRACTION.test(seenCell.textContent || "")) {
          if (seen.parentNode) seen.parentNode.removeChild(seen);
        } else {
          continue;
        }
      }

      var cells = cellsOf(row);
      if (!cells.length) continue;

      var sumScore = 0;
      var sumMax = 0;
      var singles = [];
      for (var c = 0; c < cells.length; c++) {
        var fraction = readFraction(cells[c].textContent);
        if (!fraction) continue;
        sumScore += fraction.score;
        sumMax += fraction.max;
        singles.push(fraction);
      }
      if (!singles.length || sumMax <= 0) continue; // header or empty row

      var pct = (sumScore / sumMax) * 100;
      // A single evaluation can borrow Smartschool's own rounding; a total
      // cannot, because the API has no matching entry for the sum.
      if (singles.length === 1) {
        var api = pctFromApi(singles[0], (row.textContent || "").replace(/\s+/g, " "));
        if (api !== null) pct = api;
      }
      if (!isFinite(pct)) continue;

      // Only the row's name cell. The first cell that holds no fraction is the
      // name; anything after it is a score, a period or a date column, and a
      // percentage there is the "random percentage after a dot" the user saw.
      // appendAfterName refuses a cell with no name text, and that refusal is
      // final: no fallback to cells[0].
      var host = null;
      for (var n = 0; n < cells.length; n++) {
        if (FRACTION.test(cells[n].textContent || "")) continue;
        if ((cells[n].textContent || "").indexOf("%") !== -1) continue;
        if (looksLikeFullDate(cells[n].textContent)) continue;
        host = cells[n];
        break;
      }
      if (!host) continue;

      var badge = badgeNode(pct);
      badge.className = "ssc-pct"; // inline, straight after the name
      if (!appendAfterName(host, badge)) continue;
      added++;
    }

    if (added) table.setAttribute(TABLE_ATTR, "1");
    return added;
  }

  /* ---------- puntenboek (table-page) ---------- */

  /*
   * Smartschool's puntenboek is a matrix, not necessarily a <table>: the
   * classes come straight from smartschool's own markup as reflected in
   * inspiration/smpp — `.table-page`, `.row--course`, `.cell`,
   * `.cell--evaluation`, `.cell__course-name`. Handling it by class means the
   * badge lands in the subject-name column whether the rows are <tr> or <div>.
   */
  var PUNTENBOEK_ROOTS = [
    ".table-page",
    ".table-page__container__wrapper__table",
    ".js-routehandler.table-page",
    "[class*='table-page__container']",
  ];

  var PUNTENBOEK_ROW = ".row--course, [class*='row--course']";
  var PUNTENBOEK_NAME_CELL = ".cell__course-name, .cell--fixed, [class*='course-name']";
  var PUNTENBOEK_SCORE_CELL = ".cell--evaluation, [class*='cell--evaluation'], .cell";

  function findPuntenboekRoots() {
    var out = [];
    var roots = contentRoots();
    for (var r = 0; r < roots.length; r++) {
      for (var s = 0; s < PUNTENBOEK_ROOTS.length; s++) {
        var found;
        try {
          found = roots[r].querySelectorAll(PUNTENBOEK_ROOTS[s]);
        } catch (e) {
          continue;
        }
        for (var i = 0; i < found.length; i++) {
          if (out.indexOf(found[i]) === -1) out.push(found[i]);
        }
      }
    }
    return innermostOnly(out);
  }

  /**
   * Badges the puntenboek rows. The percentage is the row total, placed in the
   * name column, right-aligned. Rows that already carry a badge (from the
   * <table> path) are left alone.
   */
  function decoratePuntenboek(roots) {
    var added = 0;
    for (var r = 0; r < roots.length; r++) {
      var rows;
      try {
        rows = roots[r].querySelectorAll(PUNTENBOEK_ROW);
      } catch (e) {
        continue;
      }
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        // A pill left by an earlier build may sit in the wrong place, so an
        // existing badge is checked against its host rather than trusted: if
        // it is not inside the name cell, it is removed and rebuilt below.
        var existing = row.querySelector("[" + BADGE_ATTR + "]");
        if (existing) {
          var nameHost = null;
          try {
            nameHost = row.querySelector(PUNTENBOEK_NAME_CELL);
          } catch (e) {
            nameHost = null;
          }
          if (!nameHost || !nameHost.contains(existing)) {
            if (existing.parentNode) existing.parentNode.removeChild(existing);
          } else {
            continue;
          }
        }
        // Resultaten list rows carry the Gezien box; the puntenboek does not.
        if (row.querySelector("[data-ssc-seen-for]")) continue;

        var sumScore = 0;
        var sumMax = 0;
        var count = 0;
        var cells;
        try {
          cells = row.querySelectorAll(PUNTENBOEK_SCORE_CELL);
        } catch (e) {
          continue;
        }
        for (var c = 0; c < cells.length; c++) {
          var fraction = readFraction(cells[c].textContent);
          if (!fraction) continue;
          sumScore += fraction.score;
          sumMax += fraction.max;
          count++;
        }
        if (!count || sumMax <= 0) continue;

        var nameCell = null;
        try {
          nameCell = row.querySelector(PUNTENBOEK_NAME_CELL);
        } catch (e) {
          nameCell = null;
        }
        if (!nameCell) continue;

        var badge = badgeNode((sumScore / sumMax) * 100);
        badge.className = "ssc-pct";
        if (!appendAfterName(nameCell, badge)) continue;
        added++;
      }
    }
    return added;
  }

  /**
   * Adds one inline badge per grid tile, after the element that holds the
   * fraction. The tile itself is never wrapped, emptied or re-ordered; the
   * badge is a leaf span next to the score. A tile that already has a grid
   * badge is left alone, which is what makes the 250ms rescan idempotent.
   */
  function decorateGridRoots(roots) {
    var added = 0;
    var seenTiles = [];

    for (var r = 0; r < roots.length; r++) {
      var nodes = fractionNodesIn(roots[r]);
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var tile = tileOf(node);
        if (!tile) continue;
        if (seenTiles.indexOf(tile) !== -1) continue;

        var fraction = readFraction(node.textContent);
        if (!fraction) continue;

        // A tile that carries the "Gezien" checkbox is a Resultaten list row,
        // not a puntenboek tile. A badge dropped next to that score lands
        // under the checkbox, which is exactly where the user reported it must
        // not be — the puntenboek table owns those rows.
        if (tile.querySelector("[data-ssc-seen-for]")) continue;
        // A puntenboek row/tile already has its row-total badge in the name
        // column; a second badge in the score column is the exact placement
        // Bug A is about.
        if (tile.querySelector("[" + BADGE_ATTR + "]")) continue;

        var api = pctFromApi(fraction, tile.textContent);
        var pct = api === null ? fraction.pct : api;
        if (!isFinite(pct)) continue;

        var existing = tile.querySelector("[" + GRID_ATTR + "]");
        if (existing) {
          // Already badged: correct it in place if the tile now shows a
          // different score, and never add a second badge.
          refreshGridBadge(existing, pct, fraction);
          seenTiles.push(tile);
          continue;
        }

        var badge = gridBadgeNode(pct, fraction);
        var host = node.parentNode;
        if (host && host !== tile && tile.contains(host)) {
          host.insertBefore(badge, node.nextSibling);
        } else {
          // The score node WAS the tile (a button whose whole label is the
          // fraction). Inserting after it would add a sibling tile to the
          // grid; append inside the tile instead.
          tile.appendChild(badge);
        }

        seenTiles.push(tile);
        added++;
      }
    }

    return added;
  }

  function inject() {
    if (!current.on) return 0;
    if (!looksLikeResultsPage()) {
      removeBadges();
      return 0;
    }
    var tables = findTables();
    var puntenboek = findPuntenboekRoots();
    var grids = findGridRoots();
    current.tables = tables;
    current.grids = grids;

    if (!tables.length && !puntenboek.length && !grids.length) {
      removeBadges();
      return 0;
    }
    ensureStyle();
    // The pill's tier colour depends on whether this theme is dark or light.
    watchScheme();
    var total = 0;
    // Puntenboek first: its rows are the authoritative subject rows, so a
    // <table> path must not get first pick and put a badge under a checkbox.
    if (puntenboek.length) total += decoratePuntenboek(puntenboek);
    for (var i = 0; i < tables.length; i++) total += decorateTable(tables[i]);
    if (grids.length) total += decorateGridRoots(grids);
    // Badges that belong to a row/tile Smartschool has since replaced are
    // stale; both views share the same marker, so this counts both.
    current.count = document.querySelectorAll("[" + BADGE_ATTR + "]").length;
    return total;
  }

  /* ---------- grades ---------- */

  function loadGrades(force) {
    var now = Date.now();
    if (!force && current.grades && now - current.gradeStamp < 60000) {
      return Promise.resolve(current.grades);
    }
    if (typeof window.sscFetchGrades !== "function") return Promise.resolve(null);
    return window
      .sscFetchGrades()
      .then(function (grades) {
        current.grades = grades || [];
        current.gradeStamp = Date.now();
        return current.grades;
      })
      .catch(function () {
        // No API access (offline, or a page the service worker cannot reach):
        // the row text alone is enough, so this is not a failure.
        return current.grades;
      });
  }

  /* ---------- observers ---------- */

  /**
   * Smartschool swaps the content root when the user navigates. Without this,
   * the badges would only appear on a page that happened to be open when a
   * setting changed — clicking through to Resultaten would show nothing.
   * Only the root's own children are watched, so a ticking widget clock below
   * it cannot trigger a rescan.
   */
  var routeObserver = null;
  var routeTimer = null;

  function onRouteChange() {
    if (!current.on) return;
    if (!looksLikeResultsPage()) {
      unbindObserver();
      removeBadges();
      return;
    }
    loadGrades(false).then(function () {
      if (!current.on) return;
      inject();
      bindObserver();
    });
  }

  function ensureRouteWatch() {
    if (routeObserver || typeof MutationObserver !== "function") return;
    var roots = contentRoots();
    if (!roots.length) return;
    routeObserver = new MutationObserver(function () {
      if (routeTimer) window.clearTimeout(routeTimer);
      routeTimer = window.setTimeout(function () {
        routeTimer = null;
        onRouteChange();
      }, 400);
    });
    try {
      routeObserver.observe(roots[0], { childList: true });
    } catch (e) {
      routeObserver = null;
    }
  }

  function stopRouteWatch() {
    if (routeObserver) {
      routeObserver.disconnect();
      routeObserver = null;
    }
    if (routeTimer) {
      window.clearTimeout(routeTimer);
      routeTimer = null;
    }
  }

  function schedule() {
    if (current.timer) window.clearTimeout(current.timer);
    current.timer = window.setTimeout(function () {
      current.timer = null;
      inject();
    }, 250);
  }

  /**
   * The one node worth watching. Preferred: the results container itself,
   * because it wraps BOTH views and survives the toggle between them — a
   * table's parent goes quiet the moment Smartschool swaps the table for the
   * grid, and the grid's parent goes quiet on the way back.
   *
   * Fallbacks, in order: the table's parent (whether or not the table itself
   * is replaced, its parent is not), then the grid's parent. Never body.
   */
  function observeTarget() {
    var container = null;
    try {
      // The puntenboek matrix first: it survives the table/grid toggle inside
      // it, so one observer covers both.
      container = document.querySelector(
        ".table-page, [class*='table-page__container'], .results-evaluations, [class*='results-evaluations']"
      );
    } catch (e) {
      container = null;
    }
    if (container && !isExcluded(container)) return container;

    if (current.tables.length) {
      // The table's parent, not the table: the SPA replaces the table itself
      // on a filter change, and an observer on the table would go quiet with
      // it.
      return current.tables[0].parentNode || current.tables[0];
    }
    if (current.grids.length) {
      var parent = current.grids[0].parentNode || current.grids[0];
      if (parent === document.body || parent === document.documentElement) {
        parent = current.grids[0];
      }
      return parent;
    }
    return null;
  }

  function bindObserver() {
    unbindObserver();
    if (!current.on || typeof MutationObserver !== "function") return;

    var target = observeTarget();
    // Never body/documentElement: a ticking widget clock there would re-scan
    // the page several times a second.
    if (!target || target === document.body || target === document.documentElement) return;

    current.observer = new MutationObserver(schedule);
    try {
      current.observer.observe(target, { childList: true, subtree: true });
    } catch (e) {
      current.observer = null;
    }
  }

  function unbindObserver() {
    if (current.observer) {
      current.observer.disconnect();
      current.observer = null;
    }
    if (current.timer) {
      window.clearTimeout(current.timer);
      current.timer = null;
    }
  }

  /* ---------- public API ---------- */

  /**
   * @param {Object} settings  the stored settings object
   */
  function sscPercentagesApply(settings) {
    if (!settings) {
      // content.js always passes the settings object; this fallback keeps the
      // module usable on its own (and survives a future boot-order change).
      if (typeof window.sscGet === "function") {
        window.sscGet().then(function (stored) {
          sscPercentagesApply(stored);
        }, function () {});
      }
      return;
    }
    var on = settings.tablePercentages !== false;
    current.on = on;

    if (!on) {
      unbindObserver();
      stopRouteWatch();
      removeBadges();
      return;
    }

    ensureRouteWatch();

    // No point spending an API call on a page that has no grade table.
    if (!looksLikeResultsPage()) {
      removeBadges();
      return;
    }

    loadGrades(false).then(function () {
      if (!current.on) return;
      inject();
      bindObserver();
    });
  }

  /**
   * The panel's "Herbereken percentages": refetch the grades, drop every
   * badge and build them again. Returns a promise of the number of badges.
   */
  function sscPercentagesRefresh() {
    if (!current.on) return Promise.resolve(0);
    unbindObserver();
    removeBadges();
    return loadGrades(true).then(function () {
      inject();
      bindObserver();
      return current.count;
    });
  }

  /**
   * The status line's badge count. Since both views use BADGE_ATTR, the last
   * injection pass already counted table badges and grid badges together.
   */
  function sscPercentagesCount() {
    return current.count;
  }

  window.sscPercentagesApply = sscPercentagesApply;
  window.sscPercentagesRefresh = sscPercentagesRefresh;
  window.sscPercentagesCount = sscPercentagesCount;
})();
