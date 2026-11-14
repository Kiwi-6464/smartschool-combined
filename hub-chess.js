/**
 * Smartschool Combined — the Hub's chess island.
 *
 * Play against a bot or with two on one screen, with clocks, and review the game
 * afterwards (best move, blunder, brilliant...). Rules come from chess-engine.js,
 * bots and review from chess-bot.js. Bot games never touch a rating.
 * Settings and the per-bot record are saved per user under sscChess_{userId}.
 *
 * Loaded lazily (lazy.js module "chess").
 */
(function () {
  "use strict";

  if (window.sscSkipPage) return;
  if (window.sscHubChess) return;

  var chess = window.sscChess;
  var ai = window.sscChessBot;

  /* Piece art, 45 x 45. One shape per kind; colour comes from the .ch-w / .ch-b class. */
  var BASE = '<rect x="10" y="35" width="25" height="4.5" rx="1.6"/>';
  var SHAPES = {
    P: '<circle cx="22.5" cy="13" r="5.2"/><path d="M16.5 19h12v2.6h-12z"/><path d="M15.5 34c0-6.5 3.2-8.5 4.2-12.4h5.6c1 3.900 4.200 5.900 4.200 12.400z"/>',
    R: '<path d="M12.500 8h4.500v3h3.300V8h4.400v3H28V8h4.500v7.500l-3 2.800v10.200l3 5.500h-20l3-5.500V18.300l-3-2.800z"/>',
    N: '<path d="M13.500 34c0-8.500 3.800-11.800 7.500-14.800l-5.500 1.300-2.300-3.200 7.800-8.300 1.600-3.500 2.600 3.200c6.300 3.200 8.300 10.300 8.300 25.300z"/><circle class="ch-eye" cx="21.200" cy="13.600" r="1.100"/>',
    B: '<circle cx="22.5" cy="7.300" r="2.600"/><path d="M22.500 10.500c-5.300 4.300-7.500 8.300-7.500 12.300 0 3 2 5 4.300 6l-3.300 5.200h13l-3.300-5.200c2.300-1 4.300-3 4.300-6 0-4-2.200-8-7.500-12.300z"/><path class="ch-cut" d="M22.500 15.500v7M19.500 19h6"/>',
    Q: '<circle cx="8.500" cy="13" r="2.300"/><circle cx="15.800" cy="9" r="2.300"/><circle cx="22.500" cy="7.500" r="2.300"/><circle cx="29.200" cy="9" r="2.300"/><circle cx="36.500" cy="13" r="2.300"/><path d="M8.500 14.500l5 12.500h18l5-12.500-6.300 6.500-1.500-10.500-6.200 9.500-6.200-9.500-1.500 10.500z"/><path d="M13.500 28h18l1.200 6h-20.400z"/>',
    K: '<path d="M20.900 3.500h3.200v3h3.100v3.200h-3.100V14h-3.200V9.700h-3.100V6.500h3.100z"/><path d="M22.500 15.500c-7.800-5.300-13.300 1.700-11.300 8 1 3 3 5 4 10.500h14.600c1-5.500 3-7.500 4-10.500 2-6.300-3.500-13.300-11.300-8z"/>'
  };

  function pieceSvg(p) {
    var white = p === p.toUpperCase();
    return '<svg viewBox="0 0 45 45" class="' + (white ? "ch-w" : "ch-b") + '" aria-hidden="true">' +
      SHAPES[p.toUpperCase()] + BASE + "</svg>";
  }

  /* Bot portraits: drawn, not photos. Keyed on the bot id. */
  var FACES = {
    pion: { bg: "#ffd9a8", skin: "#f6c9a0", hair: "#b5532a", shirt: "#e8734a", style: "curly", mouth: "grin" },
    toren: { bg: "#bfe3c8", skin: "#e9b98c", hair: "#3a2a1e", shirt: "#2f8f5b", style: "short", mouth: "smile" },
    loper: { bg: "#cdd9ff", skin: "#c98f62", hair: "#1f1a17", shirt: "#4d63c9", style: "long", mouth: "smile" },
    paard: { bg: "#f3e2a6", skin: "#f2cfae", hair: "#8a6a3b", shirt: "#8a6d1f", style: "side", mouth: "flat", glasses: true },
    dame: { bg: "#f1c6dd", skin: "#b9794e", hair: "#17120f", shirt: "#a8326f", style: "bun", mouth: "smirk" },
    koning: { bg: "#c9ccd4", skin: "#eec5a2", hair: "#55585f", shirt: "#23262d", style: "beard", mouth: "flat", stern: true }
  };
  var HAIR = {
    short: '<path d="M14 21c-1-9 5-13 10-13s11 4 10 13c-2-4-5-6-10-6s-8 2-10 6z"/>',
    side: '<path d="M14 22c-2-10 5-14 11-14 6 0 10 4 9 11-4-1-9-3-12-7-1 4-4 8-8 10z"/>',
    bun: '<circle cx="24" cy="7" r="4.200"/><path d="M14 21c-1-9 5-13 10-13s11 4 10 13c-2-4-5-6-10-6s-8 2-10 6z"/>',
    long: '<path d="M14 20c-1-8 5-12 10-12s11 4 10 12c-3-3-6-5-10-5s-7 2-10 5z"/>',
    curly: '<circle cx="15" cy="15.500" r="5"/><circle cx="20.500" cy="11" r="5"/><circle cx="27.500" cy="11" r="5"/><circle cx="33" cy="15.500" r="5"/><circle cx="13.800" cy="21" r="3.400"/><circle cx="34.200" cy="21" r="3.400"/>',
    beard: '<path d="M14.200 24c0 9 4.300 13 9.800 13s9.800-4 9.800-13c-2 4-5 5.500-9.800 5.500s-7.800-1.500-9.800-5.500z"/>'
  };
  var MOUTH = {
    smile: "M20.500 27.500q3.500 2.800 7 0", grin: "M20 27q4 4.500 8 0z", flat: "M21 28.500h6", smirk: "M20.500 28.500q4 1.500 7-1.500"
  };

  function faceSvg(id) {
    var f = FACES[id] || FACES.pion, dark = "#2b2422";
    return '<svg class="ch-face" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="24" fill="' + f.bg + '"/>' +
      (f.style === "long" ? '<path d="M12.500 36V20c0-8 5-12.500 11.500-12.500S35.500 12 35.500 20v16z" fill="' + f.hair + '"/>' : "") +
      '<path d="M7 48c0-9 7.500-12.500 17-12.500S41 39 41 48z" fill="' + f.shirt + '"/>' +
      '<rect x="20.500" y="29" width="7" height="9" rx="3" fill="' + f.skin + '"/>' +
      '<ellipse cx="24" cy="22" rx="10" ry="11.500" fill="' + f.skin + '"/>' +
      '<g fill="' + f.hair + '">' + HAIR[f.style] + '</g>' +
      '<circle cx="20" cy="22" r="1.300" fill="' + dark + '"/><circle cx="28" cy="22" r="1.300" fill="' + dark + '"/>' +
      '<path d="' + (f.stern ? "M17.500 18.500l5 1.500M30.500 18.500l-5 1.500" : "M17.800 19.200q2.200-1.200 4.400 0M25.800 19.200q2.200-1.200 4.400 0") + '" fill="none" stroke="' + f.hair + '" stroke-width="1.200" stroke-linecap="round"/>' +
      '<path d="' + MOUTH[f.mouth] + '" fill="' + (f.mouth === "grin" ? "#fff" : "none") + '" stroke="' + dark + '" stroke-width="1.200" stroke-linecap="round" stroke-linejoin="round"/>' +
      (f.glasses ? '<g fill="none" stroke="' + dark + '" stroke-width="1.100"><circle cx="20" cy="22" r="3.300"/><circle cx="28" cy="22" r="3.300"/><path d="M23.300 22h1.400"/></g>' : "") +
      "</svg>";
  }

  var NAMES = { P: "pion", N: "paard", B: "loper", R: "toren", Q: "dame", K: "koning" };
  var ARROW = {
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.500 5.500 8 12l6.500 6.500" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.500 5.500 16 12l-6.500 6.500" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  var S = ' fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  var ICON = {
    bot: '<svg viewBox="0 0 24 24" aria-hidden="true"><g' + S + '><rect x="5" y="8" width="14" height="10" rx="3"/><path d="M12 8V5M9.5 12.5V14M14.5 12.5V14M2.5 12v3M21.5 12v3"/></g><circle cx="12" cy="4" r="1.3" fill="currentColor"/></svg>',
    local: '<svg viewBox="0 0 24 24" aria-hidden="true"><g' + S + '><circle cx="8.5" cy="8.5" r="3"/><circle cx="16.5" cy="9.5" r="2.5"/><path d="M3 19c0-3.5 2.5-5.5 5.5-5.5S14 15.5 14 19M15.5 14c3 0 5.5 1.5 5.5 5"/></g></svg>',
    online: '<svg viewBox="0 0 24 24" aria-hidden="true"><g' + S + '><circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="3.6" ry="8.5"/><path d="M3.5 12h17"/></g></svg>'
  };

  var TIMES = [
    { id: "none", label: "Geen klok", min: 0, inc: 0 },
    { id: "1+0", label: "1 min", min: 1, inc: 0 },
    { id: "1+1", label: "1 | 1", min: 1, inc: 1 },
    { id: "3+0", label: "3 min", min: 3, inc: 0 },
    { id: "3+2", label: "3 | 2", min: 3, inc: 2 },
    { id: "5+0", label: "5 min", min: 5, inc: 0 },
    { id: "10+0", label: "10 min", min: 10, inc: 0 },
    { id: "15+10", label: "15 | 10", min: 15, inc: 10 },
    { id: "custom", label: "Eigen tijd", min: 0, inc: 0 }
  ];

  var MARK = { brilliant: "!!", great: "!", best: "", excellent: "", good: "", inaccuracy: "?!", mistake: "?", blunder: "??" };
  var ORDER = ["brilliant", "great", "best", "excellent", "good", "inaccuracy", "mistake", "blunder"];

  var CSS = [
    ".chess-holder { flex: 1; display: flex; min-height: 0; }",
    ".ch { flex: 1; min-width: 0; --ch-muted: color-mix(in srgb, var(--hb-ink) 62%, transparent);",
    "  --ch-light: color-mix(in srgb, var(--hb-acc) 16%, white); --ch-dark: color-mix(in srgb, var(--hb-acc) 68%, black);",
    "  --ch-panel: color-mix(in srgb, var(--hb-ink) 6%, transparent); --ch-line: color-mix(in srgb, var(--hb-ink) 14%, transparent); color: var(--hb-ink); }",
    ".ch-btn { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px;",
    "  padding: 9px 16px; border-radius: 12px; font-weight: 700; font-size: 14px; background: var(--ch-panel); border: 1px solid var(--ch-line); }",
    ".ch-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--hb-ink) 11%, transparent); }",
    ".ch-btn:focus-visible, .ch-opt:focus-visible, .ch-sq:focus-visible, .ch-mv:focus-visible { outline: 2px solid var(--hb-acc); outline-offset: 2px; }",
    ".ch-btn:disabled { opacity: .45; cursor: default; }",
    ".ch-btn--go { background: var(--hb-acc); color: var(--hb-on-acc); border-color: transparent; padding: 13px 28px; font-size: 16px; }",
    ".ch-btn--go:hover:not(:disabled) { background: color-mix(in srgb, var(--hb-acc) 86%, var(--hb-ink)); }",
    ".ch-btn--warn[data-arm='1'] { background: var(--hb-red); color: white; border-color: transparent; }",
    ".ch-btn svg { width: 18px; height: 18px; }",

    /* menu */
    ".ch-menu { max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 22px; padding-bottom: 20px; }",
    ".ch-group { display: flex; flex-direction: column; gap: 10px; }",
    ".ch-label { font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--ch-muted); }",
    ".ch-row { display: flex; flex-wrap: wrap; gap: 10px; }",
    ".ch-opt { all: unset; box-sizing: border-box; cursor: pointer; padding: 11px 16px; border-radius: 14px; background: var(--ch-panel);",
    "  border: 1.5px solid var(--ch-line); font-weight: 700; font-size: 14px; display: flex; flex-direction: column; gap: 3px; }",
    ".ch-opt small { font-weight: 500; font-size: 12px; color: var(--ch-muted); }",
    ".ch-opt[aria-pressed='true'] { border-color: var(--hb-acc); background: color-mix(in srgb, var(--hb-acc) 16%, transparent); }",
    ".ch-opt:disabled { opacity: .5; cursor: default; }",
    ".ch-opt--wide { flex: 1 1 200px; padding: 16px 18px; font-size: 16px; }",
    ".ch-bots { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }",
    ".ch-face { display: block; width: 44px; height: 44px; border-radius: 50%; flex: none; box-shadow: 0 0 0 2px var(--ch-line); }",
    ".ch-bot-head { display: flex; align-items: center; gap: 12px; } .ch-bot-head .ch-bot-top { flex: 1; }",
    ".ch-face-wrap .ch-face { width: 36px; height: 36px; }",
    ".ch-bot-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }",
    ".ch-bot-top b { font-size: 15px; } .ch-bot-top i { white-space: nowrap; font-style: normal; font-size: 12px; font-weight: 800; color: var(--hb-acc); }",
    ".ch-custom { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; font-size: 14px; }",
    ".ch-custom input { width: 70px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--ch-line); background: var(--ch-panel);",
    "  color: inherit; font: inherit; }",
    ".ch-check { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }",
    ".ch-note { font-size: 13px; color: var(--ch-muted); }",

    /* game */
    ".ch [hidden] { display: none !important; }",
    ".ch-game { display: grid; grid-template-columns: minmax(280px, min(660px, calc(100vh - 290px))) minmax(260px, 340px); gap: 22px; justify-content: center; align-items: start; }",
    "@media (max-width: 860px) { .ch-game { grid-template-columns: minmax(0, 1fr); } }",
    ".ch-left { display: flex; flex-direction: column; gap: 10px; min-width: 0; }",
    "@media (max-width: 860px) { .ch-left { width: min(100%, 80vh); margin: 0 auto; } }",
    ".ch-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 40px; }",
    ".ch-name { font-weight: 800; font-size: 15px; display: flex; align-items: center; gap: 8px; }",
    ".ch-name i { width: 14px; height: 14px; border-radius: 4px; border: 1.5px solid var(--ch-line); }",
    ".ch-name i[data-c='w'] { background: ivory; } .ch-name i[data-c='b'] { background: color-mix(in srgb, black 88%, white); }",
    ".ch-name small { font-weight: 600; color: var(--ch-muted); }",
    ".ch-clock { font-variant-numeric: tabular-nums; font-weight: 800; font-size: 20px; padding: 6px 14px; border-radius: 10px;",
    "  background: var(--ch-panel); border: 1px solid var(--ch-line); min-width: 84px; text-align: center; opacity: .6; }",
    ".ch-clock[data-on='1'] { opacity: 1; background: var(--hb-ink); color: var(--hb-bg); }",
    ".ch-clock[data-low='1'][data-on='1'] { background: var(--hb-red); color: white; }",
    ".ch-boardwrap { position: relative; }",
    ".ch-board { display: grid; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr); aspect-ratio: 1; border-radius: 10px;",
    "  overflow: hidden; box-shadow: 0 18px 40px -18px var(--hb-shade); user-select: none; touch-action: none; }",
    ".ch-sq { all: unset; box-sizing: border-box; position: relative; display: block; cursor: default; container-type: inline-size; }",
    ".ch-sq[data-t='l'] { background: var(--ch-light); color: var(--ch-dark); } .ch-sq[data-t='d'] { background: var(--ch-dark); color: var(--ch-light); }",
    ".ch-sq[data-own='1'] { cursor: grab; }",
    ".ch-sq[data-last='1']::before, .ch-sq[data-sel='1']::before { content: ''; position: absolute; inset: 0; background: color-mix(in srgb, var(--hb-gold) 55%, transparent); }",
    ".ch-sq[data-check='1']::before { content: ''; position: absolute; inset: 0; background: radial-gradient(circle, var(--hb-red) 20%, transparent 78%); }",
    ".ch-sq[data-dot='1']::after { content: ''; position: absolute; left: 50%; top: 50%; width: 30%; height: 30%; translate: -50% -50%; border-radius: 50%;",
    "  background: color-mix(in srgb, black 26%, transparent); }",
    ".ch-sq[data-dot='2']::after { content: ''; position: absolute; inset: 4%; border-radius: 50%; border: 5cqw solid color-mix(in srgb, black 26%, transparent); box-sizing: border-box; }",
    ".ch-pc { position: absolute; inset: 0; display: block; pointer-events: none; z-index: 1; }",
    ".ch-pc[data-drag='1'] { z-index: 5; scale: 1.12; filter: drop-shadow(0 8px 8px var(--hb-shade)); }",
    ".ch-pc svg { width: 100%; height: 100%; display: block; }",
    ".ch-w { fill: ivory; stroke: black; stroke-width: 1.300; stroke-linejoin: round; }",
    ".ch-b { fill: color-mix(in srgb, black 86%, white); stroke: ivory; stroke-width: .900; stroke-linejoin: round; }",
    ".ch-w .ch-eye, .ch-w .ch-cut { fill: none; stroke: black; stroke-width: 1.600; stroke-linecap: round; } .ch-w .ch-eye { fill: black; stroke: none; }",
    ".ch-b .ch-eye, .ch-b .ch-cut { fill: none; stroke: ivory; stroke-width: 1.600; stroke-linecap: round; } .ch-b .ch-eye { fill: ivory; stroke: none; }",
    ".ch-co { position: absolute; font-size: 17cqw; font-weight: 800; line-height: 1; pointer-events: none; opacity: .85; }",
    ".ch-co--r { left: 5cqw; top: 5cqw; } .ch-co--f { right: 6cqw; bottom: 4cqw; }",
    ".ch-promo { position: absolute; inset: 0; z-index: 8; display: grid; place-items: center; background: color-mix(in srgb, black 45%, transparent); border-radius: 10px; }",
    ".ch-promo-box { display: flex; gap: 8px; padding: 12px; border-radius: 16px; background: var(--hb-bg); box-shadow: 0 20px 40px -12px var(--hb-shade); }",
    ".ch-promo-box button { all: unset; cursor: pointer; width: 64px; height: 64px; border-radius: 12px; background: var(--ch-light); }",
    ".ch-promo-box button:hover, .ch-promo-box button:focus-visible { outline: 3px solid var(--hb-acc); }",

    /* side */
    ".ch-side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }",
    ".ch-card { background: var(--ch-panel); border: 1px solid var(--ch-line); border-radius: 16px; padding: 14px; }",
    ".ch-status { font-weight: 800; font-size: 16px; } .ch-status small { display: block; margin-top: 4px; font-weight: 500; font-size: 13px; color: var(--ch-muted); }",
    ".ch-moves { max-height: 300px; overflow-y: auto; display: grid; grid-template-columns: 34px 1fr 1fr; gap: 2px 4px; align-content: start;",
    "  font-variant-numeric: tabular-nums; font-size: 14px; scrollbar-width: thin; }",
    ".ch-moves:empty::before { content: 'Nog geen zetten.'; grid-column: 1 / -1; color: var(--ch-muted); font-size: 13px; }",
    ".ch-no { color: var(--ch-muted); padding: 4px 0; }",
    ".ch-mv { all: unset; box-sizing: border-box; cursor: pointer; padding: 4px 8px; border-radius: 7px; font-weight: 700; display: flex; justify-content: space-between; gap: 6px; }",
    ".ch-mv:hover { background: var(--ch-line); } .ch-mv[data-cur='1'] { background: var(--hb-acc); color: var(--hb-on-acc); }",
    ".ch-mv i { font-style: normal; font-weight: 900; }",
    ".ch-tools { display: flex; flex-wrap: wrap; gap: 8px; }",
    ".ch-tools .ch-btn { flex: 1 1 auto; padding: 9px 12px; }",
    "[data-q='brilliant'] { --q: var(--hb-blue); } [data-q='great'] { --q: color-mix(in srgb, var(--hb-blue) 60%, var(--hb-green)); }",
    "[data-q='best'], [data-q='excellent'] { --q: var(--hb-green); } [data-q='good'] { --q: color-mix(in srgb, var(--hb-green) 60%, var(--hb-ink)); }",
    "[data-q='inaccuracy'] { --q: var(--hb-gold); } [data-q='mistake'] { --q: var(--hb-orange); } [data-q='blunder'] { --q: var(--hb-red); }",
    ".ch-mv:not([data-cur='1']) i[data-q] { color: var(--q); }",
    ".ch-rev-head { display: grid; grid-template-columns: 1fr auto auto; gap: 6px 16px; font-size: 14px; align-items: center; }",
    ".ch-rev-head b { font-size: 20px; text-align: right; } .ch-rev-head span.ch-label { text-align: right; }",
    ".ch-rev-row { display: contents; } .ch-rev-row span:first-child { display: flex; align-items: center; gap: 8px; }",
    ".ch-rev-row span:first-child::before { content: ''; width: 10px; height: 10px; border-radius: 50%; background: var(--q); }",
    ".ch-rev-row span + span { text-align: right; font-weight: 800; font-variant-numeric: tabular-nums; }",
    ".ch-graph { display: block; width: 100%; height: 64px; margin-top: 12px; border-radius: 8px; background: color-mix(in srgb, black 80%, white); }",
    ".ch-graph polygon { fill: ivory; } .ch-graph line { stroke: var(--hb-red); stroke-width: .500; }",
    ".ch-bar-prog { height: 6px; border-radius: 3px; background: var(--ch-line); overflow: hidden; margin-top: 10px; }",
    ".ch-bar-prog i { display: block; height: 100%; width: 0; background: var(--hb-acc); transition: width .2s linear; }",

    /* ---------- polish pass: glass panels, player cards, board frame, result card ---------- */
    ".ch-card, .ch-bar, .ch-menu .ch-group { background: var(--hb-glass); border: 1px solid var(--hb-hi); border-radius: 18px;",
    "  backdrop-filter: blur(18px) saturate(1.5); box-shadow: inset 0 1px 0 var(--hb-hi), 0 14px 30px -22px var(--hb-shade); }",
    ".ch-menu .ch-group { padding: 16px 18px 18px; } .ch-menu { gap: 14px; }",
    ".ch-opt { transition: border-color .2s ease, background .2s ease, box-shadow .25s ease; }",
    ".ch-opt:hover:not(:disabled) { border-color: color-mix(in srgb, var(--hb-acc) 55%, transparent); }",
    ".ch-opt[aria-pressed='true'] { box-shadow: 0 0 0 3px color-mix(in srgb, var(--hb-acc) 22%, transparent), 0 10px 22px -14px var(--hb-acc); }",
    ".ch-opt--wide { flex-direction: row; flex-wrap: wrap; align-items: center; column-gap: 12px; }",
    ".ch-opt--wide small { flex-basis: 100%; }",
    ".ch-ico { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; background: color-mix(in srgb, var(--hb-acc) 18%, transparent); color: var(--hb-acc); }",
    ".ch-ico svg { width: 22px; height: 22px; }",
    ".ch-btn--go { border-radius: 16px; box-shadow: 0 14px 26px -12px var(--hb-acc), inset 0 1px 0 var(--hb-hi); }",
    ".ch-menu > .ch-row .ch-btn--go { min-width: 240px; padding: 16px 30px; font-size: 17px; }",
    ".ch-bar { padding: 8px 10px 8px 8px; border-radius: 16px; transition: border-color .25s ease, box-shadow .25s ease; }",
    ".ch-bar[data-turn='1'] { border-color: var(--hb-acc); box-shadow: 0 0 0 3px color-mix(in srgb, var(--hb-acc) 20%, transparent), 0 14px 30px -22px var(--hb-shade); }",
    ".ch-name { gap: 10px; min-width: 0; }",
    ".ch-av { flex: none; width: 42px; height: 42px; border-radius: 12px; overflow: hidden; display: block; background: var(--ch-dark); }",
    ".ch-av[data-c='b']:not(:has(.ch-face)) { background: var(--ch-light); }",
    ".ch-av svg { display: block; width: 100%; height: 100%; } .ch-av .ch-face { border-radius: 0; box-shadow: none; width: 100%; height: 100%; }",
    ".ch-who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }",
    ".ch-who-name { display: flex; align-items: baseline; gap: 8px; font-weight: 800; font-size: 15px; }",
    ".ch-who-name small { font-size: 12px; font-weight: 700; color: var(--ch-muted); }",
    ".ch-cap { display: flex; align-items: center; min-height: 18px; }",
    ".ch-cap svg { width: 18px; height: 18px; margin-right: -7px; flex: none; }",
    ".ch-cap b { margin-left: 12px; font-size: 12px; font-weight: 800; color: var(--ch-muted); }",
    ".ch-clock { border-radius: 12px; font-size: 22px; padding: 7px 14px; transition: background .2s ease, color .2s ease, opacity .2s ease; }",
    ".ch-clock[data-low='1'][data-on='1'] { animation: ch-low 1s ease-in-out infinite; }",
    "@keyframes ch-low { 50% { opacity: .65; } }",
    ".ch-boardwrap { display: flex; gap: 8px; }",
    ".ch-board { flex: 1; min-width: 0; border-radius: 14px; border: 6px solid color-mix(in srgb, var(--ch-dark) 62%, black);",
    "  box-shadow: 0 30px 60px -28px var(--hb-shade), 0 0 0 1px var(--hb-hi); }",
    ".ch-sq[data-dot] { cursor: pointer; } .ch-sq[data-dot]:hover { box-shadow: inset 0 0 0 5cqw color-mix(in srgb, var(--hb-gold) 70%, transparent); }",
    ".ch-sq[data-sel='1']::before { background: color-mix(in srgb, var(--hb-gold) 70%, transparent); }",
    ".ch-sq[data-own='1']:hover .ch-pc { scale: 1.06; } .ch-pc { transition: scale .15s ease; filter: drop-shadow(0 2cqw 1.5cqw color-mix(in srgb, black 30%, transparent)); }",
    ".ch-sq[data-q]::after { content: attr(data-mark); position: absolute; right: 3%; top: 3%; width: 36%; height: 36%; border-radius: 50%; z-index: 3;",
    "  display: grid; place-items: center; background: var(--q); color: white; font-size: 19cqw; font-weight: 900; line-height: 1;",
    "  box-shadow: 0 0 0 2px white, 0 4px 8px var(--hb-shade); translate: 0 0; border: 0; inset: 3% 3% auto auto; }",
    ".ch-eval { flex: none; width: 14px; border-radius: 7px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end;",
    "  background: color-mix(in srgb, black 82%, white); box-shadow: 0 0 0 1px var(--hb-hi); }",
    ".ch-eval[data-flip='1'] { justify-content: flex-start; }",
    ".ch-eval i { display: block; background: ivory; height: 50%; transition: height .35s ease; }",
    ".ch-over { position: absolute; inset: 0; z-index: 7; display: grid; place-items: center; border-radius: 14px;",
    "  background: color-mix(in srgb, var(--hb-bg) 38%, transparent); animation: ch-over-in .45s .55s ease both; }",
    "@keyframes ch-over-in { from { opacity: 0; } }",
    ".ch-over-card { width: min(84%, 360px); padding: 24px 22px 20px; border-radius: 22px; text-align: center; background: var(--hb-bg);",
    "  border: 1px solid var(--hb-hi); box-shadow: 0 30px 60px -20px var(--hb-shade); animation: ch-over-pop .5s .55s cubic-bezier(.34,1.56,.64,1) both; }",
    "@keyframes ch-over-pop { from { scale: .86; translate: 0 14px; } }",
    ".ch-over-card h3 { margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -.01em; }",
    ".ch-over-card p { margin: 6px 0 18px; color: var(--ch-muted); font-size: 14px; }",
    ".ch-over-card .ch-tools { justify-content: center; } .ch-over-card .ch-btn--go { flex-basis: 100%; padding: 13px 20px; }",
    ".ch-mv i[data-q] { min-width: 20px; height: 20px; padding: 0 4px; border-radius: 10px; display: inline-grid; place-items: center; font-size: 11px;",
    "  background: var(--q); color: white !important; }",
    ".ch-moves { padding-right: 4px; } .ch-no { font-size: 13px; }",
    ".ch-status { font-size: 17px; }"
  ].join("\n");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function button(cls, text) {
    var b = el("button", cls, text);
    b.type = "button";
    return b;
  }

  function colorOf(p) { return p === p.toUpperCase() ? "w" : "b"; }

  function fmtClock(ms) {
    ms = Math.max(0, ms);
    var total = Math.floor(ms / 1000), m = Math.floor(total / 60), s = total % 60;
    if (ms < 10000) return "0:0" + s + "." + Math.floor((ms % 1000) / 100);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function mount(holder, shadow) {
    var eco = window.sscHubEconomy || null;
    var dead = false, game = null, ui = null, clockTimer = null, drag = null, promoOpen = false;
    var storeKey = "sscChess_local";
    var save = {
      settings: { mode: "bot", bot: "toren", color: "w", time: "10+0", customMin: 20, customInc: 5, autoflip: true },
      record: {}
    };

    if (!chess || !ai) {
      holder.appendChild(el("div", "hub-empty", "Schaken kon niet laden."));
      return { dispose: function () {} };
    }

    if (!shadow.querySelector("#ssc-chess-css")) {
      var style = document.createElement("style");
      style.id = "ssc-chess-css";
      style.textContent = CSS;
      shadow.appendChild(style);
    }

    var root = el("div", "ch");
    holder.appendChild(root);

    function persist() {
      if (eco) eco.save(storeKey, save);
    }

    Promise.resolve(eco ? eco.ready() : null).then(function () {
      if (!eco) return null;
      storeKey = "sscChess_" + eco.uid();
      return eco.load(storeKey);
    }).then(function (data) {
      if (dead) return;
      if (data && typeof data === "object") {
        if (data.settings && typeof data.settings === "object") {
          Object.keys(save.settings).forEach(function (k) {
            if (typeof data.settings[k] === typeof save.settings[k]) save.settings[k] = data.settings[k];
          });
        }
        if (data.record && typeof data.record === "object") save.record = data.record;
      }
      showMenu();
    }, function () {
      if (!dead) showMenu();
    });

    /* ================= menu ================= */

    function timeOf(s) {
      if (s.time === "custom") {
        return { min: Math.max(1, Math.min(180, Math.floor(Number(s.customMin) || 10))), inc: Math.max(0, Math.min(60, Math.floor(Number(s.customInc) || 0))) };
      }
      for (var i = 0; i < TIMES.length; i++) if (TIMES[i].id === s.time) return TIMES[i];
      return TIMES[0];
    }

    function optionRow(label, options, current, onPick, cls) {
      var group = el("div", "ch-group");
      group.appendChild(el("span", "ch-label", label));
      var row = el("div", cls || "ch-row");
      options.forEach(function (o) {
        var b = button("ch-opt" + (o.wide ? " ch-opt--wide" : ""));
        if (o.icon) {
          var ic = el("span", "ch-ico");
          ic.innerHTML = o.icon;
          b.appendChild(ic);
        }
        if (o.node) b.appendChild(o.node); else b.appendChild(document.createTextNode(o.label));
        if (o.sub) b.appendChild(el("small", null, o.sub));
        b.setAttribute("aria-pressed", String(o.id === current));
        b.disabled = !!o.disabled;
        b.addEventListener("click", function () { onPick(o.id); });
        row.appendChild(b);
      });
      group.appendChild(row);
      return group;
    }

    function showMenu() {
      stopGame();
      var s = save.settings;
      root.textContent = "";
      var menu = el("div", "ch-menu");

      function pick(key) {
        return function (id) { s[key] = id; persist(); showMenu(); };
      }

      menu.appendChild(optionRow("Speelwijze", [
        { id: "bot", icon: ICON.bot, label: "Tegen een bot", sub: "Offline, zes niveaus", wide: true },
        { id: "local", icon: ICON.local, label: "Samen op één scherm", sub: "Twee spelers, om de beurt", wide: true },
        { id: "online", icon: ICON.online, label: "Online", sub: "Binnenkort: ranked en vriendschappelijk", wide: true, disabled: true }
      ], s.mode, pick("mode")));

      if (s.mode === "bot") {
        menu.appendChild(optionRow("Tegenstander", ai.BOTS.map(function (b) {
          var node = el("span", "ch-bot-head");
          node.innerHTML = faceSvg(b.id);
          var top = el("span", "ch-bot-top");
          top.appendChild(el("b", null, b.name));
          top.appendChild(el("i", null, "niveau " + b.level));
          node.appendChild(top);
          var rec = save.record[b.id];
          return { id: b.id, node: node, sub: b.text + (rec ? " · " + (rec.w || 0) + " W / " + (rec.d || 0) + " R / " + (rec.l || 0) + " V" : "") };
        }), s.bot, pick("bot"), "ch-bots"));
        menu.appendChild(optionRow("Jouw kleur", [
          { id: "w", label: "Wit" }, { id: "b", label: "Zwart" }, { id: "r", label: "Willekeurig" }
        ], s.color, pick("color")));
      }

      menu.appendChild(optionRow("Bedenktijd", TIMES.map(function (t) {
        return { id: t.id, label: t.label };
      }), s.time, pick("time")));

      if (s.time === "custom") {
        var custom = el("div", "ch-custom");
        [["customMin", "Minuten per speler", 1, 180], ["customInc", "Seconden erbij per zet", 0, 60]].forEach(function (def) {
          var lab = el("label", "ch-check");
          lab.appendChild(document.createTextNode(def[1]));
          var input = el("input");
          input.type = "number"; input.min = def[2]; input.max = def[3]; input.value = s[def[0]];
          input.addEventListener("change", function () {
            s[def[0]] = Math.max(def[2], Math.min(def[3], Math.floor(Number(input.value) || def[2])));
            input.value = s[def[0]];
            persist();
          });
          lab.appendChild(input);
          custom.appendChild(lab);
        });
        menu.appendChild(custom);
      }

      if (s.mode === "local") {
        var lab = el("label", "ch-check");
        var box = el("input");
        box.type = "checkbox"; box.checked = !!s.autoflip;
        box.addEventListener("change", function () { s.autoflip = box.checked; persist(); });
        lab.appendChild(box);
        lab.appendChild(document.createTextNode("Draai het bord na elke zet"));
        menu.appendChild(lab);
      }

      var foot = el("div", "ch-row");
      var go = button("ch-btn ch-btn--go", "Start partij");
      go.addEventListener("click", startGame);
      foot.appendChild(go);
      menu.appendChild(foot);
      menu.appendChild(el("p", "ch-note", "Partijen tegen bots en op één scherm tellen niet mee voor een rating. De niveaus van de bots zijn een schatting."));
      root.appendChild(menu);
    }

    /* ================= game ================= */

    function stopGame() {
      if (clockTimer) clearInterval(clockTimer);
      clockTimer = null;
      game = null; ui = null; drag = null; promoOpen = false;
    }

    function startGame() {
      stopGame();
      var s = save.settings, tc = timeOf(s);
      var human = s.mode === "bot" ? (s.color === "r" ? (Math.random() < 0.5 ? "w" : "b") : s.color) : null;
      var st = chess.start();
      game = {
        mode: s.mode === "bot" ? "bot" : "local",
        bot: s.mode === "bot" ? ai.botById(s.bot) : null,
        human: human, st: st, plies: [], states: [st], counts: {},
        clock: tc.min ? { w: tc.min * 60000, b: tc.min * 60000 } : null, inc: tc.inc * 1000,
        started: false, last: 0, result: null, view: null,
        orient: human || "w", autoflip: s.mode === "local" && !!s.autoflip,
        sel: -1, targets: [], note: "", review: null
      };
      game.counts[chess.positionKey(st)] = 1;
      buildGame();
      paint();
      clockTimer = setInterval(tick, 100);
      if (game.mode === "bot" && game.human === "b") scheduleBot();
    }

    function playerName(color) {
      if (game.mode === "local") return color === "w" ? "Wit" : "Zwart";
      return color === game.human ? "Jij" : game.bot.name;
    }

    function buildGame() {
      root.textContent = "";
      ui = { sq: [], pc: [], bars: {} };
      var wrap = el("div", "ch-game");
      var left = el("div", "ch-left");

      ["top", "bottom"].forEach(function (pos) {
        var bar = el("div", "ch-bar");
        var name = el("div", "ch-name");
        var clock = el("div", "ch-clock");
        clock.setAttribute("role", "timer");
        bar.appendChild(name);
        bar.appendChild(clock);
        ui.bars[pos] = { bar: bar, name: name, clock: clock };
      });

      var boardWrap = el("div", "ch-boardwrap");
      var board = el("div", "ch-board");
      board.setAttribute("role", "grid");
      for (var s = 0; s < 64; s++) {
        var b = button("ch-sq");
        b.setAttribute("data-s", String(s));
        b.setAttribute("data-t", ((s >> 3) + (s & 7)) % 2 ? "l" : "d");
        var pc = el("span", "ch-pc");
        b.appendChild(pc);
        b.appendChild(el("span", "ch-co ch-co--r"));
        b.appendChild(el("span", "ch-co ch-co--f"));
        wireSquare(b, s);
        ui.sq.push(b);
        ui.pc.push(pc);
        board.appendChild(b);
      }
      ui.eval = el("div", "ch-eval");
      ui.eval.hidden = true;
      ui.eval.appendChild(el("i"));
      boardWrap.appendChild(ui.eval);
      boardWrap.appendChild(board);
      ui.boardWrap = boardWrap;

      left.appendChild(ui.bars.top.bar);
      left.appendChild(boardWrap);
      left.appendChild(ui.bars.bottom.bar);
      wrap.appendChild(left);

      var side = el("div", "ch-side");
      ui.status = el("div", "ch-card ch-status");
      ui.status.setAttribute("aria-live", "polite");
      side.appendChild(ui.status);

      var movesCard = el("div", "ch-card");
      ui.moves = el("div", "ch-moves");
      movesCard.appendChild(ui.moves);
      var nav = el("div", "ch-tools");
      nav.style.marginTop = "10px";
      ui.prev = button("ch-btn"); ui.prev.innerHTML = ARROW.left; ui.prev.setAttribute("aria-label", "Vorige zet");
      ui.next = button("ch-btn"); ui.next.innerHTML = ARROW.right; ui.next.setAttribute("aria-label", "Volgende zet");
      ui.prev.addEventListener("click", function () { step(-1); });
      ui.next.addEventListener("click", function () { step(1); });
      var flip = button("ch-btn", "Draai bord");
      flip.addEventListener("click", function () { game.orient = game.orient === "w" ? "b" : "w"; game.autoflip = false; paint(); });
      nav.appendChild(ui.prev); nav.appendChild(ui.next); nav.appendChild(flip);
      movesCard.appendChild(nav);
      side.appendChild(movesCard);

      ui.review = el("div", "ch-card");
      ui.review.hidden = true;
      side.appendChild(ui.review);

      var tools = el("div", "ch-tools");
      ui.draw = button("ch-btn ch-btn--warn", "Remise");
      ui.resign = button("ch-btn ch-btn--warn", "Opgeven");
      armed(ui.draw, "Remise", "Bevestig remise", offerDraw);
      armed(ui.resign, "Opgeven", "Bevestig opgeven", resign);
      ui.analyse = button("ch-btn", "Analyseer partij");
      ui.analyse.addEventListener("click", startReview);
      ui.again = button("ch-btn", "Opnieuw");
      ui.again.addEventListener("click", startGame);
      var menuBtn = button("ch-btn", "Menu");
      menuBtn.addEventListener("click", showMenu);
      [ui.draw, ui.resign, ui.analyse, ui.again, menuBtn].forEach(function (b) { tools.appendChild(b); });
      side.appendChild(tools);
      wrap.appendChild(side);
      root.appendChild(wrap);
    }

    // First click arms the button, a second click within 3 s runs the action.
    function armed(btn, label, confirmLabel, action) {
      var t = null;
      btn.addEventListener("click", function () {
        if (btn.getAttribute("data-arm") === "1") {
          clearTimeout(t);
          btn.removeAttribute("data-arm");
          btn.textContent = label;
          action();
          return;
        }
        btn.setAttribute("data-arm", "1");
        btn.textContent = confirmLabel;
        t = setTimeout(function () {
          btn.removeAttribute("data-arm");
          btn.textContent = label;
        }, 3000);
      });
    }

    function canMove() {
      return !!game && !game.result && game.view === null && !promoOpen &&
        (game.mode === "local" || game.st.turn === game.human);
    }

    function select(s) {
      game.sel = s;
      game.targets = s < 0 ? [] : chess.legalMoves(game.st).filter(function (m) { return m.from === s; }).map(function (m) { return m.to; });
      paintBoard();
    }

    function wireSquare(b, s) {
      b.addEventListener("pointerdown", function (e) {
        if (e.button > 0 || !canMove()) return;
        var p = game.st.board[s];
        if (game.sel >= 0 && game.targets.indexOf(s) >= 0) { tryMove(game.sel, s); return; }
        if (p && colorOf(p) === game.st.turn) {
          select(s);
          drag = { s: s, x: e.clientX, y: e.clientY, moved: false, pc: ui.pc[s] };
          try { b.setPointerCapture(e.pointerId); } catch (err) { /* older browsers: click-to-move still works */ }
        } else select(-1);
      });
      b.addEventListener("pointermove", function (e) {
        if (!drag || drag.s !== s) return;
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
        drag.moved = true;
        drag.pc.style.transition = "none";
        drag.pc.setAttribute("data-drag", "1");
        drag.pc.style.translate = dx + "px " + dy + "px";
      });
      function drop(e) {
        if (!drag || drag.s !== s) return;
        var d = drag;
        drag = null;
        d.pc.removeAttribute("data-drag");
        d.pc.style.translate = "";
        if (!d.moved || e.type === "pointercancel" || !canMove()) return;
        var hit = shadow.elementFromPoint(e.clientX, e.clientY);
        var target = hit && hit.closest ? hit.closest(".ch-sq") : null;
        if (!target) return;
        var to = Number(target.getAttribute("data-s"));
        // Dropped by hand: the piece is already there, no slide.
        if (game.targets.indexOf(to) >= 0) { game.skipAnim = true; tryMove(d.s, to); }
      }
      b.addEventListener("pointerup", drop);
      b.addEventListener("pointercancel", drop);
      // Keyboard: Enter / Space on a focused square acts like a click.
      b.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        if (!canMove()) return;
        var p = game.st.board[s];
        if (game.sel >= 0 && game.targets.indexOf(s) >= 0) tryMove(game.sel, s);
        else if (p && colorOf(p) === game.st.turn) select(s);
        else select(-1);
      });
    }

    function tryMove(from, to) {
      var options = chess.legalMoves(game.st).filter(function (m) { return m.from === from && m.to === to; });
      if (!options.length) return;
      if (options.length === 1) { commit(options[0]); return; }
      askPromotion(options);
    }

    function askPromotion(options) {
      promoOpen = true;
      var white = game.st.turn === "w";
      var layer = el("div", "ch-promo");
      var box = el("div", "ch-promo-box");
      function close() { promoOpen = false; layer.remove(); }
      options.forEach(function (m) {
        var b = button();
        b.innerHTML = pieceSvg(white ? m.promo : m.promo.toLowerCase());
        b.setAttribute("aria-label", "Promoveer naar " + NAMES[m.promo]);
        b.addEventListener("click", function (e) { e.stopPropagation(); close(); commit(m); });
        box.appendChild(b);
      });
      layer.addEventListener("click", function () { close(); select(-1); });
      layer.appendChild(box);
      ui.boardWrap.appendChild(layer);
      box.firstChild.focus();
    }

    function commit(m) {
      var mover = game.st.turn;
      tick();
      if (game.result) return;
      if (game.clock && game.started) game.clock[mover] += game.inc;
      game.started = true;
      game.last = Date.now();
      game.plies.push({ move: m, san: chess.san(game.st, m), by: mover, review: null });
      game.st = chess.makeMove(game.st, m);
      game.states.push(game.st);
      var key = chess.positionKey(game.st);
      game.counts[key] = (game.counts[key] || 0) + 1;
      game.sel = -1; game.targets = []; game.view = null; game.note = "";

      var status = chess.status(game.st);
      if (status === "checkmate") finish(mover, "schaakmat");
      else if (status === "stalemate") finish(null, "pat");
      else if (status === "draw50") finish(null, "50 zetten zonder slag of pionzet");
      else if (status === "draw") finish(null, "te weinig materiaal");
      else if (game.counts[key] >= 3) finish(null, "drie keer dezelfde stelling");

      if (!game.result) {
        if (game.autoflip) game.orient = game.st.turn;
        if (game.mode === "bot" && game.st.turn !== game.human) scheduleBot();
      }
      paint();
    }

    function finish(winner, reason) {
      if (game.result) return;
      game.result = { winner: winner, reason: reason };
      game.sel = -1; game.targets = [];
      if (game.mode === "bot") {
        var rec = save.record[game.bot.id] || { w: 0, d: 0, l: 0 };
        if (winner === null) rec.d++; else if (winner === game.human) rec.w++; else rec.l++;
        save.record[game.bot.id] = rec;
        persist();
      }
    }

    function scheduleBot() {
      var mine = game;
      setTimeout(function () {
        if (dead || game !== mine || game.result || game.st.turn === game.human) return;
        var limit = game.clock ? Math.max(120, Math.min(1500, game.clock[game.st.turn] / 25)) : 1500;
        // shortcut: the search runs on the page thread (up to 1.5 s freeze on the strongest bot); move to a Worker if that hurts.
        var m = ai.botMove(game.st, game.bot, Math.random, limit);
        if (m) commit(m);
      }, 350);
    }

    function tick() {
      if (!game || game.result || !game.clock || !game.started) return;
      var now = Date.now(), side = game.st.turn;
      game.clock[side] -= now - game.last;
      game.last = now;
      if (game.clock[side] <= 0) {
        game.clock[side] = 0;
        var other = side === "w" ? "b" : "w";
        // Out of time against a bare king is a draw: the opponent could never mate.
        var bare = game.st.board.every(function (p) { return !p || colorOf(p) !== other || p.toUpperCase() === "K"; });
        finish(bare ? null : other, bare ? "tijd op, maar te weinig materiaal om te winnen" : "tijd op");
        paint();
        return;
      }
      paintClocks();
    }

    function resign() {
      if (!game || game.result) return;
      var loser = game.mode === "bot" ? game.human : game.st.turn;
      finish(loser === "w" ? "b" : "w", "opgave");
      paint();
    }

    function offerDraw() {
      if (!game || game.result) return;
      if (game.mode === "local") { finish(null, "remise overeengekomen"); paint(); return; }
      // The bot agrees when it is not better and the game is under way.
      var botScore = ai.evaluate(game.st) * (game.st.turn === game.human ? -1 : 1);
      if (game.plies.length >= 20 && botScore <= 30) finish(null, "remise overeengekomen");
      else game.note = game.bot.name + " weigert remise.";
      paint();
    }

    function step(d) {
      var total = game.plies.length, cur = game.view === null ? total : game.view;
      var next = Math.max(0, Math.min(total, cur + d));
      game.view = next === total ? null : next;
      game.sel = -1; game.targets = [];
      paint();
    }

    /* ================= painting ================= */

    function paint() {
      if (!game || !ui) return;
      paintBoard();
      paintBars();
      paintClocks();
      paintMoves();
      paintStatus();
      paintReview();
      var over = !!game.result;
      ui.draw.hidden = over; ui.resign.hidden = over;
      ui.analyse.hidden = !over || !!game.review || game.plies.length < 2;
      ui.again.hidden = !over;
      var reviewed = !!game.review && game.review.done;
      ui.eval.hidden = !reviewed;
      if (reviewed) {
        var v = shown(), w = 0.5;
        if (v.last) { w = ai.winChance(v.last.review.scoreAfter); if (v.last.by === "b") w = 1 - w; }
        ui.eval.firstChild.style.height = Math.round(w * 100) + "%";
        flag(ui.eval, "data-flip", game.orient === "b");
      }
      if (over && !game.overShown) { game.overShown = true; showOver(); }
      var total = game.plies.length, cur = game.view === null ? total : game.view;
      ui.prev.disabled = cur === 0;
      ui.next.disabled = cur === total;
    }

    function shown() {
      var idx = game.view === null ? game.plies.length : game.view;
      return { st: game.states[idx], last: idx > 0 ? game.plies[idx - 1] : null, idx: idx };
    }

    function paintBoard() {
      var view = shown(), st = view.st, white = game.orient === "w";
      var checkSq = -1;
      if (chess.inCheck(st, st.turn)) checkSq = st.board.indexOf(st.turn === "w" ? "K" : "k");
      var live = canMove();
      for (var s = 0; s < 64; s++) {
        var b = ui.sq[s], pc = ui.pc[s], p = st.board[s] || "", f = s & 7, r = s >> 3;
        b.style.gridColumn = String(white ? f + 1 : 8 - f);
        b.style.gridRow = String(white ? 8 - r : r + 1);
        if (pc.getAttribute("data-p") !== p) {
          pc.setAttribute("data-p", p);
          pc.innerHTML = p ? pieceSvg(p) : "";
        }
        b.children[1].textContent = f === (white ? 0 : 7) ? String(r + 1) : "";
        b.children[2].textContent = r === (white ? 0 : 7) ? "abcdefgh"[f] : "";
        var isTarget = game.targets.indexOf(s) >= 0;
        flag(b, "data-sel", game.sel === s);
        flag(b, "data-last", !!view.last && (view.last.move.from === s || view.last.move.to === s));
        flag(b, "data-check", s === checkSq);
        flag(b, "data-own", live && !!p && colorOf(p) === st.turn);
        if (isTarget) b.setAttribute("data-dot", p ? "2" : "1"); else b.removeAttribute("data-dot");
        b.setAttribute("aria-label", chess.squareName(s) + (p ? ", " + (colorOf(p) === "w" ? "witte " : "zwarte ") + NAMES[p.toUpperCase()] : ", leeg"));
      }
      // Review badge on the square the viewed move landed on.
      if (ui.badge >= 0) { ui.sq[ui.badge].removeAttribute("data-q"); ui.sq[ui.badge].removeAttribute("data-mark"); }
      ui.badge = -1;
      if (view.last && view.last.review && game.review && game.review.done) {
        ui.badge = view.last.move.to;
        ui.sq[ui.badge].setAttribute("data-q", view.last.review.label);
        ui.sq[ui.badge].setAttribute("data-mark", MARK[view.last.review.label] || "\u2713");
      }
      var key = view.last ? view.idx + ":" + view.last.san : "";
      if (view.last && key !== ui.animKey && !game.skipAnim) slide(view.last.move, white);
      ui.animKey = key;
      game.skipAnim = false;
    }

    // The piece that just moved glides in from its old square.
    function slide(m, white) {
      var pc = ui.pc[m.to];
      var dx = ((m.from & 7) - (m.to & 7)) * (white ? 100 : -100), dy = ((m.from >> 3) - (m.to >> 3)) * (white ? -100 : 100);
      pc.style.transition = "none";
      pc.style.translate = dx + "% " + dy + "%";
      pc.getBoundingClientRect();
      pc.style.transition = "translate .22s cubic-bezier(.2,.8,.3,1)";
      pc.style.translate = "";
    }

    function showOver() {
      var r = game.result, title;
      if (r.winner === null) title = "Remise";
      else if (game.mode === "bot") title = r.winner === game.human ? "Je hebt gewonnen" : "Je hebt verloren";
      else title = playerName(r.winner) + " wint";
      var layer = el("div", "ch-over");
      var card = el("div", "ch-over-card");
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-label", title);
      card.appendChild(el("h3", null, title));
      card.appendChild(el("p", null, "Door " + r.reason + "."));
      var row = el("div", "ch-tools");
      function close() { layer.remove(); }
      if (game.plies.length >= 2) {
        var an = button("ch-btn ch-btn--go", "Analyseer partij");
        an.addEventListener("click", function () { close(); startReview(); });
        row.appendChild(an);
      }
      var again = button("ch-btn", "Opnieuw");
      again.addEventListener("click", startGame);
      var look = button("ch-btn", "Bekijk bord");
      look.addEventListener("click", close);
      row.appendChild(again);
      row.appendChild(look);
      card.appendChild(row);
      layer.appendChild(card);
      ui.boardWrap.appendChild(layer);
    }

    // Pieces each side has taken, and who is ahead in points.
    function material(st) {
      var start = { P: 8, N: 2, B: 2, R: 2, Q: 1 }, val = { P: 1, N: 3, B: 3, R: 5, Q: 9 };
      var have = { w: {}, b: {} }, lead = 0;
      st.board.forEach(function (p) {
        if (!p || p.toUpperCase() === "K") return;
        var t = p.toUpperCase(), col = colorOf(p);
        have[col][t] = (have[col][t] || 0) + 1;
        lead += (col === "w" ? 1 : -1) * val[t];
      });
      var taken = { w: [], b: [] };
      ["Q", "R", "B", "N", "P"].forEach(function (t) {
        for (var i = have.b[t] || 0; i < start[t]; i++) taken.w.push(t.toLowerCase());
        for (var j = have.w[t] || 0; j < start[t]; j++) taken.b.push(t);
      });
      return { taken: taken, lead: lead };
    }

    function flag(node, name, on) {
      if (on) node.setAttribute(name, "1"); else node.removeAttribute(name);
    }

    function paintBars() {
      var bottom = game.orient, top = bottom === "w" ? "b" : "w", mat = material(shown().st);
      [["top", top], ["bottom", bottom]].forEach(function (pair) {
        var bar = ui.bars[pair[0]], color = pair[1], isBot = game.mode === "bot" && color !== game.human;
        bar.color = color;
        bar.name.textContent = "";
        var av = el("span", "ch-av");
        av.setAttribute("data-c", color);
        av.innerHTML = isBot ? faceSvg(game.bot.id) : pieceSvg(color === "w" ? "K" : "k");
        bar.name.appendChild(av);
        var who = el("span", "ch-who");
        var line = el("span", "ch-who-name", playerName(color));
        if (isBot) line.appendChild(el("small", null, String(game.bot.level)));
        who.appendChild(line);
        var cap = el("span", "ch-cap");
        cap.innerHTML = mat.taken[color].map(pieceSvg).join("");
        var lead = mat.lead * (color === "w" ? 1 : -1);
        if (lead > 0) cap.appendChild(el("b", null, "+" + lead));
        who.appendChild(cap);
        bar.name.appendChild(who);
        bar.clock.hidden = !game.clock;
        flag(bar.bar, "data-turn", !game.result && game.st.turn === color);
      });
    }

    function paintClocks() {
      if (!game || !ui || !game.clock) return;
      ["top", "bottom"].forEach(function (pos) {
        var bar = ui.bars[pos], ms = game.clock[bar.color];
        var text = fmtClock(ms);
        if (bar.clock.textContent !== text) bar.clock.textContent = text;
        flag(bar.clock, "data-on", !game.result && game.st.turn === bar.color);
        flag(bar.clock, "data-low", ms < 20000);
      });
    }

    function paintMoves() {
      var list = ui.moves, cur = game.view === null ? game.plies.length : game.view;
      list.textContent = "";
      var current = null;
      game.plies.forEach(function (ply, i) {
        if (i % 2 === 0) list.appendChild(el("span", "ch-no", (i / 2 + 1) + "."));
        var b = button("ch-mv");
        b.appendChild(el("span", null, ply.san));
        if (ply.review && MARK[ply.review.label] !== undefined) {
          var tag = el("i", null, MARK[ply.review.label] || "·");
          tag.setAttribute("data-q", ply.review.label);
          tag.title = ply.review.text;
          b.appendChild(tag);
        }
        if (i + 1 === cur) { b.setAttribute("data-cur", "1"); current = b; }
        b.addEventListener("click", function () {
          game.view = i + 1 === game.plies.length ? null : i + 1;
          game.sel = -1; game.targets = [];
          paint();
        });
        list.appendChild(b);
      });
      if (current) list.scrollTop = Math.max(0, current.offsetTop - list.clientHeight / 2);
    }

    function paintStatus() {
      var text, sub = game.note || "";
      if (game.result) {
        var r = game.result;
        text = r.winner === null ? "Remise" : (playerName(r.winner) === "Jij" ? "Jij wint" : playerName(r.winner) + " wint");
        sub = "Door " + r.reason + ".";
      } else {
        var turn = game.st.turn;
        text = game.mode === "bot" ? (turn === game.human ? "Jij bent aan zet" : game.bot.name + " denkt na…") : playerName(turn) + " is aan zet";
        if (chess.inCheck(game.st, turn)) sub = "Schaak." + (sub ? " " + sub : "");
      }
      var view = shown();
      if (game.view !== null && view.last && view.last.review) {
        var rv = view.last.review;
        sub = view.last.san + ": " + rv.text + "." + (rv.loss > 0.02 ? " Beter was " + rv.bestSan + "." : "");
      } else if (game.view !== null) sub = "Je bekijkt een eerdere stelling.";
      ui.status.textContent = text;
      if (sub) ui.status.appendChild(el("small", null, sub));
    }

    /* ================= review ================= */

    function startReview() {
      if (!game || !game.result || game.review) return;
      var mine = game, i = 0;
      game.review = { done: false, progress: 0 };
      paint();
      (function next() {
        if (dead || game !== mine) return;
        if (i >= mine.plies.length) {
          mine.review.done = true;
          paint();
          return;
        }
        mine.plies[i].review = ai.reviewMove(mine.states[i], mine.plies[i].move, 2);
        i++;
        mine.review.progress = i / mine.plies.length;
        var bar = ui.review.querySelector(".ch-bar-prog i");
        if (bar) bar.style.width = Math.round(mine.review.progress * 100) + "%";
        setTimeout(next, 0);
      })();
    }

    function paintReview() {
      var card = ui.review, rev = game.review;
      card.hidden = !rev;
      if (!rev) return;
      if (!rev.done) {
        if (!card.querySelector(".ch-bar-prog")) {
          card.textContent = "";
          card.appendChild(el("span", "ch-label", "Partij analyseren…"));
          var prog = el("div", "ch-bar-prog");
          prog.appendChild(el("i"));
          card.appendChild(prog);
        }
        return;
      }
      card.textContent = "";
      var sides = { w: { n: 0, acc: 0, c: {} }, b: { n: 0, acc: 0, c: {} } };
      game.plies.forEach(function (ply) {
        var s = sides[ply.by];
        s.n++; s.acc += ply.review.accuracy;
        s.c[ply.review.label] = (s.c[ply.review.label] || 0) + 1;
      });
      var head = el("div", "ch-rev-head");
      head.appendChild(el("span", "ch-label", "Nauwkeurigheid"));
      head.appendChild(el("span", "ch-label", playerName("w")));
      head.appendChild(el("span", "ch-label", playerName("b")));
      head.appendChild(el("span"));
      head.appendChild(el("b", null, sides.w.n ? (sides.w.acc / sides.w.n).toFixed(1) : "-"));
      head.appendChild(el("b", null, sides.b.n ? (sides.b.acc / sides.b.n).toFixed(1) : "-"));
      ORDER.forEach(function (label) {
        var row = el("div", "ch-rev-row");
        row.setAttribute("data-q", label);
        row.appendChild(el("span", null, ai.LABELS[label]));
        row.appendChild(el("span", null, String(sides.w.c[label] || 0)));
        row.appendChild(el("span", null, String(sides.b.c[label] || 0)));
        head.appendChild(row);
      });
      card.appendChild(head);

      // White's winning chance after every move, as an area chart.
      var n = game.plies.length, pts = ["0,30", "0,15"];
      game.plies.forEach(function (ply, i) {
        var w = ai.winChance(ply.review.scoreAfter);
        if (ply.by === "b") w = 1 - w;
        pts.push((((i + 1) / n) * 100).toFixed(2) + "," + (30 - w * 30).toFixed(2));
      });
      pts.push("100,30");
      var svg = '<svg class="ch-graph" viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label="Verloop van de partij">' +
        '<polygon points="' + pts.join(" ") + '"/><line x1="0" y1="15" x2="100" y2="15"/></svg>';
      var holderEl = el("div");
      holderEl.innerHTML = svg;
      card.appendChild(holderEl.firstChild);
      card.appendChild(el("p", "ch-note", "Klik op een zet voor uitleg. De analyse komt van een eenvoudige eigen engine en is een indicatie."));
    }

    return {
      dispose: function () {
        dead = true;
        stopGame();
      }
    };
  }

  window.sscHubChess = { mount: mount };
})();
