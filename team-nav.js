/**
 * Smartschool Combined — the "Team" entry in Smartschool's sub-navigation.
 *
 * Split out of team.js so the manager itself (team.js + league.js, ~130KB)
 * can be loaded on demand: this file only finds the bar and adds the item.
 * Clicking it goes through content.js (window.sscTeamOpenSurfaces), which
 * loads the manager first (lazy.js) and then opens it.
 */
(function () {
  "use strict";

  if (window.sscSkipPage) return;
  if (window.sscTeamMountNav) return;

  /* ---------- the sub-navigation entry (Bug 15) ---------- */

  var NAV_ATTR = "data-ssc-team-btn";

  /*
   * Bars we already put a Team item into. Once per container: if Smartschool
   * strips our item out of a bar that is still on the page, we do not fight
   * it (that fight is a flicker loop). A NEW bar — Smartschool replaced the
   * whole container — gets exactly one item.
   */
  var mountedBars = typeof WeakSet === "function" ? new WeakSet() : null;

  /** Our own nodes: the observer and the scoring both ignore them. */
  function isOurs(node) {
    if (!node || node.nodeType !== 1) return false;
    if (node.hasAttribute(NAV_ATTR)) return true;
    for (var i = 0; i < node.attributes.length; i++) {
      if (node.attributes[i].name.indexOf("data-ssc-") === 0) return true;
    }
    return false;
  }

  /**
   * Smartschool's sub-navigation is the horizontal bar that carries
   * "Resultaten", "Rapporten", "Evaluaties" — no published class name, and it
   * differs per page, so it is found by content: the smallest visible
   * horizontal container whose own text mentions one of those labels and that
   * holds at least two clickable children.
   *
   * Our own Team item is left out of the count. Counting it made the scores
   * shift after every insert, so a different bar won each pass and the item
   * hopped between them: that was the flicker.
   */
  function findSubNav() {
    var labels = /resultaten|rapporten|evaluaties|punten|grid/i;
    var candidates = document.querySelectorAll("nav, div, ul, header");
    var best = null;
    var bestScore = 0;

    for (var i = 0; i < candidates.length; i++) {
      var node = candidates[i];
      if (node.closest && node.closest("#ssc-root")) continue;
      if (isOurs(node)) continue;
      var text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 400) continue;
      if (!labels.test(text)) continue;

      var all = node.querySelectorAll("a, button, [role='tab'], li");
      var clickable = [];
      for (var c = 0; c < all.length; c++) {
        if (!all[c].closest("[" + NAV_ATTR + "]")) clickable.push(all[c]);
      }
      if (clickable.length < 2 || clickable.length > 12) continue;

      var rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      // Horizontal, shallow bar.
      if (rect.height > 120) continue;

      // Prefer the SMALLEST matching container: the outermost `div` that
      // contains the labels is the whole page.
      var score = 1000 - Math.round(rect.width * rect.height / 1000) - clickable.length;
      if (score > bestScore) {
        bestScore = score;
        best = node;
      }
    }
    return best;
  }

  function mountSubNavItem() {
    // Already on the page: leave it exactly where it is. Never remove and
    // re-add; never move it to a bar that happens to score higher now.
    if (document.querySelector("[" + NAV_ATTR + "]")) return true;

    var bar = findSubNav();
    if (!bar) return false;
    // We filled this bar before and Smartschool took the item out again:
    // stop here instead of re-adding it on every render.
    if (mountedBars && mountedBars.has(bar)) return false;

    // Copy an existing sibling so the new item inherits Smartschool's exact
    // classes, hover behaviour and spacing instead of guessing at them.
    var sample = bar.querySelector("a, button, [role='tab']");
    var item;
    if (sample && sample.cloneNode) {
      item = sample.cloneNode(false);
      item.removeAttribute("href");
      item.removeAttribute("id");
      item.removeAttribute("data-id");
      item.textContent = "Team";
      item.setAttribute("role", "tab");
      item.removeAttribute("aria-selected");
    } else {
      item = document.createElement("button");
      item.type = "button";
      item.textContent = "Team";
    }
    item.setAttribute(NAV_ATTR, "1");
    item.setAttribute("aria-label", "Mijn Team openen");
    item.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.sscTeamOpenSurfaces === "function") window.sscTeamOpenSurfaces();
    });

    bar.appendChild(item);
    if (mountedBars) mountedBars.add(bar);
    return true;
  }

  /** True when every added/removed node in the batch is one of ours. */
  function onlyOurMutations(records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var lists = [r.addedNodes, r.removedNodes];
      for (var l = 0; l < lists.length; l++) {
        for (var n = 0; n < lists[l].length; n++) {
          var node = lists[l][n];
          if (node.nodeType === 3 && !(node.textContent || "").trim()) continue;
          if (!isOurs(node)) return false;
        }
      }
    }
    return true;
  }

  function watchSubNav() {
    mountSubNavItem();
    if (typeof MutationObserver !== "function") return;
    var target = document.querySelector("main") || document.body;
    if (!target) return;
    var timer = null;
    var mo = new MutationObserver(function (records) {
      if (onlyOurMutations(records)) return;
      // Real debounce: wait for 250ms of quiet, then check once.
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        timer = null;
        mountSubNavItem();
      }, 250);
    });
    mo.observe(target, { childList: true, subtree: true });
  }

  var previousLayerHook = window.sscOnLayerRemount;
  window.sscOnLayerRemount = function (layer) {
    if (previousLayerHook) {
      try {
        previousLayerHook(layer);
      } catch (e) {
        /* Another module's failure is not ours. */
      }
    }
    mountSubNavItem();
  };

  window.sscTeamMountNav = mountSubNavItem;

  if (typeof window.sscGet === "function") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", watchSubNav, { once: true });
    } else {
      watchSubNav();
    }
  }
})();
