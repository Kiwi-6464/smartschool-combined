/**
 * Smartschool Combined — online league logic (pure, no DOM, no network).
 *
 * Everything here is deterministic: every client that runs it on the same
 * league data gets the same pairings, the same scores and the same table.
 * team.js draws it; background.js stores it (Realtime Database).
 *
 * Data in the database, per class:
 *   leagues/{class}/members/{userId}  { userId, displayName, className, teamData, lastUpdated }
 *   leagues/{class}/matches/{weekId}  { weekend, simulatedAt, start, bye?, matches: { m1: Match, ... } }
 *   Match = { user1, user2, score1, score2, weekend, lineup1: { cardId: usedUntil }, lineup2 }
 *
 * The weekend id is the ISO week of that weekend: "2026-W44".
 */
(function (root) {
  "use strict";

  if (root.sscLeague) return;

  var DAY = 24 * 60 * 60 * 1000;
  var SQUAD_SIZE = 11;
  var EXPIRY_MONTHS = 3;

  /* ---------- access ---------- */

  /**
   * League only for TWE classes for now ("6A-TWE", "6a twe"): "TWE" as its
   * own token, so "tweede" never matches.
   */
  function classAllowed(className) {
    return /(^|[^a-z])twe([^a-z]|$)/i.test(String(className || ""));
  }

  var ACCESS_MESSAGE = "De league is momenteel alleen beschikbaar voor TWE-klassen.";

  /* ---------- weekends ---------- */

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /** Saturday 00:00 of the ISO week (Monday–Sunday) that contains `date`. */
  function weekendStart(date) {
    var d = startOfDay(date);
    var dow = (d.getDay() + 6) % 7; // Monday 0 … Sunday 6
    d.setDate(d.getDate() - dow + 5);
    return d;
  }

  /** ISO 8601 week id, e.g. "2026-W44", of the week that contains `date`. */
  function weekId(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dow = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dow); // Thursday of this week decides the year
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var week = Math.ceil(((d - yearStart) / DAY + 1) / 7);
    return d.getUTCFullYear() + "-W" + (week < 10 ? "0" : "") + week;
  }

  function isWeekend(date) {
    var dow = date.getDay();
    return dow === 0 || dow === 6;
  }

  /**
   * A card played in the weekend that starts at `start` rests the whole next
   * weekend: it is free again on the Monday after that one (start + 9 days).
   */
  function usedUntilFor(start) {
    var d = new Date(start.getTime());
    d.setDate(d.getDate() + 9);
    return d.getTime();
  }

  /* ---------- seeded randomness ---------- */

  /** FNV-1a, 32 bit. */
  function hashString(text) {
    var hash = 0x811c9dc5;
    var s = String(text);
    for (var i = 0; i < s.length; i++) {
      hash ^= s.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  /** mulberry32: a tiny PRNG with a 32-bit seed. */
  function seededRandom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- cards ---------- */

  /**
   * Attack and defence from the overall rating and the position:
   *   ATT  attack = rating          defence = 55% of it
   *   MID  attack = 85% of rating   defence = 85% of it
   *   DEF  attack = 55% of rating   defence = rating
   *   GK   attack = 25% of rating   defence = rating
   */
  var ROLE_FACTORS = {
    ATT: [1, 0.55],
    MID: [0.85, 0.85],
    DEF: [0.55, 1],
    GK: [0.25, 1],
  };

  function cardStats(player) {
    var f = ROLE_FACTORS[player.role] || ROLE_FACTORS.MID;
    var r = Number(player.rating) || 0;
    return { attack: Math.round(r * f[0]), defense: Math.round(r * f[1]) };
  }

  /** "DD/MM/YYYY" or "YYYY-MM-DD" → Date at 00:00, or null. */
  function parseDate(text) {
    var s = String(text || "");
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return null;
  }

  function toIsoDate(text) {
    var d = parseDate(text);
    if (!d) return "";
    var mm = String(d.getMonth() + 1);
    var dd = String(d.getDate());
    return d.getFullYear() + "-" + (mm.length < 2 ? "0" : "") + mm + "-" + (dd.length < 2 ? "0" : "") + dd;
  }

  /** True when the test is more than 3 calendar months older than `now`. */
  function isExpired(dateText, now) {
    var d = parseDate(dateText);
    if (!d) return false;
    var limit = new Date(now.getFullYear(), now.getMonth() - EXPIRY_MONTHS, now.getDate());
    return d < limit;
  }

  /**
   * cardId → usedUntil (ms) for one user, from every simulated weekend:
   * the latest usedUntil written for that card wins.
   */
  function cooldownsFor(userId, matchesTree) {
    var out = {};
    Object.keys(matchesTree || {}).forEach(function (wk) {
      var weekend = matchesTree[wk];
      var list = (weekend && weekend.matches) || {};
      Object.keys(list).forEach(function (key) {
        var m = list[key];
        if (!m) return;
        var lineup = m.user1 === userId ? m.lineup1 : m.user2 === userId ? m.lineup2 : null;
        Object.keys(lineup || {}).forEach(function (cardId) {
          var until = Number(lineup[cardId]) || 0;
          if (!out[cardId] || until > out[cardId]) out[cardId] = until;
        });
      });
    });
    return out;
  }

  /**
   * Why a card cannot play in a league match right now: "expired" (test
   * older than 3 months), "cooldown" (played last weekend), or null.
   */
  function cardBlock(card, cooldowns, now) {
    if (card.date && isExpired(card.date, now)) return { kind: "expired" };
    var until = card.id && cooldowns ? cooldowns[card.id] : 0;
    if (until && until > now.getTime()) return { kind: "cooldown", until: until };
    return null;
  }

  /* ---------- matches ---------- */

  /** Top-down list of 11 values; missing players count as 0. */
  function ranked(values) {
    var list = values.slice().sort(function (a, b) {
      return b - a;
    });
    while (list.length < SQUAD_SIZE) list.push(0);
    return list.slice(0, SQUAD_SIZE);
  }

  /**
   * Attack vs defence, 11 duels:
   *   duel 1  A's best attack      vs B's best defence
   *   duel 2  B's best attack      vs A's best defence
   *   duel 3  A's 2nd attack       vs B's 2nd defence
   *   duel 4  B's 2nd attack       vs A's 2nd defence
   *   … down the lists until 11 duels; team A (the home side, chosen by
   *   the seeded draw) attacks first and so gets the 11th duel.
   * A duel is a weighted coin, not a comparison: the attacker's chance is
   * 50% + 1.5% per point of (attack - defence), clamped to 10%..90%, so a
   * better card usually wins but never certainly. Every duel has a winner,
   * so the scores add up to 11 (6-5, 7-4, ...). MAX_MARGIN caps a blowout:
   * the leader's last duels go to the other side until the gap fits (8-3
   * becomes 7-4). `rand` is a 0..1 generator; the league passes a seeded one.
   */
  var MAX_MARGIN = 4;

  function duelChance(att, def) {
    return Math.max(0.1, Math.min(0.9, 0.5 + (att - def) * 0.015));
  }

  function simulateMatch(playersA, playersB, rand) {
    rand = rand || Math.random;
    var attA = ranked(playersA.map(function (p) { return cardStats(p).attack; }));
    var defA = ranked(playersA.map(function (p) { return cardStats(p).defense; }));
    var attB = ranked(playersB.map(function (p) { return cardStats(p).attack; }));
    var defB = ranked(playersB.map(function (p) { return cardStats(p).defense; }));
    var duels = [];
    var score1 = 0;
    var score2 = 0;
    for (var i = 0; i < SQUAD_SIZE; i++) {
      var rank = Math.floor(i / 2);
      var aAttacks = i % 2 === 0;
      var att = aAttacks ? attA[rank] : attB[rank];
      var def = aAttacks ? defB[rank] : defA[rank];
      var attackerWins = rand() < duelChance(att, def);
      var winner = attackerWins === aAttacks ? 1 : 2;
      if (winner === 1) score1++;
      else score2++;
      duels.push({ rank: rank + 1, attacker: aAttacks ? 1 : 2, attack: att, defense: def, winner: winner });
    }
    var leader = score1 > score2 ? 1 : 2;
    for (var d = duels.length - 1; d >= 0 && Math.abs(score1 - score2) > MAX_MARGIN; d--) {
      if (duels[d].winner !== leader) continue;
      duels[d].winner = 3 - leader;
      score1 += leader === 1 ? -1 : 1;
      score2 += leader === 2 ? -1 : 1;
    }
    return { score1: score1, score2: score2, duels: duels };
  }

  /**
   * Pairs the members for a weekend: sorted by id, shuffled with a seed from
   * the class and the weekend id (Fisher-Yates), then taken two by two. An
   * odd one out has the weekend off ("vrij"). With `strengths` (id -> team
   * rating) the shuffled list is ordered by strength after the free member is
   * set aside, so neighbours in rating meet each other.
   */
  function teamStrength(players) {
    var top = ranked(players.map(function (p) { return Number(p.rating) || 0; }));
    return top.reduce(function (a, b) { return a + b; }, 0) / SQUAD_SIZE;
  }

  function pairMembers(memberIds, className, weekend, strengths) {
    var ids = memberIds.slice().sort();
    var rand = seededRandom(hashString(className + "|" + weekend));
    for (var i = ids.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = ids[i];
      ids[i] = ids[j];
      ids[j] = t;
    }
    var bye = ids.length % 2 ? ids.pop() : null;
    if (strengths) {
      // Array.prototype.sort is stable: equal teams keep their shuffled order.
      ids.sort(function (a, b) {
        return (strengths[b] || 0) - (strengths[a] || 0);
      });
      // Who is "home" (attacks first) stays a draw, not the stronger side.
      for (var s = 0; s + 1 < ids.length; s += 2) {
        if (rand() < 0.5) {
          var sw = ids[s];
          ids[s] = ids[s + 1];
          ids[s + 1] = sw;
        }
      }
    }
    var pairs = [];
    for (var k = 0; k + 1 < ids.length; k += 2) pairs.push([ids[k], ids[k + 1]]);
    return { pairs: pairs, bye: bye };
  }

  /**
   * The players a member may field this weekend: from their team code
   * (decodeTeam), minus expired cards and cards still resting.
   */
  function eligiblePlayers(team, cooldowns, start) {
    if (!team) return [];
    return team.players.filter(function (p) {
      return !cardBlock(p, cooldowns, start);
    });
  }

  /**
   * One complete weekend, ready to store. `decodeTeam(code)` turns a
   * member's teamData into { players: [{ slot, role, rating, vak, id, date }] }.
   */
  function simulateWeekend(className, members, matchesTree, now, decodeTeam) {
    var start = weekendStart(now);
    var weekend = weekId(start);
    var ids = Object.keys(members || {}).filter(function (id) {
      return members[id] && typeof members[id].teamData === "string";
    });
    var squads = {};
    var strengths = {};
    ids.forEach(function (id) {
      squads[id] = eligiblePlayers(decodeTeam(members[id].teamData), cooldownsFor(id, matchesTree), start);
      strengths[id] = teamStrength(squads[id]);
    });
    var draw = pairMembers(ids, className, weekend, strengths);
    var until = usedUntilFor(start);
    var matches = {};
    draw.pairs.forEach(function (pair, n) {
      var playA = squads[pair[0]];
      var playB = squads[pair[1]];
      var result = simulateMatch(playA, playB, seededRandom(hashString(className + "|" + weekend + "|" + pair[0] + "|" + pair[1])));
      var lineup = function (players) {
        var out = {};
        players.forEach(function (p) {
          if (p.id) out[p.id] = until;
        });
        return out;
      };
      matches["m" + (n + 1)] = {
        user1: pair[0],
        user2: pair[1],
        score1: result.score1,
        score2: result.score2,
        weekend: weekend,
        lineup1: lineup(playA),
        lineup2: lineup(playB),
      };
    });
    var out = { weekend: weekend, start: start.getTime(), simulatedAt: now.getTime(), matches: matches };
    if (draw.bye) out.bye = draw.bye;
    return out;
  }

  /* ---------- table ---------- */

  /**
   * Win 3, draw 1, loss 0. Order: points, duel difference, duels won, name.
   */
  function standings(members, matchesTree) {
    var rows = {};
    Object.keys(members || {}).forEach(function (id) {
      var m = members[id] || {};
      rows[id] = {
        userId: id,
        name: typeof m.displayName === "string" && m.displayName ? m.displayName : "Speler",
        played: 0, won: 0, drawn: 0, lost: 0, points: 0, duelsFor: 0, duelsAgainst: 0,
      };
    });
    Object.keys(matchesTree || {}).forEach(function (wk) {
      var list = (matchesTree[wk] && matchesTree[wk].matches) || {};
      Object.keys(list).forEach(function (key) {
        var m = list[key];
        if (!m) return;
        [[m.user1, m.score1, m.score2], [m.user2, m.score2, m.score1]].forEach(function (side) {
          var row = rows[side[0]];
          if (!row) return; // a member who left the league
          var f = Number(side[1]) || 0;
          var a = Number(side[2]) || 0;
          row.played++;
          row.duelsFor += f;
          row.duelsAgainst += a;
          if (f > a) {
            row.won++;
            row.points += 3;
          } else if (f === a) {
            row.drawn++;
            row.points += 1;
          } else {
            row.lost++;
          }
        });
      });
    });
    return Object.keys(rows).map(function (id) {
      return rows[id];
    }).sort(function (a, b) {
      return b.points - a.points ||
        (b.duelsFor - b.duelsAgainst) - (a.duelsFor - a.duelsAgainst) ||
        b.duelsFor - a.duelsFor ||
        a.name.localeCompare(b.name);
    });
  }

  root.sscLeague = {
    ACCESS_MESSAGE: ACCESS_MESSAGE,
    classAllowed: classAllowed,
    weekendStart: weekendStart,
    weekId: weekId,
    isWeekend: isWeekend,
    usedUntilFor: usedUntilFor,
    hashString: hashString,
    seededRandom: seededRandom,
    cardStats: cardStats,
    parseDate: parseDate,
    toIsoDate: toIsoDate,
    isExpired: isExpired,
    cooldownsFor: cooldownsFor,
    cardBlock: cardBlock,
    simulateMatch: simulateMatch,
    pairMembers: pairMembers,
    teamStrength: teamStrength,
    eligiblePlayers: eligiblePlayers,
    duelChance: duelChance,
    simulateWeekend: simulateWeekend,
    standings: standings,
  };
})(typeof window !== "undefined" ? window : globalThis);
