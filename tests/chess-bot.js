// Run: node tests/chess-bot.js
var assert = require("assert");
var chess = require("../chess-engine.js");
var bot = require("../chess-bot.js");

function play(fen, moves) {
  var st = chess.fromFen(fen);
  moves.forEach(function (t) { st = chess.makeMove(st, chess.findMove(st, t)); });
  return st;
}
var START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Notation
var st = chess.start();
assert.strictEqual(chess.san(st, chess.findMove(st, "g1f3")), "Nf3");
assert.strictEqual(chess.san(st, chess.findMove(st, "e2e4")), "e4");
var mate = play(START, ["f2f3", "e7e5", "g2g4"]);
assert.strictEqual(chess.san(mate, chess.findMove(mate, "d8h4")), "Qh4#");
var cas = chess.fromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
assert.strictEqual(chess.san(cas, chess.findMove(cas, "e1g1")), "O-O");
assert.strictEqual(chess.san(cas, chess.findMove(cas, "e1c1")), "O-O-O");
var two = chess.fromFen("4k3/8/8/8/8/8/4K3/R6R w - - 0 1");
assert.strictEqual(chess.san(two, chess.findMove(two, "a1d1")), "Rad1");
var pro = chess.fromFen("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
assert.strictEqual(chess.san(pro, chess.findMove(pro, "a7a8q")), "a8=Q+");
var cap = play(START, ["e2e4", "d7d5"]);
assert.strictEqual(chess.san(cap, chess.findMove(cap, "e4d5")), "exd5");

// Threefold key ignores the move counters
assert.strictEqual(chess.positionKey(play(START, ["g1f3", "g8f6", "f3g1", "f6g8"])), chess.positionKey(chess.start()));

// Every bot from depth 2 up finds mate in one; no bot ever returns an illegal move
var m1 = chess.fromFen("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1");
bot.BOTS.forEach(function (b) {
  var mv = bot.botMove(m1, b, function () { return 0.5; });
  assert.ok(chess.findMove(m1, chess.moveName(mv)), b.id + " legal");
  if (b.depth >= 2) assert.strictEqual(chess.moveName(mv), "a1a8", b.id + " mate in one");
});

// The strong bot takes a hanging queen
var hang = chess.fromFen("4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1");
assert.strictEqual(chess.moveName(bot.botMove(hang, bot.botById("koning"))), "d1d5");

// Review: hanging the queen is a blunder, taking a free queen is the best move
var before = play(START, ["e2e4", "e7e5", "d1h5", "b8c6"]);
var blunder = bot.reviewMove(before, chess.findMove(before, "h5h7"));
assert.strictEqual(blunder.label, "blunder");
var good = bot.reviewMove(hang, chess.findMove(hang, "d1d5"));
assert.ok(["best", "great"].indexOf(good.label) >= 0, "free queen: " + good.label);
assert.ok(good.accuracy > 95);

// Walking into mate in one is a blunder
var fool = play(START, ["f2f3", "e7e5"]);
assert.strictEqual(bot.reviewMove(fool, chess.findMove(fool, "g2g4")).label, "blunder");

// Bot against bot ends or reaches 120 plies without an illegal move
var g = chess.start(), plies = 0, seed = 7;
function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
while (!chess.status(g) && plies < 120) {
  var mv2 = bot.botMove(g, bot.BOTS[plies % 2 ? 1 : 2], rnd);
  assert.ok(chess.findMove(g, chess.moveName(mv2)));
  g = chess.makeMove(g, mv2);
  plies++;
}
var t0 = Date.now();
bot.botMove(play(START, ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5"]), bot.botById("koning"), null, 5000);
console.log("ALL PASSED (" + plies + " plies bot game, koning middlegame move " + (Date.now() - t0) + " ms)");
