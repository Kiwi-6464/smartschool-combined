/**
 * Smartschool Combined — the Arcade's own games: Mines, Plinko, Roulette.
 *
 * They play with "munten", a play balance that lives in this browser only
 * (hub.js keeps it in chrome.storage.local under sscArcade). There is no real
 * money anywhere: when the balance runs out the player can top it up again
 * for free. Each game keeps its record (biggest single win).
 *
 *   window.sscHubGames[id](stage, side, api)
 *
 * stage is where the board goes, side holds the controls. api:
 *   coins()            current balance
 *   take(n)            spend n, false when the balance is too low
 *   give(n)            add a payout
 *   record(n)          report a win; the hub keeps the best one
 *   onDispose(fn)      cleanup when the player leaves the game
 *
 * Every loop is requestAnimationFrame and stops as soon as its node is gone;
 * the browser already holds rAF while the tab is hidden.
 *
 * Loaded lazily with hub.js (lazy.js module "hub").
 */
(function () {
  "use strict";

  if (window.sscSkipPage) return;
  if (window.sscHubGames) return;

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

  function fmt(n) {
    return Math.round(n).toLocaleString("nl-BE");
  }

  /** Uniform integer in [0, n), from the crypto source when there is one. */
  function rand(n) {
    try {
      var a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return a[0] % n;
    } catch (e) {
      return Math.floor(Math.random() * n);
    }
  }

  /* ---------- shared controls ---------- */

  /** Bet field with ½ and 2×; clamps to [1, balance]. */
  function betControl(api, start) {
    var wrap = h("div", "hg-field");
    wrap.appendChild(h("span", "hg-label", "Inzet"));
    var row = h("div", "hg-bet");
    var coin = h("span", "hg-coin");
    var input = h("input", "hg-bet-input");
    input.type = "number";
    input.min = "1";
    input.step = "1";
    input.inputMode = "numeric";
    input.value = String(start || 10);
    var half = btn("hg-mini", "½");
    var dbl = btn("hg-mini", "2×");
    row.appendChild(coin);
    row.appendChild(input);
    row.appendChild(half);
    row.appendChild(dbl);
    wrap.appendChild(row);

    function value() {
      var v = Math.floor(Number(input.value) || 0);
      return Math.max(1, Math.min(v, Math.max(1, api.coins())));
    }
    function set(v) {
      input.value = String(Math.max(1, Math.floor(v)));
    }
    input.addEventListener("change", function () {
      set(value());
    });
    half.addEventListener("click", function () {
      set(value() / 2);
    });
    dbl.addEventListener("click", function () {
      set(Math.min(value() * 2, Math.max(1, api.coins())));
    });
    return {
      node: wrap,
      value: value,
      disable: function (off) {
        input.disabled = half.disabled = dbl.disabled = !!off;
      },
    };
  }

  function segmented(label, options, initial, onPick) {
    var wrap = h("div", "hg-field");
    wrap.appendChild(h("span", "hg-label", label));
    var row = h("div", "hg-seg");
    var buttons = options.map(function (o) {
      var b = btn("hg-seg-btn", o[1]);
      b.setAttribute("data-on", o[0] === initial ? "1" : "0");
      b.addEventListener("click", function () {
        if (b.disabled) return;
        buttons.forEach(function (x) {
          x.setAttribute("data-on", x === b ? "1" : "0");
        });
        onPick(o[0]);
      });
      row.appendChild(b);
      return b;
    });
    wrap.appendChild(row);
    return {
      node: wrap,
      disable: function (off) {
        buttons.forEach(function (b) {
          b.disabled = !!off;
        });
      },
    };
  }

  function statLine(label) {
    var row = h("div", "hg-stat");
    row.appendChild(h("span", null, label));
    var v = h("b", null, "–");
    row.appendChild(v);
    return { node: row, set: function (t) { v.textContent = t; } };
  }

  /** Floating "+120" over a node. */
  function floatText(parent, text, good, x, y) {
    var f = h("span", "hg-float", text);
    f.setAttribute("data-good", good ? "1" : "0");
    if (x !== undefined) {
      f.style.left = x + "px";
      f.style.top = y + "px";
    }
    parent.appendChild(f);
    setTimeout(function () {
      f.remove();
    }, 1300);
  }

  /**
   * The colours the canvas games draw with, resolved from the theme tokens at
   * this moment (a canvas cannot use var()). A hidden probe inside `host`
   * lets the browser evaluate each CSS expression in the hub's own scope.
   */
  function palette(host) {
    var want = {
      ink: "var(--hb-ink)",
      bg: "var(--hb-bg)",
      acc: "var(--hb-acc)",
      accDark: "color-mix(in srgb, var(--hb-acc) 55%, black)",
      light: "color-mix(in srgb, var(--hb-acc) 28%, white)",
      gold: "var(--hb-gold)",
      goldLight: "color-mix(in srgb, var(--hb-gold) 40%, white)",
      goldDark: "color-mix(in srgb, var(--hb-gold) 55%, black)",
      red: "var(--hb-red)",
      green: "var(--hb-green)",
      black: "var(--hb-black)",
      line: "color-mix(in srgb, var(--hb-ink) 24%, transparent)",
      wood: "color-mix(in srgb, var(--hb-orange) 42%, black)",
      woodLight: "color-mix(in srgb, var(--hb-orange) 60%, black)",
      woodDark: "color-mix(in srgb, var(--hb-orange) 24%, black)",
      white: "white",
    };
    var probe = h("i");
    probe.style.cssText = "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none";
    host.appendChild(probe);
    var out = {};
    Object.keys(want).forEach(function (k) {
      probe.style.color = "";
      probe.style.color = want[k];
      out[k] = getComputedStyle(probe).color;
    });
    probe.remove();
    return out;
  }

  /* ================================================================ */
  /* Mines                                                             */
  /* ================================================================ */

  var GEM_SVG =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><defs>' +
    '<linearGradient id="hgGemA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--hg-gem-ll)"/><stop offset=".5" stop-color="var(--hg-gem)"/><stop offset="1" stop-color="var(--hg-gem-d)"/></linearGradient>' +
    '<linearGradient id="hgGemB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--hg-gem-ll)"/><stop offset="1" stop-color="var(--hg-gem-l)"/></linearGradient></defs>' +
    '<path d="M16 12h32l12 14-28 30L4 26z" fill="url(#hgGemA)"/>' +
    '<path d="M16 12h32l-6 14H22z" fill="url(#hgGemB)" opacity=".9"/>' +
    '<path d="M4 26h18l10 30zM60 26H42L32 56z" fill="var(--hg-gem-d)" opacity=".55"/>' +
    '<path d="M22 26h20L32 56z" fill="var(--hg-gem)"/>' +
    '<path d="M18 14l4 10" stroke="white" stroke-width="2.4" stroke-linecap="round" opacity=".85"/></svg>';

  var BOMB_SVG =
    '<svg viewBox="0 0 64 64" aria-hidden="true"><defs>' +
    '<radialGradient id="hgBomb" cx=".35" cy=".35" r=".75"><stop offset="0" stop-color="#9aa3b8"/><stop offset=".55" stop-color="#1c202c"/><stop offset="1" stop-color="#0d0f16"/></radialGradient></defs>' +
    '<circle cx="30" cy="38" r="20" fill="url(#hgBomb)" stroke="white" stroke-opacity=".55" stroke-width="1.5"/>' +
    '<rect x="36" y="14" width="10" height="9" rx="2" transform="rotate(35 41 18)" fill="darkslategray"/>' +
    '<path d="M45 13c3-5 8-5 10-2" stroke="tan" stroke-width="2.5" fill="none" stroke-linecap="round"/>' +
    '<circle cx="56" cy="10" r="4.5" fill="var(--hb-gold)"/><circle cx="56" cy="10" r="2.2" fill="lightyellow"/>' +
    '<ellipse cx="23" cy="30" rx="6" ry="4" fill="white" opacity=".28" transform="rotate(-35 23 30)"/></svg>';

  function mineMultiplier(mines, picks) {
    var m = 1;
    for (var i = 0; i < picks; i++) m *= (25 - i) / (25 - mines - i);
    return picks ? 0.97 * m : 1;
  }

  function mines(stage, side, api) {
    var round = null; // { bet, mines, field: bool[25], picks, over }
    var mineCount = 3;

    var board = h("div", "hg-mn-board");
    var tiles = [];
    for (var i = 0; i < 25; i++) {
      (function (idx) {
        var t = btn("hg-mn-tile");
        t.setAttribute("aria-label", "Vak " + (idx + 1));
        t.style.setProperty("--d", ((idx % 5) + Math.floor(idx / 5)) * 22 + "ms");
        var inner = h("span", "hg-mn-inner");
        inner.appendChild(h("span", "hg-mn-front"));
        var back = h("span", "hg-mn-back");
        inner.appendChild(back);
        t.appendChild(inner);
        t.addEventListener("click", function () {
          pick(idx);
        });
        tiles.push({ node: t, back: back });
        board.appendChild(t);
      })(i);
    }
    stage.appendChild(board);

    var bet = betControl(api, 10);
    side.appendChild(bet.node);

    var minesField = h("div", "hg-field");
    var minesLabel = h("span", "hg-label", "Mijnen: 3");
    var slider = h("input", "hg-range");
    slider.type = "range";
    slider.min = "1";
    slider.max = "24";
    slider.value = "3";
    slider.addEventListener("input", function () {
      mineCount = Number(slider.value);
      minesLabel.textContent = "Mijnen: " + mineCount;
      paintStats();
    });
    minesField.appendChild(minesLabel);
    minesField.appendChild(slider);
    side.appendChild(minesField);

    var stats = h("div", "hg-stats");
    var sMult = statLine("Vermenigvuldiger");
    var sNext = statLine("Volgende diamant");
    var sWin = statLine("Uitbetaling");
    stats.appendChild(sMult.node);
    stats.appendChild(sNext.node);
    stats.appendChild(sWin.node);
    side.appendChild(stats);

    var main = btn("hg-main", "Start");
    side.appendChild(main);
    var note = h("div", "hg-note", "Zoek diamanten en ontwijk de mijnen. Stop op tijd om je winst te innen.");
    side.appendChild(note);

    function paintStats() {
      var m = round ? round.mines : mineCount;
      var picks = round ? round.picks : 0;
      var cur = mineMultiplier(m, picks);
      sMult.set(cur.toFixed(2) + "×");
      sNext.set(picks < 25 - m ? mineMultiplier(m, picks + 1).toFixed(2) + "×" : "–");
      sWin.set(round && !round.over ? fmt(round.bet * cur) : "–");
      if (round && !round.over) {
        main.textContent = round.picks ? "Innen · " + fmt(round.bet * cur) : "Kies een vak";
        main.disabled = !round.picks;
        main.setAttribute("data-cash", round.picks ? "1" : "0");
      } else {
        main.textContent = "Start";
        main.disabled = false;
        main.removeAttribute("data-cash");
      }
    }

    function reset() {
      tiles.forEach(function (t) {
        t.node.removeAttribute("data-state");
        t.node.removeAttribute("data-dim");
        t.node.removeAttribute("data-boom");
        t.node.disabled = false;
        t.back.innerHTML = "";
      });
    }

    function start() {
      var b = bet.value();
      if (!api.take(b)) {
        note.textContent = "Niet genoeg munten.";
        return;
      }
      reset();
      var field = [];
      for (var j = 0; j < 25; j++) field.push(false);
      var placed = 0;
      while (placed < mineCount) {
        var k = rand(25);
        if (!field[k]) {
          field[k] = true;
          placed++;
        }
      }
      round = { bet: b, mines: mineCount, field: field, picks: 0, over: false };
      board.setAttribute("data-live", "1");
      bet.disable(true);
      slider.disabled = true;
      note.textContent = "Klik op een vak.";
      paintStats();
    }

    function reveal(idx, dim) {
      var t = tiles[idx];
      if (t.node.getAttribute("data-state")) return;
      var bomb = round.field[idx];
      t.back.innerHTML = bomb ? BOMB_SVG : GEM_SVG;
      t.node.setAttribute("data-state", bomb ? "bomb" : "gem");
      if (dim) t.node.setAttribute("data-dim", "1");
      t.node.disabled = true;
    }

    function finish() {
      round.over = true;
      board.removeAttribute("data-live");
      for (var j = 0; j < 25; j++) reveal(j, true);
      bet.disable(false);
      slider.disabled = false;
      paintStats();
    }

    function pick(idx) {
      if (!round || round.over) return;
      if (tiles[idx].node.getAttribute("data-state")) return;
      reveal(idx, false);
      if (round.field[idx]) {
        tiles[idx].node.setAttribute("data-boom", "1");
        board.setAttribute("data-shake", "1");
        setTimeout(function () {
          board.removeAttribute("data-shake");
        }, 450);
        note.textContent = "Boem! Je inzet van " + fmt(round.bet) + " is weg.";
        floatText(stage, "-" + fmt(round.bet), false);
        finish();
        return;
      }
      round.picks++;
      if (round.picks >= 25 - round.mines) {
        cashOut();
        return;
      }
      paintStats();
    }

    function cashOut() {
      if (!round || round.over || !round.picks) return;
      var win = Math.floor(round.bet * mineMultiplier(round.mines, round.picks));
      api.give(win);
      api.record(win - round.bet);
      note.textContent = "Geïnd: " + fmt(win) + " munten (" + mineMultiplier(round.mines, round.picks).toFixed(2) + "×).";
      floatText(stage, "+" + fmt(win), true);
      finish();
    }

    main.addEventListener("click", function () {
      if (round && !round.over) cashOut();
      else start();
    });
    // Leaving mid-round: cash out what was found, or hand an untouched bet back.
    api.onDispose(function () {
      if (!round || round.over) return;
      api.give(round.picks ? Math.floor(round.bet * mineMultiplier(round.mines, round.picks)) : round.bet);
      round.over = true;
    });
    paintStats();
  }

  /* ================================================================ */
  /* Plinko                                                            */
  /* ================================================================ */

  /*
   * Fair and physical at the same time. The slot a ball ends in is decided
   * first, by twelve fair left/right flips (one per peg row), so the odds are
   * exactly binomial and the payout table below can be calculated. The ball
   * then really falls: gravity, bouncing off every peg with restitution and a
   * little friction. Only in free fall between two rows a soft spring nudges
   * it towards the peg side that was chosen, and a peg it has to pass never
   * lets it balance on top. The test in the harness drops 20 000 balls through
   * this exact code: every one ends in its slot.
   *
   * Payouts (x bet) per slot, edge to edge, tuned to a return of about 96 %,
   * the same house edge as Mines and Roulette (97 %).
   */
  var PLINKO_ROWS = 12;
  var PLINKO_PAY = {
    laag: [5, 3.7, 2.6, 1.7, 1.1, 0.7, 0.6, 0.7, 1.1, 1.7, 2.6, 3.7, 5],
    midden: [12, 7.7, 4.5, 2.4, 1.05, 0.45, 0.35, 0.45, 1.05, 2.4, 4.5, 7.7, 12],
    hoog: [30, 16, 7.2, 2.7, 0.8, 0.25, 0.2, 0.25, 0.8, 2.7, 7.2, 16, 30],
  };

  var PL = {
    W: 600,
    TOP: 46,
    R_BALL: 7.5,
    R_PEG: 4,
    G: 1050, // px/s², slow and suspenseful on a 600 px board
    VMAX: 480, // terminal velocity, px/s
    E: 0.52, // restitution on a peg
    MU: 0.9, // share of the sliding speed that survives a peg
    K: 1400, // steering spring, only in free fall
    C: 30, // and its damping
    OFF: 5, // aim this far to the chosen side of the next peg
    SIDE: 6, // a chosen peg is always left on that side, this far from its centre
  };
  PL.S = PL.W / (PLINKO_ROWS + 3); // peg spacing
  PL.ROW_H = PL.S * 0.9;
  PL.BUCKET_Y = PL.TOP + (PLINKO_ROWS - 1) * PL.ROW_H + PL.ROW_H * 0.75;
  PL.H = PL.BUCKET_Y + 44;
  PL.BUCKETS = PLINKO_ROWS + 1;
  PL.BUCKET_LEFT = PL.W / 2 - (PL.BUCKETS / 2) * PL.S;

  /** Row r has r + 3 pegs, shifted half a gap per row: a triangle. */
  function plinkoPegs() {
    var pegs = [];
    for (var r = 0; r < PLINKO_ROWS; r++) {
      var n = r + 3;
      for (var i = 0; i < n; i++) pegs.push({ x: PL.W / 2 + (i - (n - 1) / 2) * PL.S, y: PL.TOP + r * PL.ROW_H, hit: -1 });
    }
    return pegs;
  }

  /** Twelve flips -> the gaps the ball must pass and the slot it ends in. */
  function plinkoPlan() {
    var path = [];
    var gx = [];
    var j = 0;
    for (var r = 0; r < PLINKO_ROWS; r++) {
      var right = rand(2) === 1;
      path.push(right ? 1 : -1);
      if (right) j++;
      gx.push(PL.W / 2 + (j + 0.5 - (r + 2) / 2) * PL.S);
    }
    return { path: path, gx: gx, bucket: j };
  }

  function plinkoHalfWidth(y) {
    var r = (y - PL.TOP) / PL.ROW_H;
    return ((Math.max(0, r) + 2) / 2) * PL.S + PL.S * 0.55;
  }

  /** One fixed physics step. Returns the index of the peg that was hit, or -1. */
  function plinkoStep(ball, dt, pegs) {
    var rf = (ball.y - PL.TOP) / PL.ROW_H;
    var next = Math.min(PLINKO_ROWS - 1, Math.max(0, Math.ceil(rf)));
    var contact = PL.R_BALL + PL.R_PEG;
    var pegX = next === 0 ? PL.W / 2 : ball.plan.gx[next - 1];
    var pegY = PL.TOP + next * PL.ROW_H;
    if (ball.y < pegY - contact && (next === 0 || ball.y > pegY - PL.ROW_H + contact)) {
      ball.vx += (PL.K * (pegX + ball.plan.path[next] * PL.OFF - ball.x) - PL.C * ball.vx) * dt;
    } else if (rf > PLINKO_ROWS - 1 && ball.y > pegY + contact) {
      ball.vx += (PL.K * (ball.plan.gx[PLINKO_ROWS - 1] - ball.x) - PL.C * ball.vx) * dt;
    }
    ball.vy = Math.min(PL.VMAX, ball.vy + PL.G * dt);
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    var hit = -1;
    var row = Math.round(rf);
    for (var rr = Math.max(0, row - 1); rr <= Math.min(PLINKO_ROWS - 1, row + 1); rr++) {
      var start = ((rr * (rr + 5)) / 2) | 0; // first peg of the row: sum of (3 .. rr + 2)
      var count = rr + 3;
      var want = rr === 0 ? PL.W / 2 : ball.plan.gx[rr - 1];
      for (var p = start; p < start + count; p++) {
        var peg = pegs[p];
        var dx = ball.x - peg.x;
        var dy = ball.y - peg.y;
        if (rr === next && Math.abs(peg.x - want) < 1 && dx * ball.plan.path[rr] < PL.SIDE) dx = ball.plan.path[rr] * PL.SIDE;
        var d2 = dx * dx + dy * dy;
        if (d2 < contact * contact && d2 > 0.0001) {
          var d = Math.sqrt(d2);
          var nx = dx / d;
          var ny = dy / d;
          ball.x = peg.x + nx * contact;
          ball.y = peg.y + ny * contact;
          var vn = ball.vx * nx + ball.vy * ny;
          if (vn < 0) {
            var vt = (ball.vx * -ny + ball.vy * nx) * PL.MU;
            vn = -PL.E * vn;
            ball.vx = vn * nx + vt * -ny;
            ball.vy = vn * ny + vt * nx;
            hit = p;
          }
        }
      }
    }
    var hw = plinkoHalfWidth(ball.y);
    if (ball.x < PL.W / 2 - hw) {
      ball.x = PL.W / 2 - hw;
      ball.vx = Math.abs(ball.vx) * 0.5;
    } else if (ball.x > PL.W / 2 + hw) {
      ball.x = PL.W / 2 + hw;
      ball.vx = -Math.abs(ball.vx) * 0.5;
    }
    return hit;
  }

  function plinkoNewBall(risk, bet) {
    // A slight random sideways push; the steering spring still brings it to its planned slot.
    return { x: PL.W / 2 + (rand(5) - 2) * 0.8, y: 10, vx: (rand(41) - 20) * 1.5, vy: 0, bet: bet, risk: risk, plan: plinkoPlan(), trail: [], settle: 0 };
  }

  /** Headless run of the exact game physics: which slot did the ball reach, and after how long. */
  function plinkoRun(pegs) {
    var ball = plinkoNewBall("midden", 1);
    var steps = 0;
    while (ball.y < PL.BUCKET_Y && steps < 6000) {
      plinkoStep(ball, 1 / 240, pegs);
      steps++;
    }
    var natural = Math.max(0, Math.min(PL.BUCKETS - 1, Math.floor((ball.x - PL.BUCKET_LEFT) / PL.S)));
    return { planned: ball.plan.bucket, natural: natural, seconds: steps / 240 };
  }

  /** Exact return of a risk level: sum of binomial odds x payout. */
  function plinkoReturn(risk) {
    var c = 1;
    var total = 0;
    PLINKO_PAY[risk].forEach(function (m, k) {
      total += (c / Math.pow(2, PLINKO_ROWS)) * m;
      c = (c * (PLINKO_ROWS - k)) / (k + 1);
    });
    return total;
  }

  /** The numbers the harness checks: odds, payout tables and a physics run. */
  function plinkoTest(balls) {
    var pegs = plinkoPegs();
    var out = { returns: {}, balls: balls, planned: 0, exact: 0, maxSeconds: 0, avgSeconds: 0 };
    Object.keys(PLINKO_PAY).forEach(function (k) {
      out.returns[k] = plinkoReturn(k);
    });
    var sum = 0;
    for (var i = 0; i < balls; i++) {
      var r = plinkoRun(pegs);
      out.planned++;
      if (r.planned === r.natural) out.exact++;
      sum += r.seconds;
      if (r.seconds > out.maxSeconds) out.maxSeconds = r.seconds;
    }
    out.avgSeconds = balls ? sum / balls : 0;
    return out;
  }

  function plinko(stage, side, api) {
    var W = PL.W;
    var S = PL.S;
    var H = PL.H;
    var risk = "midden";
    var pegs = plinkoPegs();
    var buckets = PL.BUCKETS;
    var colors = palette(stage);

    var wrap = h("div", "hg-pl-wrap");
    var canvas = h("canvas", "hg-pl-canvas");
    wrap.appendChild(canvas);
    var labels = h("div", "hg-pl-labels");
    wrap.appendChild(labels);
    stage.appendChild(wrap);
    var ctx = canvas.getContext("2d");

    function paintLabels() {
      labels.textContent = "";
      PLINKO_PAY[risk].forEach(function (m, idx) {
        var l = h("span", "hg-pl-bucket", m + "×");
        l.style.setProperty("--t", (Math.abs(idx - (buckets - 1) / 2) / ((buckets - 1) / 2)).toFixed(3));
        l.style.left = ((PL.BUCKET_LEFT + idx * S) / W) * 100 + "%";
        l.style.width = (S / W) * 100 + "%";
        labels.appendChild(l);
      });
    }

    var balls = [];
    var history = h("div", "hg-history");

    var bet = betControl(api, 10);
    side.appendChild(bet.node);
    var riskCtl = segmented("Risico", [["laag", "Laag"], ["midden", "Midden"], ["hoog", "Hoog"]], risk, function (v) {
      risk = v;
      paintLabels();
      paintOdds();
    });
    side.appendChild(riskCtl.node);
    var drop = btn("hg-main", "Laat vallen");
    side.appendChild(drop);
    var odds = statLine("Terugbetaling");
    var stats = h("div", "hg-stats");
    stats.appendChild(odds.node);
    side.appendChild(stats);
    function paintOdds() {
      odds.set((plinkoReturn(risk) * 100).toFixed(1) + "%");
    }
    paintOdds();
    side.appendChild(h("span", "hg-label", "Laatste"));
    side.appendChild(history);
    var note = h("div", "hg-note", "Elke bal kost je inzet. Waar hij landt, bepaalt de vermenigvuldiger.");
    side.appendChild(note);

    var scale = 1;
    function resize() {
      var cssW = wrap.clientWidth || W;
      var dpr = Math.min(window.devicePixelRatio || 1, 3);
      scale = cssW / W;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(H * scale * dpr);
      canvas.style.height = H * scale + "px";
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      labels.style.top = (PL.BUCKET_Y - 4) * scale + "px";
      draw(performance.now());
    }
    var ro = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(wrap);
    api.onDispose(function () {
      if (ro) ro.disconnect();
      stop();
      balls.forEach(function (ball) {
        var win = Math.round(ball.bet * PLINKO_PAY[ball.risk][ball.plan.bucket]);
        if (win > 0) api.give(win);
      });
      balls = [];
    });

    function land(ball, now) {
      var idx = ball.plan.bucket;
      var m = PLINKO_PAY[ball.risk][idx];
      var win = Math.round(ball.bet * m);
      if (win > 0) api.give(win);
      api.record(win - ball.bet);
      var label = labels.children[idx];
      if (label) {
        label.removeAttribute("data-hit");
        void label.offsetWidth;
        label.setAttribute("data-hit", "1");
      }
      var chip = h("span", "hg-hist", m + "×");
      chip.style.setProperty("--t", (Math.abs(idx - (buckets - 1) / 2) / ((buckets - 1) / 2)).toFixed(3));
      history.insertBefore(chip, history.firstChild);
      while (history.children.length > 8) history.lastChild.remove();
      floatText(wrap, (win >= ball.bet ? "+" : "") + fmt(win - ball.bet), win >= ball.bet, (PL.BUCKET_LEFT + (idx + 0.5) * S) * scale, (PL.BUCKET_Y - 30) * scale);
    }

    function step(dt, now) {
      for (var k = balls.length - 1; k >= 0; k--) {
        var ball = balls[k];
        if (ball.settle) {
          if (now - ball.settle >= 240) {
            land(ball, now);
            balls.splice(k, 1);
          }
          continue;
        }
        var hit = plinkoStep(ball, dt, pegs);
        if (hit >= 0) pegs[hit].hit = now;
        ball.trail.push(ball.x, ball.y);
        if (ball.trail.length > 24) ball.trail.splice(0, 2);
        if (ball.y >= PL.BUCKET_Y) {
          ball.settle = now;
          // The slot is already decided; the last few pixels glide in.
          ball.sx = ball.x;
          ball.x = ball.sx;
        }
      }
    }

    function draw(now) {
      ctx.clearRect(0, 0, W, H);
      // Slot dividers.
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      for (var d = 0; d <= buckets; d++) {
        var dx = PL.BUCKET_LEFT + d * S;
        ctx.beginPath();
        ctx.moveTo(dx, PL.BUCKET_Y - 12);
        ctx.lineTo(dx, H - 6);
        ctx.stroke();
      }
      // Pegs, lit for a moment after a hit.
      for (var p = 0; p < pegs.length; p++) {
        var peg = pegs[p];
        var glow = peg.hit > 0 ? Math.max(0, 1 - (now - peg.hit) / 380) : 0;
        if (glow > 0) {
          ctx.globalAlpha = 0.4 * glow;
          ctx.fillStyle = colors.gold;
          ctx.beginPath();
          ctx.arc(peg.x, peg.y, PL.R_PEG + 7 * glow, 0, Math.PI * 2);
          ctx.fill();
        }
        // Neon peg: accent glow (gold right after a hit), dark core, small white highlight.
        var lit = glow > 0.3;
        ctx.save();
        ctx.shadowColor = lit ? colors.gold : colors.acc;
        ctx.shadowBlur = 8 + 8 * glow;
        ctx.fillStyle = lit ? colors.goldLight : colors.acc;
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, PL.R_PEG, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = colors.white;
        ctx.beginPath();
        ctx.arc(peg.x - PL.R_PEG * 0.3, peg.y - PL.R_PEG * 0.35, PL.R_PEG * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (var k = 0; k < balls.length; k++) {
        var ball = balls[k];
        var t = ball.trail;
        for (var i = 0; i < t.length; i += 2) {
          ctx.globalAlpha = (i / t.length) * 0.35;
          ctx.fillStyle = colors.acc;
          ctx.beginPath();
          ctx.arc(t[i], t[i + 1], PL.R_BALL * (0.4 + (i / t.length) * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
        var f = ball.settle ? Math.min(1, (now - ball.settle) / 240) : 0;
        var by = ball.y + f * 14;
        ctx.globalAlpha = 1 - f * 0.9;
        // Glow halo around the ball.
        var halo = ctx.createRadialGradient(ball.x, by, PL.R_BALL * 0.6, ball.x, by, PL.R_BALL * 2.8);
        halo.addColorStop(0, colors.acc);
        halo.addColorStop(1, "transparent");
        ctx.save();
        ctx.globalAlpha = (1 - f) * 0.45;
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(ball.x, by, PL.R_BALL * 2.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        var g = ctx.createRadialGradient(ball.x - 1.5, by - 1.5, 0.5, ball.x, by, PL.R_BALL);
        g.addColorStop(0, colors.white);
        g.addColorStop(0.35, colors.light);
        g.addColorStop(1, colors.acc);
        ctx.save();
        ctx.shadowColor = colors.acc;
        ctx.shadowBlur = 14;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ball.x, by, PL.R_BALL * (1 - f * 0.35), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    var frame = 0;
    var last = 0;
    var lastHit = 0;
    function loop(now) {
      frame = 0;
      if (!wrap.isConnected) return;
      var dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      // Fixed sub-steps: the same fall at 60 or 144 Hz, and no tunnelling.
      var sub = Math.max(1, Math.ceil(dt / (1 / 240)));
      for (var s = 0; s < sub; s++) step(dt / sub, now);
      if (balls.length) lastHit = now;
      draw(now);
      if (balls.length || now - lastHit < 450) frame = requestAnimationFrame(loop);
      else last = 0;
    }
    function kick() {
      if (!frame) frame = requestAnimationFrame(loop);
    }
    function stop() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }

    drop.addEventListener("click", function () {
      var b = bet.value();
      if (balls.length >= 12) return;
      if (!api.take(b)) {
        note.textContent = "Niet genoeg munten.";
        return;
      }
      colors = palette(stage); // follows a theme that changed meanwhile
      balls.push(plinkoNewBall(risk, b));
      kick();
    });

    paintLabels();
    resize();
  }

  /* ================================================================ */
  /* Blackjack                                                         */
  /* ================================================================ */

  /*
   * One standard 52-card deck, shuffled (Fisher-Yates on the crypto source)
   * and reshuffled when fewer than 15 cards are left. The dealer stands on
   * every 17. Blackjack pays 3:2, a win 1:1, a push gives the bet back, and
   * double down takes exactly one more card for a second bet.
   */
  var SUITS = ["♠", "♥", "♦", "♣"];
  var RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  function newDeck() {
    var deck = [];
    SUITS.forEach(function (s) {
      RANKS.forEach(function (r) {
        deck.push({ rank: r, suit: s });
      });
    });
    for (var i = deck.length - 1; i > 0; i--) {
      var j = rand(i + 1);
      var t = deck[i];
      deck[i] = deck[j];
      deck[j] = t;
    }
    return deck;
  }

  /** Best total of a hand: aces count 11 while that does not bust. */
  function handTotal(cards) {
    var total = 0;
    var aces = 0;
    cards.forEach(function (c) {
      if (c.rank === "A") {
        aces++;
        total += 11;
      } else {
        total += "JQK".indexOf(c.rank) !== -1 || c.rank === "10" ? 10 : Number(c.rank);
      }
    });
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return { total: total, soft: aces > 0 };
  }

  function isBlackjack(cards) {
    return cards.length === 2 && handTotal(cards).total === 21;
  }

  /** A playing card drawn with CSS: corner index, big suit, a patterned back. */
  function cardNode(card, faceDown) {
    var red = card.suit === "♥" || card.suit === "♦";
    var node = h("div", "hg-card");
    node.setAttribute("data-red", red ? "1" : "0");
    var inner = h("div", "hg-card-in");
    var front = h("div", "hg-card-face");
    var tl = h("span", "hg-card-idx");
    tl.appendChild(h("b", null, card.rank));
    tl.appendChild(h("i", null, card.suit));
    front.appendChild(tl);
    front.appendChild(h("span", "hg-card-pip", card.suit));
    var br = h("span", "hg-card-idx hg-card-idx--br");
    br.appendChild(h("b", null, card.rank));
    br.appendChild(h("i", null, card.suit));
    front.appendChild(br);
    var back = h("div", "hg-card-back");
    inner.appendChild(front);
    inner.appendChild(back);
    node.appendChild(inner);
    if (faceDown) node.setAttribute("data-down", "1");
    return node;
  }

  function blackjack(stage, side, api) {
    var deck = newDeck();
    var player = [];
    var dealer = [];
    var phase = "idle"; // idle | player | dealer
    var staked = 0;
    var alive = true;
    var timers = [];
    api.onDispose(function () {
      alive = false;
      timers.forEach(clearTimeout);
    });
    function later(fn, ms) {
      timers.push(
        setTimeout(function () {
          if (alive) fn();
        }, ms)
      );
    }

    var table = h("div", "hg-bj-table");
    var dealerRow = h("div", "hg-bj-row");
    var dealerTag = h("span", "hg-bj-tag", "Bank");
    var dealerCards = h("div", "hg-bj-cards");
    dealerRow.appendChild(dealerTag);
    dealerRow.appendChild(dealerCards);
    var msg = h("div", "hg-bj-msg", "Plaats je inzet en deel.");
    var playerRow = h("div", "hg-bj-row");
    var playerTag = h("span", "hg-bj-tag", "Jij");
    var playerCards = h("div", "hg-bj-cards");
    playerRow.appendChild(playerTag);
    playerRow.appendChild(playerCards);
    var shoe = h("div", "hg-bj-shoe");
    table.appendChild(shoe);
    table.appendChild(dealerRow);
    table.appendChild(msg);
    table.appendChild(playerRow);
    stage.appendChild(table);

    var bet = betControl(api, 10);
    side.appendChild(bet.node);
    var dealBtn = btn("hg-main", "Delen");
    side.appendChild(dealBtn);
    var actions = h("div", "hg-row hg-row--3");
    var hitBtn = btn("hg-ghost", "Kaart");
    var standBtn = btn("hg-ghost", "Blijven");
    var dblBtn = btn("hg-ghost", "Verdubbel");
    actions.appendChild(hitBtn);
    actions.appendChild(standBtn);
    actions.appendChild(dblBtn);
    side.appendChild(actions);
    var wins = statLine("Gewonnen");
    var losses = statLine("Verloren");
    var pushes = statLine("Gelijk");
    var stats = h("div", "hg-stats");
    stats.appendChild(wins.node);
    stats.appendChild(losses.node);
    stats.appendChild(pushes.node);
    side.appendChild(stats);
    var tally = { w: 0, l: 0, p: 0 };
    function paintTally() {
      wins.set(String(tally.w));
      losses.set(String(tally.l));
      pushes.set(String(tally.p));
    }
    paintTally();
    side.appendChild(h("span", "hg-label", "Laatste"));
    var history = h("div", "hg-history");
    side.appendChild(history);
    side.appendChild(h("div", "hg-note", "De bank blijft op 17. Blackjack betaalt 3 op 2."));

    function lock() {
      var playing = phase === "player";
      bet.disable(phase !== "idle");
      dealBtn.disabled = phase !== "idle";
      hitBtn.disabled = !playing;
      standBtn.disabled = !playing;
      dblBtn.disabled = !(playing && player.length === 2 && api.coins() >= staked);
    }

    function paintTotals() {
      var p = handTotal(player);
      playerTag.textContent = player.length ? "Jij · " + p.total + (p.soft && p.total < 21 ? " (zacht)" : "") : "Jij";
      var shown = phase === "player" || phase === "deal" ? dealer.slice(0, 1) : dealer;
      var d = handTotal(shown);
      dealerTag.textContent = dealer.length ? "Bank · " + d.total : "Bank";
    }

    function draw() {
      if (!deck.length) deck = newDeck();
      return deck.pop();
    }

    function addCard(hand, row, faceDown) {
      var c = draw();
      hand.push(c);
      var node = cardNode(c, faceDown);
      node.style.setProperty("--n", String(hand.length - 1));
      row.appendChild(node);
      paintTotals();
      return node;
    }

    function chip(text, kind) {
      var c = h("span", "hg-hist hg-hist--" + kind, text);
      history.insertBefore(c, history.firstChild);
      while (history.children.length > 8) history.lastChild.remove();
    }

    /** kind: win | lose | push | blackjack. `back` is what returns to the balance. */
    function finish(kind, text) {
      phase = "idle";
      var back = 0;
      var net = 0;
      if (kind === "blackjack") back = Math.round(staked * 2.5);
      else if (kind === "win") back = staked * 2;
      else if (kind === "push") back = staked;
      net = back - staked;
      if (back > 0) api.give(back);
      if (net > 0) api.record(net);
      if (kind === "lose") tally.l++;
      else if (kind === "push") tally.p++;
      else tally.w++;
      paintTally();
      msg.textContent = text;
      msg.setAttribute("data-kind", kind);
      chip((net > 0 ? "+" : "") + fmt(net), kind === "lose" ? "lose" : kind === "push" ? "push" : "win");
      floatText(table, (net > 0 ? "+" : "") + fmt(net), net >= 0, undefined, undefined);
      lock();
      paintTotals();
    }

    function reveal() {
      var hole = dealerCards.querySelector(".hg-card[data-down]");
      if (hole) hole.removeAttribute("data-down");
      paintTotals();
    }

    function dealerPlay() {
      phase = "dealer";
      lock();
      reveal();
      function turn() {
        var p = handTotal(player).total;
        var d = handTotal(dealer).total;
        if (d < 17) {
          addCard(dealer, dealerCards, false);
          later(turn, 650);
          return;
        }
        if (d > 21) finish("win", "De bank gaat over 21. Jij wint!");
        else if (d > p) finish("lose", "De bank wint met " + d + ".");
        else if (d < p) finish("win", "Jij wint met " + p + ".");
        else finish("push", "Gelijkspel op " + p + ". Je inzet komt terug.");
      }
      later(turn, 700);
    }

    function deal() {
      var b = bet.value();
      if (!api.take(b)) {
        msg.textContent = "Niet genoeg munten.";
        return;
      }
      staked = b;
      if (deck.length < 20) deck = newDeck();
      player = [];
      dealer = [];
      dealerCards.textContent = "";
      playerCards.textContent = "";
      msg.textContent = "";
      msg.removeAttribute("data-kind");
      phase = "deal";
      lock();
      addCard(player, playerCards, false);
      later(function () {
        addCard(dealer, dealerCards, false);
      }, 260);
      later(function () {
        addCard(player, playerCards, false);
      }, 520);
      later(function () {
        addCard(dealer, dealerCards, true);
        var pbj = isBlackjack(player);
        var dbj = isBlackjack(dealer);
        if (pbj || dbj) {
          reveal();
          if (pbj && dbj) finish("push", "Allebei blackjack. Je inzet komt terug.");
          else if (pbj) finish("blackjack", "Blackjack! Dat betaalt 3 op 2.");
          else finish("lose", "De bank heeft blackjack.");
          return;
        }
        phase = "player";
        msg.textContent = "Kaart of blijven?";
        lock();
      }, 780);
    }

    function hit() {
      if (phase !== "player") return;
      addCard(player, playerCards, false);
      lock();
      var t = handTotal(player).total;
      if (t > 21) {
        reveal();
        finish("lose", "Over 21 met " + t + ". Verloren.");
      } else if (t === 21) {
        msg.textContent = "21!";
        later(dealerPlay, 350);
        phase = "dealer";
        lock();
      }
    }

    function stand() {
      if (phase !== "player") return;
      dealerPlay();
    }

    function double() {
      if (phase !== "player" || player.length !== 2 || !api.take(staked)) return;
      staked *= 2;
      msg.textContent = "Verdubbeld: één kaart.";
      addCard(player, playerCards, false);
      var t = handTotal(player).total;
      if (t > 21) {
        phase = "dealer";
        lock();
        later(function () {
          reveal();
          finish("lose", "Over 21 met " + t + ". Verloren.");
        }, 450);
      } else {
        phase = "dealer";
        lock();
        later(dealerPlay, 450);
      }
    }

    dealBtn.addEventListener("click", deal);
    hitBtn.addEventListener("click", hit);
    standBtn.addEventListener("click", stand);
    dblBtn.addEventListener("click", double);
    lock();
  }

  /* ================================================================ */
  /* Roulette                                                          */
  /* ================================================================ */

  var WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  var REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

  function colorOf(n) {
    return n === 0 ? "green" : REDS.indexOf(n) !== -1 ? "red" : "black";
  }

  /* Outside bets: id, label, numbers they cover, payout including the stake. */
  function outsideBets() {
    var list = [];
    function range(a, b) {
      var out = [];
      for (var i = a; i <= b; i++) out.push(i);
      return out;
    }
    var all = range(1, 36);
    list.push({ id: "d1", label: "1e 12", nums: range(1, 12), pay: 3 });
    list.push({ id: "d2", label: "2e 12", nums: range(13, 24), pay: 3 });
    list.push({ id: "d3", label: "3e 12", nums: range(25, 36), pay: 3 });
    list.push({ id: "lo", label: "1–18", nums: range(1, 18), pay: 2 });
    list.push({ id: "even", label: "Even", nums: all.filter(function (n) { return n % 2 === 0; }), pay: 2 });
    list.push({ id: "red", label: "Rood", nums: REDS.slice(), pay: 2 });
    list.push({ id: "black", label: "Zwart", nums: all.filter(function (n) { return REDS.indexOf(n) === -1; }), pay: 2 });
    list.push({ id: "odd", label: "Oneven", nums: all.filter(function (n) { return n % 2 === 1; }), pay: 2 });
    list.push({ id: "hi", label: "19–36", nums: range(19, 36), pay: 2 });
    list.push({ id: "c1", label: "2:1", nums: all.filter(function (n) { return n % 3 === 1; }), pay: 3 });
    list.push({ id: "c2", label: "2:1", nums: all.filter(function (n) { return n % 3 === 2; }), pay: 3 });
    list.push({ id: "c3", label: "2:1", nums: all.filter(function (n) { return n % 3 === 0; }), pay: 3 });
    return list;
  }

  function drawWheel(canvas, size, pal) {
    var dpr = Math.max(2, Math.min(window.devicePixelRatio || 1, 3)); // always hi-res, it is drawn once
    canvas.width = canvas.height = Math.round(size * dpr);
    var c = canvas.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cx = size / 2;
    var R = size / 2;
    var seg = (Math.PI * 2) / WHEEL.length;

    // Wooden outer bowl.
    var wood = c.createRadialGradient(cx, cx, R * 0.78, cx, cx, R);
    wood.addColorStop(0, pal.woodDark);
    wood.addColorStop(0.5, pal.woodLight);
    wood.addColorStop(1, pal.woodDark);
    c.fillStyle = wood;
    c.beginPath();
    c.arc(cx, cx, R, 0, Math.PI * 2);
    c.fill();
    // Gold rim.
    c.strokeStyle = pal.gold;
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(cx, cx, R * 0.86, 0, Math.PI * 2);
    c.stroke();

    // Pockets, numbered, angle 0 = straight up.
    for (var i = 0; i < WHEEL.length; i++) {
      var a0 = -Math.PI / 2 + (i - 0.5) * seg;
      var a1 = a0 + seg;
      var n = WHEEL[i];
      var col = colorOf(n);
      c.fillStyle = col === "green" ? pal.green : col === "red" ? pal.red : pal.black;
      c.beginPath();
      c.moveTo(cx, cx);
      c.arc(cx, cx, R * 0.84, a0, a1);
      c.closePath();
      c.fill();
      c.save();
      c.translate(cx, cx);
      c.rotate(a0 + seg / 2 + Math.PI / 2);
      c.fillStyle = pal.white;
      c.font = "700 " + Math.round(R * 0.075) + "px system-ui, sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(String(n), 0, -R * 0.76);
      c.restore();
    }
    // Pocket depth: dark inner edge and a light outer edge, so each pocket reads as a dish.
    var depth = c.createRadialGradient(cx, cx, R * 0.56, cx, cx, R * 0.84);
    depth.addColorStop(0, "rgba(0,0,0,.45)");
    depth.addColorStop(0.35, "rgba(0,0,0,0)");
    depth.addColorStop(0.9, "rgba(255,255,255,.14)");
    depth.addColorStop(1, "rgba(0,0,0,.3)");
    c.fillStyle = depth;
    c.beginPath();
    c.arc(cx, cx, R * 0.84, 0, Math.PI * 2);
    c.fill();
    // Pocket separators (frets), golden and crisp.
    c.strokeStyle = pal.goldLight;
    c.globalAlpha = 0.95;
    c.lineWidth = 1.8;
    for (var j = 0; j < WHEEL.length; j++) {
      var a = -Math.PI / 2 + (j - 0.5) * seg;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * R * 0.56, cx + Math.sin(a) * R * 0.56);
      c.lineTo(cx + Math.cos(a) * R * 0.84, cx + Math.sin(a) * R * 0.84);
      c.stroke();
    }
    // Pocket floor ring and cone.
    c.globalAlpha = 1;
    c.fillStyle = "rgba(0,0,0,.28)";
    c.beginPath();
    c.arc(cx, cx, R * 0.68, 0, Math.PI * 2);
    c.arc(cx, cx, R * 0.56, 0, Math.PI * 2, true);
    c.fill();
    var cone = c.createRadialGradient(cx - R * 0.12, cx - R * 0.14, R * 0.04, cx, cx, R * 0.56);
    cone.addColorStop(0, pal.woodLight);
    cone.addColorStop(0.55, pal.wood);
    cone.addColorStop(1, pal.woodDark);
    c.fillStyle = cone;
    c.beginPath();
    c.arc(cx, cx, R * 0.56, 0, Math.PI * 2);
    c.fill();
    // Gold turret.
    for (var k = 0; k < 4; k++) {
      c.save();
      c.translate(cx, cx);
      c.rotate((k * Math.PI) / 2);
      var arm = c.createLinearGradient(0, 0, 0, -R * 0.36);
      arm.addColorStop(0, pal.goldLight);
      arm.addColorStop(1, pal.goldDark);
      c.fillStyle = arm;
      c.beginPath();
      c.moveTo(-R * 0.025, 0);
      c.lineTo(R * 0.025, 0);
      c.lineTo(R * 0.012, -R * 0.36);
      c.lineTo(-R * 0.012, -R * 0.36);
      c.closePath();
      c.fill();
      c.beginPath();
      c.arc(0, -R * 0.36, R * 0.03, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    var knob = c.createRadialGradient(cx - 4, cx - 5, 1, cx, cx, R * 0.09);
    knob.addColorStop(0, pal.goldLight);
    knob.addColorStop(1, pal.goldDark);
    c.fillStyle = knob;
    c.beginPath();
    c.arc(cx, cx, R * 0.09, 0, Math.PI * 2);
    c.fill();
    // Gloss: a soft light sweep over the upper left of the whole wheel.
    var gloss = c.createLinearGradient(cx - R * 0.7, cx - R * 0.9, cx + R * 0.3, cx + R * 0.2);
    gloss.addColorStop(0, "rgba(255,255,255,.22)");
    gloss.addColorStop(0.5, "rgba(255,255,255,0)");
    c.fillStyle = gloss;
    c.beginPath();
    c.arc(cx, cx, R * 0.86, 0, Math.PI * 2);
    c.fill();
  }

  var CHIPS = [1, 5, 25, 100, 500];

  function roulette(stage, side, api) {
    var bets = {}; // betId -> amount
    var chip = 5;
    var spinning = false;
    var lastBets = null;

    var scene = h("div", "hg-rl-scene");
    var plane = h("div", "hg-rl-plane");
    var wheelSpin = h("div", "hg-rl-spin");
    var canvas = h("canvas", "hg-rl-wheel");
    wheelSpin.appendChild(canvas);
    plane.appendChild(wheelSpin);
    var ballArm = h("div", "hg-rl-arm");
    var ball = h("span", "hg-rl-ball");
    ballArm.appendChild(ball);
    plane.appendChild(ballArm);
    scene.appendChild(h("div", "hg-rl-shadow"));
    scene.appendChild(plane);
    var result = h("div", "hg-rl-result");
    scene.appendChild(result);

    var WHEEL_PX = 300;
    drawWheel(canvas, WHEEL_PX, palette(stage));

    var table = h("div", "hg-rl-table");
    var cells = {};
    var zero = btn("hg-rl-cell hg-rl-zero", "0");
    zero.setAttribute("data-c", "green");
    zero.setAttribute("data-bet", "n0");
    table.appendChild(zero);
    cells.n0 = zero;
    // Three rows (top = 3,6,…), twelve columns.
    for (var row = 0; row < 3; row++) {
      for (var col = 0; col < 12; col++) {
        var num = col * 3 + (3 - row);
        var cell = btn("hg-rl-cell", String(num));
        cell.setAttribute("data-c", colorOf(num));
        cell.setAttribute("data-bet", "n" + num);
        cell.style.gridRow = String(row + 1);
        cell.style.gridColumn = String(col + 2);
        table.appendChild(cell);
        cells["n" + num] = cell;
      }
    }
    var OUT = outsideBets();
    var BY_ID = {};
    OUT.forEach(function (o) {
      BY_ID[o.id] = o;
      var cell = btn("hg-rl-cell hg-rl-out", o.label);
      cell.setAttribute("data-bet", o.id);
      if (o.id === "red") cell.setAttribute("data-c", "red");
      if (o.id === "black") cell.setAttribute("data-c", "black");
      var place = {
        d1: [4, "2 / 6"], d2: [4, "6 / 10"], d3: [4, "10 / 14"],
        lo: [5, "2 / 4"], even: [5, "4 / 6"], red: [5, "6 / 8"], black: [5, "8 / 10"], odd: [5, "10 / 12"], hi: [5, "12 / 14"],
        c1: [3, "14"], c2: [2, "14"], c3: [1, "14"],
      }[o.id];
      cell.style.gridRow = String(place[0]);
      cell.style.gridColumn = place[1];
      table.appendChild(cell);
      cells[o.id] = cell;
    });
    table.addEventListener("click", function (e) {
      var cell = e.target.closest && e.target.closest("[data-bet]");
      if (!cell || spinning) return;
      var id = cell.getAttribute("data-bet");
      if (total() + chip > api.coins()) {
        note.textContent = "Niet genoeg munten voor nog een fiche.";
        return;
      }
      bets[id] = (bets[id] || 0) + chip;
      paintBets();
    });
    table.addEventListener("contextmenu", function (e) {
      var cell = e.target.closest && e.target.closest("[data-bet]");
      if (!cell || spinning) return;
      e.preventDefault();
      delete bets[cell.getAttribute("data-bet")];
      paintBets();
    });

    stage.appendChild(scene);
    stage.appendChild(table);

    // Controls
    var chipField = h("div", "hg-field");
    chipField.appendChild(h("span", "hg-label", "Fiche"));
    var chipRow = h("div", "hg-chips");
    var chipButtons = CHIPS.map(function (v) {
      var b = btn("hg-chip", v >= 1000 ? v / 1000 + "k" : String(v));
      b.setAttribute("data-v", String(v));
      b.setAttribute("data-on", v === chip ? "1" : "0");
      b.addEventListener("click", function () {
        chip = v;
        chipButtons.forEach(function (x) {
          x.setAttribute("data-on", x === b ? "1" : "0");
        });
      });
      chipRow.appendChild(b);
      return b;
    });
    chipField.appendChild(chipRow);
    side.appendChild(chipField);

    var stats = h("div", "hg-stats");
    var sBet = statLine("Totale inzet");
    stats.appendChild(sBet.node);
    side.appendChild(stats);

    var row2 = h("div", "hg-row");
    var clear = btn("hg-ghost", "Wissen");
    var again = btn("hg-ghost", "Herhaal");
    row2.appendChild(clear);
    row2.appendChild(again);
    side.appendChild(row2);
    var spin = btn("hg-main", "Draai");
    side.appendChild(spin);
    side.appendChild(h("span", "hg-label", "Laatste nummers"));
    var history = h("div", "hg-history");
    side.appendChild(history);
    var note = h("div", "hg-note", "Klik op de tafel om fiches te leggen, rechtsklik om ze weg te halen.");
    side.appendChild(note);

    function total() {
      var t = 0;
      for (var k in bets) t += bets[k];
      return t;
    }

    function paintBets() {
      Object.keys(cells).forEach(function (id) {
        var cell = cells[id];
        var old = cell.querySelector(".hg-rl-stack");
        if (old) old.remove();
        if (bets[id]) {
          var s = h("span", "hg-rl-stack", bets[id] >= 1000 ? (bets[id] / 1000).toFixed(1) + "k" : bets[id]);
          cell.appendChild(s);
        }
      });
      sBet.set(fmt(total()));
      spin.disabled = spinning || !total();
      clear.disabled = spinning || !total();
      again.disabled = spinning || !lastBets;
    }

    clear.addEventListener("click", function () {
      bets = {};
      paintBets();
    });
    again.addEventListener("click", function () {
      if (!lastBets) return;
      var t = 0;
      for (var k in lastBets) t += lastBets[k];
      if (t > api.coins()) {
        note.textContent = "Niet genoeg munten om dat te herhalen.";
        return;
      }
      bets = Object.assign({}, lastBets);
      paintBets();
    });

    var wheelAngle = 0;
    var ballAngle = 0;
    var frame = 0;
    var pending = -1; // the number a running spin will land on
    api.onDispose(function () {
      if (frame) cancelAnimationFrame(frame);
      if (spinning && pending >= 0) {
        var back = payoutFor(pending);
        if (back) api.give(back);
      }
    });

    function payoutFor(n) {
      var payout = 0;
      Object.keys(lastBets).forEach(function (id) {
        var amount = lastBets[id];
        if (id.charAt(0) === "n") {
          if (Number(id.slice(1)) === n) payout += amount * 36;
        } else if (BY_ID[id] && BY_ID[id].nums.indexOf(n) !== -1) {
          payout += amount * BY_ID[id].pay;
        }
      });
      return payout;
    }

    function pocketAngle(n) {
      return (WHEEL.indexOf(n) * 360) / WHEEL.length;
    }

    function setTransforms(ballRadius) {
      wheelSpin.style.transform = "rotate(" + wheelAngle.toFixed(2) + "deg)";
      ballArm.style.transform = "rotate(" + ballAngle.toFixed(2) + "deg)";
      ball.style.transform = "translate3d(-50%, " + (-ballRadius).toFixed(1) + "px, 0) rotate(" + (-ballAngle).toFixed(1) + "deg)";
    }

    function easeOut(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    spin.addEventListener("click", function () {
      var stake = total();
      if (spinning || !stake) return;
      if (!api.take(stake)) {
        note.textContent = "Niet genoeg munten.";
        return;
      }
      spinning = true;
      lastBets = Object.assign({}, bets);
      paintBets();
      table.setAttribute("data-locked", "1");
      result.removeAttribute("data-on");
      Object.keys(cells).forEach(function (id) {
        cells[id].removeAttribute("data-win");
      });

      var win = WHEEL[rand(WHEEL.length)];
      pending = win;
      var dur = 5200;
      var w0 = wheelAngle;
      var w1 = w0 + 360 * 2 + rand(360);
      // The ball is tracked relative to the wheel: it runs against it, then
      // drops into the winning pocket and rides along until both stop.
      var rel0 = ballAngle - w0;
      var rel1 = rel0 - 360 * 3;
      rel1 -= (((rel1 - pocketAngle(win)) % 360) + 360) % 360;
      var R_RIM = WHEEL_PX * 0.43;
      var R_POCKET = WHEEL_PX * 0.33;
      var t0 = performance.now();

      function tick(now) {
        frame = 0;
        if (!scene.isConnected) return;
        var t = Math.min(1, (now - t0) / dur);
        wheelAngle = w0 + (w1 - w0) * easeOut(t);
        ballAngle = wheelAngle + rel0 + (rel1 - rel0) * easeOut(Math.min(1, t / 0.85));
        var drop = t < 0.55 ? 0 : easeOut((t - 0.55) / 0.45);
        var bounce = t > 0.55 && t < 0.85 ? Math.abs(Math.sin((t - 0.55) * 34)) * (1 - (t - 0.55) / 0.3) * 9 : 0;
        setTransforms(R_RIM - (R_RIM - R_POCKET) * drop + bounce);
        if (t < 1) {
          frame = requestAnimationFrame(tick);
          return;
        }
        wheelAngle %= 360;
        ballAngle %= 360;
        settle(win, stake);
      }
      frame = requestAnimationFrame(tick);
    });

    function settle(n, stake) {
      var payout = payoutFor(n);
      pending = -1;
      if (payout) api.give(payout);
      api.record(payout - stake);
      result.textContent = String(n);
      result.setAttribute("data-c", colorOf(n));
      result.setAttribute("data-on", "1");
      if (cells["n" + n]) cells["n" + n].setAttribute("data-win", "1");
      OUT.forEach(function (o) {
        if (o.nums.indexOf(n) !== -1) cells[o.id].setAttribute("data-win", "1");
      });
      var pill = h("span", "hg-hist hg-rl-pill", String(n));
      pill.setAttribute("data-c", colorOf(n));
      history.insertBefore(pill, history.firstChild);
      while (history.children.length > 10) history.lastChild.remove();
      var net = payout - stake;
      note.textContent = payout
        ? n + " " + (colorOf(n) === "red" ? "rood" : colorOf(n) === "black" ? "zwart" : "groen") + ": " + fmt(payout) + " munten terug" + (net > 0 ? ", " + fmt(net) + " winst." : net < 0 ? ", " + fmt(-net) + " verlies." : ".")
        : n + ": helaas, geen winst deze keer.";
      floatText(scene, (net >= 0 ? "+" : "") + fmt(net), net >= 0);
      spinning = false;
      bets = {};
      table.removeAttribute("data-locked");
      paintBets();
    }

    setTransforms(WHEEL_PX * 0.43);
    paintBets();
  }

  window.sscHubGames = { mines: mines, plinko: plinko, roulette: roulette, blackjack: blackjack };
  // Maths and physics of Plinko without any DOM, for the harness.
  window.sscHubGames.plinkoTest = plinkoTest;
  window.sscHubGames.plinkoPay = PLINKO_PAY;

  /*
   * No colour literals here: everything is a --hb-* token that hub.js maps
   * onto the Smartschool theme (--ssc-base00, --ssc-text, --ssc-accent, ...),
   * with the browser's own Canvas / CanvasText / Highlight when no theme is on.
   */
  window.sscHubGamesCss = [
    /* shared controls */
    ".hg-field { display: flex; flex-direction: column; gap: 6px; }",
    ".hg-label { font-size: 10.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }",
    ".hg-bet { display: flex; align-items: center; gap: 6px; padding: 5px 5px 5px 10px; border-radius: 14px;",
    "  background: var(--hb-field); box-shadow: inset 0 1px 2px rgb(0 0 0 / .18), 0 0 0 1px var(--line); }",
    ".hg-coin { width: 16px; height: 16px; border-radius: 50%; flex: none;",
    "  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--hb-gold) 35%, white), var(--hb-gold) 45%, color-mix(in srgb, var(--hb-gold) 55%, black));",
    "  box-shadow: 0 0 0 1.5px color-mix(in srgb, var(--hb-gold) 50%, black) inset; }",
    ".hg-bet-input { flex: 1; min-width: 0; width: 60px; border: 0; background: transparent; color: var(--ink); font: inherit; font-size: 15px; font-weight: 800;",
    "  font-variant-numeric: tabular-nums; outline: none; -moz-appearance: textfield; }",
    ".hg-bet-input::-webkit-inner-spin-button, .hg-bet-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }",
    ".hg-mini, .hg-ghost, .hg-seg-btn, .hg-chip { font: inherit; cursor: pointer; color: var(--ink); border: 0; transition: transform .12s ease, background .15s ease, opacity .15s; }",
    ".hg-mini { padding: 6px 10px; border-radius: 10px; font-size: 12px; font-weight: 800; background: var(--hb-fill2); }",
    ".hg-mini:hover:not(:disabled), .hg-ghost:hover:not(:disabled) { background: color-mix(in srgb, var(--hb-ink) 22%, transparent); }",
    "button:disabled { opacity: .45; cursor: default; }",
    ".hg-seg { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 4px; padding: 4px; border-radius: 14px; background: var(--hb-field); }",
    ".hg-seg-btn { padding: 8px 6px; border-radius: 10px; font-size: 12.5px; font-weight: 700; background: transparent; }",
    ".hg-seg-btn[data-on='1'] { background: var(--hb-acc); color: var(--hb-on-acc); box-shadow: 0 4px 12px rgb(0 0 0 / .22); }",
    ".hg-range { width: 100%; accent-color: var(--hb-acc); }",
    ".hg-stats { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 14px; background: var(--hb-fill);",
    "  box-shadow: inset 0 0 0 1px var(--line); }",
    ".hg-stat { display: flex; justify-content: space-between; gap: 10px; font-size: 12.5px; color: var(--muted); }",
    ".hg-stat b { color: var(--ink); font-variant-numeric: tabular-nums; }",
    ".hg-main { font: inherit; font-size: 15px; font-weight: 800; letter-spacing: .01em; color: var(--hb-on-acc); cursor: pointer; border: 0;",
    "  padding: 13px 16px; border-radius: 16px; background: linear-gradient(180deg, color-mix(in srgb, var(--hb-acc) 78%, white), var(--hb-acc));",
    "  box-shadow: 0 10px 24px -8px var(--hb-acc), inset 0 1px 0 rgb(255 255 255 / .5), inset 0 -3px 0 rgb(0 0 0 / .14);",
    "  transition: transform .12s ease, box-shadow .2s ease, filter .2s; }",
    ".hg-main:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }",
    ".hg-main:active:not(:disabled) { transform: translateY(1px) scale(.99); }",
    ".hg-main[data-cash='1'] { color: black; background: linear-gradient(180deg, color-mix(in srgb, var(--hb-gold) 60%, white), var(--hb-gold));",
    "  box-shadow: 0 10px 24px -8px var(--hb-gold), inset 0 1px 0 rgb(255 255 255 / .6); }",
    ".hg-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }",
    ".hg-row--3 { grid-template-columns: repeat(3, 1fr); }",
    ".hg-ghost { padding: 9px 10px; border-radius: 12px; font-size: 12.5px; font-weight: 700; background: var(--hb-fill2); }",
    ".hg-note { font-size: 12px; line-height: 1.45; color: var(--muted); min-height: 34px; }",
    ".hg-history { display: flex; flex-wrap: wrap; gap: 5px; min-height: 24px; }",
    ".hg-hist { --c: color-mix(in srgb, var(--hb-red) calc(var(--t, .5) * 100%), var(--hb-gold));",
    "  display: inline-grid; place-items: center; min-width: 30px; height: 22px; padding: 0 6px; border-radius: 8px; font-size: 11px; font-weight: 800;",
    "  color: black; background: var(--c); animation: hg-pop .3s cubic-bezier(.3,1.6,.5,1); }",
    ".hg-hist--win { --c: var(--hb-green); } .hg-hist--lose { --c: var(--hb-red); color: white; }",
    ".hg-hist--push { --c: color-mix(in srgb, var(--hb-ink) 30%, transparent); color: var(--ink); }",
    ".hg-float { position: absolute; left: 50%; top: 42%; z-index: 9; pointer-events: none; font-size: 22px; font-weight: 900; color: var(--hb-green);",
    "  text-shadow: 0 2px 10px rgb(0 0 0 / .45); transform: translate(-50%, 0); animation: hg-float 1.2s ease-out forwards; }",
    ".hg-float[data-good='0'] { color: var(--hb-red); }",
    "@keyframes hg-float { from { opacity: 0; transform: translate(-50%, 10px) scale(.8); } 15% { opacity: 1; transform: translate(-50%, 0) scale(1.08); }",
    "  to { opacity: 0; transform: translate(-50%, -46px) scale(1); } }",
    "@keyframes hg-pop { from { transform: scale(.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }",

    /* Mines */
    ".hg-mn-board { --hg-gem: color-mix(in srgb, var(--hb-green) 55%, var(--hb-blue)); --hg-gem-l: color-mix(in srgb, var(--hg-gem) 55%, white);",
    "  --hg-gem-ll: color-mix(in srgb, var(--hg-gem) 22%, white); --hg-gem-d: color-mix(in srgb, var(--hg-gem) 55%, black);",
    "  position: relative; display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; width: min(100%, 470px); margin: 0 auto;",
    "  padding: 14px; border-radius: 22px; perspective: 900px; background: var(--hb-field); box-shadow: inset 0 2px 8px rgb(0 0 0 / .22); }",
    ".hg-mn-board[data-shake='1'] { animation: hg-shake .42s ease; }",
    "@keyframes hg-shake { 20% { transform: translate(-6px, 2px); } 40% { transform: translate(5px, -3px); } 60% { transform: translate(-4px, 1px); } 80% { transform: translate(3px, 0); } }",
    ".hg-mn-tile { position: relative; aspect-ratio: 1; padding: 0; border: 0; background: none; cursor: pointer; transform-style: preserve-3d; }",
    ".hg-mn-board:not([data-live]) .hg-mn-tile:not([data-state]) { cursor: default; }",
    ".hg-mn-inner { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .5s cubic-bezier(.3,1.4,.5,1); }",
    ".hg-mn-board[data-live] .hg-mn-tile:not([data-state]):hover .hg-mn-inner { transform: translateZ(14px) rotateX(8deg); }",
    ".hg-mn-tile[data-state] .hg-mn-inner { transform: rotateY(180deg); }",
    ".hg-mn-tile[data-dim] .hg-mn-inner { transition-delay: var(--d); }",
    ".hg-mn-front, .hg-mn-back { position: absolute; inset: 0; border-radius: 14px; backface-visibility: hidden; -webkit-backface-visibility: hidden; }",
    ".hg-mn-front { background: linear-gradient(160deg, color-mix(in srgb, var(--hb-ink) 26%, var(--hb-bg)), color-mix(in srgb, var(--hb-ink) 12%, var(--hb-bg)));",
    "  box-shadow: inset 0 1px 0 rgb(255 255 255 / .22), inset 0 -5px 0 rgb(0 0 0 / .18), 0 6px 14px rgb(0 0 0 / .22); }",
    ".hg-mn-board[data-live] .hg-mn-front { background: linear-gradient(160deg, color-mix(in srgb, var(--hb-acc) 34%, var(--hb-bg)), color-mix(in srgb, var(--hb-acc) 16%, var(--hb-bg))); }",
    ".hg-mn-back { display: grid; place-items: center; transform: rotateY(180deg); background: linear-gradient(160deg, color-mix(in srgb, var(--hb-bg) 86%, black), color-mix(in srgb, var(--hb-bg) 70%, black));",
    "  box-shadow: inset 0 0 0 1px var(--line), inset 0 4px 10px rgb(0 0 0 / .3); }",
    ".hg-mn-back svg { width: 64%; height: 64%; filter: drop-shadow(0 4px 8px rgb(0 0 0 / .4)); }",
    ".hg-mn-tile[data-state='gem']:not([data-dim]) .hg-mn-back { box-shadow: inset 0 0 0 2px var(--hg-gem), 0 0 22px color-mix(in srgb, var(--hg-gem) 45%, transparent); }",
    ".hg-mn-tile[data-state='gem']:not([data-dim]) svg { animation: hg-gem .5s .2s cubic-bezier(.3,1.7,.5,1) both; }",
    "@keyframes hg-gem { from { transform: scale(.3) rotate(-20deg); } to { transform: scale(1) rotate(0); } }",
    "/* a mine always sits on a red tile: a black bomb on a dark board was invisible */",
    ".hg-mn-tile[data-state='bomb']:not([data-boom]) .hg-mn-back { background: radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--hb-red) 78%, white), color-mix(in srgb, var(--hb-red) 88%, black)); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--hb-red) 55%, white), 0 0 18px color-mix(in srgb, var(--hb-red) 45%, transparent); }",
    ".hg-mn-tile[data-boom] .hg-mn-back { background: radial-gradient(circle, var(--hb-orange), color-mix(in srgb, var(--hb-red) 70%, black) 70%); box-shadow: 0 0 34px color-mix(in srgb, var(--hb-red) 70%, transparent); }",
    ".hg-mn-tile[data-boom]::after { content: ''; position: absolute; inset: -10%; border-radius: 50%; border: 3px solid var(--hb-orange);",
    "  animation: hg-ring .6s ease-out forwards; pointer-events: none; }",
    "@keyframes hg-ring { from { transform: scale(.4); opacity: 1; } to { transform: scale(1.9); opacity: 0; } }",
    ".hg-mn-tile[data-dim] .hg-mn-back { opacity: .5; }",

    /* Plinko */
    ".hg-pl-wrap { position: relative; width: min(100%, 560px); margin: 0 auto; }",
    ".hg-pl-canvas { display: block; width: 100%; }",
    ".hg-pl-labels { position: absolute; left: 0; right: 0; height: 30px; pointer-events: none; }",
    ".hg-pl-bucket { --c: color-mix(in srgb, var(--hb-red) calc(var(--t, .5) * 100%), var(--hb-gold));",
    "  position: absolute; top: 0; display: grid; place-items: center; height: 28px; margin: 0 1px; box-sizing: border-box;",
    "  border-radius: 8px; font-size: 10.5px; font-weight: 900; color: black; overflow: hidden;",
    "  background: linear-gradient(180deg, color-mix(in srgb, var(--c) 55%, white) 0, var(--c) 48%, color-mix(in srgb, var(--c) 78%, black) 100%);",
    "  box-shadow: 0 4px 0 color-mix(in srgb, var(--c) 55%, black), inset 0 1px 0 rgb(255 255 255 / .7), 0 0 14px -2px var(--c), 0 8px 16px -6px var(--c); }",
    ".hg-pl-bucket::after { content: ''; position: absolute; left: 6%; right: 6%; top: 2px; height: 36%; border-radius: 6px 6px 10px 10px;",
    "  background: linear-gradient(180deg, rgb(255 255 255 / .55), rgb(255 255 255 / 0)); pointer-events: none; }",
    ".hg-pl-bucket[data-hit='1'] { animation: hg-bucket .35s ease; }",
    "@keyframes hg-bucket { 40% { transform: translateY(5px); box-shadow: 0 1px 0 color-mix(in srgb, var(--c) 60%, black), 0 0 22px var(--c); } }",

    /* Roulette */
    ".hg-rl-scene { position: relative; height: 330px; display: grid; place-items: center; }",
    ".hg-rl-plane { position: relative; width: 300px; height: 300px; }",
    ".hg-rl-shadow { position: absolute; left: 50%; top: 50%; width: 320px; height: 320px; transform: translate(-50%, -50%); border-radius: 50%;",
    "  background: radial-gradient(circle, rgb(0 0 0 / .32) 60%, transparent 72%); }",
    ".hg-rl-spin { --wood: color-mix(in srgb, var(--hb-orange) 38%, black); position: absolute; inset: 0; border-radius: 50%; will-change: transform;",
    "  box-shadow: 0 0 0 6px var(--wood), 0 0 0 8px var(--hb-gold), 0 8px 20px 8px rgb(0 0 0 / .3); }",
    ".hg-rl-wheel { width: 100%; height: 100%; display: block; border-radius: 50%; }",
    ".hg-rl-arm { position: absolute; left: 50%; top: 50%; width: 0; height: 0; will-change: transform; }",
    ".hg-rl-ball { position: absolute; left: 0; top: 0; width: 13px; height: 13px; margin-top: -6.5px; border-radius: 50%; will-change: transform;",
    "  background: radial-gradient(circle at 35% 30%, white, color-mix(in srgb, white 80%, var(--hb-ink)) 45%, color-mix(in srgb, var(--hb-ink) 55%, white)); box-shadow: 0 2px 4px rgb(0 0 0 / .5); }",
    ".hg-rl-result { position: absolute; right: 8px; top: 8px; display: grid; place-items: center; width: 56px; height: 56px; border-radius: 18px;",
    "  font-size: 24px; font-weight: 900; color: white; opacity: 0; transform: scale(.6); transition: opacity .3s, transform .4s cubic-bezier(.3,1.6,.5,1);",
    "  box-shadow: 0 10px 24px rgb(0 0 0 / .3), inset 0 1px 0 rgb(255 255 255 / .3); }",
    ".hg-rl-result[data-on='1'] { opacity: 1; transform: scale(1); }",
    ".hg-rl-result[data-c='red'], .hg-rl-pill[data-c='red'] { background: var(--hb-red); color: white; }",
    ".hg-rl-result[data-c='black'], .hg-rl-pill[data-c='black'] { background: var(--hb-black); color: white; box-shadow: inset 0 0 0 1px rgb(255 255 255 / .25); }",
    ".hg-rl-result[data-c='green'], .hg-rl-pill[data-c='green'] { background: var(--hb-green); color: white; }",
    ".hg-rl-table { display: grid; grid-template-columns: 1.1fr repeat(12, 1fr) 1.1fr; grid-template-rows: repeat(3, 34px) 30px 30px; gap: 3px;",
    "  padding: 10px; margin-top: 8px; border-radius: 18px; background: radial-gradient(120% 140% at 50% 0%, color-mix(in srgb, var(--hb-green) 62%, black), color-mix(in srgb, var(--hb-green) 38%, black));",
    "  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--hb-gold) 50%, transparent), inset 0 8px 24px rgb(0 0 0 / .3), 0 14px 30px -12px rgb(0 0 0 / .45); }",
    ".hg-rl-table[data-locked='1'] { pointer-events: none; }",
    ".hg-rl-cell { position: relative; font: inherit; font-size: 12px; font-weight: 800; color: white; cursor: pointer; border: 0; padding: 0; border-radius: 4px;",
    "  background: rgb(255 255 255 / .04); box-shadow: inset 0 0 0 1.5px white; transition: transform .1s ease, background .15s, filter .15s; }",
    ".hg-rl-cell:hover { background: rgb(255 255 255 / .2); }",
    ".hg-rl-cell[data-c='red'] { background: var(--hb-red); }",
    ".hg-rl-cell[data-c='black'] { background: color-mix(in srgb, var(--hb-black) 84%, white); box-shadow: inset 0 0 0 1px rgb(255 255 255 / .2); }",
    ".hg-rl-cell[data-c='red']:hover, .hg-rl-cell[data-c='black']:hover, .hg-rl-cell[data-c='green']:hover { filter: brightness(1.25); }",
    ".hg-rl-zero { grid-row: 1 / 4; grid-column: 1; }",
    ".hg-rl-cell[data-c='green'] { background: var(--hb-green); }",
    ".hg-rl-out { font-size: 11px; }",
    ".hg-rl-cell[data-win='1'] { box-shadow: inset 0 0 0 2px var(--hb-gold), 0 0 16px color-mix(in srgb, var(--hb-gold) 75%, transparent); z-index: 1; animation: hg-pop .35s ease; }",
    ".hg-rl-stack { position: absolute; right: -4px; top: -6px; z-index: 2; display: grid; place-items: center; min-width: 20px; height: 20px; padding: 0 3px;",
    "  border-radius: 50%; font-size: 9px; font-weight: 900; color: black; background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--hb-gold) 35%, white), var(--hb-gold) 55%, color-mix(in srgb, var(--hb-gold) 55%, black));",
    "  box-shadow: 0 0 0 2px white inset, 0 0 0 1px color-mix(in srgb, var(--hb-gold) 55%, black), 0 3px 6px rgb(0 0 0 / .45); animation: hg-pop .2s ease; }",
    ".hg-chips { display: flex; gap: 6px; flex-wrap: wrap; }",
    ".hg-chip { --chip: var(--hb-ink); width: 40px; height: 40px; border-radius: 50%; font-size: 11.5px; font-weight: 900; color: white;",
    "  background: radial-gradient(circle, var(--chip) 52%, transparent 53%), repeating-conic-gradient(var(--chip) 0 22.5deg, white 22.5deg 45deg);",
    "  box-shadow: 0 4px 0 rgb(0 0 0 / .3), 0 6px 14px rgb(0 0 0 / .3); text-shadow: 0 1px 2px rgb(0 0 0 / .6); }",
    ".hg-chip[data-v='1'] { --chip: color-mix(in srgb, var(--hb-ink) 55%, gray); } .hg-chip[data-v='5'] { --chip: var(--hb-red); } .hg-chip[data-v='25'] { --chip: var(--hb-green); }",
    ".hg-chip[data-v='100'] { --chip: var(--hb-black); } .hg-chip[data-v='500'] { --chip: color-mix(in srgb, var(--hb-blue) 60%, var(--hb-red)); }",
    ".hg-chip[data-on='1'] { transform: translateY(-4px); box-shadow: 0 8px 0 rgb(0 0 0 / .3), 0 0 0 3px var(--hb-gold), 0 10px 20px rgb(0 0 0 / .35); }",

    /* Blackjack */
    ".hg-bj-table { --cw: 74px; --ch: 106px; position: relative; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; min-height: 420px; padding: 18px 20px;",
    "  border-radius: 22px; overflow: hidden; background: radial-gradient(120% 130% at 50% 0%, color-mix(in srgb, var(--hb-green) 58%, black), color-mix(in srgb, var(--hb-green) 34%, black));",
    "  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--hb-gold) 50%, transparent), inset 0 10px 30px rgb(0 0 0 / .3), 0 14px 30px -12px rgb(0 0 0 / .45); }",
    ".hg-bj-row { display: flex; flex-direction: column; gap: 8px; align-items: center; }",
    ".hg-bj-tag { padding: 3px 12px; border-radius: 99px; font-size: 12px; font-weight: 800; color: white; background: rgb(0 0 0 / .32); font-variant-numeric: tabular-nums; }",
    ".hg-bj-cards { display: flex; justify-content: center; min-height: var(--ch); }",
    ".hg-bj-cards .hg-card + .hg-card { margin-left: -36px; }",
    ".hg-bj-msg { min-height: 26px; text-align: center; font-size: 15px; font-weight: 800; color: white; text-shadow: 0 2px 8px rgb(0 0 0 / .5); }",
    ".hg-bj-msg[data-kind='win'], .hg-bj-msg[data-kind='blackjack'] { color: var(--hb-gold); }",
    ".hg-bj-msg[data-kind='lose'] { color: color-mix(in srgb, var(--hb-red) 55%, white); }",
    ".hg-bj-shoe { position: absolute; right: 18px; top: 14px; width: 40px; height: 56px; border-radius: 7px; transform: rotate(6deg);",
    "  background: repeating-linear-gradient(45deg, var(--hb-acc) 0 5px, color-mix(in srgb, var(--hb-acc) 65%, black) 5px 10px);",
    "  box-shadow: 0 0 0 2px white inset, 3px 3px 0 rgb(0 0 0 / .25), 6px 6px 0 rgb(0 0 0 / .18); }",
    ".hg-card { position: relative; width: var(--cw); height: var(--ch); perspective: 700px; animation: hg-deal .42s cubic-bezier(.2,.9,.25,1) both; }",
    "@keyframes hg-deal { from { transform: translate(140px, -150px) rotate(14deg); opacity: 0; } }",
    ".hg-card-in { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .55s cubic-bezier(.3,1.3,.5,1); }",
    ".hg-card[data-down] .hg-card-in { transform: rotateY(180deg); }",
    ".hg-card-face, .hg-card-back { position: absolute; inset: 0; border-radius: 9px; backface-visibility: hidden; -webkit-backface-visibility: hidden;",
    "  box-shadow: 0 6px 14px rgb(0 0 0 / .35); }",
    ".hg-card-face { display: grid; place-items: center; color: black; background: linear-gradient(160deg, white, color-mix(in srgb, white 86%, var(--hb-bg)));",
    "  box-shadow: 0 6px 14px rgb(0 0 0 / .35), inset 0 0 0 1px rgb(0 0 0 / .12); }",
    ".hg-card[data-red='1'] .hg-card-face { color: var(--hb-red); }",
    ".hg-card-back { transform: rotateY(180deg); background: repeating-linear-gradient(45deg, var(--hb-acc) 0 6px, color-mix(in srgb, var(--hb-acc) 65%, black) 6px 12px);",
    "  box-shadow: 0 6px 14px rgb(0 0 0 / .35), inset 0 0 0 4px white; }",
    ".hg-card-idx { position: absolute; left: 7px; top: 5px; display: flex; flex-direction: column; align-items: center; line-height: 1; font-weight: 900; }",
    ".hg-card-idx b { font-size: 17px; } .hg-card-idx i { font-style: normal; font-size: 14px; margin-top: 1px; }",
    ".hg-card-idx--br { left: auto; top: auto; right: 7px; bottom: 5px; transform: rotate(180deg); }",
    ".hg-card-pip { font-size: 38px; line-height: 1; }",

    "@media (max-width: 520px) { .hg-bj-table { --cw: 60px; --ch: 86px; } .hg-bj-cards .hg-card + .hg-card { margin-left: -30px; } .hg-card-pip { font-size: 30px; } }",
    "@media (prefers-reduced-motion: reduce) { .hg-mn-inner, .hg-card-in { transition: none; } .hg-float, .hg-hist, .hg-rl-stack, .hg-card { animation: none; } }",
  ].join("\n");
})();
