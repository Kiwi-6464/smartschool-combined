/**
 * Smartschool Combined — TI-84 programs in the calculator dropdown.
 *
 *   - Programs live in the Realtime Database, shared by the class, under
 *     leagues/{class}/calculatorPrograms/{id}:
 *       { title, description, fileName, kind: "8xp" | "8xv" | "py",
 *         size, data: Base64 of the file, addedAt,
 *         calcName: the name it gets on the calculator (host's choice),
 *         updatedAt: set when the host replaced the code }
 *     background.js does the requests; the database rules only accept
 *     writes from the host.
 *   - Only the host (sscCalcHostIds in firebase-config.js) sees
 *     "Rekentoestelprogramma toevoegen" and can remove programs; everyone
 *     else sees the list read-only.
 *   - "Verbind met rekenmachine" opens a WebUSB connection to a Texas
 *     Instruments device (vendor 0x0451); "Zet op rekentoestel" sends the
 *     program with TI's own USB protocol ("DUSB", the protocol TI Connect CE
 *     and libticalcs speak to the TI-84 Plus / CE). TI calculators do not
 *     use Kermit, so there is no Kermit here.
 *
 * DUSB in short (libticalcs dusb_rpkt / dusb_vpkt / dusb_cmd):
 *   raw packet      [size u32 BE][type u8][data]
 *     1 BUF_SIZE_REQ  2 BUF_SIZE_ALLOC  3 VIRT_DATA  4 VIRT_DATA_LAST  5 VIRT_DATA_ACK (E0 00)
 *   virtual packet  [size u32 BE][type u16 BE][data], cut into raw data
 *     packets of at most the negotiated buffer size; every raw data packet
 *     is acknowledged with a raw ACK by the other side.
 *   sending a variable:
 *     0x0001 mode set (normal mode)          ← 0x0012 MODE_SET (the mode ack)
 *     0x000B RTS: name, size, attributes      ← 0xAA00
 *     0x000D variable contents                ← 0xAA00
 *     0xDD00 end of transmission
 *   0xBB00 DELAY_ACK means "wait and read again", 0xEE00 is an error.
 *
 * Every WebUSB call that needs it (requestDevice) runs straight from the
 * click handler, without an await before it, so the browser sees the user
 * gesture.
 */
(function () {
  "use strict";

  if (window.sscSkipPage) return;
  if (window.sscTi84) return;

  /*
   * The host: the Smartschool user id(s) that may add and remove programs.
   * background.js answers with the list from firebase-config.js; this copy
   * only covers the moment before it does. The id is shown at the bottom of
   * the calculator dropdown ("Jouw gebruikers-ID").
   */
  var HOST_USER_IDS = ["4005_14660_0"];

  // Where older versions kept the list on this computer (migrateLocal).
  var STORE_KEY = "sscCalculatorPrograms";
  var MAX_FILE_BYTES = 256 * 1024;
  var TI_VENDOR = 0x0451;
  // TI USB cables/calculators that are not a DUSB calculator.
  var NOT_A_CALC = { 0xe001: "SilverLink-kabel", 0xe012: "TI-Nspire" };
  var IO_TIMEOUT_MS = 6000;

  /* ---------- small helpers ---------- */

  function h(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function bytesToBase64(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  function base64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function concat(parts) {
    var len = 0;
    parts.forEach(function (p) {
      len += p.length;
    });
    var out = new Uint8Array(len);
    var off = 0;
    parts.forEach(function (p) {
      out.set(p, off);
      off += p.length;
    });
    return out;
  }

  function u32be(n) {
    return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
  }

  function u16be(n) {
    return new Uint8Array([(n >>> 8) & 0xff, n & 0xff]);
  }

  function hex(n, width) {
    var s = n.toString(16).toUpperCase();
    while (s.length < (width || 4)) s = "0" + s;
    return "0x" + s;
  }

  function fmtSize(n) {
    return n < 1024 ? n + " B" : (n / 1024).toFixed(1).replace(".", ",") + " kB";
  }

  /* ---------- storage ---------- */

  /*
   * The list lives in the Realtime Database, shared by the whole class:
   * leagues/{class}/calculatorPrograms/{id}. background.js does the requests
   * (it has the host permission and the sign-in token). `store` is the last
   * list we read, so repainting for a status message costs no request.
   */
  var store = { className: "", programs: [], loaded: false, error: null };

  function ask(msg) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(msg, function (res) {
          resolve(chrome.runtime.lastError ? null : res || null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  /**
   * The class key, the same one the league uses: Smartschool's own class
   * name on the grades (period.class.name, kept as `klas`), most frequent
   * first. The calculator check's name is only a fallback.
   */
  function resolveClass(hint) {
    var fetchGrades = window.sscFetchGradesCached || window.sscFetchGrades;
    var fromGrades = typeof fetchGrades === "function"
      ? fetchGrades().then(function (grades) {
          var count = {};
          var best = "";
          (grades || []).forEach(function (g) {
            var k = g && typeof g.klas === "string" ? g.klas.trim() : "";
            if (!k) return;
            count[k] = (count[k] || 0) + 1;
            if (!best || count[k] > count[best]) best = k;
          });
          return best;
        }, function () {
          return "";
        })
      : Promise.resolve("");
    return fromGrades.then(function (name) {
      var pick = name || String(hint || "").trim();
      return /^[^.$#\[\]\/\\]{1,40}$/.test(pick) ? pick : "";
    });
  }

  function loadPrograms() {
    if (!store.className) {
      store.loaded = true;
      store.error = "Je klas is niet gevonden. Open Resultaten en probeer opnieuw.";
      return Promise.resolve(store.programs);
    }
    return ask({ type: "ssc:calcProgramsGet", className: store.className }).then(function (res) {
      store.loaded = true;
      if (res && res.ok) {
        store.error = null;
        store.programs = res.programs || [];
      } else {
        store.error = res && res.error === "network"
          ? "Geen verbinding met de database. Controleer je internet."
          : "De programma's konden niet geladen worden.";
      }
      return store.programs;
    });
  }

  function writeError(res) {
    if (!res) return "Kan de extensie niet bereiken. Herlaad de pagina.";
    switch (res.error) {
      case "denied":
        return "De database weigerde dit. Schrijf je op deze computer eerst in voor de competitie (Team → Competitie): zo weet de database dat jij de beheerder bent.";
      case "not_host":
        return "Alleen de beheerder kan programma's toevoegen of verwijderen.";
      case "bad_program":
        return "Dit programma is ongeldig of te groot.";
      case "network":
        return "Geen verbinding met de database. Controleer je internet.";
      default:
        return "Opslaan mislukt" + (res.status ? " (HTTP " + res.status + ")" : "") + ".";
    }
  }

  /* ---------- host ---------- */

  var userId = null;
  var hostIds = HOST_USER_IDS;

  function resolveUser() {
    var info = ask({ type: "ssc:calcInfo" }).then(function (res) {
      if (res && res.ok && Array.isArray(res.hosts)) hostIds = res.hosts;
    });
    var id = typeof window.sscGetUserId === "function" ? window.sscGetUserId() : Promise.resolve(null);
    return Promise.all([info, id]).then(function (out) {
      var uid = out[1];
      userId = uid && uid !== "anoniem" ? String(uid) : null;
      return userId;
    });
  }

  function isHost() {
    return !!userId && hostIds.indexOf(userId) !== -1;
  }

  /**
   * Programs saved by an older version on this computer (chrome.storage
   * .local) are moved into the database once, by the host only.
   */
  function migrateLocal() {
    if (!isHost() || !store.className) return Promise.resolve();
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get([STORE_KEY], function (res) {
          resolve(res && Array.isArray(res[STORE_KEY]) ? res[STORE_KEY] : []);
        });
      } catch (e) {
        resolve([]);
      }
    }).then(function (local) {
      if (!local.length) return;
      var have = {};
      store.programs.forEach(function (p) {
        have[p.id] = true;
      });
      var jobs = local.filter(function (p) {
        return p && p.id && !have[p.id];
      }).map(function (p) {
        return ask({ type: "ssc:calcProgramAdd", className: store.className, userId: userId, program: p });
      });
      return Promise.all(jobs).then(function (results) {
        var allOk = results.every(function (r) {
          return r && r.ok;
        });
        if (allOk) chrome.storage.local.remove(STORE_KEY);
        if (results.length) return loadPrograms();
      });
    });
  }

  /* ---------- TI files ---------- */

  var SIGNATURE = "**TI83F*";

  /**
   * The first variable in a .8xp/.8xv file:
   *   0..10  "**TI83F*" 1A 0A 00   11..52 comment   53..54 data length (LE)
   *   55..   entry: header length (LE, 0x0B or 0x0D), var data length (LE),
   *          type, name (8, zero padded), [version, flag], var data length
   *          again, var data.
   */
  function parseTiFile(bytes) {
    if (bytes.length < 74) throw new Error("Dit bestand is te kort voor een TI-programma.");
    for (var i = 0; i < SIGNATURE.length; i++) {
      if (bytes[i] !== SIGNATURE.charCodeAt(i)) throw new Error("Dit is geen TI-84-bestand (.8xp/.8xv).");
    }
    var p = 55;
    var hdrLen = bytes[p] | (bytes[p + 1] << 8);
    var dataLen = bytes[p + 2] | (bytes[p + 3] << 8);
    var type = bytes[p + 4];
    var nameBytes = bytes.subarray(p + 5, p + 13);
    var name = "";
    for (var n = 0; n < nameBytes.length && nameBytes[n]; n++) name += String.fromCharCode(nameBytes[n]);
    var version = hdrLen >= 0x0d ? bytes[p + 13] : 0;
    var dataStart = p + 2 + hdrLen + 2;
    if (dataStart + dataLen > bytes.length) throw new Error("Dit TI-bestand is beschadigd (te kort).");
    return {
      name: name,
      type: type,
      version: version,
      data: bytes.slice(dataStart, dataStart + dataLen),
    };
  }

  /** A TI-84 variable name: a capital letter, then up to 7 capitals or digits. */
  var CALC_NAME_RX = /^[A-Z][A-Z0-9]{0,7}$/;

  /** A name as the calculator accepts it, or "" when nothing usable is left. */
  function cleanCalcName(name) {
    var clean = String(name || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    return CALC_NAME_RX.test(clean) ? clean : "";
  }

  /** A calculator name from a file name: A-Z/0-9, starts with a letter, ≤ 8. */
  function calcName(fileName) {
    var stem = String(fileName || "").replace(/\.[^.]*$/, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z]/.test(stem)) stem = "P" + stem;
    return stem.slice(0, 8) || "PROG";
  }

  /**
   * A .py file as a TI-84 Plus CE Python AppVar (type 0x15): "PYCD", a zero
   * byte and the source; the variable data starts with its own length (LE).
   */
  function pythonVariable(fileName, bytes) {
    var body = concat([new Uint8Array([0x50, 0x59, 0x43, 0x44, 0x00]), bytes]);
    var data = concat([new Uint8Array([body.length & 0xff, (body.length >>> 8) & 0xff]), body]);
    return { name: calcName(fileName), type: 0x15, version: 0, data: data };
  }

  /**
   * The variable to send. The host's chosen name (calcName) wins; without
   * one a .8xp/.8xv keeps the name inside the file and a .py is named after
   * its file name.
   */
  function variableOf(program) {
    var bytes = base64ToBytes(program.data);
    var v = program.kind === "py" ? pythonVariable(program.fileName, bytes) : parseTiFile(bytes);
    if (CALC_NAME_RX.test(String(program.calcName || ""))) v.name = program.calcName;
    return v;
  }

  /* ---------- WebUSB + DUSB ---------- */

  var link = null; // { device, epIn, epOut, iface, bufSize, rx: Uint8Array }

  function withTimeout(promise, ms, what) {
    var timer;
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        timer = setTimeout(function () {
          var e = new Error(what || "timeout");
          e.sscTimeout = true;
          reject(e);
        }, ms);
      }),
    ]).then(function (v) {
      clearTimeout(timer);
      return v;
    }, function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  /*
   * A short log of the last USB packets, printed to the console when a
   * transfer fails, so a problem on a real calculator can be read back.
   */
  var usbLog = [];

  function logPacket(dir, type, size, note) {
    usbLog.push((dir === "out" ? "→ " : "← ") + "raw " + type + " (" + size + " B)" + (note ? " " + note : ""));
    if (usbLog.length > 40) usbLog.shift();
  }

  function dumpLog(e) {
    try {
      console.warn("[SSC] TI-84: versturen mislukt", e, "\n" + usbLog.join("\n"));
    } catch (x) {
      /* Logging must never break the error path. */
    }
  }

  function transferError(dir, r) {
    var e = new Error("USB " + dir + " status " + r.status);
    e.sscUsbStatus = r.status;
    return e;
  }

  function writeRaw(type, payload, note) {
    var pkt = concat([u32be(payload.length), new Uint8Array([type]), payload]);
    logPacket("out", type, pkt.length, note);
    return withTimeout(link.device.transferOut(link.epOut, pkt), IO_TIMEOUT_MS, "write").then(function (r) {
      if (r.status !== "ok") throw transferError("out", r);
      // A transfer that exactly fills its last USB packet needs a zero-length
      // packet after it, or the calculator keeps waiting for more bytes.
      if (link.outPacketSize && pkt.length % link.outPacketSize === 0) {
        logPacket("out", "ZLP", 0);
        return link.device.transferOut(link.epOut, new Uint8Array(0)).then(function () {});
      }
    });
  }

  /** One raw packet from the calculator (they may span USB transfers). */
  function readRaw() {
    function have() {
      if (link.rx.length < 5) return null;
      var size = ((link.rx[0] << 24) | (link.rx[1] << 16) | (link.rx[2] << 8) | link.rx[3]) >>> 0;
      if (link.rx.length < 5 + size) return null;
      var pkt = { type: link.rx[4], data: link.rx.slice(5, 5 + size) };
      link.rx = link.rx.slice(5 + size);
      logPacket("in", pkt.type, pkt.data.length + 5);
      return pkt;
    }
    var ready = have();
    if (ready) return Promise.resolve(ready);
    // A whole number of USB packets: asking for a length that is not a
    // multiple of the packet size can end a transfer with "babble".
    return withTimeout(link.device.transferIn(link.epIn, 4096), IO_TIMEOUT_MS, "read").then(function (r) {
      if (r.status === "stall") {
        // The calculator refused something: clear the halt so the next try
        // can work, and report it as a refusal rather than a lost cable.
        return link.device.clearHalt("in", link.epIn).catch(function () {}).then(function () {
          throw transferError("in", r);
        });
      }
      if (r.status !== "ok") throw transferError("in", r);
      link.rx = concat([link.rx, new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength)]);
      return readRaw();
    });
  }

  /**
   * The calculator may ask for the buffer size itself at any point
   * (raw BUF_SIZE_REQ); libticalcs answers with BUF_SIZE_ALLOC and carries on.
   */
  function answerSizeRequest(pkt) {
    var asked = pkt.data.length >= 4
      ? ((pkt.data[0] << 24) | (pkt.data[1] << 16) | (pkt.data[2] << 8) | pkt.data[3]) >>> 0
      : 1024;
    return writeRaw(2, u32be(Math.min(asked, 1024)), "BUF_SIZE_ALLOC");
  }

  function expectRawAck() {
    return readRaw().then(function (pkt) {
      if (pkt.type === 1) return answerSizeRequest(pkt).then(expectRawAck);
      if (pkt.type !== 5) throw new Error("verwachtte ACK, kreeg raw " + pkt.type);
    });
  }

  /**
   * Cuts a virtual packet into raw packets. The negotiated size is the
   * calculator's whole raw packet, header included (libticalcs:
   * DATA_SIZE = dusb_rpkt_maxlen − 5), so each piece carries at most
   * bufSize − 5 bytes of data. Using the full bufSize for the data made
   * every piece of a large program 5 bytes too big for the calculator.
   */
  function sendVirtual(vtype, data, note) {
    var full = concat([u32be(data.length), u16be(vtype), data]);
    var room = Math.max(16, link.bufSize - 5);
    var offset = 0;
    function next() {
      if (offset >= full.length) return Promise.resolve();
      var chunk = full.slice(offset, offset + room);
      offset += chunk.length;
      return writeRaw(offset >= full.length ? 4 : 3, chunk, offset === chunk.length ? note : "")
        .then(expectRawAck)
        .then(next);
    }
    return next();
  }

  function recvVirtual() {
    var parts = [];
    function next() {
      return readRaw().then(function (pkt) {
        if (pkt.type === 5) return next(); // a stray ACK
        if (pkt.type === 1) return answerSizeRequest(pkt).then(next);
        if (pkt.type !== 3 && pkt.type !== 4) throw new Error("onverwacht raw-pakket " + pkt.type);
        parts.push(pkt.data);
        return writeRaw(5, new Uint8Array([0xe0, 0x00])).then(function () {
          return pkt.type === 4 ? null : next();
        });
      });
    }
    return next().then(function () {
      var all = concat(parts);
      return { type: (all[4] << 8) | all[5], data: all.slice(6) };
    });
  }

  /**
   * Waits for one of `types`; DELAY_ACK means read again, ERROR throws.
   * DATA_ACK (0xAA00) answers RTS and variable contents; the mode set is
   * answered with a MODE_SET packet (0x0012) of its own, exactly as
   * libticalcs' dusb_cmd_r_mode_ack expects. Treating that 0x0012 as
   * unexpected was the "onverwacht antwoord 0x0012" on a real TI-84.
   */
  function expectVirtual(types) {
    return recvVirtual().then(function (v) {
      if (types.indexOf(v.type) !== -1) return;
      if (v.type === 0xbb00) return new Promise(function (r) { setTimeout(r, 100); }).then(function () {
        return expectVirtual(types);
      });
      if (v.type === 0xee00) {
        var code = v.data.length >= 2 ? (v.data[0] << 8) | v.data[1] : 0;
        var e = new Error("rekentoestel-fout " + hex(code));
        e.sscCalcError = code;
        throw e;
      }
      throw new Error("onverwacht antwoord " + hex(v.type));
    });
  }

  function expectDataAck() {
    return expectVirtual([0xaa00]);
  }

  /** Mode-set reply: MODE_SET (0x0012); a DATA_ACK is accepted as well. */
  function expectModeAck() {
    return expectVirtual([0x0012, 0xaa00]);
  }

  /**
   * Raw BUF_SIZE_REQ (1024, libticalcs' default) → BUF_SIZE_ALLOC: the
   * largest raw packet the calculator accepts, header included.
   */
  function negotiate() {
    usbLog = [];
    return writeRaw(1, u32be(1024), "BUF_SIZE_REQ").then(readRaw).then(function (pkt) {
      if (pkt.type !== 2 || pkt.data.length < 4) throw new Error("geen buffergrootte ontvangen");
      var size = ((pkt.data[0] << 24) | (pkt.data[1] << 16) | (pkt.data[2] << 8) | pkt.data[3]) >>> 0;
      link.bufSize = Math.max(32, Math.min(size, 1024));
      logPacket("in", "buffer", link.bufSize, "= rekentoestel-buffer");
    });
  }

  function attr(id, bytes) {
    return concat([u16be(id), u16be(bytes.length), bytes]);
  }

  /**
   * The RTS ("request to send") payload, as libticalcs dusb_cmd_s_rts:
   *   folder length (0 = no folder, and then NO folder bytes follow)
   *   name length, name, 0x00
   *   size (u32 BE), 0x01, attribute count (u16 BE), attributes
   * The TI-84 has no folders, but the folder length byte is always there:
   * without it the calculator reads the program name as a folder name and
   * answers error 0x000D ("invalid folder name").
   */
  function rtsPayload(v) {
    var nameBytes = new Uint8Array(v.name.length);
    for (var i = 0; i < v.name.length; i++) nameBytes[i] = v.name.charCodeAt(i) & 0xff;
    var attrs = [
      attr(0x0002, new Uint8Array([0xf0, 0x07, 0x00, v.type])), // variable type
      attr(0x0003, new Uint8Array([0x00])),                     // not archived
      attr(0x0008, new Uint8Array([0x00, 0x00, 0x00, v.version || 0])), // version
    ];
    return concat([
      new Uint8Array([0x00]), // no folder
      new Uint8Array([nameBytes.length]), nameBytes, new Uint8Array([0x00]),
      u32be(v.data.length),
      new Uint8Array([0x01]),
      u16be(attrs.length),
    ].concat(attrs));
  }

  /** Remembers which step failed, for the error message. */
  function step(name, fn) {
    return function () {
      return Promise.resolve().then(fn).catch(function (e) {
        if (e && !e.sscStep) e.sscStep = name;
        throw e;
      });
    };
  }

  /** Mode set, RTS, contents, EOT — libticalcs calc_84p send_var. */
  function sendVariable(v) {
    var mode = new Uint8Array([0x00, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x07, 0xd0]);
    var rts = rtsPayload(v);
    return Promise.resolve()
      .then(step("modus instellen", function () {
        return sendVirtual(0x0001, mode).then(expectModeAck);
      }))
      .then(step("programma aankondigen", function () {
        return sendVirtual(0x000b, rts).then(expectDataAck);
      }))
      .then(step("inhoud versturen", function () {
        return sendVirtual(0x000d, v.data).then(expectDataAck);
      }))
      .then(step("afsluiten", function () {
        return sendVirtual(0xdd00, new Uint8Array(0));
      }));
  }

  function pickEndpoints(device) {
    var cfg = device.configuration;
    var ifaces = cfg ? cfg.interfaces : [];
    for (var i = 0; i < ifaces.length; i++) {
      var alt = ifaces[i].alternate;
      var epIn = null;
      var epOut = null;
      var outSize = 0;
      (alt.endpoints || []).forEach(function (ep) {
        if (ep.type !== "bulk") return;
        if (ep.direction === "in") epIn = ep.endpointNumber;
        else {
          epOut = ep.endpointNumber;
          outSize = ep.packetSize || 0;
        }
      });
      if (epIn !== null && epOut !== null) {
        return { iface: ifaces[i].interfaceNumber, epIn: epIn, epOut: epOut, outPacketSize: outSize };
      }
    }
    return null;
  }

  function deviceLabel(device) {
    var name = device.productName || "TI-rekentoestel";
    return name + " (" + hex(device.productId) + ")";
  }

  /* ---------- messages ---------- */

  function connectError(e) {
    var name = e && e.name;
    if (name === "NotFoundError") return "Geen rekentoestel gekozen.";
    if (name === "SecurityError") return "Smartschool of je browser blokkeert USB-toegang op deze pagina.";
    if (name === "NetworkError" || name === "InvalidStateError") {
      return "Kon het rekentoestel niet openen. Is TI Connect CE nog open? Sluit dat programma en probeer opnieuw.";
    }
    if (e && e.sscTimeout) return "Het rekentoestel antwoordt niet. Staat het aan en op het startscherm?";
    return "Verbinden mislukt: " + ((e && e.message) || "onbekende fout") + ".";
  }

  /* The calculator's DUSB error codes, as libticalcs names them. */
  var CALC_ERRORS = {
    0x0004: "ongeldige naam of argument",
    0x0006: "deze app kan niet verwijderd worden",
    0x0008: "overdrachtsfout",
    0x0009: "het rekentoestel staat in de opstartmodus",
    0x000c: "geen geheugen meer",
    0x000d: "ongeldige mapnaam",
    0x000e: "ongeldige naam",
    0x0011: "het rekentoestel is bezig",
    0x0012: "het programma is vergrendeld of beschermd",
    0x001d: "modus te klein",
    0x0022: "ongeldige parameter",
  };

  /** True only when the cable or device is really gone. */
  function isUnplugged(e) {
    return !!e && (e.name === "NotFoundError" || /disconnected/i.test(e.message || ""));
  }

  /**
   * Every message says which step failed and, for USB errors, the browser's
   * own detail ("stall", "babble", "A transfer error has occurred") — the
   * old message called every USB hiccup a lost cable.
   */
  function sendError(e) {
    var stepText = e && e.sscStep ? "stap: " + e.sscStep : "";
    if (isUnplugged(e)) {
      return "De verbinding met het rekentoestel is verbroken" + (stepText ? " (" + stepText + ")" : "") +
        ". Sluit de kabel opnieuw aan en verbind opnieuw.";
    }
    if (e && e.sscTimeout) {
      return "Het rekentoestel antwoordt niet meer" + (stepText ? " (" + stepText + ")" : "") +
        ". Staat het op het startscherm? Klik Verbreek en verbind opnieuw.";
    }
    if (e && e.sscCalcError !== undefined) {
      var meaning = CALC_ERRORS[e.sscCalcError];
      return "Het rekentoestel weigerde het programma: " + (meaning || "onbekende fout") + " (code " +
        hex(e.sscCalcError) + (stepText ? ", " + stepText : "") + ").";
    }
    var detail = e && e.sscUsbStatus ? "USB-status " + e.sscUsbStatus : (e && e.message) || "onbekende fout";
    return "De USB-overdracht mislukte (" + detail + (stepText ? ", " + stepText : "") +
      "). Klik Verbreek, verbind opnieuw en probeer nog eens.";
  }

  /* ---------- UI ---------- */

  /*
   * The calculator window is as big as the settings window, so the section
   * has two columns: the programs on the left, the connection, messages and
   * (for the host) the add/update form on the right. One column on a narrow
   * screen.
   */
  var CSS = [
    ".ssc-ti { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: 20px; align-items: start; }",
    "@media (max-width: 760px) { .ssc-ti { grid-template-columns: minmax(0, 1fr); } }",
    ".ssc-ti-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }",
    ".ssc-ti-conn { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 14px;",
    "  background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 5%, transparent); }",
    ".ssc-ti-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--ssc-red, crimson); flex: none; }",
    ".ssc-ti-conn[data-on='1'] .ssc-ti-dot { background: var(--ssc-green, seagreen); box-shadow: 0 0 6px var(--ssc-green, seagreen); }",
    ".ssc-ti-conn-text { flex: 1 1 12rem; min-width: 0; font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".ssc-ti-btn { font: inherit; font-size: 13px; font-weight: 700; padding: 8px 12px; border-radius: 10px; cursor: pointer;",
    "  border: 1px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 18%, transparent); background: transparent; color: inherit; }",
    ".ssc-ti-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--ssc-accent, #2b6cb0) 14%, transparent); }",
    ".ssc-ti-btn:disabled { opacity: .45; cursor: default; }",
    ".ssc-ti-btn:focus-visible { outline: 2px solid var(--ssc-accent, #2b6cb0); outline-offset: 2px; }",
    // Not white on the accent: a theme's accent can be light grey. The theme's
    // own text colour on a light tint of the accent is readable on any theme.
    ".ssc-ti-btn--main { background: color-mix(in srgb, var(--ssc-accent, #2b6cb0) 20%, transparent);",
    "  border: 1.5px solid var(--ssc-accent, #2b6cb0); color: var(--ssc-text, #1a1a2e); font-weight: 800; }",
    ".ssc-ti-btn--main:hover:not(:disabled) { background: color-mix(in srgb, var(--ssc-accent, #2b6cb0) 34%, transparent); }",
    ".ssc-ti-list { display: flex; flex-direction: column; gap: 8px; }",
    ".ssc-ti-prog { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 14px;",
    "  border: 1px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 10%, transparent);",
    "  background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 2%, transparent); }",
    ".ssc-ti-prog[data-new='1'] { border-color: var(--ssc-accent, #2b6cb0); }",
    ".ssc-ti-prog-info { flex: 1; min-width: 0; }",
    ".ssc-ti-prog-title { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 14.5px; font-weight: 700; overflow-wrap: anywhere; }",
    ".ssc-ti-prog-desc { margin-top: 2px; font-size: 12.5px; opacity: .78; overflow-wrap: anywhere; }",
    ".ssc-ti-prog-meta { font-size: 11.5px; opacity: .65; margin-top: 4px; }",
    ".ssc-ti-tag { font-size: 10.5px; font-weight: 800; letter-spacing: .04em; padding: 2px 7px; border-radius: 99px;",
    "  background: color-mix(in srgb, var(--ssc-accent, #2b6cb0) 22%, transparent); }",
    ".ssc-ti-calcname { font-family: ui-monospace, Consolas, monospace; font-weight: 700; }",
    ".ssc-ti-prog-actions { display: flex; flex-direction: column; gap: 6px; flex: none; }",
    ".ssc-ti-msg { font-size: 13px; line-height: 1.45; padding: 9px 11px; border-radius: 10px; }",
    ".ssc-ti-msg[data-tone='bad'] { background: color-mix(in srgb, var(--ssc-red, crimson) 14%, transparent); color: var(--ssc-red, crimson); }",
    ".ssc-ti-msg[data-tone='good'] { background: color-mix(in srgb, var(--ssc-green, seagreen) 14%, transparent); color: var(--ssc-green, seagreen); }",
    ".ssc-ti-msg[data-tone='info'] { background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 6%, transparent); }",
    ".ssc-ti-add { display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 14px;",
    "  border: 1px dashed color-mix(in srgb, var(--ssc-text, #1a1a2e) 28%, transparent); }",
    ".ssc-ti-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; font-weight: 700; }",
    ".ssc-ti-field small { font-weight: 500; opacity: .7; }",
    ".ssc-ti-add input[type='text'], .ssc-ti-add textarea { font: inherit; font-size: 13px; font-weight: 500; padding: 8px 10px; border-radius: 10px;",
    "  border: 1px solid color-mix(in srgb, var(--ssc-text, #1a1a2e) 18%, transparent); background: transparent; color: inherit; }",
    ".ssc-ti-add input[type='text']:focus, .ssc-ti-add textarea:focus { outline: none; border-color: var(--ssc-accent, #2b6cb0);",
    "  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ssc-accent, #2b6cb0) 25%, transparent); }",
    ".ssc-ti-add input.ssc-ti-name { font-family: ui-monospace, Consolas, monospace; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }",
    ".ssc-ti-add textarea { min-height: 56px; resize: vertical; }",
    ".ssc-ti-file { display: flex; align-items: center; gap: 8px; min-width: 0; }",
    ".ssc-ti-file span { min-width: 0; font-size: 12px; font-weight: 500; opacity: .8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".ssc-ti-row { display: flex; gap: 8px; flex-wrap: wrap; }",
    ".ssc-ti-section { font-size: 11.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; opacity: .65; }",
    ".ssc-ti-uid { font-size: 11px; opacity: .55; user-select: all; }",
    ".ssc-ti-btn--file { font-size: 11.5px; font-weight: 600; padding: 6px 9px; opacity: .85; }",
    ".ssc-ti-wiz { position: relative; display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 14px;",
    "  background: linear-gradient(160deg, color-mix(in srgb, var(--ssc-accent, #2b6cb0) 16%, transparent), color-mix(in srgb, var(--ssc-accent, #2b6cb0) 5%, transparent));",
    "  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ssc-accent, #2b6cb0) 30%, transparent), 0 14px 30px -18px rgba(0,0,0,.45);",
    "  animation: ssc-ti-wiz-in .35s cubic-bezier(.2,.9,.25,1) both; }",
    "@keyframes ssc-ti-wiz-in { from { opacity: 0; transform: translate3d(0, 8px, 0) scale(.98); } }",
    ".ssc-ti-wiz-head { display: flex; align-items: flex-start; gap: 10px; }",
    ".ssc-ti-wiz-ico { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; color: var(--ssc-accent, #2b6cb0);",
    "  background: color-mix(in srgb, var(--ssc-accent, #2b6cb0) 18%, transparent); }",
    ".ssc-ti-wiz-ico svg { width: 20px; height: 20px; }",
    ".ssc-ti-wiz-title { flex: 1; font-size: 14px; font-weight: 800; line-height: 1.35; }",
    ".ssc-ti-wiz-x { flex: none; border: 0; background: none; color: inherit; font-size: 20px; line-height: 1; cursor: pointer; opacity: .6; padding: 2px 4px; }",
    ".ssc-ti-wiz-x:hover { opacity: 1; }",
    ".ssc-ti-wiz-steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; line-height: 1.4; opacity: .9; }",
    ".ssc-ti-wiz-dl { text-decoration: none; color: inherit; display: inline-flex; align-items: center; }",
    ".ssc-ti-wiz-note { font-size: 11.5px; opacity: .7; }",
  ].join("\n");

  var ui = { root: null, msg: null, wizard: false };

  function setMsg(text, tone) {
    ui.msg = text ? { text: text, tone: tone || "info" } : null;
    if (ui.root && ui.root.isConnected) paint();
  }

  var TI_CONNECT_URL = "https://education.ti.com/en/products/computer-software/ti-connect-ce-sw";

  /** No device, no WebUSB or a device that will not open: show the helper. */
  function showWizard(text) {
    ui.wizard = true;
    setMsg(text, "bad");
  }

  /** Called from the click handler: requestDevice must be the first await. */
  function connect() {
    if (!navigator.usb || typeof navigator.usb.requestDevice !== "function") {
      showWizard("Je browser ondersteunt geen USB-verbinding (WebUSB). Gebruik Chrome of Edge op een computer, of download het bestand en zet het er met TI Connect CE op.");
      return;
    }
    var request;
    try {
      request = navigator.usb.requestDevice({ filters: [{ vendorId: TI_VENDOR }] });
    } catch (e) {
      showWizard(connectError(e));
      return;
    }
    request.then(function (d) {
      if (!d) {
        showWizard(null);
        return;
      }
      openDevice(d, false);
    }, function (e) {
      showWizard(e && e.name === "NotFoundError" ? null : connectError(e));
    });
  }

  /** Opens and claims a TI device the page already has access to. */
  function openDevice(device, quiet) {
    if (link) return Promise.resolve(true);
    if (NOT_A_CALC[device.productId]) {
      if (!quiet) setMsg("Dit is een " + NOT_A_CALC[device.productId] + ", geen TI-84 met USB-aansluiting.", "bad");
      return Promise.resolve(false);
    }
    if (!quiet) setMsg("Verbinden met " + deviceLabel(device) + "…", "info");
    return (device.opened ? Promise.resolve() : device.open())
      .then(function () {
        return device.configuration ? null : device.selectConfiguration(1);
      })
      .then(function () {
        var eps = pickEndpoints(device);
        if (!eps) throw new Error("geen USB-eindpunten gevonden");
        return device.claimInterface(eps.iface).then(function () {
          link = {
            device: device, epIn: eps.epIn, epOut: eps.epOut, iface: eps.iface,
            outPacketSize: eps.outPacketSize, bufSize: 250, rx: new Uint8Array(0),
          };
          return negotiate();
        });
      })
      .then(function () {
        ui.wizard = false;
        setMsg("Verbonden met " + deviceLabel(device) + ".", "good");
        return true;
      })
      .catch(function (e) {
        var keep = link;
        link = null;
        if (keep && keep.device) keep.device.close().catch(function () {});
        else if (device && device.opened) device.close().catch(function () {});
        if (quiet) {
          if (ui.root && ui.root.isConnected) paint();
        } else if (e && (e.name === "NetworkError" || e.name === "InvalidStateError" || e.name === "SecurityError")) {
          showWizard(connectError(e));
        } else {
          setMsg(connectError(e), "bad");
        }
        return false;
      });
  }

  /**
   * A calculator this site was already allowed to use (an earlier
   * "Verbind") connects by itself: getDevices needs no click. Quiet: a
   * calculator that is off or busy simply stays unconnected.
   */
  var autoTried = null;
  function autoConnect() {
    if (link) return Promise.resolve(true);
    if (!navigator.usb || typeof navigator.usb.getDevices !== "function") return Promise.resolve(false);
    if (autoTried) return autoTried;
    autoTried = navigator.usb.getDevices().then(function (list) {
      var d = (list || []).filter(function (x) {
        return x.vendorId === TI_VENDOR && !NOT_A_CALC[x.productId];
      })[0];
      return d ? openDevice(d, true) : false;
    }, function () {
      return false;
    }).then(function (ok) {
      autoTried = null;
      return ok;
    });
    return autoTried;
  }

  /** The program as its own file, for TI Connect CE when USB is not an option. */
  function downloadFile(p) {
    try {
      var blob = new Blob([base64ToBytes(p.data)], { type: "application/octet-stream" });
      var a = document.createElement("a");
      var url = URL.createObjectURL(blob);
      a.href = url;
      a.download = p.fileName || (calcName(p.title) || "PROGRAM") + "." + (p.kind || "8xp");
      a.style.display = "none";
      document.documentElement.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 4000);
    } catch (e) {
      setMsg("Kon het bestand niet maken: " + ((e && e.message) || "onbekende fout") + ".", "bad");
    }
  }

  function buildWizard() {
    var box = h("div", "ssc-ti-wiz");
    var head = h("div", "ssc-ti-wiz-head");
    var ico = h("span", "ssc-ti-wiz-ico");
    ico.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="9.2" y="5" width="5.6" height="4" rx=".8" fill="currentColor" opacity=".35"/><path d="M9.5 12h1M13.5 12h1M9.5 15h1M13.5 15h1M9.5 18h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    head.appendChild(ico);
    head.appendChild(h("div", "ssc-ti-wiz-title", "Geen rekenmachine gevonden? Zorg dat je TI Connect CE hebt geïnstalleerd."));
    var x = h("button", "ssc-ti-wiz-x", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Sluiten");
    x.addEventListener("click", function (e) {
      e.stopPropagation();
      ui.wizard = false;
      paint();
    });
    head.appendChild(x);
    box.appendChild(head);
    var steps = h("ol", "ssc-ti-wiz-steps");
    [
      "Installeer TI Connect CE: dat zet het USB-stuurprogramma op je computer.",
      "Sluit TI Connect CE daarna af: twee programma's kunnen de kabel niet tegelijk gebruiken.",
      "Sluit je TI-84 Plus CE aan met de USB-kabel en zet hem aan (startscherm).",
      "Klik Opnieuw proberen en kies je rekentoestel in de lijst.",
    ].forEach(function (t) {
      steps.appendChild(h("li", null, t));
    });
    box.appendChild(steps);
    var row = h("div", "ssc-ti-row");
    var dl = h("a", "ssc-ti-btn ssc-ti-btn--main ssc-ti-wiz-dl", "Download TI Connect CE");
    dl.href = TI_CONNECT_URL;
    dl.target = "_blank";
    dl.rel = "noopener noreferrer";
    row.appendChild(dl);
    var again = h("button", "ssc-ti-btn", "Opnieuw proberen");
    again.type = "button";
    again.addEventListener("click", function (e) {
      e.stopPropagation();
      connect(); // synchronously inside the click: keeps the user gesture
    });
    row.appendChild(again);
    box.appendChild(row);
    box.appendChild(h("div", "ssc-ti-wiz-note", "Lukt het niet via USB? Gebruik \"Download bestand\" bij een programma en sleep het in TI Connect CE."));
    return box;
  }

  function disconnect() {
    var keep = link;
    link = null;
    if (keep && keep.device) keep.device.close().catch(function () {});
    setMsg("Verbinding gesloten.", "info");
  }

  if (navigator.usb && typeof navigator.usb.addEventListener === "function") {
    navigator.usb.addEventListener("disconnect", function (e) {
      if (link && e.device === link.device) {
        link = null;
        setMsg("De verbinding met het rekentoestel is verbroken. Sluit de kabel opnieuw aan en verbind opnieuw.", "bad");
      }
    });
  }

  /* --- which version each program was last put on this calculator --- */

  // { programId: time it was sent }. A program updated after that time gets
  // a "Nieuwe versie" tag, because a calculator cannot be updated remotely.
  var SENT_KEY = "sscCalcSent";
  var sent = {};

  function loadSent() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get([SENT_KEY], function (res) {
          sent = (res && res[SENT_KEY] && typeof res[SENT_KEY] === "object") ? res[SENT_KEY] : {};
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });
  }

  function markSent(id) {
    sent[id] = Date.now();
    try {
      var payload = {};
      payload[SENT_KEY] = sent;
      chrome.storage.local.set(payload);
    } catch (e) {
      /* Only the "nieuwe versie" tag depends on this. */
    }
  }

  function versionOf(p) {
    return Number(p.updatedAt) || Number(p.addedAt) || 0;
  }

  function isNewVersion(p) {
    return !!sent[p.id] && versionOf(p) > sent[p.id];
  }

  var sending = false;

  function sendProgram(program) {
    if (!link) {
      setMsg("Verbind eerst met je rekenmachine.", "bad");
      return;
    }
    if (sending) return;
    var v;
    try {
      v = variableOf(program);
    } catch (e) {
      setMsg(e.message, "bad");
      return;
    }
    sending = true;
    setMsg("\"" + program.title + "\" wordt verstuurd als " + v.name + "…", "info");
    sendVariable(v).then(function () {
      sending = false;
      markSent(program.id);
      setMsg("\"" + program.title + "\" staat op je rekentoestel als " + v.name + ".", "good");
    }, function (e) {
      sending = false;
      dumpLog(e);
      // The message is built first: it must describe the error, not the
      // fact that the link is closed below.
      var text = sendError(e);
      // After a failed step the calculator's protocol state is unknown:
      // close, so the next try starts with a fresh connection.
      var keep = link;
      link = null;
      if (keep) keep.device.close().catch(function () {});
      setMsg(text, "bad");
    });
  }

  /* --- the host's form: add a program, or update one --- */

  /*
   * The form's values live here, not only in the inputs: every status
   * message repaints the section, and a repaint must not wipe what the host
   * typed or the file they picked.
   */
  var draft = null; // { editId, file, bytes, kind, title, calcName, description, nameTouched, titleTouched }

  function openDraft(program) {
    draft = program
      ? {
          editId: program.id,
          file: null,
          bytes: null,
          kind: program.kind,
          title: program.title || "",
          calcName: program.calcName || defaultCalcName(program),
          description: program.description || "",
          nameTouched: true,
          titleTouched: true,
        }
      : { editId: null, file: null, bytes: null, kind: null, title: "", calcName: "", description: "", nameTouched: false, titleTouched: false };
    paint();
  }

  function kindOf(fileName) {
    var lower = String(fileName || "").toLowerCase();
    return /\.8xp$/.test(lower) ? "8xp" : /\.8xv$/.test(lower) ? "8xv" : /\.py$/.test(lower) ? "py" : null;
  }

  /** The name the calculator would show without a chosen one. */
  function defaultCalcName(program) {
    try {
      return cleanCalcName(variableOf(Object.assign({}, program, { calcName: "" })).name);
    } catch (e) {
      return calcName(program.fileName);
    }
  }

  /** Reads the picked file into the draft and suggests a name and title. */
  function pickFile(file) {
    if (!draft || !file) return;
    var kind = kindOf(file.name);
    if (!kind) {
      setMsg("Alleen .8xp-, .8xv- of .py-bestanden.", "bad");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setMsg("Dit bestand is te groot (max " + fmtSize(MAX_FILE_BYTES) + ").", "bad");
      return;
    }
    file.arrayBuffer().then(function (buf) {
      var bytes = new Uint8Array(buf);
      var suggested = kind === "py" ? calcName(file.name) : cleanCalcName(parseTiFile(bytes).name) || calcName(file.name);
      draft.file = file;
      draft.bytes = bytes;
      draft.kind = kind;
      if (!draft.nameTouched) draft.calcName = suggested;
      if (!draft.titleTouched) draft.title = file.name.replace(/\.[^.]*$/, "");
      setMsg(null);
    }).catch(function (e) {
      setMsg(e && e.message ? e.message : "Dit bestand kon niet gelezen worden.", "bad");
    });
  }

  function saveDraft() {
    var d = draft;
    if (!d) return Promise.resolve(null);
    var editing = d.editId ? store.programs.filter(function (p) {
      return p.id === d.editId;
    })[0] : null;
    if (!editing && !d.bytes) return Promise.resolve("Kies eerst een bestand (.8xp, .8xv of .py).");
    if (!CALC_NAME_RX.test(d.calcName)) {
      return Promise.resolve("De naam op het rekentoestel moet met een letter beginnen en mag alleen A–Z en 0–9 bevatten (max. 8 tekens).");
    }
    var program = editing ? Object.assign({}, editing) : {
      id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      addedAt: Date.now(),
    };
    if (d.bytes) {
      program.kind = d.kind;
      program.fileName = d.file.name.slice(0, 80);
      program.size = d.bytes.length;
      program.data = bytesToBase64(d.bytes);
    }
    // Only new code is a new version; a new title or name alone is not.
    if (editing && d.bytes) program.updatedAt = Date.now();
    program.title = (d.title || program.fileName || "").trim().slice(0, 60);
    program.description = String(d.description || "").trim().slice(0, 300);
    program.calcName = d.calcName;
    return ask({ type: "ssc:calcProgramAdd", className: store.className, userId: userId, program: program }).then(function (res) {
      if (!res || !res.ok) return writeError(res);
      return loadPrograms().then(function () {
        return null;
      });
    });
  }

  function removeProgram(id) {
    return ask({ type: "ssc:calcProgramDelete", className: store.className, userId: userId, id: id }).then(function (res) {
      if (!res || !res.ok) return writeError(res);
      return loadPrograms().then(function () {
        return null;
      });
    });
  }

  function fmtWhen(ms) {
    var d = new Date(ms);
    var two = function (n) {
      return (n < 10 ? "0" : "") + n;
    };
    return two(d.getDate()) + "/" + two(d.getMonth() + 1) + " " + two(d.getHours()) + ":" + two(d.getMinutes());
  }

  function field(label, hint, input) {
    var wrap = h("label", "ssc-ti-field");
    wrap.appendChild(document.createTextNode(label));
    wrap.appendChild(input);
    if (hint) wrap.appendChild(h("small", null, hint));
    return wrap;
  }

  function buildForm() {
    var d = draft;
    var form = h("div", "ssc-ti-add");
    form.appendChild(h("div", "ssc-ti-section", d.editId ? "Programma bijwerken" : "Rekentoestelprogramma toevoegen"));

    var file = h("input");
    file.type = "file";
    file.accept = ".8xp,.8xv,.py";
    file.hidden = true;
    file.addEventListener("change", function () {
      pickFile(file.files && file.files[0]);
    });
    var fileRow = h("div", "ssc-ti-file");
    var pick = h("button", "ssc-ti-btn", d.editId ? "Nieuwe code kiezen" : "Bestand kiezen");
    pick.type = "button";
    pick.addEventListener("click", function (e) {
      e.stopPropagation();
      file.click();
    });
    fileRow.appendChild(pick);
    fileRow.appendChild(h("span", null, d.file ? d.file.name + " · " + fmtSize(d.bytes.length) : d.editId ? "Huidige code blijft staan" : "Nog geen bestand"));
    form.appendChild(fileRow);
    form.appendChild(file);

    var name = h("input", "ssc-ti-name");
    name.type = "text";
    name.maxLength = 8;
    name.spellcheck = false;
    name.value = d.calcName;
    name.addEventListener("input", function () {
      var clean = name.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      if (clean !== name.value) name.value = clean;
      d.calcName = clean;
      d.nameTouched = true;
    });
    form.appendChild(field("Naam op rekentoestel", "A–Z en 0–9, begint met een letter, max. 8 tekens. Dit is de naam onder PRGM.", name));

    var title = h("input");
    title.type = "text";
    title.maxLength = 60;
    title.value = d.title;
    title.addEventListener("input", function () {
      d.title = title.value;
      d.titleTouched = true;
    });
    form.appendChild(field("Titel in de lijst", null, title));

    var desc = h("textarea");
    desc.maxLength = 300;
    desc.value = d.description;
    desc.addEventListener("input", function () {
      d.description = desc.value;
    });
    form.appendChild(field("Beschrijving (optioneel)", null, desc));

    var row = h("div", "ssc-ti-row");
    var save = h("button", "ssc-ti-btn ssc-ti-btn--main", d.editId ? "Bijwerken" : "Opslaan");
    save.type = "button";
    save.addEventListener("click", function (e) {
      e.stopPropagation();
      save.disabled = true;
      var editing = !!d.editId;
      saveDraft().then(function (err) {
        if (err) {
          save.disabled = false;
          setMsg(err, "bad");
          return;
        }
        draft = null;
        setMsg(editing ? "Bijgewerkt. Wie dit venster open heeft, ziet de nieuwe versie binnen 15 seconden." : "Programma toegevoegd.", "good");
      });
    });
    var cancel = h("button", "ssc-ti-btn", "Annuleren");
    cancel.type = "button";
    cancel.addEventListener("click", function (e) {
      e.stopPropagation();
      draft = null;
      paint();
    });
    row.appendChild(save);
    row.appendChild(cancel);
    form.appendChild(row);
    return form;
  }

  function buildRow(p) {
    var fresh = isNewVersion(p);
    var row = h("div", "ssc-ti-prog");
    if (fresh) row.setAttribute("data-new", "1");
    var info = h("div", "ssc-ti-prog-info");
    var title = h("div", "ssc-ti-prog-title");
    title.appendChild(document.createTextNode(p.title));
    if (fresh) title.appendChild(h("span", "ssc-ti-tag", "Nieuwe versie"));
    info.appendChild(title);
    if (p.description) info.appendChild(h("div", "ssc-ti-prog-desc", p.description));
    var meta = h("div", "ssc-ti-prog-meta");
    meta.appendChild(document.createTextNode("Op rekentoestel: "));
    meta.appendChild(h("span", "ssc-ti-calcname", p.calcName || defaultCalcName(p)));
    meta.appendChild(document.createTextNode(" · " + fmtSize(p.size) + (p.updatedAt ? " · bijgewerkt " + fmtWhen(p.updatedAt) : "")));
    info.appendChild(meta);
    row.appendChild(info);

    var actions = h("div", "ssc-ti-prog-actions");
    var send = h("button", "ssc-ti-btn ssc-ti-btn--main", fresh ? "Opnieuw zetten" : "Zet op rekentoestel");
    send.type = "button";
    send.disabled = !link || sending;
    send.title = link ? "" : "Verbind eerst met je rekenmachine.";
    send.addEventListener("click", function (e) {
      e.stopPropagation();
      sendProgram(p);
    });
    actions.appendChild(send);
    var file = h("button", "ssc-ti-btn ssc-ti-btn--file", "Download bestand");
    file.type = "button";
    file.title = "Het ." + (p.kind || "8xp") + "-bestand, voor TI Connect CE";
    file.disabled = !p.data;
    file.addEventListener("click", function (e) {
      e.stopPropagation();
      downloadFile(p);
    });
    actions.appendChild(file);
    if (isHost()) {
      var edit = h("button", "ssc-ti-btn", "Bijwerken");
      edit.type = "button";
      edit.addEventListener("click", function (e) {
        e.stopPropagation();
        openDraft(p);
      });
      actions.appendChild(edit);
      var del = h("button", "ssc-ti-btn", "Verwijderen");
      del.type = "button";
      del.addEventListener("click", function (e) {
        e.stopPropagation();
        del.disabled = true;
        removeProgram(p.id).then(function (err) {
          if (err) setMsg(err, "bad");
          else setMsg("\"" + p.title + "\" is verwijderd.", "info");
        });
      });
      actions.appendChild(del);
    }
    row.appendChild(actions);
    return row;
  }

  function paint() {
    var root = ui.root;
    if (!root) return;
    root.textContent = "";
    var main = h("div", "ssc-ti-col");
    var side = h("div", "ssc-ti-col");
    root.appendChild(main);
    root.appendChild(side);

    // Programs
    main.appendChild(h("div", "ssc-ti-section", "Programma's"));
    var list = h("div", "ssc-ti-list");
    main.appendChild(list);
    var programs = store.programs;
    if (!store.loaded) {
      list.appendChild(h("div", "ssc-ti-prog-desc", "Laden…"));
    } else if (store.error && !programs.length) {
      var bad = h("div", "ssc-ti-msg", store.error);
      bad.setAttribute("data-tone", "bad");
      list.appendChild(bad);
    } else if (!programs.length) {
      list.appendChild(h("div", "ssc-calc-empty", "Er zijn nog geen programmas beschikbaar"));
    } else {
      programs.forEach(function (p) {
        list.appendChild(buildRow(p));
      });
    }

    // Connection
    var conn = h("div", "ssc-ti-conn");
    conn.setAttribute("data-on", link ? "1" : "0");
    conn.appendChild(h("span", "ssc-ti-dot"));
    conn.appendChild(h("span", "ssc-ti-conn-text", link ? deviceLabel(link.device) : "Geen rekentoestel verbonden"));
    var cbtn = h("button", "ssc-ti-btn" + (link ? "" : " ssc-ti-btn--main"), link ? "Verbreek" : "Verbind met rekenmachine");
    cbtn.type = "button";
    cbtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (link) disconnect();
      else connect(); // synchronously inside the click: keeps the user gesture
    });
    conn.appendChild(cbtn);
    side.appendChild(conn);
    if (ui.wizard && !link) side.appendChild(buildWizard());

    if (ui.msg) {
      var m = h("div", "ssc-ti-msg", ui.msg.text);
      m.setAttribute("data-tone", ui.msg.tone);
      side.appendChild(m);
    }

    // Host: add or update a program
    if (isHost()) {
      if (draft) {
        side.appendChild(buildForm());
      } else {
        var open = h("button", "ssc-ti-btn", "＋ Rekentoestelprogramma toevoegen");
        open.type = "button";
        open.addEventListener("click", function (e) {
          e.stopPropagation();
          openDraft(null);
        });
        side.appendChild(open);
      }
    }

    if (userId) side.appendChild(h("div", "ssc-ti-uid", "Jouw gebruikers-ID: " + userId));
  }

  /* --- live list --- */

  /*
   * While the window is open the list is read again every LIVE_MS, so an
   * update by the host shows up without reopening it. A repaint only
   * happens when something changed, and never while the host is typing in
   * the form.
   */
  var LIVE_MS = 15000;
  var liveTimer = 0;

  function signature(list) {
    return list.map(function (p) {
      return p.id + ":" + versionOf(p) + ":" + (p.calcName || "") + ":" + p.title + ":" + (p.description || "");
    }).join("|");
  }

  function startLive() {
    window.clearInterval(liveTimer);
    liveTimer = window.setInterval(function () {
      if (!ui.root || !ui.root.isConnected) {
        window.clearInterval(liveTimer);
        liveTimer = 0;
        return;
      }
      if (document.hidden || !store.className) return;
      var before = signature(store.programs);
      loadPrograms().then(function () {
        if (draft || signature(store.programs) === before) return;
        if (ui.root && ui.root.isConnected) paint();
      });
    }, LIVE_MS);
  }

  /** Draws the TI-84 section into the calculator window's body. */
  function render(container, opts) {
    ui.root = h("div", "ssc-ti");
    container.appendChild(ui.root);
    store.loaded = false;
    paint();
    autoConnect();
    Promise.all([resolveUser(), resolveClass(opts && opts.className), loadSent()]).then(function (out) {
      store.className = out[1];
      return loadPrograms();
    }).then(migrateLocal).then(function () {
      if (ui.root && ui.root.isConnected) paint();
      startLive();
    });
  }

  window.sscTi84 = {
    CSS: CSS,
    render: render,
    autoConnect: autoConnect,
    // For tests: the file and packet code, without a device.
    _test: {
      parseTiFile: parseTiFile,
      pythonVariable: pythonVariable,
      variableOf: variableOf,
      calcName: calcName,
      setHosts: function (ids) {
        HOST_USER_IDS = ids.slice();
        hostIds = HOST_USER_IDS;
      },
    },
  };
})();
