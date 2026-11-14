/**
 * Smartschool Combined — the 3D plant and the pet for the start page.
 *
 *   plant3d  a potted plant built from CSS 3D planes: a 16-sided tapered
 *            pot, a stem of two crossed planes, leaves spiralling round it
 *            at the golden angle, flowers on top. Five stages. The water
 *            meter drains in real time and below 20 % the plant wilts. One
 *            day of sunlight is collected on every day you visit; stages 4
 *            and 5 need enough sun days.
 *   pet      "Huisdier": a cat or a dog, tamagotchi-style, from layered CSS
 *            3D shapes. Four stats (honger, energie, humeur, band) drift in
 *            real time, the mood follows them; feed, play, pet and sleep.
 *
 * Both keep their state per Smartschool user, in chrome.storage.local under
 * sscPlantWidget_{userId} / sscPetWidget_{userId}, mirrored to the Realtime
 * Database (plants/{userId}, pets/{userId}) through background.js so a
 * reinstall finds it again. Whichever copy changed last wins. A key without
 * the user id (an older build) is moved to the user's key once and removed.
 *
 * Only transform and opacity animate. Everything stops while the card is
 * dragged, in the bag, in edit mode or while the tab is hidden.
 *
 * Rendered by widgets.js through window.sscWidgetGames[name](body, api),
 * like the games. Loaded lazily with the widgets (lazy.js).
 */
(function () {
  "use strict";

  if (window.sscSkipPage) return;
  if (window.sscWidget3dCss) return;

  var SVG_NS = "http://www.w3.org/2000/svg";
  var HOUR = 3600 * 1000;
  var DAY = 24 * HOUR;

  function h(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function svg(tag, attrs, parent) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      node.setAttribute(k, String(attrs[k]));
    });
    if (parent) parent.appendChild(node);
    return node;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function num(v) {
    v = Number(v);
    return isFinite(v) ? v : 0;
  }

  /** "#rrggbb" times a brightness factor. */
  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16);
    var r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
    var g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
    var b = clamp(Math.round((n & 255) * f), 0, 255);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  /** Light from the front left: 1 facing it, about .6 facing away. */
  function lightAt(deg) {
    return 0.62 + 0.4 * Math.max(0, Math.cos(((deg + 35) * Math.PI) / 180));
  }

  function dayKey(t) {
    var d = new Date(t);
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    return d.getFullYear() + "-" + (m.length < 2 ? "0" + m : m) + "-" + (day.length < 2 ? "0" + day : day);
  }

  function duration(ms) {
    var min = Math.max(1, Math.ceil(ms / 60000));
    if (min < 60) return min + "m";
    var hours = Math.floor(min / 60);
    var rest = min % 60;
    return hours + "u" + (rest ? " " + rest + "m" : "");
  }

  /** True while the card must not run: dragged, in the bag, edit mode, hidden tab. */
  function frozen(node) {
    if (!node || !node.isConnected || document.hidden) return true;
    if (document.body && document.body.classList.contains("ssc-widget-edit-mode")) return true;
    return !!node.closest(".ssc-widget-dragging, .ssc-widget-preview, .ssc-widget-bag");
  }

  /** Small line icons for the buttons, in the widgets' icon style. */
  var ICONS = {
    drop: ["M12 3.5c3.6 4.3 5.6 7.4 5.6 10.1a5.6 5.6 0 0 1-11.2 0c0-2.7 2-5.8 5.6-10.1z"],
    sun: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"],
    sprout: ["M12 20.5v-8", "M12 12.5c0-4 2.6-6.5 7-6.5 0 4.2-2.7 6.5-7 6.5z", "M12 15c0-3-2.2-5-5.5-5 0 3.2 2.2 5 5.5 5z", "M7.5 20.5h9"],
    bowl: ["M3.5 11.5h17a8.5 8.5 0 0 1-17 0z", "M9 7.5c0-1.4 1.2-2 1.2-3.3M13.5 7.5c0-1.4 1.2-2 1.2-3.3"],
    ball: ["M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z", "M5 7.5c3.5 1.5 4.8 5.6 3.3 12M19 16.5c-3.5-1.5-4.8-5.6-3.3-12"],
    moon: ["M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"],
    alarm: ["M12 6.5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z", "M12 10v3.5l2 1.5M4.5 5.5l3-2.5M19.5 5.5l-3-2.5"],
    back: ["M14.5 6l-6 6 6 6"],
  };

  function icon(name) {
    var node = svg("svg", {
      viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 1.8,
      "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", class: "ssc-3d-icon",
    });
    (ICONS[name] || []).forEach(function (d) {
      svg("path", { d: d }, node);
    });
    return node;
  }

  function button(cls, iconName, label) {
    var b = h("button", "ssc-3d-btn" + (cls ? " " + cls : ""));
    b.type = "button";
    if (iconName) b.appendChild(icon(iconName));
    var text = h("span", null, label);
    b.appendChild(text);
    b.setLabel = function (t) {
      text.textContent = t;
    };
    return b;
  }

  function onPress(node, fn) {
    node.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      fn(e);
    });
  }

  /* ---------- per-user state ---------- */

  /**
   * The Smartschool user id through settings.js (the same helper Team and
   * the league use). The topbar that carries it can arrive after the
   * widgets, so a miss is retried for about four seconds.
   */
  function resolveUser() {
    return new Promise(function (resolve) {
      var tries = 0;
      (function attempt() {
        var get = typeof window.sscGetUserId === "function" ? window.sscGetUserId() : Promise.resolve(null);
        Promise.resolve(get).then(function (id) {
          if (id && id !== "anoniem") {
            resolve(String(id));
            return;
          }
          if (++tries >= 8) {
            resolve(null);
            return;
          }
          window.setTimeout(attempt, 500);
        }, function () {
          resolve(null);
        });
      })();
    });
  }

  function storageGet(keys) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(keys, function (res) {
          resolve((!chrome.runtime.lastError && res) || {});
        });
      } catch (e) {
        resolve({});
      }
    });
  }

  function storageSet(key, value) {
    try {
      var payload = {};
      payload[key] = value;
      chrome.storage.local.set(payload);
    } catch (e) {
      /* Lost on reload; the database copy still has it. */
    }
  }

  function storageRemove(key) {
    try {
      chrome.storage.local.remove(key);
    } catch (e) {
      /* An old key that stays behind is harmless. */
    }
  }

  function ask(msg) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(msg, function (res) {
          resolve(chrome.runtime.lastError ? null : res || null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  /**
   * One widget's state for the signed-in user. `base` is the storage key
   * without the user id, `kind` the database node, `clean` checks a stored
   * value and returns null when it is unusable.
   */
  function UserState(base, kind, clean) {
    this.base = base;
    this.kind = kind;
    this.clean = clean;
    this.userId = null;
    this.key = base + "_local";
  }

  /** Resolves the newest usable state, or null for a fresh start. `legacy` may supply an older shape. */
  UserState.prototype.load = function (legacy) {
    var self = this;
    var online = false;
    var server = null;
    return resolveUser()
      .then(function (uid) {
        self.userId = uid;
        self.key = self.base + "_" + (uid || "local");
        return storageGet([self.key, self.base]);
      })
      .then(function (res) {
        var local = self.clean(res[self.key]);
        // Migration: the key without a user id belongs to whoever opens it first.
        if (res[self.base] !== undefined) {
          if (!local && self.userId) {
            local = self.clean(res[self.base]);
            if (local) storageSet(self.key, local);
          }
          if (self.userId) storageRemove(self.base);
        }
        if (local || !legacy) return local;
        return Promise.resolve(legacy(self.userId)).then(self.clean);
      })
      .then(function (local) {
        if (!self.userId) return local;
        return ask({ type: "ssc:stateGet", kind: self.kind, userId: self.userId }).then(function (res) {
          online = !!(res && res.ok);
          server = online ? self.clean(res.state) : null;
          var pick = server && (!local || server.updatedAt >= local.updatedAt) ? server : local;
          if (pick && pick === local && online) self.push(local);
          if (pick) storageSet(self.key, pick);
          if (pick) self.seenAt = pick.updatedAt || 0;
          return pick;
        });
      });
  };

  UserState.prototype.push = function (state) {
    if (!this.userId) return;
    ask({ type: "ssc:stateSave", kind: this.kind, userId: this.userId, state: state });
  };

  UserState.prototype.save = function (state) {
    state.updatedAt = Math.max(Date.now(), (this.seenAt || 0) + 1);
    this.seenAt = state.updatedAt;
    storageSet(this.key, state);
    this.push(state);
  };

  /*
   * The same plant or pet can be on screen twice (start page grid and the
   * hub). Each copy follows the other's saves, so a 30s tick in one never
   * writes stale stats over what was just done in the other.
   */
  UserState.prototype.watch = function (fn) {
    var self = this;
    function onChange(changes, area) {
      var change = area === "local" && changes[self.key];
      if (!change || !change.newValue) return;
      var next = self.clean(change.newValue);
      if (!next || !(next.updatedAt > (self.seenAt || 0))) return;
      self.seenAt = next.updatedAt;
      fn(next);
    }
    try {
      chrome.storage.onChanged.addListener(onChange);
    } catch (e) {
      return function () {};
    }
    return function () {
      try {
        chrome.storage.onChanged.removeListener(onChange);
      } catch (e) {
        /* Context gone: nothing to remove. */
      }
    };
  };

  /* ---------- the plant ---------- */

  var WATER_DRAIN_MS = 30 * HOUR; // 100 % to 0 %: below 20 % after a day
  var WATER_COOLDOWN_MS = 4 * HOUR;
  var WILT_AT = 20;
  var PLANT_STAGES = [
    { days: 0, sun: 0, name: "Kiempje" },
    { days: 2, sun: 0, name: "Jong plantje" },
    { days: 4, sun: 0, name: "Groeiende plant" },
    { days: 7, sun: 6, name: "Volwassen plant" },
    { days: 11, sun: 10, name: "In bloei" },
  ];

  /*
   * Geometry per stage: stem height, leaf count and length, buds, flowers.
   * Heights are px above the soil.
   */
  var PLANT_SHAPES = [
    { stem: 18, leaves: 2, leaf: 17, buds: 0, flowers: 0 },
    { stem: 42, leaves: 4, leaf: 23, buds: 0, flowers: 0 },
    { stem: 70, leaves: 7, leaf: 28, buds: 0, flowers: 0 },
    { stem: 96, leaves: 10, leaf: 31, buds: 3, flowers: 0 },
    { stem: 112, leaves: 12, leaf: 32, buds: 0, flowers: 3 },
  ];

  function cleanPlant(p) {
    if (!p || typeof p !== "object" || !(num(p.plantedAt) > 0)) return null;
    if (p.v !== 2) {
      // The flat plant of 3.0.0: days with water and sun, no meter.
      var watered = num(p.lastWaterAt);
      var days = Math.max(0, Math.floor(num(p.days)));
      return {
        v: 2,
        plantedAt: num(p.plantedAt),
        growthDays: days,
        lastGrowAt: num(p.lastDayAt) || num(p.plantedAt),
        water: watered ? 100 : 60,
        waterAt: watered || num(p.plantedAt),
        lastWaterAt: watered,
        sunDays: days,
        lastSunDay: "",
        updatedAt: num(p.updatedAt),
      };
    }
    return {
      v: 2,
      plantedAt: num(p.plantedAt),
      growthDays: Math.max(0, Math.floor(num(p.growthDays))),
      lastGrowAt: num(p.lastGrowAt),
      water: clamp(num(p.water), 0, 100),
      waterAt: num(p.waterAt),
      lastWaterAt: num(p.lastWaterAt),
      sunDays: Math.max(0, Math.floor(num(p.sunDays))),
      lastSunDay: /^\d{4}-\d{2}-\d{2}$/.test(p.lastSunDay) ? p.lastSunDay : "",
      updatedAt: num(p.updatedAt),
    };
  }

  function waterLevel(p, now) {
    return clamp(p.water - ((now - p.waterAt) / WATER_DRAIN_MS) * 100, 0, 100);
  }

  function plantStageOf(p) {
    var stage = 0;
    for (var i = 1; i < PLANT_STAGES.length; i++) {
      if (p.growthDays >= PLANT_STAGES[i].days && p.sunDays >= PLANT_STAGES[i].sun) stage = i;
      else break;
    }
    return stage;
  }

  /**
   * A visit: today's sunlight, and a growth day when 24 h have passed and the
   * plant is not wilted. Returns what happened.
   */
  function settlePlant(p, now) {
    var out = { sun: false, grew: false };
    var today = dayKey(now);
    if (p.lastSunDay !== today) {
      p.sunDays += 1;
      p.lastSunDay = today;
      out.sun = true;
    }
    if (now - p.lastGrowAt >= DAY && waterLevel(p, now) >= WILT_AT) {
      p.growthDays += 1;
      p.lastGrowAt = now;
      out.grew = true;
    }
    return out;
  }

  var POT = { n: 16, h: 50, top: 33, bottom: 25, rim: 35, rimH: 9, color: "#c8693e", rimColor: "#de7e4e" };

  function buildPot(rig) {
    var pot = h("div", "ssc-p3-pot");
    var slant = Math.atan2(POT.top - POT.bottom, POT.h);
    var len = Math.sqrt(POT.h * POT.h + (POT.top - POT.bottom) * (POT.top - POT.bottom));
    var mid = (POT.top + POT.bottom) / 2;
    var w = 2 * POT.top * Math.tan(Math.PI / POT.n) + 0.8;
    var inset = (50 * POT.bottom) / POT.top;
    var clip = "polygon(0 0,100% 0," + (50 + inset).toFixed(1) + "% 100%," + (50 - inset).toFixed(1) + "% 100%)";
    var rimW = 2 * POT.rim * Math.tan(Math.PI / POT.n) + 0.8;
    for (var i = 0; i < POT.n; i++) {
      var a = (i * 360) / POT.n;
      var side = h("span", "ssc-p3-face");
      side.style.cssText =
        "width:" + w.toFixed(2) + "px;height:" + len.toFixed(2) + "px;left:" + (-w / 2).toFixed(2) + "px;top:" +
        (-POT.h / 2 - len / 2).toFixed(2) + "px;clip-path:" + clip + ";background:linear-gradient(" +
        shade(POT.color, lightAt(a) * 1.04) + "," + shade(POT.color, lightAt(a) * 0.86) + ");transform:rotateY(" + a +
        "deg) translateZ(" + mid.toFixed(2) + "px) rotateX(" + ((-slant * 180) / Math.PI).toFixed(2) + "deg)";
      pot.appendChild(side);
      var rim = h("span", "ssc-p3-face");
      rim.style.cssText =
        "width:" + rimW.toFixed(2) + "px;height:" + POT.rimH + "px;left:" + (-rimW / 2).toFixed(2) + "px;top:" +
        (-POT.h - POT.rimH + 3) + "px;background:" + shade(POT.rimColor, lightAt(a)) + ";transform:rotateY(" + a +
        "deg) translateZ(" + POT.rim + "px)";
      pot.appendChild(rim);
    }
    // The rim's flat top and the soil inside it.
    var lip = h("span", "ssc-p3-disc ssc-p3-lip");
    lip.style.cssText = "width:" + POT.rim * 2 + "px;height:" + POT.rim * 2 + "px;left:" + -POT.rim + "px;top:" +
      -POT.rim + "px;transform:translateY(" + (-POT.h - POT.rimH + 3) + "px) rotateX(90deg)";
    pot.appendChild(lip);
    var soil = h("span", "ssc-p3-disc ssc-p3-soil");
    var sr = POT.rim - 4;
    soil.style.cssText = "width:" + sr * 2 + "px;height:" + sr * 2 + "px;left:" + -sr + "px;top:" + -sr +
      "px;transform:translateY(" + (-POT.h - 2) + "px) rotateX(90deg)";
    pot.appendChild(soil);
    rig.appendChild(pot);
  }

  var LEAF_UPPER = "M0 10C8 1.5 26 0 40 10Z";
  var LEAF_LOWER = "M0 10C9 18.5 27 20 40 10Z";

  function leafSvg(len, base, f) {
    var node = svg("svg", { viewBox: "0 0 40 20", width: len, height: len / 2, class: "ssc-p3-leaf" });
    svg("path", { d: LEAF_UPPER, fill: shade(base, f * 1.12) }, node);
    svg("path", { d: LEAF_LOWER, fill: shade(base, f * 0.84) }, node);
    svg("path", { d: "M1.5 10L36 10", stroke: shade(base, f * 0.7), "stroke-width": 0.9, fill: "none" }, node);
    return node;
  }

  function flowerSvg(size, petal, open) {
    var node = svg("svg", { viewBox: "-20 -20 40 40", width: size, height: size, class: "ssc-p3-bloom" });
    var count = open ? 6 : 5;
    for (var layer = 0; layer < (open ? 2 : 1); layer++) {
      for (var i = 0; i < count; i++) {
        var a = (i * 360) / count + layer * 30;
        svg("ellipse", {
          cx: 0, cy: open ? -9 + layer * 2.5 : -5, rx: open ? 5.6 - layer : 4, ry: open ? 9 - layer * 2 : 6,
          fill: shade(petal, layer ? 1.08 : 0.95), transform: "rotate(" + a + ")",
        }, node);
      }
    }
    svg("circle", { r: open ? 4.4 : 3.4, fill: open ? "#ffd45c" : shade(petal, 0.8) }, node);
    if (open) svg("circle", { r: 2, cx: -1, cy: -1, fill: "#fff2b8" }, node);
    return node;
  }

  /** The stem, leaves and flowers of one stage. */
  function buildPlantShape(stage, wilted) {
    var shape = PLANT_SHAPES[stage];
    var green = wilted ? "#8e9a4a" : "#3f9f55";
    var stemColor = wilted ? "#7d8a46" : "#357f44";
    var group = h("div", "ssc-p3-plant");
    var sway = h("div", "ssc-p3-sway");
    group.appendChild(sway);

    for (var s = 0; s < 2; s++) {
      var stem = h("span", "ssc-p3-stem");
      stem.style.cssText = "height:" + shape.stem + "px;top:" + -shape.stem + "px;background:linear-gradient(90deg," +
        shade(stemColor, 0.75) + "," + shade(stemColor, 1.25) + "," + shade(stemColor, 0.75) + ");transform:rotateY(" +
        s * 90 + "deg)";
      sway.appendChild(stem);
    }

    for (var i = 0; i < shape.leaves; i++) {
      var t = (i + 1) / (shape.leaves + 1);
      var y = stage === 0 ? shape.stem - 2 : 6 + t * (shape.stem - 14);
      var angle = stage === 0 ? i * 180 : (i * 137.5) % 360;
      var len = shape.leaf * (stage === 0 ? 1 : 1.08 - t * 0.38);
      var lift = wilted ? -38 + t * 8 : 18 + t * 22;
      var node = h("span", "ssc-p3-node");
      node.style.transform = "translateY(" + (-y).toFixed(1) + "px) rotateY(" + angle.toFixed(1) + "deg)";
      var leafWrap = h("span", "ssc-p3-leafwrap");
      leafWrap.style.transform = "rotateZ(" + (-lift).toFixed(1) + "deg) rotateX(" + (wilted ? 30 : 12) + "deg)";
      leafWrap.appendChild(leafSvg(len, green, lightAt(angle + 90)));
      node.appendChild(leafWrap);
      sway.appendChild(node);
    }

    // Buds and flowers: one on top, the rest on short side branches.
    var heads = shape.flowers || shape.buds;
    var petal = wilted ? "#c9a0aa" : "#f27aa4";
    for (var f = 0; f < heads; f++) {
      var open = shape.flowers > 0;
      var size = open ? (f === 0 ? 30 : 24) : 13;
      var holder = h("span", "ssc-p3-node");
      if (f === 0) {
        holder.style.transform = "translateY(" + -shape.stem + "px)";
      } else {
        var by = shape.stem * (0.32 + f * 0.16);
        holder.style.transform = "translateY(" + (-by).toFixed(1) + "px) rotateY(" + (f === 1 ? 15 : 165) + "deg) rotateZ(52deg)";
        var branch = h("span", "ssc-p3-stem ssc-p3-branch");
        branch.style.cssText = "height:30px;top:-30px;background:" + shade(stemColor, 1.05);
        holder.appendChild(branch);
      }
      var bloomWrap = h("span", "ssc-p3-bloomwrap");
      // rotateX(+) turns the flower's face up towards the camera; wilted ones hang.
      bloomWrap.style.transform = (f === 0 ? "" : "translateY(-30px) rotateZ(-52deg) ") +
        "rotateX(" + (wilted ? -20 : 48) + "deg)" + (wilted ? " rotateZ(30deg)" : "");
      bloomWrap.appendChild(flowerSvg(size, petal, open));
      holder.appendChild(bloomWrap);
      sway.appendChild(holder);
    }
    return group;
  }

  function plant3d(body, api) {
    var root = h("div", "ssc-p3");
    body.appendChild(root);
    var state = new UserState("sscPlantWidget", "plant", cleanPlant);
    var plant = null;
    var loaded = false;
    var built = "";
    var lastWaterPaint = -1;

    var head = h("div", "ssc-3d-head");
    var title = h("div", "ssc-3d-title", "Je plant");
    var sub = h("div", "ssc-3d-sub", "Laden…");
    head.appendChild(title);
    head.appendChild(sub);
    root.appendChild(head);

    var scene = h("div", "ssc-p3-scene");
    var glow = h("div", "ssc-p3-glow");
    var rig = h("div", "ssc-p3-rig");
    var shadow = h("span", "ssc-p3-disc ssc-p3-shadow");
    rig.appendChild(shadow);
    buildPot(rig);
    var plantSlot = h("div", "ssc-p3-slot");
    rig.appendChild(plantSlot);
    var fx = h("div", "ssc-p3-fx");
    var toast = h("div", "ssc-p3-toast");
    scene.appendChild(glow);
    scene.appendChild(rig);
    scene.appendChild(fx);
    scene.appendChild(toast);
    root.appendChild(scene);

    var meters = h("div", "ssc-p3-meters");
    var waterRow = h("div", "ssc-p3-meter");
    waterRow.setAttribute("data-kind", "water");
    var waterTop = h("div", "ssc-p3-meter-top");
    waterTop.appendChild(icon("drop"));
    waterTop.appendChild(h("span", null, "Water"));
    var waterPct = h("b", null, "");
    waterTop.appendChild(waterPct);
    var waterBar = h("div", "ssc-3d-bar");
    var waterFill = h("span", null);
    waterBar.appendChild(waterFill);
    waterRow.appendChild(waterTop);
    waterRow.appendChild(waterBar);
    var sunRow = h("div", "ssc-p3-meter");
    sunRow.setAttribute("data-kind", "sun");
    var sunTop = h("div", "ssc-p3-meter-top");
    sunTop.appendChild(icon("sun"));
    sunTop.appendChild(h("span", null, "Zon"));
    var sunCount = h("b", null, "");
    sunTop.appendChild(sunCount);
    var sunBar = h("div", "ssc-3d-bar");
    var sunFill = h("span", null);
    sunBar.appendChild(sunFill);
    sunRow.appendChild(sunTop);
    sunRow.appendChild(sunBar);
    meters.appendChild(waterRow);
    meters.appendChild(sunRow);
    root.appendChild(meters);

    var hint = h("div", "ssc-3d-hint", "");
    root.appendChild(hint);
    var actions = h("div", "ssc-3d-actions");
    var waterBtn = button("ssc-3d-btn--water", "drop", "Water geven");
    var plantBtn = button("ssc-3d-btn--primary", "sprout", "Planten");
    actions.appendChild(waterBtn);
    actions.appendChild(plantBtn);
    root.appendChild(actions);

    function paintShape(now) {
      var key = plant ? plantStageOf(plant) + ":" + (waterLevel(plant, now) < WILT_AT ? 1 : 0) : "none";
      if (key === built) return false;
      var grew = built && plant && built.split(":")[0] !== key.split(":")[0];
      built = key;
      plantSlot.textContent = "";
      if (!plant) return false;
      var parts = key.split(":");
      var shape = buildPlantShape(Number(parts[0]), parts[1] === "1");
      if (grew) shape.setAttribute("data-grow", "1");
      plantSlot.appendChild(shape);
      root.setAttribute("data-wilted", parts[1]);
      return grew;
    }

    function paint() {
      var now = Date.now();
      paintShape(now);
      root.setAttribute("data-planted", plant ? "1" : "0");
      if (!loaded) return;
      if (!plant) {
        title.textContent = "Nog geen plant";
        sub.textContent = "Plant een zaadje, het groeit meteen.";
        hint.textContent = "";
        return;
      }
      var stage = plantStageOf(plant);
      var level = waterLevel(plant, now);
      title.textContent = PLANT_STAGES[stage].name;
      sub.textContent = "Fase " + (stage + 1) + " van 5 · " + plant.growthDays + (plant.growthDays === 1 ? " groeidag" : " groeidagen");

      var rounded = Math.round(level);
      if (rounded !== lastWaterPaint) {
        lastWaterPaint = rounded;
        waterPct.textContent = rounded + "%";
        waterFill.style.transform = "scaleX(" + (level / 100).toFixed(3) + ")";
        waterRow.setAttribute("data-low", level < WILT_AT ? "1" : level < 40 ? "2" : "0");
      }
      var next = PLANT_STAGES[stage + 1];
      var sunGoal = next && next.sun ? next.sun : Math.max(plant.sunDays, 10);
      sunCount.textContent = plant.sunDays + (next && next.sun ? "/" + next.sun : "");
      sunRow.title = plant.sunDays + (plant.sunDays === 1 ? " zonnedag" : " zonnedagen") + (next && next.sun ? ", " + next.sun + " nodig voor de volgende fase" : "");
      sunFill.style.transform = "scaleX(" + Math.min(1, plant.sunDays / sunGoal).toFixed(3) + ")";

      if (level < WILT_AT) {
        hint.textContent = "Je plant verwelkt. Geef water, anders groeit hij niet verder.";
      } else if (!next) {
        hint.textContent = "Volgroeid en in bloei. Blijf hem water geven.";
      } else if (plant.growthDays >= next.days && plant.sunDays < next.sun) {
        var need = next.sun - plant.sunDays;
        hint.textContent = "Nog " + need + (need === 1 ? " zonnedag" : " zonnedagen") + " nodig voor de volgende fase.";
      } else {
        var dueIn = plant.lastGrowAt + DAY - now;
        var left = next.days - plant.growthDays;
        hint.textContent = (dueIn > 0 ? "Volgende groeidag over " + duration(dueIn) + ". " : "") +
          "Nog " + left + (left === 1 ? " groeidag" : " groeidagen") + " tot de volgende fase.";
      }

      var wait = plant.lastWaterAt ? plant.lastWaterAt + WATER_COOLDOWN_MS - now : 0;
      waterBtn.disabled = wait > 0 || level >= 99;
      waterBtn.setLabel(wait > 0 ? "Water geven · " + duration(wait) : level >= 99 ? "Water is vol" : "Water geven");
    }

    function showToast(text) {
      toast.textContent = text;
      toast.removeAttribute("data-on");
      void toast.offsetWidth;
      toast.setAttribute("data-on", "1");
      api.later(function () {
        toast.removeAttribute("data-on");
      }, 2400);
    }

    function rain() {
      fx.textContent = "";
      for (var i = 0; i < 14; i++) {
        var drop = h("span", "ssc-p3-drop");
        drop.style.left = "calc(50% + " + Math.round(-26 + Math.random() * 52) + "px)";
        drop.style.animationDelay = (i * 0.07 + Math.random() * 0.12).toFixed(2) + "s";
        fx.appendChild(drop);
      }
      var ripple = h("span", "ssc-p3-ripple");
      fx.appendChild(ripple);
      api.later(function () {
        fx.textContent = "";
      }, 1900);
    }

    function sunburst() {
      glow.removeAttribute("data-on");
      void glow.offsetWidth;
      glow.setAttribute("data-on", "1");
    }

    onPress(plantBtn, function () {
      var now = Date.now();
      plant = { v: 2, plantedAt: now, growthDays: 0, lastGrowAt: now, water: 55, waterAt: now, lastWaterAt: 0,
        sunDays: 0, lastSunDay: "", updatedAt: now };
      settlePlant(plant, now);
      state.save(plant);
      built = "";
      paint();
      plantSlot.firstChild && plantSlot.firstChild.setAttribute("data-grow", "1");
      sunburst();
      showToast("Geplant! Geef het water.");
    });

    onPress(waterBtn, function () {
      if (!plant || waterBtn.disabled) return;
      var now = Date.now();
      plant.water = 100;
      plant.waterAt = now;
      plant.lastWaterAt = now;
      var out = settlePlant(plant, now);
      state.save(plant);
      rain();
      api.later(function () {
        paint();
        if (out.grew) showToast("Gegroeid!");
      }, 650);
    });

    /* Parallax: the rig follows the pointer over the scene. */
    var tilt = { x: 0, y: 0, frame: 0 };
    function applyTilt() {
      tilt.frame = 0;
      rig.style.transform = "rotateX(" + (-16 + tilt.y * 9).toFixed(2) + "deg) rotateY(" + (tilt.x * 26).toFixed(2) + "deg) scale3d(1.3,1.3,1.3)";
    }
    scene.addEventListener("pointermove", function (e) {
      var r = scene.getBoundingClientRect();
      tilt.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      tilt.y = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      if (!tilt.frame) tilt.frame = window.requestAnimationFrame(applyTilt);
    });
    scene.addEventListener("pointerleave", function () {
      tilt.x = 0;
      tilt.y = 0;
      if (!tilt.frame) tilt.frame = window.requestAnimationFrame(applyTilt);
    });

    function syncPause() {
      if (frozen(root)) root.setAttribute("data-paused", "1");
      else root.removeAttribute("data-paused");
    }
    document.addEventListener("visibilitychange", syncPause);
    api.onDispose(function () {
      document.removeEventListener("visibilitychange", syncPause);
      if (tilt.frame) window.cancelAnimationFrame(tilt.frame);
    });
    api.every(syncPause, 1000);
    api.every(function () {
      if (!plant) return;
      var out = settlePlant(plant, Date.now());
      if (out.sun || out.grew) state.save(plant);
      paint();
      if (out.sun) sunburst();
    }, 30000);

    root.setAttribute("data-loading", "1");
    paint();
    state.load(function (uid) {
      return storageGet(["sscWidgetData"]).then(function (res) {
        // The flat plant kept its copy in the widget data, tagged with the user.
        var data = res.sscWidgetData || {};
        var old = data.plant2;
        return old && old.plant && (!old.user || old.user === (uid || "")) ? old.plant : null;
      });
    }).then(function (found) {
      plant = found;
      loaded = true;
      api.onDispose(state.watch(function (next) {
        plant = next;
        paint();
      }));
      root.removeAttribute("data-loading");
      if (plant) {
        var out = settlePlant(plant, Date.now());
        if (out.sun || out.grew) state.save(plant);
        paint();
        if (out.sun) {
          sunburst();
          showToast("+1 zonnedag");
        } else if (out.grew) {
          showToast("Gegroeid!");
        }
      } else {
        paint();
      }
    });
  }

  /* ---------- the pet ---------- */

  var PET_FOODS = [
    { id: "vis", name: "Vis", pet: "cat" },
    { id: "bot", name: "Bot", pet: "dog" },
    { id: "melk", name: "Melk", pet: "cat" },
    { id: "vlees", name: "Vlees", pet: "dog" },
    { id: "muis", name: "Muis", pet: "cat" },
    { id: "stukvlees", name: "Stuk vlees", pet: "dog" },
  ];

  var PET_LOOK = {
    cat: { fur: "#eea35f", dark: "#cf7b3a", light: "#fbcf9c", belly: "#fff0dc", inner: "#f4aeb0", nose: "#ef8797", name: "Minou" },
    dog: { fur: "#d7a46e", dark: "#ad7444", light: "#f0c995", belly: "#fbeedb", inner: "#8d5a35", nose: "#2b2422", name: "Rex" },
  };

  var MOOD_LABEL = {
    slaapt: "Slaapt",
    hongerig: "Hongerig",
    slaperig: "Slaperig",
    blij: "Blij",
    verdrietig: "Verdrietig",
    tevreden: "Tevreden",
  };

  function cleanPet(p) {
    if (!p || typeof p !== "object" || !(num(p.adoptedAt) > 0)) return null;
    if (p.species !== "cat" && p.species !== "dog") return null;
    var name = String(p.name || "").trim().slice(0, 16);
    return {
      v: 1,
      species: p.species,
      name: name || PET_LOOK[p.species].name,
      adoptedAt: num(p.adoptedAt),
      honger: clamp(num(p.honger), 0, 100),
      energie: clamp(num(p.energie), 0, 100),
      humeur: clamp(num(p.humeur), 0, 100),
      band: clamp(num(p.band), 0, 100),
      tickAt: num(p.tickAt) || Date.now(),
      sleepingSince: num(p.sleepingSince),
      pettedAt: num(p.pettedAt),
      updatedAt: num(p.updatedAt),
    };
  }

  /** Real time passes: hunger and energy drift, mood follows them. */
  function tickPet(p, now) {
    var hours = Math.min(24 * 14, Math.max(0, (now - p.tickAt) / HOUR));
    p.tickAt = now;
    if (!hours) return false;
    if (p.sleepingSince) {
      p.energie += 22 * hours;
      p.honger -= 2 * hours;
      if (p.energie >= 100) {
        p.energie = 100;
        p.sleepingSince = 0;
      }
    } else {
      p.energie -= 3 * hours;
      p.honger -= 4 * hours;
    }
    var upset = (p.honger < 30 ? 2 : 0) + (p.energie < 20 ? 1.5 : 0);
    p.humeur -= (1.5 + upset) * hours;
    if (p.humeur < 25) p.band -= 0.3 * hours;
    p.honger = clamp(p.honger, 0, 100);
    p.energie = clamp(p.energie, 0, 100);
    p.humeur = clamp(p.humeur, 0, 100);
    p.band = clamp(p.band, 0, 100);
    return true;
  }

  function moodOf(p) {
    if (p.sleepingSince) return "slaapt";
    if (p.honger < 30) return "hongerig";
    if (p.energie < 20) return "slaperig";
    if (p.humeur >= 70) return "blij";
    if (p.humeur < 30) return "verdrietig";
    return "tevreden";
  }

  /** Absolutely placed part: left/top/size in px around the rig origin, plus a depth. */
  function part(cls, x, y, w, hgt, z, extra) {
    var node = h("span", "ssc-pt-part " + cls);
    node.style.cssText = "width:" + w + "px;height:" + hgt + "px;left:" + (x - w / 2) + "px;top:" + (y - hgt / 2) +
      "px;transform:translateZ(" + (z || 0) + "px)" + (extra || "");
    return node;
  }

  /**
   * The pet as nested 3D layers around the rig origin (on the floor, in the
   * middle). Returns the nodes the widget animates.
   */
  function buildPet(species) {
    var look = PET_LOOK[species];
    var cat = species === "cat";
    var pet = h("div", "ssc-pt-pet");
    pet.setAttribute("data-species", species);
    pet.style.setProperty("--fur", look.fur);
    pet.style.setProperty("--fur-dark", look.dark);
    pet.style.setProperty("--fur-light", look.light);
    pet.style.setProperty("--belly", look.belly);
    pet.style.setProperty("--inner", look.inner);
    pet.style.setProperty("--nose", look.nose);

    var hop = h("div", "ssc-pt-hop");
    var breathe = h("div", "ssc-pt-breathe");
    hop.appendChild(breathe);
    pet.appendChild(hop);

    // Tail behind the body.
    var tailWrap = part("ssc-pt-tailwrap", cat ? 34 : 38, cat ? -40 : -46, 0, 0, -30);
    var tail = h("span", "ssc-pt-tail");
    if (cat) {
      var tailSvg = svg("svg", { viewBox: "0 0 40 60", width: 40, height: 60 }, tail);
      svg("path", { d: "M4 56C20 50 30 40 26 26S20 6 32 4", fill: "none", stroke: look.fur, "stroke-width": 9, "stroke-linecap": "round" }, tailSvg);
      svg("path", { d: "M28.5 9C30 6 31 5 32 4", fill: "none", stroke: look.dark, "stroke-width": 9, "stroke-linecap": "round" }, tailSvg);
    }
    tailWrap.appendChild(tail);
    breathe.appendChild(tailWrap);

    // Back feet, body with its belly, front paws.
    breathe.appendChild(part("ssc-pt-foot", -27, -9, 28, 18, -14));
    breathe.appendChild(part("ssc-pt-foot", 27, -9, 28, 18, -14));
    var bodyNode = part("ssc-pt-body", 0, -48, cat ? 92 : 100, 76, 0);
    bodyNode.appendChild(part("ssc-pt-belly", (cat ? 92 : 100) / 2, 48, 52, 44, 1));
    breathe.appendChild(bodyNode);
    breathe.appendChild(part("ssc-pt-paw", -17, -9, 24, 17, 26));
    breathe.appendChild(part("ssc-pt-paw", 17, -9, 24, 17, 26));
    var collar = part("ssc-pt-collar", 0, -80, 62, 9, 20);
    collar.appendChild(part("ssc-pt-tag", 31, 10, 11, 11, 2));
    breathe.appendChild(collar);

    // The head, in front of the body.
    var headWrap = part("ssc-pt-headwrap", 0, -116, 0, 0, 22);
    var bob = h("div", "ssc-pt-bob");
    headWrap.appendChild(bob);
    breathe.appendChild(headWrap);

    var earL;
    var earR;
    if (cat) {
      earL = part("ssc-pt-ear", -29, -38, 34, 38, -6, " rotateZ(-14deg)");
      earR = part("ssc-pt-ear", 29, -38, 34, 38, -6, " rotateZ(14deg)");
      earL.appendChild(h("span", "ssc-pt-ear-in"));
      earR.appendChild(h("span", "ssc-pt-ear-in"));
    } else {
      earL = part("ssc-pt-ear", -47, -6, 30, 54, 4, " rotateZ(16deg)");
      earR = part("ssc-pt-ear", 47, -6, 30, 54, 4, " rotateZ(-16deg)");
    }
    earL.setAttribute("data-side", "l");
    earR.setAttribute("data-side", "r");
    bob.appendChild(earL);
    bob.appendChild(earR);
    bob.appendChild(part("ssc-pt-head", 0, 0, cat ? 104 : 98, cat ? 86 : 90, 0));

    var face = part("ssc-pt-face", 0, 0, 0, 0, 3);
    bob.appendChild(face);
    var eyes = [];
    [-20, 20].forEach(function (x) {
      var eye = part("ssc-pt-eye", x, -6, 21, 24, 0);
      var iris = h("span", "ssc-pt-iris");
      iris.appendChild(h("span", "ssc-pt-shine"));
      eye.appendChild(iris);
      eye.appendChild(h("span", "ssc-pt-lid"));
      face.appendChild(eye);
      eyes.push(iris);
    });
    face.appendChild(part("ssc-pt-cheek", -33, 13, 16, 9, 1));
    face.appendChild(part("ssc-pt-cheek", 33, 13, 16, 9, 1));
    if (cat) {
      face.appendChild(part("ssc-pt-muzzle", -6, 14, 15, 12, 4));
      face.appendChild(part("ssc-pt-muzzle", 6, 14, 15, 12, 4));
      var whiskers = svg("svg", { viewBox: "0 0 120 30", width: 120, height: 30, class: "ssc-pt-whiskers" });
      ["M6 8L34 14", "M4 17L34 17", "M6 26L34 20", "M114 8L86 14", "M116 17L86 17", "M114 26L86 20"].forEach(function (d) {
        svg("path", { d: d }, whiskers);
      });
      var wh = part("ssc-pt-whiskerwrap", 0, 15, 120, 30, 5);
      wh.appendChild(whiskers);
      face.appendChild(wh);
    } else {
      face.appendChild(part("ssc-pt-muzzle", 0, 15, 46, 32, 5));
    }
    face.appendChild(part("ssc-pt-nose", 0, cat ? 9 : 7, cat ? 11 : 19, cat ? 8 : 13, cat ? 8 : 12));
    var mouthWrap = part("ssc-pt-mouthwrap", 0, cat ? 17 : 22, 30, 16, cat ? 7 : 11);
    var mouth = svg("svg", { viewBox: "0 0 30 16", width: 30, height: 16, class: "ssc-pt-mouth" });
    svg("path", { class: "ssc-pt-smile", d: cat ? "M5 4C7 9 12 9 15 4C18 9 23 9 25 4" : "M6 3C9 10 21 10 24 3" }, mouth);
    svg("path", { class: "ssc-pt-frown", d: "M8 11C11 5 19 5 22 11" }, mouth);
    mouthWrap.appendChild(mouth);
    mouthWrap.appendChild(part("ssc-pt-tongue", 15, 13, 10, 11, 0));
    face.appendChild(mouthWrap);

    return { node: pet, hop: hop, tail: tail, eyes: eyes, head: headWrap };
  }

  var HEART = "M12 20.5S3.5 15.2 3.5 9.3A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8.5 2.7c0 5.9-8.5 11.2-8.5 11.2z";

  function pet3d(body, api) {
    var root = h("div", "ssc-pt");
    body.appendChild(root);
    var state = new UserState("sscPetWidget", "pet", cleanPet);
    var pet = null;
    var view = null;
    var draft = { species: "", name: "" };

    function syncPause() {
      if (frozen(root)) root.setAttribute("data-paused", "1");
      else root.removeAttribute("data-paused");
    }
    document.addEventListener("visibilitychange", syncPause);
    api.every(syncPause, 1000);

    /* Eyes follow the pointer anywhere on the page. */
    var gaze = { x: 0, y: 0, frame: 0 };
    function applyGaze() {
      gaze.frame = 0;
      if (!view || !view.pet) return;
      var r = view.pet.head.getBoundingClientRect();
      var dx = gaze.x - r.left;
      var dy = gaze.y - r.top;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var reach = Math.min(1, d / 140);
      view.root.style.setProperty("--gx", ((dx / d) * reach * 3.6).toFixed(2) + "px");
      view.root.style.setProperty("--gy", ((dy / d) * reach * 3.2).toFixed(2) + "px");
    }
    function onPointer(e) {
      gaze.x = e.clientX;
      gaze.y = e.clientY;
      if (!gaze.frame && !root.hasAttribute("data-paused")) gaze.frame = window.requestAnimationFrame(applyGaze);
    }
    window.addEventListener("pointermove", onPointer, { passive: true });
    api.onDispose(function () {
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", syncPause);
      if (gaze.frame) window.cancelAnimationFrame(gaze.frame);
    });

    /* ---- setup: pick a cat or a dog, then a name ---- */

    function renderSetup() {
      view = null;
      root.textContent = "";
      root.setAttribute("data-step", draft.species ? "name" : "pick");
      var head = h("div", "ssc-3d-head");
      head.appendChild(h("div", "ssc-3d-title", draft.species ? "Hoe heet je " + (draft.species === "cat" ? "kat" : "hond") + "?" : "Kies je huisdier"));
      head.appendChild(h("div", "ssc-3d-sub", draft.species ? "Je kunt de naam later niet meer wijzigen." : "Een kat of een hond, jij zorgt ervoor."));
      root.appendChild(head);

      if (!draft.species) {
        var choices = h("div", "ssc-pt-choices");
        [["cat", "Kat"], ["dog", "Hond"]].forEach(function (c) {
          var card = h("button", "ssc-pt-choice");
          card.type = "button";
          var stage = h("div", "ssc-pt-mini");
          var built = buildPet(c[0]);
          stage.appendChild(built.node);
          card.appendChild(stage);
          card.appendChild(h("span", "ssc-pt-choice-label", c[1]));
          onPress(card, function () {
            draft.species = c[0];
            draft.name = "";
            renderSetup();
          });
          choices.appendChild(card);
        });
        root.appendChild(choices);
        return;
      }

      var preview = h("div", "ssc-pt-mini ssc-pt-mini--big");
      preview.appendChild(buildPet(draft.species).node);
      root.appendChild(preview);
      var form = h("form", "ssc-pt-form");
      var input = h("input", "ssc-pt-name");
      input.type = "text";
      input.maxLength = 16;
      input.placeholder = PET_LOOK[draft.species].name;
      input.value = draft.name;
      input.setAttribute("aria-label", "Naam");
      input.addEventListener("input", function () {
        draft.name = input.value;
      });
      input.addEventListener("keydown", function (e) {
        e.stopPropagation();
      });
      form.appendChild(input);
      var row = h("div", "ssc-3d-actions");
      var back = button("", "back", "Terug");
      onPress(back, function () {
        draft.species = "";
        renderSetup();
      });
      var adopt = button("ssc-3d-btn--primary", null, "Adopteren");
      adopt.type = "submit";
      row.appendChild(back);
      row.appendChild(adopt);
      form.appendChild(row);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var now = Date.now();
        pet = cleanPet({
          species: draft.species, name: draft.name.trim() || PET_LOOK[draft.species].name, adoptedAt: now,
          honger: 80, energie: 85, humeur: 75, band: 10, tickAt: now, sleepingSince: 0, pettedAt: 0,
        });
        state.save(pet);
        renderPet();
        say("Hoi! Ik ben " + pet.name + ".");
        hearts(3);
      });
      root.appendChild(form);
      window.setTimeout(function () {
        if (input.isConnected) input.focus();
      }, 30);
    }

    /* ---- the living pet ---- */

    var STATS = [
      ["honger", "Eten"],
      ["energie", "Energie"],
      ["humeur", "Humeur"],
      ["band", "Band"],
    ];

    function renderPet() {
      root.textContent = "";
      root.removeAttribute("data-step");
      var v = { root: root, bars: {}, values: {} };
      view = v;

      var head = h("div", "ssc-3d-head ssc-pt-header");
      v.name = h("div", "ssc-3d-title", pet.name);
      v.mood = h("span", "ssc-pt-mood", "");
      var line = h("div", "ssc-pt-titleline");
      line.appendChild(v.name);
      line.appendChild(v.mood);
      head.appendChild(line);
      root.appendChild(head);

      var scene = h("div", "ssc-pt-scene");
      var rig = h("div", "ssc-pt-rig");
      rig.appendChild(h("span", "ssc-pt-shadow"));
      v.pet = buildPet(pet.species);
      rig.appendChild(v.pet.node);
      scene.appendChild(rig);
      v.fx = h("div", "ssc-pt-fx");
      scene.appendChild(v.fx);
      v.zzz = h("div", "ssc-pt-zzz");
      ["z", "z", "Z"].forEach(function (z, i) {
        var s = h("span", null, z);
        s.style.animationDelay = i * 0.7 + "s";
        v.zzz.appendChild(s);
      });
      scene.appendChild(v.zzz);
      v.bubble = h("div", "ssc-pt-bubble");
      scene.appendChild(v.bubble);
      root.appendChild(scene);

      // Parallax on the rig, a pat on the pet.
      var tilt = { x: 0, y: 0, frame: 0 };
      function applyTilt() {
        tilt.frame = 0;
        rig.style.transform = "rotateX(" + (-8 + tilt.y * 7).toFixed(2) + "deg) rotateY(" + (tilt.x * 24).toFixed(2) + "deg)";
      }
      scene.addEventListener("pointermove", function (e) {
        var r = scene.getBoundingClientRect();
        tilt.x = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
        tilt.y = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
        if (!tilt.frame) tilt.frame = window.requestAnimationFrame(applyTilt);
      });
      scene.addEventListener("pointerleave", function () {
        tilt.x = 0;
        tilt.y = 0;
        if (!tilt.frame) tilt.frame = window.requestAnimationFrame(applyTilt);
      });
      onPress(v.pet.node, stroke);
      v.pet.node.setAttribute("title", "Aaien");

      var stats = h("div", "ssc-pt-stats");
      STATS.forEach(function (s) {
        var row = h("div", "ssc-pt-stat");
        row.setAttribute("data-stat", s[0]);
        var top = h("div", "ssc-pt-stat-top");
        top.appendChild(h("span", null, s[1]));
        v.values[s[0]] = h("b", null, "");
        top.appendChild(v.values[s[0]]);
        var bar = h("div", "ssc-3d-bar");
        v.bars[s[0]] = h("span", null);
        bar.appendChild(v.bars[s[0]]);
        row.appendChild(top);
        row.appendChild(bar);
        stats.appendChild(row);
      });
      root.appendChild(stats);

      v.actions = h("div", "ssc-3d-actions ssc-pt-actions");
      v.feed = button("", "bowl", "Voeren");
      v.play = button("", "ball", "Spelen");
      v.sleep = button("", "moon", "Slapen");
      onPress(v.feed, openFood);
      onPress(v.play, play);
      onPress(v.sleep, toggleSleep);
      v.actions.appendChild(v.feed);
      v.actions.appendChild(v.play);
      v.actions.appendChild(v.sleep);
      root.appendChild(v.actions);

      v.menu = h("div", "ssc-pt-menu");
      PET_FOODS.forEach(function (food) {
        var b = h("button", "ssc-pt-food", food.name);
        b.type = "button";
        onPress(b, function () {
          feed(food);
        });
        v.menu.appendChild(b);
      });
      var close = button("ssc-pt-menu-close", "back", "Terug");
      onPress(close, closeFood);
      v.menu.appendChild(close);
      root.appendChild(v.menu);

      refresh();
      applyGaze();
    }

    function refresh() {
      if (!view || !pet) return;
      var mood = moodOf(pet);
      root.setAttribute("data-mood", mood);
      view.mood.textContent = MOOD_LABEL[mood];
      STATS.forEach(function (s) {
        var value = Math.round(pet[s[0]]);
        view.values[s[0]].textContent = value;
        view.bars[s[0]].style.transform = "scaleX(" + (pet[s[0]] / 100).toFixed(3) + ")";
        view.bars[s[0]].parentNode.setAttribute("data-low", value < 30 ? "1" : "0");
      });
      var sleeping = !!pet.sleepingSince;
      view.sleep.setLabel(sleeping ? "Wakker" : "Slapen");
      view.sleep.replaceChild(icon(sleeping ? "alarm" : "moon"), view.sleep.firstChild);
    }

    var bubbleTimer = 0;
    function say(text) {
      if (!view) return;
      view.bubble.textContent = text;
      view.bubble.setAttribute("data-on", "1");
      if (bubbleTimer) window.clearTimeout(bubbleTimer);
      bubbleTimer = window.setTimeout(function () {
        bubbleTimer = 0;
        if (view) view.bubble.removeAttribute("data-on");
      }, 2600);
    }
    api.onDispose(function () {
      if (bubbleTimer) window.clearTimeout(bubbleTimer);
    });

    function fxNode(cls, life) {
      var node = h("span", cls);
      view.fx.appendChild(node);
      api.later(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, life);
      return node;
    }

    function hearts(count) {
      if (!view) return;
      for (var i = 0; i < count; i++) {
        var heart = fxNode("ssc-pt-heart", 1500);
        var art = svg("svg", { viewBox: "0 0 24 24", width: 18, height: 18 }, heart);
        svg("path", { d: HEART }, art);
        heart.style.left = "calc(50% + " + Math.round(-30 + Math.random() * 60) + "px)";
        heart.style.animationDelay = (i * 0.14).toFixed(2) + "s";
      }
    }

    function bounce(attr, ms) {
      if (!view) return;
      root.removeAttribute(attr);
      void root.offsetWidth;
      root.setAttribute(attr, "1");
      api.later(function () {
        root.removeAttribute(attr);
      }, ms);
    }

    function commit() {
      tickPet(pet, Date.now());
      state.save(pet);
      refresh();
    }

    function stroke() {
      if (!pet) return;
      tickPet(pet, Date.now());
      pet.humeur = clamp(pet.humeur + 10, 0, 100);
      // The bond grows from attention, not from clicking fifty times in a row.
      if (Date.now() - pet.pettedAt > 10 * 60 * 1000) pet.band = clamp(pet.band + 1, 0, 100);
      pet.pettedAt = Date.now();
      hearts(pet.sleepingSince ? 1 : 3);
      bounce("data-pat", 600);
      if (!pet.sleepingSince && Math.random() < 0.35) say(pet.species === "cat" ? "Prrr…" : "Wiff!");
      commit();
    }

    function openFood() {
      if (!pet) return;
      if (pet.sleepingSince) {
        say("Zzz… ik slaap nu.");
        return;
      }
      root.setAttribute("data-menu", "1");
    }

    function closeFood() {
      root.removeAttribute("data-menu");
    }

    function feed(food) {
      closeFood();
      tickPet(pet, Date.now());
      var good = food.pet === pet.species;
      pet.honger = clamp(pet.honger + (good ? 30 : 10), 0, 100);
      pet.humeur = clamp(pet.humeur + (good ? 5 : -5), 0, 100);
      if (good) pet.band = clamp(pet.band + 1, 0, 100);
      var bite = fxNode("ssc-pt-snack", 1300);
      bite.textContent = food.name;
      bounce("data-eat", 1200);
      say(good ? "Mmm, " + food.name.toLowerCase() + "!" : "Bah… " + food.name.toLowerCase() + " is niets voor mij.");
      if (good) api.later(function () {
        hearts(2);
      }, 700);
      commit();
    }

    function play() {
      if (!pet) return;
      tickPet(pet, Date.now());
      if (pet.sleepingSince) {
        say("Zzz… later spelen.");
        return;
      }
      if (pet.honger < 30) {
        say("Ik heb te veel honger om te spelen.");
        bounce("data-no", 500);
        return;
      }
      if (pet.energie < 20) {
        say("Ik ben te moe om te spelen…");
        bounce("data-no", 500);
        return;
      }
      pet.energie = clamp(pet.energie - 15, 0, 100);
      pet.humeur = clamp(pet.humeur + 20, 0, 100);
      pet.band = clamp(pet.band + 2, 0, 100);
      var ball = fxNode("ssc-pt-ball", 1700);
      var art = svg("svg", { viewBox: "0 0 24 24", width: 20, height: 20 }, ball);
      svg("circle", { cx: 12, cy: 12, r: 10.5, fill: "#ffd54a" }, art);
      svg("path", { d: "M4 8c4 1.5 5.5 5.5 4 13M20 16c-4-1.5-5.5-5.5-4-13", fill: "none", stroke: "#fff", "stroke-width": 2 }, art);
      bounce("data-play", 1600);
      api.later(function () {
        say("Nog eens!");
      }, 1300);
      commit();
    }

    function toggleSleep() {
      if (!pet) return;
      tickPet(pet, Date.now());
      if (pet.sleepingSince) {
        pet.sleepingSince = 0;
        say(pet.energie >= 80 ? "Goed geslapen!" : "Hmm… nog moe.");
      } else {
        pet.sleepingSince = Date.now();
        closeFood();
      }
      commit();
    }

    api.every(function () {
      if (!pet || !view) return;
      var wasSleeping = !!pet.sleepingSince;
      tickPet(pet, Date.now());
      if (wasSleeping && !pet.sleepingSince) {
        state.save(pet);
        say("Uitgerust!");
      }
      refresh();
    }, 30000);

    root.appendChild(h("div", "ssc-3d-sub", "Laden…"));
    state.load().then(function (loaded) {
      pet = loaded;
      api.onDispose(state.watch(function (next) {
        var had = !!pet;
        pet = next;
        if (had && view) refresh();
        else renderPet();
      }));
      if (!pet) {
        renderSetup();
        return;
      }
      if (tickPet(pet, Date.now())) state.save(pet);
      renderPet();
      var mood = moodOf(pet);
      if (mood === "hongerig") say("Ik heb honger!");
      else if (mood === "verdrietig") say("Ik heb je gemist…");
      else if (mood !== "slaapt") say("Hoi!");
    });
    syncPause();
  }

  /* ---------- styles ---------- */

  var C = ".ssc-wg-card ";
  window.sscWidget3dCss = [
    // Shared
    C + ".ssc-3d-head { margin-bottom: 4px; }",
    C + ".ssc-3d-title { font-size: 14px; font-weight: 800; line-height: 1.25; }",
    C + ".ssc-3d-sub { font-size: 11.5px; color: var(--ssc-muted); }",
    C + ".ssc-3d-hint { font-size: 11.5px; line-height: 1.4; color: var(--ssc-muted); margin: 6px 0 8px; min-height: 16px; }",
    C + ".ssc-3d-actions { display: flex; flex-wrap: wrap; gap: 6px; }",
    C + ".ssc-3d-icon { width: 15px; height: 15px; flex: none; }",
    C + ".ssc-3d-btn { position: relative; flex: 1 1 0; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 6px;",
    "  min-height: 32px; padding: 6px 9px; border-radius: 10px; cursor: pointer; pointer-events: auto; white-space: nowrap;",
    "  font: inherit; font-size: 12px; font-weight: 700; color: inherit; border: 1px solid var(--ssc-line);",
    "  background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 5%, transparent);",
    "  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 14%, transparent); transition: background .15s, border-color .15s, transform .12s; }",
    C + ".ssc-3d-btn > span { overflow: hidden; text-overflow: ellipsis; }",
    C + ".ssc-3d-btn:not(:disabled):hover { background: var(--ssc-accent-soft); border-color: var(--ssc-accent-ink); }",
    C + ".ssc-3d-btn:not(:disabled):active { transform: scale(.96); }",
    C + ".ssc-3d-btn:disabled { cursor: default; opacity: .55; }",
    C + ".ssc-3d-btn:focus-visible { outline: 2px solid var(--ssc-accent-ink); outline-offset: 2px; }",
    C + ".ssc-3d-btn--primary { border-color: transparent; background: var(--ssc-accent-ink); color: var(--ssc-base00, #fff); }",
    C + ".ssc-3d-btn--primary:not(:disabled):hover { background: color-mix(in srgb, var(--ssc-accent-ink) 86%, #000); border-color: transparent; }",
    C + ".ssc-3d-btn--water .ssc-3d-icon { color: #3d8fd6; }",
    C + ".ssc-3d-bar { height: 6px; border-radius: 6px; overflow: hidden; background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 10%, transparent); }",
    C + ".ssc-3d-bar > span { display: block; height: 100%; border-radius: inherit; transform-origin: 0 50%; transform: scaleX(0);",
    "  transition: transform .7s cubic-bezier(.2,.8,.2,1); background: var(--bar, var(--ssc-accent-ink)); }",
    // Pause: hidden tab, dragged card, bag, edit mode.
    C + ":is(.ssc-p3, .ssc-pt)[data-paused='1'] * { animation-play-state: paused !important; }",

    // Plant
    C + ".ssc-p3 { display: flex; flex-direction: column; }",
    C + ".ssc-p3-scene { position: relative; height: 262px; margin: 2px -4px 6px; border-radius: 16px; overflow: hidden; perspective: 560px;",
    "  perspective-origin: 50% 30%; touch-action: pan-y;",
    "  background: radial-gradient(ellipse 80% 70% at 50% 92%, color-mix(in srgb, var(--ssc-text, #1a1a2e) 9%, transparent), transparent 70%),",
    "    linear-gradient(color-mix(in srgb, var(--ssc-accent-ink) 7%, transparent), transparent 60%); }",
    C + ".ssc-p3-glow { position: absolute; right: -40px; top: -50px; width: 180px; height: 180px; border-radius: 50%; opacity: 0; pointer-events: none;",
    "  background: radial-gradient(circle, rgba(255,214,110,.55), rgba(255,214,110,0) 65%); }",
    C + ".ssc-p3-glow[data-on='1'] { animation: ssc-p3-glow 2.6s ease-out; }",
    "@keyframes ssc-p3-glow { 0% { opacity: 0; transform: scale(.7); } 30% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.15); } }",
    C + ".ssc-p3-rig { position: absolute; left: 50%; top: calc(100% - 16px); width: 0; height: 0; transform-style: preserve-3d;",
    "  transform: rotateX(-16deg) rotateY(0deg) scale3d(1.3,1.3,1.3); transition: transform .35s cubic-bezier(.2,.8,.2,1); }",
    C + ".ssc-p3-rig *, " + C + ".ssc-p3-pot { transform-style: preserve-3d; }",
    C + ".ssc-p3-pot { position: absolute; left: 0; top: 0; }",
    C + ".ssc-p3-face { position: absolute; display: block; backface-visibility: hidden; }",
    C + ".ssc-p3-disc { position: absolute; display: block; border-radius: 50%; }",
    C + ".ssc-p3-shadow { width: 150px; height: 150px; left: -75px; top: -75px; transform: rotateX(90deg);",
    "  background: radial-gradient(circle, rgba(0,0,0,.34), rgba(0,0,0,.12) 38%, rgba(0,0,0,0) 62%); }",
    C + ".ssc-p3-lip { background: radial-gradient(circle, transparent 0 84%, #e58a5b 85%, #c86e43 100%); }",
    C + ".ssc-p3-soil { background: radial-gradient(circle at 40% 35%, #6c4a30, #4a311f 60%, #3a2617 100%);",
    "  box-shadow: inset 0 0 6px rgba(0,0,0,.5); }",
    C + ".ssc-p3-slot { position: absolute; left: 0; top: 0; transform: translateY(" + -(POT.h + 1) + "px); }",
    C + ".ssc-p3-plant, " + C + ".ssc-p3-sway { position: absolute; left: 0; top: 0; width: 0; height: 0; }",
    C + ".ssc-p3-plant[data-grow='1'] { animation: ssc-p3-grow .9s cubic-bezier(.3,1.5,.5,1) both; }",
    "@keyframes ssc-p3-grow { 0% { transform: scale(.55); opacity: .2; } 100% { transform: scale(1); opacity: 1; } }",
    C + ".ssc-p3-sway { transform-origin: 0 0; animation: ssc-p3-sway 4.6s ease-in-out infinite alternate; }",
    "@keyframes ssc-p3-sway { 0% { transform: rotateZ(-2.2deg) rotateX(1.5deg); } 100% { transform: rotateZ(2.2deg) rotateX(-1.5deg); } }",
    C + ".ssc-p3[data-wilted='1'] .ssc-p3-sway { animation: ssc-p3-droop 6s ease-in-out infinite alternate; }",
    "@keyframes ssc-p3-droop { 0% { transform: rotateZ(7deg); } 100% { transform: rotateZ(9.5deg); } }",
    C + ".ssc-p3-stem { position: absolute; display: block; width: 5px; left: -2.5px; border-radius: 3px; }",
    C + ".ssc-p3-branch { width: 3.5px; left: -1.75px; }",
    C + ".ssc-p3-node { position: absolute; left: 0; top: 0; width: 0; height: 0; }",
    C + ".ssc-p3-leafwrap { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-origin: 0 0; }",
    C + ".ssc-p3-leaf { position: absolute; left: 0; top: 0; display: block; transform: translateY(-50%); overflow: visible;",
    "  filter: drop-shadow(0 1px 1px rgba(0,0,0,.18)); }",
    C + ".ssc-p3-bloomwrap { position: absolute; left: 0; top: 0; width: 0; height: 0; }",
    C + ".ssc-p3-bloom { position: absolute; left: 0; top: 0; display: block; transform: translate(-50%,-50%); overflow: visible; }",
    C + ".ssc-p3-fx { position: absolute; inset: 0; pointer-events: none; }",
    C + ".ssc-p3-drop { position: absolute; top: 22px; width: 6px; height: 9px; margin-left: -3px; opacity: 0;",
    "  border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%; background: linear-gradient(#a8dcff, #3d8fd6);",
    "  animation: ssc-p3-drop .75s cubic-bezier(.5,0,.9,.6) both; }",
    "@keyframes ssc-p3-drop { 0% { transform: translateY(0); opacity: 0; } 12% { opacity: 1; } 85% { opacity: 1; } 100% { transform: translateY(150px); opacity: 0; } }",
    C + ".ssc-p3-ripple { position: absolute; left: 50%; top: calc(100% - 92px); width: 76px; height: 16px; margin-left: -38px; border-radius: 50%;",
    "  border: 2px solid rgba(120,190,255,.7); opacity: 0; animation: ssc-p3-ripple .9s ease-out .55s both; }",
    "@keyframes ssc-p3-ripple { 0% { transform: scale(.4); opacity: .9; } 100% { transform: scale(1.4); opacity: 0; } }",
    C + ".ssc-p3-toast { position: absolute; left: 50%; top: 10px; padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700;",
    "  white-space: nowrap; pointer-events: none; opacity: 0; transform: translate(-50%, -6px);",
    "  background: color-mix(in srgb, var(--ssc-base00, #fff) 86%, transparent); color: var(--ssc-text, #1a1a2e);",
    "  box-shadow: 0 4px 14px rgba(0,0,0,.16); transition: opacity .3s ease, transform .3s ease; }",
    C + ".ssc-p3-toast[data-on='1'] { opacity: 1; transform: translate(-50%, 0); }",
    C + ".ssc-p3-meters { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }",
    C + ".ssc-p3-meter-top { display: flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; margin-bottom: 4px; }",
    C + ".ssc-p3-meter-top b { margin-left: auto; font-variant-numeric: tabular-nums; color: var(--ssc-muted); font-weight: 700; }",
    C + ".ssc-p3-meter[data-kind='water'] { --bar: linear-gradient(90deg, #4aa3e8, #6fc2ff); }",
    C + ".ssc-p3-meter[data-kind='water'] .ssc-3d-icon { color: #3d8fd6; }",
    C + ".ssc-p3-meter[data-kind='water'][data-low='2'] { --bar: linear-gradient(90deg, #e3a33d, #f2c45a); }",
    C + ".ssc-p3-meter[data-kind='water'][data-low='1'] { --bar: linear-gradient(90deg, #d9534a, #ef7f63); }",
    C + ".ssc-p3-meter[data-kind='sun'] { --bar: linear-gradient(90deg, #f0b429, #ffd76a); }",
    C + ".ssc-p3-meter[data-kind='sun'] .ssc-3d-icon { color: #e0a020; }",
    C + ".ssc-p3[data-planted='0'] :is(.ssc-p3-meters, .ssc-3d-btn--water, .ssc-p3-slot) { display: none; }",
    C + ".ssc-p3[data-planted='1'] .ssc-3d-btn--primary { display: none; }",
    C + ".ssc-p3[data-loading='1'] .ssc-3d-actions { visibility: hidden; }",

    // Pet
    C + ".ssc-pt { display: flex; flex-direction: column; min-height: 320px; position: relative; }",
    C + ".ssc-pt-titleline { display: flex; align-items: center; gap: 8px; min-width: 0; }",
    C + ".ssc-pt-titleline .ssc-3d-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    C + ".ssc-pt-mood { flex: none; margin-left: auto; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;",
    "  background: var(--ssc-accent-soft); color: var(--ssc-accent-ink); }",
    C + ".ssc-pt[data-mood='hongerig'] .ssc-pt-mood, " + C + ".ssc-pt[data-mood='verdrietig'] .ssc-pt-mood { background: rgba(217,83,74,.14); color: #c9473e; }",
    C + ".ssc-pt[data-mood='slaperig'] .ssc-pt-mood, " + C + ".ssc-pt[data-mood='slaapt'] .ssc-pt-mood { background: rgba(110,120,220,.16); color: #5b63c7; }",
    C + ".ssc-pt-scene { position: relative; height: 196px; margin: 4px -4px 8px; border-radius: 16px; overflow: hidden; perspective: 620px;",
    "  perspective-origin: 50% 35%; touch-action: pan-y;",
    "  background: radial-gradient(ellipse 85% 60% at 50% 96%, color-mix(in srgb, var(--ssc-text, #1a1a2e) 10%, transparent), transparent 70%),",
    "    linear-gradient(color-mix(in srgb, var(--ssc-accent-ink) 8%, transparent), transparent 70%); }",
    C + ".ssc-pt[data-mood='slaapt'] .ssc-pt-scene { background: radial-gradient(ellipse 85% 60% at 50% 96%, rgba(0,0,0,.14), transparent 70%),",
    "    linear-gradient(rgba(60,70,150,.22), rgba(60,70,150,.06) 70%); }",
    C + ".ssc-pt-rig { position: absolute; left: 50%; top: calc(100% - 18px); width: 0; height: 0; transform-style: preserve-3d;",
    "  transform: rotateX(-8deg) rotateY(0deg); transition: transform .35s cubic-bezier(.2,.8,.2,1); }",
    C + ".ssc-pt-rig *, " + C + ".ssc-pt-mini * { transform-style: preserve-3d; }",
    C + ".ssc-pt-shadow { position: absolute; display: block; width: 150px; height: 150px; left: -75px; top: -75px; border-radius: 50%;",
    "  transform: rotateX(90deg); background: radial-gradient(circle, rgba(0,0,0,.32), rgba(0,0,0,.1) 40%, rgba(0,0,0,0) 62%); }",
    C + ".ssc-pt-pet, " + C + ".ssc-pt-hop, " + C + ".ssc-pt-breathe, " + C + ".ssc-pt-bob { position: absolute; left: 0; top: 0; width: 0; height: 0; }",
    C + ".ssc-pt-pet { cursor: pointer; pointer-events: auto; }",
    C + ".ssc-pt-part { position: absolute; display: block; }",
    C + ".ssc-pt-breathe { transform-origin: 0 0; animation: ssc-pt-breathe 3.4s ease-in-out infinite; }",
    "@keyframes ssc-pt-breathe { 0%, 100% { transform: scale(1, 1); } 50% { transform: scale(1.012, 1.035); } }",
    C + ".ssc-pt[data-mood='slaapt'] .ssc-pt-breathe { animation-duration: 5.2s; }",
    C + ".ssc-pt-bob { animation: ssc-pt-bob 3.4s ease-in-out infinite; }",
    "@keyframes ssc-pt-bob { 0%, 100% { transform: translateY(0) rotateZ(0); } 50% { transform: translateY(-1.5px) rotateZ(1.2deg); } }",
    C + ".ssc-pt[data-mood='slaapt'] .ssc-pt-bob { animation: none; transform: translateY(10px) rotateZ(-7deg); }",
    C + ".ssc-pt-body { border-radius: 50% 50% 46% 46% / 58% 58% 42% 42%;",
    "  background: radial-gradient(circle at 34% 26%, var(--fur-light), var(--fur) 48%, var(--fur-dark) 100%);",
    "  box-shadow: inset -6px -8px 14px rgba(0,0,0,.12); }",
    C + ".ssc-pt-belly { border-radius: 50%; background: radial-gradient(circle at 45% 35%, #fff, var(--belly) 70%); opacity: .95; }",
    C + ".ssc-pt-foot, " + C + ".ssc-pt-paw { border-radius: 50% 50% 44% 44% / 60% 60% 40% 40%;",
    "  background: radial-gradient(circle at 40% 30%, var(--fur-light), var(--fur) 70%, var(--fur-dark)); }",
    C + ".ssc-pt-paw { background: radial-gradient(circle at 40% 30%, #fff, var(--belly) 70%, var(--fur-light)); }",
    C + ".ssc-pt-collar { border-radius: 6px; background: linear-gradient(#e2574c, #b8382f); box-shadow: 0 1px 2px rgba(0,0,0,.2); }",
    C + ".ssc-pt-tag { border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff3b0, #e6b53b 60%, #b88a1e); }",
    C + ".ssc-pt-head { border-radius: 50% 50% 46% 46% / 54% 54% 46% 46%;",
    "  background: radial-gradient(circle at 34% 28%, var(--fur-light), var(--fur) 52%, var(--fur-dark) 100%);",
    "  box-shadow: inset -7px -9px 16px rgba(0,0,0,.12), 0 6px 10px rgba(0,0,0,.08); }",
    C + ".ssc-pt-pet[data-species='cat'] .ssc-pt-ear { clip-path: polygon(50% 0, 100% 100%, 0 100%); transform-origin: 50% 100%;",
    "  background: linear-gradient(160deg, var(--fur-light), var(--fur-dark)); transition: transform .4s ease; }",
    C + ".ssc-pt-ear-in { position: absolute; left: 25%; top: 30%; width: 50%; height: 60%; clip-path: polygon(50% 0, 100% 100%, 0 100%); background: var(--inner); }",
    C + ".ssc-pt-pet[data-species='dog'] .ssc-pt-ear { border-radius: 50% 50% 46% 46% / 40% 40% 60% 60%; transform-origin: 50% 8%;",
    "  background: radial-gradient(circle at 40% 30%, color-mix(in srgb, var(--inner) 80%, #fff), var(--inner) 70%); }",
    C + ".ssc-pt[data-mood='blij'] .ssc-pt-pet[data-species='dog'] .ssc-pt-ear[data-side='l'] { animation: ssc-pt-flop-l 1.1s ease-in-out infinite; }",
    C + ".ssc-pt[data-mood='blij'] .ssc-pt-pet[data-species='dog'] .ssc-pt-ear[data-side='r'] { animation: ssc-pt-flop-r 1.1s ease-in-out infinite; }",
    "@keyframes ssc-pt-flop-l { 0%, 100% { transform: translateZ(4px) rotateZ(16deg); } 50% { transform: translateZ(4px) rotateZ(26deg); } }",
    "@keyframes ssc-pt-flop-r { 0%, 100% { transform: translateZ(4px) rotateZ(-16deg); } 50% { transform: translateZ(4px) rotateZ(-26deg); } }",
    C + ".ssc-pt:is([data-mood='verdrietig'], [data-mood='hongerig']) .ssc-pt-pet[data-species='cat'] .ssc-pt-ear[data-side='l'] { transform: translateZ(-6px) rotateZ(-38deg) !important; }",
    C + ".ssc-pt:is([data-mood='verdrietig'], [data-mood='hongerig']) .ssc-pt-pet[data-species='cat'] .ssc-pt-ear[data-side='r'] { transform: translateZ(-6px) rotateZ(38deg) !important; }",
    C + ".ssc-pt-face, " + C + ".ssc-pt-tailwrap { width: 0; height: 0; }",
    C + ".ssc-pt-eye { border-radius: 50%; overflow: hidden; background: radial-gradient(circle at 50% 40%, #fff, #eef1f5); box-shadow: inset 0 -2px 3px rgba(0,0,0,.1); }",
    C + ".ssc-pt-iris { position: absolute; left: 3px; top: 3px; width: 15px; height: 18px; border-radius: 50%;",
    "  background: radial-gradient(circle at 50% 60%, #3a2f2a, #17110f 70%);",
    "  transform: translate(var(--gx, 0px), var(--gy, 0px)); transition: transform .12s ease-out; }",
    C + ".ssc-pt-pet[data-species='cat'] .ssc-pt-iris { background: radial-gradient(ellipse 22% 48% at 50% 55%, #120c0a 0 90%, transparent 100%), radial-gradient(circle at 50% 60%, #9bc25a, #5f8a2c 75%); }",
    C + ".ssc-pt-shine { position: absolute; left: 3px; top: 3px; width: 5px; height: 5px; border-radius: 50%; background: #fff; box-shadow: 6px 7px 0 -1px rgba(255,255,255,.7); }",
    C + ".ssc-pt-lid { position: absolute; inset: -1px; transform-origin: 50% 0; transform: scaleY(0); background: var(--fur);",
    "  animation: ssc-pt-blink 4.8s ease-in-out infinite; }",
    "@keyframes ssc-pt-blink { 0%, 93%, 100% { transform: scaleY(0); } 96% { transform: scaleY(1); } }",
    C + ".ssc-pt[data-mood='slaperig'] .ssc-pt-lid { animation: none; transform: scaleY(.55); }",
    C + ".ssc-pt-eye::after { content: ''; position: absolute; left: 3px; right: 3px; top: 7px; height: 7px; opacity: 0;",
    "  border-bottom: 2.4px solid #4a3028; border-radius: 0 0 50% 50%; }",
    C + ".ssc-pt[data-mood='slaapt'] .ssc-pt-eye { background: transparent; box-shadow: none; }",
    C + ".ssc-pt[data-mood='slaapt'] :is(.ssc-pt-iris, .ssc-pt-lid) { opacity: 0; animation: none; }",
    C + ".ssc-pt[data-mood='slaapt'] .ssc-pt-eye::after { opacity: 1; }",
    C + ".ssc-pt-cheek { border-radius: 50%; background: radial-gradient(#ff9fb0, rgba(255,159,176,0) 70%); opacity: .75; }",
    C + ".ssc-pt-muzzle { border-radius: 50%; background: radial-gradient(circle at 45% 35%, #fff, var(--belly) 75%); }",
    C + ".ssc-pt-nose { border-radius: 40% 40% 50% 50% / 40% 40% 60% 60%; background: radial-gradient(circle at 40% 30%, color-mix(in srgb, var(--nose) 60%, #fff), var(--nose) 60%); }",
    C + ".ssc-pt-whiskers path { stroke: rgba(80,60,50,.45); stroke-width: 1.2; stroke-linecap: round; fill: none; }",
    C + ".ssc-pt-mouth { position: absolute; left: 0; top: 0; overflow: visible; }",
    C + ".ssc-pt-mouth path { fill: none; stroke: #4a3028; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }",
    C + ".ssc-pt-frown { opacity: 0; }",
    C + ".ssc-pt:is([data-mood='verdrietig'], [data-mood='hongerig']) .ssc-pt-smile { opacity: 0; }",
    C + ".ssc-pt:is([data-mood='verdrietig'], [data-mood='hongerig']) .ssc-pt-frown { opacity: 1; }",
    C + ".ssc-pt-tongue { border-radius: 0 0 50% 50%; background: linear-gradient(#ff8a9a, #e8667a); opacity: 0; transform-origin: 50% 0; transform: scaleY(.3); transition: opacity .2s, transform .2s; }",
    C + ".ssc-pt[data-mood='blij'] .ssc-pt-pet[data-species='dog'] .ssc-pt-tongue { opacity: 1; transform: scaleY(1); }",
    C + ".ssc-pt-tail { position: absolute; display: block; left: -6px; top: -56px; width: 40px; height: 60px; transform-origin: 6px 56px;",
    "  animation: ssc-pt-swish 2.6s ease-in-out infinite; }",
    "@keyframes ssc-pt-swish { 0%, 100% { transform: rotateZ(-8deg); } 50% { transform: rotateZ(10deg); } }",
    C + ".ssc-pt-pet[data-species='dog'] .ssc-pt-tail { left: -6px; top: -26px; width: 14px; height: 30px; border-radius: 8px 8px 7px 7px; transform-origin: 7px 28px;",
    "  background: linear-gradient(90deg, var(--fur-dark), var(--fur), var(--fur-light)); animation: ssc-pt-wag .9s ease-in-out infinite; }",
    "@keyframes ssc-pt-wag { 0%, 100% { transform: rotateZ(-24deg); } 50% { transform: rotateZ(26deg); } }",
    C + ".ssc-pt[data-mood='blij'] .ssc-pt-pet[data-species='dog'] .ssc-pt-tail { animation-duration: .4s; }",
    C + ".ssc-pt:is([data-mood='slaapt'], [data-mood='verdrietig']) .ssc-pt-tail { animation: none; }",
    C + ".ssc-pt[data-pat='1'] .ssc-pt-breathe { animation: ssc-pt-pat .6s ease-out; }",
    "@keyframes ssc-pt-pat { 0% { transform: scale(1, 1); } 35% { transform: scale(1.06, .94); } 70% { transform: scale(.98, 1.04); } 100% { transform: scale(1, 1); } }",
    C + ".ssc-pt[data-play='1'] .ssc-pt-hop { animation: ssc-pt-hop .4s ease-in-out 4; }",
    "@keyframes ssc-pt-hop { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-16px); } }",
    C + ".ssc-pt[data-eat='1'] .ssc-pt-mouthwrap { animation: ssc-pt-chew .3s ease-in-out 4; }",
    "@keyframes ssc-pt-chew { 0%, 100% { transform: translateZ(9px) scaleY(1); } 50% { transform: translateZ(9px) scaleY(.6); } }",
    C + ".ssc-pt[data-no='1'] .ssc-pt-bob { animation: ssc-pt-no .5s ease-in-out; }",
    "@keyframes ssc-pt-no { 0%, 100% { transform: rotateY(0); } 25% { transform: rotateY(-18deg); } 75% { transform: rotateY(18deg); } }",
    C + ".ssc-pt-fx { position: absolute; inset: 0; pointer-events: none; }",
    C + ".ssc-pt-heart { position: absolute; top: 46px; margin-left: -9px; opacity: 0; animation: ssc-pt-heart 1.3s ease-out both; }",
    C + ".ssc-pt-heart svg { display: block; fill: #ff5d86; filter: drop-shadow(0 2px 3px rgba(255,93,134,.4)); }",
    "@keyframes ssc-pt-heart { 0% { transform: translateY(10px) scale(.4); opacity: 0; } 20% { opacity: 1; transform: translateY(0) scale(1); } 100% { transform: translateY(-46px) scale(.8); opacity: 0; } }",
    C + ".ssc-pt-ball { position: absolute; left: 50%; bottom: 14px; margin-left: -10px; animation: ssc-pt-ball 1.6s cubic-bezier(.4,0,.6,1) both; }",
    C + ".ssc-pt-ball svg { display: block; filter: drop-shadow(0 3px 3px rgba(0,0,0,.25)); }",
    "@keyframes ssc-pt-ball { 0% { transform: translate(-90px, -70px) rotate(0); opacity: 0; } 10% { opacity: 1; }",
    "  25% { transform: translate(-50px, 0) rotate(120deg); } 45% { transform: translate(-10px, -48px) rotate(240deg); }",
    "  65% { transform: translate(30px, 0) rotate(360deg); } 82% { transform: translate(60px, -26px) rotate(450deg); }",
    "  100% { transform: translate(90px, 0) rotate(540deg); opacity: 0; } }",
    C + ".ssc-pt-snack { position: absolute; left: 50%; top: 30px; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 800; white-space: nowrap;",
    "  background: #fff; color: #5a3a24; box-shadow: 0 4px 10px rgba(0,0,0,.15); animation: ssc-pt-snack 1.1s ease-in both; }",
    "@keyframes ssc-pt-snack { 0% { transform: translate(-50%, -20px) scale(.6); opacity: 0; } 25% { transform: translate(-50%, 0) scale(1); opacity: 1; }",
    "  70% { transform: translate(-50%, 30px) scale(.8); opacity: 1; } 100% { transform: translate(-50%, 46px) scale(.2); opacity: 0; } }",
    C + ".ssc-pt-zzz { position: absolute; left: calc(50% + 30px); top: 40px; pointer-events: none; display: none; }",
    C + ".ssc-pt[data-mood='slaapt'] .ssc-pt-zzz { display: block; }",
    C + ".ssc-pt-zzz span { position: absolute; left: 0; top: 0; font-weight: 800; font-size: 15px; color: #6c74d8; opacity: 0;",
    "  animation: ssc-pt-zzz 2.1s ease-out infinite; }",
    "@keyframes ssc-pt-zzz { 0% { transform: translate(0, 10px) scale(.6); opacity: 0; } 25% { opacity: 1; } 100% { transform: translate(22px, -30px) scale(1.2); opacity: 0; } }",
    C + ".ssc-pt-bubble { position: absolute; left: 50%; top: 10px; max-width: calc(100% - 20px); padding: 5px 11px; border-radius: 12px;",
    "  font-size: 11.5px; font-weight: 700; text-align: center; pointer-events: none; opacity: 0; transform: translate(-50%, -6px) scale(.96);",
    "  background: color-mix(in srgb, var(--ssc-base00, #fff) 92%, transparent); color: var(--ssc-text, #1a1a2e);",
    "  box-shadow: 0 6px 16px rgba(0,0,0,.16); transition: opacity .25s ease, transform .25s ease; }",
    C + ".ssc-pt-bubble[data-on='1'] { opacity: 1; transform: translate(-50%, 0) scale(1); }",
    C + ".ssc-pt-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 12px; margin-bottom: 9px; }",
    C + ".ssc-pt-stat-top { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; margin-bottom: 3px; }",
    C + ".ssc-pt-stat-top b { font-variant-numeric: tabular-nums; color: var(--ssc-muted); }",
    C + ".ssc-pt-stat[data-stat='honger'] { --bar: linear-gradient(90deg, #e9883f, #f4ab5e); }",
    C + ".ssc-pt-stat[data-stat='energie'] { --bar: linear-gradient(90deg, #3fae9d, #64cbb8); }",
    C + ".ssc-pt-stat[data-stat='humeur'] { --bar: linear-gradient(90deg, #e35d95, #f287b2); }",
    C + ".ssc-pt-stat[data-stat='band'] { --bar: linear-gradient(90deg, #7f6ff0, #a294ff); }",
    C + ".ssc-pt-stat .ssc-3d-bar[data-low='1'] { box-shadow: 0 0 0 1px rgba(217,83,74,.45); }",
    C + ".ssc-pt-actions .ssc-3d-btn { flex-direction: column; gap: 3px; min-height: 46px; padding: 6px 4px; font-size: 11.5px; }",
    C + ".ssc-pt-actions .ssc-3d-icon { width: 17px; height: 17px; }",
    C + ".ssc-pt-menu { display: none; grid-template-columns: 1fr 1fr 1fr; gap: 6px; }",
    C + ".ssc-pt[data-menu='1'] .ssc-pt-menu { display: grid; }",
    C + ".ssc-pt[data-menu='1'] .ssc-pt-actions { display: none; }",
    C + ".ssc-pt-food { min-height: 30px; padding: 4px 6px; border-radius: 9px; cursor: pointer; pointer-events: auto; font: inherit; font-size: 11.5px; font-weight: 700;",
    "  color: inherit; border: 1px solid var(--ssc-line); background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 5%, transparent); }",
    C + ".ssc-pt-food:hover { background: var(--ssc-accent-soft); border-color: var(--ssc-accent-ink); }",
    C + ".ssc-pt-menu-close { grid-column: 1 / -1; }",
    // Setup
    C + ".ssc-pt-choices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }",
    C + ".ssc-pt-choice { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px 10px; border-radius: 14px; cursor: pointer;",
    "  pointer-events: auto; font: inherit; color: inherit; border: 1px solid var(--ssc-line); background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 4%, transparent);",
    "  transition: transform .15s ease, border-color .15s, background .15s; }",
    C + ".ssc-pt-choice:hover { transform: translateY(-2px); border-color: var(--ssc-accent-ink); background: var(--ssc-accent-soft); }",
    C + ".ssc-pt-choice-label { font-size: 13px; font-weight: 800; }",
    C + ".ssc-pt-mini { position: relative; width: 100%; height: 118px; perspective: 500px; pointer-events: none; }",
    C + ".ssc-pt-mini .ssc-pt-pet { left: 50%; top: 100%; transform: translateY(-6px) scale(.66) rotateX(-6deg) rotateY(-14deg); }",
    C + ".ssc-pt-mini--big { height: 150px; margin: 6px 0 4px; }",
    C + ".ssc-pt-mini--big .ssc-pt-pet { transform: translateY(-8px) scale(.85) rotateX(-6deg) rotateY(-12deg); }",
    C + ".ssc-pt-form { display: flex; flex-direction: column; gap: 8px; }",
    C + ".ssc-pt-name { font: inherit; font-size: 14px; font-weight: 700; padding: 8px 11px; border-radius: 10px; pointer-events: auto;",
    "  border: 1px solid var(--ssc-line); background: color-mix(in srgb, var(--ssc-base00, #fff) 60%, transparent); color: var(--ssc-text, #1a1a2e); }",
    C + ".ssc-pt-name:focus { outline: 2px solid var(--ssc-accent-ink); outline-offset: 1px; }",
    "@media (prefers-reduced-motion: reduce) { " + C + ":is(.ssc-p3, .ssc-pt) * { animation-duration: .01ms !important; animation-iteration-count: 1 !important; } }",
  ].join("\n");

  /*
   * The farm scene (hub-farm.js) is a second view of the same plant and pet:
   * it shares their state, rules and models instead of copying them.
   */
  window.sscFarmKit = {
    h: h, svg: svg, clamp: clamp, duration: duration, HOUR: HOUR, DAY: DAY,
    UserState: UserState, storageGet: storageGet,
    cleanPlant: cleanPlant, settlePlant: settlePlant, waterLevel: waterLevel, plantStageOf: plantStageOf,
    buildPlantShape: buildPlantShape, PLANT_STAGES: PLANT_STAGES, WILT_AT: WILT_AT, WATER_COOLDOWN_MS: WATER_COOLDOWN_MS,
    cleanPet: cleanPet, tickPet: tickPet, moodOf: moodOf, buildPet: buildPet, PET_FOODS: PET_FOODS, PET_LOOK: PET_LOOK,
    MOOD_LABEL: MOOD_LABEL, HEART: HEART,
  };

  var games = window.sscWidgetGames || (window.sscWidgetGames = {});
  games.plant3d = plant3d;
  games.pet = pet3d;
})();
