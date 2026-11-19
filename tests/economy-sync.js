// Checks the coin sync rule from hub.js: an admin edit (newer adminSetAt) survives a page refresh.
// Runs the real code slice between two markers in hub.js against a fake server. node tests/economy-sync.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "..", "hub.js"), "utf8");
const a = src.indexOf("var ARCADE_KEY");
const b = src.indexOf("/* The farm spends the same coins");
assert(a > 0 && b > a, "markers not found in hub.js");
const slice = src.slice(a, b);

function run(local, server) {
  const store = { sscUserEconomy_u1: local };
  const db = { economies: { u1: server } };
  const chrome = { runtime: { lastError: null, sendMessage(msg, cb) {
    if (msg.type === "ssc:stateGet") return setTimeout(() => cb({ ok: true, state: db.economies.u1 || null }), 0);
    // mimic the rules: a non-admin may only echo the stored adminSetAt
    const cur = db.economies.u1 && db.economies.u1.adminSetAt ? db.economies.u1.adminSetAt : 0;
    if (msg.state.adminSetAt !== cur) return setTimeout(() => cb({ ok: false, error: "http", status: 401 }), 0);
    db.economies.u1 = Object.assign({}, msg.state); setTimeout(() => cb({ ok: true }), 0);
  } } };
  const make = new Function("chrome", "storageGet", "storageSet", "userKeySuffix",
    slice + "; return { loadArcade: loadArcade, saveArcade: saveArcade, get: function () { return arcade; }, set: function (c) { arcade.coins = c; } };");
  const api = make(chrome, (keys) => Promise.resolve(Object.fromEntries(keys.map((k) => [k, store[k]]))), (k, v) => { store[k] = v; }, () => Promise.resolve("u1"));
  return { api, db };
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // 1) admin lowered the coins on the server (newer adminSetAt) while this device has a newer updatedAt: server wins after refresh
  let t = run({ coins: 900, peak: 900, updatedAt: 5000, adminSetAt: 0 }, { coins: 50, peak: 900, updatedAt: 1000, adminSetAt: 9000 });
  await t.api.loadArcade(); await wait(20);
  assert.strictEqual(t.api.get().coins, 50, "admin value must win after refresh");
  assert.strictEqual(t.db.economies.u1.coins, 50, "server must keep the admin value");

  // 2) no admin edit: the newer device still wins (old behaviour kept)
  t = run({ coins: 900, peak: 900, updatedAt: 5000, adminSetAt: 0 }, { coins: 50, peak: 900, updatedAt: 1000 });
  await t.api.loadArcade(); await wait(20);
  assert.strictEqual(t.api.get().coins, 900, "device with newer updatedAt keeps its coins when no admin edit");

  // 3) admin edits while the page is open: the next save adopts it instead of overwriting it
  t = run({ coins: 900, peak: 900, updatedAt: 5000, adminSetAt: 0 }, { coins: 900, peak: 900, updatedAt: 5000, adminSetAt: 0 });
  await t.api.loadArcade(); await wait(20);
  t.db.economies.u1 = { coins: 7, peak: 900, updatedAt: 6000, adminSetAt: 8000 };
  t.api.set(950); t.api.saveArcade(); await wait(400);
  assert.strictEqual(t.api.get().coins, 7, "open page must adopt the admin value on its next save");
  assert.strictEqual(t.db.economies.u1.coins, 7, "server must keep the admin value");
  console.log("economy-sync: ok");
})().catch((e) => { console.error(e); process.exit(1); });
