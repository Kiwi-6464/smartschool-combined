/**
 * Smartschool Combined — Texas Hold'em for the Arcade (lazy module "arcade2", lazy.js).
 *
 *   window.sscHubGames.poker(stage, side, api)   same contract as Roulette / Blackjack (see hub-games.js)
 *   window.sscHubGames.pokerTest                 the pure engine for tests/poker.js
 *
 * Play money only: the arcade coins. You buy in with api.take(), your stack is paid back with api.give() when you
 * stand up or leave. Three AI players estimate their chances with a quick Monte-Carlo simulation (own personalities).
 *
 * SERVER OPTION (off by default): when the owner has a server, a WebSocket URL can be saved in the side panel
 * (chrome.storage.local "sscPokerServer"). "Online" then drives the same table from server snapshots. Protocol:
 *   client -> server  {t:"join", name, buyIn, stake}  {t:"act", a:"fold"|"check"|"call"|"raise", to:number}  {t:"leave"}
 *   server -> client  {t:"state", view:{ seats:[{name,stack,bet,folded,allIn,dealer,toAct,me,cards:[{r,s}|null,..],win,label}],
 *                      board:[{r,s}], pot, stage, handNo, legal:null|{canCheck,call,minTo,maxTo}, msg }}  {t:"error", msg}
 * The server must deal and judge the cards (never trust the client); coins are settled locally for now (see POKER-SERVER.md).
 * Nothing connects anywhere unless the player saves a URL and presses "Verbind".
 */
(function () {
  "use strict";

  if (window.sscSkipPage) return;
  window.sscHubGames = window.sscHubGames || {};
  if (window.sscHubGames.poker) return;

  /* ====================================================================== */
  /* Engine (pure)                                                           */
  /* ====================================================================== */

  var SUITS = ["♠", "♥", "♦", "♣"];
  var RANKS = { 11: "J", 12: "Q", 13: "K", 14: "A" };
  function rankName(r) { return RANKS[r] || String(r); }
  var HAND_NAMES = ["Hoge kaart", "Paar", "Twee paar", "Drie gelijke", "Straat", "Kleur", "Full house", "Carré", "Straight flush"];

  function rnd(n) {
    if (window.crypto && window.crypto.getRandomValues) {
      var a = new Uint32Array(1);
      window.crypto.getRandomValues(a);
      return a[0] % n;
    }
    return Math.floor(Math.random() * n);
  }

  function newDeck() {
    var d = [];
    for (var s = 0; s < 4; s++) for (var r = 2; r <= 14; r++) d.push({ r: r, s: s });
    for (var i = d.length - 1; i > 0; i--) { var j = rnd(i + 1), t = d[i]; d[i] = d[j]; d[j] = t; }
    return d;
  }

  /** Score of exactly five cards: category * 15^5 + tiebreakers packed in base 15. */
  function score5(c) {
    var counts = {}, i, flush = true;
    for (i = 0; i < 5; i++) { counts[c[i].r] = (counts[c[i].r] || 0) + 1; if (c[i].s !== c[0].s) flush = false; }
    var groups = Object.keys(counts).map(Number).sort(function (a, b) { return counts[b] - counts[a] || b - a; });
    var shape = groups.map(function (r) { return counts[r]; }).join("");
    var top = groups[0], straight = false;
    if (groups.length === 5) {
      var hi = Math.max.apply(null, groups), lo = Math.min.apply(null, groups);
      if (hi - lo === 4) { straight = true; top = hi; }
      else if (hi === 14 && groups.indexOf(5) !== -1 && groups.indexOf(4) !== -1 && groups.indexOf(3) !== -1 && groups.indexOf(2) !== -1) { straight = true; top = 5; }
    }
    var cat;
    if (straight && flush) cat = 8;
    else if (shape === "41") cat = 7;
    else if (shape === "32") cat = 6;
    else if (flush) cat = 5;
    else if (straight) cat = 4;
    else if (shape === "311") cat = 3;
    else if (shape === "221") cat = 2;
    else if (shape === "2111") cat = 1;
    else cat = 0;
    var tb = straight ? [top] : groups;
    var v = cat;
    for (i = 0; i < 5; i++) v = v * 15 + (tb[i] || 0);
    return v;
  }

  /** Best five of up to seven cards. */
  function best7(cards) {
    var n = cards.length, best = -1;
    if (n < 5) return -1;
    for (var a = 0; a < n - 4; a++) for (var b = a + 1; b < n - 3; b++) for (var c = b + 1; c < n - 2; c++) for (var d = c + 1; d < n - 1; d++) for (var e = d + 1; e < n; e++) {
      var sc = score5([cards[a], cards[b], cards[c], cards[d], cards[e]]);
      if (sc > best) best = sc;
    }
    return best;
  }

  function handName(score) {
    var cat = Math.floor(score / 759375);
    if (cat === 8 && Math.floor(score / 50625) % 15 === 14) return "Royal flush";
    return HAND_NAMES[cat] || "";
  }

  /** Main pot and side pots from what everybody put in. players: [{ total, folded }] */
  function sidePots(players) {
    var levels = [];
    players.forEach(function (p) { if (p.total > 0 && levels.indexOf(p.total) === -1) levels.push(p.total); });
    levels.sort(function (a, b) { return a - b; });
    var pots = [], prev = 0;
    levels.forEach(function (L) {
      var amount = 0, elig = [];
      players.forEach(function (p, i) {
        amount += Math.max(0, Math.min(p.total, L) - prev);
        if (!p.folded && p.total >= L) elig.push(i);
      });
      prev = L;
      if (amount <= 0) return;
      if (!elig.length && pots.length) pots[pots.length - 1].amount += amount;
      else pots.push({ amount: amount, elig: elig });
    });
    return pots;
  }

  function Table(cfg) {
    this.sb = cfg.sb;
    this.bb = cfg.bb;
    this.p = cfg.seats.map(function (s) {
      return { name: s.name, stack: s.stack, human: !!s.human, bet: 0, total: 0, folded: true, allIn: false, out: s.stack <= 0, hole: [], acted: false, won: 0, label: "" };
    });
    this.button = -1;
    this.board = [];
    this.stage = "idle";
    this.cur = -1;
    this.curBet = 0;
    this.minRaise = cfg.bb;
    this.handNo = 0;
    this.results = [];
    this.deck = [];
    this.log = [];
  }

  Table.prototype = {
    pot: function () {
      var t = 0;
      this.p.forEach(function (p) { t += p.total; });
      return t;
    },
    nextIdx: function (i, pred) {
      var n = this.p.length;
      for (var k = 1; k <= n; k++) { var j = (i + k) % n; if (pred(this.p[j], j)) return j; }
      return -1;
    },
    inHand: function (p) { return !p.out && !p.folded; },
    canAct: function (p) { return !p.out && !p.folded && !p.allIn; },
    count: function (pred) { var n = 0; this.p.forEach(function (p) { if (pred(p)) n++; }); return n; },
    say: function (t) { this.log.push(t); if (this.log.length > 40) this.log.shift(); },

    post: function (i, amt) {
      var p = this.p[i], a = Math.min(amt, p.stack);
      p.stack -= a; p.bet += a; p.total += a;
      if (p.stack === 0) p.allIn = true;
      return a;
    },

    /** Deals a new hand. False when fewer than two players have chips. */
    start: function () {
      var self = this;
      this.p.forEach(function (p) { p.out = p.stack <= 0; });
      if (this.count(function (p) { return !p.out; }) < 2) return false;
      this.handNo++;
      this.board = []; this.results = []; this.curBet = 0; this.minRaise = this.bb;
      this.p.forEach(function (p) { p.bet = 0; p.total = 0; p.folded = p.out; p.allIn = false; p.acted = false; p.hole = []; p.won = 0; p.label = ""; });
      this.deck = newDeck();
      this.button = this.nextIdx(this.button, function (p) { return !p.out; });
      var active = this.count(function (p) { return !p.out; });
      var sb = active === 2 ? this.button : this.nextIdx(this.button, function (p) { return !p.out; });
      var bb = this.nextIdx(sb, function (p) { return !p.out; });
      for (var r = 0; r < 2; r++) this.p.forEach(function (p) { if (!p.out) p.hole.push(self.deck.pop()); });
      this.post(sb, this.sb); this.post(bb, this.bb);
      this.curBet = this.bb;
      this.stage = "preflop";
      this.say("Nieuwe hand #" + this.handNo + ". Blinds " + this.sb + "/" + this.bb + ".");
      this.cur = this.nextIdx(bb, function (p) { return self.canAct(p); });
      if (this.count(function (p) { return self.canAct(p); }) < 2) this.cur = -1;
      return true;
    },

    legal: function () {
      var p = this.p[this.cur];
      if (!p) return null;
      var toCall = Math.max(0, this.curBet - p.bet), self = this;
      var others = this.count(function (q) { return q !== p && self.canAct(q); });
      var maxTo = p.bet + p.stack, minTo = Math.min(maxTo, this.curBet + this.minRaise);
      return { canCheck: toCall === 0, call: Math.min(toCall, p.stack), toCall: toCall, canRaise: p.stack > toCall && others > 0, minTo: minTo, maxTo: maxTo, pot: this.pot() };
    },

    /** a = "fold" | "check" | "call" | "raise" (raise has `to`, the total bet this round). */
    act: function (a, to) {
      if (this.cur < 0 || this.stage === "done") return false;
      var p = this.p[this.cur], L = this.legal();
      if (a === "check" && !L.canCheck) a = "call";
      if (a === "call" && L.toCall === 0) a = "check";
      if (a === "fold") { p.folded = true; this.say(p.name + " past."); }
      else if (a === "check") this.say(p.name + " checkt.");
      else if (a === "call") { var paid = this.post(this.cur, L.toCall); this.say(p.name + (p.allIn ? " gaat all-in met " : " call ") + paid + "."); }
      else if (a === "raise") {
        if (!L.canRaise) return this.act("call");
        to = Math.floor(Math.max(this.curBet + 1, Math.min(L.maxTo, to)));
        if (to < L.minTo && to < L.maxTo) to = L.minTo;
        var size = to - this.curBet;
        this.post(this.cur, to - p.bet);
        if (size >= this.minRaise) {
          this.minRaise = size;
          var self = this, me = p;
          this.p.forEach(function (q) { if (q !== me) q.acted = false; });
        }
        this.curBet = Math.max(this.curBet, p.bet);
        this.say(p.name + (p.allIn ? " gaat all-in tot " : " verhoogt naar ") + p.bet + ".");
      } else return false;
      p.acted = true;
      this.advance();
      return true;
    },

    needsAction: function (p) {
      var self = this;
      if (!this.canAct(p)) return false;
      if (this.count(function (q) { return self.canAct(q); }) === 1 && p.bet >= this.curBet) return false;
      return !p.acted || p.bet < this.curBet;
    },

    advance: function () {
      var self = this;
      if (this.count(function (p) { return self.inHand(p); }) === 1) { this.finish(true); return; }
      var next = this.nextIdx(this.cur, function (p) { return self.needsAction(p); });
      if (next === -1) { this.cur = -1; this.streetDone = true; return; }
      this.cur = next;
    },

    /** Next street (or showdown). Called by the UI when cur === -1 so each street can be animated. */
    proceed: function () {
      var self = this;
      if (this.stage === "done") return;
      this.streetDone = false;
      this.p.forEach(function (p) { p.bet = 0; p.acted = false; });
      this.curBet = 0; this.minRaise = this.bb;
      var d = this.deck;
      if (this.stage === "preflop") { d.pop(); this.board.push(d.pop(), d.pop(), d.pop()); this.stage = "flop"; }
      else if (this.stage === "flop") { d.pop(); this.board.push(d.pop()); this.stage = "turn"; }
      else if (this.stage === "turn") { d.pop(); this.board.push(d.pop()); this.stage = "river"; }
      else { this.finish(false); return; }
      this.say(this.stage === "flop" ? "Flop." : this.stage === "turn" ? "Turn." : "River.");
      this.cur = this.nextIdx(this.button, function (p) { return self.canAct(p); });
      if (this.count(function (p) { return self.canAct(p); }) < 2) { this.cur = -1; this.streetDone = true; }
    },

    finish: function (uncontested) {
      var self = this, pots = sidePots(this.p);
      this.results = [];
      if (uncontested) {
        var w = this.nextIdx(-1, function (p) { return self.inHand(p); });
        pots.forEach(function (pt) { self.p[w].stack += pt.amount; self.p[w].won += pt.amount; });
        this.results.push({ winners: [w], amount: this.pot(), hand: "" });
        this.say(this.p[w].name + " wint " + this.pot() + " (iedereen past).");
      } else {
        var scores = {};
        this.p.forEach(function (p, i) { if (self.inHand(p)) { scores[i] = best7(p.hole.concat(self.board)); p.label = handName(scores[i]); } });
        pots.forEach(function (pt) {
          var best = -1, win = [];
          pt.elig.forEach(function (i) { if (scores[i] > best) { best = scores[i]; win = [i]; } else if (scores[i] === best) win.push(i); });
          var share = Math.floor(pt.amount / win.length), extra = pt.amount - share * win.length;
          win.sort(function (a, b) { return ((a - self.button + self.p.length - 1) % self.p.length) - ((b - self.button + self.p.length - 1) % self.p.length); });
          win.forEach(function (i, k) { var g = share + (k < extra ? 1 : 0); self.p[i].stack += g; self.p[i].won += g; });
          self.results.push({ winners: win, amount: pt.amount, hand: handName(best) });
          self.say(win.map(function (i) { return self.p[i].name; }).join(" & ") + " wint " + pt.amount + " met " + handName(best).toLowerCase() + ".");
        });
      }
      this.stage = "done";
      this.cur = -1;
      this.p.forEach(function (p) { p.bet = 0; });
    },
  };

  /** Chance (0..1) that `hole` wins against `opps` random hands, by sampling. */
  function equity(hole, board, opps, iters) {
    var used = {};
    hole.concat(board).forEach(function (c) { used[c.r * 4 + c.s] = 1; });
    var rest = [];
    for (var s = 0; s < 4; s++) for (var r = 2; r <= 14; r++) if (!used[r * 4 + s]) rest.push({ r: r, s: s });
    var need = 5 - board.length, win = 0;
    for (var it = 0; it < iters; it++) {
      var n = need + opps * 2;
      for (var i = 0; i < n; i++) { var j = i + rnd(rest.length - i), t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
      var full = board.concat(rest.slice(0, need)), mine = best7(hole.concat(full)), beaten = 0, tied = 0;
      for (var o = 0; o < opps; o++) {
        var sc = best7([rest[need + o * 2], rest[need + o * 2 + 1]].concat(full));
        if (sc > mine) { beaten = -1; break; }
        if (sc === mine) tied++;
      }
      if (beaten === 0) win += tied ? 1 / (tied + 1) : 1;
    }
    return win / iters;
  }

  var PERSONAS = [
    { name: "Jules", face: "🦊", aggr: 1.25, loose: 1.15 },
    { name: "Nora", face: "🐼", aggr: 0.8, loose: 0.9 },
    { name: "Bas", face: "🐙", aggr: 1.0, loose: 1.0 },
  ];

  /** The AI: returns { a, to }. */
  function decide(tbl, i, persona) {
    var p = tbl.p[i], L = tbl.legal(), opps = tbl.count(function (q) { return q !== p && tbl.inHand(q); });
    var eq = equity(p.hole, tbl.board, Math.max(1, opps), 140);
    var pot = L.pot, odds = L.toCall / (pot + L.toCall || 1), noise = (rnd(1000) / 1000 - 0.5) * 0.08;
    var s = eq + noise, r = rnd(1000) / 1000;
    var pr = persona || PERSONAS[2];
    function raiseTo(frac) { return Math.round(tbl.curBet + Math.max(tbl.bb, pot * frac)); }
    if (L.toCall === 0) {
      if (L.canRaise && (s > 0.62 / pr.aggr && r < 0.75 || r < 0.06 * pr.aggr)) return { a: "raise", to: raiseTo(s > 0.8 ? 0.9 : 0.55) };
      return { a: "check" };
    }
    if (s < odds * 0.95 / pr.loose && r > 0.07 * pr.loose) return { a: "fold" };
    if (L.canRaise && s > 0.74 / pr.aggr && r < 0.55 * pr.aggr) return { a: "raise", to: raiseTo(s > 0.88 ? 1.1 : 0.7) };
    return { a: "call" };
  }

  window.sscHubGames.pokerTest = { score5: score5, best7: best7, handName: handName, sidePots: sidePots, Table: Table, decide: decide, equity: equity, PERSONAS: PERSONAS };

  /* ====================================================================== */
  /* UI                                                                      */
  /* ====================================================================== */

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
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

  function cardNode(card, down) {
    var red = card && (card.s === 1 || card.s === 2);
    var node = h("div", "hg-card");
    node.setAttribute("data-red", red ? "1" : "0");
    var inner = h("div", "hg-card-in");
    var front = h("div", "hg-card-face");
    var sym = card ? SUITS[card.s] : "", rk = card ? rankName(card.r) : "";
    var tl = h("span", "hg-card-idx"); tl.appendChild(h("b", null, rk)); tl.appendChild(h("i", null, sym));
    front.appendChild(tl); front.appendChild(h("span", "hg-card-pip", sym));
    var br = h("span", "hg-card-idx hg-card-idx--br"); br.appendChild(h("b", null, rk)); br.appendChild(h("i", null, sym));
    front.appendChild(br);
    inner.appendChild(front); inner.appendChild(h("div", "hg-card-back"));
    node.appendChild(inner);
    if (down) node.setAttribute("data-down", "1");
    return node;
  }

  var CSS = [
    ".hg-field[hidden], .hg-row[hidden], .hg-ghost[hidden], .hg-main[hidden], .pk-help[hidden], .pk-seat[hidden] { display: none !important; }",
    ".pk-felt { position: relative; aspect-ratio: 16 / 11; min-height: 470px; width: 100%; border-radius: 999px / 46%; padding: 0;",
    "  background: radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--hb-green) 62%, #0b2a1a), color-mix(in srgb, var(--hb-green) 30%, #04140b) 78%);",
    "  box-shadow: inset 0 0 0 10px color-mix(in srgb, var(--hb-ink) 14%, #2a1608), inset 0 0 0 12px rgb(0 0 0 / .35), inset 0 0 70px rgb(0 0 0 / .55), 0 28px 50px -24px var(--hb-shade); color: #fff; overflow: hidden; }",
    ".pk-felt::before { content: ''; position: absolute; inset: 11% 8%; border-radius: 999px / 46%; border: 1.5px solid rgb(255 255 255 / .14); pointer-events: none; }",
    ".pk-mid { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 8px; }",
    ".pk-pot { display: flex; align-items: center; gap: 8px; padding: 5px 14px; border-radius: 99px; background: rgb(0 0 0 / .35); font-weight: 800; font-variant-numeric: tabular-nums; font-size: 14px; transition: transform .25s; }",
    ".pk-pot[data-bump='1'] { transform: scale(1.12); }",
    ".pk-board { display: flex; gap: 6px; min-height: 80px; --cw: 54px; --ch: 78px; }",
    ".pk-seat { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 6px; width: 130px; transform: translate(-50%, -50%); transition: opacity .3s, filter .3s; }",
    ".pk-seat[data-fold='1'] { opacity: .45; filter: saturate(.5); }",
    ".pk-seat[data-s='0'] { left: 50%; top: 79%; } .pk-seat[data-s='1'] { left: 12%; top: 50%; } .pk-seat[data-s='2'] { left: 50%; top: 21%; } .pk-seat[data-s='3'] { left: 88%; top: 50%; }",
    ".pk-hole { display: flex; --cw: 44px; --ch: 62px; height: 62px; } .pk-hole .hg-card + .hg-card { margin-left: -14px; transform: rotate(6deg); } .pk-hole .hg-card:first-child { transform: rotate(-6deg); }",
    ".pk-seat[data-s='0'] .pk-hole { --cw: 62px; --ch: 88px; height: 88px; }",
    ".pk-plate { display: flex; align-items: center; gap: 7px; padding: 4px 10px 4px 4px; border-radius: 99px; background: rgb(0 0 0 / .5); box-shadow: 0 0 0 1.5px rgb(255 255 255 / .18); transition: box-shadow .25s, background .25s; max-width: 100%; }",
    ".pk-seat[data-turn='1'] .pk-plate { box-shadow: 0 0 0 2px var(--hb-gold), 0 0 22px var(--hb-gold); animation: pk-pulse 1.1s ease-in-out infinite; }",
    ".pk-seat[data-win='1'] .pk-plate { background: color-mix(in srgb, var(--hb-gold) 40%, #000); box-shadow: 0 0 0 2px var(--hb-gold), 0 0 30px var(--hb-gold); }",
    "@keyframes pk-pulse { 50% { box-shadow: 0 0 0 2px var(--hb-gold), 0 0 6px var(--hb-gold); } }",
    ".pk-face { width: 34px; height: 34px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 20px; background: radial-gradient(circle at 35% 30%, #fff3, transparent 60%), var(--c, #556); box-shadow: inset 0 -3px 5px rgb(0 0 0 / .3); }",
    ".pk-who { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; } .pk-who b { font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .pk-who span { font-size: 11.5px; opacity: .85; font-variant-numeric: tabular-nums; }",
    ".pk-plate, .pk-tag { position: relative; z-index: 2; }",
    ".pk-tag { min-height: 16px; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; padding: 1px 8px; border-radius: 99px; background: rgb(0 0 0 / .4); }",
    ".pk-tag:empty { visibility: hidden; }",
    ".pk-bet { position: absolute; display: flex; align-items: center; gap: 4px; padding: 2px 9px 2px 3px; border-radius: 99px; background: rgb(0 0 0 / .45); font-size: 12px; font-weight: 800; font-variant-numeric: tabular-nums; transition: transform .45s cubic-bezier(.3,1.2,.4,1), opacity .35s; }",
    ".pk-bet i { width: 16px; height: 16px; border-radius: 50%; background: var(--hb-red); box-shadow: inset 0 0 0 2.5px rgb(255 255 255 / .8), 0 2px 0 rgb(0 0 0 / .4); }",
    ".pk-bet[hidden] { display: none; } .pk-bet[data-sweep='1'] { transform: translate(var(--tx), var(--ty)) scale(.5); opacity: 0; }",
    ".pk-seat[data-s='0'] .pk-bet { top: -34px; } .pk-seat[data-s='1'] .pk-bet { left: 118px; top: 44px; } .pk-seat[data-s='2'] .pk-bet { top: 118px; } .pk-seat[data-s='3'] .pk-bet { right: 118px; top: 44px; }",
    ".pk-dealer { position: absolute; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 900; color: #111; background: #fff; box-shadow: 0 2px 0 rgb(0 0 0 / .4); left: -9px; top: -9px; z-index: 3; }",
    ".pk-dealer[hidden] { display: none; }",
    ".pk-msg { margin-top: 12px; text-align: center; font-size: 13.5px; font-weight: 700; padding: 8px 14px; border-radius: 12px; background: var(--hb-fill); }",
    ".pk-float { position: absolute; left: 50%; top: -6px; font-weight: 900; font-size: 18px; color: var(--hb-gold); text-shadow: 0 2px 6px #000; animation: pk-up 1.6s ease-out forwards; pointer-events: none; }",
    "@keyframes pk-up { to { transform: translateY(-46px); opacity: 0; } }",
    ".pk-acts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } .pk-acts .hg-ghost, .pk-acts .hg-main { padding: 11px 8px; }",
    ".pk-fold { color: var(--hb-red); }",
    ".pk-quick { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }",
    ".pk-log { max-height: 130px; overflow: auto; font-size: 12px; color: var(--muted); display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: 12px; background: var(--hb-fill); }",
    ".pk-log div:last-child { color: var(--ink); font-weight: 700; }",
    ".pk-help { font-size: 12px; color: var(--muted); } .pk-help summary { cursor: pointer; font-weight: 700; }",
    ".pk-url { width: 100%; box-sizing: border-box; font: inherit; font-size: 12.5px; padding: 8px 10px; border: 0; border-radius: 10px; color: var(--ink); background: var(--hb-field); box-shadow: inset 0 0 0 1px var(--line); outline: none; }",
    "@media (max-width: 640px) { .pk-felt { min-height: 300px; } .pk-seat { width: 96px; } .pk-seat[data-s='1'] { left: 13%; } .pk-seat[data-s='3'] { left: 87%; } .pk-board { --cw: 40px; --ch: 58px; } .pk-hole { --cw: 34px; --ch: 48px; height: 48px; } .pk-seat[data-s='0'] .pk-hole { --cw: 48px; --ch: 68px; height: 68px; } }",
    "@media (prefers-reduced-motion: reduce) { .pk-seat, .pk-bet, .pk-pot { transition: none; animation: none; } .pk-seat[data-turn='1'] .pk-plate { animation: none; } }",
  ].join("\n");

  var STAKES = [["1/2", 1, 2, 100], ["5/10", 5, 10, 500], ["25/50", 25, 50, 2500]];
  var FACE_COL = ["var(--hb-acc)", "var(--hb-orange)", "var(--hb-blue)", "var(--hb-red)"];

  function poker(stage, side, api) {
    var alive = true, timers = [];
    var stakeIdx = 0, tbl = null, human = 0, buyIn = 0, startCoins = 0, mode = "local", ws = null, online = null;
    var st = h("style"); st.textContent = CSS; stage.appendChild(st);

    function later(fn, ms) { var t = setTimeout(function () { if (alive) fn(); }, ms); timers.push(t); return t; }

    /* ---------- table DOM ---------- */
    var felt = h("div", "pk-felt");
    var mid = h("div", "pk-mid");
    var potEl = h("div", "pk-pot"); var potTxt = h("span", null, "Pot 0");
    potEl.appendChild(potTxt);
    var boardEl = h("div", "pk-board");
    mid.appendChild(potEl); mid.appendChild(boardEl); felt.appendChild(mid);
    var msgEl = h("div", "pk-msg", "Kies een inzet en ga zitten.");
    var seatEls = [];
    for (var i = 0; i < 4; i++) {
      var seat = h("div", "pk-seat"); seat.setAttribute("data-s", String(i));
      var hole = h("div", "pk-hole");
      var plate = h("div", "pk-plate");
      var face = h("div", "pk-face", i === 0 ? "😎" : PERSONAS[i - 1].face); face.style.setProperty("--c", FACE_COL[i]);
      var who = h("div", "pk-who"); var nm = h("b", null, i === 0 ? "Jij" : PERSONAS[i - 1].name); var sk = h("span", null, "");
      who.appendChild(nm); who.appendChild(sk);
      plate.appendChild(face); plate.appendChild(who);
      var tag = h("div", "pk-tag");
      var bet = h("div", "pk-bet"); bet.hidden = true; bet.appendChild(h("i")); var betTxt = h("span"); bet.appendChild(betTxt);
      var dealer = h("div", "pk-dealer", "D"); dealer.hidden = true;
      seat.appendChild(hole); seat.appendChild(plate); seat.appendChild(tag); seat.appendChild(bet); plate.appendChild(dealer);
      felt.appendChild(seat);
      seatEls.push({ el: seat, hole: hole, face: face, name: nm, stack: sk, tag: tag, bet: bet, betTxt: betTxt, dealer: dealer, hand: -1 });
      seat.hidden = true;
    }
    stage.appendChild(felt);
    stage.appendChild(msgEl);
    var boardCount = 0, boardHand = -1;

    /* ---------- side panel ---------- */
    var setup = h("div", "hg-field");
    setup.appendChild(h("span", "hg-label", "Blinds"));
    var stakeRow = h("div", "hg-seg");
    var stakeBtns = STAKES.map(function (s, k) {
      var b = btn("hg-seg-btn", s[0]); b.setAttribute("data-on", k === 0 ? "1" : "0");
      b.addEventListener("click", function () { stakeIdx = k; stakeBtns.forEach(function (x, j) { x.setAttribute("data-on", j === k ? "1" : "0"); }); paintBuy(); });
      stakeRow.appendChild(b); return b;
    });
    setup.appendChild(stakeRow);
    var sit = btn("hg-main", "Ga zitten");
    var buyNote = h("div", "pk-help", "");
    setup.appendChild(buyNote); setup.appendChild(sit);
    side.appendChild(setup);

    var play = h("div", "hg-field"); play.hidden = true;
    var stats = h("div", "hg-stats");
    function statLine(label) { var row = h("div", "hg-stat"); row.appendChild(h("span", null, label)); var v = h("b", null, "–"); row.appendChild(v); stats.appendChild(row); return v; }
    var stackV = statLine("Jouw stack"), profitV = statLine("Winst/verlies"), handV = statLine("Hand");
    play.appendChild(stats);
    var acts = h("div", "pk-acts");
    var bFold = btn("hg-ghost pk-fold", "Pas (F)"), bCall = btn("hg-main", "Check (C)");
    acts.appendChild(bFold); acts.appendChild(bCall); play.appendChild(acts);
    var raiseBox = h("div", "hg-field");
    var rl = h("span", "hg-label", "Verhogen naar");
    var rrow = h("div", "hg-bet"); var rcoin = h("span", "hg-coin"); var rin = h("input", "hg-bet-input"); rin.type = "number"; rin.inputMode = "numeric";
    var bRaise = btn("hg-mini", "Verhoog");
    rrow.appendChild(rcoin); rrow.appendChild(rin); rrow.appendChild(bRaise);
    var rng = h("input", "hg-range"); rng.type = "range";
    var quick = h("div", "pk-quick");
    var qb = [["½ pot", 0.5], ["¾ pot", 0.75], ["Pot", 1], ["All-in", 99]].map(function (q) { var b = btn("hg-mini", q[0]); b.addEventListener("click", function () { setRaise(q[1]); }); quick.appendChild(b); return b; });
    raiseBox.appendChild(rl); raiseBox.appendChild(rrow); raiseBox.appendChild(rng); raiseBox.appendChild(quick);
    play.appendChild(raiseBox);
    var nextBtn = btn("hg-main", "Volgende hand"); nextBtn.hidden = true; play.appendChild(nextBtn);
    var leave = btn("hg-ghost", "Opstaan en uitbetalen"); play.appendChild(leave);
    var logEl = h("div", "pk-log"); play.appendChild(logEl);
    side.appendChild(play);

    var help = h("details", "pk-help");
    help.appendChild(h("summary", null, "Handen (hoog naar laag)"));
    help.appendChild(h("div", null, "Royal flush, straight flush, carré, full house, kleur, straat, drie gelijke, twee paar, paar, hoge kaart."));
    side.appendChild(help);

    var net = h("details", "pk-help");
    net.appendChild(h("summary", null, "Online (eigen server)"));
    var urlIn = h("input", "pk-url"); urlIn.placeholder = "wss://jouw-server.example/poker"; urlIn.spellcheck = false;
    var netBtn = btn("hg-ghost", "Verbind"); var netNote = h("div", "pk-help", "Geen server ingesteld. Dit is uit tot jij een URL opslaat.");
    net.appendChild(netNote); net.appendChild(urlIn); net.appendChild(netBtn);
    side.appendChild(net);

    /* ---------- helpers ---------- */
    function paintBuy() {
      var s = STAKES[stakeIdx];
      buyNote.textContent = "Inkoop " + fmt(s[3]) + " munten (je hebt " + fmt(api.coins()) + "). Blinds " + s[0] + ". Je krijgt je stack terug als je opstaat.";
      sit.disabled = api.coins() < s[3];
    }
    paintBuy();

    function say(t) { msgEl.textContent = t; }

    function setRaise(frac) {
      var L = tbl && tbl.cur === human ? tbl.legal() : null;
      if (!L) return;
      var to = frac >= 99 ? L.maxTo : Math.round(tbl.curBet + Math.max(tbl.bb, (L.pot + L.toCall) * frac));
      to = Math.max(L.minTo, Math.min(L.maxTo, to));
      rin.value = String(to); rng.value = String(to);
    }
    rng.addEventListener("input", function () { rin.value = rng.value; });
    rin.addEventListener("input", function () { rng.value = rin.value; });

    function sweepBets() {
      seatEls.forEach(function (s, idx) {
        if (s.bet.hidden) return;
        var b = s.bet;
        var cx = felt.clientWidth / 2 - (s.el.offsetLeft + b.offsetLeft), cy = felt.clientHeight * 0.5 - (s.el.offsetTop + b.offsetTop);
        b.style.setProperty("--tx", cx + "px"); b.style.setProperty("--ty", cy + "px");
        b.setAttribute("data-sweep", "1");
      });
      potEl.setAttribute("data-bump", "1");
      later(function () { potEl.removeAttribute("data-bump"); }, 300);
    }

    /* ---------- render from a view model ---------- */
    function render(v) {
      potTxt.textContent = "Pot " + fmt(v.pot);
      if (boardHand !== v.handNo) { boardEl.textContent = ""; boardCount = 0; boardHand = v.handNo; }
      while (boardCount < v.board.length) {
        var cn = cardNode(v.board[boardCount], true);
        boardEl.appendChild(cn);
        (function (node, k) { later(function () { node.removeAttribute("data-down"); }, 120 + k * 140); })(cn, boardCount % 3);
        boardCount++;
      }
      v.seats.forEach(function (sv, idx) {
        var s = seatEls[idx];
        s.el.hidden = !sv;
        if (!sv) return;
        s.el.setAttribute("data-fold", sv.folded ? "1" : "0");
        s.el.setAttribute("data-turn", sv.toAct ? "1" : "0");
        s.el.setAttribute("data-win", sv.win ? "1" : "0");
        s.name.textContent = sv.name;
        s.stack.textContent = fmt(sv.stack) + (sv.allIn ? " · all-in" : "");
        s.face.textContent = sv.face || "🙂";
        s.dealer.hidden = !sv.dealer;
        s.tag.textContent = sv.label || "";
        if (sv.bet > 0) { s.bet.hidden = false; s.bet.removeAttribute("data-sweep"); s.betTxt.textContent = fmt(sv.bet); } else if (!s.bet.hidden && !s.bet.hasAttribute("data-sweep")) { s.bet.hidden = true; }
        if (s.hand !== v.handNo) {
          s.hole.textContent = "";
          s.hand = v.handNo;
          s.bet.hidden = sv.bet <= 0;
          sv.cards.forEach(function (c, k) { var n = cardNode(c, !sv.faceUp); n.style.animationDelay = (k * 0.12 + idx * 0.08) + "s"; s.hole.appendChild(n); });
        } else {
          Array.prototype.forEach.call(s.hole.children, function (n) { if (sv.faceUp) n.removeAttribute("data-down"); else n.setAttribute("data-down", "1"); });
        }
      });
    }

    /* ---------- local game ---------- */
    function viewOf(t) {
      var showdown = t.stage === "done" && t.results.length && t.count(function (p) { return t.inHand(p); }) > 1;
      var winners = {};
      t.results.forEach(function (r) { r.winners.forEach(function (w) { winners[w] = 1; }); });
      return {
        handNo: t.handNo, pot: t.pot() + 0, board: t.board, stage: t.stage,
        seats: t.p.map(function (p, i) {
          var persona = i === human ? null : PERSONAS[i - 1];
          return {
            name: i === human ? "Jij" : p.name, face: i === human ? "😎" : persona.face, stack: p.stack, bet: p.bet, folded: p.folded && !p.out, allIn: p.allIn,
            dealer: t.button === i, toAct: t.cur === i, win: !!winners[i] && t.stage === "done",
            cards: p.hole.length ? p.hole : [null, null], faceUp: i === human ? p.hole.length > 0 : !!showdown && !p.folded,
            label: p.out ? "Weg" : (t.stage === "done" && p.won ? "+" + fmt(p.won) + (p.label ? " · " + p.label : "") : (p.folded ? "Past" : (showdown && p.label ? p.label : ""))),
          };
        }),
      };
    }

    function floatWin(idx, n) {
      var f = h("div", "pk-float", "+" + fmt(n));
      seatEls[idx].el.appendChild(f);
      later(function () { f.remove(); }, 1700);
    }

    function paintPanel() {
      var me = tbl.p[human], L = tbl.cur === human && tbl.stage !== "done" ? tbl.legal() : null;
      stackV.textContent = fmt(me.stack);
      var prof = me.stack + (me.folded ? 0 : 0) - buyIn;
      profitV.textContent = (prof >= 0 ? "+" : "") + fmt(prof);
      handV.textContent = "#" + tbl.handNo;
      bFold.disabled = !L;
      bCall.disabled = !L;
      bCall.textContent = L ? (L.canCheck ? "Check (C)" : "Call " + fmt(L.call) + " (C)") : "Wacht…";
      var can = !!(L && L.canRaise);
      bRaise.disabled = rin.disabled = rng.disabled = !can;
      qb.forEach(function (b) { b.disabled = !can; });
      if (can) {
        rng.min = String(L.minTo); rng.max = String(L.maxTo); rng.step = "1";
        if (!rin.value || Number(rin.value) < L.minTo || Number(rin.value) > L.maxTo) { rin.value = String(L.minTo); rng.value = String(L.minTo); }
        bRaise.textContent = Number(rin.value) >= L.maxTo ? "All-in" : "Verhoog";
      }
      nextBtn.hidden = tbl.stage !== "done";
      nextBtn.textContent = me.stack <= 0 ? "Opnieuw inkopen" : "Volgende hand";
      logEl.textContent = "";
      tbl.log.slice(-7).forEach(function (t) { logEl.appendChild(h("div", null, t)); });
      logEl.scrollTop = logEl.scrollHeight;
    }

    function tick() {
      if (!alive || !tbl || mode !== "local") return;
      render(viewOf(tbl));
      paintPanel();
      if (tbl.stage === "done") { finishUi(); return; }
      if (tbl.streetDone && tbl.cur === -1) {
        sweepBets();
        later(function () { tbl.proceed(); tick(); }, tbl.count(function (p) { return tbl.canAct(p); }) < 2 ? 1100 : 650);
        say(tbl.count(function (p) { return tbl.inHand(p); }) > 1 ? "…" : "");
        return;
      }
      if (tbl.cur === human) { say("Jij bent aan de beurt."); return; }
      var i = tbl.cur, persona = PERSONAS[i - 1];
      say(persona.name + " denkt na…");
      later(function () {
        if (tbl.cur !== i || tbl.stage === "done") return;
        var d = decide(tbl, i, persona);
        tbl.act(d.a, d.to);
        tick();
      }, 700 + rnd(700));
    }

    function finishUi() {
      var t = tbl, myWin = t.p[human].won;
      seatEls.forEach(function (s) { if (!s.bet.hidden) s.bet.hidden = true; });
      t.p.forEach(function (p, i) { if (p.won > 0) floatWin(i, p.won); });
      var main = t.results[0];
      say(main ? (main.winners.map(function (w) { return w === human ? "Jij" : t.p[w].name; }).join(" & ") + " wint " + fmt(t.results.reduce(function (a, r) { return a + r.amount; }, 0)) + (main.hand ? " met " + main.hand.toLowerCase() : "")) : "");
      paintPanel();
      if (myWin > 0) {
        var prof = t.p[human].stack - buyIn;
        if (prof > 0) api.record(prof);
      }
    }

    function newHand() {
      if (!tbl) return;
      // bots that went broke are bought back in by the house, so the table keeps going
      tbl.p.forEach(function (p, i) { if (i !== human && p.stack <= 0) p.stack = STAKES[stakeIdx][3]; });
      if (tbl.p[human].stack <= 0) { rebuy(); return; }
      seatEls.forEach(function (s) { s.bet.hidden = true; s.bet.removeAttribute("data-sweep"); });
      if (tbl.start()) tick();
    }

    function rebuy() {
      var s = STAKES[stakeIdx];
      if (!api.take(s[3])) { say("Te weinig munten om opnieuw in te kopen."); cashOut(true); return; }
      tbl.p[human].stack = s[3]; buyIn += s[3];
      tbl.p[human].out = false;
      seatEls.forEach(function (x) { x.bet.hidden = true; x.bet.removeAttribute("data-sweep"); });
      if (tbl.start()) tick();
    }

    sit.addEventListener("click", function () {
      var s = STAKES[stakeIdx];
      if (!api.take(s[3])) return;
      buyIn = s[3]; startCoins = api.coins();
      var seats = [{ name: "Jij", stack: s[3], human: true }].concat(PERSONAS.map(function (pp) { return { name: pp.name, stack: s[3] }; }));
      tbl = new Table({ sb: s[1], bb: s[2], seats: seats });
      human = 0; mode = "local";
      setup.hidden = true; play.hidden = false; help.hidden = false;
      newHand();
    });
    nextBtn.addEventListener("click", newHand);

    function humanAct(a, to) {
      if (!tbl || tbl.cur !== human || tbl.stage === "done" || mode !== "local") return;
      tbl.act(a, to);
      tick();
    }
    bFold.addEventListener("click", function () { humanAct("fold"); });
    bCall.addEventListener("click", function () { humanAct("call"); });
    bRaise.addEventListener("click", function () { humanAct("raise", Number(rin.value) || 0); });

    function onKey(e) {
      if (!felt.isConnected || e.target.tagName === "INPUT") return;
      var k = e.key.toLowerCase();
      if (k === "f") humanAct("fold"); else if (k === "c") humanAct("call");
      else if ((k === "enter" || k === " ") && tbl && tbl.stage === "done" && mode === "local") { e.preventDefault(); e.stopPropagation(); newHand(); }
    }
    document.addEventListener("keydown", onKey, true);

    var paidOut = false;
    function cashOut(silent) {
      if (!tbl || paidOut) return;
      paidOut = true;
      var left = tbl.p[human].stack;
      if (left > 0) api.give(left);
      if (!silent) {
        timers.forEach(clearTimeout);
        say("Uitbetaald: " + fmt(left) + " munten (" + (left - buyIn >= 0 ? "+" : "") + fmt(left - buyIn) + ").");
      }
      tbl.stage = "done"; tbl = null;
      play.hidden = true; setup.hidden = false; paidOut = false;
      seatEls.forEach(function (s) { s.el.hidden = true; });
      boardEl.textContent = ""; boardCount = 0; boardHand = -1; potTxt.textContent = "Pot 0";
      paintBuy();
    }
    leave.addEventListener("click", function () { cashOut(false); });

    /* ---------- online (prepared; needs the owner's server) ---------- */
    try {
      chrome.storage.local.get("sscPokerServer", function (r) {
        if (r && typeof r.sscPokerServer === "string") { urlIn.value = r.sscPokerServer; netNote.textContent = "Opgeslagen: " + r.sscPokerServer; }
      });
    } catch (e) { /* no storage */ }
    netBtn.addEventListener("click", function () {
      var url = urlIn.value.trim();
      if (!/^wss?:\/\/[^\s]+$/i.test(url)) { netNote.textContent = "Geef een geldige ws:// of wss:// URL op."; return; }
      try { chrome.storage.local.set({ sscPokerServer: url }); } catch (e) { /* ignore */ }
      if (ws) { try { ws.close(); } catch (e) { /* ignore */ } }
      netNote.textContent = "Verbinden met " + url + "…";
      try { ws = new WebSocket(url); } catch (e) { netNote.textContent = "Kon niet verbinden: " + e.message; return; }
      ws.onopen = function () {
        netNote.textContent = "Verbonden.";
        var s = STAKES[stakeIdx];
        if (!api.take(s[3])) { netNote.textContent = "Te weinig munten voor inkoop."; ws.close(); return; }
        buyIn = s[3]; mode = "online"; refunded = false;
        setup.hidden = true; play.hidden = false; nextBtn.hidden = true;
        ws.send(JSON.stringify({ t: "join", name: "Speler", buyIn: s[3], stake: s[0] }));
      };
      ws.onmessage = function (ev) {
        var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m && m.t === "state" && m.view && Array.isArray(m.view.seats)) { online = m.view; render(online); say(String(m.view.msg || "").slice(0, 120)); }
        else if (m && m.t === "error") netNote.textContent = String(m.msg || "Serverfout").slice(0, 120);
      };
      ws.onerror = function () { netNote.textContent = "Verbinding mislukt. Staat je server aan?"; };
      ws.onclose = function () { if (mode === "online") { refundOnline(); mode = "local"; setup.hidden = false; play.hidden = true; netNote.textContent = "Verbinding gesloten."; } };
    });

    // Settlement with a server is not decided yet, so a closed connection simply returns the buy-in.
    var refunded = false;
    function refundOnline() { if (!refunded && buyIn > 0) { refunded = true; api.give(buyIn); } }
    api.onDispose(function () {
      alive = false;
      if (mode === "online") refundOnline();
      timers.forEach(clearTimeout);
      document.removeEventListener("keydown", onKey, true);
      if (ws) { try { ws.send(JSON.stringify({ t: "leave" })); ws.close(); } catch (e) { /* ignore */ } }
      if (tbl && !paidOut) { var left = tbl.p[human].stack; if (left > 0) api.give(left); }
    });
  }

  window.sscHubGames.poker = poker;
})();
