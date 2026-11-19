/**
 * Smartschool Combined — admin board (owner only), loaded on demand (lazy.js module "admin").
 *
 * Looks like the settings window: a sidebar with the pages and the content next to it.
 *   Leerlingen   coins of every student of the class, typed straight into a box
 *   Wedstrijden  league results, scores typed straight into boxes
 *   Meldingen    popup messages to everyone or to chosen students, plus the ones already sent
 *   Info         the Firebase uid to put under /admins and what the database rules decide
 *
 * The button that opens this (content.js) is only shown to the owner, but that is only the interface: every
 * write is allowed or refused by the database rules (/admins/{uid}). It lives in its own shadow root so the
 * page and the theme cannot make it see-through.
 */
(function () {
  "use strict";

  if (window.sscAdminOpen) return;

  var CSS = [
    ":host { all: initial; }",
    "* { box-sizing: border-box; }",
    ".dim { position: fixed; inset: 0; background: rgba(8,10,16,.62); display: grid; place-items: center; padding: 3vh 3vw; font: 14px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif; color: var(--ssc-text, #1a1a2e); }",
    ".win { width: min(1180px, 100%); height: min(780px, 100%); display: flex; border-radius: 22px; overflow: hidden;",
    "  background: var(--ssc-base00, #f6f7fb); box-shadow: 0 30px 90px -20px rgba(0,0,0,.55), 0 0 0 1px rgba(128,128,128,.25); }",
    ".side { flex: none; width: 250px; padding: 14px; display: flex; flex-direction: column; gap: 10px; overflow: auto;",
    "  background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 5%, var(--ssc-base00, #f6f7fb)); border-right: 1px solid rgba(128,128,128,.22); }",
    ".card { padding: 12px 14px; border-radius: 16px; background: var(--ssc-base00, #fff); box-shadow: 0 1px 0 rgba(255,255,255,.4) inset, 0 6px 16px -10px rgba(0,0,0,.35); }",
    ".card b { display: block; font-size: 15px; } .card span { font-size: 12px; opacity: .7; }",
    ".nav { display: flex; align-items: center; gap: 11px; padding: 10px 12px; border-radius: 16px; border: 1px solid transparent; background: var(--ssc-base00, #fff); cursor: pointer; font: inherit; color: inherit; text-align: left; width: 100%;",
    "  box-shadow: 0 6px 16px -12px rgba(0,0,0,.4); transition: transform .15s, box-shadow .15s; }",
    ".nav:hover { transform: translateY(-1px); }",
    ".nav[aria-current='page'] { border-color: var(--ssc-accent, #2b6cb0); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ssc-accent, #2b6cb0) 22%, transparent); }",
    ".ico { flex: none; width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; color: #fff; font-size: 17px; }",
    ".main { flex: 1; min-width: 0; display: flex; flex-direction: column; }",
    ".top { display: flex; align-items: center; gap: 10px; padding: 18px 24px 8px; }",
    ".top h1 { margin: 0; font-size: 26px; flex: 1; letter-spacing: -.01em; }",
    ".x { width: 34px; height: 34px; border-radius: 50%; border: 0; cursor: pointer; font: inherit; font-size: 18px; color: inherit; background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 9%, transparent); }",
    ".x:hover { background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 16%, transparent); }",
    ".status { padding: 0 24px 8px; min-height: 26px; font-size: 13px; opacity: .85; }",
    ".status[data-kind='ok'] { color: #1f8f55; opacity: 1; } .status[data-kind='err'] { color: #c0392b; opacity: 1; font-weight: 600; }",
    ".body { flex: 1; overflow: auto; padding: 4px 24px 24px; }",
    "h2 { font-size: 16px; margin: 18px 0 8px; }",
    ".panel { border-radius: 16px; background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 4%, var(--ssc-base00, #fff)); padding: 6px 4px; box-shadow: 0 0 0 1px rgba(128,128,128,.16) inset; }",
    "table { border-collapse: collapse; width: 100%; } th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; opacity: .65; padding: 8px 12px; white-space: nowrap; }",
    "td { padding: 7px 12px; border-top: 1px solid rgba(128,128,128,.16); vertical-align: middle; } td.mut { opacity: .6; font-size: 12px; }",
    "input[type=text], input[type=number], input[type=search], textarea { font: inherit; color: inherit; background: var(--ssc-base00, #fff); border: 1px solid rgba(128,128,128,.4); border-radius: 10px; padding: 7px 10px; min-width: 0; }",
    "input:focus, textarea:focus { outline: 2px solid var(--ssc-accent, #2b6cb0); outline-offset: 1px; }",
    "input[type=number] { width: 96px; text-align: right; } textarea { width: 100%; min-height: 120px; resize: vertical; }",
    ".btn { font: inherit; font-weight: 600; color: var(--on-accent, #fff); background: var(--ssc-accent, #2b6cb0); border: 0; border-radius: 10px; padding: 8px 14px; cursor: pointer; }",
    ".btn:hover:not(:disabled) { filter: brightness(1.08); } .btn:disabled { opacity: .5; cursor: default; }",
    ".btn.ghost { color: inherit; background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 9%, transparent); }",
    ".btn.warn { background: #c0392b; color: #fff; } .btn.sm { padding: 5px 10px; font-size: 13px; }",
    ".row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; } .row + .row { margin-top: 10px; }",
    ".field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; } .field > label { font-weight: 700; font-size: 13px; }",
    ".hint { font-size: 12px; opacity: .65; } .count { font-size: 12px; opacity: .65; text-align: right; }",
    ".pick { max-height: 240px; overflow: auto; border-radius: 12px; border: 1px solid rgba(128,128,128,.3); padding: 4px 8px; background: var(--ssc-base00, #fff); }",
    ".pick label { display: flex; align-items: center; gap: 9px; padding: 5px 2px; cursor: pointer; }",
    ".seg { display: inline-flex; border-radius: 12px; overflow: hidden; border: 1px solid rgba(128,128,128,.4); align-self: flex-start; }",
    ".seg button { font: inherit; border: 0; padding: 8px 16px; cursor: pointer; color: inherit; background: transparent; }",
    ".seg button[aria-pressed='true'] { background: var(--ssc-accent, #2b6cb0); color: var(--on-accent, #fff); font-weight: 600; }",
    ".match { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-top: 1px solid rgba(128,128,128,.16); }",
    ".match .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".match input[type=number] { width: 64px; text-align: center; }",
    ".sent { display: flex; align-items: flex-start; gap: 12px; padding: 10px 12px; border-top: 1px solid rgba(128,128,128,.16); } .sent .t { flex: 1; min-width: 0; } .sent .t b { display: block; }",
    ".sent .t span { font-size: 12px; opacity: .65; } .sent p { margin: 3px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }",
    "code { background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 10%, transparent); padding: 2px 6px; border-radius: 6px; user-select: all; overflow-wrap: anywhere; }",
    "ol { padding-left: 20px; } li { margin: 6px 0; }",
    "@media (max-width: 760px) { .win { flex-direction: column; } .side { width: auto; flex-direction: row; overflow-x: auto; } .card { display: none; } .nav span.lbl { display: none; } }",
  ].join("\n");

  var PAGES = [
    { id: "students", label: "Leerlingen", icon: "🪙", color: "linear-gradient(135deg,#8b5cf6,#d946ef)" },
    { id: "matches", label: "Wedstrijden", icon: "⚽", color: "linear-gradient(135deg,#10b981,#14b8a6)" },
    { id: "notify", label: "Meldingen", icon: "🔔", color: "linear-gradient(135deg,#f59e0b,#eab308)" },
    { id: "info", label: "Info", icon: "⚙", color: "linear-gradient(135deg,#6366f1,#3b82f6)" },
  ];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = String(text);
    return n;
  }

  function ask(msg) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage(msg, function (res) {
          resolve(chrome.runtime.lastError ? null : res);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  function why(r) {
    if (!r) return "Geen verbinding met de extensie.";
    if (r.error === "http") return "De database weigert dit (staat je uid onder /admins en zijn de rules gedeployed?)";
    if (r.error === "bad_request") return "Ongeldige invoer.";
    return "Mislukt (" + (r.error || "onbekend") + ").";
  }

  function open() {
    if (document.getElementById("ssc-admin")) return;

    var host = el("div");
    host.id = "ssc-admin";
    host.style.cssText = "position:fixed;inset:0;z-index:2147483000";
    var shadow = host.attachShadow({ mode: "open" });
    var dim = el("div", "dim");
    var win = el("div", "win");
    var side = el("div", "side");
    var main = el("div", "main");
    var top = el("div", "top");
    var title = el("h1", "", "");
    var closeBtn = el("button", "x", "✕");
    closeBtn.title = "Sluiten";
    var statusEl = el("div", "status");
    var body = el("div", "body");
    top.appendChild(title); top.appendChild(closeBtn);
    main.appendChild(top); main.appendChild(statusEl); main.appendChild(body);
    win.appendChild(side); win.appendChild(main); dim.appendChild(win);
    shadow.appendChild(el("style", "", CSS)); shadow.appendChild(dim);
    document.documentElement.appendChild(host);
    // Text on the accent colour: dark on a light accent, white on a dark one (a fixed white was unreadable on light themes).
    var probe = el("span"); probe.style.color = "var(--ssc-accent, #2b6cb0)"; shadow.appendChild(probe);
    var rgb = (getComputedStyle(probe).color.match(/[\d.]+/g) || [43, 108, 176]).map(Number); probe.remove();
    var lum = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
    win.style.setProperty("--on-accent", lum > 0.58 ? "#111" : "#fff");

    function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); close(); } }
    function close() {
      document.removeEventListener("keydown", onKey, true);
      host.remove();
    }
    closeBtn.addEventListener("click", close);
    dim.addEventListener("mousedown", function (e) { if (e.target === dim) close(); });
    document.addEventListener("keydown", onKey, true);

    function say(text, kind) { statusEl.textContent = text || ""; statusEl.setAttribute("data-kind", kind || ""); }

    /* ---------- sidebar ---------- */
    var classIn = el("input"); classIn.type = "text"; classIn.value = "5D-TWE"; classIn.setAttribute("aria-label", "Klas"); classIn.style.width = "110px";
    var who = el("div", "card");
    who.appendChild(el("b", "", "Beheer"));
    who.appendChild(el("span", "", "alleen voor de eigenaar"));
    var classRow = el("div", "row"); classRow.style.marginTop = "8px";
    var reload = el("button", "btn sm", "Laden"); reload.type = "button";
    classRow.appendChild(classIn); classRow.appendChild(reload); who.appendChild(classRow);
    side.appendChild(who);

    var navBtns = {};
    PAGES.forEach(function (p) {
      var b = el("button", "nav"); b.type = "button";
      var ico = el("span", "ico", p.icon); ico.style.background = p.color;
      b.appendChild(ico); b.appendChild(el("span", "lbl", p.label));
      b.addEventListener("click", function () { go(p.id); });
      navBtns[p.id] = b; side.appendChild(b);
    });

    /* ---------- data ---------- */
    var data = { members: {}, matches: {}, uid: "", loaded: false };
    var page = "students";

    function memberName(id) { return (data.members[id] && data.members[id].displayName) || id; }
    function sortedIds() {
      return Object.keys(data.members).sort(function (a, b) { return String(memberName(a)).localeCompare(String(memberName(b))); });
    }

    function load() {
      say("Laden...");
      return ask({ type: "ssc:leagueGet", className: classIn.value.trim() }).then(function (r) {
        if (!r || !r.ok) { say("Laden mislukt (" + ((r && r.error) || "geen verbinding") + ").", "err"); return; }
        data.members = r.members || {}; data.matches = r.matches || {}; data.loaded = true;
        say(Object.keys(data.members).length + " leerlingen, " + Object.keys(data.matches).length + " weekends geladen.", "ok");
        render();
      });
    }
    reload.addEventListener("click", load);
    ask({ type: "ssc:calcInfo" }).then(function (r) { if (r && r.authUid) { data.uid = r.authUid; if (page === "info") render(); } });

    function go(id) { page = id; render(); }

    function render() {
      PAGES.forEach(function (p) { if (p.id === page) navBtns[p.id].setAttribute("aria-current", "page"); else navBtns[p.id].removeAttribute("aria-current"); });
      title.textContent = PAGES.filter(function (p) { return p.id === page; })[0].label;
      body.textContent = "";
      ({ students: pageStudents, matches: pageMatches, notify: pageNotify, info: pageInfo })[page]();
    }

    function numberBox(value, max) {
      var i = el("input"); i.type = "number"; i.min = "0"; i.step = "1"; i.value = String(value);
      if (max !== undefined) i.max = String(max);
      return i;
    }

    /* ---------- Leerlingen ---------- */
    function pageStudents() {
      if (!data.loaded) { body.appendChild(el("p", "hint", "Druk op Laden om de klas op te halen.")); return; }
      var filter = el("input"); filter.type = "search"; filter.placeholder = "Zoek een leerling...";
      var row = el("div", "row"); row.appendChild(filter);
      row.appendChild(el("span", "hint", "Typ een nieuw aantal munten en druk op Enter, klik weg of druk op Opslaan."));
      body.appendChild(row);
      var panel = el("div", "panel"); panel.style.marginTop = "12px";
      var table = el("table"), head = el("tr");
      ["Naam", "Id", "Munten", "Piek", "Boerderij", "Laatst gezien", ""].forEach(function (t) { head.appendChild(el("th", "", t)); });
      table.appendChild(head);
      var rows = [];
      sortedIds().forEach(function (id) {
        var m = data.members[id] || {};
        var tr = el("tr");
        var coinsCell = el("td", "", "..."), peakCell = el("td", "", "..."), farmCell = el("td", "", "..."), act = el("td");
        tr.appendChild(el("td", "", m.displayName || "Speler")); tr.appendChild(el("td", "mut", id));
        tr.appendChild(coinsCell); tr.appendChild(peakCell); tr.appendChild(farmCell);
        tr.appendChild(el("td", "mut", m.lastUpdated ? new Date(m.lastUpdated).toLocaleString("nl-BE") : "-")); tr.appendChild(act);
        table.appendChild(tr); rows.push([tr, String(m.displayName || "").toLowerCase() + " " + id.toLowerCase()]);
        ask({ type: "ssc:stateGet", kind: "economy", userId: id }).then(function (r) {
          var cur = (r && r.ok && r.state) || null;
          peakCell.textContent = cur ? cur.peak : "-";
          if (!cur) { coinsCell.textContent = "geen data"; return; }
          coinsCell.textContent = "";
          var input = numberBox(cur.coins || 0);
          var save = function () { saveCoins(id, input, peakCell, cur); };
          input.addEventListener("change", save);
          coinsCell.appendChild(input);
          var b = el("button", "btn sm", "Opslaan"); b.type = "button"; b.addEventListener("click", save); act.appendChild(b);
        });
        ask({ type: "ssc:stateGet", kind: "farm", userId: id }).then(function (r) { var f = r && r.ok && r.state; farmCell.textContent = f ? "level " + f.level : "-"; });
      });
      panel.appendChild(table); body.appendChild(panel);
      filter.addEventListener("input", function () {
        var q = filter.value.trim().toLowerCase();
        rows.forEach(function (x) { x[0].style.display = !q || x[1].indexOf(q) !== -1 ? "" : "none"; });
      });
    }

    function saveCoins(id, input, peakCell, cur) {
      var n = Math.floor(Number(input.value));
      if (input.value === "" || !isFinite(n) || n < 0) { say("Geen geldig getal.", "err"); input.value = String(cur.coins || 0); return; }
      if (n === (cur.coins || 0) || input._busy) return;
      input._busy = true;
      var now = Date.now();
      var next = Object.assign({}, cur, { coins: n, peak: Math.max(Number(cur.peak) || 0, n), updatedAt: now, adminSetAt: now });
      say("Opslaan...");
      ask({ type: "ssc:stateSave", kind: "economy", userId: id, state: next }).then(function (r) {
        input._busy = false;
        if (r && r.ok) { cur.coins = n; cur.peak = next.peak; cur.adminSetAt = now; peakCell.textContent = next.peak; say("Opgeslagen: " + memberName(id) + " heeft nu " + n + " munten.", "ok"); }
        else { input.value = String(cur.coins || 0); say(why(r), "err"); }
      });
    }

    /* ---------- Wedstrijden ---------- */
    function pageMatches() {
      if (!data.loaded) { body.appendChild(el("p", "hint", "Druk op Laden om de klas op te halen.")); return; }
      body.appendChild(el("p", "hint", "Typ de nieuwe scores (0 tot 11, samen maximaal 11) en druk op Enter, klik weg of druk op Opslaan."));
      var weeks = Object.keys(data.matches).sort().reverse();
      if (!weeks.length) body.appendChild(el("p", "", "Nog geen uitslagen."));
      weeks.forEach(function (weekId) {
        var wk = data.matches[weekId] || {};
        body.appendChild(el("h2", "", "Weekend " + weekId + (wk.bye ? " (vrij: " + memberName(wk.bye) + ")" : "")));
        var panel = el("div", "panel");
        Object.keys(wk.matches || {}).sort().forEach(function (key) {
          var m = wk.matches[key], r = el("div", "match");
          var in1 = numberBox(m.score1, 11), in2 = numberBox(m.score2, 11);
          var save = function () { saveMatch(weekId, key, m, in1, in2); };
          in1.addEventListener("change", save); in2.addEventListener("change", save);
          var nm1 = el("span", "nm", memberName(m.user1)), nm2 = el("span", "nm", memberName(m.user2));
          nm1.style.textAlign = "right";
          var b = el("button", "btn sm", "Opslaan"); b.type = "button"; b.addEventListener("click", save);
          [nm1, in1, el("span", "", "-"), in2, nm2, b].forEach(function (n) { r.appendChild(n); });
          panel.appendChild(r);
        });
        body.appendChild(panel);
      });
    }

    function saveMatch(weekId, key, m, in1, in2) {
      var a = Math.floor(Number(in1.value)), b = Math.floor(Number(in2.value));
      if (in1.value === "" || in2.value === "" || !isFinite(a) || !isFinite(b) || a < 0 || b < 0 || a > 11 || b > 11 || a + b > 11) {
        say("Ongeldige score (0 tot 11, samen maximaal 11).", "err"); in1.value = String(m.score1); in2.value = String(m.score2); return;
      }
      if ((a === m.score1 && b === m.score2) || in1._busy) return;
      in1._busy = true; say("Opslaan...");
      ask({ type: "ssc:adminSetMatch", className: classIn.value.trim(), weekId: weekId, key: key, score1: a, score2: b }).then(function (r) {
        in1._busy = false;
        if (r && r.ok) { m.score1 = a; m.score2 = b; say("Uitslag opgeslagen.", "ok"); }
        else { in1.value = String(m.score1); in2.value = String(m.score2); say(why(r), "err"); }
      });
    }

    /* ---------- Meldingen ---------- */
    var draft = { title: "", text: "", mode: "all", picked: {} };
    var sent = null;

    function pageNotify() {
      body.appendChild(el("p", "hint", "Een melding verschijnt als popup bij de ontvangers, zodra ze Smartschool openen of verversen. Alleen platte tekst."));
      var f1 = el("div", "field"); f1.appendChild(el("label", "", "Titel"));
      var t = el("input"); t.type = "text"; t.maxLength = 80; t.value = draft.title; t.placeholder = "Bijvoorbeeld: Nieuwe update";
      f1.appendChild(t); body.appendChild(f1);
      var f2 = el("div", "field"); f2.appendChild(el("label", "", "Bericht"));
      var ta = el("textarea"); ta.maxLength = 600; ta.value = draft.text; ta.placeholder = "Schrijf je melding...";
      var cnt = el("div", "count", ta.value.length + " / 600");
      f2.appendChild(ta); f2.appendChild(cnt); body.appendChild(f2);
      t.addEventListener("input", function () { draft.title = t.value; });
      ta.addEventListener("input", function () { draft.text = ta.value; cnt.textContent = ta.value.length + " / 600"; });

      var f3 = el("div", "field"); f3.appendChild(el("label", "", "Ontvangers"));
      var seg = el("div", "seg"), bAll = el("button", "", "Iedereen"), bSel = el("button", "", "Geselecteerde leerlingen");
      bAll.type = bSel.type = "button"; seg.appendChild(bAll); seg.appendChild(bSel); f3.appendChild(seg);
      var pickBox = el("div"); f3.appendChild(pickBox); body.appendChild(f3);
      function paintMode() {
        bAll.setAttribute("aria-pressed", String(draft.mode === "all")); bSel.setAttribute("aria-pressed", String(draft.mode === "sel"));
        pickBox.textContent = "";
        if (draft.mode !== "sel") { pickBox.appendChild(el("p", "hint", "Alle gebruikers van de extensie krijgen de melding.")); return; }
        if (!data.loaded) { pickBox.appendChild(el("p", "hint", "Druk eerst op Laden om de klas op te halen.")); return; }
        var tools = el("div", "row"), search = el("input"); search.type = "search"; search.placeholder = "Zoek...";
        var all = el("button", "btn ghost sm", "Alles"), none = el("button", "btn ghost sm", "Niets"), n = el("span", "hint");
        all.type = none.type = "button";
        [search, all, none, n].forEach(function (x) { tools.appendChild(x); }); pickBox.appendChild(tools);
        var list = el("div", "pick"); list.style.marginTop = "8px"; pickBox.appendChild(list);
        var items = [];
        function count() { n.textContent = Object.keys(draft.picked).length + " geselecteerd"; }
        sortedIds().forEach(function (id) {
          var lab = el("label"), cb = el("input"); cb.type = "checkbox"; cb.checked = !!draft.picked[id];
          cb.addEventListener("change", function () { if (cb.checked) draft.picked[id] = true; else delete draft.picked[id]; count(); });
          lab.appendChild(cb); lab.appendChild(el("span", "", memberName(id))); lab.appendChild(el("span", "hint", id));
          list.appendChild(lab); items.push({ id: id, lab: lab, cb: cb, text: (memberName(id) + " " + id).toLowerCase() });
        });
        search.addEventListener("input", function () { var q = search.value.trim().toLowerCase(); items.forEach(function (x) { x.lab.style.display = !q || x.text.indexOf(q) !== -1 ? "" : "none"; }); });
        all.addEventListener("click", function () { items.forEach(function (x) { if (x.lab.style.display !== "none") { x.cb.checked = true; draft.picked[x.id] = true; } }); count(); });
        none.addEventListener("click", function () { draft.picked = {}; items.forEach(function (x) { x.cb.checked = false; }); count(); });
        count();
      }
      bAll.addEventListener("click", function () { draft.mode = "all"; paintMode(); });
      bSel.addEventListener("click", function () { draft.mode = "sel"; paintMode(); });
      paintMode();

      var actions = el("div", "row");
      var preview = el("button", "btn ghost", "Voorbeeld"), send = el("button", "btn", "Verstuur melding");
      preview.type = send.type = "button";
      actions.appendChild(preview); actions.appendChild(send); body.appendChild(actions);

      preview.addEventListener("click", function () {
        if (!draft.title.trim() || !draft.text.trim()) { say("Vul een titel en een bericht in.", "err"); return; }
        if (typeof window.sscLoadModule !== "function") return;
        window.sscLoadModule("announce").then(function () {
          window.sscAnnounceShow([{ id: "preview", title: draft.title.trim(), body: draft.text.trim(), createdAt: Date.now() }], function () {});
        }, function () { say("De popup kon niet geladen worden.", "err"); });
      });

      var armed = false;
      send.addEventListener("click", function () {
        var ids = Object.keys(draft.picked);
        if (!draft.title.trim() || !draft.text.trim()) { say("Vul een titel en een bericht in.", "err"); return; }
        if (draft.mode === "sel" && !ids.length) { say("Kies minstens één leerling of kies Iedereen.", "err"); return; }
        if (!armed) {
          armed = true;
          send.textContent = draft.mode === "all" ? "Zeker? Naar iedereen versturen" : "Zeker? Naar " + ids.length + " leerling(en) versturen";
          send.classList.add("warn");
          setTimeout(function () { armed = false; send.textContent = "Verstuur melding"; send.classList.remove("warn"); }, 5000);
          return;
        }
        send.disabled = true; say("Versturen...");
        ask({ type: "ssc:announceSend", title: draft.title.trim(), body: draft.text.trim(), toAll: draft.mode === "all", toIds: draft.mode === "all" ? [] : ids }).then(function (r) {
          if (r && r.ok) { draft.title = ""; draft.text = ""; draft.picked = {}; say("Melding verstuurd.", "ok"); sent = null; render(); }
          else { send.disabled = false; armed = false; send.textContent = "Verstuur melding"; send.classList.remove("warn"); say(why(r), "err"); }
        });
      });

      var h2 = el("h2", "", "Verstuurde meldingen "); var refresh = el("button", "btn ghost sm", "Vernieuwen"); refresh.type = "button"; h2.appendChild(refresh); body.appendChild(h2);
      refresh.addEventListener("click", function () { sent = null; paintSent(); loadSent(); });
      var listEl = el("div", "panel"); body.appendChild(listEl);
      function paintSent() {
        listEl.textContent = "";
        if (!sent) { listEl.appendChild(el("p", "hint", "Laden...")); return; }
        if (!sent.length) { listEl.appendChild(el("p", "hint", "Nog niets verstuurd.")); return; }
        sent.forEach(function (it) {
          var r = el("div", "sent"), tx = el("div", "t");
          tx.appendChild(el("b", "", it.title));
          tx.appendChild(el("span", "", new Date(it.createdAt).toLocaleString("nl-BE") + " · " + (it.toAll ? "iedereen" : (it.toIds || []).map(memberName).join(", "))));
          tx.appendChild(el("p", "", it.body));
          var seen = it.seen || {};
          var who = it.toAll ? sortedIds().concat(Object.keys(seen).filter(function (x) { return !data.members[x]; })) : (it.toIds || []);
          var got = who.filter(function (x) { return seen[x]; }).length;
          var det = el("details"); det.style.marginTop = "6px";
          det.appendChild(el("summary", "", "Ontvangen: " + got + (it.toAll ? " (van " + sortedIds().length + " in de klas + anderen)" : " van " + who.length)));
          who.forEach(function (x) {
            var li = el("div", "hint", (seen[x] ? "✓ " : "• ") + memberName(x) + (seen[x] ? " — ontvangen " + new Date(seen[x]).toLocaleString("nl-BE") : " — nog niet ontvangen"));
            if (seen[x]) li.style.opacity = "1";
            det.appendChild(li);
          });
          tx.appendChild(det);
          var del = el("button", "btn ghost sm", "Intrekken"); del.type = "button";
          var arm = false;
          del.addEventListener("click", function () {
            if (!arm) { arm = true; del.textContent = "Zeker?"; del.classList.add("warn"); setTimeout(function () { arm = false; del.textContent = "Intrekken"; del.classList.remove("warn"); }, 4000); return; }
            ask({ type: "ssc:announceDelete", id: it.id }).then(function (res) {
              if (res && res.ok) { sent = sent.filter(function (x) { return x.id !== it.id; }); say("Melding ingetrokken.", "ok"); paintSent(); }
              else say(why(res), "err");
            });
          });
          r.appendChild(tx); r.appendChild(del); listEl.appendChild(r);
        });
      }
      function loadSent() {
        ask({ type: "ssc:announceList" }).then(function (r) {
          sent = r && r.ok ? r.items : [];
          if (page === "notify") paintSent();
        });
      }
      paintSent();
      if (!sent) loadSent();
    }

    /* ---------- Info ---------- */
    function pageInfo() {
      body.appendChild(el("h2", "", "Jouw database-id"));
      var p = el("p"); p.appendChild(el("code", "", data.uid || "nog niet beschikbaar"));
      body.appendChild(p);
      body.appendChild(el("h2", "", "Zo mag je aanpassen en versturen"));
      var ol = el("ol");
      ["Open de Firebase-console van het project, onder Realtime Database.",
        "Maak onder het hoofdknooppunt een knooppunt admins en zet daaronder jouw id hierboven met de waarde true.",
        "Deploy de bijgewerkte database.rules.json (die laat alleen admins meldingen versturen en scores aanpassen).",
        "Druk op Laden: aanpassingen worden nu opgeslagen."].forEach(function (s) { ol.appendChild(el("li", "", s)); });
      body.appendChild(ol);
      body.appendChild(el("p", "hint", "Deze knop en dit bord zijn alleen de interface. Of een aanpassing of melding doorgaat, beslist de database."));
    }

    render();
    load();
  }

  window.sscAdminOpen = open;
})();
