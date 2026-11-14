/**
 * Smartschool Combined — service worker.
 *
 * Fetches grades on behalf of the content script. The service worker has no
 * page origin of its own, so the school's origin is taken from the sender.
 */
"use strict";

var PAGE_SIZE = 50;

function originFromSender(sender) {
  if (sender && sender.tab && sender.tab.url) {
    try {
      return new URL(sender.tab.url).origin;
    } catch (e) {
      /* fall through */
    }
  }
  if (sender && sender.origin && /^https:\/\//.test(sender.origin)) return sender.origin;
  return null;
}

function fetchPage(origin, n) {
  var url =
    origin + "/results/api/v1/evaluations/?pageNumber=" + n + "&itemsOnPage=" + PAGE_SIZE;
  return fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
  }).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status + " on page " + n);
    return r.json();
  });
}

function fetchAll(origin) {
  var all = [];
  function step(n) {
    return fetchPage(origin, n).then(function (data) {
      var rows = Array.isArray(data) ? data : [];
      all = all.concat(rows);
      if (rows.length < PAGE_SIZE) return all;
      return step(n + 1);
    });
  }
  return step(1);
}

/* ---------- online league (Realtime Database REST, no SDK) ---------- */

// A fork has no firebase-config.js (it is git-ignored): fall back to the dummy example
// so the worker still registers. The online league then fails with a normal network error.
try {
  importScripts("firebase-config.js");
} catch (e) {
  importScripts("firebase-config.example.js");
}
importScripts("league.js");

// Every path is <databaseURL>/<path>.json; bodies are plain JSON.
var RTDB_BASE = self.sscFirebaseConfig.databaseURL.replace(/\/+$/, "");

/**
 * Everything in a league message comes from a content script, i.e. from a
 * web page's process. Checked here before it goes into a URL or the
 * database: ids and class names become path keys, and a Realtime Database
 * key may not contain . $ # [ ] / (or control characters), so those are
 * refused; lengths are bounded; the team code is Base64 and capped.
 */
var RTDB_KEY_FORBIDDEN = /[.$#\[\]\/\\\u0000-\u001f\u007f]/;
var ID_RX = /^[A-Za-z0-9_-]{1,80}$/;

function validClassName(className) {
  return typeof className === "string" && !!className && className.length <= 40 && !RTDB_KEY_FORBIDDEN.test(className);
}

function cleanLeagueInput(msg) {
  var userId = typeof msg.userId === "string" ? msg.userId.trim() : "";
  var className = typeof msg.className === "string" ? msg.className.trim() : "";
  var displayName = typeof msg.displayName === "string" ? msg.displayName.trim() : "";
  var teamData = typeof msg.teamData === "string" ? msg.teamData.trim() : "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userId)) return { error: "bad_user" };
  if (!validClassName(className)) return { error: "bad_class" };
  if (!self.sscLeague.classAllowed(className)) return { error: "not_allowed" };
  if (!teamData || teamData.length > 8000 || !/^[A-Za-z0-9+/=]+$/.test(teamData)) return { error: "bad_team" };
  return {
    userId: userId,
    className: className,
    displayName: (displayName || "Speler").slice(0, 40),
    teamData: teamData,
  };
}

/* ---------- anonymous sign-in (Firebase Auth REST, no SDK) ---------- */

/**
 * The database rules need to know WHO writes, and the Smartschool id alone
 * proves nothing (any request can claim any id). So every browser signs in
 * to Firebase anonymously once and keeps that account: its uid is stored on
 * the member node it creates, and the rules only let that same uid change
 * the node again. The TI-84 programs may only be written by the uid stored
 * on the host's member node.
 *
 * Needs "Anonymous" switched on under Authentication → Sign-in method. Until
 * it is, sign-in fails and requests go out without a token, which still
 * works while the database is in test mode.
 */
var AUTH_KEY = "sscFirebaseAuth";
var API_KEY = self.sscFirebaseConfig.apiKey;
var authCache = null;
var authPending = null;
var authRetryAt = 0;

function authFrom(d) {
  return {
    uid: d.localId || d.user_id,
    idToken: d.idToken || d.id_token,
    refreshToken: d.refreshToken || d.refresh_token,
    expiresAt: Date.now() + (Number(d.expiresIn || d.expires_in) || 3600) * 1000,
  };
}

function authPost(url, contentType, body) {
  return fetch(url, { method: "POST", headers: { "Content-Type": contentType }, body: body }).then(function (r) {
    return r.json().catch(function () {
      return {};
    }).then(function (d) {
      if (r.ok && (d.idToken || d.id_token)) return authFrom(d);
      var code = (d && d.error && d.error.message) || "HTTP " + r.status;
      var err = new Error(code);
      // A refresh token that is gone for good; anything else (offline, 5xx)
      // must NOT create a new account, or the old member node is lost.
      err.dead = /TOKEN_EXPIRED|INVALID_REFRESH_TOKEN|USER_NOT_FOUND|USER_DISABLED/.test(code);
      throw err;
    });
  });
}

function signUpAnonymous() {
  return authPost(
    "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=" + API_KEY,
    "application/json",
    JSON.stringify({ returnSecureToken: true })
  );
}

function refreshAuth(saved) {
  return authPost(
    "https://securetoken.googleapis.com/v1/token?key=" + API_KEY,
    "application/x-www-form-urlencoded",
    "grant_type=refresh_token&refresh_token=" + encodeURIComponent(saved.refreshToken)
  );
}

/** Resolves { uid, idToken } or null (sign-in unavailable right now). */
function authToken() {
  if (authCache && authCache.expiresAt - Date.now() > 60000) return Promise.resolve(authCache);
  if (Date.now() < authRetryAt) return Promise.resolve(null);
  if (authPending) return authPending;

  authPending = new Promise(function (resolve) {
    chrome.storage.local.get([AUTH_KEY], function (res) {
      resolve((res && res[AUTH_KEY]) || null);
    });
  })
    .then(function (saved) {
      if (saved && saved.idToken && saved.expiresAt - Date.now() > 60000) return saved;
      if (saved && saved.refreshToken) {
        return refreshAuth(saved).catch(function (e) {
          if (e.dead) return signUpAnonymous();
          throw e;
        });
      }
      return signUpAnonymous();
    })
    .then(function (auth) {
      authCache = auth;
      var payload = {};
      payload[AUTH_KEY] = auth;
      chrome.storage.local.set(payload);
      return auth;
    })
    .catch(function (e) {
      console.warn("[SSC] Firebase-aanmelding mislukt (" + e.message + "). Staat 'Anonymous' aan onder Authentication → Sign-in method?");
      authRetryAt = Date.now() + 5 * 60 * 1000;
      return null;
    })
    .then(function (auth) {
      authPending = null;
      return auth;
    });
  return authPending;
}

function rtdbUrl(path, auth) {
  return RTDB_BASE + "/" + path.map(encodeURIComponent).join("/") + ".json" +
    (auth && auth.idToken ? "?auth=" + encodeURIComponent(auth.idToken) : "");
}

function rtdbRequest(method, path, body) {
  return authToken().then(function (auth) {
    return rtdbFetch(method, path, body, auth);
  });
}

function rtdbFetch(method, path, body, auth) {
  var init = { method: method, headers: { Accept: "application/json" } };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return fetch(rtdbUrl(path, auth), init).then(function (r) {
    return r.text().then(function (text) {
      var data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        data = null;
      }
      return { status: r.status, ok: r.ok, data: data };
    });
  });
}

/**
 * Join = PUT leagues/{class}/members/{userId}. PUT writes the whole member,
 * so joining again simply replaces the team. A GET first tells a new member
 * from an update, only for the message the user sees.
 */
function leagueJoin(m) {
  var path = ["leagues", m.className, "members", m.userId];
  var member = {
    userId: m.userId,
    displayName: m.displayName,
    className: m.className,
    teamData: m.teamData,
    lastUpdated: Math.floor(Date.now() / 1000),
  };
  var existed = false;
  var auth = null;
  return authToken()
    .then(function (a) {
      auth = a;
      // The rules let only this uid change the node from now on.
      if (auth) member.authUid = auth.uid;
      return rtdbFetch("GET", path, undefined, auth);
    })
    .then(function (res) {
      if (!res.ok) return res;
      existed = res.data !== null;
      return rtdbFetch("PUT", path, member, auth);
    })
    .then(function (res) {
      if (res.ok) return { ok: true, updated: existed, className: m.className };
      return { ok: false, error: "http", status: res.status };
    }, function () {
      return { ok: false, error: "network" };
    });
}
/** The whole class league in one read: { members, matches }. */
function leagueGet(className) {
  return rtdbRequest("GET", ["leagues", className]).then(function (res) {
    if (!res.ok) return { ok: false, error: "http", status: res.status };
    var data = res.data && typeof res.data === "object" ? res.data : {};
    return { ok: true, members: data.members || {}, matches: data.matches || {} };
  }, function () {
    return { ok: false, error: "network" };
  });
}

/**
 * A simulated weekend, rebuilt field by field from what the content script
 * sent: only known keys, ids that are valid database keys, scores 0..11,
 * at most 11 cards per lineup. Null when anything does not fit.
 */
function cleanWeekend(weekId, data) {
  if (!/^\d{4}-W\d{2}$/.test(weekId) || !data || typeof data !== "object") return null;
  if (data.weekend !== weekId || typeof data.matches !== "object" || !data.matches) return null;
  var keys = Object.keys(data.matches);
  if (!keys.length || keys.length > 100) return null;
  var out = {
    weekend: weekId,
    start: Number(data.start) || 0,
    simulatedAt: Date.now(),
    matches: {},
  };
  if (data.bye !== undefined) {
    if (!ID_RX.test(String(data.bye))) return null;
    out.bye = String(data.bye);
  }
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var m = data.matches[k];
    if (!/^m\d{1,3}$/.test(k) || !m) return null;
    if (!ID_RX.test(String(m.user1)) || !ID_RX.test(String(m.user2)) || m.user1 === m.user2) return null;
    var s1 = Number(m.score1);
    var s2 = Number(m.score2);
    if (!(s1 >= 0 && s1 <= 11 && s1 % 1 === 0 && s2 >= 0 && s2 <= 11 && s2 % 1 === 0 && s1 + s2 <= 11)) return null;
    var lineups = [m.lineup1 || {}, m.lineup2 || {}].map(function (l) {
      var ids = Object.keys(l);
      if (ids.length > 11) return null;
      var clean = {};
      for (var j = 0; j < ids.length; j++) {
        if (!ID_RX.test(ids[j]) || !(Number(l[ids[j]]) > 0)) return null;
        clean[ids[j]] = Number(l[ids[j]]);
      }
      return clean;
    });
    if (!lineups[0] || !lineups[1]) return null;
    out.matches[k] = {
      user1: String(m.user1),
      user2: String(m.user2),
      score1: s1,
      score2: s2,
      weekend: weekId,
      lineup1: lineups[0],
      lineup2: lineups[1],
    };
  }
  return out;
}

/**
 * Stores a weekend exactly once. The Realtime Database's conditional write:
 * GET with X-Firebase-ETag gives the ETag of the (still empty) node, PUT
 * with if-match only succeeds while it is still that value. Two classmates
 * pressing "Simuleer Weekend" at once: one write wins, the other gets 412
 * and is told the weekend is already played (and both computed the same
 * result anyway).
 */
function leagueSaveWeekend(className, weekId, data) {
  var url = "";
  return authToken()
    .then(function (auth) {
      url = rtdbUrl(["leagues", className, "matches", weekId], auth);
      return fetch(url, { headers: { "X-Firebase-ETag": "true" } });
    })
    .then(function (r) {
      var etag = r.headers.get("ETag");
      return r.text().then(function (text) {
        return { ok: r.ok, status: r.status, etag: etag, exists: text && text !== "null" };
      });
    })
    .then(function (head) {
      if (!head.ok) return { ok: false, error: "http", status: head.status };
      if (head.exists) return { ok: false, error: "exists" };
      return fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "if-match": head.etag || "" },
        body: JSON.stringify(data),
      }).then(function (r) {
        if (r.status === 412) return { ok: false, error: "exists" };
        if (!r.ok) return { ok: false, error: "http", status: r.status };
        return { ok: true };
      });
    })
    .catch(function () {
      return { ok: false, error: "network" };
    });
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || (msg.type !== "ssc:leagueGet" && msg.type !== "ssc:leagueSaveWeekend")) return;
  var className = typeof msg.className === "string" ? msg.className.trim() : "";
  if (!validClassName(className)) {
    sendResponse({ ok: false, error: "bad_class" });
    return;
  }
  if (!self.sscLeague.classAllowed(className)) {
    sendResponse({ ok: false, error: "not_allowed" });
    return;
  }
  if (msg.type === "ssc:leagueGet") {
    leagueGet(className).then(sendResponse);
    return true;
  }
  var weekId = typeof msg.weekId === "string" ? msg.weekId : "";
  var clean = cleanWeekend(weekId, msg.data);
  if (!clean) {
    sendResponse({ ok: false, error: "bad_weekend" });
    return;
  }
  leagueSaveWeekend(className, weekId, clean).then(sendResponse);
  return true;
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== "ssc:leagueJoin") return;
  var clean = cleanLeagueInput(msg);
  if (clean.error) {
    sendResponse({ ok: false, error: clean.error });
    return;
  }
  leagueJoin(clean).then(sendResponse);
  return true; // async reply
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== "ssc:fetchGrades") return;

  var origin = originFromSender(sender);
  if (!origin) {
    sendResponse({ ok: false, error: "no_origin" });
    return; // synchronous reply, no need for true
  }

  fetchAll(origin)
    .then(function (raw) {
      sendResponse({ ok: true, raw: raw });
    })
    .catch(function (err) {
      sendResponse({ ok: false, error: String((err && err.message) || err) });
    });

  return true; // keep the message port open for the async reply
});

/* ---------- TI-84 programs (leagues/{class}/calculatorPrograms) ---------- */

/**
 * Everyone in the class reads the list; only the host adds and removes.
 * The host check here is for a clear message — the real lock is the
 * database rule, which only accepts writes from the anonymous uid stored on
 * the host's own member node.
 */
var PROGRAM_ID_RX = /^p[a-z0-9]{4,24}$/;
var PROGRAM_MAX_B64 = 360000; // 256 kB file as Base64, with room to spare
// A TI-84 variable name: a capital letter, then up to 7 capitals or digits.
var CALC_NAME_RX = /^[A-Z][A-Z0-9]{0,7}$/;

function isCalcHost(userId) {
  return (self.sscCalcHostIds || []).indexOf(userId) !== -1;
}

function cleanProgram(p) {
  if (!p || typeof p !== "object") return null;
  if (!PROGRAM_ID_RX.test(String(p.id || ""))) return null;
  if (["8xp", "8xv", "py"].indexOf(p.kind) === -1) return null;
  var data = typeof p.data === "string" ? p.data : "";
  if (!data || data.length > PROGRAM_MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(data)) return null;
  var size = Number(p.size);
  if (!(size > 0 && size <= 262144)) return null;
  var title = String(p.title || "").trim().slice(0, 60);
  if (!title) return null;
  var clean = {
    id: String(p.id),
    title: title,
    description: String(p.description || "").trim().slice(0, 300),
    fileName: String(p.fileName || "").slice(0, 80),
    kind: p.kind,
    size: size,
    data: data,
    addedAt: Number(p.addedAt) || Date.now(),
  };
  // The name it gets on the calculator, chosen by the host.
  if (CALC_NAME_RX.test(String(p.calcName || ""))) clean.calcName = String(p.calcName);
  // Set when the host replaced the code: students see "nieuwe versie".
  if (Number(p.updatedAt) > 0) clean.updatedAt = Number(p.updatedAt);
  return clean;
}

function programsGet(className) {
  return rtdbRequest("GET", ["leagues", className, "calculatorPrograms"]).then(function (res) {
    if (!res.ok) return { ok: false, error: "http", status: res.status };
    var data = res.data && typeof res.data === "object" ? res.data : {};
    var list = Object.keys(data).map(function (k) {
      return Object.assign({}, data[k], { id: k });
    }).filter(function (p) {
      return p && typeof p.data === "string" && typeof p.title === "string";
    }).sort(function (a, b) {
      return (a.addedAt || 0) - (b.addedAt || 0);
    });
    return { ok: true, programs: list };
  }, function () {
    return { ok: false, error: "network" };
  });
}

function programWrite(method, className, id, body) {
  return rtdbRequest(method, ["leagues", className, "calculatorPrograms", id], body).then(function (res) {
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) return { ok: false, error: "denied", status: res.status };
    return { ok: false, error: "http", status: res.status };
  }, function () {
    return { ok: false, error: "network" };
  });
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || typeof msg.type !== "string" || msg.type.indexOf("ssc:calc") !== 0) return;

  if (msg.type === "ssc:calcInfo") {
    authToken().then(function (auth) {
      sendResponse({ ok: true, hosts: (self.sscCalcHostIds || []).slice(), authUid: auth ? auth.uid : null });
    });
    return true;
  }

  var className = typeof msg.className === "string" ? msg.className.trim() : "";
  if (!validClassName(className)) {
    sendResponse({ ok: false, error: "bad_class" });
    return;
  }
  if (msg.type === "ssc:calcProgramsGet") {
    programsGet(className).then(sendResponse);
    return true;
  }

  var userId = typeof msg.userId === "string" ? msg.userId : "";
  if (!isCalcHost(userId)) {
    sendResponse({ ok: false, error: "not_host" });
    return;
  }
  if (msg.type === "ssc:calcProgramAdd") {
    var clean = cleanProgram(msg.program);
    if (!clean) {
      sendResponse({ ok: false, error: "bad_program" });
      return;
    }
    var id = clean.id;
    delete clean.id;
    programWrite("PUT", className, id, clean).then(sendResponse);
    return true;
  }
  if (msg.type === "ssc:calcProgramDelete") {
    if (!PROGRAM_ID_RX.test(String(msg.id || ""))) {
      sendResponse({ ok: false, error: "bad_program" });
      return;
    }
    programWrite("DELETE", className, String(msg.id)).then(sendResponse);
    return true;
  }
  sendResponse({ ok: false, error: "unknown" });
});

/* ---------- plant and pet widgets (plants/{userId}, pets/{userId}) ---------- */

/**
 * The 3D plant and the pet belong to the Smartschool account, not to this
 * browser, so a reinstall finds them again. Only the fields each widget
 * uses go in: numbers as finite numbers, the few strings checked.
 */
var STATE_USER_RX = /^[A-Za-z0-9_-]{1,64}$/;
var STATE_KINDS = {
  plant: {
    node: "plants",
    required: "plantedAt",
    numbers: ["v", "plantedAt", "growthDays", "lastGrowAt", "water", "waterAt", "lastWaterAt", "sunDays", "updatedAt"],
    strings: { lastSunDay: /^(\d{4}-\d{2}-\d{2})?$/ },
  },
  pet: {
    node: "pets",
    required: "adoptedAt",
    numbers: ["v", "adoptedAt", "honger", "energie", "humeur", "band", "tickAt", "sleepingSince", "pettedAt", "updatedAt"],
    strings: { species: /^(cat|dog)$/, name: /^[^\u0000-\u001f]{1,16}$/ },
  },
};

// The arcade coins and what the farm bought with them, one node per user.
STATE_KINDS.economy = {
  node: "economies",
  required: "updatedAt",
  numbers: ["coins", "peak", "barn", "toys", "fert", "updatedAt"],
  strings: {},
};
// The farm game: one JSON string per user (the game keeps its own shape, the string is capped).
STATE_KINDS.farm = {
  node: "farms",
  required: "updatedAt",
  numbers: ["level", "updatedAt"],
  strings: { data: /^[sS]{2,60000}$/ },
};
// A second animal (a cat and a dog can live on the farm together): same shape, its own node.
STATE_KINDS.pet2 = Object.assign({}, STATE_KINDS.pet, { node: "pets2" });

function cleanState(kind, value) {
  var spec = STATE_KINDS[kind];
  if (!spec || !value || typeof value !== "object") return null;
  var out = {};
  spec.numbers.forEach(function (k) {
    var v = Number(value[k]);
    out[k] = isFinite(v) && v >= 0 ? Math.min(v, 1e13) : 0;
  });
  if (!(out[spec.required] > 0)) return null;
  var ok = true;
  Object.keys(spec.strings).forEach(function (k) {
    var v = typeof value[k] === "string" ? value[k] : "";
    if (!spec.strings[k].test(v)) ok = false;
    out[k] = v;
  });
  if (!ok) return null;
  if (!out.updatedAt) out.updatedAt = Date.now();
  return out;
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || (msg.type !== "ssc:stateGet" && msg.type !== "ssc:stateSave")) return;
  var spec = STATE_KINDS[msg.kind];
  var userId = typeof msg.userId === "string" ? msg.userId.trim() : "";
  if (!spec || !STATE_USER_RX.test(userId)) {
    sendResponse({ ok: false, error: "bad_request" });
    return;
  }
  var request;
  if (msg.type === "ssc:stateGet") {
    request = rtdbRequest("GET", [spec.node, userId]).then(function (res) {
      return res.ok ? { ok: true, state: res.data || null } : { ok: false, error: "http", status: res.status };
    });
  } else {
    var clean = cleanState(msg.kind, msg.state);
    if (!clean) {
      sendResponse({ ok: false, error: "bad_state" });
      return;
    }
    request = rtdbRequest("PUT", [spec.node, userId], clean).then(function (res) {
      return res.ok ? { ok: true } : { ok: false, error: "http", status: res.status };
    });
  }
  request.then(sendResponse, function () {
    sendResponse({ ok: false, error: "network" });
  });
  return true;
});

/* ---------- on-demand modules (lazy.js) ---------- */

/**
 * Injects one of the heavy modules into the asking tab and frame, into the
 * same isolated world as the manifest's content scripts. Only these files;
 * anything else in the message is refused.
 */
var INJECTABLE = ["league.js", "team.js", "ti84.js", "widget-games.js", "widget-3d.js", "widgets.js", "widget-system.js", "hub-games.js", "hub.js", "farm/assets/atlas.js", "farm/assets/masks.js", "farm/data.js", "farm/css.js", "farm/game.js", "hub-farm.js", "chess-engine.js", "chess-bot.js", "hub-chess.js", "welcome.js"];

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== "ssc:inject") return;
  var files = Array.isArray(msg.files) ? msg.files : [];
  var okFiles = files.length > 0 && files.every(function (f) {
    return INJECTABLE.indexOf(f) !== -1;
  });
  if (!okFiles || !sender || !sender.tab || typeof sender.tab.id !== "number") {
    sendResponse({ ok: false, error: "bad_inject" });
    return;
  }
  chrome.scripting
    .executeScript({ target: { tabId: sender.tab.id, frameIds: [sender.frameId || 0] }, files: files })
    .then(function () {
      sendResponse({ ok: true });
    }, function (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    });
  return true;
});
