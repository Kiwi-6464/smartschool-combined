// Checks the pen upgrade tiers built in farm/data.js: caps up to 20, footprint grows, tiers hidden from the shop. node tests/farm-pens.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const win = {};
new Function("window", fs.readFileSync(path.join(__dirname, "..", "farm", "data.js"), "utf8"))(win);
const T = win.FARM_DATA.types;
for (const base of ["coop", "cowpen", "pigpen"]) {
  const t2 = T[T[base].next], t3 = T[t2.next];
  assert(t2 && t3 && !t3.next, base + ": two upgrade tiers, no third");
  assert.deepStrictEqual([t2.pen.cap, t3.pen.cap], [10, 20], base + " caps");
  assert(t2.w * t2.d > T[base].w * T[base].d && t3.w * t3.d > t2.w * t2.d, base + " footprint grows");
  assert(t3.pen.animal === T[base].pen.animal && t3.pen.out === T[base].pen.out, base + " keeps its animal and product");
  assert(t2.cat === "up" && t2.base === base, base + " tiers are hidden from the shop");
}
console.log("farm-pens: ok");
