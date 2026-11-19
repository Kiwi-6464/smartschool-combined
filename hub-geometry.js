/**
 * Smartschool Combined — "Cube Dash": a rhythm-platformer in the style of Geometry Dash, drawn on a canvas.
 * Original code, levels and art (no assets from the real game). Lazy module "arcade2" (lazy.js).
 *
 *   window.sscHubGames.geometry(stage, side, api)    same contract as Mines / Plinko (see hub-games.js)
 *   window.sscHubGames.geometryTest                  the pure engine (levels, step, solver) for tests/geometry.js
 *
 * The simulation is a fixed 120 Hz step that never touches the DOM, so the harness can prove every level is
 * beatable (a search over all press/release timings) and the renderer only draws what the engine says.
 * Flat, classic look (no glow). Modes: cube (hold to jump), ship (hold to rise), ball (tap to flip gravity); pads, orbs, gravity and speed portals,
 * practice mode with checkpoints, particles, parallax and an optional chiptune made with WebAudio.
 * A first clear of each level pays arcade coins once.
 */
(function () {
  "use strict";

  if (window.sscSkipPage) return;
  window.sscHubGames = window.sscHubGames || {};
  if (window.sscHubGames.geometry) return;

  /* ====================================================================== */
  /* Engine (pure)                                                           */
  /* ====================================================================== */

  var DT = 1 / 120;
  var SPEED = 10.4, G = 78, V0 = 19.4, CEIL = 9;
  var PAD_V = 26.5, ORB_V = 18, SHIP_A = 40, SHIP_V = 9.2, BALL_G = 64, VMAX = 34;
  var STEP_TOL = 0.2;

  /** Level builder: a cursor walks to the right and drops obstacles. */
  function Builder() {
    this.o = [];
    this.x = 12;
    this.portals = [];
  }
  Builder.prototype = {
    gap: function (n) { this.x += n; return this; },
    spike: function (n, y, down) {
      for (var i = 0; i < (n || 1); i++) this.o.push({ t: "spike", x: this.x + i, y: y || 0, up: !down });
      this.x += n || 1;
      return this;
    },
    block: function (w, h, y) {
      this.o.push({ t: "block", x: this.x, y: y || 0, w: w || 1, h: h || 1 });
      this.x += w || 1;
      return this;
    },
    /** an extra object next to the cursor that does not advance it */
    at: function (dx, o) { o.x = this.x + dx; this.o.push(o); return this; },
    pit: function (w) { this.o.push({ t: "pit", x: this.x, w: w }); this.x += w; return this; },
    pad: function (y) { this.o.push({ t: "pad", x: this.x, y: y || 0 }); this.x += 1; return this; },
    orb: function (y) { this.o.push({ t: "orb", x: this.x, y: y }); this.x += 1; return this; },
    portal: function (kind) { this.portals.push({ t: "portal", x: this.x, k: kind }); this.x += 1; return this; },
    /** floor + ceiling blocks that leave a corridor between lo and hi (y values), n blocks long */
    tunnel: function (n, lo, hi) {
      if (lo > 0) this.o.push({ t: "block", x: this.x, y: 0, w: n, h: lo });
      if (hi < CEIL) this.o.push({ t: "block", x: this.x, y: hi, w: n, h: CEIL - hi });
      this.x += n;
      return this;
    },
    finish: function (name, pal, speed, reward) {
      var end = this.x + 8;
      var objs = this.o.concat(this.portals);
      objs.sort(function (a, b) { return a.x - b.x; });
      var pits = [], blocks = [], spikes = [], pads = [], ports = [];
      objs.forEach(function (o) {
        if (o.t === "block") { o.x1 = o.x + o.w; o.y1 = o.y + o.h; blocks.push(o); }
        else if (o.t === "spike") spikes.push(o);
        else if (o.t === "pit") pits.push(o);
        else if (o.t === "portal") ports.push(o);
        else pads.push(o);
      });
      return { name: name, pal: pal, speed: speed || SPEED, reward: reward, end: end, objs: objs, blocks: blocks, spikes: spikes, pits: pits, pads: pads, portals: ports };
    },
  };

  function buildLevels() {
    var L = [];

    // 1 — first steps: cube only
    var b = new Builder();
    b.gap(6).spike(1).gap(7).spike(1).gap(6).spike(2).gap(7).block(1, 1).gap(6).block(3, 1).gap(5).spike(1).gap(6);
    b.spike(1).gap(1).spike(1).gap(8).block(1, 1).gap(1).block(1, 2).gap(8).pit(3).gap(7).spike(3).gap(8);
    b.block(2, 1).gap(2).block(2, 1).gap(2).block(2, 1).gap(7).pad(0).gap(6).spike(2).gap(8).orb(1.6).gap(7).spike(2).gap(6);
    b.block(4, 1).at(1, { t: "spike", y: 1, up: true }).gap(5).spike(1).gap(6).pit(2).gap(5).spike(1).gap(1).spike(1).gap(7);
    b.block(1, 1).gap(5).block(1, 1).gap(5).block(1, 1).gap(9);
    L.push(b.finish("Eerste stappen", { top: "#2f6df0", bot: "#1d46c4", block: "#ffffff", spike: "#ffffff", glow: "#7fb0ff", ground: "#0a1f6b", line: "#ffffff" }, SPEED, 40));

    // 2 — neon rocket: cube, then a ship tunnel
    b = new Builder();
    b.gap(6).spike(2).gap(6).block(1, 1).gap(5).spike(1).gap(1).spike(1).gap(1).spike(1).gap(7).pad(0).gap(3).block(2, 3).gap(6);
    b.pit(3).gap(6).spike(2).gap(1).block(1, 1).gap(7).orb(1.8).gap(2).orb(2.4).gap(7).spike(1).gap(7).portal("ship").gap(5);
    b.tunnel(7, 1.5, 6.5).tunnel(5, 3, 8).tunnel(6, 0.5, 5).tunnel(6, 2.5, 7.5).tunnel(5, 1, 6).tunnel(7, 3.5, 8.5).tunnel(6, 1.5, 6.5);
    b.gap(3).portal("cube").gap(6).spike(2).gap(6).block(1, 1).gap(1).block(1, 2).gap(6).spike(1).gap(5).spike(1).gap(6).pad(0).gap(6).spike(3).gap(8);
    L.push(b.finish("Raketstart", { top: "#27b04a", bot: "#127a32", block: "#ffffff", spike: "#ffffff", glow: "#8be8a2", ground: "#073016", line: "#ffffff" }, SPEED, 80));

    // 3 — gravity: flips, ball, faster
    b = new Builder();
    b.gap(6).portal("fast").gap(6).spike(1).gap(7).portal("g-").gap(6).spike(1, CEIL - 1, true).gap(7).spike(2, CEIL - 1, true).gap(6).portal("g+").gap(7);
    b.block(1, 1).gap(6).spike(2).gap(6).pad(0).gap(6).portal("ball").gap(4);
    b.tunnel(18, 2, 5.4);
    b.gap(4).portal("cube").gap(7).spike(1).gap(1).spike(1).gap(7).orb(1.4).gap(3).orb(2.2).gap(7).spike(2).gap(7).portal("ship").gap(5);
    b.tunnel(8, 1, 5).tunnel(6, 3, 7).tunnel(7, 0.5, 4.5).tunnel(7, 2.5, 6.5).tunnel(6, 1, 5);
    b.gap(3).portal("cube").gap(5).portal("g-").gap(6).spike(1, CEIL - 1, true).gap(6).spike(3, CEIL - 1, true).gap(7).portal("g+").gap(6).spike(3).gap(7).pit(3).gap(8);
    L.push(b.finish("Zwaartekracht", { top: "#8a3fd0", bot: "#5a1f9c", block: "#ffffff", spike: "#ffffff", glow: "#c9a0ff", ground: "#240c46", line: "#ffffff" }, SPEED, 150));
    return L;
  }

  function newState(lv) {
    return { x: 0, y: 0, vy: 0, dir: 1, mode: "cube", speed: lv.speed, grounded: true, prev: false, buf: 0, hit: -1, pi: 0, dead: false, won: false, t: 0, rot: 0, why: "" };
  }

  function cloneState(s) {
    var c = {};
    for (var k in s) c[k] = s[k];
    return c;
  }

  function inPit(lv, cx) {
    for (var i = 0; i < lv.pits.length; i++) if (cx > lv.pits[i].x && cx < lv.pits[i].x + lv.pits[i].w) return true;
    return false;
  }

  function die(s, why) {
    s.dead = true;
    s.why = why;
    return s;
  }

  /** One 1/120 s step. held = jump button is down. Mutates and returns s. */
  function step(s, lv, held) {
    if (s.dead || s.won) return s;
    var pressed = held && !s.prev;
    s.prev = held;
    s.buf = pressed ? 0.1 : Math.max(0, s.buf - DT);
    s.x += s.speed * DT;
    s.t += DT;

    while (s.pi < lv.portals.length && lv.portals[s.pi].x <= s.x) {
      var k = lv.portals[s.pi++].k;
      if (k === "cube" || k === "ship" || k === "ball") { s.mode = k; s.vy *= 0.3; }
      else if (k === "g-") { s.dir = -1; s.grounded = false; }
      else if (k === "g+") { s.dir = 1; s.grounded = false; }
      else if (k === "fast") s.speed = lv.speed * 1.243;
      else if (k === "slow") s.speed = lv.speed;
    }

    // pads and orbs
    var cur = -1, i, o;
    for (i = 0; i < lv.pads.length; i++) {
      o = lv.pads[i];
      if (o.x > s.x + 1) break;
      if (o.x + 1 < s.x) continue;
      if (!(s.x + 0.9 > o.x && s.x + 0.1 < o.x + 1)) continue;
      if (o.t === "pad") {
        var pyb = s.dir === 1 ? o.y : CEIL - 0.3 - o.y;
        if (s.y < pyb + 0.3 && s.y + 1 > pyb) {
          cur = i;
          if (s.hit !== i) { s.hit = i; s.vy = s.dir * PAD_V; s.grounded = false; }
        }
      } else if (s.y < o.y + 1.1 && s.y + 1 > o.y - 0.1) {
        cur = i;
        if (s.hit !== i && s.buf > 0 && held) {
          s.hit = i;
          s.buf = 0;
          if (s.mode === "ball") { s.dir = -s.dir; s.vy = s.dir * 4; }
          else s.vy = s.dir * ORB_V;
          s.grounded = false;
        }
      }
    }
    if (cur === -1) s.hit = -1;

    // intent
    if (s.mode === "cube") {
      if (s.grounded && held) { s.vy = s.dir * V0; s.grounded = false; }
      s.vy -= s.dir * G * DT;
    } else if (s.mode === "ship") {
      s.vy += (held ? 1 : -1) * s.dir * SHIP_A * DT;
      if (s.vy > SHIP_V) s.vy = SHIP_V;
      if (s.vy < -SHIP_V) s.vy = -SHIP_V;
    } else {
      if (s.buf > 0 && s.grounded) { s.dir = -s.dir; s.grounded = false; s.buf = 0; s.vy = s.dir * 2; }
      s.vy -= s.dir * BALL_G * DT;
    }
    if (s.vy > VMAX) s.vy = VMAX;
    if (s.vy < -VMAX) s.vy = -VMAX;

    // sideways: any block we now overlap deeper than a small step kills us; a small step is climbed
    var oldY = s.y, b;
    var x0 = s.x + 0.05, x1 = s.x + 0.95;
    for (i = 0; i < lv.blocks.length; i++) {
      b = lv.blocks[i];
      if (b.x > x1) break;
      if (b.x1 <= x0) continue;
      var oy = Math.min(oldY + 1, b.y1) - Math.max(oldY, b.y);
      if (oy <= 0.001 || Math.min(x1, b.x1) - Math.max(x0, b.x) <= 0.001) continue;
      if (oy > STEP_TOL) return die(s, "block");
      if (s.dir === 1 && b.y1 - oldY <= STEP_TOL) { s.y = oldY = b.y1; if (s.vy < 0) s.vy = 0; s.grounded = true; }
      else if (s.dir === -1 && oldY + 1 - b.y <= STEP_TOL) { s.y = oldY = b.y - 1; if (s.vy > 0) s.vy = 0; s.grounded = true; }
      else return die(s, "block");
    }

    // vertical
    s.y += s.vy * DT;
    s.grounded = false;
    var cx = s.x + 0.5;
    if (s.y < 0) {
      if (!inPit(lv, cx)) { s.y = 0; if (s.vy < 0) s.vy = 0; s.grounded = s.dir === 1; }
      else if (s.y < -1.4) return die(s, "pit");
    }
    if (s.y + 1 > CEIL) { s.y = CEIL - 1; if (s.vy > 0) s.vy = 0; s.grounded = s.grounded || s.dir === -1; }
    for (i = 0; i < lv.blocks.length; i++) {
      b = lv.blocks[i];
      if (b.x > x1) break;
      if (b.x1 <= x0) continue;
      if (Math.min(x1, b.x1) - Math.max(x0, b.x) <= 0.001) continue;
      if (Math.min(s.y + 1, b.y1) - Math.max(s.y, b.y) <= 0.001) continue;
      var fromAbove = oldY >= b.y1 - 0.001, fromBelow = oldY + 1 <= b.y + 0.001;
      if (s.dir === 1 && fromAbove && s.vy <= 0) { s.y = b.y1; s.vy = 0; s.grounded = true; }
      else if (s.dir === -1 && fromBelow && s.vy >= 0) { s.y = b.y - 1; s.vy = 0; s.grounded = true; }
      else if (s.mode === "ship" && fromAbove) { s.y = b.y1; if (s.vy < 0) s.vy = 0; }
      else if (s.mode === "ship" && fromBelow) { s.y = b.y - 1; if (s.vy > 0) s.vy = 0; }
      else return die(s, "block");
    }

    // spikes
    for (i = 0; i < lv.spikes.length; i++) {
      o = lv.spikes[i];
      if (o.x > s.x + 1) break;
      if (o.x + 1 < s.x) continue;
      var sy0 = o.up ? o.y : o.y + 0.5;
      if (s.x + 0.8 > o.x + 0.3 && s.x + 0.2 < o.x + 0.7 && s.y + 0.85 > sy0 && s.y + 0.15 < sy0 + 0.5) return die(s, "spike");
    }

    // looks: the cube turns while it is in the air
    if (s.mode === "cube" && !s.grounded) s.rot += s.dir * 6.2 * DT;
    if (s.x >= lv.end) s.won = true;
    return s;
  }

  function stateKey(s) {
    return Math.round(s.y * 40) + "|" + Math.round(s.vy * 12) + "|" + s.dir + s.mode + (s.grounded ? 1 : 0) + (s.prev ? 1 : 0) + "|" + Math.round(s.buf * 60) + "|" + s.hit + "|" + s.pi;
  }

  /** Search over press/release decisions every 1/60 s. { ok, seconds } or { ok:false, x } (furthest x reached). */
  function solve(lv) {
    var cur = {};
    cur[stateKey(newState(lv))] = newState(lv);
    var tick = 0, far = 0;
    for (;;) {
      var next = {}, keys = Object.keys(cur);
      if (!keys.length) return { ok: false, x: far };
      for (var a = 0; a < keys.length; a++) {
        for (var hh = 0; hh < 2; hh++) {
          var c = cloneState(cur[keys[a]]);
          step(c, lv, !!hh);
          if (!c.dead && !c.won) step(c, lv, !!hh);
          if (c.won) return { ok: true, seconds: c.t };
          if (c.dead) continue;
          if (c.x > far) far = c.x;
          var key = stateKey(c);
          if (!next[key]) next[key] = c;
        }
      }
      cur = next;
      // keep the search small: an evenly spread sample is enough, any path that reaches the end is a real one
      var nk = Object.keys(cur);
      if (nk.length > 1500) { var thin = {}, stp = nk.length / 1500; for (var q = 0; q < 1500; q++) thin[nk[Math.floor(q * stp)]] = cur[nk[Math.floor(q * stp)]]; cur = thin; }
      if (++tick > 20000) return { ok: false, x: far };
    }
  }

  window.sscHubGames.geometryTest = { build: buildLevels, newState: newState, step: step, solve: solve, DT: DT, CEIL: CEIL };

  /* ====================================================================== */
  /* UI                                                                      */
  /* ====================================================================== */

  var STORE_KEY = "sscGeometry";

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

  var CSS = [
    ".hg-ghost[hidden] { display: none !important; }",
    ".gd-wrap { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 18px; overflow: hidden; background: #1d46c4; box-shadow: 0 0 0 1px var(--line), 0 24px 50px -24px var(--hb-shade); touch-action: none; user-select: none; }",
    ".gd-wrap canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }",
    ".gd-over { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; color: #fff;",
    "  background: radial-gradient(ellipse at center, rgb(5 8 25 / .35), rgb(5 8 25 / .78)); animation: gd-in .35s ease both; }",
    "@keyframes gd-in { from { opacity: 0; } }",
    ".gd-over[hidden] { display: none; }",
    ".gd-title { font-size: clamp(26px, 6vw, 54px); font-weight: 900; letter-spacing: .04em; text-transform: uppercase; text-shadow: 0 4px 0 rgb(0 0 0 / .45); }",
    ".gd-sub { font-size: 14px; opacity: .85; max-width: 34ch; }",
    ".gd-go { font: inherit; font-size: 16px; font-weight: 900; padding: 12px 28px; border: 0; border-radius: 14px; cursor: pointer; color: #07101f; background: #7dff1f; box-shadow: 0 6px 0 rgb(0 0 0 / .45); }",
    ".gd-go:active { transform: translateY(3px); box-shadow: 0 3px 0 rgb(0 0 0 / .35); }",
    ".gd-levels { display: flex; flex-direction: column; gap: 8px; }",
    ".gd-lv { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; text-align: left; font: inherit; color: var(--ink); cursor: pointer; border: 0; padding: 10px 12px; border-radius: 14px; background: var(--hb-fill);",
    "  box-shadow: inset 0 0 0 1px var(--line); transition: background .15s, transform .12s; }",
    ".gd-lv:hover { background: var(--hb-fill2); } .gd-lv[data-on='1'] { box-shadow: inset 0 0 0 2px var(--hb-acc); }",
    ".gd-lv b { font-size: 14px; } .gd-lv span { font-size: 12px; color: var(--muted); }",
    ".gd-bar { grid-column: 1 / -1; height: 5px; border-radius: 9px; background: var(--hb-fill2); overflow: hidden; }",
    ".gd-bar i { display: block; height: 100%; background: var(--hb-acc); }",
    ".gd-keys { font-size: 12px; color: var(--muted); line-height: 1.7; } .gd-keys kbd { font: inherit; font-weight: 800; padding: 1px 6px; border-radius: 6px; background: var(--hb-fill2); color: var(--ink); }",
  ].join("\n");

  function keyLine(keys, text) {
    var line = h("div");
    keys.forEach(function (k, i) {
      if (i) line.appendChild(document.createTextNode(" / "));
      line.appendChild(h("kbd", null, k));
    });
    line.appendChild(document.createTextNode(" " + text));
    return line;
  }

  function geometry(stage, side, api) {
    var levels = buildLevels();
    var save = { best: {}, done: {}, attempts: {} };
    var level = 0;
    var practice = false;
    var sound = false;
    var running = false, alive = true;

    var st = h("style");
    st.textContent = CSS;
    stage.appendChild(st);
    var wrap = h("div", "gd-wrap");
    var canvas = h("canvas");
    wrap.appendChild(canvas);
    var over = h("div", "gd-over");
    var title = h("div", "gd-title", "Cube Dash");
    var sub = h("div", "gd-sub", "");
    var go = btn("gd-go", "Start");
    over.appendChild(title); over.appendChild(sub); over.appendChild(go);
    wrap.appendChild(over);
    stage.appendChild(wrap);
    var ctx = canvas.getContext("2d");

    // side panel
    var lvBox = h("div", "gd-levels");
    side.appendChild(h("span", "hg-label", "Level"));
    side.appendChild(lvBox);
    var modeRow = h("div", "hg-seg");
    var bNormal = btn("hg-seg-btn", "Normaal"), bPractice = btn("hg-seg-btn", "Oefenen");
    modeRow.appendChild(bNormal); modeRow.appendChild(bPractice);
    var f1 = h("div", "hg-field"); f1.appendChild(h("span", "hg-label", "Modus")); f1.appendChild(modeRow); side.appendChild(f1);
    var cpBtn = btn("hg-ghost", "Checkpoint (C)"); cpBtn.hidden = true;
    var sndBtn = btn("hg-ghost", "Geluid: uit");
    var f2 = h("div", "hg-row"); f2.appendChild(cpBtn); f2.appendChild(sndBtn); side.appendChild(f2);
    var keys = h("div", "gd-keys");
    keys.appendChild(keyLine(["Spatie", "↑", "klik"], "springen / omhoog"));
    keys.appendChild(keyLine(["P"], "pauze"));
    keys.appendChild(keyLine(["C"], "checkpoint (oefenen)"));
    side.appendChild(keys);

    function persist() {
      try { var o = {}; o[STORE_KEY] = save; chrome.storage.local.set(o); } catch (e) { /* storage is a bonus */ }
    }
    try {
      chrome.storage.local.get(STORE_KEY, function (r) {
        var v = r && r[STORE_KEY];
        if (v && typeof v === "object") { save.best = v.best || {}; save.done = v.done || {}; save.attempts = v.attempts || {}; }
        paintLevels();
        if (phase === "menu") setMenuText();
      });
    } catch (e) { /* ignore */ }

    function paintLevels() {
      lvBox.textContent = "";
      levels.forEach(function (l, i) {
        var b = btn("gd-lv");
        b.setAttribute("data-on", i === level ? "1" : "0");
        b.appendChild(h("b", null, (i + 1) + ". " + l.name));
        b.appendChild(h("span", null, save.done[i] ? "✓ gehaald" : "+" + l.reward + " munten"));
        b.appendChild(h("span", null, "Beste " + Math.round((save.best[i] || 0) * 100) + "%"));
        b.appendChild(h("span", null, ""));
        var bar = h("div", "gd-bar"); var fill = h("i"); fill.style.width = Math.round((save.best[i] || 0) * 100) + "%"; bar.appendChild(fill);
        b.appendChild(bar);
        b.addEventListener("click", function () { selectLevel(i); });
        lvBox.appendChild(b);
      });
      bNormal.setAttribute("data-on", practice ? "0" : "1");
      bPractice.setAttribute("data-on", practice ? "1" : "0");
      cpBtn.hidden = !practice;
    }

    /* ---------------- run state ---------------- */
    var lv = levels[0], s = newState(lv), held = false, attempt = 0;
    var particles = [], shake = 0, deadTimer = 0, acc = 0, last = 0, camX = 0, flash = 0;
    var checkpoints = [], cpTimer = 0, paused = false, phase = "menu", winCoins = 0;

    function resetRun(fromCp) {
      if (fromCp && checkpoints.length) s = cloneState(checkpoints[checkpoints.length - 1]);
      else { s = newState(lv); checkpoints = []; }
      s.dead = false; s.why = ""; s.prev = false;
      deadTimer = 0; acc = 0; particles = []; phase = "run"; cpTimer = 0;
      attempt++;
      save.attempts[level] = (save.attempts[level] || 0) + 1;
      if (sound) startMusic();
    }

    function setMenuText() {
      title.textContent = lv.name;
      sub.textContent = "Houd spatie, pijltje omhoog of klik ingedrukt. Beste: " + Math.round((save.best[level] || 0) * 100) + "%";
      go.textContent = "Start";
    }

    function selectLevel(i) {
      level = i; lv = levels[i];
      checkpoints = []; attempt = 0; held = false;
      wrap.style.setProperty("--gd-glow", lv.pal.glow);
      setMenuText();
      over.hidden = false; phase = "menu"; running = false; stopMusic();
      s = newState(lv);
      paintLevels();
    }

    function begin() {
      over.hidden = true;
      checkpoints = []; attempt = 0;
      resetRun(false);
      running = true; paused = false; last = 0;
    }
    go.addEventListener("click", begin);
    bNormal.addEventListener("click", function () { practice = false; paintLevels(); });
    bPractice.addEventListener("click", function () { practice = true; paintLevels(); });
    cpBtn.addEventListener("click", placeCheckpoint);
    sndBtn.addEventListener("click", function () {
      sound = !sound;
      sndBtn.textContent = "Geluid: " + (sound ? "aan" : "uit");
      if (sound && phase === "run") startMusic(); else stopMusic();
    });

    function placeCheckpoint() {
      if (phase !== "run" || s.dead || !practice) return;
      var c = cloneState(s); c.prev = false;
      checkpoints.push(c);
    }

    /* ---------------- input ---------------- */
    function press(v) {
      if (v && !held && phase === "run") sfx("jump");
      held = v;
    }
    function onKey(e) {
      var k = e.key;
      if (!wrap.isConnected) return;
      if (k === " " || k === "ArrowUp" || k === "w" || k === "W") {
        e.preventDefault(); e.stopPropagation();
        if (e.type === "keydown") {
          if (e.repeat) return;
          if (phase === "menu") { begin(); return; }
          if (phase === "won") { begin(); return; }
          press(true);
        } else press(false);
      } else if (e.type === "keydown" && (k === "p" || k === "P") && phase === "run") {
        paused = !paused;
        if (paused) stopMusic(); else if (sound) startMusic();
      } else if (e.type === "keydown" && (k === "c" || k === "C")) placeCheckpoint();
    }
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("keyup", onKey, true);
    canvas.addEventListener("pointerdown", function (e) { e.preventDefault(); if (phase === "run") press(true); });
    wrap.addEventListener("pointerup", function () { press(false); });
    wrap.addEventListener("pointercancel", function () { press(false); });
    wrap.addEventListener("pointerleave", function () { press(false); });

    /* ---------------- audio ---------------- */
    var ac = null, musicTimer = 0;
    function audio() {
      if (ac === null) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = false; } }
      return ac || null;
    }
    function tone(freq, dur, type, vol, when, slide) {
      var c = audio();
      if (!c) return;
      var o = c.createOscillator(), g = c.createGain(), t = when || c.currentTime;
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    }
    function sfx(kind) {
      if (!sound || !audio()) return;
      if (kind === "jump") tone(420, 0.09, "square", 0.04, 0, 620);
      else if (kind === "die") tone(180, 0.35, "sawtooth", 0.07, 0, 40);
      else if (kind === "win") [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.25, "triangle", 0.07, ac.currentTime + i * 0.11); });
    }
    var BASS = [55, 55, 82.4, 55, 65.4, 65.4, 98, 65.4], ARP = [220, 330, 440, 330, 262, 392, 523, 392];
    function startMusic() {
      stopMusic();
      var c = audio();
      if (!c) return;
      if (c.state === "suspended") c.resume();
      var spb = 60 / 128 / 2, nextT = c.currentTime + 0.05, beat = 0;
      musicTimer = setInterval(function () {
        while (nextT < c.currentTime + 0.25) {
          if (beat % 2 === 0) tone(110, 0.12, "sine", 0.12, nextT, 40);
          tone(BASS[(beat >> 1) % 8], spb * 1.6, "sawtooth", 0.03, nextT);
          tone(ARP[beat % 8] * (level > 0 ? 1.2 : 1), spb * 0.8, "square", 0.012, nextT);
          nextT += spb; beat++;
        }
      }, 60);
    }
    function stopMusic() { clearInterval(musicTimer); musicTimer = 0; }

    /* ---------------- loop ---------------- */
    function burst(x, y, c, n, spd) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * spd, life = 0.5 + Math.random() * 0.5;
        particles.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life, max: life, g: 14, c: c, r: 0.08 + Math.random() * 0.12 });
      }
    }

    function frame(now) {
      if (!alive || !wrap.isConnected) return;
      requestAnimationFrame(frame);
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (running && !paused) {
        if (phase === "run") {
          acc += dt;
          var guard = 0;
          while (acc >= DT && guard++ < 12 && !s.dead && !s.won) {
            acc -= DT;
            step(s, lv, held);
            if (practice) {
              cpTimer += DT;
              if (cpTimer > 2.5 && s.grounded && !s.dead) { cpTimer = 0; var c = cloneState(s); c.prev = false; checkpoints.push(c); }
            }
          }
          if (!s.dead && (s.mode !== "cube" || !s.grounded || Math.random() < 0.3)) {
            particles.push({ x: s.x + 0.1, y: s.y + 0.3 + Math.random() * 0.4, vx: -2 - Math.random() * 2, vy: (Math.random() - 0.5), life: 0.35, max: 0.35, g: 0, c: "#7dff1f", r: 0.07 });
          }
          if (s.dead) {
            sfx("die");
            burst(s.x + 0.5, s.y + 0.5, "#7dff1f", 34, 6);
            shake = 0.25; flash = 0; phase = "dead"; deadTimer = 0;
            var pct = Math.min(1, s.x / lv.end);
            if (!practice && pct > (save.best[level] || 0)) { save.best[level] = pct; persist(); paintLevels(); }
          } else if (s.won) {
            phase = "won"; stopMusic(); sfx("win");
            burst(s.x + 0.5, s.y + 0.5, lv.pal.glow, 60, 9);
            winCoins = 0;
            if (!practice) {
              save.best[level] = 1;
              if (!save.done[level]) { save.done[level] = 1; winCoins = lv.reward; api.give(lv.reward); api.record(lv.reward); }
              persist(); paintLevels();
            }
            title.textContent = practice ? "Gehaald (oefenen)" : "Level gehaald!";
            sub.textContent = winCoins ? "+" + winCoins + " munten (eerste keer)" : (practice ? "In oefenmodus krijg je geen munten." : "Je kreeg de munten al eerder.");
            go.textContent = "Opnieuw";
            setTimeout(function () { if (phase === "won") over.hidden = false; }, 900);
          }
        } else if (phase === "dead") {
          deadTimer += dt;
          if (deadTimer > 0.6) resetRun(practice);
        }
        particles = particles.filter(function (q) {
          q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= q.g * dt;
          return q.life > 0;
        });
        if (shake > 0) shake = Math.max(0, shake - dt);
        if (flash > 0) flash = Math.max(0, flash - dt * 3);
      }
      draw();
    }

    var cw = 0, ch = 0;
    function fit() {
      var r = wrap.getBoundingClientRect();
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = Math.max(320, Math.round(r.width * dpr)), hh = Math.max(180, Math.round(r.height * dpr));
      if (w !== cw || hh !== ch) { cw = canvas.width = w; ch = canvas.height = hh; }
    }

    function shade(hex, f) {
      var n = parseInt(hex.slice(1), 16);
      function c(v) { return Math.max(0, Math.min(255, Math.round(v * f))); }
      return "rgb(" + c(n >> 16) + "," + c((n >> 8) & 255) + "," + c(n & 255) + ")";
    }

    function cubeShape(c, S2, col) {
      c.fillStyle = col; c.fillRect(-S2 / 2, -S2 / 2, S2, S2);
      c.fillStyle = "#22e5ff"; c.fillRect(-S2 * 0.34, -S2 * 0.34, S2 * 0.68, S2 * 0.68);
      c.fillStyle = col; c.fillRect(-S2 * 0.24, -S2 * 0.24, S2 * 0.48, S2 * 0.48);
      c.strokeStyle = "#000"; c.lineWidth = S2 * 0.07; c.strokeRect(-S2 / 2 + 1, -S2 / 2 + 1, S2 - 2, S2 - 2);
      c.fillStyle = "#000"; c.fillRect(-S2 * 0.2, -S2 * 0.12, S2 * 0.14, S2 * 0.18); c.fillRect(S2 * 0.06, -S2 * 0.12, S2 * 0.14, S2 * 0.18);
      c.fillRect(-S2 * 0.2, S2 * 0.14, S2 * 0.4, S2 * 0.06);
    }

    function draw() {
      fit();
      var p = lv.pal, S = ch / 10.9;
      var px = 0.27 * cw;
      var shown = s;
      camX = shown.x - px / S;
      var ox = shake > 0 ? (Math.random() - 0.5) * shake * 40 : 0, oy = shake > 0 ? (Math.random() - 0.5) * shake * 40 : 0;
      ctx.save();
      ctx.translate(ox, oy);
      function X(x) { return (x - camX) * S; }
      function Y(y) { return (9.4 - y) * S; }

      var g = ctx.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, p.top); g.addColorStop(1, p.bot);
      ctx.fillStyle = g; ctx.fillRect(-40, -40, cw + 80, ch + 80);
      var i, k, o;
      ctx.globalAlpha = 0.07;
      for (i = 0; i < 9; i++) {
        var sx = ((i * 7.3 - camX * 0.25) % 66 + 66) % 66 - 6, sz = 2.2 + (i % 3);
        ctx.fillStyle = p.glow;
        ctx.fillRect(sx * S, Y(2 + (i * 1.7) % 6), sz * S, sz * S);
      }
      ctx.globalAlpha = 0.05;
      for (i = 0; i < 6; i++) {
        var tx = ((i * 11.1 - camX * 0.5) % 70 + 70) % 70 - 8;
        ctx.beginPath(); ctx.moveTo(tx * S, Y(0)); ctx.lineTo((tx + 3) * S, Y(0)); ctx.lineTo((tx + 1.5) * S, Y(3 + i % 3)); ctx.closePath(); ctx.fillStyle = p.block; ctx.fill();
      }
      ctx.globalAlpha = 1;
      var pulse = 0.5;

      // ground (with pits) and ceiling
      var gx0 = camX - 1, gx1 = camX + cw / S + 1, cur = gx0;
      var pl = lv.pits.filter(function (q) { return q.x + q.w > gx0 && q.x < gx1; });
      ctx.fillStyle = p.ground;
      pl.forEach(function (q) {
        if (q.x > cur) ctx.fillRect(X(cur), Y(0), (q.x - cur) * S, ch);
        cur = q.x + q.w;
      });
      if (cur < gx1) ctx.fillRect(X(cur), Y(0), (gx1 - cur) * S, ch);
      ctx.fillRect(-40, -40, cw + 80, Y(CEIL) + 40);
      ctx.strokeStyle = "rgba(255,255,255,.14)"; ctx.lineWidth = Math.max(1, S * 0.03);
      ctx.beginPath();
      for (var tx0 = Math.floor(gx0); tx0 < gx1; tx0++) {
        var inP = pl.some(function (q) { return tx0 > q.x && tx0 < q.x + q.w; });
        if (!inP) { ctx.moveTo(X(tx0), Y(0)); ctx.lineTo(X(tx0), ch); }
      }
      ctx.moveTo(0, Y(-0.35)); ctx.lineTo(cw, Y(-0.35));
      ctx.stroke();
      ctx.strokeStyle = p.line; ctx.lineWidth = Math.max(2, S * 0.07); ctx.beginPath();
      cur = gx0;
      pl.forEach(function (q) { if (q.x > cur) { ctx.moveTo(X(cur), Y(0)); ctx.lineTo(X(q.x), Y(0)); } cur = q.x + q.w; });
      if (cur < gx1) { ctx.moveTo(X(cur), Y(0)); ctx.lineTo(X(gx1), Y(0)); }
      ctx.moveTo(0, Y(CEIL)); ctx.lineTo(cw, Y(CEIL));
      ctx.stroke(); for (k = 0; k < lv.blocks.length; k++) {
        o = lv.blocks[k];
        if (o.x1 < gx0) continue;
        if (o.x > gx1) break;
        var bx = X(o.x), bw = o.w * S, by = Y(o.y1), bh = o.h * S;
        ctx.fillStyle = "#000"; ctx.fillRect(bx, by, bw, bh);
        for (var cx = 0; cx < o.w; cx++) for (var cy = 0; cy < o.h; cy++) {
          ctx.strokeStyle = p.line; ctx.lineWidth = Math.max(2, S * 0.06);
          ctx.strokeRect(bx + cx * S + 1, by + cy * S + 1, S - 2, S - 2);
          ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = Math.max(1, S * 0.03);
          ctx.strokeRect(bx + cx * S + S * 0.2, by + cy * S + S * 0.2, S * 0.6, S * 0.6);
        }
      }
      for (k = 0; k < lv.spikes.length; k++) {
        o = lv.spikes[k];
        if (o.x + 1 < gx0) continue;
        if (o.x > gx1) break;
        var sx0 = X(o.x), yb = o.up ? Y(o.y) : Y(o.y + 1), dirS = o.up ? -1 : 1;
        ctx.beginPath(); ctx.moveTo(sx0 + S * 0.05, yb); ctx.lineTo(sx0 + S * 0.5, yb + dirS * S * 0.9); ctx.lineTo(sx0 + S * 0.95, yb); ctx.closePath();
        ctx.fillStyle = "#000"; ctx.fill();
        ctx.strokeStyle = p.line; ctx.lineWidth = Math.max(2, S * 0.07); ctx.lineJoin = "round"; ctx.stroke(); }
      for (k = 0; k < lv.pads.length; k++) {
        o = lv.pads[k];
        if (o.x + 1 < gx0) continue;
        if (o.x > gx1) break;
        if (o.t === "pad") {
          ctx.fillStyle = "#ffe14a"; ctx.fillRect(X(o.x) + S * 0.1, Y(o.y + 0.22), S * 0.8, S * 0.22); } else {
          ctx.strokeStyle = "#ffe14a"; ctx.lineWidth = S * 0.08; ctx.beginPath(); ctx.arc(X(o.x) + S * 0.5, Y(o.y + 0.5), S * (0.3 + 0.04 * pulse), 0, 7); ctx.stroke();
          ctx.fillStyle = "rgba(255,225,74,.35)"; ctx.fill(); }
      }
      var PCOL = { cube: "#5dff8a", ship: "#ff62d6", ball: "#ff9a3d", "g-": "#4ab3ff", "g+": "#ffe14a", fast: "#ff4a4a", slow: "#8a8a8a" };
      for (k = 0; k < lv.portals.length; k++) {
        o = lv.portals[k];
        if (o.x + 1 < gx0) continue;
        if (o.x > gx1) break;
        var pc = PCOL[o.k] || "#fff", cyy = o.k === "g-" || o.k === "g+" ? 4.6 : 2;
        ctx.strokeStyle = pc; ctx.lineWidth = S * 0.14; ctx.beginPath(); ctx.ellipse(X(o.x) + S * 0.5, Y(cyy), S * 0.35, S * 1.5, 0, 0, 7); ctx.stroke();
        ctx.fillStyle = pc; ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1; }
      checkpoints.forEach(function (c) {
        ctx.fillStyle = "#7dffb2";
        var cx2 = X(c.x) + S * 0.5, cy2 = Y(c.y + 1.4);
        ctx.beginPath(); ctx.moveTo(cx2, cy2 - S * 0.3); ctx.lineTo(cx2 + S * 0.22, cy2); ctx.lineTo(cx2, cy2 + S * 0.3); ctx.lineTo(cx2 - S * 0.22, cy2); ctx.closePath(); ctx.fill();
      });
      var fx = X(lv.end - 4);
      for (var fy = 0; fy < 12; fy++) {
        ctx.fillStyle = fy % 2 ? "#fff" : "#111"; ctx.fillRect(fx, Y(CEIL) + fy * S * 0.75, S * 0.4, S * 0.75);
        ctx.fillStyle = fy % 2 ? "#111" : "#fff"; ctx.fillRect(fx + S * 0.4, Y(CEIL) + fy * S * 0.75, S * 0.4, S * 0.75);
      }

      particles.forEach(function (q) {
        ctx.globalAlpha = Math.max(0, Math.min(1, q.life / Math.max(0.2, q.max * 0.6)));
        ctx.fillStyle = q.c; ctx.fillRect(X(q.x) - q.r * S, Y(q.y) - q.r * S, q.r * 2 * S, q.r * 2 * S);
      });
      ctx.globalAlpha = 1;

      if (phase !== "dead") {
        ctx.save();
        ctx.translate(X(shown.x) + S / 2, Y(shown.y + 1) + S / 2);
        if (shown.mode === "cube") {
          ctx.rotate(shown.grounded ? Math.round(shown.rot / (Math.PI / 2)) * (Math.PI / 2) : shown.rot);
          cubeShape(ctx, S, "#7dff1f");
        } else if (shown.mode === "ship") {
          ctx.rotate(-Math.atan2(shown.vy, shown.speed) * 0.8);
          if (shown.dir === -1) ctx.scale(1, -1);
          ctx.fillStyle = "#22e5ff"; ctx.strokeStyle = "#000"; ctx.lineWidth = S * 0.06; ctx.beginPath(); ctx.moveTo(-S * 0.5, S * 0.22); ctx.lineTo(S * 0.55, S * 0.05); ctx.lineTo(S * 0.3, -S * 0.15); ctx.lineTo(-S * 0.5, -S * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.scale(0.55, 0.55); ctx.translate(S * 0.1, -S * 0.55); cubeShape(ctx, S, "#7dff1f");
        } else {
          ctx.rotate(shown.t * 9 * shown.dir);
          ctx.fillStyle = "#7dff1f"; ctx.strokeStyle = "#000"; ctx.lineWidth = S * 0.06; ctx.beginPath(); ctx.arc(0, 0, S * 0.47, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = "#22e5ff"; ctx.lineWidth = S * 0.09; ctx.beginPath(); ctx.moveTo(-S * 0.4, 0); ctx.lineTo(S * 0.4, 0); ctx.moveTo(0, -S * 0.4); ctx.lineTo(0, S * 0.4); ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
      if (flash > 0) { ctx.fillStyle = "rgba(255,255,255," + flash * 0.25 + ")"; ctx.fillRect(0, 0, cw, ch); }

      var pct2 = Math.min(1, shown.x / lv.end);
      var bw2 = cw * 0.5, bx2 = (cw - bw2) / 2, by2 = S * 0.18;
      ctx.fillStyle = "rgba(0,0,0,.45)"; ctx.fillRect(bx2, by2, bw2, S * 0.2);
      ctx.fillStyle = "#7dff1f"; ctx.fillRect(bx2, by2, bw2 * pct2, S * 0.2);
      ctx.fillStyle = "#fff"; ctx.font = "800 " + Math.round(S * 0.38) + "px system-ui, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(Math.floor(pct2 * 100) + "%", cw / 2, by2 + S * 0.62);
      ctx.textAlign = "left"; ctx.font = "700 " + Math.round(S * 0.3) + "px system-ui, sans-serif"; ctx.globalAlpha = 0.85;
      ctx.fillText("Poging " + attempt + (practice ? " · oefenen" : ""), S * 0.3, S * 0.5);
      ctx.globalAlpha = 1;
      if (paused) {
        ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = "900 " + Math.round(S * 1.1) + "px system-ui, sans-serif"; ctx.fillText("Pauze", cw / 2, ch / 2);
      }
    }

    api.onDispose(function () {
      alive = false; running = false;
      stopMusic();
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("keyup", onKey, true);
      try { if (ac) ac.close(); } catch (e) { /* ignore */ }
    });

    selectLevel(0);
    requestAnimationFrame(frame);
  }

  window.sscHubGames.geometry = geometry;
})();
