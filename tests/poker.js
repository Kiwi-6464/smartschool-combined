// Poker engine: hand ranking, side pots, a full table of bots, chip conservation. node tests/poker.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const win = { sscHubGames: {}, crypto: require("crypto").webcrypto };
new Function("window", "document", fs.readFileSync(path.join(__dirname, "..", "hub-poker.js"), "utf8"))(win, {});
const P = win.sscHubGames.pokerTest;
const c = (s) => s.split(" ").map((x) => ({ r: "23456789TJQKA".indexOf(x[0]) + 2, s: "shdc".indexOf(x[1]) }));
const sc = (s) => P.best7(c(s));
// category order
const order = ["As Kd 9c 5h 2d", "As Ad 9c 5h 2d", "As Ad 9c 9h 2d", "As Ad Ac 5h 2d", "5s 4d 3c 2h Ad", "As Ks 9s 5s 2s", "As Ad Ac 5h 5d", "As Ad Ac Ah 2d", "5s 4s 3s 2s As"].map(sc);
for (let i = 1; i < order.length; i++) assert(order[i] > order[i - 1], "category " + i);
assert.strictEqual(P.handName(sc("As Ks Qs Js Ts")), "Royal flush");
assert.strictEqual(P.handName(sc("5s 4s 3s 2s As")), "Straight flush");
assert(sc("6s 5d 4c 3h 2d") > sc("5s 4d 3c 2h Ad"), "wheel is the lowest straight");
assert(sc("As Ad Kc 5h 2d") > sc("As Ad Qc 5h 2d"), "kicker decides");
assert(sc("Ks Kd Ac Ah 2d") > sc("Qs Qd Ac Ah 2d"), "two pair: higher pair");
assert(sc("2s 2d 2c 3h 3d") < sc("3s 3d 3c 2h 2d"), "full house: trips rank first");
// the best five out of seven
assert.strictEqual(P.handName(sc("As Ad 2c 2h 9d 9s Kc")), "Twee paar");
assert.strictEqual(P.handName(sc("2s 3s 4s 8s 9d Kc Qh")), "Hoge kaart");
// side pots: A all-in 50, B all-in 100, C 100 and D folded after 30
const pots = P.sidePots([{ total: 50, folded: false }, { total: 100, folded: false }, { total: 100, folded: false }, { total: 30, folded: true }]);
assert.deepStrictEqual(pots.map((p) => p.amount), [120, 60, 100], "levels 30 / 50 / 100");
assert.deepStrictEqual(pots[2].elig, [1, 2], "A cannot win the side pot");
assert.strictEqual(pots.reduce((a, p) => a + p.amount, 0), 280);
// play 300 hands with random legal actions: chips are conserved, no deadlock
let hands = 0;
for (let g = 0; g < 40; g++) {
  const T = new P.Table({ sb: 5, bb: 10, seats: [100, 300, 700, 50].map((s, i) => ({ name: "p" + i, stack: s })) });
  const total = 1150;
  for (let hnd = 0; hnd < 12; hnd++) {
    if (!T.start()) break;
    hands++;
    let guard = 0;
    while (T.stage !== "done") {
      assert(guard++ < 200, "no deadlock");
      if (T.cur === -1) { T.proceed(); continue; }
      const L = T.legal(), r = Math.random();
      if (r < 0.15) T.act("fold"); else if (r < 0.7) T.act("call"); else T.act("raise", L.minTo + Math.floor(Math.random() * (L.maxTo - L.minTo + 1)));
    }
    assert.strictEqual(T.p.reduce((a, p) => a + p.stack, 0), total, "chips are conserved");
    T.p.forEach((p) => assert(p.stack >= 0 && Number.isInteger(p.stack), "integer, never negative"));
  }
}
// the AI folds trash against a big bet and raises/keeps strong hands
const T2 = new P.Table({ sb: 5, bb: 10, seats: [0, 1, 2].map((i) => ({ name: "b" + i, stack: 1000 })) });
T2.start();
T2.p[T2.cur].hole = c("As Ah"); T2.curBet = 10; 
const strong = P.decide(T2, T2.cur, P.PERSONAS[2]);
assert(strong.a !== "fold", "aces do not fold");
const eqAA = P.equity(c("As Ah"), [], 1, 400), eq72 = P.equity(c("7c 2d"), [], 1, 400);
assert(eqAA > 0.78 && eq72 < 0.42, "equity: " + eqAA + " vs " + eq72);
console.log("poker: ok (" + hands + " hands simulated)");
