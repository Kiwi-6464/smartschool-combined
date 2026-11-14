/* Prices assume the arcade economy: players start with 1000 coins and can refill to 1000 for free,
   so anything worth wanting costs more than that and has to be won in the arcade. */
/* Farm game balance + content. Everything tunable lives here. Times in seconds, prices in coins. */
window.FARM_DATA = (function () {
  const items = {
    // s = storage (silo for crops, barn for the rest), xp = XP when harvested/collected
    wheat: { n: "Tarwe", s: "silo", xp: 1 }, corn: { n: "Maïs", s: "silo", xp: 2 }, carrot: { n: "Wortel", s: "silo", xp: 3 },
    turnip: { n: "Radijs", s: "silo", xp: 4 }, pumpkin: { n: "Pompoen", s: "silo", xp: 5 }, melon: { n: "Watermeloen", s: "silo", xp: 6 },
    egg: { n: "Ei", s: "barn", xp: 2 }, milk: { n: "Melk", s: "barn", xp: 3 }, bacon: { n: "Spek", s: "barn", xp: 5 },
    feed_chick: { n: "Kippenvoer", s: "barn", xp: 1, feed: 1 }, feed_cow: { n: "Koeienvoer", s: "barn", xp: 1, feed: 1 }, feed_pig: { n: "Varkensvoer", s: "barn", xp: 1, feed: 1 },
    bread: { n: "Brood", s: "barn", xp: 5 }, cookie: { n: "Koekje", s: "barn", xp: 9 }, croissant: { n: "Croissant", s: "barn", xp: 14 },
    pie: { n: "Pompoentaart", s: "barn", xp: 22 }, cake: { n: "Taart", s: "barn", xp: 34 },
    cream: { n: "Room", s: "barn", xp: 7 }, butter: { n: "Boter", s: "barn", xp: 11 }, cheese: { n: "Kaas", s: "barn", xp: 17 },
    bacon_eggs: { n: "Spek met eieren", s: "barn", xp: 16 }, pancakes: { n: "Pannenkoeken", s: "barn", xp: 15 }, burger: { n: "Hamburger", s: "barn", xp: 36 }, pizza: { n: "Pizza", s: "barn", xp: 40 },
    juice_carrot: { n: "Wortelsap", s: "barn", xp: 12 }, soup: { n: "Soep", s: "barn", xp: 20 }, juice_melon: { n: "Meloensap", s: "barn", xp: 16 },
  };
  // seed = coin price of one seed when the silo has none; a harvest always gives 2
  const crops = {
    wheat: { lvl: 1, t: 60, seed: 5 }, corn: { lvl: 2, t: 180, seed: 8 }, carrot: { lvl: 3, t: 360, seed: 12 },
    turnip: { lvl: 5, t: 600, seed: 16 }, pumpkin: { lvl: 7, t: 1200, seed: 24 }, melon: { lvl: 9, t: 1800, seed: 32 },
  };
  const deco = (n, spr, cost, lvl, w) => ({ n, spr: "deco_" + spr, cost, lvl: lvl || 1, w: w || 1, d: w || 1, cat: "deco", kind: "deco" });
  const types = {
    field: { n: "Akker", spr: "soil", w: 1, d: 1, cost: 100, lvl: 1, cat: "farm", kind: "field", short: "Zaai en oogst gewassen" },
    path: { n: "Pad", w: 1, d: 1, cost: 10, lvl: 1, cat: "deco", kind: "path", short: "Leg een weg aan" },
    coop: { n: "Kippenhok", spr: "coop", w: 3, d: 3, cost: 800, lvl: 1, cat: "farm", kind: "pen", max: 2, short: "Kippen geven eieren", pen: { animal: "chick", an: "Kip", cap: 6, feed: "feed_chick", out: "egg", t: 180, price: 300 } },
    cowpen: { n: "Koeienweide", spr: "cowpen", w: 4, d: 3, cost: 2400, lvl: 3, cat: "farm", kind: "pen", max: 2, short: "Koeien geven melk", pen: { animal: "cow", an: "Koe", cap: 5, feed: "feed_cow", out: "milk", t: 420, price: 900 } },
    pigpen: { n: "Varkensstal", spr: "pigpen", w: 3, d: 3, cost: 5000, lvl: 5, cat: "farm", kind: "pen", max: 2, short: "Varkens geven spek", pen: { animal: "pig", an: "Varken", cap: 5, feed: "feed_pig", out: "bacon", t: 720, price: 1500 } },
    barn: { n: "Schuur", spr: "barn", w: 5, d: 3, sc: 1.3, kind: "store", store: "barn", fixed: 1 },
    silo: { n: "Silo", spr: "silo", w: 2, d: 2, sc: 1.5, kind: "store", store: "silo", fixed: 1 },
    board: { n: "Bestelbord", spr: "board", w: 2, d: 2, kind: "board", fixed: 1 },
    feedmill: { n: "Voedermolen", spr: "feedmill", w: 2, d: 2, cost: 600, lvl: 1, cat: "build", kind: "prod", max: 1, short: "Maakt voer voor je dieren", info: "Maakt van je gewassen voer voor je dieren. Kies hieronder wat je wil maken." },
    bakery: { n: "Bakkerij", spr: "bakery", w: 3, d: 3, cost: 1600, lvl: 2, cat: "build", kind: "prod", max: 1, short: "Bakt brood en gebak", info: "Bakt brood, koekjes en taart van tarwe, eieren en zuivel." },
    dairy: { n: "Zuivelhuis", spr: "dairy", w: 3, d: 3, cost: 4000, lvl: 4, cat: "build", kind: "prod", max: 1, short: "Maakt room, boter, kaas", info: "Maakt van melk room, boter en kaas." },
    grill: { n: "Grill", spr: "grill", w: 2, d: 2, cost: 7000, lvl: 6, cat: "build", kind: "prod", max: 1, short: "Bakt warme gerechten", info: "Bakt gerechten met spek, eieren en kaas." },
    juicer: { n: "Sapkraam", spr: "juicer", w: 2, d: 2, cost: 10000, lvl: 8, cat: "build", kind: "prod", max: 1, short: "Perst sap, kookt soep", info: "Perst sap en kookt soep van je groenten en fruit." },
    d_oak: deco("Eik", "tree_oak", 300), d_round: deco("Bolboom", "tree_round", 240), d_detail: deco("Appelboom", "tree_detail", 300), d_fat: deco("Dikke boom", "tree_fat", 240),
    d_pine: deco("Den", "tree_pine", 240), d_pinehigh: deco("Hoge den", "tree_pinehigh", 300, 2), d_bush: deco("Struik", "bush", 120), d_bush2: deco("Bessenstruik", "bush_small", 120),
    d_flowers: deco("Bloemen", "flowers", 100), d_hay: deco("Hooibaal", "hay", 200), d_fence: deco("Hek", "fence", 80), d_hedge: deco("Haag", "hedge", 120, 2),
    d_rock: deco("Rots", "rock_a", 160, 2), d_stump: deco("Boomstronk", "stump", 100, 2), d_logs: deco("Houtstapel", "logs", 160, 2), d_mush: deco("Paddenstoelen", "mushrooms", 100, 3),
    d_barrel: deco("Ton", "barrel", 160, 3), d_sign: deco("Wegwijzer", "signpost", 160, 3), d_lantern: deco("Lantaarn", "lantern", 300, 4), d_bench: deco("Bankje", "bench", 400, 4, 2),
    d_chest: deco("Schatkist", "chest", 500, 5), d_well: deco("Waterput", "well", 800, 5, 2), d_stall: deco("Marktkraam", "stall_red", 1000, 6, 2), d_fountain: deco("Fontein", "fountain", 1600, 7, 2),
  };
  const R = (out, inp, t, lvl, n) => ({ out, in: inp, t, lvl: lvl || 1, n: n || 1 });
  const recipes = {
    feedmill: [R("feed_chick", { wheat: 2 }, 60, 1, 3), R("feed_cow", { corn: 2, carrot: 1 }, 180, 3, 3), R("feed_pig", { carrot: 2, turnip: 1 }, 300, 5, 3)],
    bakery: [R("bread", { wheat: 3 }, 180, 2), R("cookie", { wheat: 2, egg: 2 }, 300, 3), R("croissant", { wheat: 2, butter: 1 }, 480, 6), R("pie", { pumpkin: 3, wheat: 2, egg: 1 }, 720, 7), R("cake", { wheat: 3, egg: 2, cream: 1, butter: 1 }, 1200, 10)],
    dairy: [R("cream", { milk: 1 }, 240, 4), R("butter", { milk: 2 }, 420, 4), R("cheese", { milk: 3 }, 660, 5)],
    grill: [R("bacon_eggs", { bacon: 2, egg: 2 }, 360, 6), R("pancakes", { egg: 2, milk: 1, wheat: 2 }, 420, 6), R("burger", { bread: 1, bacon: 1, cheese: 1 }, 720, 8), R("pizza", { wheat: 2, cheese: 1, bacon: 1 }, 900, 10)],
    juicer: [R("juice_carrot", { carrot: 3 }, 300, 8), R("soup", { turnip: 2, carrot: 1, pumpkin: 1 }, 540, 8), R("juice_melon", { melon: 2 }, 480, 9)],
  };
  return {
    TW: 128, TH: 64, N: 48, PLOT: 8, items, crops, types, recipes,
    wild: ["tree_oak", "tree_round", "tree_detail", "tree_fat", "tree_pine", "tree_pinehigh", "tree_oak", "tree_round", "bush", "bush_small", "rock_a", "rock_b", "rock_tall", "stump", "grass_tuft", "grass_tuft", "mushrooms", "flowers"],
    xpNeed: (lvl) => 15 * lvl * (lvl + 1) + 10,          // XP to go from lvl to lvl+1
    maxFields: (lvl) => 9 + 3 * lvl,
    landCost: (bought) => 2000 + 1500 * bought, landLvl: (bought) => 1 + Math.ceil(bought * 0.7),
    capStep: 25, capCost: (cap) => cap * 20,  // storage upgrade
    slotCost: (slots) => 500 * slots * slots, maxSlots: 5, // production queue slots
    skipCost: (sec) => Math.max(10, Math.ceil(sec / 60) * 20),  // coins to finish something now
    names: ["Oma Rita", "Boer Jef", "Juf Els", "Bakker Tom", "Meneer Wim", "Lotte", "Kok Sam", "Tante Mia", "Slager Ben", "Noor"],
  };
})();
