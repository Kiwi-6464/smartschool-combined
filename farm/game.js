/* Farm game: isometric canvas world + DOM UI. Mounts into #farm. Needs data.js and assets/atlas.js first.
   Coins come from window.FarmWallet {get(), spend(n)->bool}; without one a local demo wallet is used. */
(function () {
  "use strict";
  function mount(root, opt) {
  opt = opt || {};
  const D = window.FARM_DATA, A = window.FARM_ATLAS, TW = D.TW, TH = D.TH, N = D.N, PL = D.PLOT, NP = N / PL, T = D.types, IT = D.items;
  const BASE = opt.base || "assets/", KEY = opt.key || "farmSave1", M = window.FARM_MASK || {};
  const ac = new AbortController(), sig = { signal: ac.signal }, ivs = []; let dead = false;
  const every = (fn, ms) => ivs.push(setInterval(fn, ms));
  const now = () => Date.now();
  const SICKLE = '<svg viewBox="0 0 48 48"><path d="M9 41l11-11" stroke="#8a4b1c" stroke-width="7" stroke-linecap="round"/><path d="M18 31C7 14 22 2 41 8 27 9 19 18 25 28z" fill="#e6edf3" stroke="#5b6b7a" stroke-width="2.5" stroke-linejoin="round"/></svg>';
  const BASKET = '<svg viewBox="0 0 48 48"><path d="M11 22c0-17 26-17 26 0" fill="none" stroke="#8a4b1c" stroke-width="4"/><path d="M6 21h36l-5 19H11z" fill="#e0a252" stroke="#8a4b1c" stroke-width="3" stroke-linejoin="round"/><path d="M13 28h22M12 34h24" stroke="#8a4b1c" stroke-width="2"/></svg>';

  const COIN = BASE + "ui_coin.svg";
  root.style.setProperty("--fg-coin", 'url("' + COIN + '")');
  root.classList.add("fg");
  root.innerHTML =
    '<canvas class="fg-cv"></canvas>' +
    '<div class="fg-lvl"><div class="fg-star"><b></b></div><div class="fg-xp"><i></i><span></span></div></div>' +
    '<div class="fg-coins"><span class="fg-coin"></span><b></b><button class="fg-plus" title="Arcade (demo)">+</button></div>' +
    '<div class="fg-btns"><button class="fg-btn big" data-a="shop">Winkel</button><button class="fg-btn big alt" data-a="orders">Bestellingen</button>' +
    '<button class="fg-btn round" data-a="help" title="Gids: wat doet wat?">?</button><button class="fg-btn round" data-a="home" title="Naar de boerderij">⌂</button><button class="fg-btn round" data-a="mute" title="Geluid">♪</button></div>' +
    '<div class="fg-place"><span></span><button class="fg-btn round no" data-p="cancel">✕</button><button class="fg-btn round" data-p="flip">⇄</button><button class="fg-btn round no" data-p="bin">🗑</button><button class="fg-btn round ok" data-p="ok">✓</button></div>' +
    '<div class="fg-quest"><span></span><button>Overslaan</button></div><div class="fg-pop"></div><div class="fg-drag"></div><div class="fg-toast"></div>' +
    '<div class="fg-modal"><div class="fg-panel"><header><h2></h2><button class="fg-x">✕</button></header><div class="fg-body"></div></div></div>' +
    '<div class="fg-load">Boerderij laden…</div>';
  const $ = (s) => root.querySelector(s);
  const cv = $(".fg-cv"), ctx = cv.getContext("2d"), pop = $(".fg-pop"), dragEl = $(".fg-drag"), modal = $(".fg-modal"), body = $(".fg-body"), placeBar = $(".fg-place");

  // ---------- helpers
  const icon = (item) => `<img class="fg-ic" src="${BASE}item_${item}.png" alt="${IT[item].n}" title="${IT[item].n}" draggable="false">`;
  const coin = (n) => `<span class="fg-price"><span class="fg-coin"></span>${n}</span>`;
  const fmt = (s) => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}u ${m}m` : m ? `${m}:${String(x).padStart(2, "0")}` : `${x}s`; };
  const w2p = (x, y) => [(x - y) * TW / 2, (x + y) * TH / 2];
  const center = (o) => [o.x + T[o.t].w / 2, o.y + T[o.t].d / 2];
  const rnd = (a, b) => a + Math.random() * (b - a);
  function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---------- wallet (coins are only ever spent here)
  const Wallet = opt.wallet || (() => {
    let c = +(localStorage.getItem("farmDemoCoins") ?? 300);
    const put = () => localStorage.setItem("farmDemoCoins", c);
    return { demo: true, get: () => c, spend(n) { if (c < n) return false; c -= n; put(); return true; }, add(n) { c += n; put(); } };
  })();

  // ---------- sound
  let actx = null;
  function sfx(f, d, type) {
    if (S.mute) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
      o.type = type || "sine"; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + (d || 0.1));
      g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + (d || 0.1));
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + (d || 0.1));
    } catch (e) { /* no audio available */ }
  }

  // ---------- state
  function fresh() {
    const s = { v: 1, xp: 0, lvl: 1, plots: [14, 15, 20, 21], bought: 0, objs: [], inv: { wheat: 4, feed_chick: 3 }, cap: { silo: 50, barn: 50 }, orders: [], oid: 1, mute: false, intro: true };
    const add = (t, x, y, o) => s.objs.push(Object.assign({ id: s.oid++, t, x, y }, o));
    add("barn", 17, 17); add("silo", 23, 17); add("board", 26, 18);
    add("feedmill", 17, 22, { q: [], out: [], slots: 2 });
    add("coop", 20, 22, { animals: [{ s: 0 }, { s: 0 }] });
    for (let i = 0; i < 6; i++) add("field", 25 + (i % 3), 23 + Math.floor(i / 3), i < 3 ? { crop: "wheat", at: now() - 1e7 } : {});
    add("d_oak", 29, 17); add("d_flowers", 29, 22); add("d_hay", 29, 25); add("d_bush", 17, 27);
    return s;
  }
  let S;
  if (opt.state !== undefined) S = opt.state; else try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || S.v !== 1 || !Array.isArray(S.objs)) S = fresh();
  S.objs = S.objs.filter((o) => T[o.t]);
  if (S.tut == null) S.tut = S.lvl > 1 ? 99 : 0;
  let dirty = false;
  const touch = () => { dirty = true; };
  function save() {
    dirty = false; S.level = S.lvl; S.updatedAt = now();
    const json = JSON.stringify(S, (k, v) => (k[0] === "_" ? undefined : v));
    if (opt.onSave) opt.onSave(JSON.parse(json)); else try { localStorage.setItem(KEY, json); } catch (e) { /* storage full or blocked */ }
  }
  every(() => dirty && save(), 2000);
  addEventListener("visibilitychange", () => dirty && save(), sig);
  addEventListener("pagehide", () => dirty && save(), sig);

  // ---------- world bookkeeping
  const owned = new Uint8Array(NP * NP), occ = new Int32Array(N * N), byId = new Map(), wild = {};
  const pidOf = (x, y) => Math.floor(x / PL) + Math.floor(y / PL) * NP;
  const inMap = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const occAt = (x, y) => (inMap(x, y) ? byId.get(occ[x + y * N]) : undefined);
  function rebuild() {
    owned.fill(0); S.plots.forEach((p) => (owned[p] = 1)); occ.fill(0); byId.clear();
    for (const o of S.objs) { byId.set(o.id, o); const t = T[o.t]; for (let i = 0; i < t.w; i++) for (let j = 0; j < t.d; j++) if (inMap(o.x + i, o.y + j)) occ[o.x + i + (o.y + j) * N] = o.id; }
    for (let p = 0; p < NP * NP; p++) {
      if (owned[p]) { delete wild[p]; continue; }
      if (wild[p]) continue;
      const r = mulberry(p * 977 + 13), list = (wild[p] = []), px = (p % NP) * PL, py = Math.floor(p / NP) * PL;
      for (let i = 0, n = 9 + Math.floor(r() * 6); i < n; i++) list.push({ s: "deco_" + D.wild[Math.floor(r() * D.wild.length)], x: px + 0.6 + r() * (PL - 1.2), y: py + 0.6 + r() * (PL - 1.2), f: r() < 0.5, k: 0.85 + r() * 0.35 });
    }
  }
  const forSale = (p) => { if (owned[p]) return false; const x = p % NP, y = Math.floor(p / NP); return (x > 0 && owned[p - 1]) || (x < NP - 1 && owned[p + 1]) || (y > 0 && owned[p - NP]) || (y < NP - 1 && owned[p + NP]); };
  const count = (t) => S.objs.reduce((n, o) => n + (o.t === t), 0);
  const stored = (store) => Object.keys(S.inv).reduce((n, k) => n + (IT[k] && IT[k].s === store ? S.inv[k] : 0), 0);
  const have = (item) => S.inv[item] || 0;
  const ripe = (o) => o.crop && now() - o.at >= D.crops[o.crop].t * 1000;

  // ---------- feedback
  let lastWarn = "", lastWarnAt = 0, toastTimer = 0;
  function toast(msg) { const t = $(".fg-toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 2200); }
  function warn(msg) { if (msg === lastWarn && now() - lastWarnAt < 1500) return; lastWarn = msg; lastWarnAt = now(); toast(msg); sfx(160, 0.15, "square"); }
  const floats = [];
  function float(o, txt, item) { const c = center(o), p = w2p(c[0], c[1]); floats.push({ x: p[0] + rnd(-14, 14), y: p[1] - 40 - 22 * floats.filter((f) => f.o === o.id).length, txt, item, t0: performance.now(), o: o.id }); }
  function pay(n) { if (Wallet.spend(n)) { hud(); sfx(900, 0.08); return true; } warn("Te weinig munten — verdien er in de Arcade!"); return false; }
  function gain(item, n, o) {
    const st = IT[item].s;
    if (stored(st) + n > S.cap[st]) { warn((st === "silo" ? "Silo" : "Schuur") + " is vol! Vergroot of lever bestellingen."); return false; }
    S.inv[item] = have(item) + n; if (o) { float(o, "+" + n, item); o._pop = performance.now(); }
    addXp(IT[item].xp * n); sfx(620, 0.09); touch(); return true;
  }
  function addXp(n) {
    S.xp += n; let up = 0;
    while (S.xp >= D.xpNeed(S.lvl)) { S.xp -= D.xpNeed(S.lvl); S.lvl++; up = S.lvl; }
    hud(); touch(); if (up) setTimeout(() => levelPanel(up), 500);
  }
  function hud() {
    $(".fg-star b").textContent = S.lvl; const need = D.xpNeed(S.lvl);
    $(".fg-xp i").style.width = Math.min(100, (S.xp / need) * 100) + "%"; $(".fg-xp span").textContent = S.xp + " / " + need + " XP";
    $(".fg-coins b").textContent = Wallet.get(); $(".fg-plus").style.display = Wallet.demo ? "" : "none";
    $('[data-a="mute"]').classList.toggle("off", !!S.mute);
  }

  // ---------- timers that advance state (works offline: everything is absolute time)
  function tickObj(o) {
    const t = T[o.t], n = now();
    if (t.kind === "prod") while (o.q[0] && o.q[0].end <= n) { const r = D.recipes[o.t][o.q.shift().r]; for (let i = 0; i < r.n; i++) o.out.push(r.out); touch(); }
    if (t.kind === "pen") for (const a of o.animals) if (a.s === 1 && a.end <= n) { a.s = 2; touch(); }
  }
  function available() { // items an order may ask for right now
    const list = [];
    for (const c in D.crops) if (D.crops[c].lvl <= S.lvl) list.push([c, 2, 6]);
    for (const o of S.objs) {
      const t = T[o.t];
      if (t.kind === "pen" && o.animals.length && !list.some((l) => l[0] === t.pen.out)) list.push([t.pen.out, 1, 4]);
      if (t.kind === "prod" && o.t !== "feedmill") for (const r of D.recipes[o.t]) if (r.lvl <= S.lvl && !list.some((l) => l[0] === r.out)) list.push([r.out, 1, 2]);
    }
    return list;
  }
  function newOrder() {
    const av = available(), need = {}, k = 1 + Math.floor(Math.random() * Math.min(3, 1 + S.lvl / 2)); let xp = 4;
    for (let i = 0; i < k && av.length; i++) { const a = av.splice(Math.floor(Math.random() * av.length), 1)[0], q = Math.round(rnd(a[1], a[2])); need[a[0]] = q; xp += IT[a[0]].xp * q * 3; }
    return { id: S.oid++, need, xp, who: D.names[Math.floor(Math.random() * D.names.length)] };
  }
  function tickOrders() { for (let i = 0; i < 5; i++) { const o = S.orders[i]; if (!o || (o.wait && o.wait <= now())) { S.orders[i] = newOrder(); touch(); } } }

  // ---------- camera + canvas
  const cam = { x: 0, y: 24 * TH, z: 0.6 };
  let vw = 0, vh = 0, dpr = 1;
  function resize() { const r = root.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); vw = r.width; vh = r.height; cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr); }
  const ro = new ResizeObserver(resize); ro.observe(root);
  const s2t = (sx, sy) => { const wx = (sx - vw / 2) / cam.z + cam.x, wy = (sy - vh / 2) / cam.z + cam.y; return [(wx / (TW / 2) + wy / (TH / 2)) / 2, (wy / (TH / 2) - wx / (TW / 2)) / 2]; };
  const p2s = (px, py) => [(px - cam.x) * cam.z + vw / 2, (py - cam.y) * cam.z + vh / 2];
  function clampCam() { cam.z = Math.max(0.3, Math.min(1.6, cam.z)); cam.x = Math.max(-N * TW / 2, Math.min(N * TW / 2, cam.x)); cam.y = Math.max(0, Math.min(N * TH, cam.y)); }
  function zoomAt(sx, sy, f) { const a = s2t(sx, sy); cam.z *= f; clampCam(); const p = w2p(a[0], a[1]); cam.x = p[0] - (sx - vw / 2) / cam.z; cam.y = p[1] - (sy - vh / 2) / cam.z; clampCam(); }
  const IMG = {};

  function spr(name, tx, ty, sc, flip, alpha) {
    const a = A[name], im = IMG[name]; if (!a || !im) return;
    const k = (TW / 192) * (sc || 1), p = w2p(tx, ty);
    if (alpha != null) ctx.globalAlpha = alpha;
    if (flip) { ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(-1, 1); ctx.drawImage(im, -a.ax * k, -a.ay * k, a.w * k, a.h * k); ctx.restore(); }
    else ctx.drawImage(im, p[0] - a.ax * k, p[1] - a.ay * k, a.w * k, a.h * k);
    if (alpha != null) ctx.globalAlpha = 1;
  }
  function diamond(x0, y0, x1, y1) { const a = w2p(x0, y0), b = w2p(x1, y0), c = w2p(x1, y1), d = w2p(x0, y1); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); }
  const stage = (o) => { const u = (now() - o.at) / (D.crops[o.crop].t * 1000); return u >= 1 ? 3 : u >= 0.4 ? 2 : 1; };
  const popK = (o, t) => { const u = (t - (o._pop || -1e9)) / 350; return u >= 0 && u < 1 ? 1 + 0.14 * Math.sin(Math.PI * u) * (1 - u) : 1; };
  // sprite parts of an object: [name, tx, ty, scale, flip] (used for drawing and for picking)
  function parts(o, t) {
    const tt = T[o.t], c = center(o), k = (tt.sc || 1) * popK(o, t || 0);
    if (tt.kind === "path") return [];
    if (tt.kind === "field") {
      if (!o.crop) return [["soil", c[0], c[1], k]];
      const st = stage(o); // ripe crops stand taller and sway so they are easy to spot
      return [["soil", c[0], c[1], 1], ["crop_" + o.crop + "_" + st, c[0], c[1], k * (st === 3 ? 1.14 + 0.05 * Math.sin(now() / 240 + o.x * 2 + o.y) : 1)]];
    }
    if (tt.kind === "pen") return [[tt.spr + "_back", c[0], c[1], k], [tt.spr + "_front", c[0], c[1], k]];
    if (tt.kind === "board") { const u = o._cart ? (performance.now() - o._cart) / 4000 : 1, off = u < 1 ? Math.sin(Math.PI * u) * 7 : 0; return [["board", c[0], c[1] - 0.5, k], ["cart", c[0] + 0.1, c[1] + 0.45 + off, 1]]; }
    return [[tt.spr, c[0], c[1], k, o.f]];
  }
  function penOk(t, x, y) { return Math.abs(x) < t.w / 2 - 0.5 && Math.abs(y) < t.d / 2 - 0.5 && x + y > 0.15; }
  function moveAnimals(o, dt) {
    const t = T[o.t];
    for (const a of o.animals) {
      if (a._x == null) { do { a._x = rnd(-t.w / 2, t.w / 2); a._y = rnd(-t.d / 2, t.d / 2); } while (!penOk(t, a._x, a._y)); a._w = rnd(0, 3); a._dx = -1; a._dy = 1; }
      if (a._tx != null) {
        const dx = a._tx - a._x, dy = a._ty - a._y, d = Math.hypot(dx, dy), st = 0.5 * dt;
        if (d <= st) { a._x = a._tx; a._y = a._ty; a._tx = null; a._w = rnd(1.5, 5); } else { a._x += (dx / d) * st; a._y += (dy / d) * st; a._dx = dx; a._dy = dy; }
      } else if ((a._w -= dt) <= 0) { let x, y; do { x = rnd(-t.w / 2, t.w / 2); y = rnd(-t.d / 2, t.d / 2); } while (!penOk(t, x, y)); a._tx = x; a._ty = y; }
    }
  }
  function drawAnimals(o, t) {
    const tt = T[o.t], c = center(o);
    for (const a of o.animals.slice().sort((p, q) => p._x + p._y - q._x - q._y)) {
      const sdx = a._dx - a._dy, sdy = a._dx + a._dy, front = sdy >= 0, hop = a._tx != null ? Math.abs(Math.sin(t / 110 + a._x * 9)) * 0.09 : 0;
      spr("animal_" + tt.pen.animal + (front ? "_f" : "_b"), c[0] + a._x - hop, c[1] + a._y - hop, 1, front ? sdx > 0 : sdx < 0);
    }
  }
  function label(o, tt) {
    const q = w2p(o.x + tt.w, o.y + tt.d); ctx.font = "800 15px system-ui,sans-serif"; const w = ctx.measureText(tt.n).width + 20;
    ctx.fillStyle = "rgba(70,45,20,.78)"; ctx.beginPath(); ctx.roundRect(q[0] - w / 2, q[1] + 2, w, 24, 12); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(tt.n, q[0], q[1] + 15);
  }
  function twinkle(x, y, t, seed) {
    for (let i = 0; i < 2; i++) {
      const a = Math.sin(t / 420 + seed * 1.7 + i * 2.4); if (a <= 0) continue;
      const px = x + Math.cos(seed * 3 + i * 4) * 24, py = y - i * 16 - 6, r = 9 * a;
      ctx.globalAlpha = a; ctx.fillStyle = "#fff"; ctx.strokeStyle = "#f5b301"; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(px, py - r); ctx.quadraticCurveTo(px, py, px + r, py); ctx.quadraticCurveTo(px, py, px, py + r); ctx.quadraticCurveTo(px, py, px - r, py); ctx.quadraticCurveTo(px, py, px, py - r);
      ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  function bubble(px, py, name, t, small, txt) {
    const r = small ? 13 : 19, y = py + Math.sin(t / 320 + px) * 3;
    ctx.beginPath(); ctx.arc(px, y, r, 0, 7); ctx.fillStyle = small ? "rgba(255,255,255,.85)" : "#fff"; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = small ? "#c9a36a" : "#8a5a2b"; ctx.stroke();
    const im = IMG[name], a = A[name]; if (im) { const k = (r * 1.45) / Math.max(a.w, a.h); ctx.drawImage(im, px - (a.w * k) / 2, y - (a.h * k) / 2, a.w * k, a.h * k); }
    if (txt) { ctx.fillStyle = "#3f9b2a"; ctx.font = "900 20px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, px, y + 1); }
  }
  function tag(px, py, txt, locked) {
    ctx.font = "800 20px system-ui,sans-serif"; const w = ctx.measureText(txt).width + 46;
    ctx.fillStyle = locked ? "rgba(60,50,40,.8)" : "#fff7e0"; ctx.strokeStyle = "#8a5a2b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(px - w / 2, py - 17, w, 34, 17); ctx.fill(); ctx.stroke();
    if (IMG.ui_coin) ctx.drawImage(IMG.ui_coin, px - w / 2 + 8, py - 11, 23, 23);
    ctx.fillStyle = locked ? "#fff" : "#5a3a16"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(txt, px - w / 2 + 34, py + 1);
  }

  let P = null; // placement: {t, x, y, o?, f}
  function validP() {
    const t = T[P.t];
    for (let i = 0; i < t.w; i++) for (let j = 0; j < t.d; j++) { const x = P.x + i, y = P.y + j; if (!inMap(x, y) || !owned[pidOf(x, y)]) return false; const id = occ[x + y * N]; if (id && !(P.o && P.o.id === id)) return false; }
    return true;
  }

  let lastT = 0, sec = 0;
  function frame(t) {
    if (dead) return;
    const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
    if ((sec += dt) > 0.5) { sec = 0; S.objs.forEach(tickObj); tickOrders(); if (pop._live) pop._live(); }
    const W = cv.width, H = cv.height, z = cam.z * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#58c4ee"); g.addColorStop(1, "#2a93d4"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(z, 0, 0, z, W / 2 - cam.x * z, H / 2 - cam.y * z);
    const vx0 = cam.x - vw / 2 / cam.z, vx1 = cam.x + vw / 2 / cam.z, vy0 = cam.y - vh / 2 / cam.z, vy1 = cam.y + vh / 2 / cam.z;
    const vis = (p, m) => p[0] > vx0 - m && p[0] < vx1 + m && p[1] > vy0 - m && p[1] < vy1 + m;
    // island: foam, cliff, sand, grass
    ctx.lineJoin = "round";
    diamond(-2.2, -2.2, N + 2.2, N + 2.2); ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = 26 + Math.sin(t / 900) * 8; ctx.stroke();
    ctx.save(); ctx.translate(0, 34); diamond(-1.6, -1.6, N + 1.6, N + 1.6); ctx.fillStyle = "#b98a4e"; ctx.fill(); ctx.restore();
    diamond(-1.6, -1.6, N + 1.6, N + 1.6); ctx.fillStyle = "#f3dc9a"; ctx.fill();
    diamond(0, 0, N, N); ctx.fillStyle = "#5fae3c"; ctx.fill();
    for (let p = 0; p < NP * NP; p++) {
      const px = (p % NP) * PL, py = Math.floor(p / NP) * PL;
      if (!vis(w2p(px + PL / 2, py + PL / 2), PL * TW)) continue;
      if (owned[p]) {
        diamond(px, py, px + PL, py + PL); ctx.fillStyle = "#8fd14f"; ctx.fill();
        ctx.fillStyle = "#86c947"; ctx.beginPath();
        for (let i = 0; i < PL; i++) for (let j = (i & 1); j < PL; j += 2) { const a = w2p(px + i, py + j); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + TW / 2, a[1] + TH / 2); ctx.lineTo(a[0], a[1] + TH); ctx.lineTo(a[0] - TW / 2, a[1] + TH / 2); }
        ctx.fill();
      } else if (forSale(p)) { diamond(px + 0.15, py + 0.15, px + PL - 0.15, py + PL - 0.15); ctx.setLineDash([14, 12]); ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 4; ctx.stroke(); ctx.setLineDash([]); }
    }
    for (const g of [5, 0]) { // paths: a darker rim first, then the sand on top
      ctx.beginPath();
      for (const o of S.objs) if (o.t === "path" && !(P && P.o === o)) { const a = w2p(o.x, o.y); ctx.moveTo(a[0], a[1] - g / 2); ctx.lineTo(a[0] + TW / 2 + g, a[1] + TH / 2); ctx.lineTo(a[0], a[1] + TH + g / 2); ctx.lineTo(a[0] - TW / 2 - g, a[1] + TH / 2); ctx.closePath(); }
      ctx.fillStyle = g ? "#c29a5b" : "#ecd29a"; ctx.fill();
    }
    if (P) { const tt = T[P.t], ok = validP(); diamond(P.x, P.y, P.x + tt.w, P.y + tt.d); ctx.fillStyle = ok ? "rgba(120,255,120,.55)" : "rgba(255,70,70,.55)"; ctx.fill(); ctx.strokeStyle = ok ? "#1f9d2f" : "#c22"; ctx.lineWidth = 3; ctx.stroke(); }
    // sprites, back to front
    const list = [];
    for (const o of S.objs) { if ((P && P.o === o) || o.t === "path") continue; const c = center(o); if (vis(w2p(c[0], c[1]), 500)) list.push([c[0] + c[1], o]); }
    for (const p in wild) for (const w of wild[p]) if (vis(w2p(w.x, w.y), 400)) list.push([w.x + w.y, null, w]);
    list.sort((a, b) => a[0] - b[0]);
    for (const e of list) {
      const o = e[1];
      if (!o) { spr(e[2].s, e[2].x, e[2].y, e[2].k, e[2].f); continue; }
      const ps = parts(o, t);
      if (T[o.t].kind === "pen") { moveAnimals(o, dt); spr(...ps[0]); drawAnimals(o, t); spr(...ps[1]); } else for (const q of ps) spr(...q);
    }
    if (P) { const o = Object.assign({}, P.o, { t: P.t, x: P.x, y: P.y, f: P.f, _pop: 0 }); for (const q of parts(o, t)) spr(q[0], q[1], q[2], q[3], q[4], 0.75); }
    // overlays
    for (const e of list) {
      const o = e[1]; if (!o) continue; const tt = T[o.t], c = center(o), p = w2p(c[0], c[1]);
      if (tt.kind === "field") { if (ripe(o)) twinkle(p[0], p[1] - 30, t, o.id); continue; }
      if (tt.kind !== "deco" && cam.z > 0.42) label(o, tt);
      if (tt.kind === "prod") {
        const top = p[1] - A[tt.spr].ay * (TW / 192) - 6;
        if (o.out.length) bubble(p[0], top, "item_" + o.out[0], t);
        else if (o.q[0]) { const r = D.recipes[o.t][o.q[0].r], u = 1 - (o.q[0].end - now()) / (r.t * 1000); ctx.fillStyle = "#5a3a16"; ctx.beginPath(); ctx.roundRect(p[0] - 32, top, 64, 12, 6); ctx.fill(); ctx.fillStyle = "#7ed957"; ctx.beginPath(); ctx.roundRect(p[0] - 30, top + 2, 60 * Math.max(0.05, Math.min(1, u)), 8, 4); ctx.fill(); }
        else bubble(p[0], top, null, t, true, "+");
      } else if (tt.kind === "pen") for (const a of o.animals) { if (a.s === 1 || a._x == null) continue; const q = w2p(c[0] + a._x, c[1] + a._y); bubble(q[0], q[1] - 62, "item_" + (a.s === 2 ? tt.pen.out : tt.pen.feed), t, a.s === 0); }
    }
    for (let p = 0; p < NP * NP; p++) if (forSale(p)) { const q = w2p((p % NP) * PL + PL / 2, Math.floor(p / NP) * PL + PL / 2); if (vis(q, 100)) tag(q[0], q[1], String(D.landCost(S.bought)), S.lvl < D.landLvl(S.bought)); }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i], u = (t - f.t0) / 1100; if (u >= 1) { floats.splice(i, 1); continue; }
      const y = f.y - u * 46; ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1; ctx.font = "900 22px system-ui,sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.lineWidth = 5; ctx.strokeStyle = "#5a3a16"; ctx.strokeText(f.txt, f.x, y); ctx.fillStyle = "#fff"; ctx.fillText(f.txt, f.x, y);
      const im = f.item && IMG["item_" + f.item]; if (im) { const a = A["item_" + f.item], k = 30 / Math.max(a.w, a.h); ctx.drawImage(im, f.x + 4, y - (a.h * k) / 2, a.w * k, a.h * k); }
      ctx.globalAlpha = 1;
    }
    const tg = S.tut < TUT.length && !P && !panelRender && TUT[S.tut].tgt && TUT[S.tut].tgt();
    if (tg) { // bouncing arrow above the thing the tutorial wants you to tap
      const tt = T[tg.t], c = center(tg), p = w2p(c[0], c[1]), a = A[tt.spr + (tt.kind === "pen" ? "_back" : "")] || { ay: 90 };
      const y = p[1] - (tt.kind === "field" ? 70 : a.ay * (TW / 192) * (tt.sc || 1) + 34) - Math.abs(Math.sin(t / 260)) * 16;
      ctx.beginPath(); ctx.moveTo(p[0] - 13, y - 40); ctx.lineTo(p[0] + 13, y - 40); ctx.lineTo(p[0] + 13, y - 20); ctx.lineTo(p[0] + 27, y - 20); ctx.lineTo(p[0], y + 8); ctx.lineTo(p[0] - 27, y - 20); ctx.lineTo(p[0] - 13, y - 20); ctx.closePath();
      ctx.fillStyle = "#ffd21f"; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = "#7a4a00"; ctx.stroke();
    }
    if (pop._at) { const s = p2s(pop._at[0], pop._at[1]); pop.style.transform = `translate(${Math.round(s[0])}px,${Math.round(s[1])}px) translate(-50%,-100%)`; }
    requestAnimationFrame(frame);
  }

  // ---------- picking
  // hit masks (assets/masks.js, 1/4 resolution) instead of reading pixels: canvas reads are blocked on file:// and in extensions
  function hit(q, wx, wy) {
    const a = A[q[0]], k = (TW / 192) * (q[3] || 1), p = w2p(q[1], q[2]); let u = (wx - p[0]) / k; if (q[4]) u = -u; u += a.ax; const v = (wy - p[1]) / k + a.ay;
    if (u < 0 || v < 0 || u >= a.w || v >= a.h) return false;
    const m = M[q[0]]; if (!m) return false;
    if (!m.b) m.b = Uint8Array.from(atob(m.d), (ch) => ch.charCodeAt(0));
    const i = Math.floor(v / 4) * m.w + Math.floor(u / 4); return !!((m.b[i >> 3] >> (i & 7)) & 1);
  }
  function pick(sx, sy) {
    const t = s2t(sx, sy), wx = (sx - vw / 2) / cam.z + cam.x, wy = (sy - vh / 2) / cam.z + cam.y;
    const tall = S.objs.filter((o) => T[o.t].kind !== "field").sort((a, b) => { const p = center(a), q = center(b); return q[0] + q[1] - p[0] - p[1]; });
    for (const o of tall) for (const q of parts(o)) if (hit(q, wx, wy)) return o;
    return occAt(Math.floor(t[0]), Math.floor(t[1]));
  }

  // ---------- popups above objects (tools you drag, like the sickle)
  function closePop() { pop.classList.remove("on", "ghost"); pop._at = null; pop._live = null; pop.innerHTML = ""; }
  function openPop(o, html, live, cap) {
    const c = center(o), p = w2p(c[0], c[1]); pop._at = [p[0], p[1] - (T[o.t].kind === "field" ? 44 : 120)]; pop.innerHTML = '<button class="fg-popx" title="Sluiten">✕</button>' + (cap ? '<div class="fg-cap">' + cap + "</div>" : "") + html; pop.querySelector(".fg-popx").onclick = closePop; pop.classList.remove("ghost"); pop.classList.add("on"); pop._live = live || null;
    pop.querySelectorAll(".fg-tool").forEach((el) => el.addEventListener("pointerdown", (e) => startTool(e, el, o)));
  }
  const tool = (k, inner, sub, extra, lbl) => `<div class="fg-tool" data-k="${k}" ${extra || ""}><div class="fg-ti">${inner}</div>${sub != null ? `<b>${sub}</b>` : ""}${lbl ? `<i>${lbl}</i>` : ""}</div>`;
  function clickObj(o) {
    const tt = T[o.t]; tickObj(o); sfx(420, 0.05);
    if (tt.kind === "field") {
      if (!o.crop) return openPop(o, Object.keys(D.crops).filter((c) => D.crops[c].lvl <= S.lvl).map((c) => tool("plant", icon(c), have(c) || coin(D.crops[c].seed), `data-c="${c}"`, IT[c].n + " · " + fmt(D.crops[c].t))).join(""), null, "Kies een gewas en sleep het over je lege akkers");
      if (ripe(o)) return openPop(o, tool("sickle", SICKLE, null, "", "Sikkel"), null, "Rijp! Sleep de sikkel over je akkers");
      const live = () => { if (ripe(o)) return closePop(); const left = (D.crops[o.crop].t * 1000 - (now() - o.at)) / 1000; pop.querySelector("span").textContent = IT[o.crop].n + " groeit · nog " + fmt(left); pop.querySelector("button").innerHTML = "Nu klaar " + coin(D.skipCost(left)); };
      openPop(o, '<div class="fg-info"><span></span><button class="fg-btn sm"></button></div>', live); live();
      pop.querySelector("button").onclick = () => { const left = (D.crops[o.crop].t * 1000 - (now() - o.at)) / 1000; if (left > 0 && pay(D.skipCost(left))) { o.at = 0; o._pop = performance.now(); touch(); closePop(); } };
      return;
    }
    if (tt.kind === "pen") {
      const pn = tt.pen, render = () => {
        const hungry = o.animals.filter((a) => a.s === 0).length, ready = o.animals.filter((a) => a.s === 2).length, eat = o.animals.filter((a) => a.s === 1);
        let h = `<div class="fg-cap">${pn.an} eet ${icon(pn.feed)} en geeft na ${fmt(pn.t)} ${icon(pn.out)}</div>`;
        if (ready) h += tool("collect", BASKET, ready, "", "Verzamel"); if (hungry) h += tool("feed", icon(pn.feed), have(pn.feed), "", "Voer");
        h += `<div class="fg-info"><span>${o.animals.length}/${pn.cap} · ${eat.length ? "klaar over " + fmt((Math.min(...eat.map((a) => a.end)) - now()) / 1000) : hungry ? "honger!" : ready ? "klaar!" : "leeg"}</span>`;
        if (o.animals.length < pn.cap) h += `<button class="fg-btn sm" data-buy>+ ${pn.an} ${coin(pn.price)}</button>`;
        openPop(o, h + "</div>", () => { const s = pop.querySelector("span"); if (s && eat.length) { if (eat.some((a) => a.s !== 1)) render(); else s.textContent = `${o.animals.length}/${pn.cap} · klaar over ${fmt((Math.min(...eat.map((a) => a.end)) - now()) / 1000)}`; } });
        const b = pop.querySelector("[data-buy]"); if (b) b.onclick = () => { if (pay(pn.price)) { o.animals.push({ s: 0 }); o._pop = performance.now(); touch(); render(); } };
      };
      return render();
    }
    if (tt.kind === "prod") { if (o.out.length && collectOut(o)) return; return prodPanel(o); }
    if (tt.kind === "store") return storePanel(tt.store);
    if (tt.kind === "board") return ordersPanel();
    if (tt.kind !== "path") toast(tt.n + " — houd ingedrukt om te verplaatsen");
  }
  function collectOut(o) { let n = 0; while (o.out.length && gain(o.out[0], 1, o)) { o.out.shift(); n++; } return n; }
  function useTool(tl, o, tx, ty, all) {
    if (!o) return; const tt = T[o.t];
    if (tl.k === "plant" && tt.kind === "field" && !o.crop) {
      const c = tl.c; if (have(c) > 0) S.inv[c]--; else if (!pay(D.crops[c].seed)) return;
      o.crop = c; o.at = now(); o._pop = performance.now(); sfx(520, 0.07); touch(); tut("plant");
    } else if (tl.k === "sickle" && tt.kind === "field" && ripe(o)) { if (gain(o.crop, 2, o)) { o.crop = null; o.at = 0; tut("harvest"); } }
    else if ((tl.k === "feed" || tl.k === "collect") && tt.kind === "pen" && o.t === tl.src.t) {
      const c = center(o), want = tl.k === "feed" ? 0 : 2, pn = tt.pen; let list = o.animals.filter((a) => a.s === want);
      if (!all) list = list.filter((a) => Math.hypot(a._x - (tx - c[0]), a._y - (ty - c[1])) < 1).slice(0, 1);
      for (const a of list) {
        if (want === 0) { if (!have(pn.feed)) { warn("Geen " + IT[pn.feed].n.toLowerCase() + " — maak het in de Voedermolen."); break; } S.inv[pn.feed]--; a.s = 1; a.end = now() + (S.tut === 3 || S.tut === 4 ? 15 : pn.t) * 1000; a._tx = null; a._w = 2; o._pop = performance.now(); sfx(480, 0.07); touch(); tut("feed"); }
        else { if (!gain(pn.out, 1, o)) break; a.s = 0; tut("collect"); }
      }
    }
  }
  function startTool(e, el, src) {
    e.preventDefault(); e.stopPropagation(); try { el.setPointerCapture(e.pointerId); } catch (x) { /* synthetic pointer */ }
    const tl = { k: el.dataset.k, c: el.dataset.c, src }, sx = e.clientX, sy = e.clientY; let moved = false;
    dragEl.innerHTML = el.querySelector(".fg-ti").innerHTML;
    const mv = (ev) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 10) { moved = true; dragEl.classList.add("on"); pop.classList.add("ghost"); }
      if (!moved) return; const r = root.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
      dragEl.style.transform = `translate(${x}px,${y}px)`; const t = s2t(x, y + 6); useTool(tl, occAt(Math.floor(t[0]), Math.floor(t[1])), t[0], t[1], false);
    };
    const up = () => { el.removeEventListener("pointermove", mv); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); if (!moved) useTool(tl, src, 0, 0, true); dragEl.classList.remove("on"); closePop(); };
    el.addEventListener("pointermove", mv); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  }

  // ---------- placement / moving
  function startPlace(type, o) {
    closePop(); closePanel(); const tt = T[type];
    if (o) P = { t: type, x: o.x, y: o.y, o, f: o.f };
    else { const c = s2t(vw / 2, vh / 2); P = { t: type, x: Math.round(c[0] - tt.w / 2), y: Math.round(c[1] - tt.d / 2), f: false }; }
    placeBar.classList.add("on"); placeBar.querySelector("span").innerHTML = o ? tt.n + " verplaatsen" : tt.n + " " + coin(tt.cost);
    placeBar.querySelector('[data-p="flip"]').style.display = tt.kind === "deco" ? "" : "none";
    placeBar.querySelector('[data-p="bin"]').style.display = o && (tt.kind === "deco" || tt.kind === "path" || (tt.kind === "field" && !o.crop)) ? "" : "none";
  }
  function endPlace() { P = null; placeBar.classList.remove("on"); }
  const limit = (type) => (type === "field" ? D.maxFields(S.lvl) : T[type].max || 1e9);
  placeBar.addEventListener("click", (e) => {
    const a = e.target.closest("[data-p]"); if (!a || !P) return; const k = a.dataset.p, tt = T[P.t];
    if (k === "cancel") return endPlace();
    if (k === "flip") { P.f = !P.f; return; }
    if (k === "bin") { S.objs = S.objs.filter((o) => o !== P.o); rebuild(); touch(); return endPlace(); }
    if (!validP()) return warn("Hier kan het niet staan.");
    if (P.o) { P.o.x = P.x; P.o.y = P.y; P.o.f = P.f; P.o._pop = performance.now(); rebuild(); touch(); sfx(520, 0.08); return endPlace(); }
    if (count(P.t) >= limit(P.t)) return warn("Maximum bereikt voor " + tt.n + ".");
    if (!pay(tt.cost)) return;
    const o = { id: S.oid++, t: P.t, x: P.x, y: P.y, f: P.f, _pop: performance.now() };
    if (tt.kind === "prod") { o.q = []; o.out = []; o.slots = 2; } if (tt.kind === "pen") o.animals = [];
    S.objs.push(o); rebuild(); touch(); tut("place"); addXp(tt.kind === "path" ? 0 : tt.kind === "deco" || tt.kind === "field" ? 1 : 10);
    if (!["deco", "field", "path"].includes(tt.kind)) endPlace();
  });

  // ---------- pointer input: pan, pinch, tap, long-press to move
  const ptrs = new Map(); let drag = null, pinch = null, lpTimer = 0;
  const loc = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onGhost = (t) => P && t[0] >= P.x && t[1] >= P.y && t[0] < P.x + T[P.t].w && t[1] < P.y + T[P.t].d;
  cv.addEventListener("pointerdown", (e) => {
    try { cv.setPointerCapture(e.pointerId); } catch (x) { /* synthetic pointer */ } const l = loc(e); ptrs.set(e.pointerId, l); clearTimeout(lpTimer);
    if (ptrs.size === 2) { const a = [...ptrs.values()]; pinch = { d: Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]) }; drag = null; return; }
    drag = { sx: l[0], sy: l[1], cx: cam.x, cy: cam.y, moved: false, ghost: onGhost(s2t(l[0], l[1])) };
    if (!P) lpTimer = setTimeout(() => { if (!drag || drag.moved) return; const o = pick(drag.sx, drag.sy); if (o) { startPlace(o.t, o); drag.ghost = true; drag.moved = true; sfx(300, 0.1); } }, 480);
  });
  cv.addEventListener("pointermove", (e) => {
    if (!ptrs.has(e.pointerId)) return; const l = loc(e); ptrs.set(e.pointerId, l);
    if (pinch && ptrs.size === 2) { const a = [...ptrs.values()], d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); zoomAt((a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2, d / pinch.d); pinch.d = d; return; }
    if (!drag) return;
    if (!drag.moved && Math.hypot(l[0] - drag.sx, l[1] - drag.sy) > 7) { drag.moved = true; clearTimeout(lpTimer); }
    if (!drag.moved) return;
    if (drag.ghost && P) { const t = s2t(l[0], l[1]), tt = T[P.t]; P.x = Math.round(t[0] - tt.w / 2); P.y = Math.round(t[1] - tt.d / 2); }
    else { cam.x = drag.cx - (l[0] - drag.sx) / cam.z; cam.y = drag.cy - (l[1] - drag.sy) / cam.z; clampCam(); }
  });
  const endPtr = (e) => {
    if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); clearTimeout(lpTimer); if (ptrs.size < 2) pinch = null;
    const d = drag; drag = null; if (!d || d.moved || e.type === "pointercancel") return;
    const t = s2t(d.sx, d.sy);
    if (P) { const tt = T[P.t]; P.x = Math.round(t[0] - tt.w / 2); P.y = Math.round(t[1] - tt.d / 2); return; }
    const was = pop.classList.contains("on"); closePop();
    const o = pick(d.sx, d.sy); if (o) return clickObj(o);
    if (was) return;
    const x = Math.floor(t[0]), y = Math.floor(t[1]); if (!inMap(x, y)) return; const p = pidOf(x, y);
    if (!owned[p]) forSale(p) ? landPanel(p) : toast("Koop eerst het land ernaast.");
  };
  cv.addEventListener("pointerup", endPtr); cv.addEventListener("pointercancel", endPtr);
  cv.addEventListener("wheel", (e) => { e.preventDefault(); const l = loc(e); zoomAt(l[0], l[1], Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  cv.addEventListener("contextmenu", (e) => e.preventDefault());

  // ---------- panels
  let panelRender = null, acts = {}, holding = false;
  function openPanel(title, render, actions) {
    closePop(); $(".fg-panel h2").textContent = title; acts = actions || {};
    panelRender = () => { const st = body.scrollTop; body.innerHTML = render(); body.scrollTop = st; };
    panelRender(); modal.classList.add("on");
  }
  function closePanel() { modal.classList.remove("on"); panelRender = null; }
  modal.addEventListener("pointerdown", (e) => { holding = true; if (e.target === modal) closePanel(); });
  addEventListener("pointerup", () => (holding = false), sig);
  $(".fg-x").onclick = closePanel;
  body.addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (!b || b.disabled || !acts[b.dataset.act]) return; const keep = panelRender; acts[b.dataset.act](b.dataset); if (panelRender === keep && keep) keep(); });
  every(() => { if (panelRender && !holding) { S.objs.forEach(tickObj); panelRender(); } }, 1000);
  const needs = (inp) => Object.keys(inp).map((k) => `<span class="fg-need ${have(k) < inp[k] ? "lack" : ""}">${icon(k)}${have(k)}/${inp[k]}</span>`).join("");
  const canMake = (inp) => Object.keys(inp).every((k) => have(k) >= inp[k]);

  function prodPanel(o) {
    const recs = D.recipes[o.t];
    openPanel(T[o.t].n, () => {
      let h = `<p class="fg-hint">${T[o.t].info || ""}</p><div class="fg-queue">`;
      for (let i = 0; i < o.slots; i++) { const q = o.q[i]; h += `<div class="fg-slot ${q ? "on" : ""}">${q ? icon(recs[q.r].out) + (i === 0 ? `<small>${fmt((q.end - now()) / 1000)}</small>` : "") : ""}</div>`; }
      if (o.slots < D.maxSlots) h += `<button class="fg-slot add" data-act="slot">+<small>${coin(D.slotCost(o.slots))}</small></button>`;
      h += "</div>";
      if (o.q[0]) { const left = (o.q[0].end - now()) / 1000; h += `<div class="fg-row"><div class="fg-bar"><i style="width:${Math.max(0, 100 - (left / recs[o.q[0].r].t) * 100)}%"></i></div><button class="fg-btn sm" data-act="skip">Nu klaar ${coin(D.skipCost(left))}</button></div>`; }
      if (o.out.length) h += `<div class="fg-row fg-out">${o.out.map(icon).join("")}<button class="fg-btn" data-act="take">Verzamel</button></div>`;
      return h + '<div class="fg-grid">' + recs.map((r, i) => r.lvl > S.lvl
        ? `<div class="fg-card lock">${icon(r.out)}<b>${IT[r.out].n}</b><em>Level ${r.lvl}</em></div>`
        : `<button class="fg-card" data-act="make" data-i="${i}" ${canMake(r.in) && o.q.length < o.slots ? "" : "disabled"}>${icon(r.out)}<b>${IT[r.out].n}${r.n > 1 ? " ×" + r.n : ""}</b><div>${needs(r.in)}</div><em>⏱ ${fmt(r.t)}</em></button>`).join("") + "</div>";
    }, {
      slot() { if (pay(D.slotCost(o.slots))) { o.slots++; touch(); } },
      skip() { const d = o.q[0].end - now(); if (d > 0 && pay(D.skipCost(d / 1000))) { o.q.forEach((q) => (q.end -= d)); tickObj(o); touch(); } },
      take() { collectOut(o); },
      make(d) { const r = recs[d.i]; if (!canMake(r.in) || o.q.length >= o.slots) return; for (const k in r.in) S.inv[k] -= r.in[k]; const st = o.q.length ? o.q[o.q.length - 1].end : now(); o.q.push({ r: +d.i, end: st + r.t * 1000 }); o._pop = performance.now(); sfx(520, 0.08); touch(); tut("make"); },
    });
  }
  function storePanel(st) {
    const name = st === "silo" ? "Silo" : "Schuur";
    openPanel(name, () => {
      const keys = Object.keys(IT).filter((k) => IT[k].s === st && have(k) > 0), n = stored(st);
      return `<p class="fg-hint">${st === "silo" ? "Hier liggen je gewassen. Je zaait ermee en je gebouwen gebruiken ze." : "Hier liggen eieren, melk, voer en alles wat je gebouwen maken."}</p><div class="fg-row"><div class="fg-bar"><i style="width:${(n / S.cap[st]) * 100}%"></i></div><b>${n} / ${S.cap[st]}</b></div>` +
        (keys.length ? '<div class="fg-grid small">' + keys.map((k) => `<div class="fg-card">${icon(k)}<b>${IT[k].n}</b><em>× ${have(k)}</em></div>`).join("") + "</div>" : `<p class="fg-empty">Nog leeg. ${st === "silo" ? "Oogst je akkers!" : "Verzamel producten van dieren en gebouwen."}</p>`) +
        `<div class="fg-row end"><button class="fg-btn" data-act="up">Vergroot +${D.capStep} ${coin(D.capCost(S.cap[st]))}</button></div>`;
    }, { up() { if (pay(D.capCost(S.cap[st]))) { S.cap[st] += D.capStep; touch(); } } });
  }
  function ordersPanel() {
    tickOrders(); tut("orders");
    openPanel("Bestellingen", () => '<p class="fg-hint">Lever bestellingen voor XP en nieuwe levels. Munten verdien je in de Arcade.</p><div class="fg-orders">' + S.orders.map((o, i) => o.wait
      ? `<div class="fg-order wait">Nieuwe bestelling over ${fmt((o.wait - now()) / 1000)}</div>`
      : `<div class="fg-order"><b>${o.who}</b><div>${needs(o.need)}</div><span class="fg-xpr">★ ${o.xp} XP</span><button class="fg-btn sm no" data-act="bin" data-i="${i}">✕</button><button class="fg-btn sm" data-act="go" data-i="${i}" ${canMake(o.need) ? "" : "disabled"}>Lever</button></div>`).join("") + "</div>", {
      bin(d) { S.orders[d.i] = { wait: now() + 30000 }; touch(); },
      go(d) { const o = S.orders[d.i]; if (!canMake(o.need)) return; for (const k in o.need) S.inv[k] -= o.need[k]; S.orders[d.i] = { wait: now() + 15000 }; const b = S.objs.find((x) => x.t === "board"); if (b) { b._cart = performance.now(); float(b, "+" + o.xp + " XP"); } sfx(700, 0.2); addXp(o.xp); },
    });
  }
  function landPanel(p) {
    const cost = D.landCost(S.bought), lvl = D.landLvl(S.bought);
    openPanel("Land kopen", () => `<p class="fg-hint">Breid je boerderij uit met een nieuw stuk land. De bomen en rotsen worden voor je opgeruimd.</p><div class="fg-row end">${S.lvl < lvl ? `<em>Vanaf level ${lvl}</em>` : `<button class="fg-btn" data-act="buy">Koop ${coin(cost)}</button>`}</div>`,
      { buy() { if (!pay(cost)) return; S.plots.push(p); S.bought++; rebuild(); addXp(15); sfx(800, 0.3); closePanel(); } });
  }
  let shopTab = "farm";
  function shopPanel() {
    const tabs = { farm: "Boerderij", build: "Gebouwen", deco: "Decoratie" };
    openPanel("Winkel", () => '<div class="fg-tabs">' + Object.keys(tabs).map((k) => `<button class="${k === shopTab ? "on" : ""}" data-act="tab" data-k="${k}">${tabs[k]}</button>`).join("") + '</div><div class="fg-grid">' +
      Object.keys(T).filter((k) => T[k].cat === shopTab).sort((a, b) => T[a].lvl - T[b].lvl).map((k) => {
        const t = T[k], im = t.kind === "path" ? '<span class="fg-pathic"></span>' : `<img class="fg-shopimg" src="${BASE}${t.spr}${t.kind === "pen" ? "_back" : ""}.png" alt="" draggable="false">`, n = count(k), mx = limit(k);
        if (t.lvl > S.lvl) return `<div class="fg-card lock">${im}<b>${t.n}</b><em>Level ${t.lvl}</em></div>`;
        return `<button class="fg-card" data-act="buy" data-k="${k}" ${n >= mx ? "disabled" : ""}>${im}<b>${t.n}</b>${t.short ? "<small>" + t.short + "</small>" : ""}<em>${mx < 1e9 ? n + "/" + mx + " · " : ""}${coin(t.cost)}</em></button>`;
      }).join("") + "</div>", { tab(d) { shopTab = d.k; }, buy(d) { startPlace(d.k); } });
  }
  function levelPanel(lvl) {
    const un = [];
    for (const c in D.crops) if (D.crops[c].lvl === lvl) un.push(icon(c) + "<b>" + IT[c].n + "</b>");
    for (const k in T) if (T[k].lvl === lvl) un.push(`<img class="fg-shopimg" src="${BASE}${T[k].spr}${T[k].kind === "pen" ? "_back" : ""}.png" alt=""><b>${T[k].n}</b>`);
    for (const b in D.recipes) for (const r of D.recipes[b]) if (r.lvl === lvl && T[b].lvl < lvl) un.push(icon(r.out) + "<b>" + IT[r.out].n + "</b>");
    sfx(520, 0.5, "triangle");
    openPanel("Level " + lvl + "!", () => `<p class="fg-hint">Goed bezig, boer! ${un.length ? "Nieuw ontgrendeld:" : ""}</p><div class="fg-grid small">${un.map((u) => `<div class="fg-card">${u}</div>`).join("")}</div><div class="fg-row end"><button class="fg-btn" data-act="ok">Verder</button></div>`, { ok: closePanel });
  }
  function introPanel() {
    openPanel("Welkom op je boerderij!", () => `<div class="fg-intro"><p><b>Zaaien:</b> tik op een lege akker en sleep een gewas over je akkers.</p><p><b>Oogsten:</b> tik op een rijpe akker en sleep de sikkel erover.</p><p><b>Dieren:</b> maak voer in de Voedermolen, voer je dieren en verzamel met de mand.</p><p><b>Bouwen:</b> koop akkers, dieren, gebouwen en land in de Winkel. Houd iets ingedrukt om het te verplaatsen.</p><p><b>Munten</b> verdien je niet hier, maar in de <b>Arcade</b>. Hier geef je ze uit!</p></div><div class="fg-row end"><button class="fg-btn" data-act="ok">Aan de slag</button></div>`,
      { ok() { S.intro = false; touch(); closePanel(); } });
  }
  const lv = (l) => (l > S.lvl ? ` · <em>level ${l}</em>` : "");
  function guidePanel() {
    const row = (a, b, c) => `<div class="fg-chain"><b>${a}</b><span>${b}</span><span>→ ${c}</span></div>`;
    openPanel("Gids", () => {
      let h = '<p class="fg-hint">Zo werkt je boerderij: wat je nodig hebt en wat je ervoor krijgt.</p><h3>Akkers</h3>';
      for (const c in D.crops) h += row(icon(c) + " " + IT[c].n, "groeit " + fmt(D.crops[c].t) + lv(D.crops[c].lvl), "2× " + icon(c));
      h += "<h3>Dieren</h3>";
      for (const k in T) if (T[k].kind === "pen") { const p = T[k].pen; h += row(T[k].n, "voer: " + icon(p.feed) + " · " + fmt(p.t) + lv(T[k].lvl), icon(p.out) + " " + IT[p.out].n); }
      for (const b in D.recipes) { h += "<h3>" + T[b].n + lv(T[b].lvl) + "</h3>"; for (const r of D.recipes[b]) h += row(icon(r.out) + " " + IT[r.out].n, Object.keys(r.in).map((i) => r.in[i] + "× " + icon(i)).join(" ") + " · " + fmt(r.t) + lv(r.lvl), (r.n > 1 ? r.n + "× " : "") + icon(r.out)); }
      return h + '<h3>Goed om te weten</h3><p class="fg-hint">Tik op iets om het te gebruiken, houd het ingedrukt om het te verplaatsen. Bestellingen geven XP, XP geeft levels, levels geven nieuwe gewassen en gebouwen. Munten verdien je in de Arcade en geef je hier uit aan land, dieren, gebouwen en versnellen.</p><div class="fg-row end"><button class="fg-btn" data-act="tut">Uitleg opnieuw</button></div>';
    }, { tut() { S.tut = 0; touch(); closePanel(); questUI(); } });
  }
  // step-by-step tutorial: each step waits for one event and points an arrow at its target
  const fld = (f) => S.objs.find((o) => o.t === "field" && f(o)), obj = (t) => S.objs.find((o) => o.t === t);
  const TUT = [
    { ev: "harvest", txt: "Oogst je tarwe: tik op een gouden akker en sleep de sikkel over je akkers.", tgt: () => fld(ripe) },
    { ev: "plant", txt: "Zaai opnieuw: tik op een lege akker en sleep de tarwe over je akkers.", tgt: () => fld((o) => !o.crop) },
    { ev: "make", txt: "Maak voer: tik op de Voedermolen en kies Kippenvoer.", tgt: () => obj("feedmill") },
    { ev: "feed", txt: "Voer je kippen: tik op het Kippenhok en tik op het voer.", tgt: () => obj("coop") },
    { ev: "collect", txt: "Even wachten… Zie je een ei boven een kip? Tik op het hok en tik op de mand.", tgt: () => obj("coop") },
    { ev: "orders", txt: "Tik op het Bestelbord: bestellingen leveren geeft XP en nieuwe levels.", tgt: () => obj("board") },
    { ev: "place", txt: "Open de Winkel en zet een extra akker neer. Munten verdien je in de Arcade!" },
  ];
  function tut(ev) { if (S.tut < TUT.length && TUT[S.tut].ev === ev) { S.tut++; touch(); questUI(); sfx(880, 0.15); if (S.tut === TUT.length) toast("Je kent de basis! Tik op ? voor de gids."); } }
  function questUI() {
    const q = $(".fg-quest"), on = S.tut < TUT.length; q.classList.toggle("on", on);
    if (on) q.querySelector("span").innerHTML = `<b>Stap ${S.tut + 1}/${TUT.length}</b> ${TUT[S.tut].txt}`;
    $('[data-a="shop"]').classList.toggle("pulse", on && TUT[S.tut].ev === "place");
  }
  $(".fg-quest button").onclick = () => { S.tut = 99; touch(); questUI(); };
  function defaultPaths() { // a starter road in front of the barn and down past the fields; only on free owned tiles
    if (S.paths1) return; S.paths1 = 1;
    const put = (x, y) => { if (owned[pidOf(x, y)] && !occ[x + y * N]) S.objs.push({ id: S.oid++, t: "path", x, y }); };
    for (let x = 16; x < 32; x++) put(x, 20); for (let y = 21; y < 32; y++) put(24, y);
    rebuild(); touch();
  }
  $(".fg-btns").addEventListener("click", (e) => {
    const a = e.target.closest("[data-a]"); if (!a) return; const k = a.dataset.a;
    if (k === "help") guidePanel(); else if (k === "shop") shopPanel(); else if (k === "orders") ordersPanel(); else if (k === "home") { cam.x = 0; cam.y = 24 * TH; cam.z = 0.6; } else if (k === "mute") { S.mute = !S.mute; touch(); hud(); }
  });
  $(".fg-plus").onclick = () => { if (Wallet.demo) { Wallet.add(100); hud(); toast("Demo: +100 munten uit de Arcade"); } };
  addEventListener("keydown", (e) => { if (e.key === "Escape") { if (P) endPlace(); else if (panelRender) closePanel(); else closePop(); } }, sig);

  // ---------- boot
  const api = { dispose() { if (dead) return; dead = true; if (dirty) save(); ac.abort(); ivs.forEach(clearInterval); ro.disconnect(); if (actx) actx.close(); root.innerHTML = ""; }, refreshCoins: hud, state: () => S, save, pick: (x, y) => pick(x, y), screen: (x, y) => p2s(...w2p(x, y)) };
  const names = Object.keys(A); let left = names.length;
  const ci = new Image(); ci.onload = () => (IMG.ui_coin = ci); ci.src = COIN;
  const done = () => { if (--left || dead) return; $(".fg-load").remove(); resize(); rebuild(); defaultPaths(); hud(); questUI(); tickOrders(); if (S.intro) introPanel(); requestAnimationFrame((t) => { lastT = t; frame(t); }); };
  names.forEach((n) => { const im = new Image(); im.onload = () => { IMG[n] = im; done(); }; im.onerror = done; im.src = BASE + n + ".png"; });
  return api;
  }
  window.FarmGame = { mount };
})();
