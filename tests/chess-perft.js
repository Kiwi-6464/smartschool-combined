// Run: node tests/chess-perft.js
// Known perft values from the chess programming wiki; any mismatch means the move generator is wrong.
var assert = require("assert");
var chess = require("../chess-engine.js");

var CASES = [
  { name: "start", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", counts: [20, 400, 8902] },
  { name: "kiwipete", fen: "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", counts: [48, 2039, 97862] },
  { name: "position 3", fen: "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", counts: [14, 191, 2812] },
  { name: "position 4", fen: "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", counts: [6, 264, 9467] }
];

var failures = 0;
CASES.forEach(function (c) {
  var st = chess.fromFen(c.fen);
  c.counts.forEach(function (want, i) {
    var got = chess.perft(st, i + 1);
    try { assert.strictEqual(got, want); console.log("ok   " + c.name + " depth " + (i + 1) + " = " + got); }
    catch (e) { failures++; console.log("FAIL " + c.name + " depth " + (i + 1) + ": got " + got + ", want " + want); }
  });
});

// Round trip FEN and a few rules checks.
var s = chess.start();
assert.strictEqual(chess.toFen(s), "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
assert.strictEqual(chess.status(chess.fromFen("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1")), "checkmate");
assert.strictEqual(chess.status(chess.fromFen("7k/5Q2/5K2/8/8/8/8/8 b - - 0 1")), "stalemate");
assert.strictEqual(chess.findMove(chess.fromFen("4k3/P7/8/8/8/8/8/4K3 w - - 0 1"), "a7a8q").promo, "Q");
console.log(failures === 0 ? "\nALL PASSED" : "\n" + failures + " FAILED");
process.exit(failures ? 1 : 0);
