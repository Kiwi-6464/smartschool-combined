// Checks the guess-the-grade payout and the random style picker from cutscene-styles.js. node tests/guess-pack.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "..", "cutscene-styles.js"), "utf8").split(String.fromCharCode(13)).join("");
const cut = (from, to) => { const a = src.indexOf(from), b = src.indexOf(to); assert(a > 0 && b > a, "marker " + from); return src.slice(a, b); };

const payout = cut("var GUESS_PAYOUT", "function giveCoins");
const picker = cut("var REAL_STYLES", "function rememberStyle") + cut("/** A different style than the last time. */", "/*\n   * Guess the grade");
const api = new Function("window", payout + "; return { guessReward: guessReward };")({});
assert.strictEqual(api.guessReward(15, 15, 20), 500, "exact guess");
assert.strictEqual(api.guessReward(14.5, 15, 20), 120, "2.5% off");
assert.strictEqual(api.guessReward(13, 15, 20), 60, "10% off");
assert.strictEqual(api.guessReward(10, 15, 20), 0, "25% off pays nothing");

const rnd = new Function("window", picker + "; return { pick: pickRandomStyle };")({ sscPlayCutsceneTunnel() {} });
let last = "";
for (let i = 0; i < 300; i++) { const s = rnd.pick(); assert.notStrictEqual(s, last, "never the same style twice in a row"); last = s; }
console.log("guess-pack: ok");
