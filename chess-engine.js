/*
 * Chess rules engine. Pure functions, no DOM, no libraries.
 * Board: 64 entries, index = rank * 8 + file (a1 = 0, h8 = 63).
 * Piece: uppercase = white ("K","Q","R","B","N","P"), lowercase = black, null = empty.
 * Works in the browser (window.sscChess) and in node (module.exports).
 */
(function () {
  "use strict";

  var FILES = "abcdefgh";
  var KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  var KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  var DIAG = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  var ORTHO = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  var PROMO = ["Q", "R", "B", "N"];

  function sq(file, rank) { return rank * 8 + file; }
  function fileOf(s) { return s % 8; }
  function rankOf(s) { return Math.floor(s / 8); }
  function inside(f, r) { return f >= 0 && f < 8 && r >= 0 && r < 8; }
  function isWhite(p) { return !!p && p === p.toUpperCase(); }
  function isBlack(p) { return !!p && p === p.toLowerCase(); }
  function colorOf(p) { return isWhite(p) ? "w" : "b"; }
  function squareName(s) { return FILES[fileOf(s)] + (rankOf(s) + 1); }
  function squareIndex(name) {
    if (!name || name.length !== 2) return -1;
    var f = FILES.indexOf(name[0]);
    var r = parseInt(name[1], 10) - 1;
    return f < 0 || isNaN(r) ? -1 : sq(f, r);
  }

  /* ---------- FEN ---------- */

  function fromFen(fen) {
    var parts = fen.trim().split(/\s+/);
    var board = new Array(64).fill(null);
    var rows = parts[0].split("/");
    for (var r = 0; r < 8; r++) {
      var f = 0;
      for (var i = 0; i < rows[7 - r].length; i++) {
        var c = rows[7 - r][i];
        if (c >= "1" && c <= "8") f += +c;
        else { board[sq(f, r)] = c; f++; }
      }
    }
    var cast = parts[2] || "-";
    return {
      board: board,
      turn: parts[1] === "b" ? "b" : "w",
      castling: { K: cast.indexOf("K") >= 0, Q: cast.indexOf("Q") >= 0,
                  k: cast.indexOf("k") >= 0, q: cast.indexOf("q") >= 0 },
      ep: squareIndex(parts[3] || "-"),
      halfmove: parseInt(parts[4] || "0", 10),
      fullmove: parseInt(parts[5] || "1", 10)
    };
  }

  function toFen(st) {
    var rows = [];
    for (var r = 7; r >= 0; r--) {
      var row = "", empty = 0;
      for (var f = 0; f < 8; f++) {
        var p = st.board[sq(f, r)];
        if (!p) { empty++; continue; }
        if (empty) { row += empty; empty = 0; }
        row += p;
      }
      if (empty) row += empty;
      rows.push(row);
    }
    var c = st.castling;
    var cast = (c.K ? "K" : "") + (c.Q ? "Q" : "") + (c.k ? "k" : "") + (c.q ? "q" : "");
    return [rows.join("/"), st.turn, cast || "-", st.ep >= 0 ? squareName(st.ep) : "-",
            st.halfmove, st.fullmove].join(" ");
  }

  function start() {
    return fromFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  }

  /* ---------- attacks ---------- */

  // Is square s attacked by any piece of color `by` ("w" or "b")?
  function attacked(board, s, by) {
    var f = fileOf(s), r = rankOf(s);
    var pawnRank = by === "w" ? r - 1 : r + 1;
    var pawn = by === "w" ? "P" : "p";
    for (var df = -1; df <= 1; df += 2) {
      if (inside(f + df, pawnRank) && board[sq(f + df, pawnRank)] === pawn) return true;
    }
    var knight = by === "w" ? "N" : "n";
    for (var i = 0; i < 8; i++) {
      var nf = f + KNIGHT[i][0], nr = r + KNIGHT[i][1];
      if (inside(nf, nr) && board[sq(nf, nr)] === knight) return true;
    }
    var king = by === "w" ? "K" : "k";
    for (var j = 0; j < 8; j++) {
      var kf = f + KING[j][0], kr = r + KING[j][1];
      if (inside(kf, kr) && board[sq(kf, kr)] === king) return true;
    }
    var rook = by === "w" ? "R" : "r", bishop = by === "w" ? "B" : "b", queen = by === "w" ? "Q" : "q";
    return slides(board, f, r, ORTHO, rook, queen) || slides(board, f, r, DIAG, bishop, queen);
  }

  function slides(board, f, r, dirs, a, b) {
    for (var d = 0; d < dirs.length; d++) {
      var x = f + dirs[d][0], y = r + dirs[d][1];
      while (inside(x, y)) {
        var p = board[sq(x, y)];
        if (p) { if (p === a || p === b) return true; break; }
        x += dirs[d][0]; y += dirs[d][1];
      }
    }
    return false;
  }

  function findKing(board, color) {
    var k = color === "w" ? "K" : "k";
    for (var s = 0; s < 64; s++) if (board[s] === k) return s;
    return -1;
  }

  function inCheck(st, color) {
    var k = findKing(st.board, color);
    return k >= 0 && attacked(st.board, k, color === "w" ? "b" : "w");
  }

  /* ---------- move generation ---------- */

  // Pseudo-legal moves: may leave own king in check.
  function pseudo(st) {
    var moves = [], board = st.board, us = st.turn, them = us === "w" ? "b" : "w";
    for (var s = 0; s < 64; s++) {
      var p = board[s];
      if (!p || colorOf(p) !== us) continue;
      var f = fileOf(s), r = rankOf(s), type = p.toUpperCase();
      if (type === "P") pawnMoves(st, s, f, r, us, them, moves);
      else if (type === "N") stepMoves(board, s, f, r, KNIGHT, us, moves);
      else if (type === "K") {
        stepMoves(board, s, f, r, KING, us, moves);
        castleMoves(st, s, us, them, moves);
      }
      else if (type === "B") slideMoves(board, s, f, r, DIAG, us, moves);
      else if (type === "R") slideMoves(board, s, f, r, ORTHO, us, moves);
      else if (type === "Q") { slideMoves(board, s, f, r, DIAG, us, moves); slideMoves(board, s, f, r, ORTHO, us, moves); }
    }
    return moves;
  }

  function pawnMoves(st, s, f, r, us, them, moves) {
    var board = st.board, dir = us === "w" ? 1 : -1;
    var startRank = us === "w" ? 1 : 6, lastRank = us === "w" ? 7 : 0;
    var one = sq(f, r + dir);
    if (inside(f, r + dir) && !board[one]) {
      addPawn(moves, s, one, lastRank);
      var two = sq(f, r + 2 * dir);
      if (r === startRank && !board[two]) moves.push({ from: s, to: two, promo: null, flags: "double" });
    }
    for (var df = -1; df <= 1; df += 2) {
      if (!inside(f + df, r + dir)) continue;
      var t = sq(f + df, r + dir), target = board[t];
      if (target && colorOf(target) === them) addPawn(moves, s, t, lastRank);
      else if (!target && t === st.ep) moves.push({ from: s, to: t, promo: null, flags: "ep" });
    }
  }

  function addPawn(moves, from, to, lastRank) {
    if (rankOf(to) === lastRank) {
      for (var i = 0; i < PROMO.length; i++) moves.push({ from: from, to: to, promo: PROMO[i], flags: "promo" });
    } else moves.push({ from: from, to: to, promo: null, flags: "" });
  }

  function stepMoves(board, s, f, r, offs, us, moves) {
    for (var i = 0; i < offs.length; i++) {
      var x = f + offs[i][0], y = r + offs[i][1];
      if (!inside(x, y)) continue;
      var t = sq(x, y), target = board[t];
      if (!target || colorOf(target) !== us) moves.push({ from: s, to: t, promo: null, flags: "" });
    }
  }

  function slideMoves(board, s, f, r, dirs, us, moves) {
    for (var d = 0; d < dirs.length; d++) {
      var x = f + dirs[d][0], y = r + dirs[d][1];
      while (inside(x, y)) {
        var t = sq(x, y), target = board[t];
        if (!target) moves.push({ from: s, to: t, promo: null, flags: "" });
        else { if (colorOf(target) !== us) moves.push({ from: s, to: t, promo: null, flags: "" }); break; }
        x += dirs[d][0]; y += dirs[d][1];
      }
    }
  }

  // Castling: rights, empty path, rook present, and no attacked square on the king's path.
  function castleMoves(st, s, us, them, moves) {
    var board = st.board, home = us === "w" ? 4 : 60;
    if (s !== home || attacked(board, s, them)) return;
    var c = st.castling, k = us === "w" ? "K" : "k", q = us === "w" ? "Q" : "q";
    var rook = us === "w" ? "R" : "r", base = home;
    if (c[k] && board[base + 1] === null && board[base + 2] === null && board[base + 3] === rook &&
        !attacked(board, base + 1, them) && !attacked(board, base + 2, them)) {
      moves.push({ from: s, to: base + 2, promo: null, flags: "castle" });
    }
    if (c[q] && board[base - 1] === null && board[base - 2] === null && board[base - 3] === null &&
        board[base - 4] === rook && !attacked(board, base - 1, them) && !attacked(board, base - 2, them)) {
      moves.push({ from: s, to: base - 2, promo: null, flags: "castle" });
    }
  }

  /* ---------- make / legal ---------- */

  function makeMove(st, m) {
    var board = st.board.slice(), us = st.turn, p = board[m.from];
    var captured = board[m.to];
    board[m.from] = null;
    if (m.flags === "ep") board[m.to - (us === "w" ? 8 : -8)] = null;
    board[m.to] = m.promo ? (us === "w" ? m.promo : m.promo.toLowerCase()) : p;
    if (m.flags === "castle") {
      var r0 = m.to > m.from ? m.from + 3 : m.from - 4;
      var r1 = m.to > m.from ? m.from + 1 : m.from - 1;
      board[r1] = board[r0];
      board[r0] = null;
    }
    var c = { K: st.castling.K, Q: st.castling.Q, k: st.castling.k, q: st.castling.q };
    if (p === "K") { c.K = false; c.Q = false; }
    if (p === "k") { c.k = false; c.q = false; }
    [[0, "Q"], [7, "K"], [56, "q"], [63, "k"]].forEach(function (pair) {
      if (m.from === pair[0] || m.to === pair[0]) c[pair[1]] = false;
    });
    var double = m.flags === "double";
    var halfmove = (p.toUpperCase() === "P" || captured || m.flags === "ep") ? 0 : st.halfmove + 1;
    return {
      board: board,
      turn: us === "w" ? "b" : "w",
      castling: c,
      ep: double ? (m.from + m.to) / 2 : -1,
      halfmove: halfmove,
      fullmove: us === "b" ? st.fullmove + 1 : st.fullmove
    };
  }

  // Legal moves: pseudo-legal moves that do not leave own king in check.
  function legalMoves(st) {
    var out = [];
    var all = pseudo(st);
    for (var i = 0; i < all.length; i++) {
      var next = makeMove(st, all[i]);
      if (!inCheck(next, st.turn)) out.push(all[i]);
    }
    return out;
  }

  // "checkmate", "stalemate", "draw50", "draw" (insufficient material), or null.
  function status(st) {
    var moves = legalMoves(st);
    if (moves.length === 0) return inCheck(st, st.turn) ? "checkmate" : "stalemate";
    if (st.halfmove >= 100) return "draw50";
    if (insufficient(st.board)) return "draw";
    return null;
  }

  function insufficient(board) {
    var minors = 0;
    for (var s = 0; s < 64; s++) {
      var p = board[s];
      if (!p) continue;
      var t = p.toUpperCase();
      if (t === "P" || t === "R" || t === "Q") return false;
      if (t === "N" || t === "B") minors++;
    }
    return minors <= 1;
  }

  function moveName(m) {
    return squareName(m.from) + squareName(m.to) + (m.promo ? m.promo.toLowerCase() : "");
  }

  // Parse "e2e4" or "e7e8q" against the legal moves of st.
  function findMove(st, text) {
    var from = squareIndex(text.slice(0, 2)), to = squareIndex(text.slice(2, 4));
    var promo = text.length === 5 ? text[4].toUpperCase() : null;
    var list = legalMoves(st);
    for (var i = 0; i < list.length; i++) {
      if (list[i].from === from && list[i].to === to && (list[i].promo || null) === promo) return list[i];
    }
    return null;
  }

  // Standard notation ("Nf3", "exd5", "O-O", "e8=Q+", "Qh7#") for a legal move of st.
  function san(st, m) {
    var p = st.board[m.from].toUpperCase(), out;
    if (m.flags === "castle") out = m.to > m.from ? "O-O" : "O-O-O";
    else {
      var capture = !!st.board[m.to] || m.flags === "ep";
      if (p === "P") out = (capture ? FILES[fileOf(m.from)] + "x" : "") + squareName(m.to);
      else {
        // Another piece of the same kind that can also go there: add file, rank or both.
        var others = legalMoves(st).filter(function (o) {
          return o.to === m.to && o.from !== m.from && st.board[o.from] === st.board[m.from];
        });
        var dis = "";
        if (others.length) {
          var sameFile = others.some(function (o) { return fileOf(o.from) === fileOf(m.from); });
          var sameRank = others.some(function (o) { return rankOf(o.from) === rankOf(m.from); });
          dis = !sameFile ? FILES[fileOf(m.from)] : !sameRank ? String(rankOf(m.from) + 1) : squareName(m.from);
        }
        out = p + dis + (capture ? "x" : "") + squareName(m.to);
      }
      if (m.promo) out += "=" + m.promo;
    }
    var next = makeMove(st, m);
    if (inCheck(next, next.turn)) out += legalMoves(next).length ? "+" : "#";
    return out;
  }

  // Same key = same position for the threefold rule (pieces, turn, castling, en passant).
  function positionKey(st) {
    return toFen(st).split(" ").slice(0, 4).join(" ");
  }

  function perft(st, depth) {
    if (depth === 0) return 1;
    var moves = legalMoves(st), n = 0;
    for (var i = 0; i < moves.length; i++) n += perft(makeMove(st, moves[i]), depth - 1);
    return n;
  }

  var api = {
    start: start, fromFen: fromFen, toFen: toFen, legalMoves: legalMoves, makeMove: makeMove,
    inCheck: inCheck, status: status, findMove: findMove, moveName: moveName,
    squareName: squareName, squareIndex: squareIndex, perft: perft,
    san: san, positionKey: positionKey, attacked: attacked, insufficient: insufficient
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else window.sscChess = api;
})();
