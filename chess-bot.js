/*
 * Chess bots and game review. Own search (alpha-beta), no libraries, no DOM.
 * Needs chess-engine.js. Browser: window.sscChessBot, node: module.exports.
 * Scores are centipawns from the side to move.
 */
(function () {
  "use strict";

  var chess = typeof module !== "undefined" && module.exports ? require("./chess-engine.js") : window.sscChess;

  var VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
  var MATE = 100000;

  /* Piece-square tables, rank 8 first, from white's side. */
  var PST = {
    P: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
        0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
        -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
        -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    R: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
        -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
        0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    K: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
        -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    // King in the endgame: go to the centre.
    E: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
        -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50]
  };

  function evaluate(st) {
    var board = st.board, score = 0, heavy = 0, s, p;
    for (s = 0; s < 64; s++) {
      p = board[s];
      if (p && p !== "P" && p !== "p" && p !== "K" && p !== "k") heavy += VALUE[p.toUpperCase()];
    }
    var endgame = heavy <= 2600;
    for (s = 0; s < 64; s++) {
      p = board[s];
      if (!p) continue;
      var white = p === p.toUpperCase(), t = white ? p : p.toUpperCase();
      var r = s >> 3, f = s & 7;
      var idx = white ? (7 - r) * 8 + f : r * 8 + f;
      var v = VALUE[t] + (t === "K" && endgame ? PST.E : PST[t])[idx];
      score += white ? v : -v;
    }
    return st.turn === "w" ? score : -score;
  }

  function isCapture(st, m) { return !!st.board[m.to] || m.flags === "ep"; }

  // Captures first, biggest victim with the smallest attacker.
  function order(st, moves) {
    return moves.map(function (m) {
      var victim = st.board[m.to], key = 0;
      if (victim) key = 10 * VALUE[victim.toUpperCase()] - VALUE[st.board[m.from].toUpperCase()] + 10000;
      else if (m.flags === "ep") key = 10900;
      if (m.promo) key += VALUE[m.promo];
      return { m: m, key: key };
    }).sort(function (a, b) { return b.key - a.key; }).map(function (x) { return x.m; });
  }

  function Search(limitMs) {
    this.deadline = limitMs ? Date.now() + limitMs : 0;
    this.nodes = 0;
    this.stopped = false;
  }

  Search.prototype.tick = function () {
    this.nodes++;
    if (this.deadline && (this.nodes & 1023) === 0 && Date.now() > this.deadline) this.stopped = true;
  };

  // Only captures, until the position is quiet: stops the search from ending mid-exchange.
  Search.prototype.quiesce = function (st, alpha, beta, depth) {
    this.tick();
    var stand = evaluate(st);
    if (stand >= beta || depth === 0) return stand;
    if (stand > alpha) alpha = stand;
    var moves = order(st, chess.legalMoves(st).filter(function (m) { return isCapture(st, m) || m.promo; }));
    for (var i = 0; i < moves.length && !this.stopped; i++) {
      var score = -this.quiesce(chess.makeMove(st, moves[i]), -beta, -alpha, depth - 1);
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };

  Search.prototype.negamax = function (st, depth, alpha, beta, ply) {
    if (depth <= 0) {
      // In check at the horizon: look one ply further, or a mate in one is scored as a normal position.
      if (ply < 12 && chess.inCheck(st, st.turn)) depth = 1;
      else return this.quiesce(st, alpha, beta, 4);
    }
    this.tick();
    var moves = chess.legalMoves(st);
    if (!moves.length) return chess.inCheck(st, st.turn) ? -MATE + ply : 0;
    if (st.halfmove >= 100) return 0;
    moves = order(st, moves);
    for (var i = 0; i < moves.length && !this.stopped; i++) {
      var score = -this.negamax(chess.makeMove(st, moves[i]), depth - 1, -beta, -alpha, ply + 1);
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };

  /*
   * Score of every legal move, best first: [{ move, score }].
   * margin: moves more than `margin` below the best only get an upper bound (faster);
   * leave it out for exact scores of all moves.
   */
  Search.prototype.rootScores = function (st, depth, margin) {
    var moves = order(st, chess.legalMoves(st)), out = [], best = -Infinity;
    for (var i = 0; i < moves.length && !this.stopped; i++) {
      var floor = margin === undefined || best === -Infinity ? -Infinity : best - margin - 1;
      var score = -this.negamax(chess.makeMove(st, moves[i]), depth - 1, -Infinity, -floor, 1);
      if (score > best) best = score;
      out.push({ move: moves[i], score: score });
    }
    return out.sort(function (a, b) { return b.score - a.score; });
  };

  /* ---------- bots ---------- */

  // level: label only, an estimate. It is not an Elo and never changes a rating.
  var BOTS = [
    { id: "pion", name: "Lotte", level: 400, depth: 1, noise: 260, text: "Speelt pas een week. Geeft graag stukken weg." },
    { id: "toren", name: "Milan", level: 600, depth: 1, noise: 120, text: "Slaat alles wat los staat, kijkt niet verder." },
    { id: "loper", name: "Noor", level: 800, depth: 2, noise: 90, text: "Denkt een zet vooruit, maar vergist zich nog." },
    { id: "paard", name: "Jef", level: 1000, depth: 2, noise: 35, text: "Schaakt elke middagpauze. Solide, mist diepe trucs." },
    { id: "dame", name: "Amira", level: 1200, depth: 3, noise: 12, text: "Clubspeelster. Straft elke blunder af." },
    { id: "koning", name: "Viktor", level: 1400, depth: 4, noise: 0, text: "De sterkste van de klas. Geeft niets cadeau." }
  ];

  function botById(id) {
    for (var i = 0; i < BOTS.length; i++) if (BOTS[i].id === id) return BOTS[i];
    return BOTS[0];
  }

  // The bot's move. Deepens step by step and keeps the last finished depth when time runs out.
  function botMove(st, bot, random, limitMs) {
    random = random || Math.random;
    var search = new Search(limitMs || 1500), scores = null;
    for (var d = 1; d <= bot.depth; d++) {
      var res = search.rootScores(st, d, bot.noise * 2);
      if (search.stopped) break;
      scores = res;
    }
    if (!scores || !scores.length) {
      var legal = chess.legalMoves(st);
      return legal.length ? legal[0] : null;
    }
    var pick = null, top = -Infinity;
    scores.forEach(function (s) {
      var v = s.score + (random() * 2 - 1) * bot.noise;
      if (v > top) { top = v; pick = s.move; }
    });
    return pick;
  }

  /* ---------- review ---------- */

  var LABELS = {
    brilliant: "Briljant", great: "Geweldig", best: "Beste zet", excellent: "Uitstekend", good: "Goed",
    inaccuracy: "Onnauwkeurig", mistake: "Fout", blunder: "Blunder"
  };

  // Centipawns to the chance of winning, 0..1.
  function winChance(cp) {
    if (cp > MATE / 2) return 1;
    if (cp < -MATE / 2) return 0;
    return 1 / (1 + Math.exp(-0.00368 * cp));
  }

  // The moved piece can be taken for less than it is worth, and did not win more than that itself.
  function isSacrifice(st, m) {
    var piece = st.board[m.from].toUpperCase();
    if (piece === "P" || piece === "K" || m.promo) return false;
    var won = st.board[m.to] ? VALUE[st.board[m.to].toUpperCase()] : 0;
    if (won >= VALUE[piece]) return false;
    var next = chess.makeMove(st, m);
    var takers = chess.legalMoves(next).filter(function (o) { return o.to === m.to; });
    if (!takers.length) return false;
    var cheapest = Math.min.apply(null, takers.map(function (o) { return VALUE[next.board[o.from].toUpperCase()] || 1000; }));
    var defended = chess.attacked(next.board, m.to, st.turn);
    return !defended || cheapest < VALUE[piece] - 50;
  }

  /*
   * Judge one played move. Returns { label, loss, best, bestSan, scoreBefore, scoreAfter, accuracy }.
   * shortcut: depth-2 own search, far weaker than a real engine; labels are indicative.
   */
  function reviewMove(st, m, depth) {
    var scores = new Search(0).rootScores(st, depth || 2);
    var best = scores[0], played = best, second = scores[1];
    for (var i = 0; i < scores.length; i++) {
      var o = scores[i].move;
      if (o.from === m.from && o.to === m.to && (o.promo || null) === (m.promo || null)) { played = scores[i]; break; }
    }
    var loss = Math.max(0, winChance(best.score) - winChance(played.score));
    var isBest = played === best || loss <= 0.005;
    var label;
    if (loss > 0.2) label = "blunder";
    else if (loss > 0.1) label = "mistake";
    else if (loss > 0.05) label = "inaccuracy";
    else if (loss > 0.02) label = "good";
    else if (!isBest) label = "excellent";
    else label = "best";
    if (loss <= 0.02 && winChance(played.score) >= 0.5 && winChance(best.score) < 0.97 && isSacrifice(st, m)) label = "brilliant";
    else if (isBest && second && winChance(best.score) - winChance(second.score) > 0.2 &&
             winChance(best.score) > 0.35 && winChance(best.score) < 0.97) label = "great";
    var accuracy = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss * 100) - 3.1669));
    return {
      label: label, text: LABELS[label], loss: loss, best: best.move, bestSan: chess.san(st, best.move),
      scoreBefore: best.score, scoreAfter: played.score, accuracy: accuracy
    };
  }

  var api = {
    BOTS: BOTS, botById: botById, botMove: botMove, evaluate: evaluate, reviewMove: reviewMove,
    winChance: winChance, LABELS: LABELS, Search: Search, MATE: MATE
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.sscChessBot = api;
})();
