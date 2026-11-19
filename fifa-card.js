/**
 * Smartschool Combined — FIFA-style grade card.
 *
 * Ported from old versions/01/cutscene.js (lines 101-167 CSS, 251-286 and
 * 333-363 JS). The shield shape, the four tiers, the shine sweep and the
 * 1s "walkout" entry are that file's work; this only reorganises it into a
 * reusable module and swaps the player-rating semantics for a /20 grade.
 *
 * Kept from the original verbatim:
 *   - the clip-path shield silhouette and 5/7 aspect ratio
 *   - container-type:inline-size + cqw units, which is what makes the card
 *     scale as one piece at any size
 *   - the four tier gradients and their text colours
 *   - @keyframes walkout, cubic-bezier(.2,1.1,.3,1)
 *   - the emoji subject map and the 3-letter position abbreviation
 *
 * Changed:
 *   - the big number is the PERCENTAGE (0-100), not the /20 grade: people
 *     recognise "79%" faster than "15,8 / 20". The /20 conversion stays as a
 *     small reference line under it.
 *   - tier boundaries follow this project's spec: <50 bronze, <70 silver,
 *     <85 gold, >=85 icon
 *   - empty stats are dropped instead of rendering an em dash
 *   - font-stretch:condensed accompanies the Windows-only Bahnschrift
 *     width axis so the card looks the same off Windows
 */
(function () {
  "use strict";

  // Sign-in pages: do nothing at all (see guard.js).
  if (window.sscSkipPage) return;

  if (window.sscFifaCard) return;

  /* ---------- tiers ---------- */

  var TIERS = [
    { id: "bronze", upTo: 50, glow: "#d08a4a" },
    { id: "silver", upTo: 70, glow: "#cfd6e0" },
    { id: "gold", upTo: 85, glow: "#ffd34d" },
    { id: "icon", upTo: Infinity, glow: "#6ea8ff" },
  ];

  function tierForPercent(pct) {
    var p = Number(pct);
    if (!isFinite(p)) return TIERS[0];
    for (var i = 0; i < TIERS.length; i++) {
      if (p < TIERS[i].upTo) return TIERS[i];
    }
    return TIERS[TIERS.length - 1];
  }

  /* ---------- card CSS ---------- */

  var CARD_CSS = [
    ".ssc-fc-wrap{position:relative;z-index:2;",
    "  filter:drop-shadow(0 0 34px var(--sc-glow)) drop-shadow(0 18px 24px rgba(0,0,0,.5));}",
    ".ssc-fc-wrap[data-enter='1']{animation:ssc-fc-walkout 1s cubic-bezier(.2,1.1,.3,1) both;}",
    "@keyframes ssc-fc-walkout{",
    "  0%{opacity:0;transform:translateY(80px) scale(.55) rotateY(90deg);}",
    "  60%{opacity:1;transform:translateY(-10px) scale(1.06) rotateY(-8deg);}",
    "  100%{opacity:1;transform:none;}",
    "}",

    ".ssc-fc{container-type:inline-size;position:relative;overflow:hidden;",
    "  width:min(320px,72vw,50vh);aspect-ratio:5/7;",
    "  clip-path:polygon(2.5% 12.3%,5.5% 12.3%,8.5% 11.3%,11.5% 10%,14.5% 5%,17.5% 4.3%,20.5% 3.7%,23.5% 3.3%,26.5% 3%,29.5% 2.7%,32.5% 2.3%,35.5% 2%,38.5% 1.7%,41.5% 1.7%,44.5% 1.7%,47.5% 1.7%,50.5% 1.3%,53.5% 1.7%,56.5% 1.7%,59.5% 1.7%,62.5% 2%,65.5% 2%,68.5% 2.3%,71.5% 2.7%,74.5% 3.3%,77.5% 3.7%,80.5% 4.3%,83.5% 5%,86.5% 9%,89.5% 11%,92.5% 12%,95.5% 12.3%,97% 13%,97% 84.7%,94% 88%,91% 89%,88% 89.7%,85% 90.3%,82% 91%,79% 91.3%,76% 92%,73% 92.7%,70% 93.3%,67% 94%,64% 94.7%,61% 95.3%,58% 96%,55% 97%,52% 98%,49% 98.7%,46% 97.3%,43% 96.3%,40% 95.7%,37% 95%,34% 94.3%,31% 93.7%,28% 93%,25% 92.3%,22% 91.7%,19% 91%,16% 90.7%,13% 90%,10% 89.3%,7% 88.3%,4% 86.7%,2.5% 85.3%);",
    "  font-family:'Bahnschrift','Segoe UI',system-ui,sans-serif;",
    "  transform-style:preserve-3d;}",
    // Reel cells hand the card their own box; the aspect ratio would fight it.
    ".ssc-fc--fill{width:100%;height:100%;aspect-ratio:auto;}",
    ".ssc-fc::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:2;",
    "  background:radial-gradient(circle at 30% 18%,rgba(255,255,255,.45),transparent 55%);}",
    ".ssc-fc-shine{position:absolute;inset:-50%;pointer-events:none;z-index:3;",
    "  background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.55) 50%,transparent 60%);",
    "  transform:translateX(-70%);}",
    ".ssc-fc-shine[data-on='1']{animation:ssc-fc-shine 2.6s 1.3s ease-in-out infinite;}",
    "@keyframes ssc-fc-shine{0%{transform:translateX(-70%);}60%,100%{transform:translateX(70%);}}",

    ".ssc-fc.tier-bronze{background:linear-gradient(160deg,#efc08c 0%,#b87a43 45%,#6a4120 100%);color:#2e1a08;}",
    ".ssc-fc.tier-silver{background:linear-gradient(160deg,#fafbfc 0%,#b4bcc7 48%,#707987 100%);color:#1f2630;}",
    ".ssc-fc.tier-gold{background:linear-gradient(160deg,#fff0b0 0%,#e0b030 46%,#8c6314 100%);color:#35240a;}",
    ".ssc-fc.tier-icon{background:linear-gradient(160deg,#b8f1ff 0%,#5a7dff 44%,#2a1a7c 100%);color:#fff;}",
    ".ssc-fc.tier-icon{box-shadow:inset 0 0 60px rgba(184,241,255,.55);}",
    // White type on the blue gradient: a shadow keeps it at AA contrast.
    ".ssc-fc.tier-icon,.ssc-fc--back{text-shadow:0 1px 3px rgba(0,0,0,.8);}",

    ".ssc-fc-rating{position:absolute;left:11cqw;top:15cqw;text-align:center;line-height:1;}",
    // Number + "%" sit on one baseline; the rating block is a column.
    ".ssc-fc-numrow{display:flex;align-items:baseline;justify-content:center;gap:.5cqw;}",
    ".ssc-fc-num{display:block;font-size:19cqw;font-weight:800;",
    "  font-stretch:condensed;font-variation-settings:'wdth' 75;letter-spacing:-.03em;}",
    ".ssc-fc-rating.wide .ssc-fc-num{font-size:15cqw;}",
    ".ssc-fc-num-unit{font-size:8.5cqw;font-weight:800;font-stretch:condensed;opacity:.9;}",
    ".ssc-fc-pos{display:block;font-size:7.5cqw;font-weight:700;margin-top:1.5cqw;",
    "  font-stretch:condensed;letter-spacing:.04em;}",
    // The /20 conversion: small reference line only, never the main number.
    ".ssc-fc-sub{display:block;margin-top:1.6cqw;font-size:5.2cqw;font-weight:700;",
    "  font-stretch:condensed;letter-spacing:.03em;opacity:.8;}",
    ".ssc-fc-type{display:block;font-size:6cqw;font-weight:600;opacity:.8;margin-top:2.5cqw;",
    "  padding-top:2cqw;border-top:.7cqw solid currentColor;",
    "  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    ".ssc-fc-emblem{position:absolute;right:8cqw;top:12cqw;width:46cqw;height:46cqw;",
    "  display:flex;align-items:center;justify-content:center;",
    "  filter:drop-shadow(0 .6cqw 0 rgba(255,255,255,.35)) drop-shadow(0 2cqw 2cqw rgba(0,0,0,.3));}",
    ".ssc-fc-emblem svg{width:34cqw;height:34cqw;opacity:.88;}",
    ".ssc-fc-name{position:absolute;left:6cqw;right:6cqw;top:66cqw;text-align:center;",
    "  display:block;max-width:100%;box-sizing:border-box;",
    "  font-size:7.4cqw;font-weight:800;text-transform:uppercase;",
    "  font-stretch:condensed;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".ssc-fc-line{position:absolute;left:14cqw;right:14cqw;top:78cqw;height:.7cqw;",
    "  background:currentColor;opacity:.35;}",
    // minmax(0,1fr) + min-width:0: a long value ("25 oktober - 19 december")
    // is cut with an ellipsis inside its cell instead of pushing out of the card.
    ".ssc-fc-stats{position:absolute;left:10cqw;right:10cqw;top:83cqw;",
    "  display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:3cqw 6cqw;}",
    ".ssc-fc-stat{display:flex;align-items:baseline;justify-content:center;gap:2.5cqw;font-size:8cqw;",
    "  min-width:0;overflow:hidden;}",
    ".ssc-fc-stat b{font-weight:800;font-stretch:condensed;min-width:0;",
    "  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}",
    ".ssc-fc-stat span{flex:none;font-size:5.6cqw;font-weight:600;opacity:.75;font-stretch:condensed;}",
    // FUT rating mode: the number is a rating, not a percentage. Centred over
    // the position, bold, condensed, no unit.
    ".ssc-fc-rating.is-rating{width:30cqw;}",
    ".ssc-fc-rating.is-rating .ssc-fc-num{font-size:21cqw;font-weight:900;text-align:center;}",
    ".ssc-fc-rating.is-rating.wide .ssc-fc-num{font-size:17cqw;}",
    // Inset to where the shield's point still has room: full width ran under
    // the clip-path and cut the first letters off.
    ".ssc-fc-vak{position:absolute;left:20cqw;right:20cqw;bottom:12cqw;text-align:center;",
    "  font-size:5.6cqw;letter-spacing:.14em;text-transform:uppercase;opacity:.8;",
    "  font-stretch:condensed;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",

    /* ---------- card back: same silhouette, nobody's grade ---------- */
    ".ssc-fc--back{background:linear-gradient(160deg,#2b3444 0%,#1a2230 46%,#10161f 100%);color:#e6eef8;}",
    ".ssc-fc--back.ssc-fc-back--bronze{background:linear-gradient(160deg,#57381d 0%,#39230f 46%,#1d1208 100%);}",
    ".ssc-fc--back.ssc-fc-back--silver{background:linear-gradient(160deg,#3d4652 0%,#262d37 46%,#14181f 100%);}",
    ".ssc-fc--back.ssc-fc-back--gold{background:linear-gradient(160deg,#5a4717 0%,#3a2c0c 46%,#1e1606 100%);}",
    ".ssc-fc--back.ssc-fc-back--icon{background:linear-gradient(160deg,#22357a 0%,#151f4a 46%,#0a0e24 100%);}",
    ".ssc-fc--back::after{content:'';position:absolute;inset:0;pointer-events:none;",
    "  background:repeating-linear-gradient(135deg,rgba(255,255,255,.035) 0 2px,transparent 2px 9px);}",
    ".ssc-fc-back-mark{position:absolute;left:50%;top:46%;width:52cqw;height:52cqw;",
    "  margin:-26cqw 0 0 -26cqw;display:grid;place-items:center;",
    "  clip-path:polygon(50% 0%,100% 22%,100% 74%,50% 100%,0% 74%,0% 22%);",
    "  background:linear-gradient(150deg,rgba(255,255,255,.16),rgba(255,255,255,.03));",
    "  border:1px solid rgba(255,255,255,.22);",
    "  color:rgba(255,255,255,.85);font-size:19cqw;font-weight:800;",
    "  font-stretch:condensed;letter-spacing:.02em;}",
    ".ssc-fc-back-label{position:absolute;left:0;right:0;bottom:20cqw;text-align:center;",
    "  font-size:5.6cqw;letter-spacing:.24em;text-transform:uppercase;opacity:.55;",
    "  font-stretch:condensed;}",
    ".ssc-fc-back-ring{position:absolute;inset:7cqw;border:1px solid rgba(255,255,255,.09);",
    "  border-radius:8cqw;pointer-events:none;",
    "  clip-path:polygon(2.5% 12.3%,5.5% 12.3%,8.5% 11.3%,11.5% 10%,14.5% 5%,17.5% 4.3%,20.5% 3.7%,23.5% 3.3%,26.5% 3%,29.5% 2.7%,32.5% 2.3%,35.5% 2%,38.5% 1.7%,41.5% 1.7%,44.5% 1.7%,47.5% 1.7%,50.5% 1.3%,53.5% 1.7%,56.5% 1.7%,59.5% 1.7%,62.5% 2%,65.5% 2%,68.5% 2.3%,71.5% 2.7%,74.5% 3.3%,77.5% 3.7%,80.5% 4.3%,83.5% 5%,86.5% 9%,89.5% 11%,92.5% 12%,95.5% 12.3%,97% 13%,97% 84.7%,94% 88%,91% 89%,88% 89.7%,85% 90.3%,82% 91%,79% 91.3%,76% 92%,73% 92.7%,70% 93.3%,67% 94%,64% 94.7%,61% 95.3%,58% 96%,55% 97%,52% 98%,49% 98.7%,46% 97.3%,43% 96.3%,40% 95.7%,37% 95%,34% 94.3%,31% 93.7%,28% 93%,25% 92.3%,22% 91.7%,19% 91%,16% 90.7%,13% 90%,10% 89.3%,7% 88.3%,4% 86.7%,2.5% 85.3%);}",

    "/* ---------- foil frames, holo + tilt that follow the cursor ---------- */",
    ".ssc-fc-wrap{transition:translate .5s cubic-bezier(.34,1.56,.64,1),filter .3s ease;}",
    ".ssc-fc-wrap:hover:not(:has(.ssc-fc--fill)){translate:0 -6px;",
    "  filter:drop-shadow(0 0 40px var(--sc-glow)) drop-shadow(0 28px 30px rgba(0,0,0,.55));}",
    // Metallic foil, drawn in CSS: gold, silver, bronze and the cream-white icon.
    ".ssc-fc.tier-bronze{background:radial-gradient(130% 80% at 22% 0%,rgba(255,236,214,.6),transparent 56%),linear-gradient(155deg,#f4cfa4 0%,#d99a62 20%,#a8683a 42%,#e3ae78 55%,#935a2f 76%,#5f3a1c 100%);color:#2e1a08;}",
    ".ssc-fc.tier-silver{background:radial-gradient(130% 80% at 22% 0%,rgba(255,255,255,.75),transparent 56%),linear-gradient(155deg,#ffffff 0%,#dfe5ec 20%,#a9b3c0 42%,#eef1f5 55%,#8993a2 76%,#5b6573 100%);color:#1f2630;}",
    ".ssc-fc.tier-gold{background:radial-gradient(130% 80% at 22% 0%,rgba(255,250,214,.75),transparent 56%),linear-gradient(155deg,#fff6c4 0%,#f3d160 20%,#c8921c 42%,#f8e082 55%,#b17a14 76%,#7a520e 100%);color:#35240a;}",
    ".ssc-fc.tier-icon{background:radial-gradient(130% 80% at 22% 0%,rgba(255,255,255,.8),transparent 56%),radial-gradient(90% 60% at 85% 85%,rgba(120,210,255,.35),transparent 60%),radial-gradient(80% 50% at 10% 90%,rgba(255,150,220,.3),transparent 60%),linear-gradient(155deg,#fffdf2 0%,#f4e6b6 30%,#e6d39a 52%,#f9f0cf 70%,#cdb877 100%);color:#3a2c0a;}",
    ".ssc-fc[class*='tier-']{box-shadow:inset 0 0 0 1px rgba(255,255,255,.5),inset 0 0 26px rgba(255,255,255,.3);}",
    ".ssc-fc[class*='tier-']::before{display:block;content:'';position:absolute;inset:0;pointer-events:none;z-index:1;mix-blend-mode:soft-light;background:radial-gradient(90% 55% at 50% 118%,rgba(255,255,255,.55),transparent 60%),radial-gradient(70% 45% at 50% 38%,rgba(255,255,255,.35),transparent 70%),repeating-linear-gradient(115deg,rgba(255,255,255,.16) 0 .6cqw,transparent .6cqw 2.4cqw);}",
    ".ssc-fc.tier-bronze,.ssc-fc.tier-silver,.ssc-fc.tier-gold{text-shadow:0 1px 0 rgba(255,255,255,.45);}",
    ".ssc-fc-sil{position:absolute;right:4cqw;top:11cqw;width:56cqw;height:56cqw;opacity:.1;pointer-events:none;}",
    ".ssc-fc-holo{position:absolute;inset:0;z-index:3;pointer-events:none;opacity:0;mix-blend-mode:color-dodge;",
    "  transition:opacity .35s ease;background:radial-gradient(circle at var(--mx,50%) var(--my,30%),rgba(255,255,255,.6),transparent 42%),linear-gradient(115deg,transparent 18%,rgba(255,60,160,.42) 34%,rgba(60,220,255,.42) 48%,rgba(255,235,90,.36) 60%,transparent 78%);background-size:100% 100%,260% 260%;",
    "  background-position:0 0,var(--mx,50%) var(--my,50%);}",
    ".ssc-fc:hover .ssc-fc-holo{opacity:.85;}",
    ".ssc-fc:not(.ssc-fc--fill){transition:transform .5s cubic-bezier(.175,.885,.32,1.275);}",
    ".ssc-fc:not(.ssc-fc--fill):hover{transform:perspective(700px) rotateX(var(--tiltx,0deg)) rotateY(var(--tilty,0deg));}",
    ".ssc-fc-num{font-weight:900;}",
    ".ssc-fc-vak{opacity:1;font-weight:700;}",
    ".ssc-fc-rating{left:13cqw;top:15.5cqw;}",
    ".ssc-fc-emblem{right:10cqw;top:15cqw;}",
    ".ssc-fc-vak{bottom:13cqw;left:26cqw;right:26cqw;}",
    // FUT 16 frame: name sits on the frame's own bar, stats on its lines.
    ".ssc-fc[class*='tier-'] .ssc-fc-line{display:none;}",
    ".ssc-fc[class*='tier-'] .ssc-fc-rating{top:19cqw;}",
    ".ssc-fc[class*='tier-'] .ssc-fc-emblem{top:19cqw;}",
    ".ssc-fc[class*='tier-'] .ssc-fc-sil{top:17cqw;}",
    ".ssc-fc[class*='tier-'] .ssc-fc-name{top:71cqw;left:9cqw;right:9cqw;}",
    ".ssc-fc[class*='tier-'] .ssc-fc-stats{top:87cqw;gap:3.6cqw 6cqw;}",
    ".ssc-fc.tier-icon{color:#3a2c0a;text-shadow:0 1px 0 rgba(255,255,255,.55);}",

    "@media not all{" /* was prefers-reduced-motion: cutscenes always play in full */,
    "  .ssc-fc-wrap[data-enter='1']{animation:none;}",
    "  .ssc-fc-shine[data-on='1']{animation:none;}",
    "}",
  ].join("\n");

  /* ---------- helpers ---------- */

  function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  /** First three letters of the subject, as the card's "position". */
  function posOf(vak) {
    var letters = String(vak || "")
      .normalize("NFD")
      .replace(/[^A-Za-z]/g, "");
    return (letters.slice(0, 3) || "???").toUpperCase();
  }

  var EMOJI_MAP = [
    ["wiskunde", "🧮"], ["fysica", "⚛️"], ["chemie", "🧪"], ["biologie", "🧬"],
    ["nederlands", "📖"], ["frans", "🗣️"], ["engels", "🗣️"], ["duits", "🗣️"],
    ["spaans", "🗣️"], ["geschiedenis", "🏛️"], ["aardrijkskunde", "🌍"],
    ["informatica", "💻"], ["lichamelijke", "⚽"], ["godsdienst", "🕊️"],
    ["zedenleer", "🕊️"], ["economie", "📈"], ["techniek", "🔧"], ["muziek", "🎵"],
    ["plastische", "🎨"], ["latijn", "🏺"], ["wetenschappen", "🔬"],
    ["stem", "🔬"], ["elektriciteit", "⚡"], ["mechanica", "⚙️"], ["engineering", "🛠️"],
  ];

  function emojiFor(vak) {
    var v = String(vak || "").toLowerCase();
    for (var i = 0; i < EMOJI_MAP.length; i++) {
      if (v.indexOf(EMOJI_MAP[i][0]) !== -1) return EMOJI_MAP[i][1];
    }
    return "📚";
  }

  /*
   * Line icons per subject, drawn on a 24-unit grid and stroked in
   * currentColor, so they take the tier's ink. Each entry is a list of
   * [tag, attributes]; a bare string is a path.
   */
  var ICONS = {
    calc: [["rect", { x: 5, y: 2.5, width: 14, height: 19, rx: 2.5 }], ["rect", { x: 8, y: 5.5, width: 8, height: 4, rx: 1 }],
      "M8.5 13.5h.01M12 13.5h.01M15.5 13.5h.01M8.5 17.5h.01M12 17.5h.01M15.5 17.5h.01"],
    atom: [["circle", { cx: 12, cy: 12, r: 1.6 }], ["ellipse", { cx: 12, cy: 12, rx: 10, ry: 4 }],
      ["ellipse", { cx: 12, cy: 12, rx: 10, ry: 4, transform: "rotate(60 12 12)" }],
      ["ellipse", { cx: 12, cy: 12, rx: 10, ry: 4, transform: "rotate(-60 12 12)" }]],
    flask: ["M9 3h6M10 3v6.2l-5.3 9.3A1.7 1.7 0 0 0 6.2 21h11.6a1.7 1.7 0 0 0 1.5-2.5L14 9.2V3M7.2 15h9.6"],
    dna: ["M7 2.5c0 6.5 10 8.5 10 19M17 2.5c0 6.5-10 8.5-10 19M8.6 6.5h6.8M10.2 10h3.6M10.2 14h3.6M8.6 17.5h6.8"],
    book: ["M4.5 5.5A2.5 2.5 0 0 1 7 3h12.5v15H7a2.5 2.5 0 0 0-2.5 2.5zM4.5 20.5V5.5M19.5 18v3H7M8.5 7.5h7"],
    talk: ["M20.5 11.5a8 8 0 0 1-11.7 7.1L3.5 20.5l1.8-4.9a8 8 0 1 1 15.2-4.1zM8.5 10h7M8.5 13.5h4.5"],
    temple: ["M3 9 12 3.5 21 9zM5.5 9v9M9.8 9v9M14.2 9v9M18.5 9v9M3.5 18.5h17M2.5 21h19"],
    globe: [["circle", { cx: 12, cy: 12, r: 9 }], "M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"],
    laptop: [["rect", { x: 4.5, y: 5, width: 15, height: 10.5, rx: 1.6 }], "M2.5 19h19M9.5 9l-2 1.8 2 1.8M14.5 9l2 1.8-2 1.8"],
    ball: [["circle", { cx: 12, cy: 12, r: 9 }], "M12 8.2l3.4 2.5-1.3 4h-4.2l-1.3-4zM12 8.2V3.2M15.4 10.7l4.7-1.6M14.1 14.7l2.9 4M9.9 14.7 7 18.7M8.6 10.7 3.9 9.1"],
    flame: ["M12 2.5c2.2 2.6 5.5 5.6 5.5 10a5.5 5.5 0 0 1-11 0c0-2.4 1.1-4 2.4-5.3.2 1.7 1 2.8 2.1 3.3-.3-3 .2-5.6 1-8z"],
    chart: ["M3.5 3.5v17h17M7.5 15l4-4.5 3 3 5.5-6.5M15.5 7h4.5v4.5"],
    wrench: ["M14.6 3.4a5 5 0 0 0-5.5 6.9L3 16.4 7.6 21l6.1-6.1a5 5 0 0 0 6.9-5.5l-3.2 3.2-3.5-1-1-3.5z"],
    music: ["M9 18V5.5l11-2.2V16"].concat([["circle", { cx: 6.5, cy: 18, r: 2.6 }], ["circle", { cx: 17.5, cy: 16, r: 2.6 }]]),
    palette: ["M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.2a4.8 4.8 0 0 0 4.8-4.8C22 6.1 17.5 3 12 3zM7.5 11.5h.01M9.5 7.5h.01M14.5 7h.01M17 10.5h.01"],
    scroll: ["M8 4.5h10.5a2 2 0 0 1 2 2V8h-4M16.5 6.5V18a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18v-1.5h10V18a2.5 2.5 0 0 0 2.5 2.5M8 4.5a2 2 0 0 0-2 2v10M9.5 9h4M9.5 12.5h4"],
    lens: ["M10 3.5h4v8h-4zM12 11.5v3M6 21h12M15.5 21a6.5 6.5 0 0 0-1-12.4M8.5 17.5h7"],
    bolt: ["M13.5 2.5 4.5 14h7l-1 7.5 9-11.5h-7z"],
    gear: [["circle", { cx: 12, cy: 12, r: 3 }], ["circle", { cx: 12, cy: 12, r: 7 }],
      "M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"],
  };

  var ICON_MAP = [
    ["wiskunde", "calc"], ["fysica", "atom"], ["chemie", "flask"], ["biologie", "dna"],
    ["nederlands", "book"], ["frans", "talk"], ["engels", "talk"], ["duits", "talk"],
    ["spaans", "talk"], ["geschiedenis", "temple"], ["aardrijkskunde", "globe"],
    ["informatica", "laptop"], ["lichamelijke", "ball"], ["godsdienst", "flame"],
    ["zedenleer", "flame"], ["economie", "chart"], ["techniek", "wrench"], ["muziek", "music"],
    ["plastische", "palette"], ["latijn", "scroll"], ["wetenschappen", "lens"],
    ["stem", "lens"], ["elektriciteit", "bolt"], ["mechanica", "gear"], ["engineering", "gear"],
  ];

  var SVG_NS = "http://www.w3.org/2000/svg";

  /** The subject's line icon as an <svg>, stroked in currentColor. */
  function iconFor(vak) {
    var v = String(vak || "").toLowerCase();
    var name = "book";
    for (var i = 0; i < ICON_MAP.length; i++) {
      if (v.indexOf(ICON_MAP[i][0]) !== -1) {
        name = ICON_MAP[i][1];
        break;
      }
    }
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.7");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "ssc-subject-icon");
    ICONS[name].forEach(function (part) {
      var tag = typeof part === "string" ? "path" : part[0];
      var attrs = typeof part === "string" ? { d: part } : part[1];
      var node = document.createElementNS(SVG_NS, tag);
      Object.keys(attrs).forEach(function (k) {
        node.setAttribute(k, String(attrs[k]));
      });
      svg.appendChild(node);
    });
    return svg;
  }

  function shortDate(datum) {
    // Smartschool dates arrive as DD/MM/YYYY from settings.js formatDate().
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(datum || ""));
    if (m) return m[1] + "/" + m[2];
    // ISO dates (the API's own form) get the same short day/month.
    var iso = /^(d{4})-(d{2})-(d{2})/.exec(String(datum || ""));
    if (iso) return iso[3] + "/" + iso[2];
    return String(datum || "");
  }

  function fmt1(value) {
    return Number(value).toFixed(1).replace(".", ",");
  }

  /* ---------- the card ---------- */

  /**
   * The percentage the card shows. Callers normally pass it, but the raw
   * score is enough to derive it, and showing "–" for a grade we could
   * compute would be worse than computing it.
   */
  function percentOf(g) {
    if (typeof g.percentage === "number" && isFinite(g.percentage)) return g.percentage;
    var score = Number(g.score);
    var max = Number(g.max);
    if (isFinite(score) && isFinite(max) && max > 0) return (score / max) * 100;
    return null;
  }

  /**
   * Builds the card element.
   *
   * @param {Object} grade
   *   { op20, percentage, vak, titel, datum, periode, score, max, type }
   * @param {Object} [options]
   *   { animateShine, enter, reveal }
   *
   * Returns numNode as the /20 reference number (tunnel.js and team.js write
   * their /20 value into it) and percentNode/percentText as the big number
   * the reveal styles count up.
   */
  /** Faint head-and-shoulders bust behind the emblem; shared with the mini card. */
  function silhouette(cls) {
    var NS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("class", cls);
    svg.setAttribute("aria-hidden", "true");
    var p = document.createElementNS(NS, "path");
    p.setAttribute("d", "M50 8c10 0 17 8 17 19s-7 21-17 21-17-10-17-21S40 8 50 8zM8 100c0-26 14-40 30-44l12 10 12-10c16 4 30 18 30 44z");
    p.setAttribute("fill", "currentColor");
    svg.appendChild(p);
    return svg;
  }

  /**
   * The holo sheen and glare sit where the cursor is (--mx/--my, read by the card CSS).
   * One delegated listener for every .ssc-fc / .ssc-mc, also inside shadow roots (composedPath),
   * throttled to one update per frame.
   */
  var holoBound = false;
  function bindHolo() {
    if (holoBound) return;
    holoBound = true;
    var raf = 0;
    var last = null;
    function apply() {
      raf = 0;
      var card = last.card;
      var r = card.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var px = (last.x - r.left) / r.width;
      var py = (last.y - r.top) / r.height;
      card.style.setProperty("--mx", px * 100 + "%");
      card.style.setProperty("--my", py * 100 + "%");
      card.style.setProperty("--tilty", (px - 0.5) * 14 + "deg");
      card.style.setProperty("--tiltx", (0.5 - py) * 14 + "deg");
    }
    document.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      var path = e.composedPath();
      for (var i = 0; i < path.length && i < 14; i++) {
        var n = path[i];
        if (n.classList && (n.classList.contains("ssc-fc") || n.classList.contains("ssc-mc"))) {
          last = { card: n, x: e.clientX, y: e.clientY };
          if (!raf) raf = requestAnimationFrame(apply);
          return;
        }
      }
    }, { passive: true });
  }

  function trackHolo() {
    bindHolo();
  }

  function build(grade, options) {
    var opts = options || {};
    var g = grade || {};

    var pct = percentOf(g);
    var tier = tierForPercent(pct);
    var op20 = typeof g.op20 === "number" && isFinite(g.op20) ? g.op20 : null;
    // Ultimate Team passes a FUT rating (1-100, class average dependent):
    // then that is the big number and the percentage moves to the stats.
    var futRating = typeof opts.rating === "number" && isFinite(opts.rating) ? Math.round(opts.rating) : null;
    // The big number is the percentage; ratingText keeps its old meaning of
    // "the /20 number" so existing writers (tunnel, team) stay correct.
    var percentText = futRating !== null ? String(futRating) : pct === null ? "–" : String(Math.round(pct));
    var ratingText = op20 === null ? "–" : fmt1(op20);


    var wrap = el("div", "ssc-fc-wrap");
    wrap.style.setProperty("--sc-glow", tier.glow);
    if (opts.enter === true) wrap.setAttribute("data-enter", "1");

    var card = el("div", "ssc-fc tier-" + tier.id + (opts.fill ? " ssc-fc--fill" : ""));

    var shine = el("div", "ssc-fc-shine");
    if (opts.animateShine !== false) shine.setAttribute("data-on", "1");
    card.appendChild(shine);
    card.appendChild(el("div", "ssc-fc-holo"));
    trackHolo(card);

    // --- rating block ---
    // Three digits ("100") need the narrow face; two fit at full size.
    var rating = el(
      "div",
      "ssc-fc-rating" + (percentText.length > 2 ? " wide" : "") + (futRating !== null ? " is-rating" : "")
    );
    var numRow = el("div", "ssc-fc-numrow");
    // The card starts on the real value, not "0": a style that never runs a
    // count-up (tunnel, team) must not sit on a placeholder.
    var num = el("span", "ssc-fc-num", percentText);
    num.setAttribute("data-target", percentText);
    numRow.appendChild(num);
    if (pct !== null && futRating === null) numRow.appendChild(el("span", "ssc-fc-num-unit", "%"));
    rating.appendChild(numRow);
    rating.appendChild(el("span", "ssc-fc-pos", posOf(g.vak)));

    // The /20 conversion, small, under the percentage.
    var op20Node = null;
    if (op20 !== null) {
      var sub = el("span", "ssc-fc-sub");
      op20Node = el("b", "ssc-fc-sub-num", fmt1(op20));
      sub.appendChild(op20Node);
      sub.appendChild(document.createTextNode(" / 20"));
      rating.appendChild(sub);
    }

    var typeLabel = g.type || "";
    if (typeLabel) rating.appendChild(el("span", "ssc-fc-type", typeLabel));
    card.appendChild(rating);

    // --- emblem ---
    var emblem = el("div", "ssc-fc-emblem");
    emblem.appendChild(iconFor(g.vak));
    emblem.setAttribute("aria-hidden", "true");
    card.appendChild(emblem);

    // --- name ---
    card.appendChild(el("div", "ssc-fc-name", g.titel || g.vak || "Cijfer"));
    card.appendChild(el("div", "ssc-fc-line"));

    // --- stats: empty cells are dropped, not shown as dashes ---
    // Percentage and /20 already sit under the big number, so they are not
    // repeated here.
    var stats = [];
    if (futRating !== null && pct !== null) stats.push([String(Math.round(pct)) + "%", "PUNT"]);
    if (g.score !== undefined && g.max !== undefined && g.max !== "") {
      // Numeric scores get the Flemish decimal comma, like the /20 line.
      var scoreText =
        typeof g.score === "number" && g.score % 1 !== 0 ? fmt1(g.score) : String(g.score);
      stats.push([scoreText + "/" + String(g.max), futRating !== null ? "SCORE" : "PUNT"]);
    }
    if (g.datum) stats.push([shortDate(g.datum), "DAT"]);
    if (g.periode) stats.push([g.periode, "PER"]);
    if (g.type) stats.push([g.type, "TYP"]);
    // Two rows of two fit under the line; more would run off the shield.
    stats = stats.slice(0, 4);

    if (stats.length) {
      var grid = el("div", "ssc-fc-stats");
      for (var i = 0; i < stats.length; i++) {
        var cell = el("div", "ssc-fc-stat");
        var val = el("b", null, stats[i][0]);
        if (String(stats[i][0]).length > 8) val.style.fontSize = "6cqw"; // "Periode 2" ran into an ellipsis at full size
        cell.appendChild(val);
        cell.appendChild(el("span", null, stats[i][1]));
        grid.appendChild(cell);
      }
      card.appendChild(grid);
    }

    // --- subject footer ---
    if (g.vak) card.appendChild(el("div", "ssc-fc-vak", g.vak));

    wrap.appendChild(card);

    return {
      node: wrap,
      card: card,
      // The /20 number, kept under the old name because tunnel.js and team.js
      // write their /20 value into it.
      numNode: op20Node,
      ratingText: ratingText,
      // The big percentage: what the reveal count-ups animate.
      percentNode: num,
      percentText: percentText,
      tier: tier,
    };
  }

  /**
   * The sealed face: same shield, same ratio, none of the grade. The reel
   * shows these so a decoy never leaks anything; the real card only exists
   * on the result screen.
   *
   * @param {Object} [options] { fill, label }
   */
  function buildBack(options) {
    var opts = options || {};

    var wrap = el("div", "ssc-fc-wrap");
    var card = el("div", "ssc-fc ssc-fc--back" + (opts.fill ? " ssc-fc--fill" : ""));
    // The tier tint on a sealed pack still says "this one was low/high" to the
    // eye without ever showing the number.
    if (opts.tier) card.classList.add("ssc-fc-back--" + opts.tier);

    card.appendChild(el("div", "ssc-fc-back-ring"));

    var mark = el("div", "ssc-fc-back-mark", "SSC");
    mark.setAttribute("aria-hidden", "true");
    card.appendChild(mark);
    card.appendChild(el("div", "ssc-fc-back-label", opts.label || "Cijfer"));

    wrap.appendChild(card);
    return { node: wrap, card: card };
  }

  /**
   * Counts the rating up from 0. Non-numeric ratings are left alone rather
   * than animating to nothing.
   */
  function countUp(numNode, targetText, ms) {
    if (!numNode) return;
    var target = parseFloat(String(targetText).replace(",", "."));
    if (!isFinite(target) || !(ms > 0)) {
      // "–" has nothing to count to, and a 0ms duration divides by zero on
      // the first frame (0/0 → NaN, which would print "NaN").
      numNode.textContent = targetText;
      return;
    }

    var decimals = String(targetText).indexOf(",") !== -1 ? 1 : 0;
    var start = performance.now();

    function frame(now) {
      var p = Math.min(1, (now - start) / ms);
      var eased = 1 - Math.pow(1 - p, 3);
      var current = target * eased;
      numNode.textContent =
        decimals === 1
          ? current.toFixed(1).replace(".", ",")
          : String(Math.round(current));
      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        // Bug 10: land on the exact caller-provided text. Rounding at the
        // last frame can be off by one (e.g. 78.6 → "79" vs "79,0" forms),
        // and a tab that was hidden mid-count must still end on the real
        // grade rather than a partial number.
        numNode.textContent = targetText;
      }
    }
    requestAnimationFrame(frame);
  }

  /** Injects the card stylesheet once per shadow root. */
  function ensureStyles(shadow) {
    if (!shadow) return;
    if (shadow.querySelector("style[data-ssc-fifa]")) return;
    var style = document.createElement("style");
    style.setAttribute("data-ssc-fifa", "1");
    style.textContent = CARD_CSS;
    shadow.appendChild(style);
  }

  window.sscFifaCard = {
    build: build,
    buildBack: buildBack,
    countUp: countUp,
    ensureStyles: ensureStyles,
    tierForPercent: tierForPercent,
    emojiFor: emojiFor,
    iconFor: iconFor,
    posOf: posOf,
    shortDate: shortDate,
    CSS: CARD_CSS,
    silhouette: silhouette,
    trackHolo: trackHolo,
  };
})();
