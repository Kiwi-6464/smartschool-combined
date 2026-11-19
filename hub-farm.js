/**
 * Smartschool Combined — the Hub's farm island.
 *
 * The farm itself is a self-contained game in farm/ (data.js, game.js, css.js, assets/),
 * developed standalone in ../../farm-game and copied here by its build-ext.js. This file
 * only plugs it into the Hub: the game's styles go into the Hub's shadow root, its coins
 * are the arcade balance (window.sscHubEconomy; the farm only ever spends them) and its
 * save lives in the per-user storage under sscFarm3_{userId}.
 *
 * Loaded lazily (lazy.js module "farm").
 */
(function () {
  "use strict";

  if (window.sscSkipPage) return;
  if (window.sscHubFarm) return;

  var HOLDER_CSS =
    ".farm-holder { flex: 1; display: flex; min-height: max(540px, calc(100vh - 190px)); }" +
    ".farm-holder > .fg { flex: 1; height: auto; min-height: inherit; border-radius: 18px; }";

  /** The student's teachers, from the grades cache the Cijfers pages already keep (no extra request). [] when there is none yet. */
  function teacherNames() {
    if (typeof window.sscGetGradesCache !== "function") return Promise.resolve([]);
    return window.sscGetGradesCache().then(function (entry) {
      var seen = {};
      ((entry && entry.grades) || []).forEach(function (g) {
        if (g && typeof g.leerkracht === "string" && g.leerkracht.trim()) seen[g.leerkracht.trim()] = true;
      });
      return Object.keys(seen).slice(0, 30);
    }, function () { return []; });
  }

  function mount(holder, shadow) {
    var eco = window.sscHubEconomy;
    var game = null;
    var offCoins = null;
    var dead = false;

    if (!eco || !window.FarmGame || !window.FARM_CSS) {
      var msg = document.createElement("div");
      msg.className = "hub-empty";
      msg.textContent = "De boerderij kon niet laden.";
      holder.appendChild(msg);
      return { dispose: function () {}, setHour: function () {} };
    }

    if (!shadow.querySelector("#ssc-farm-css")) {
      var style = document.createElement("style");
      style.id = "ssc-farm-css";
      style.textContent = window.FARM_CSS + HOLDER_CSS;
      shadow.appendChild(style);
    }

    var root = document.createElement("div");
    holder.appendChild(root);

    Promise.resolve(eco.ready()).then(function () {
      var key = "sscFarm3_" + eco.uid();
      return Promise.all([eco.load(key), teacherNames()]).then(function (out) {
        var state = out[0];
        if (dead) return;
        game = window.FarmGame.mount(root, {
          base: chrome.runtime.getURL("farm/assets/"),
          teachers: out[1],
          state: state || null,
          wallet: { get: eco.coins, spend: eco.take },
          onSave: function (s) {
            eco.save(key, s);
          },
        });
        offCoins = eco.onChange(function () {
          if (game) game.refreshCoins();
        });
      });
    });

    return {
      dispose: function () {
        dead = true;
        if (offCoins) offCoins();
        if (game) game.dispose();
      },
      setHour: function () {},
    };
  }

  window.sscHubFarm = { mount: mount };
})();
