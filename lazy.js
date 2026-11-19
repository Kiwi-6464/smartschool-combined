/**
 * Smartschool Combined — on-demand modules.
 *
 * The heavy parts (Ultimate Team + league, the TI-84 link, the start-page
 * widgets) are not in the manifest's content script list. They are injected
 * the first time something needs them: background.js runs
 * chrome.scripting.executeScript into this tab and frame, which puts them in
 * the same isolated world as every other content script, so they see the
 * same `window.ssc*` globals.
 *
 *   window.sscLoadModule("team").then(function () { window.sscTeamOpen(); });
 *
 * A module that is already there (the test harness loads everything up
 * front) resolves at once without a message.
 */
(function () {
  "use strict";

  if (window.sscSkipPage) return;
  if (window.sscLoadModule) return;

  var MODULES = {
    team: {
      files: ["league.js", "team.js"],
      ready: function () { return typeof window.sscTeamRender === "function"; },
    },
    ti84: {
      files: ["ti84.js"],
      ready: function () { return !!window.sscTi84; },
    },
    widgets: {
      files: ["widget-games.js", "widget-3d.js", "widgets.js", "widget-system.js"],
      ready: function () { return typeof window.sscWidgetSystemStart === "function"; },
    },
    hub: {
      files: ["hub-games.js", "hub.js"],
      ready: function () { return typeof window.sscHubOpen === "function"; },
    },
    welcome: {
      files: ["welcome.js"],
      ready: function () { return !!window.sscWelcome; },
    },
    // Owner only: the admin board, and the popup for messages the owner sends.
    admin: {
      files: ["admin.js"],
      ready: function () { return typeof window.sscAdminOpen === "function"; },
    },
    announce: {
      files: ["announce.js"],
      ready: function () { return typeof window.sscAnnounceShow === "function"; },
    },
    // Cube Dash (Geometry Dash style) and Poker, opened from the Arcade.
    arcade2: {
      files: ["hub-geometry.js", "hub-poker.js"],
      ready: function () { return !!(window.sscHubGames && window.sscHubGames.geometry && window.sscHubGames.poker); },
    },
    chess: {
      files: ["chess-engine.js", "chess-bot.js", "hub-chess.js"],
      ready: function () { return !!window.sscHubChess; },
    },
    // The farm game (farm/, copied from ../../farm-game) plus hub-farm.js, which plugs it into the Hub.
    farm: {
      files: ["farm/assets/atlas.js", "farm/assets/masks.js", "farm/data.js", "farm/css.js", "farm/game.js", "hub-farm.js"],
      ready: function () { return !!window.sscHubFarm; },
    },
  };

  var pending = {};

  function sscLoadModule(name) {
    var mod = MODULES[name];
    if (!mod) return Promise.reject(new Error("unknown module " + name));
    if (mod.ready()) return Promise.resolve(true);
    if (pending[name]) return pending[name];

    pending[name] = new Promise(function (resolve, reject) {
      try {
        chrome.runtime.sendMessage({ type: "ssc:inject", files: mod.files }, function (res) {
          var err = chrome.runtime.lastError;
          if (err || !res || !res.ok || !mod.ready()) {
            delete pending[name];
            reject(new Error((err && err.message) || (res && res.error) || "inject failed"));
            return;
          }
          resolve(true);
        });
      } catch (e) {
        delete pending[name];
        reject(e);
      }
    });
    return pending[name];
  }

  window.sscLoadModule = sscLoadModule;
})();
