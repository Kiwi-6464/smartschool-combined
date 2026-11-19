// Proves every Neon Dash level can be finished: a search over all press/release timings. node tests/geometry.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const win = { sscHubGames: {} };
new Function("window", "document", fs.readFileSync(path.join(__dirname, "..", "hub-geometry.js"), "utf8"))(win, {});
const T = win.sscHubGames.geometryTest;
const levels = T.build();
// the engine itself: standing still on the ground never kills, a lone spike does
const s = T.newState(levels[0]);
for (let i = 0; i < 120; i++) T.step(s, levels[0], false);
assert(!s.dead && s.grounded, "idle on the floor is safe");
levels.forEach((lv, i) => {
  const t0 = Date.now(), r = T.solve(lv);
  console.log(`level ${i + 1} ${lv.name}: ${r.ok ? "haalbaar in " + r.seconds.toFixed(1) + " s" : "ONHAALBAAR, verst x=" + r.x.toFixed(1) + " van " + lv.end} (${Date.now() - t0} ms)`);
  assert(r.ok, "level " + (i + 1) + " must be beatable");
});
// a bot that never presses must die in every level (the levels are not trivial)
levels.forEach((lv, i) => { const st = T.newState(lv); let n = 0; while (!st.dead && !st.won && n++ < 100000) T.step(st, lv, false); assert(st.dead, "level " + (i + 1) + " is not a walk"); });
console.log("geometry: ok");
