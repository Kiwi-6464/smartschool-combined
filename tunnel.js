/**
 * Smartschool Combined — walkout cutscene, modelled on the FIFA 23 pack
 * walkout.
 *
 * The second of the two cutscene styles. Where the reel (cutscene.js) spins
 * sealed packs past a marker, this is one continuous shot of a floodlit
 * stage, and the grade's card takes the place of the player card:
 *
 *   0.0s   blackout: the stage and its gold halo are silhouettes
 *   0.65s  the floodlight banks slam on, the halo catches the light,
 *          the camera starts its slow push in from low and wide
 *   1.5s   the card fills with its tier colour, still blank
 *   2.5s   FLAG     → VAK: the subject's badge wipes onto both side banners
 *                      and onto the card
 *   3.5s   RATING   → PUNT: the percentage counts up on the card
 *   5.5s   POSITION → TOETS: the test's title fills the top of the banners
 *                      and the card's name line
 *   6.7s   FACE     : flash, the card is complete (stats included), the
 *                      camera pushes in, rays and sparks fill the screen
 *
 * The layout follows the game's: a tall card on a stepped gold stage, a
 * banner on either side of it on its own plinth, rings of gold overhead and
 * banks of floodlights in the stands behind.
 *
 * Shared with the reel, deliberately not reimplemented:
 *   - the FIFA card, tiers and subject icons (fifa-card.js)
 *   - the shared AudioContext, unlocked once per page (cutscene.js)
 *
 * One contract: sscPlayCutsceneTunnel(opts) takes exactly the same options
 * object as sscPlayCutscene, so walkout.js's queue, the checkbox flow and
 * reveal.js's click handler do not know which style is running.
 */
(function () {
  "use strict";

  // Sign-in pages: do nothing at all (see guard.js).
  if (window.sscSkipPage) return;

  if (window.sscPlayCutsceneTunnel) return;

  /* ---------- timeline ---------- */

  /**
   * The beats of the shot, in ms from the start. The gaps follow the video:
   * the lights hit fast, the rating gets the longest beat, and the face
   * waits a moment after the position so it reads as the payoff.
   */
  var LIGHTS_AT = 650;
  var CARD_AT = 1500;
  var FLAG_AT = 2500;
  var RATING_AT = 3500;
  var COUNT_MS = 1700;
  var TOETS_AT = 5500;
  var FACE_AT = 6700;
  var ACTIONS_AT = FACE_AT + 900;

  var VOLUME = 0.8;
  /** Reveal cue inside case-opening.mp3, shared with the reel. */
  var REVEAL_OFFSET = 6.47;

  var TIER_LABEL = { bronze: "Brons", silver: "Zilver", gold: "Goud", icon: "Icon" };

  /* ---------- helpers ---------- */

  function h(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function fmt1(value) {
    return Number(value).toFixed(1).replace(".", ",");
  }

  function getLive() {
    var host = document.getElementById("ssc-root");
    if (!host || !host.shadowRoot) return null;
    var layer = host.shadowRoot.querySelector(".ssc-layer");
    if (!layer) return null;
    return { shadow: host.shadowRoot, layer: layer };
  }

  function cardModule() {
    return window.sscFifaCard || null;
  }

  /*
   * Always false: the user chose (2026-10-28) that cutscenes play in full
   * even when Windows/Edge asks for reduced motion. The reduced path (jump
   * straight to the finished stage) stays so a settings toggle can bring it
   * back.
   */
  function prefersReduced() {
    return false;
  }

  function tierIdForPercent(percent) {
    var card = cardModule();
    if (card && card.tierForPercent) return card.tierForPercent(percent).id;
    return percent < 50 ? "bronze" : percent < 70 ? "silver" : percent < 85 ? "gold" : "icon";
  }

  function tierGlowForPercent(percent) {
    var card = cardModule();
    if (card && card.tierForPercent) return card.tierForPercent(percent).glow;
    return percent < 50 ? "#d08a4a" : percent < 70 ? "#cfd6e0" : percent < 85 ? "#ffd34d" : "#6ea8ff";
  }

  /** The subject's line icon (fifa-card.js), or nothing without the module. */
  function iconFor(vak) {
    var card = cardModule();
    return card && card.iconFor ? card.iconFor(vak) : null;
  }

  function ensureStyles(shadow) {
    if (shadow.querySelector("style[data-ssc-tunnel]")) return;
    var style = document.createElement("style");
    style.setAttribute("data-ssc-tunnel", "1");
    style.textContent = STYLE;
    shadow.appendChild(style);
  }

  /* ---------- style ---------- */

  /**
   * Two layers, both the full viewport:
   *   .ssc-wo-world  the stadium and the set, moved by the camera
   *   .ssc-wo-fx     rays and sparks at the reveal, never clipped by a box
   * The set itself (halo, banners, card, stage) keeps a 16:9 composition
   * inside the space between the header and the footer, measured in --u
   * (one hundredth of the set's width), and turns into a 9:16 one on tall
   * screens.
   */
  var STYLE = [
    ".ssc-tunnel-overlay{",
    "  --tw-text:#f5f7fa;--tw-muted:#d5dbe4;--tw-focus:#7cb4ff;",
    "  position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483001;display:flex;flex-direction:column;",
    "  overflow:hidden;box-sizing:border-box;background:#020304;color:var(--tw-text);",
    "  font-family:system-ui,-apple-system,'Segoe UI',sans-serif;pointer-events:auto;",
    "  opacity:0;transition:opacity 320ms ease;",
    "}",
    ".ssc-tunnel-overlay[data-in='1']{opacity:1;}",
    ".ssc-tunnel-overlay *{box-sizing:border-box;}",
    ".ssc-tunnel-overlay:focus{outline:none;}",
    ".ssc-tunnel-main{position:relative;z-index:2;flex:1;min-height:0;pointer-events:none;}",

    /* --- tier palettes: metal hue/saturation, banner board, light --- */
    ".ssc-tunnel-overlay{--wo-h:44;--wo-s:78%;--wo-board:#f4e6b4;--wo-plate:#3a2a08;--wo-ink:#2c1f05;--wo-lamp:255,238,196;}",
    ".ssc-tunnel-overlay[data-tier='bronze']{--wo-h:28;--wo-s:58%;--wo-board:#efd2ae;--wo-plate:#3d2410;--wo-ink:#2e1a08;--wo-lamp:255,226,190;}",
    ".ssc-tunnel-overlay[data-tier='silver']{--wo-h:214;--wo-s:14%;--wo-board:#eef1f5;--wo-plate:#262d37;--wo-ink:#1b222c;--wo-lamp:236,244,255;}",
    ".ssc-tunnel-overlay[data-tier='icon']{--wo-h:42;--wo-s:62%;--wo-board:#f6f7fa;--wo-plate:#17214a;--wo-ink:#141a2e;--wo-lamp:240,246,255;}",

    /* --- world + camera --- */
    ".ssc-wo-world{position:fixed;top:0;left:0;width:100vw;height:100vh;overflow:hidden;z-index:0;pointer-events:none;}",
    ".ssc-wo-world[data-shake='1']{animation:ssc-wo-shake 700ms cubic-bezier(.36,.07,.19,.97) both;}",
    "@keyframes ssc-wo-shake{",
    "  10%,90%{transform:translate(-2px,1px);}20%,80%{transform:translate(5px,-3px) rotate(.3deg);}",
    "  30%,50%,70%{transform:translate(-8px,4px) rotate(-.4deg);}40%,60%{transform:translate(8px,-4px) rotate(.4deg);}",
    "}",
    // The dolly: from low and wide to level and close over the build-up.
    ".ssc-wo-cam{position:absolute;inset:0;transform-origin:50% 46%;",
    "  animation:ssc-wo-dolly " + FACE_AT + "ms cubic-bezier(.33,0,.25,1) both;}",
    "@keyframes ssc-wo-dolly{from{transform:translateY(3%) scale(.94);}to{transform:none;}}",
    // The push at the face, on its own element so it never fights the dolly.
    ".ssc-wo-push{position:absolute;inset:0;transform-origin:50% 44%;",
    "  transition:transform 1400ms cubic-bezier(.16,1,.3,1);}",
    ".ssc-wo-world[data-face='1'] .ssc-wo-push{transform:scale(1.12);}",

    /* --- the stadium (full screen, a little larger for the dolly) --- */
    ".ssc-wo-env{position:absolute;inset:-5%;}",
    ".ssc-wo-env > *{position:absolute;pointer-events:none;}",
    ".ssc-wo-sky{inset:0;background:radial-gradient(ellipse 80% 62% at 50% 40%,hsl(var(--wo-h) 26% 13%),#07090d 58%,#020304);}",
    // Two tiers of stands: rows, a speckled crowd, a darker lip between them.
    ".ssc-wo-stands{left:0;right:0;top:24%;height:40%;",
    "  background:",
    "    radial-gradient(1px 1px at 30% 40%,rgba(255,255,255,.4),transparent) 0 0/9px 7px,",
    "    radial-gradient(1px 1px at 70% 60%,rgba(var(--wo-lamp),.32),transparent) 0 0/13px 9px,",
    "    repeating-linear-gradient(180deg,rgba(255,255,255,.05) 0 2px,transparent 2px 14px),",
    "    linear-gradient(180deg,#0b0e14 0,#161b23 46%,#07090c 50%,#141820 54%,#0a0c10 100%);",
    "  -webkit-mask-image:radial-gradient(ellipse 72% 100% at 50% 100%,#000 55%,transparent 100%);",
    "  mask-image:radial-gradient(ellipse 72% 100% at 50% 100%,#000 55%,transparent 100%);",
    "  opacity:.55;transition:opacity 1200ms ease;}",
    ".ssc-wo-world[data-lights='1'] .ssc-wo-stands{opacity:1;}",
    // Floodlight banks: a grid of lamps on a tilted frame, off until the hit.
    ".ssc-wo-bank{width:17vw;height:7vw;border-radius:.4vw;",
    "  background:radial-gradient(circle,#fff 0 20%,rgba(var(--wo-lamp),.85) 32%,transparent 50%) 0 0/1.42vw 1.42vw,",
    "    linear-gradient(#11141a,#0a0c10);",
    "  box-shadow:0 0 0 .3vw #1a1e26;filter:brightness(.18);}",
    ".ssc-wo-bank--l1{left:4%;top:16%;transform:perspective(500px) rotateY(32deg) rotateZ(-4deg);}",
    ".ssc-wo-bank--r1{right:4%;top:16%;transform:perspective(500px) rotateY(-32deg) rotateZ(4deg);}",
    ".ssc-wo-bank--l2{left:15%;top:5%;width:11vw;height:4.3vw;transform:perspective(500px) rotateY(26deg) rotateZ(-7deg);}",
    ".ssc-wo-bank--r2{right:15%;top:5%;width:11vw;height:4.3vw;transform:perspective(500px) rotateY(-26deg) rotateZ(7deg);}",
    ".ssc-wo-world[data-lights='1'] .ssc-wo-bank{animation:ssc-wo-bank-on 520ms steps(1,end) both;}",
    ".ssc-wo-world[data-lights='1'] .ssc-wo-bank--r1,.ssc-wo-world[data-lights='1'] .ssc-wo-bank--l2{animation-delay:120ms;}",
    ".ssc-wo-world[data-lights='1'] .ssc-wo-bank--r2{animation-delay:220ms;}",
    "@keyframes ssc-wo-bank-on{0%{filter:brightness(.18);}25%{filter:brightness(1.3);}45%{filter:brightness(.4);}60%,100%{filter:brightness(1.15);}}",
    // Bloom around each bank and a horizontal lens streak through it.
    ".ssc-wo-bloom{width:46vw;height:30vw;margin:-15vw 0 0 -23vw;border-radius:50%;opacity:0;mix-blend-mode:screen;",
    "  background:radial-gradient(closest-side,rgba(var(--wo-lamp),.5),rgba(var(--wo-lamp),.14) 45%,transparent);",
    "  transition:opacity 700ms ease;}",
    ".ssc-wo-bloom::after{content:'';position:absolute;left:-30%;right:-30%;top:50%;height:.35vw;margin-top:-.17vw;",
    "  background:linear-gradient(90deg,transparent,rgba(170,205,255,.22) 40%,rgba(255,255,255,.5) 50%,rgba(170,205,255,.22) 60%,transparent);",
    "  filter:blur(1px);}",
    ".ssc-wo-world[data-lights='1'] .ssc-wo-bloom{opacity:1;}",
    // Beams cutting down from the banks to the stage, through the haze.
    ".ssc-wo-beam{top:10%;width:22vw;height:110vh;transform-origin:50% 0;mix-blend-mode:screen;opacity:0;",
    "  background:linear-gradient(180deg,rgba(var(--wo-lamp),.34),rgba(var(--wo-lamp),.1) 55%,transparent 90%);",
    "  clip-path:polygon(44% 0,56% 0,100% 100%,0 100%);filter:blur(5px);transition:opacity 900ms ease;}",
    ".ssc-wo-beam--1{left:6%;transform:rotate(-34deg);}",
    ".ssc-wo-beam--2{left:14%;transform:rotate(-20deg);}",
    ".ssc-wo-beam--3{right:6%;transform:rotate(34deg);}",
    ".ssc-wo-beam--4{right:14%;transform:rotate(20deg);}",
    ".ssc-wo-world[data-lights='1'] .ssc-wo-beam{opacity:1;animation:ssc-wo-beam 6s ease-in-out infinite alternate;}",
    ".ssc-wo-world[data-lights='1'] .ssc-wo-beam--3,.ssc-wo-world[data-lights='1'] .ssc-wo-beam--4{animation-delay:-3s;}",
    "@keyframes ssc-wo-beam{from{opacity:.75;}to{opacity:1;}}",
    // The floor: dark, glossy, with the gold runway the player walks down.
    ".ssc-wo-floor{left:0;right:0;bottom:0;height:34%;",
    "  background:linear-gradient(180deg,#14171c,#07080a 70%);",
    "  -webkit-mask-image:linear-gradient(180deg,transparent,#000 22%);mask-image:linear-gradient(180deg,transparent,#000 22%);}",
    ".ssc-wo-floor::before{content:'';position:absolute;left:50%;top:0;bottom:0;width:60vw;margin-left:-30vw;",
    "  clip-path:polygon(40% 0,60% 0,100% 100%,0 100%);",
    "  background:linear-gradient(180deg,hsl(var(--wo-h) var(--wo-s) 46% / .5),hsl(var(--wo-h) var(--wo-s) 30% / .18) 70%,transparent);}",
    ".ssc-wo-floor::after{content:'';position:absolute;inset:0;",
    "  background:repeating-linear-gradient(90deg,transparent 0 6vw,rgba(255,255,255,.03) 6vw 6.2vw);}",
    // Haze over the floor and dust in the beams.
    ".ssc-wo-haze{left:-10%;right:-10%;bottom:-8%;height:46%;",
    "  background:radial-gradient(ellipse 50% 60% at 30% 70%,rgba(220,226,236,.16),transparent 70%),",
    "    radial-gradient(ellipse 50% 60% at 72% 64%,rgba(220,226,236,.13),transparent 70%);",
    "  filter:blur(10px);animation:ssc-wo-haze 12s ease-in-out infinite alternate;}",
    "@keyframes ssc-wo-haze{from{transform:translateX(-3%);}to{transform:translateX(3%);}}",
    ".ssc-wo-dust{inset:0;opacity:0;transition:opacity 1500ms ease;",
    "  background-image:radial-gradient(1.4px 1.4px at 20% 30%,rgba(255,255,255,.9),transparent),",
    "    radial-gradient(1px 1px at 70% 60%,rgba(255,255,255,.8),transparent),",
    "    radial-gradient(1.8px 1.8px at 45% 85%,rgba(var(--wo-lamp),.8),transparent);",
    "  background-size:260px 260px,330px 330px,410px 410px;",
    "  animation:ssc-wo-dust 14s linear infinite;}",
    ".ssc-wo-world[data-lights='1'] .ssc-wo-dust{opacity:.6;}",
    "@keyframes ssc-wo-dust{to{background-position:30px -260px,-40px -330px,20px -410px;}}",

    /* --- the set: centred between header and footer --- */
    ".ssc-wo-stagebox{position:absolute;left:0;right:0;top:clamp(36px,9vh,56px);bottom:clamp(64px,17vh,104px);container-type:size;}",
    ".ssc-wo-set{position:absolute;left:50%;top:50%;width:min(100cqw,177.78cqh);aspect-ratio:16/9;",
    "  transform:translate(-50%,-50%);container-type:inline-size;--k:1;--u:calc(1cqw * var(--k));}",
    ".ssc-wo-set > *{position:absolute;}",

    // The halo: rings of gold panels in real 3D, seen from a little above.
    ".ssc-wo-halo{inset:-20% -10% 0;perspective:calc(160 * var(--u));perspective-origin:50% -10%;pointer-events:none;}",
    ".ssc-wo-ring{position:absolute;left:50%;width:0;height:0;transform-style:preserve-3d;}",
    ".ssc-wo-ring--a{top:30%;transform:rotateX(-14deg);}",
    ".ssc-wo-ring--b{top:40%;transform:rotateX(-10deg) rotateZ(-9deg);}",
    ".ssc-wo-ring--c{top:66%;transform:rotateX(-6deg) rotateZ(3deg);}",
    ".ssc-wo-ring i{position:absolute;left:calc(var(--w) / -2);top:calc(var(--h) / -2);width:var(--w);height:var(--h);",
    "  transform:rotateY(var(--a)) translateZ(var(--r));",
    "  background:linear-gradient(180deg,",
    "    hsl(var(--wo-h) var(--wo-s) calc(16% + var(--l) * 70%)) 0,",
    "    hsl(var(--wo-h) var(--wo-s) calc(10% + var(--l) * 46%)) 46%,",
    "    hsl(var(--wo-h) calc(var(--wo-s) * .8) calc(5% + var(--l) * 26%)) 54%,",
    "    hsl(var(--wo-h) var(--wo-s) calc(12% + var(--l) * 58%)) 100%);",
    "  filter:brightness(.16);transition:filter 900ms ease var(--d,0ms);}",
    // The light runs round the rings from the front when the lights hit.
    ".ssc-wo-world[data-lights='1'] .ssc-wo-ring i{filter:brightness(1);}",
    // A glint that travels round each ring, compositor-only (opacity).
    ".ssc-wo-ring i::after{content:'';position:absolute;inset:0;opacity:0;",
    "  background:linear-gradient(180deg,rgba(255,255,255,.9),rgba(255,255,255,.2) 45%,transparent 55%,rgba(255,255,255,.5));",
    "  animation:ssc-wo-glint 3.6s linear infinite;animation-delay:var(--g);}",
    "@keyframes ssc-wo-glint{0%,88%,100%{opacity:0;}93%{opacity:.85;}}",

    // Two pillars and an arch frame behind the card.
    ".ssc-wo-pillar{top:28%;height:44%;width:calc(3.6 * var(--u));",
    "  background:linear-gradient(90deg,hsl(var(--wo-h) var(--wo-s) 22%),hsl(var(--wo-h) var(--wo-s) 62%) 30%,hsl(var(--wo-h) var(--wo-s) 34%) 60%,hsl(var(--wo-h) var(--wo-s) 14%));",
    "  box-shadow:0 0 calc(2 * var(--u)) rgba(0,0,0,.6);filter:brightness(.18);transition:filter 1200ms ease;}",
    ".ssc-wo-pillar--l{left:35%;}",
    ".ssc-wo-pillar--r{right:35%;}",
    ".ssc-wo-arch{left:50%;top:9%;width:calc(27 * var(--u));height:62%;margin-left:calc(-13.5 * var(--u));",
    "  border-radius:calc(13.5 * var(--u)) calc(13.5 * var(--u)) calc(1 * var(--u)) calc(1 * var(--u));",
    "  border:calc(1.1 * var(--u)) solid hsl(var(--wo-h) var(--wo-s) 52%);border-bottom:0;",
    "  background:radial-gradient(ellipse 60% 55% at 50% 44%,hsl(var(--wo-h) 40% 30% / .55),transparent 72%);",
    "  box-shadow:inset 0 0 calc(3 * var(--u)) rgba(0,0,0,.7),0 0 calc(3 * var(--u)) hsl(var(--wo-h) var(--wo-s) 50% / .35);",
    "  filter:brightness(.16);transition:filter 1200ms ease 200ms;}",
    ".ssc-wo-world[data-lights='1'] .ssc-wo-pillar,.ssc-wo-world[data-lights='1'] .ssc-wo-arch{filter:none;}",
    // Behind the card at the face: a glow in the tier colour.
    ".ssc-wo-glory{left:50%;top:47%;width:calc(60 * var(--u));height:calc(60 * var(--u));",
    "  margin:calc(-30 * var(--u)) 0 0 calc(-30 * var(--u));border-radius:50%;opacity:0;",
    "  background:radial-gradient(closest-side,var(--wo-glow),transparent);mix-blend-mode:screen;",
    "  transition:opacity 900ms ease;}",
    ".ssc-wo-world[data-card='1'] .ssc-wo-glory{opacity:.35;}",
    ".ssc-wo-world[data-face='1'] .ssc-wo-glory{opacity:.75;}",
    // Rays from behind the card, sized off the viewport so they run past every
    // edge of the screen; the world (100vw × 100vh) is what clips them.
    ".ssc-wo-rays{left:50%;top:47%;width:300vmax;height:300vmax;margin:-150vmax 0 0 -150vmax;opacity:0;",
    "  mix-blend-mode:screen;pointer-events:none;",
    "  background:repeating-conic-gradient(from 0deg,var(--wo-rays) 0deg 5deg,transparent 5deg 15deg);",
    "  -webkit-mask-image:radial-gradient(circle,#000 0,rgba(0,0,0,.45) 12%,transparent 34%);",
    "  mask-image:radial-gradient(circle,#000 0,rgba(0,0,0,.45) 12%,transparent 34%);",
    "  transition:opacity 700ms ease;animation:ssc-wo-spin 60s linear infinite;}",
    ".ssc-wo-world[data-face='1'] .ssc-wo-rays{opacity:.4;}",
    "@keyframes ssc-wo-spin{to{transform:rotate(360deg);}}",

    // The stage: a long plinth across, steps down the middle.
    ".ssc-wo-base{left:11%;right:11%;top:73%;height:calc(5.6 * var(--u));",
    "  border-top:calc(.5 * var(--u)) solid hsl(var(--wo-h) var(--wo-s) 62%);",
    "  background:linear-gradient(180deg,hsl(var(--wo-h) 30% 20%),#0d0f13);",
    "  box-shadow:0 calc(-.4 * var(--u)) calc(2.4 * var(--u)) hsl(var(--wo-h) var(--wo-s) 55% / .4);",
    "  filter:brightness(.2);transition:filter 1200ms ease;}",
    ".ssc-wo-world[data-lights='1'] .ssc-wo-base{filter:none;}",
    ".ssc-wo-plaque{position:absolute;top:calc(1.2 * var(--u));width:calc(15 * var(--u));height:calc(3.2 * var(--u));",
    "  display:grid;place-items:center;border-radius:calc(.3 * var(--u));",
    "  background:linear-gradient(180deg,#fff,var(--wo-board));color:var(--wo-ink);",
    "  font:800 calc(1.6 * var(--u))/1.2 'Bahnschrift','Segoe UI',system-ui,sans-serif;letter-spacing:.2em;text-transform:uppercase;",
    "  padding-left:.2em;}",
    ".ssc-wo-plaque--l{left:calc(4.5 * var(--u));}",
    ".ssc-wo-plaque--r{right:calc(4.5 * var(--u));}",
    ".ssc-wo-steps{left:50%;top:70%;width:calc(34 * var(--u));height:22%;margin-left:calc(-17 * var(--u));",
    "  clip-path:polygon(16% 0,84% 0,100% 100%,0 100%);",
    "  background:repeating-linear-gradient(180deg,hsl(var(--wo-h) var(--wo-s) 58%) 0 calc(.35 * var(--u)),hsl(var(--wo-h) 46% 24%) calc(.35 * var(--u)) calc(2.2 * var(--u))),",
    "    hsl(var(--wo-h) 40% 20%);",
    "  -webkit-mask-image:linear-gradient(180deg,#000 50%,transparent);mask-image:linear-gradient(180deg,#000 50%,transparent);",
    "  filter:brightness(.2);transition:filter 1200ms ease 150ms;}",
    ".ssc-wo-world[data-lights='1'] .ssc-wo-steps{filter:none;}",

    // The side banners: tall boards angled toward the card.
    ".ssc-wo-banner{top:29%;width:calc(10.6 * var(--u));height:calc(24 * var(--u));",
    "  display:flex;flex-direction:column;border-radius:calc(.4 * var(--u));overflow:hidden;",
    "  background:linear-gradient(180deg,#fff,var(--wo-board) 70%);color:var(--wo-ink);",
    "  box-shadow:0 0 0 calc(.35 * var(--u)) hsl(var(--wo-h) var(--wo-s) 58%),0 calc(1 * var(--u)) calc(3 * var(--u)) rgba(0,0,0,.6);",
    "  filter:brightness(.12);transition:filter 1000ms ease;}",
    ".ssc-wo-banner--l{left:calc(23% - 5.3 * var(--u));transform:perspective(calc(60 * var(--u))) rotateY(16deg);}",
    ".ssc-wo-banner--r{right:calc(23% - 5.3 * var(--u));transform:perspective(calc(60 * var(--u))) rotateY(-16deg);}",
    ".ssc-wo-world[data-card='1'] .ssc-wo-banner{filter:none;}",
    // Top half: the position slot, here the test.
    ".ssc-wo-pos{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(.6 * var(--u));",
    "  padding:calc(1 * var(--u)) calc(.8 * var(--u));text-align:center;opacity:0;transform:translateY(calc(-1.2 * var(--u)));",
    "  transition:opacity 500ms ease,transform 700ms cubic-bezier(.16,1,.3,1);}",
    ".ssc-wo-world[data-toets='1'] .ssc-wo-pos{opacity:1;transform:none;}",
    ".ssc-wo-pos-k{font:700 calc(.95 * var(--u))/1.3 'Bahnschrift','Segoe UI',system-ui,sans-serif;letter-spacing:.24em;text-transform:uppercase;opacity:.75;}",
    ".ssc-wo-pos-t{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden;",
    "  font:800 calc(1.55 * var(--u))/1.18 'Bahnschrift','Segoe UI',system-ui,sans-serif;font-stretch:condensed;",
    "  text-transform:uppercase;overflow-wrap:break-word;hyphens:auto;padding:.08em 0;}",
    // Bottom half: the flag slot, here the subject.
    ".ssc-wo-flag{flex:none;height:44%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(.5 * var(--u));",
    "  padding:calc(.6 * var(--u));background:var(--wo-plate);color:#fff;",
    "  clip-path:inset(0 100% 0 0);transition:clip-path 650ms cubic-bezier(.65,0,.35,1);}",
    ".ssc-wo-banner--r .ssc-wo-flag{transition-delay:120ms;}",
    ".ssc-wo-world[data-flag='1'] .ssc-wo-flag{clip-path:inset(0 0 0 0);}",
    ".ssc-wo-flag svg{width:calc(4.2 * var(--u));height:calc(4.2 * var(--u));color:hsl(var(--wo-h) 90% 72%);",
    "  filter:drop-shadow(0 1px 3px rgba(0,0,0,.8));}",
    ".ssc-wo-flag-t{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;max-width:100%;",
    "  font:800 calc(1 * var(--u))/1.25 'Bahnschrift','Segoe UI',system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;",
    "  text-align:center;text-shadow:0 1px 3px rgba(0,0,0,.8);}",

    // The card, standing where the player card stands.
    ".ssc-wo-hero{left:50%;top:47%;width:calc(19 * var(--u));transform:translate(-50%,-50%);z-index:3;}",
    ".ssc-wo-hero .ssc-fc{width:100%;}",
    ".ssc-wo-hero .ssc-fc-wrap{filter:brightness(.05) drop-shadow(0 0 0 transparent);",
    "  transition:filter 1100ms ease;animation:ssc-wo-float 4.8s ease-in-out infinite alternate;}",
    ".ssc-wo-world[data-card='1'] .ssc-wo-hero .ssc-fc-wrap{",
    "  filter:brightness(1) drop-shadow(0 0 calc(2.4 * var(--u)) var(--wo-glow));}",
    "@keyframes ssc-wo-float{from{transform:translateY(0);}to{transform:translateY(calc(-.6 * var(--u)));}}",
    // Blank until each slot is revealed in turn.
    ".ssc-wo-hero .ssc-fc > :not(.ssc-fc-shine){opacity:0;transition:opacity 450ms ease,transform 600ms cubic-bezier(.2,1.4,.4,1);}",
    ".ssc-wo-hero .ssc-fc-emblem,.ssc-wo-hero .ssc-fc-rating{transform:scale(.6);}",
    ".ssc-wo-world[data-flag='1'] .ssc-wo-hero .ssc-fc-emblem,",
    ".ssc-wo-world[data-flag='1'] .ssc-wo-hero .ssc-fc-vak{opacity:1;transform:none;}",
    ".ssc-wo-world[data-rating='1'] .ssc-wo-hero .ssc-fc-rating{opacity:1;transform:none;}",
    // The rating's own lines (position code, /20, type) wait for the face.
    ".ssc-wo-hero .ssc-fc-pos,.ssc-wo-hero .ssc-fc-sub,.ssc-wo-hero .ssc-fc-type{opacity:0;transition:opacity 450ms ease;}",
    ".ssc-wo-world[data-toets='1'] .ssc-wo-hero .ssc-fc-name,",
    ".ssc-wo-world[data-toets='1'] .ssc-wo-hero .ssc-fc-line{opacity:1;}",
    ".ssc-wo-world[data-toets='1'] .ssc-wo-hero .ssc-fc-line{opacity:.35;}",
    // Not the bust or the hover-only holo: at full opacity they show as a figure behind the icon and a white wash.
    ".ssc-wo-world[data-face='1'] .ssc-wo-hero .ssc-fc > :not(.ssc-fc-sil):not(.ssc-fc-holo),",
    ".ssc-wo-world[data-face='1'] .ssc-wo-hero .ssc-fc-pos,",
    ".ssc-wo-world[data-face='1'] .ssc-wo-hero .ssc-fc-sub,",
    ".ssc-wo-world[data-face='1'] .ssc-wo-hero .ssc-fc-type{opacity:1;transform:none;}",
    ".ssc-wo-world[data-face='1'] .ssc-wo-hero .ssc-fc-line{opacity:.35;}",

    // Blackout over the whole world until the lights hit.
    ".ssc-wo-dark{position:absolute;inset:0;background:#000;opacity:.72;transition:opacity 900ms ease;pointer-events:none;}",
    ".ssc-wo-world[data-lights='1'] .ssc-wo-dark{opacity:0;}",
    // Edges darker than the middle, like the lens.
    ".ssc-wo-vignette{position:absolute;inset:0;pointer-events:none;",
    "  background:radial-gradient(ellipse 80% 75% at 50% 46%,transparent 50%,rgba(0,0,0,.6) 100%);}",

    /* --- the reveal: full-screen layers, never inside a smaller box --- */
    ".ssc-wo-fx{position:fixed;top:0;left:0;width:100vw;height:100vh;overflow:hidden;pointer-events:none;z-index:4;}",
    ".ssc-wo-flash{position:absolute;inset:0;background:rgb(var(--wo-lamp));opacity:0;}",
    ".ssc-wo-fx[data-face='1'] .ssc-wo-flash{animation:ssc-wo-flash 900ms ease-out both;}",
    "@keyframes ssc-wo-flash{0%{opacity:.85;}100%{opacity:0;}}",
    ".ssc-wo-sparks{position:absolute;top:0;left:0;width:100vw;height:100vh;}",

    /* --- header / footer --- */
    ".ssc-tunnel-header{position:relative;z-index:6;display:flex;align-items:center;",
    "  justify-content:space-between;gap:20px;padding:20px clamp(20px,4vw,40px);",
    "  color:var(--tw-muted);font-size:12px;text-shadow:0 1px 3px rgba(0,0,0,.8);}",
    ".ssc-tunnel-brand{min-width:0;color:var(--tw-text);font-weight:600;}",
    ".ssc-tunnel-count{flex:none;letter-spacing:.08em;font-size:11px;",
    "  font-variant-numeric:tabular-nums;}",
    ".ssc-tunnel-footer{position:relative;z-index:6;min-height:104px;padding:12px 24px 28px;",
    "  text-align:center;}",
    ".ssc-tunnel-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:12px;",
    "  margin-top:12px;opacity:0;transition:opacity 320ms ease;}",
    ".ssc-tunnel-actions[data-on='1']{opacity:1;}",
    ".ssc-tunnel-primary,.ssc-tunnel-secondary{min-height:44px;padding:10px 22px;",
    "  border:1px solid transparent;border-radius:8px;font:inherit;font-size:14px;",
    "  cursor:pointer;transition:background-color 140ms ease,border-color 140ms ease;}",
    ".ssc-tunnel-primary{border-color:#e4eaf3;background:#e4eaf3;color:#121720;}",
    ".ssc-tunnel-primary:hover{background:#fff;}",
    ".ssc-tunnel-secondary{border-color:#596477;background:#18202b;color:var(--tw-text);}",
    ".ssc-tunnel-secondary:hover{border-color:#8996a7;background:#222c3a;}",
    ".ssc-tunnel-overlay button:focus-visible{outline:2px solid var(--tw-focus);",
    "  outline-offset:3px;}",

    /* --- tall screens: the same set, stacked for 9:16 --- */
    "@media (max-aspect-ratio:4/5){",
    "  .ssc-wo-set{width:min(100cqw,56.25cqh);aspect-ratio:9/16;--k:1.9;}",
    "  .ssc-wo-halo{inset:-6% -30% 40%;}",
    "  .ssc-wo-hero{top:38%;width:calc(24 * var(--u));}",
    "  .ssc-wo-arch{top:12%;height:44%;}",
    "  .ssc-wo-pillar{top:26%;height:36%;}",
    "  .ssc-wo-pillar--l{left:20%;}.ssc-wo-pillar--r{right:20%;}",
    "  .ssc-wo-banner{top:59%;width:calc(11 * var(--u));height:calc(21 * var(--u));}",
    // Less push: the banners sit at the very edges of a phone screen.
    "  .ssc-wo-world[data-face='1'] .ssc-wo-push{transform:scale(1.03);}",
    "  .ssc-wo-banner--l{left:2%;}.ssc-wo-banner--r{right:2%;}",
    "  .ssc-wo-base{left:0;right:0;top:79%;}",
    "  .ssc-wo-plaque{width:calc(11 * var(--u));left:auto;}",
    "  .ssc-wo-plaque--l{left:2%;}.ssc-wo-plaque--r{right:2%;}",
    "  .ssc-wo-steps{top:68%;height:20%;width:calc(26 * var(--u));margin-left:calc(-13 * var(--u));}",
    "}",
  ].join("\n");

  /* ---------- the stadium and the set ---------- */

  /**
   * One ring of the halo: `count` flat panels on a circle (rotateY +
   * translateZ), each lit by how squarely it faces the key light at the
   * front-left. Sizes are in --u so the ring scales with the set.
   */
  function ring(cls, radius, height, count) {
    var node = h("div", "ssc-wo-ring " + cls);
    var r = "calc(" + radius + " * var(--u))";
    node.style.setProperty("--r", r);
    node.style.setProperty("--h", "calc(" + height + " * var(--u))");
    // Panel width = chord of one segment, plus a hair so the seams close.
    node.style.setProperty("--w", "calc(" + (2 * radius * Math.tan(Math.PI / count)).toFixed(3) + " * var(--u) + 1px)");
    for (var i = 0; i < count; i++) {
      var angle = (i * 360) / count;
      var facing = Math.cos(((angle + 24) * Math.PI) / 180);
      // Front panels catch the key light; the far side shows its inner face,
      // lit a little by the floodlights behind.
      var lit = facing > 0 ? 0.35 + 0.65 * facing : 0.3 + 0.25 * -facing;
      var panel = h("i");
      panel.style.setProperty("--a", angle.toFixed(2) + "deg");
      panel.style.setProperty("--l", lit.toFixed(3));
      // The light-up runs round from the front; the glint follows the ring.
      var fromFront = Math.min(angle, 360 - angle);
      panel.style.setProperty("--d", Math.round(fromFront * 3) + "ms");
      panel.style.setProperty("--g", (-(angle / 360) * 3.6).toFixed(2) + "s");
      node.appendChild(panel);
    }
    return node;
  }

  function buildEnv() {
    var env = h("div", "ssc-wo-env");
    env.appendChild(h("div", "ssc-wo-sky"));
    env.appendChild(h("div", "ssc-wo-stands"));
    [["l1", "13%", "20%"], ["r1", "87%", "20%"], ["l2", "20%", "7%"], ["r2", "80%", "7%"]].forEach(function (b) {
      env.appendChild(h("div", "ssc-wo-bank ssc-wo-bank--" + b[0]));
      var bloom = h("div", "ssc-wo-bloom");
      bloom.style.left = b[1];
      bloom.style.top = b[2];
      env.appendChild(bloom);
    });
    for (var i = 1; i <= 4; i++) env.appendChild(h("div", "ssc-wo-beam ssc-wo-beam--" + i));
    env.appendChild(h("div", "ssc-wo-floor"));
    env.appendChild(h("div", "ssc-wo-haze"));
    env.appendChild(h("div", "ssc-wo-dust"));
    return env;
  }

  /**
   * A side banner: the test on top (the game's position slot) and the
   * subject's badge below (the flag slot).
   */
  function buildBanner(side, vak, titel) {
    var banner = h("div", "ssc-wo-banner ssc-wo-banner--" + side);
    var pos = h("div", "ssc-wo-pos");
    pos.appendChild(h("span", "ssc-wo-pos-k", "Toets"));
    var title = h("span", "ssc-wo-pos-t", titel);
    title.setAttribute("lang", "nl");
    // Short titles are set big like a position code; the longest word must
    // still fit the board's width (about 9u at ~0.58em per capital).
    var longest = titel.split(/s+/).reduce(function (n, word) {
      return Math.max(n, word.length);
    }, 1);
    var size = Math.min(titel.length <= 8 ? 2.6 : titel.length <= 18 ? 1.9 : 1.55, 9 / (longest * 0.58));
    title.style.fontSize = "calc(" + Math.max(0.9, size).toFixed(2) + " * var(--u))";
    pos.appendChild(title);
    banner.appendChild(pos);
    var flag = h("div", "ssc-wo-flag");
    var icon = iconFor(vak);
    if (icon) flag.appendChild(icon);
    flag.appendChild(h("span", "ssc-wo-flag-t", vak || "Vak"));
    banner.appendChild(flag);
    return banner;
  }

  function buildSet(card, vak, titel, tierId) {
    var set = h("div", "ssc-wo-set");
    var halo = h("div", "ssc-wo-halo");
    halo.setAttribute("aria-hidden", "true");
    halo.appendChild(ring("ssc-wo-ring--c", 40, 2.2, 48));
    halo.appendChild(ring("ssc-wo-ring--b", 30, 4.6, 44));
    halo.appendChild(ring("ssc-wo-ring--a", 36, 7.5, 48));
    set.appendChild(halo);
    set.appendChild(h("div", "ssc-wo-glory"));
    set.appendChild(h("div", "ssc-wo-rays"));
    set.appendChild(h("div", "ssc-wo-arch"));
    set.appendChild(h("div", "ssc-wo-pillar ssc-wo-pillar--l"));
    set.appendChild(h("div", "ssc-wo-pillar ssc-wo-pillar--r"));
    var base = h("div", "ssc-wo-base");
    var label = TIER_LABEL[tierId] || "";
    base.appendChild(h("div", "ssc-wo-plaque ssc-wo-plaque--l", label));
    base.appendChild(h("div", "ssc-wo-plaque ssc-wo-plaque--r", label));
    set.appendChild(base);
    set.appendChild(h("div", "ssc-wo-steps"));
    set.appendChild(buildBanner("l", vak, titel));
    set.appendChild(buildBanner("r", vak, titel));
    var hero = h("div", "ssc-wo-hero");
    if (card) hero.appendChild(card.node);
    set.appendChild(hero);
    return { set: set, hero: hero };
  }

  /* ---------- audio ---------- */

  /**
   * The reel's own audio object, not a second one. It carries the shared
   * AudioContext and the already-decoded buffers; a fresh context per
   * cutscene is exactly the bug that made queued cutscenes silent, because
   * one created without a gesture starts suspended and never resumes itself.
   */
  function createAudio() {
    if (typeof window.sscCreateCutsceneAudio !== "function") {
      // No bridge (cutscene.js failed to load): every call is a no-op, so the
      // rest of the cutscene never has to null-check.
      return {
        prepare: function () {},
        unlock: function () {},
        step: function () {},
        reveal: function () {},
        accent: function () {},
        stop: function () {},
      };
    }
    var audio = window.sscCreateCutsceneAudio();

    return {
      prepare: function () {
        return audio.prepare();
      },
      unlock: function () {
        return audio.unlock();
      },
      /** A short slice of the recording as a hit — one per beat of the reveal. */
      step: function (volume) {
        audio.play("case-opening.mp3", volume * 0.45, undefined, 0.34, 0.42);
      },
      reveal: function (volume) {
        audio.play("case-opening.mp3", volume, undefined, undefined, REVEAL_OFFSET);
      },
      accent: function (volume) {
        audio.accent(volume, true);
      },
      stop: function () {
        audio.stop();
      },
    };
  }

  /* ---------- sparks ---------- */

  /**
   * Sparks thrown out from the card at the face, on a canvas the size of
   * the viewport: they fly to every edge instead of stopping at a box.
   */
  function burst(canvas, color, count, cx, cy) {
    var ctx = null;
    try {
      ctx = canvas.getContext("2d");
    } catch (e) {
      return null;
    }
    if (!ctx) return null;

    var w = window.innerWidth;
    var hgt = window.innerHeight;
    if (!w || !hgt) return null;

    var dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = hgt * dpr;
    ctx.scale(dpr, dpr);

    var reach = Math.hypot(Math.max(cx, w - cx), Math.max(cy, hgt - cy));
    var points = [];
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      points.push({
        cos: Math.cos(angle),
        sin: Math.sin(angle),
        dist: reach * (0.35 + Math.random() * 0.75),
        size: 1 + Math.random() * 2.2,
        delay: Math.random() * 0.15,
      });
    }

    var start = performance.now();
    var frame = 0;

    function draw() {
      var t = (performance.now() - start) / 1900;
      ctx.clearRect(0, 0, w, hgt);
      if (t >= 1) return;
      ctx.fillStyle = color;
      for (var p = 0; p < points.length; p++) {
        var point = points[p];
        var local = Math.max(0, (t - point.delay) / (1 - point.delay));
        if (!local) continue;
        var travel = 1 - Math.pow(1 - local, 3);
        var x = cx + point.cos * point.dist * travel;
        var y = cy + point.sin * point.dist * travel + 90 * local * local;
        ctx.globalAlpha = Math.pow(1 - local, 1.6);
        ctx.fillRect(x, y, point.size, point.size * 2.4);
      }
      frame = requestAnimationFrame(draw);
    }

    draw();
    return function () {
      cancelAnimationFrame(frame);
    };
  }

  /* ---------- the cutscene ---------- */

  var active = null;

  function sscPlayCutsceneTunnel(options) {
    var opts = options || {};
    var value = Number(opts.grade);

    if (!isFinite(value) || value < 0) {
      if (opts.onClose) opts.onClose();
      return;
    }
    if (active || (window.sscCutsceneBusy && window.sscCutsceneBusy())) {
      // Same rule as the reel: one at a time, and a caller waiting on the
      // callback still hears back or the queue stalls.
      if (opts.onClose) opts.onClose();
      return;
    }

    var live = getLive();
    if (!live) {
      if (opts.onClose) opts.onClose();
      return;
    }

    ensureStyles(live.shadow);
    if (cardModule() && cardModule().ensureStyles) cardModule().ensureStyles(live.shadow);
    // The lock lives in cutscene.js; without an overlay shell it still needs
    // to know a cutscene is on screen.
    if (typeof window.sscSetCutsceneActive === "function") window.sscSetCutsceneActive(true);

    var reduced = prefersReduced();

    var percent =
      typeof opts.percent === "number" && isFinite(opts.percent)
        ? opts.percent
        : (value / 20) * 100;
    var tierId = tierIdForPercent(percent);
    var glow = tierGlowForPercent(percent);
    // Bug 9: the number the user reads is the percentage, everywhere. The /20
    // conversion stays as the small secondary reference the card shows.
    var percentText = String(Math.round(percent));

    var grade = {
      op20: value,
      percentage: percent,
      vak: opts.vak || "",
      titel: opts.titel || "",
      datum: opts.datum || "",
      periode: opts.periode || "",
      score: opts.score,
      max: opts.max,
      type: opts.type || "",
    };

    var audio = createAudio();
    var soundOn = opts.sound !== false;

    var overlay = h("div", "ssc-tunnel-overlay");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Cijfer onthullen");
    overlay.setAttribute("data-tier", tierId);
    overlay.tabIndex = -1;
    overlay.style.setProperty("--wo-glow", glow);
    overlay.style.setProperty("--wo-rays", glow + "66");

    var header = h("header", "ssc-tunnel-header");
    header.appendChild(h("div", "ssc-tunnel-brand", "Cijfer openen"));
    if (opts.total > 1 && opts.index >= 1) {
      header.appendChild(h("span", "ssc-tunnel-count", opts.index + " / " + opts.total));
    } else {
      header.appendChild(h("span", "ssc-tunnel-count", "SMARTSCHOOL COMBINED"));
    }

    var mainEl = h("div", "ssc-tunnel-main");
    var footerEl = h("footer", "ssc-tunnel-footer");

    var card = cardModule() ? cardModule().build(grade, { animateShine: false, enter: false }) : null;
    // The rating counts up from blank, so it starts empty, not on the grade.
    if (card && card.percentNode) card.percentNode.textContent = "";
    if (card && card.numNode) card.numNode.textContent = fmt1(value);

    var world = h("div", "ssc-wo-world");
    world.setAttribute("aria-hidden", "true");
    var cam = h("div", "ssc-wo-cam");
    var push = h("div", "ssc-wo-push");
    push.appendChild(buildEnv());
    var stagebox = h("div", "ssc-wo-stagebox");
    var built = buildSet(card, opts.vak || "", opts.titel || opts.vak || "Cijfer", tierId);
    stagebox.appendChild(built.set);
    push.appendChild(stagebox);
    push.appendChild(h("div", "ssc-wo-vignette"));
    push.appendChild(h("div", "ssc-wo-dark"));
    cam.appendChild(push);
    world.appendChild(cam);

    var fx = h("div", "ssc-wo-fx");
    fx.setAttribute("aria-hidden", "true");
    var sparks = h("canvas", "ssc-wo-sparks");
    fx.appendChild(sparks);
    fx.appendChild(h("div", "ssc-wo-flash"));

    overlay.appendChild(world);
    overlay.appendChild(fx);
    overlay.appendChild(header);
    overlay.appendChild(mainEl);
    overlay.appendChild(footerEl);

    // The text the screen reader gets, since the stage itself is decoration.
    var spoken = h("p", null, (opts.vak || "") + ", " + (opts.titel || "") + ": " + percentText + "%");
    spoken.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);";
    overlay.appendChild(spoken);

    var state = {
      phase: "intro",
      timers: [],
      finished: false,
      countFrame: 0,
      cleanupBurst: null,
    };
    active = state;

    var previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    function at(ms, fn) {
      var id = window.setTimeout(function () {
        if (!active || active !== state) return;
        fn();
      }, ms);
      state.timers.push(id);
      return id;
    }

    // Every scheduled step lives here, so a skip or a close can tear the
    // overlay down without a late beat firing into it.
    function clearTimers() {
      for (var i = 0; i < state.timers.length; i++) {
        window.clearTimeout(state.timers[i]);
      }
      state.timers = [];
      if (state.countFrame) cancelAnimationFrame(state.countFrame);
      state.countFrame = 0;
    }

    function shake() {
      world.removeAttribute("data-shake");
      void world.offsetWidth;
      world.setAttribute("data-shake", "1");
      at(720, function () {
        world.removeAttribute("data-shake");
      });
    }

    /**
     * The rating ticks up like the game's: from well below the grade, fast
     * at first and settling on the exact text the card shows elsewhere.
     */
    function countRating(ms) {
      var node = card && card.percentNode;
      if (!node) return;
      var target = Math.round(percent);
      var from = Math.max(0, target - 45);
      var start = performance.now();
      function frame(now) {
        var p = Math.min(1, (now - start) / ms);
        var eased = 1 - Math.pow(1 - p, 3);
        node.textContent = String(Math.round(from + (target - from) * eased));
        state.countFrame = p < 1 ? requestAnimationFrame(frame) : 0;
        if (p >= 1) node.textContent = percentText;
      }
      node.textContent = String(from);
      state.countFrame = requestAnimationFrame(frame);
      // A hidden tab never runs the frames: land on the grade regardless.
      at(ms + 50, function () {
        if (state.countFrame) cancelAnimationFrame(state.countFrame);
        state.countFrame = 0;
        node.textContent = percentText;
      });
    }

    function lightsOn() {
      state.phase = "lights";
      world.setAttribute("data-lights", "1");
      if (soundOn) audio.step(VOLUME);
    }

    function cardOn() {
      state.phase = "card";
      world.setAttribute("data-card", "1");
    }

    function flagOn() {
      state.phase = "flag";
      world.setAttribute("data-flag", "1");
      if (soundOn) audio.step(VOLUME * 0.8);
    }

    function ratingOn() {
      state.phase = "rating";
      world.setAttribute("data-rating", "1");
      countRating(COUNT_MS);
    }

    function toetsOn() {
      state.phase = "toets";
      world.setAttribute("data-toets", "1");
      if (soundOn) audio.step(VOLUME * 0.8);
    }

    /** The face: everything lit, the card complete, the camera in close. */
    function face(fromSkip) {
      state.phase = "face";
      state.finished = true;
      ["lights", "card", "flag", "rating", "toets", "face"].forEach(function (key) {
        world.setAttribute("data-" + key, "1");
      });
      if (card && card.percentNode) card.percentNode.textContent = percentText;
      if (opts.onComplete) opts.onComplete();

      var rect = built.hero.getBoundingClientRect();
      var cx = rect.width ? rect.left + rect.width / 2 : window.innerWidth / 2;
      var cy = rect.height ? rect.top + rect.height / 2 : window.innerHeight / 2;
      fx.setAttribute("data-face", "1");

      var shine = card && card.card ? card.card.querySelector(".ssc-fc-shine") : null;
      if (shine && !reduced) shine.setAttribute("data-on", "1");

      if (!reduced) {
        shake();
        var count = tierId === "icon" ? 110 : tierId === "gold" ? 80 : tierId === "silver" ? 50 : 34;
        state.cleanupBurst = burst(sparks, glow, count, cx, cy);
      }
      if (soundOn) audio.reveal(VOLUME);
      if (tierId === "icon" && soundOn) audio.accent(VOLUME);

      buildActions();
      // The buttons arrive once the push settled, not while it is moving: a
      // click target that appears mid-motion is a mis-click waiting.
      at(fromSkip || reduced ? 0 : ACTIONS_AT - FACE_AT, function () {
        state.actions.setAttribute("data-on", "1");
      });
    }

    function buildActions() {
      footerEl.textContent = "";
      var actions = h("div", "ssc-tunnel-actions");
      state.actions = actions;
      var hasQueue = !!opts.hasNext;
      var primary = h("button", "ssc-tunnel-primary", hasQueue ? "Volgende" : "Terug naar Smartschool");
      primary.type = "button";
      primary.addEventListener("click", close);
      actions.appendChild(primary);
      if (opts.onStop) {
        var stopBtn = h("button", "ssc-tunnel-secondary", "Stop de reeks");
        stopBtn.type = "button";
        stopBtn.addEventListener("click", function () {
          if (opts.onStop) opts.onStop();
          close();
        });
        actions.appendChild(stopBtn);
      }
      // Queue only: mark this grade and all remaining ones as seen, close.
      if (typeof opts.onSkipAll === "function") {
        var skipAllBtn = h("button", "ssc-tunnel-secondary", "Skip alles");
        skipAllBtn.type = "button";
        skipAllBtn.addEventListener("click", function () {
          try {
            opts.onSkipAll();
          } catch (e) {
            /* The queue callback must not break the close below. */
          }
          close();
        });
        actions.appendChild(skipAllBtn);
      }
      footerEl.appendChild(actions);
      overlay.focus();
    }

    /* --- skip / close --- */

    function skipToFace() {
      if (state.phase === "face") return false;
      clearTimers();
      audio.stop();
      face(true);
      return true;
    }

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        // Escape once skips to the finished card; Escape on the card closes
        // it and the queue moves on.
        if (!skipToFace()) close();
        return;
      }
      if (e.key === "Enter" && state.phase === "face" && e.target === overlay) {
        e.preventDefault();
        close();
      }
    }

    function close() {
      if (!active || active !== state) return;

      clearTimers();
      if (state.cleanupBurst) state.cleanupBurst();
      audio.stop();
      document.documentElement.style.overflow = previousOverflow;
      overlay.removeEventListener("keydown", onKey);

      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);

      active = null;
      if (typeof window.sscSetCutsceneActive === "function") window.sscSetCutsceneActive(false);
      if (opts.onClose) opts.onClose();
    }

    overlay.addEventListener("keydown", onKey);
    live.layer.appendChild(overlay);

    if (soundOn) audio.unlock();
    audio.prepare();

    overlay.focus();
    window.requestAnimationFrame(function () {
      overlay.setAttribute("data-in", "1");
    });

    if (reduced) {
      face(true);
      return;
    }
    if (soundOn) audio.step(VOLUME * 0.5);
    at(LIGHTS_AT, lightsOn);
    at(CARD_AT, cardOn);
    at(FLAG_AT, flagOn);
    at(RATING_AT, ratingOn);
    at(TOETS_AT, toetsOn);
    at(FACE_AT, function () {
      face(false);
    });
  }

  window.sscPlayCutsceneTunnel = sscPlayCutsceneTunnel;
})();
