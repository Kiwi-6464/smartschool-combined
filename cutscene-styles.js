/**
 * Smartschool Combined — additional cutscene styles.
 *
 * cutscene.js owns the reel (style 1) and tunnel.js the walkout (style 2). This
 * file adds the five Magister-style reveals from the spec and dispatches all
 * seven without those two files knowing about it:
 *
 *   flip      card flip with tilt + glare, ported from CijferReveal's
 *             sponsor/recent-card.tsx + shared/opening/TiltCard.tsx
 *   scratch   canvas scratch card (destination-out)
 *   slot      a chrome slot machine: marquee bulbs, cylinder reels, coin
 *             slot, LED read-out and a lever to pull
 *   roulette  a casino table: wooden rim, felt, a European wheel and the
 *             betting layout; the ball runs the other way and bounces in
 *   pack      sealed card pack that tears open, three decoys
 *
 * It wraps window.sscPlayCutscene AFTER cutscene.js has defined it. Styles 1
 * and 2 are delegated to that original function unchanged, so the reel, the
 * tunnel, the auto-play queue and the Team tab keep working exactly as before.
 * Styles 3-7 share cutscene.js's audio factory and FIFA card module.
 *
 * Busy handling: cutscene.js exposes sscCutsceneBusy() and
 * sscSetCutsceneActive(). Before starting we check the former, then claim the
 * latter, so a style-3 click during a reel (or the reverse) cannot stack two
 * overlays. The claim is released exactly once, in close().
 *
 * Reduced motion: it shortens the delays (later() scales them) but never
 * skips a builder. The old early return left all five styles painting only
 * the finished card, which is Bug 4.
 */
(function () {
  "use strict";

  // Sign-in pages: do nothing at all (see guard.js).
  if (window.sscSkipPage) return;

  if (window.sscPlayCutsceneStyled) return;

  var original = window.sscPlayCutscene;
  if (typeof original !== "function") return;

  var OWN_STYLES = { flip: true, scratch: true, slot: true, roulette: true, pack: true };


  var stylePref = "reel";
  var oursActive = false;

  /* ---------- style ---------- */

  var STYLE = [
    ".ssc-st-overlay{position:fixed;inset:0;z-index:2147483003;display:flex;flex-direction:column;",
    "  color:var(--ssc-text, #1a1a2e);font-family:system-ui,-apple-system,'Segoe UI',sans-serif;",
    "  background:radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--st-glow, var(--ssc-accent, #2b6cb0)) 16%, transparent), transparent 62%),",
    "    color-mix(in srgb, var(--ssc-base00, #ffffff) 94%, transparent);",
    "  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);",
    "  opacity:0;transition:opacity 220ms ease;pointer-events:auto;}",
    ".ssc-st-overlay[data-in='1']{opacity:1;}",
    ".ssc-st-header{display:flex;align-items:center;justify-content:space-between;gap:12px;",
    "  padding:14px 20px;border-bottom:1px solid var(--ssc-line);flex:none;}",
    ".ssc-st-brand{font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;",
    "  color:var(--ssc-muted);}",
    ".ssc-st-header-right{display:flex;align-items:center;gap:10px;}",
    ".ssc-st-count{font-size:12px;font-weight:700;color:var(--ssc-accent-ink);",
    "  font-variant-numeric:tabular-nums;}",
    ".ssc-st-main{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;",
    "  justify-content:center;gap:18px;padding:18px;position:relative;overflow:hidden;}",
    ".ssc-st-footer{flex:none;padding:12px 20px 20px;display:flex;justify-content:center;",
    "  align-items:center;gap:10px;min-height:54px;}",
    ".ssc-st-hint{margin:0;font-size:12px;color:var(--ssc-muted);}",
    ".ssc-st-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}",
    ".ssc-st-btn{font:inherit;font-size:13px;font-weight:700;padding:9px 16px;border-radius:10px;",
    "  border:1px solid var(--ssc-line);background:var(--ssc-surface-2);",
    "  color:var(--ssc-text, #1a1a2e);cursor:pointer;pointer-events:auto;}",
    ".ssc-st-btn:hover{border-color:var(--ssc-accent-ink);color:var(--ssc-accent-ink);}",
    ".ssc-st-btn--primary{background:var(--ssc-accent-ink);border-color:var(--ssc-accent-ink);",
    "  color:var(--ssc-base00, #ffffff);}",
    ".ssc-st-btn--primary:hover{filter:brightness(1.08);color:var(--ssc-base00, #ffffff);}",
    ".ssc-st-btn--ghost{background:transparent;}",

    /* ---- shared result ---- */
    ".ssc-st-result{position:relative;display:grid;place-items:center;width:100%;height:100%;}",
    // Reveal light in full-screen fixed layers: inside .ssc-st-main
    // (overflow:hidden, between header and footer) it stopped at that box.
    ".ssc-st-fx{position:fixed;top:0;left:0;width:100vw;height:100vh;overflow:hidden;pointer-events:none;z-index:1;}",
    ".ssc-st-fx--front{z-index:3;}",
    ".ssc-st-header,.ssc-st-footer{position:relative;z-index:4;}",
    ".ssc-st-rays{position:absolute;left:var(--cx,50%);top:var(--cy,50%);width:300vmax;height:300vmax;",
    "  margin:-150vmax 0 0 -150vmax;border-radius:50%;pointer-events:none;opacity:0;",
    "  background:repeating-conic-gradient(from 0deg, var(--st-glow) 0deg 5deg, transparent 5deg 24deg);",
    "  -webkit-mask-image:radial-gradient(circle,#000 0%,transparent 36%);",
    "  mask-image:radial-gradient(circle,#000 0%,transparent 36%);",
    "  transition:opacity .5s ease;}",
    ".ssc-st-rays[data-on='1']{opacity:.28;animation:ssc-st-rays 14s linear infinite;}",
    "@keyframes ssc-st-rays{to{transform:rotate(360deg);}}",
    ".ssc-st-particles{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;}",
    ".ssc-st-card{position:relative;z-index:2;}",
    ".ssc-st-card .ssc-fc{width:min(260px,44vw,40vh);}",
    ".ssc-st-flash{position:absolute;inset:0;pointer-events:none;opacity:0;",
    "  background:radial-gradient(circle at var(--cx,50%) var(--cy,45%), var(--st-glow), transparent 55%);}",
    ".ssc-st-flash[data-go='1']{animation:ssc-st-flash 780ms ease-out both;}",
    "@keyframes ssc-st-flash{0%{opacity:.85;}100%{opacity:0;}}",

    /* ---- flip ---- */
    /*
     * Ported from CijferReveal: shared/ui.css .po-tilt / .po-tilt-card and
     * src/spoiler/shield.css .po-card-cover / .po-open.
     *   scene  perspective 1000px (--po-tilt-perspective)
     *   tilt   rotateX/rotateY ±12° following the pointer; follows in 280ms,
     *          returns in 850ms, cubic-bezier(.22,1,.36,1)
     *   flip   preserve-3d, rotateY(180deg) in 700ms on open
     *   faces  absolute, backface-visibility hidden; the card face starts
     *          turned 180° so it shows once the flip has turned it around
     *   cover  dark veil ON the closed card: "NIEUW CIJFER" + "Open cijfer"
     */
    ".ssc-st-scene{position:relative;display:grid;place-items:center;perspective:1000px;",
    "  width:min(260px,44vw,40vh);}",
    ".ssc-st-tilt{width:100%;transform-style:preserve-3d;",
    "  transform:rotateX(var(--st-rx,0deg)) rotateY(var(--st-ry,0deg));",
    "  transition:transform 850ms cubic-bezier(.22,1,.36,1);}",
    ".ssc-st-tilt[data-tilting='1']{transition-duration:280ms;will-change:transform;}",
    ".ssc-st-flip{position:relative;width:100%;aspect-ratio:5/7;transform-style:preserve-3d;",
    "  transform:rotateY(0deg);cursor:pointer;}",
    // A physical turn: ease-in-out (90° at the midpoint) and a slight lift
    // towards the viewer halfway, like a card picked up and turned over.
    // CijferReveal's (.22,1,.36,1) is kept for the tilt; as a flip curve it
    // put the card at 118° after 130ms, which read as a jolt.
    ".ssc-st-flip[data-flipped='1']{transform:rotateY(180deg);cursor:default;",
    "  animation:ssc-st-turn 700ms both;}",
    // Easing per half: in to the midpoint, out after it, so the card moves
    // fastest edge-on (a single ease-in-out per half would stall at 90°).
    "@keyframes ssc-st-turn{",
    // translateZ first: lifted towards the viewer in screen space. After the
    // rotate it would move along the turned axis, i.e. sideways at 90°.
    "  0%{transform:translateZ(0) rotateY(0deg) scale(1);animation-timing-function:cubic-bezier(.55,0,1,.45);}",
    "  50%{transform:translateZ(60px) rotateY(90deg) scale(1.06);animation-timing-function:cubic-bezier(0,.55,.45,1);}",
    "  100%{transform:translateZ(0) rotateY(180deg) scale(1);}}",
    ".ssc-st-face{position:absolute;inset:0;backface-visibility:hidden;",
    "  -webkit-backface-visibility:hidden;transform-style:preserve-3d;}",
    ".ssc-st-face--front{transform:rotateY(180deg);}",
    // Each face's card wrapper fills the face (an auto-height wrapper made
    // the card 0px tall, so the flip turned an empty box).
    ".ssc-st-face > .ssc-fc-wrap{position:absolute;inset:0;}",
    ".ssc-st-flip .ssc-fc{width:100%;height:100%;aspect-ratio:auto;}",
    // CijferReveal's folio glare: a soft spot under the pointer, screen-blended.
    ".ssc-st-glare{position:absolute;inset:0;pointer-events:none;opacity:0;z-index:4;",
    "  background:radial-gradient(circle 95px at var(--st-gx,50%) var(--st-gy,50%),",
    "    #ffffff54, #ffffff09 54%, transparent 86%);mix-blend-mode:screen;",
    "  transition:opacity 180ms ease;}",
    ".ssc-st-tilt[data-hover='1'] .ssc-st-glare{opacity:1;}",
    // Holographic foil: a rainbow band that slides with the pointer (or on
    // its own), colour-dodged onto the back, plus a fine sparkle grain.
    ".ssc-st-holo{position:absolute;inset:0;z-index:3;pointer-events:none;opacity:.42;mix-blend-mode:screen;",
    "  clip-path:polygon(8% 0%,50% 3%,92% 0%,100% 8%,100% 86%,50% 100%,0% 86%,0% 8%);",
    "  background:repeating-linear-gradient(115deg,#ff2d95 0%,#ffd34d 6%,#3dffb0 12%,#2fb8ff 18%,#b44dff 24%,#ff2d95 30%);",
    "  background-size:260% 260%;background-position:var(--st-hx,50%) var(--st-hy,50%);",
    "  filter:saturate(1.4);transition:background-position 280ms ease;}",
    ".ssc-st-tilt:not([data-hover='1']) .ssc-st-holo{animation:ssc-st-holo 6s ease-in-out infinite alternate;}",
    "@keyframes ssc-st-holo{from{background-position:0% 30%;}to{background-position:100% 70%;}}",
    ".ssc-st-holo::after{content:'';position:absolute;inset:0;opacity:.8;",
    "  background:radial-gradient(1px 1px at 12% 18%,#fff,transparent),radial-gradient(1px 1px at 64% 42%,#fff,transparent),",
    "    radial-gradient(1.4px 1.4px at 38% 76%,#fff,transparent),radial-gradient(1px 1px at 82% 84%,#fff,transparent);",
    "  background-size:38px 46px,52px 40px,44px 58px,30px 36px;}",
    ".ssc-st-holo--sweep{opacity:0;mix-blend-mode:color-dodge;",
    "  background:linear-gradient(110deg,transparent 30%,#ff2d95 40%,#ffd34d 45%,#3dffb0 50%,#2fb8ff 55%,#b44dff 60%,transparent 70%);",
    "  background-size:300% 100%;background-position:120% 0;}",
    ".ssc-st-flip[data-flipped='1'] .ssc-st-holo--sweep{animation:ssc-st-holo-sweep 1.3s 650ms ease-in-out both;}",
    "@keyframes ssc-st-holo-sweep{0%{opacity:0;background-position:120% 0;}20%{opacity:.85;}100%{opacity:0;background-position:-20% 0;}}",
    // The cover lies on the closed card (po-card-cover).
    ".ssc-st-cover{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;",
    "  align-items:center;justify-content:center;gap:8px;text-align:center;",
    "  background:radial-gradient(ellipse 70% 40% at 50% 50%,rgba(6,9,14,.82),rgba(6,9,14,.35) 75%);color:#f5f7fa;",
    "  clip-path:polygon(8% 0%,50% 3%,92% 0%,100% 8%,100% 86%,50% 100%,0% 86%,0% 8%);",
    "  transition:opacity 220ms ease;}",
    ".ssc-st-cover[data-gone='1']{opacity:0;pointer-events:none;}",
    ".ssc-st-cover-title{font-size:11px;font-weight:800;letter-spacing:.14em;",
    "  text-transform:uppercase;color:#f5f7fa;}",
    ".ssc-st-cover-sub{font-size:12px;color:#dfe5ee;}",
    ".ssc-st-cover-title,.ssc-st-cover-sub{text-shadow:0 1px 3px rgba(0,0,0,.8);}",
    // po-open
    ".ssc-st-cover .ssc-st-btn{border:1px solid #8996a7;background:#17202c;color:#fff;}",
    ".ssc-st-cover .ssc-st-btn:hover{border-color:#c1c9d4;color:#fff;}",

    /* ---- scratch ---- */
    ".ssc-st-scratch{position:relative;width:min(260px,44vw,40vh);aspect-ratio:5/7;}",
    // The card's wrapper must fill the scratch box: with an auto-height
    // wrapper the card's height:100% resolved to 0px, so scratching only
    // ever uncovered the overlay's blurred backdrop.
    ".ssc-st-scratch > .ssc-fc-wrap{position:absolute;inset:0;z-index:2;}",
    ".ssc-st-scratch .ssc-fc{width:100%;height:100%;aspect-ratio:auto;}",
    ".ssc-st-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:3;",
    "  cursor:crosshair;touch-action:none;pointer-events:auto;",
    // Same shield outline as the card (fifa-card.js .ssc-fc), so scratching a
    // corner never uncovers the backdrop next to the card.
    "  clip-path:polygon(8% 0%,50% 3%,92% 0%,100% 8%,100% 86%,50% 100%,0% 86%,0% 8%);",
    "  transition:opacity .3s ease;}",
    ".ssc-st-canvas[data-done='1']{opacity:0;pointer-events:none;}",

    /* ---- slot: a physical machine ----
     *
     * Polished chrome cabinet with gold trim, a lacquered marquee ringed with
     * chasing bulbs, a glass window with three real 3D drums (ten faces on a
     * rotateX ring each), a coin slot with an LED read-out, and a lever on
     * the right that is pulled to spin. No payline: the lit middle row is
     * the line.
     */
    ".ssc-st-slot{position:relative;display:flex;align-items:flex-end;justify-content:center;",
    "  --sm-gold:linear-gradient(135deg,#7a5512 0%,#f6e27a 18%,#c99a2e 34%,#fff6c9 48%,#b8862b 62%,#f3d77a 78%,#6e4b0f 100%);",
    "  --sm-chrome:linear-gradient(180deg,#fbfcfd 0%,#d9dee4 9%,#8d96a0 21%,#eef2f5 33%,#5b636c 49%,#b9c1c9 60%,#f5f7f9 73%,#7a838d 88%,#cfd5db 100%);",
    "  filter:drop-shadow(0 30px 46px rgba(0,0,0,.6));}",
    ".ssc-sm-cab{position:relative;width:min(400px,78vw);padding:16px 18px 18px;box-sizing:border-box;",
    "  border-radius:36px 36px 20px 20px;border:3px solid transparent;",
    "  background:var(--sm-chrome) padding-box,var(--sm-gold) border-box;",
    "  box-shadow:inset 0 2px 0 rgba(255,255,255,.95),inset 0 -5px 0 rgba(0,0,0,.35),inset 0 0 0 1px rgba(0,0,0,.25),",
    "    0 1px 0 rgba(255,255,255,.4);}",
    // A slow reflection travelling over the chrome.
    ".ssc-sm-cab::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;",
    "  background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.55) 45%,transparent 55%) 0 0/300% 100%;",
    "  mix-blend-mode:overlay;animation:ssc-sm-sheen 5.5s ease-in-out infinite;}",
    "@keyframes ssc-sm-sheen{0%{background-position:120% 0;}60%,100%{background-position:-40% 0;}}",
    ".ssc-sm-cab::after{content:'';position:absolute;left:7%;right:7%;bottom:-17px;height:18px;border-radius:0 0 16px 16px;",
    "  background:linear-gradient(180deg,#2a2f36,#0d0f12);box-shadow:inset 0 2px 0 rgba(255,255,255,.12);}",
    ".ssc-sm-top{position:relative;margin:0 4px 16px;padding:22px 12px;border-radius:26px 26px 12px 12px;text-align:center;",
    "  border:3px solid transparent;",
    "  background:radial-gradient(ellipse at 50% -10%,#ff5d7a,#a3122f 55%,#4d0513) padding-box,var(--sm-gold) border-box;",
    "  box-shadow:inset 0 -12px 22px rgba(0,0,0,.45),inset 0 10px 18px rgba(255,255,255,.12);}",
    ".ssc-sm-title{display:inline-block;font:900 clamp(20px,4.6vw,30px)/1.15 Georgia,'Times New Roman',serif;letter-spacing:.22em;",
    "  padding:.04em 0 .06em .22em;background:linear-gradient(180deg,#fffbe6 0%,#ffe27a 38%,#d99a1c 62%,#fff1b0 100%);",
    "  -webkit-background-clip:text;background-clip:text;color:transparent;",
    "  filter:drop-shadow(0 2px 0 #5c3500) drop-shadow(0 0 10px rgba(255,201,51,.75));}",
    ".ssc-sm-sub{margin-top:7px;font:800 10px/1 system-ui,sans-serif;letter-spacing:.32em;color:#ffe3e8;",
    "  text-shadow:0 1px 3px rgba(0,0,0,.8);}",
    ".ssc-sm-bulbs{position:absolute;left:12px;right:12px;display:flex;justify-content:space-between;pointer-events:none;}",
    ".ssc-sm-bulbs--top{top:6px;}",
    ".ssc-sm-bulbs--bottom{bottom:6px;}",
    ".ssc-sm-bulb{width:8px;height:8px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#fff1b8 45%,#ffc933);",
    "  box-shadow:0 0 8px 2px rgba(255,211,77,.9);animation:ssc-sm-chase 900ms steps(1) infinite;}",
    ".ssc-sm-bulb:nth-child(even){animation-delay:-450ms;}",
    "@keyframes ssc-sm-chase{50%{background:#6e5212;box-shadow:none;}}",
    ".ssc-st-slot[data-win='1'] .ssc-sm-bulb{animation-duration:200ms;}",
    ".ssc-sm-window{position:relative;display:flex;justify-content:center;gap:8px;padding:12px 12px;border-radius:16px;",
    "  border:4px solid transparent;",
    "  background:linear-gradient(#15161b,#060608) padding-box,var(--sm-gold) border-box;",
    "  box-shadow:inset 0 10px 18px rgba(0,0,0,.9),0 0 0 2px #2e2414,0 3px 8px rgba(0,0,0,.5);",
    "  transition:box-shadow .3s ease;}",
    ".ssc-st-slot[data-win='1'] .ssc-sm-window{box-shadow:inset 0 10px 18px rgba(0,0,0,.9),0 0 0 2px #2e2414,",
    "  0 0 36px 8px rgba(255,206,64,.7);}",
    // The glass: one diagonal reflection over all drums.
    ".ssc-sm-window::after{content:'';position:absolute;inset:4px;border-radius:12px;pointer-events:none;z-index:3;",
    "  background:linear-gradient(168deg,rgba(255,255,255,.24),rgba(255,255,255,.04) 34%,transparent 36%),",
    "    linear-gradient(0deg,rgba(255,255,255,.06),transparent 30%);}",
    // A drum: housing > perspective box > ring of ten faces.
    ".ssc-st-reel{position:relative;width:clamp(60px,15.5vw,80px);height:150px;overflow:hidden;border-radius:8px;",
    "  background:linear-gradient(90deg,#0b0b0d,#2b2b30 12%,#1a1a1e 88%,#050506);",
    "  box-shadow:inset 0 0 0 1px rgba(0,0,0,.8);}",
    ".ssc-sm-cyl{position:absolute;inset:0;perspective:560px;}",
    ".ssc-sm-drum{position:absolute;left:3px;right:3px;top:50%;height:0;transform-style:preserve-3d;will-change:transform;}",
    ".ssc-sm-face{position:absolute;left:0;right:0;top:-30px;height:60px;display:grid;place-items:center;",
    "  backface-visibility:hidden;-webkit-backface-visibility:hidden;box-sizing:border-box;",
    "  background:linear-gradient(180deg,#e6dfcf,#fffdf5 30%,#fffdf5 70%,#e6dfcf);",
    "  border-top:1px solid rgba(120,90,40,.25);border-bottom:1px solid rgba(255,255,255,.6);",
    "  font:900 46px/1 Georgia,'Times New Roman',serif;font-variant-numeric:tabular-nums;color:#b0101c;",
    "  text-shadow:0 1px 0 #fff,0 -1px 0 rgba(0,0,0,.2);}",
    // Vertical motion blur while a drum is fast: the digit smears along its path.
    ".ssc-st-reel[data-fast='1'] .ssc-sm-face{color:rgba(176,16,28,.75);",
    "  text-shadow:0 -7px 0 rgba(176,16,28,.32),0 7px 0 rgba(176,16,28,.32),0 -14px 1px rgba(176,16,28,.16),0 14px 1px rgba(176,16,28,.16);}",
    // Light falls off towards the top and bottom of the drum; a specular
    // band sits just above the middle.
    ".ssc-st-reel::before{content:'';position:absolute;inset:0;z-index:2;pointer-events:none;",
    "  background:linear-gradient(180deg,rgba(0,0,0,.92) 0%,rgba(0,0,0,.45) 18%,transparent 36%,transparent 64%,rgba(0,0,0,.45) 82%,rgba(0,0,0,.95) 100%),",
    "    linear-gradient(180deg,transparent 33%,rgba(255,255,255,.22) 39%,transparent 46%);}",
    ".ssc-st-reel::after{content:'';position:absolute;inset:0;z-index:2;pointer-events:none;",
    "  box-shadow:inset 6px 0 8px -4px rgba(0,0,0,.6),inset -6px 0 8px -4px rgba(0,0,0,.6);}",
    ".ssc-st-reel--unit{width:46px;display:grid;place-items:center;background:none;box-shadow:none;",
    "  font:900 36px/1 Georgia,serif;background-image:linear-gradient(180deg,#fff6c9,#ffd34d 45%,#b8862b);",
    "  -webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 10px rgba(255,179,0,.7));}",
    ".ssc-st-reel--unit::before,.ssc-st-reel--unit::after{display:none;}",
    ".ssc-sm-lower{display:flex;align-items:center;gap:12px;margin-top:16px;padding:0 4px;}",
    ".ssc-sm-led{flex:1;min-width:0;height:36px;border-radius:9px;overflow:hidden;white-space:nowrap;",
    "  border:2px solid transparent;background:radial-gradient(ellipse at 50% 0%,#2a070b,#0c0203) padding-box,var(--sm-gold) border-box;",
    "  box-shadow:inset 0 2px 8px rgba(0,0,0,.95);",
    "  font:700 15px/32px ui-monospace,Consolas,monospace;letter-spacing:.16em;color:#ff4747;",
    "  text-shadow:0 0 8px #ff2020,0 0 2px #ff8080;text-align:center;}",
    ".ssc-sm-coin{position:relative;flex:none;width:58px;height:42px;border-radius:10px;display:grid;place-items:center;",
    "  border:2px solid transparent;background:var(--sm-chrome) padding-box,var(--sm-gold) border-box;",
    "  box-shadow:inset 0 1px 0 #fff,0 2px 5px rgba(0,0,0,.45);}",
    ".ssc-sm-coin::before{content:'';width:7px;height:26px;border-radius:4px;background:#0c0d10;",
    "  box-shadow:inset 0 2px 3px rgba(0,0,0,.9),0 0 0 2px #59606a;}",
    ".ssc-sm-coin i{position:absolute;left:50%;top:-52px;width:28px;height:28px;margin-left:-14px;border-radius:50%;opacity:0;",
    "  background:radial-gradient(circle at 35% 30%,#fff7cc,#f2b822 46%,#a06a0b);box-shadow:0 0 0 2px #c58b12,inset 0 0 0 4px rgba(255,255,255,.25);}",
    ".ssc-st-slot[data-coin='1'] .ssc-sm-coin i{animation:ssc-sm-coin 640ms cubic-bezier(.5,0,.9,.5) forwards;}",
    "@keyframes ssc-sm-coin{0%{opacity:1;transform:translateY(0) rotateY(0);}",
    "  70%{opacity:1;transform:translateY(52px) rotateY(80deg) scaleX(.3);}",
    "  100%{opacity:0;transform:translateY(62px) rotateY(90deg) scaleX(.1);}}",
    // The lever: a gold mount on the cabinet's side, a chrome arm, a glossy ball.
    ".ssc-st-handle{position:relative;flex:none;width:50px;height:230px;margin:0 0 70px -6px;padding:0;border:0;",
    "  background:transparent;cursor:pointer;pointer-events:auto;perspective:420px;}",
    ".ssc-st-handle::before{content:'';position:absolute;left:0;bottom:0;width:30px;height:70px;border-radius:0 14px 14px 0;",
    "  background:var(--sm-gold);box-shadow:inset 0 0 0 1px rgba(0,0,0,.25),2px 3px 6px rgba(0,0,0,.35);}",
    ".ssc-sm-arm{position:absolute;left:13px;bottom:34px;width:10px;height:168px;border-radius:5px;transform-origin:50% 100%;",
    "  background:linear-gradient(90deg,#6d757f,#ffffff 42%,#c9d0d7 58%,#7d8690);transition:transform .25s ease;}",
    ".ssc-sm-knob{position:absolute;left:50%;top:-20px;width:38px;height:38px;margin-left:-19px;border-radius:50%;",
    "  background:radial-gradient(circle at 34% 28%,#fff 0,#ffb3c0 10%,#e0102f 42%,#6a0414 100%);",
    "  box-shadow:0 5px 12px rgba(0,0,0,.5),inset 0 -4px 8px rgba(0,0,0,.35);}",
    ".ssc-st-handle:not(:disabled):hover .ssc-sm-arm{transform:rotateX(20deg);}",
    ".ssc-st-slot[data-pull='1'] .ssc-sm-arm{animation:ssc-sm-pull 760ms cubic-bezier(.3,.7,.4,1);}",
    "@keyframes ssc-sm-pull{0%{transform:rotateX(0);}35%{transform:rotateX(160deg);}55%{transform:rotateX(146deg);}100%{transform:rotateX(0);}}",
    ".ssc-st-handle:disabled{cursor:default;}",
    ".ssc-st-handle:focus-visible{outline:2px solid #ffd34d;outline-offset:4px;border-radius:10px;}",
    ".ssc-st-slot[data-flash='1'] .ssc-sm-window{animation:ssc-st-nudge 240ms ease;}",
    "@keyframes ssc-st-nudge{25%{transform:translateX(-3px);}75%{transform:translateX(3px);}}",

    /* ---- roulette: a casino table ----
     *
     * Wooden rim > green felt > the wheel (SVG: wooden bowl, ball track with
     * deflectors, 37 pockets in European order, a turning rotor with a gold
     * turret) and the betting layout beside it. The ball runs the other way
     * round the track, drops, bounces over the frets and settles; the number
     * it lands on is the grade on a 0-36 scale.
     */
    ".ssc-rl-table{padding:12px;border-radius:34px;width:min(880px,94vw);box-sizing:border-box;",
    "  background:repeating-linear-gradient(100deg,#6b3618 0 7px,#5b2d13 7px 11px,#7b4220 11px 19px,#62321a 19px 23px);",
    "  box-shadow:0 0 0 2px #2b1408,0 0 0 4px #c39237,0 30px 60px rgba(0,0,0,.6),inset 0 2px 0 rgba(255,255,255,.18);}",
    ".ssc-rl{position:relative;display:flex;align-items:center;justify-content:center;gap:clamp(14px,3vw,34px);",
    "  padding:clamp(14px,2.4vw,26px);border-radius:24px;",
    "  background:radial-gradient(ellipse at 50% 38%,#23935a,#11643a 58%,#0a4126);",
    "  box-shadow:inset 0 0 0 2px rgba(0,0,0,.35),inset 0 0 70px rgba(0,0,0,.5);}",
    // Felt nap: a faint cross-hatch.
    ".ssc-rl::before{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:.35;",
    "  background:repeating-linear-gradient(45deg,rgba(255,255,255,.03) 0 2px,transparent 2px 5px),",
    "    repeating-linear-gradient(-45deg,rgba(0,0,0,.05) 0 2px,transparent 2px 5px);}",
    ".ssc-rl-wheel{position:relative;width:min(330px,60vw,44vh);aspect-ratio:1;flex:none;}",
    ".ssc-rl-wheel svg{display:block;width:100%;height:100%;overflow:visible;",
    "  filter:drop-shadow(0 14px 20px rgba(0,0,0,.6));}",
    ".ssc-rl-wheel text{font-family:Georgia,'Times New Roman',serif;font-weight:700;}",
    ".ssc-rl-win{opacity:0;transition:opacity .3s ease;}",
    ".ssc-rl[data-landed='1'] .ssc-rl-win{opacity:1;animation:ssc-rl-pulse 700ms ease-in-out infinite alternate;}",
    "@keyframes ssc-rl-pulse{to{opacity:.45;}}",
    ".ssc-rl-board{position:relative;flex:1;max-width:390px;min-width:0;display:grid;",
    "  grid-template-columns:1.1fr repeat(12,minmax(0,1fr));grid-template-rows:repeat(3,auto);",
    "  border:2px solid rgba(255,255,255,.88);border-radius:4px;}",
    ".ssc-rl-cell{position:relative;display:grid;place-items:center;aspect-ratio:3/4;",
    "  border:1px solid rgba(255,255,255,.55);font:700 clamp(9px,1.25vw,13px)/1 Georgia,serif;color:#fff;}",
    ".ssc-rl-cell span{display:grid;place-items:center;width:80%;aspect-ratio:1;border-radius:50%;}",
    ".ssc-rl-cell--red span{background:#c0141f;}",
    ".ssc-rl-cell--black span{background:#141414;}",
    ".ssc-rl-cell--zero{grid-row:1/4;aspect-ratio:auto;background:#0b7a3b;border-radius:40% 0 0 40%;}",
    ".ssc-rl-cell[data-win='1']{background:rgba(255,215,90,.4);box-shadow:inset 0 0 0 2px #ffd65a;}",
    // The bets: three to five casino chips, each with a grade on its inlay,
    // go down before the spin. Only one of them is the real grade; the
    // others are decoys and clear off the table when the ball drops.
    ".ssc-rl-chip{--chip:#b3112a;--chip-deep:#6e0716;--chip-ink:#5a0612;",
    "  position:absolute;left:50%;top:50%;width:clamp(30px,3.6vw,40px);aspect-ratio:1;border-radius:50%;z-index:2;",
    "  transform:translate(-50%,-50%);display:grid;place-items:center;",
    "  background:radial-gradient(circle,#fdf8ec 0 46%,#d4b25a 47% 50%,transparent 51%),",
    "    repeating-conic-gradient(#f7f3ea 0 15deg,var(--chip) 15deg 45deg),var(--chip);",
    "  box-shadow:0 0 0 1.5px var(--chip-deep),inset 0 0 0 2px rgba(0,0,0,.18),0 3px 0 var(--chip-deep),0 7px 10px rgba(0,0,0,.6);",
    "  animation:ssc-rl-chip 620ms cubic-bezier(.3,1.5,.5,1) both;}",
    ".ssc-rl-chip--blue{--chip:#1d4fb8;--chip-deep:#0d2a66;--chip-ink:#0d2a66;}",
    ".ssc-rl-chip--green{--chip:#13804a;--chip-deep:#074226;--chip-ink:#074226;}",
    ".ssc-rl-chip--black{--chip:#25262b;--chip-deep:#050506;--chip-ink:#141418;}",
    ".ssc-rl-chip--purple{--chip:#6b2fb3;--chip-deep:#381563;--chip-ink:#381563;}",
    // line-height 1 + a little padding: the digits never touch the inlay's edge.
    ".ssc-rl-chip b{font:900 clamp(10px,1.15vw,13px)/1 system-ui,sans-serif;color:var(--chip-ink);letter-spacing:-.02em;padding:1px 0;}",
    "@keyframes ssc-rl-chip{0%{opacity:0;transform:translate(-50%,-50%) translateY(-80px) scale(1.8) rotate(-120deg);}",
    "  100%{opacity:1;transform:translate(-50%,-50%);}}",
    // The ball has spoken: the decoys are swept off, the real chip jumps and glows.
    ".ssc-rl-chip[data-out='1']{animation:ssc-rl-chip-out 520ms cubic-bezier(.5,0,.75,0) forwards;}",
    "@keyframes ssc-rl-chip-out{0%{opacity:1;transform:translate(-50%,-50%);}",
    "  30%{opacity:1;transform:translate(-50%,-50%) translateY(-6px) scale(1.05);}",
    "  100%{opacity:0;transform:translate(-50%,-50%) translateY(26px) scale(.35) rotate(70deg);}}",
    ".ssc-rl-chip[data-win='1']{z-index:3;animation:ssc-rl-chip-bounce 900ms cubic-bezier(.3,.7,.4,1) both,",
    "  ssc-rl-chip-glow 900ms ease-in-out 900ms infinite alternate;}",
    "@keyframes ssc-rl-chip-bounce{",
    "  0%{transform:translate(-50%,-50%);}",
    "  25%{transform:translate(-50%,-50%) translateY(-22px) scale(1.35);}",
    "  45%{transform:translate(-50%,-50%) scale(1.2,.85);}",
    "  62%{transform:translate(-50%,-50%) translateY(-9px) scale(1.25);}",
    "  80%{transform:translate(-50%,-50%) scale(1.22,1.18);}",
    "  100%{transform:translate(-50%,-50%) scale(1.25);}}",
    "@keyframes ssc-rl-chip-glow{",
    "  from{transform:translate(-50%,-50%) scale(1.25);box-shadow:0 0 0 1.5px var(--chip-deep),0 3px 0 var(--chip-deep),0 0 12px 4px rgba(255,214,90,.75);}",
    "  to{transform:translate(-50%,-50%) scale(1.25);box-shadow:0 0 0 2px #ffe08a,0 3px 0 var(--chip-deep),0 0 30px 12px rgba(255,214,90,.95);}}",
    ".ssc-rl-call{min-height:20px;font:800 15px/1.3 Georgia,serif;letter-spacing:.06em;color:#ffe6a0;",
    "  text-shadow:0 1px 3px rgba(0,0,0,.8),0 2px 8px rgba(0,0,0,.6);text-align:center;}",
    // The verdict: huge, gold, over a dark scrim so it reads on the felt.
    ".ssc-rl-reveal{position:fixed;top:0;left:0;width:100vw;height:100vh;overflow:hidden;z-index:6;display:grid;place-items:center;pointer-events:none;opacity:0;",
    "  background:radial-gradient(ellipse 62% 48% at 50% 50%,rgba(0,0,0,.88),rgba(0,0,0,.62) 55%,rgba(0,0,0,.2) 85%);}",
    ".ssc-rl-reveal[data-on='1']{animation:ssc-rl-reveal-bg 400ms ease-out forwards;}",
    "@keyframes ssc-rl-reveal-bg{to{opacity:1;}}",
    ".ssc-rl-reveal-text{display:flex;flex-direction:column;align-items:center;gap:.1em;text-align:center;}",
    ".ssc-rl-reveal-kicker{font:900 clamp(18px,3vw,34px)/1 system-ui,sans-serif;letter-spacing:.24em;padding-left:.24em;",
    "  color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8);}",
    // line-height above 1 and padding: background-clip:text paints only inside
    // the box, and /.9 cut off the tops and Georgia's descending 3, 5, 7, 9.
    ".ssc-rl-reveal-num{font:900 clamp(72px,15vw,190px)/1.15 Georgia,'Times New Roman',serif;letter-spacing:-.02em;",
    "  padding:.02em .1em .06em;overflow:visible;",
    "  background:linear-gradient(180deg,#fffbe6 0%,#ffe27a 34%,#d99a1c 60%,#fff1b0 100%);",
    "  -webkit-background-clip:text;background-clip:text;color:transparent;",
    "  filter:drop-shadow(0 4px 0 #5c3500) drop-shadow(0 0 28px rgba(255,201,51,.65));}",
    ".ssc-rl-reveal[data-on='1'] .ssc-rl-reveal-text{animation:ssc-rl-slam 700ms cubic-bezier(.2,1.4,.4,1) both;}",
    "@keyframes ssc-rl-slam{0%{opacity:0;transform:scale(2.6);filter:blur(10px);}60%{opacity:1;filter:blur(0);}100%{transform:scale(1);}}",
    "@media (max-width:640px){.ssc-rl{flex-direction:column;}.ssc-rl-board{width:100%;max-width:none;}}",

    /* ---- pack ---- */
    ".ssc-st-pack{position:relative;width:min(250px,46vw,40vh);aspect-ratio:5/7;",
    "  filter:drop-shadow(0 14px 26px rgba(0,0,0,.45));}",
    ".ssc-st-pack[data-shake='1']{animation:ssc-st-shake 1.4s ease-in-out infinite;}",
    "@keyframes ssc-st-shake{0%,100%{transform:rotate(-1.2deg) translateY(0);}",
    "  35%{transform:rotate(1.2deg) translateY(-4px);}70%{transform:rotate(-.6deg) translateY(-2px);}}",
    ".ssc-st-pack-half{position:absolute;inset:0;",
    "  transition:transform .6s cubic-bezier(.4,0,.2,1), opacity .6s ease;}",
    ".ssc-st-pack-half > .ssc-fc-wrap{width:100%;height:100%;}",
    ".ssc-st-pack-half .ssc-fc{width:100%;height:100%;aspect-ratio:auto;}",
    ".ssc-st-pack-half--top{clip-path:inset(0 0 50% 0);}",
    ".ssc-st-pack-half--bottom{clip-path:inset(50% 0 0 0);}",
    ".ssc-st-pack[data-open='1'] .ssc-st-pack-half--top{",
    "  transform:translate(-34%,-92%) rotate(-16deg);opacity:0;}",
    ".ssc-st-pack[data-open='1'] .ssc-st-pack-half--bottom{",
    "  transform:translate(34%,92%) rotate(16deg);opacity:0;}",
    ".ssc-st-decoy{position:absolute;left:50%;top:50%;width:52%;aspect-ratio:5/7;",
    "  margin:-26% 0 0 -26%;opacity:0;pointer-events:none;}",
    ".ssc-st-decoy .ssc-fc{width:100%;height:100%;aspect-ratio:auto;}",
    ".ssc-st-pack[data-open='1'] .ssc-st-decoy{animation:ssc-st-fly 900ms",
    "  cubic-bezier(.2,.8,.3,1) forwards;}",
    "@keyframes ssc-st-fly{0%{opacity:0;transform:translate(0,0) rotate(0) scale(.85);}",
    "  25%{opacity:1;}100%{opacity:0;",
    "  transform:translate(var(--dx,0),var(--dy,-120px)) rotate(var(--rot,20deg)) scale(.7);}}",
    ".ssc-st-pack-hint{font-size:12px;color:var(--ssc-muted);}",
    // The pouch: brushed foil in the tier colour, crinkle texture, a light
    // sweep and crimped seals; each half carries its own copy so the tear
    // splits the print cleanly.
    ".ssc-st-foil{position:absolute;inset:0;z-index:3;overflow:hidden;border-radius:6px;",
    "  background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.7) 42%,transparent 54%) 0 0/260% 100%,",
    "    repeating-linear-gradient(62deg,rgba(255,255,255,.12) 0 2px,rgba(0,0,0,.07) 2px 6px),",
    "    repeating-linear-gradient(-28deg,rgba(255,255,255,.08) 0 4px,transparent 4px 10px),",
    "    conic-gradient(from 200deg at 35% 32%,#c3cbd4,#fbfcfd,#8e98a3,#eef1f4,#7d8792,#f6f8fa,#aab3bd,#c3cbd4);",
    "  box-shadow:inset 0 0 0 1px rgba(255,255,255,.35),inset 0 0 30px rgba(0,0,0,.3);",
    "  animation:ssc-st-foil 3.2s ease-in-out infinite;}",
    "@keyframes ssc-st-foil{0%{background-position:130% 0,0 0,0 0,0 0;}70%,100%{background-position:-30% 0,0 0,0 0,0 0;}}",
    // The tier colour is laid over the silver foil.
    ".ssc-st-foil::before{content:'';position:absolute;inset:0;mix-blend-mode:multiply;",
    "  background:linear-gradient(160deg,var(--st-glow),color-mix(in srgb,var(--st-glow) 60%,#000));opacity:.62;}",
    ".ssc-st-foil::after{content:'';position:absolute;inset:0;mix-blend-mode:color-dodge;opacity:.2;",
    "  background:linear-gradient(125deg,#ff2d95,#ffd34d 25%,#3dffb0 50%,#2fb8ff 75%,#b44dff);}",
    ".ssc-st-foil-logo{position:absolute;left:50%;top:44%;width:44%;transform:translate(-50%,-50%);z-index:2;",
    "  filter:drop-shadow(0 2px 0 rgba(255,255,255,.35)) drop-shadow(0 6px 10px rgba(0,0,0,.45));}",
    // Name and tagline sit on a dark printed band, so they read on any foil.
    ".ssc-st-foil-band{position:absolute;left:0;right:0;top:63%;height:17%;z-index:2;",
    "  background:linear-gradient(180deg,rgba(8,10,14,.86),rgba(20,24,30,.78));",
    "  box-shadow:0 1px 0 rgba(255,255,255,.35),0 -1px 0 rgba(255,255,255,.35);}",
    ".ssc-st-foil-name{position:absolute;left:0;right:0;top:66%;z-index:2;text-align:center;",
    "  font:900 clamp(12px,2.2vw,16px)/1 system-ui,sans-serif;letter-spacing:.24em;padding-left:.24em;color:#fff;",
    "  text-transform:uppercase;text-shadow:0 1px 3px rgba(0,0,0,.8);}",
    ".ssc-st-foil-tag{position:absolute;left:0;right:0;top:74%;z-index:2;text-align:center;",
    "  font:700 10px/1 system-ui,sans-serif;letter-spacing:.3em;padding-left:.3em;color:rgba(255,255,255,.85);",
    "  text-shadow:0 1px 3px rgba(0,0,0,.8);}",
    ".ssc-st-crimp{position:absolute;left:0;right:0;height:7%;z-index:3;",
    "  background:repeating-linear-gradient(90deg,rgba(255,255,255,.55) 0 2px,rgba(0,0,0,.25) 2px 4px),",
    "    linear-gradient(180deg,#e9edf1,#9aa3ad);}",
    ".ssc-st-crimp--top{top:0;}",
    ".ssc-st-crimp--bottom{bottom:0;}",
    // The tear line glows while the pack waits.
    ".ssc-st-tear{position:absolute;left:4%;right:4%;top:50%;height:2px;margin-top:-1px;z-index:4;pointer-events:none;",
    "  background:linear-gradient(90deg,transparent,#fff 20%,#fff 80%,transparent);",
    "  box-shadow:0 0 10px 2px var(--st-glow);animation:ssc-st-tear 1.4s ease-in-out infinite alternate;}",
    "@keyframes ssc-st-tear{from{opacity:.25;}to{opacity:.9;}}",
    ".ssc-st-pack[data-open='1'] .ssc-st-tear{display:none;}",

    "@media not all{" /* was prefers-reduced-motion: cutscenes always play in full */,
    "  .ssc-st-overlay,.ssc-st-tilt,.ssc-st-flip,.ssc-st-wheel,",
    "  .ssc-st-pack-half,.ssc-st-canvas{transition:none;}",
    "  .ssc-st-rays,.ssc-st-flash,.ssc-st-pack[data-shake='1'],",
    "  .ssc-st-slot[data-flash='1'] .ssc-sm-window{animation:none;}",
    "  .ssc-st-pack[data-open='1'] .ssc-st-decoy{animation:none;opacity:0;}",
    "}",
  ].join("\n");

  /* ---------- helpers ---------- */

  function h(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function getLive() {
    var host = document.getElementById("ssc-root");
    if (!host || !host.shadowRoot) return null;
    var layer = host.shadowRoot.querySelector(".ssc-layer");
    if (!layer) return null;
    return { shadow: host.shadowRoot, layer: layer };
  }

  function ensureStyle(shadow) {
    if (shadow.querySelector("style[data-ssc-cutstyles]")) return;
    var style = document.createElement("style");
    style.setAttribute("data-ssc-cutstyles", "1");
    style.textContent = STYLE;
    shadow.appendChild(style);
  }

  /*
   * Always false: the user chose (2026-10-28) that cutscenes play in full
   * even when Windows/Edge asks for reduced motion. With it on, every stage
   * ran at a quarter of its length and several animations were switched off,
   * which read as "too fast" or "broken". The reduced code paths stay in
   * place so a settings toggle can bring them back.
   */
  function prefersReduced() {
    return false;
  }

  function fmt1(value) {
    return Number(value).toFixed(1).replace(".", ",");
  }

  function cardModule() {
    return window.sscFifaCard || null;
  }

  function buildBack(fill, tier, label) {
    var mod = cardModule();
    if (!mod) return h("div", "ssc-st-hint", "Kaart niet beschikbaar");
    var built = mod.buildBack({ fill: !!fill, tier: tier, label: label || "Cijfer" });
    return built.node;
  }

  function buildFront(grade, reduced, reveal) {
    var mod = cardModule();
    if (!mod) return null;
    return mod.build(grade, {
      fill: false,
      animateShine: false,
      enter: !reduced,
      reveal: !!reveal,
    });
  }

  function tierIdFor(percent) {
    var mod = cardModule();
    if (mod && mod.tierForPercent) return mod.tierForPercent(percent).id;
    return percent < 50 ? "bronze" : percent < 70 ? "silver" : percent < 85 ? "gold" : "icon";
  }

  function glowFor(percent) {
    var mod = cardModule();
    if (mod && mod.tierForPercent) return mod.tierForPercent(percent).glow;
    return percent < 50 ? "#d08a4a" : percent < 70 ? "#cfd6e0" : percent < 85 ? "#ffd34d" : "#6ea8ff";
  }

  /** Same canvas burst as cutscene.js, kept small for the two places we need it. */
  function burst(canvas, color, count) {
    var context = null;
    try {
      context = canvas.getContext("2d");
    } catch (e) {
      return null;
    }
    if (!context) return null;

    var rect = canvas.getBoundingClientRect();
    var w = Math.round(rect.width) || canvas.clientWidth;
    var hgt = Math.round(rect.height) || canvas.clientHeight;
    if (!w || !hgt) return null;

    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hgt * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    var parts = [];
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 120 + Math.random() * 320;
      parts.push({
        x: w / 2,
        y: hgt / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        size: 2 + Math.random() * 4,
        life: 1,
      });
    }

    var start = performance.now();
    var frame = 0;
    var stopped = false;

    function draw(now) {
      if (stopped) return;
      var elapsed = (now - start) / 1000;
      context.clearRect(0, 0, w, hgt);
      context.globalCompositeOperation = "lighter";
      for (var p = 0; p < parts.length; p++) {
        var part = parts[p];
        part.x += part.vx * 0.016;
        part.y += part.vy * 0.016;
        part.vy += 420 * 0.016;
        part.life = Math.max(0, 1 - elapsed / 1.4);
        context.globalAlpha = part.life;
        context.fillStyle = color;
        context.beginPath();
        context.arc(part.x, part.y, part.size, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      if (elapsed < 1.5) frame = window.requestAnimationFrame(draw);
      else context.clearRect(0, 0, w, hgt);
    }

    frame = window.requestAnimationFrame(draw);
    return function () {
      stopped = true;
      window.cancelAnimationFrame(frame);
    };
  }

  /* ---------- play ---------- */

  function play(styleId, options) {
    var opts = options || {};
    var value = Number(opts.grade);

    if (!isFinite(value) || value < 0) {
      if (opts.onClose) opts.onClose();
      return;
    }
    if (oursActive || (typeof window.sscCutsceneBusy === "function" && window.sscCutsceneBusy())) {
      // The queue still has to advance even though this reveal was dropped.
      if (opts.onClose) opts.onClose();
      return;
    }

    var live = getLive();
    if (!live) {
      if (opts.onClose) opts.onClose();
      return;
    }

    ensureStyle(live.shadow);
    var mod = cardModule();
    if (mod && mod.ensureStyles) mod.ensureStyles(live.shadow);

    var reduced = prefersReduced();
    var percent =
      typeof opts.percent === "number" && isFinite(opts.percent)
        ? opts.percent
        : (value / 20) * 100;
    var tierId = tierIdFor(percent);
    var glow = glowFor(percent);

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

    oursActive = true;
    if (typeof window.sscSetCutsceneActive === "function") window.sscSetCutsceneActive(true);

    var sound = opts.sound !== false;
    var audio = sound && typeof window.sscCreateCutsceneAudio === "function"
      ? window.sscCreateCutsceneAudio()
      : null;

    var overlay = h("div", "ssc-st-overlay");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Cijfer onthullen");
    overlay.tabIndex = -1;
    overlay.style.setProperty("--st-glow", glow);

    var header = h("header", "ssc-st-header");
    header.appendChild(h("div", "ssc-st-brand", "Cijfer openen"));

    var headerRight = h("div", "ssc-st-header-right");
    if (opts.total > 1 && opts.index >= 1) {
      headerRight.appendChild(h("span", "ssc-st-count", opts.index + " / " + opts.total));
    } else {
      headerRight.appendChild(h("span", "ssc-st-count", "SMARTSCHOOL COMBINED"));
    }
    // In a queue the stop control sits in the header, as the spec asks, and is
    // reachable during the animation rather than only on the result.
    if (typeof opts.onStop === "function") {
      var stopBtn = h("button", "ssc-st-btn ssc-st-btn--ghost", "Stop de reeks");
      stopBtn.type = "button";
      stopBtn.addEventListener("click", function () {
        try {
          opts.onStop();
        } catch (e) {
          /* The queue callback must not break the close below. */
        }
        close();
      });
      headerRight.appendChild(stopBtn);
    }
      // Queue only: mark this grade and all remaining ones as seen, close.
      if (typeof opts.onSkipAll === "function") {
        var skipAllBtn = h("button", "ssc-st-btn ssc-st-btn--ghost", "Skip alles");
        skipAllBtn.type = "button";
        skipAllBtn.addEventListener("click", function () {
          try {
            opts.onSkipAll();
          } catch (e) {
            /* The queue callback must not break the close below. */
          }
          close();
        });
        headerRight.appendChild(skipAllBtn);
      }
    header.appendChild(headerRight);

    var main = h("div", "ssc-st-main");
    var footer = h("footer", "ssc-st-footer");
    var hint = h("p", "ssc-st-hint", "");
    footer.appendChild(hint);

    overlay.appendChild(header);
    overlay.appendChild(main);
    overlay.appendChild(footer);

    var previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    var state = {
      closed: false,
      final: false,
      timers: [],
      cleaned: false,
      start: null,
      cleanupBurst: null,
      audio: audio,
      sound: sound,
      reduced: reduced,
    };

    function later(fn, ms) {
      // Bug 4: reduced motion used to mean "skip every stage and jump to the
      // card", which made all five of these styles look broken while reel and
      // tunnel still played (they only shorten their timings). Reduced motion
      // must shorten the stages, not delete them: the CSS media block already
      // removes the transitions, so a quicker delay still steps through every
      // stage instead of landing straight on the finished card. Scaling keeps
      // the relative order (slot's 15 ticks, roulette's spin) intact.
      var delay = state.reduced ? Math.round(ms * 0.25) : ms;
      var id = window.setTimeout(function () {
        state.timers = state.timers.filter(function (t) {
          return t !== id;
        });
        if (state.closed) return;
        fn();
      }, delay);
      state.timers.push(id);
      return id;
    }

    function clearTimers() {
      for (var i = 0; i < state.timers.length; i++) window.clearTimeout(state.timers[i]);
      state.timers = [];
    }

    function setHint(text) {
      hint.textContent = text || "";
    }

    function setStart(fn) {
      state.start = fn;
    }

    function startAudio(duration) {
      if (!state.sound || !state.audio) return;
      state.audio.unlock();
      state.audio.prepare().then(function () {
        if (state.closed || state.final) return;
        state.audio.play("case-opening.mp3", 0.8, undefined, duration, 0, 0.16);
      });
    }

    function tick() {
      if (!state.sound || !state.audio) return;
      // 5.3s / 0.17s are the pack clicks in cutscene.js; the same recording.
      state.audio.play("case-opening.mp3", 0.3, undefined, 0.17, 5.3, 0.04);
    }

    function showFinal() {
      if (state.final || state.closed) return;
      state.final = true;
      clearTimers();
      if (state.audio) state.audio.stop();
      if (state.cleanupBurst) {
        state.cleanupBurst();
        state.cleanupBurst = null;
      }
      if (typeof opts.onComplete === "function") {
        try {
          opts.onComplete();
        } catch (e) {
          /* Seen-marking must not abort the reveal. */
        }
      }

      main.textContent = "";

      var result = h("div", "ssc-st-result");
      var backFx = h("div", "ssc-st-fx");
      backFx.setAttribute("aria-hidden", "true");
      var rays = h("div", "ssc-st-rays");
      backFx.appendChild(rays);
      result.appendChild(backFx);

      var frontFx = h("div", "ssc-st-fx ssc-st-fx--front");
      frontFx.setAttribute("aria-hidden", "true");
      var canvas = h("canvas", "ssc-st-particles");
      frontFx.appendChild(canvas);
      result.appendChild(frontFx);

      // Bug 10: the final card is built from `grade`, the object assembled
      // from the options that arrived for this reveal — never from a decoy.
      // `reveal: true` turns on the data log in fifa-card.js.
      // A style may hand over the card it already shows (flip: the card that
      // just turned over). Re-using it avoids a second card flying in.
      var front = state.adopt || buildFront(grade, reduced, true);
      if (state.adopt && front.node) front.node.removeAttribute("data-enter");
      if (front) {
        var wrap = h("div", "ssc-st-card");
        wrap.appendChild(front.node);
        result.appendChild(wrap);
        if (!reduced && front.card) {
          var shine = front.card.querySelector(".ssc-fc-shine");
          if (shine) shine.setAttribute("data-on", "1");
        }
        // Bug 9: count the PERCENTAGE up. The /20 figure is the small line
        // under it and is already final on the card.
        var counter = front.percentNode || front.numNode;
        var counterText = front.percentText !== undefined ? front.percentText : front.ratingText;
        if (counter) {
          if (state.skipCountUp) {
            // Scratch: the number was already uncovered by hand; counting it
            // up from 0 again would read as a glitch.
            counter.textContent = counterText;
          } else if (mod && mod.countUp) {
            // Start at zero explicitly: build() now seeds the real value.
            counter.textContent = reduced ? counterText : "0";
            mod.countUp(counter, counterText, reduced ? 0 : 1100);
          } else {
            counter.textContent = counterText;
          }
        }

      }

      var flash = h("div", "ssc-st-flash");
      backFx.appendChild(flash);
      main.appendChild(result);

      // Rays and flash centre on the card, wherever the stage put it.
      var cardBox = result.querySelector(".ssc-st-card");
      var cardRect = cardBox ? cardBox.getBoundingClientRect() : null;
      if (cardRect && cardRect.width) {
        backFx.style.setProperty("--cx", Math.round(cardRect.left + cardRect.width / 2) + "px");
        backFx.style.setProperty("--cy", Math.round(cardRect.top + cardRect.height / 2) + "px");
      }

      if (!reduced) {
        window.requestAnimationFrame(function () {
          if (state.closed || !canvas.isConnected) return;
          rays.setAttribute("data-on", "1");
          flash.setAttribute("data-go", "1");
          var count =
            tierId === "icon" ? 90 : tierId === "gold" ? 56 : tierId === "silver" ? 32 : 20;
          state.cleanupBurst = burst(canvas, glow, count);
        });
      }

      if (state.audio && (tierId === "icon" || tierId === "gold")) {
        state.audio.accent(0.8, tierId === "icon");
      }

      footer.textContent = "";
      var actions = h("div", "ssc-st-actions");
      var primary = h(
        "button",
        "ssc-st-btn ssc-st-btn--primary",
        opts.hasNext ? "Volgende" : "Terug naar Smartschool"
      );
      primary.type = "button";
      primary.addEventListener("click", close);
      actions.appendChild(primary);
      footer.appendChild(actions);

      overlay.focus();
    }

    function close() {
      if (state.closed) return;
      state.closed = true;
      clearTimers();
      if (state.cleanupBurst) {
        state.cleanupBurst();
        state.cleanupBurst = null;
      }
      if (state.audio) state.audio.stop();
      document.documentElement.style.overflow = previousOverflow;
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);

      oursActive = false;
      if (typeof window.sscSetCutsceneActive === "function") window.sscSetCutsceneActive(false);

      if (opts.onClose) opts.onClose();
    }

    function onKey(e) {
      // A focused button already answers Enter/Space; letting both run would
      // fire the action twice.
      if (e.target && e.target.tagName === "BUTTON") return;

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (state.final) close();
        else showFinal();
        return;
      }
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        if (state.final) {
          close();
        } else if (state.start) {
          state.start();
        } else if (styleId === "scratch") {
          showFinal();
        }
      }
    }

    overlay.addEventListener("keydown", onKey);
    live.layer.appendChild(overlay);

    // Every style gets the same context; each builder uses what it needs.
    var ctx = {
      overlay: overlay,
      main: main,
      grade: grade,
      // Scratch: the card was uncovered by hand, so the final screen shows
      // the number as-is instead of counting it up from 0.
      skipCountUp: function () {
        state.skipCountUp = true;
      },
      value: value,
      tier: tierId,
      glow: glow,
      reduced: reduced,
      /*
       * Only a real run of several unseen grades counts as a queue. walkout.js
       * passes onStop on every call, single replays included, so testing for
       * it made every cutscene start by itself.
       */
      queue: opts.total > 1 && opts.index >= 1,
      opts: opts,
      later: later,
      /**
       * For durations that are not scheduled through later() (the rAF spin in
       * slot, the canvas idle timer in scratch). Same 0.25 factor, so reduced
       * motion compresses the whole style instead of letting one stage outlive
       * the card that already replaced it.
       */
      scaleMs: function (ms) {
        return reduced ? Math.round(ms * 0.25) : ms;
      },
      setHint: setHint,
      setStart: setStart,
      showFinal: showFinal,
      /** showFinal, but keep this already-visible card instead of building one. */
      showFinalWith: function (card) {
        state.adopt = card || null;
        showFinal();
      },
      startAudio: startAudio,
      tick: tick,
      isClosed: function () {
        return state.closed;
      },
      isFinal: function () {
        return state.final;
      },
    };

    window.requestAnimationFrame(function () {
      overlay.setAttribute("data-in", "1");
    });
    overlay.focus();

    if (sound && audio) {
      audio.unlock();
      audio.prepare();
    }

    // Bug 4: the reduced-motion branch used to `return` here after scheduling
    // showFinal, so BUILDERS[styleId] never ran for flip/scratch/slot/
    // roulette/pack and every one of them painted only the finished card.
    // reel and tunnel never had this branch. Reduced motion now only shortens
    // every delay (see later()); the stages still run in order.
    if (reduced) setHint("Cijfer onthullen…");


    var builder = BUILDERS[styleId];
    if (builder) builder(ctx);
    else showFinal();
  }

  /* ---------- style 3: flip ---------- */

  function buildFlip(ctx) {
    var scene = h("div", "ssc-st-scene");
    var tilt = h("div", "ssc-st-tilt");
    var flip = h("div", "ssc-st-flip");
    var backFace = h("div", "ssc-st-face ssc-st-face--back");
    var frontFace = h("div", "ssc-st-face ssc-st-face--front");

    backFace.appendChild(buildBack(true, ctx.tier, ctx.opts.vak || "Cijfer"));

    // The real card, built once. No entry animation: it appears by turning.
    // Its number starts at 0 and counts up once the flip has landed (the
    // result screen adopts this same card, it does not build a second one).
    var front = buildFront(ctx.grade, true);
    if (front) {
      frontFace.appendChild(front.node);
      var counter = front.percentNode || front.numNode;
      if (counter) counter.textContent = "0";
    }

    var glare = h("div", "ssc-st-glare");
    backFace.appendChild(glare);
    var holo = h("div", "ssc-st-holo");
    backFace.appendChild(holo);
    frontFace.appendChild(h("div", "ssc-st-holo ssc-st-holo--sweep"));

    // The cover lies on the closed card, like CijferReveal's po-card-cover.
    var cover = h("div", "ssc-st-cover");
    cover.appendChild(h("div", "ssc-st-cover-title", "NIEUW CIJFER"));
    if (ctx.opts.vak) cover.appendChild(h("div", "ssc-st-cover-sub", ctx.opts.vak));
    var open = h("button", "ssc-st-btn", "Open cijfer");
    open.type = "button";
    cover.appendChild(open);
    backFace.appendChild(cover);

    flip.appendChild(backFace);
    flip.appendChild(frontFace);
    tilt.appendChild(flip);
    scene.appendChild(tilt);
    ctx.main.appendChild(scene);

    var opened = false;

    function resetTilt() {
      tilt.removeAttribute("data-tilting");
      tilt.removeAttribute("data-hover");
      tilt.style.setProperty("--st-rx", "0deg");
      tilt.style.setProperty("--st-ry", "0deg");
    }

    // CijferReveal TiltCard: ±12° on both axes, glare follows the pointer.
    scene.addEventListener("pointermove", function (e) {
      if (opened || e.pointerType === "touch") return;
      var rect = scene.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var px = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      var py = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      tilt.style.setProperty("--st-rx", ((0.5 - py) * 12).toFixed(2) + "deg");
      tilt.style.setProperty("--st-ry", ((px - 0.5) * 12).toFixed(2) + "deg");
      glare.style.setProperty("--st-gx", (px * 100).toFixed(1) + "%");
      glare.style.setProperty("--st-gy", (py * 100).toFixed(1) + "%");
      holo.style.setProperty("--st-hx", (px * 100).toFixed(1) + "%");
      holo.style.setProperty("--st-hy", (py * 100).toFixed(1) + "%");
      tilt.setAttribute("data-tilting", "1");
      tilt.setAttribute("data-hover", "1");
    });
    scene.addEventListener("pointerleave", resetTilt);
    scene.addEventListener("pointercancel", resetTilt);

    function doOpen() {
      if (opened || ctx.isClosed() || ctx.isFinal()) return;
      opened = true;
      ctx.startAudio(2);
      // Straighten the card and lift the veil, then turn it over.
      resetTilt();
      cover.setAttribute("data-gone", "1");
      flip.setAttribute("data-flipped", "1");
      ctx.setHint("Escape om te versnellen");
      // 700ms turn + a short beat on the landed card, then the result screen
      // takes over the SAME card and counts its number up.
      ctx.later(function () {
        ctx.showFinalWith(front);
      }, 900);
    }

    open.addEventListener("click", doOpen);
    flip.addEventListener("click", doOpen);
    ctx.setStart(doOpen);
    // Always waits for the user, in the auto-play queue too.
    ctx.setHint("Klik op Open cijfer, of druk op Enter");
    window.requestAnimationFrame(function () {
      if (!ctx.isClosed()) open.focus();
    });
  }

  /* ---------- style 4: scratch ---------- */

  function buildScratch(ctx) {
    var wrap = h("div", "ssc-st-scratch");
    // Under the scratch layer sits the REAL card, built from the same grade
    // showFinal uses. It used to be buildBack(): the sealed back of a card,
    // so scratching uncovered a dark tinted surface instead of the grade.
    // Stacking, top to bottom: canvas (z 3) > card (z 2) > overlay backdrop.
    var mod = cardModule();
    var under = mod
      ? mod.build(ctx.grade, { fill: true, animateShine: false, enter: false, reveal: true })
      : null;
    if (under && under.node) {
      wrap.appendChild(under.node);
    } else {
      wrap.appendChild(buildBack(true, ctx.tier, ctx.opts.vak || "Cijfer"));
    }

    var canvas = h("canvas", "ssc-st-canvas");
    canvas.setAttribute("aria-label", "Kras om het cijfer te onthullen");
    wrap.appendChild(canvas);
    ctx.main.appendChild(wrap);
    ctx.setHint("Kras om te onthullen");

    var context = null;
    try {
      context = canvas.getContext("2d");
    } catch (e) {
      context = null;
    }
    if (!context) {
      ctx.later(ctx.showFinal, 900);
      return;
    }

    var done = false;
    var drawing = false;
    var idle = null;
    var lastCheck = 0;

    function complete() {
      if (done || ctx.isClosed() || ctx.isFinal()) return;
      done = true;
      if (idle) window.clearTimeout(idle);
      canvas.setAttribute("data-done", "1");
      ctx.skipCountUp();
      // Let the canvas fade (0.3s CSS) so the uncovered card is seen whole
      // before the result screen takes over.
      ctx.later(ctx.showFinal, 450);
    }

    function resetIdle() {
      if (idle) window.clearTimeout(idle);
      // Scaled too: under reduced motion an 8s idle wait would outlast the
      // overlay and look like the card never came.
      idle = window.setTimeout(complete, ctx.scaleMs(8000));
    }

    function paint() {
      var rect = wrap.getBoundingClientRect();
      var w = Math.round(rect.width);
      var hgt = Math.round(rect.height);
      if (!w || !hgt) {
        ctx.later(paint, 60);
        return;
      }
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(hgt * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      paintFoil(context, w, hgt, ctx.glow, ctx.opts.vak || "Jouw cijfer");

      resetIdle();
    }

    function pointOf(e) {
      var rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function scratchAt(point) {
      context.globalCompositeOperation = "destination-out";
      context.beginPath();
      context.arc(point.x, point.y, 30, 0, Math.PI * 2);
      context.fill();
    }

    function check() {
      var data;
      try {
        data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      } catch (e) {
        return; // A tainted canvas should never stop the reveal.
      }
      var total = 0;
      var clear = 0;
      // Sample every 7th pixel; enough for the 60% test, cheap at DPR 2.
      for (var i = 3; i < data.length; i += 4 * 7) {
        total++;
        if (data[i] < 128) clear++;
      }
      if (total && clear / total >= 0.6) complete();
    }

    canvas.addEventListener("pointerdown", function (e) {
      if (done) return;
      drawing = true;
      ctx.startAudio(2);
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        /* Capture is a nicety; the canvas still receives moves inside. */
      }
      scratchAt(pointOf(e));
      resetIdle();
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!drawing || done) return;
      e.preventDefault();
      scratchAt(pointOf(e));
      resetIdle();
      var now = performance.now();
      if (now - lastCheck > 200) {
        lastCheck = now;
        check();
      }
    });
    function stopDrawing() {
      drawing = false;
      if (!done) check();
    }
    canvas.addEventListener("pointerup", stopDrawing);
    canvas.addEventListener("pointercancel", stopDrawing);

    ctx.setStart(complete);
    ctx.later(paint, 40);
  }

  /**
   * Silver scratch-off foil: polished bands, brushed grain, a faint
   * holographic tint, glitter, and embossed type. Drawn once per card.
   */
  function paintFoil(context, w, hgt, glow, subject) {
    var base = context.createLinearGradient(0, 0, w, hgt);
    [[0, "#7f8892"], [0.16, "#e9edf1"], [0.3, "#a3abb4"], [0.46, "#f7f9fb"], [0.6, "#8a939d"],
      [0.74, "#dfe4e9"], [0.88, "#9aa3ad"], [1, "#eef1f4"]].forEach(function (s) {
      base.addColorStop(s[0], s[1]);
    });
    context.fillStyle = base;
    context.fillRect(0, 0, w, hgt);

    // Brushed grain: hairlines of light and shade.
    for (var y = 0; y < hgt; y += 1.5) {
      var a = Math.random() * 0.07;
      context.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255," + a + ")" : "rgba(0,0,0," + a * 0.8 + ")";
      context.fillRect(0, y, w, 1);
    }

    // Holographic tint, then the tier colour, both very light.
    context.globalCompositeOperation = "soft-light";
    var holo = context.createLinearGradient(0, hgt, w, 0);
    ["#ff2d95", "#ffd34d", "#3dffb0", "#2fb8ff", "#b44dff"].forEach(function (c, i, all) {
      holo.addColorStop(i / (all.length - 1), c);
    });
    context.globalAlpha = 0.55;
    context.fillStyle = holo;
    context.fillRect(0, 0, w, hgt);
    context.globalAlpha = 0.35;
    context.fillStyle = glow;
    context.fillRect(0, 0, w, hgt);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";

    // Glitter.
    for (var i = 0; i < Math.round((w * hgt) / 260); i++) {
      context.fillStyle = "rgba(255,255,255," + (0.35 + Math.random() * 0.65).toFixed(2) + ")";
      var gx = Math.random() * w;
      var gy = Math.random() * hgt;
      context.fillRect(gx, gy, 1, 1);
    }

    // Embossed type: a dark cut below, a highlight above, the face between.
    function emboss(text, font, yPos) {
      context.font = font;
      context.textAlign = "center";
      context.fillStyle = "rgba(255,255,255,.75)";
      context.fillText(text, w / 2, yPos - 1);
      context.fillStyle = "rgba(20,26,34,.55)";
      context.fillText(text, w / 2, yPos + 1);
      context.fillStyle = "#59626d";
      context.fillText(text, w / 2, yPos);
    }
    emboss("KRAS HIER", "800 " + Math.round(w * 0.085) + "px system-ui, -apple-system, 'Segoe UI', sans-serif", hgt / 2 - 2);
    emboss(String(subject).toUpperCase().slice(0, 24), "700 " + Math.round(w * 0.045) + "px system-ui, -apple-system, 'Segoe UI', sans-serif", hgt / 2 + w * 0.08);

    // A thin bevel along the shield outline's straight edges.
    context.strokeStyle = "rgba(255,255,255,.55)";
    context.lineWidth = 2;
    context.strokeRect(w * 0.04, hgt * 0.06, w * 0.92, hgt * 0.78);
  }

  /* ---------- style 5: slot ---------- */

  function buildSlot(ctx) {
    var wrap = h("div", "ssc-st-slot");
    var cab = h("div", "ssc-sm-cab");

    // Marquee with a row of chasing bulbs along its top and bottom edge.
    var top = h("div", "ssc-sm-top");
    ["top", "bottom"].forEach(function (edge) {
      var row = h("div", "ssc-sm-bulbs ssc-sm-bulbs--" + edge);
      for (var b = 0; b < 13; b++) row.appendChild(h("i", "ssc-sm-bulb"));
      top.appendChild(row);
    });
    top.appendChild(h("div", "ssc-sm-title", "JACKPOT"));
    top.appendChild(h("div", "ssc-sm-sub", ctx.opts.vak ? String(ctx.opts.vak).toUpperCase().slice(0, 24) : "CIJFER"));
    cab.appendChild(top);

    var windowEl = h("div", "ssc-sm-window");

    // Bug 9: the reels land on the PERCENTAGE (0-100), the same number the
    // card shows. The old version landed on the /20 digits ("15,8").
    var percentInt = Math.round(
      typeof ctx.opts.percent === "number" && isFinite(ctx.opts.percent)
        ? ctx.opts.percent
        : (ctx.value / 20) * 100
    );
    if (!isFinite(percentInt) || percentInt < 0) percentInt = 0;
    if (percentInt > 100) percentInt = 100;
    var padded = ("00" + percentInt).slice(-3);
    var digits = [padded.charAt(0), padded.charAt(1), padded.charAt(2)];

    /*
     * Each reel is a real drum: ten faces of FACE_H px on a ring, face d at
     * rotateX(d * 36deg) translateZ(radius). Turning the drum by -pos * 36deg
     * brings digit pos to the front, so the digits roll downwards.
     */
    var FACE_H = 60;
    var RADIUS = FACE_H / 2 / Math.tan(Math.PI / 10);
    var reels = [];
    for (var r = 0; r < 3; r++) {
      var reel = h("div", "ssc-st-reel");
      // "79%" must not read "079%": the hundreds wheel is folded away until
      // it carries a digit.
      if (r === 0 && percentInt < 100) reel.style.display = "none";
      var cyl = h("div", "ssc-sm-cyl");
      var drum = h("div", "ssc-sm-drum");
      for (var d = 0; d < 10; d++) {
        var face = h("div", "ssc-sm-face", String(d));
        face.style.transform = "rotateX(" + d * 36 + "deg) translateZ(" + RADIUS.toFixed(2) + "px)";
        drum.appendChild(face);
      }
      cyl.appendChild(drum);
      reel.appendChild(cyl);
      windowEl.appendChild(reel);
      reels.push({ reel: reel, strip: drum, target: Number(digits[r]) || 0 });
    }
    // The unit sign sits after the wheels, so the reels read as "79%".
    var unit = h("div", "ssc-st-reel ssc-st-reel--unit", "%");
    unit.setAttribute("aria-hidden", "true");
    windowEl.appendChild(unit);
    cab.appendChild(windowEl);

    var lower = h("div", "ssc-sm-lower");
    var led = h("div", "ssc-sm-led", "TREK AAN DE HENDEL");
    var coin = h("div", "ssc-sm-coin");
    coin.appendChild(h("i"));
    coin.setAttribute("aria-hidden", "true");
    lower.appendChild(led);
    lower.appendChild(coin);
    cab.appendChild(lower);

    var handle = h("button", "ssc-st-handle");
    handle.type = "button";
    handle.setAttribute("aria-label", "Trek aan de hendel");
    var arm = h("span", "ssc-sm-arm");
    arm.appendChild(h("span", "ssc-sm-knob"));
    handle.appendChild(arm);

    wrap.appendChild(cab);
    wrap.appendChild(handle);
    ctx.main.appendChild(wrap);
    ctx.setHint("Klik op de hendel");

    var spinning = false;

    /*
     * Timeline (unscaled ms after the handle is pulled):
     *   0           coin drops, lever swings, every reel rolls at SPIN_SPEED
     *   FIRST_STOP  first visible reel lands; each next one STOP_GAP later
     *   + PAUSE     dramatic hold on the full number, bulbs go wild
     *   + FLASH_MS  flash, then the card
     */
    var SPIN_SPEED = 0.03; // cells per ms: ~30 digits a second, readable as rolling
    var FIRST_STOP = 4600;
    var STOP_GAP = 400;
    var BRAKE_MS = 1400; // nominal braking time; adjusted per reel to land exactly
    var PAUSE_MS = 900;
    var FLASH_MS = 420;

    /*
     * Constant speed, then an ease-out-cubic brake whose starting speed equals
     * the spin speed (no jolt), landing exactly at `landAt` on `target`.
     *
     * With speed v, landing time L and brake distance b, the brake lasts
     * 3b/v (cubic ease-out starts at speed 3b/T), so the reel travels
     *   offset + v*(L - 3b/v) + b  =  offset + v*L - 2b   cells.
     * b is the nominal v*BRAKE/3 plus the smallest e in [0, 5) that makes
     * that total end on the target digit; the landing time never moves.
     * `offset` starts each reel on a different digit so they do not roll in
     * lockstep. The strip repeats 0-9, so the position is drawn modulo 10.
     */
    function spin(reel, strip, target, landAt, offset) {

      // Time factor (1, or 0.25 under reduced motion). scaleMs(1) would round
      // to 0, hence the 1000ms probe.
      var factor = ctx.scaleMs(1000) / 1000;
      var speed = SPIN_SPEED / factor; // scaled time runs faster under reduced motion
      var land = ctx.scaleMs(landAt);
      var base = (speed * ctx.scaleMs(BRAKE_MS)) / 3;
      var need = (((offset + speed * land - 2 * base - target) % 10) + 10) % 10;
      var brakeDist = base + need / 2;
      var brakeMs = (3 * brakeDist) / speed;
      var spinEnd = Math.max(0, land - brakeMs);
      var spinDist = speed * spinEnd;
      var start = performance.now();

      function draw(pos) {
        var turn = ((pos % 10) + 10) % 10;
        strip.style.transform = "rotateX(" + (-turn * 36).toFixed(2) + "deg)";
        // Vertical motion blur while the drum is fast (CSS, on the faces: a
        // filter here would flatten the 3D ring).
        if (pos - offset < spinDist * 0.92) reel.setAttribute("data-fast", "1");
        else reel.removeAttribute("data-fast");
      }

      function frame(now) {
        if (ctx.isClosed() || ctx.isFinal()) return;
        var t = now - start;
        var pos;
        if (t <= spinEnd) {
          pos = offset + speed * t;
        } else {
          var p = Math.min(1, (t - spinEnd) / brakeMs);
          pos = offset + spinDist + brakeDist * (1 - Math.pow(1 - p, 3));
          if (p >= 1) {
            draw(target); // exact landing, no float drift
            reel.removeAttribute("data-fast");
            ctx.tick(); // the "clunk" of a reel stopping
            return;
          }
        }
        draw(pos);
        window.requestAnimationFrame(frame);
      }
      draw(offset);
      window.requestAnimationFrame(frame);
      return spinEnd + brakeMs;
    }

    function doStart() {
      if (spinning || ctx.isClosed() || ctx.isFinal()) return;
      spinning = true;
      handle.disabled = true;
      wrap.setAttribute("data-coin", "1");
      wrap.setAttribute("data-pull", "1");
      led.textContent = "• • • DRAAIT • • •";
      ctx.startAudio(6);

      // Only the visible reels count for the stop rhythm (the hundreds reel
      // is folded away below 100%).
      var visible = reels.filter(function (r, idx) {
        return !(idx === 0 && percentInt < 100);
      });
      var lastLand = 0;
      for (var i = 0; i < visible.length; i++) {
        var landAt = FIRST_STOP + i * STOP_GAP;
        // Each reel starts a few digits apart, so they never roll in lockstep.
        var took = spin(visible[i].reel, visible[i].strip, visible[i].target, landAt, i * 3.5);
        lastLand = Math.max(lastLand, took);
      }

      // Rattle while everything still spins, until the first reel brakes.
      var rattleUntil = FIRST_STOP - BRAKE_MS;
      for (var at = 110; at < rattleUntil; at += 110) ctx.later(ctx.tick, at);

      ctx.setHint("Escape om te versnellen");
      // lastLand is already in scaled time; later() scales again, so undo it.
      var finalAt = lastLand / (ctx.scaleMs(1000) / 1000);
      ctx.later(function () {
        if (ctx.isClosed() || ctx.isFinal()) return;
        wrap.setAttribute("data-win", "1");
        led.textContent = "WINST " + percentInt + "%";
      }, finalAt);
      ctx.later(function () {
        if (ctx.isClosed() || ctx.isFinal()) return;
        wrap.setAttribute("data-flash", "1");
        ctx.later(ctx.showFinal, FLASH_MS);
      }, finalAt + PAUSE_MS);
    }

    handle.addEventListener("click", doStart);
    ctx.setStart(doStart);
    if (ctx.queue) ctx.later(doStart, 900);
  }

  /* ---------- style 6: roulette ---------- */

  var SVG_NS = "http://www.w3.org/2000/svg";

  function svg(tag, attrs, parent) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      node.setAttribute(k, String(attrs[k]));
    });
    if (parent) parent.appendChild(node);
    return node;
  }

  // European single-zero wheel, clockwise from the zero.
  var WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
    5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  var RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

  function pocketColor(n) {
    if (n === 0) return "green";
    return RED_NUMBERS.indexOf(n) !== -1 ? "red" : "black";
  }

  /** Fisher-Yates, on a copy. */
  function shuffle(list) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  var POCKET_FILL = { red: "#c0141f", black: "#151515", green: "#0b7a3b" };
  var POCKET_DEEP = { red: "#7d0b13", black: "#050505", green: "#064d25" };
  var COLOR_LABEL = { red: "rood", black: "zwart", green: "groen" };

  /** Point on a circle, angle in degrees clockwise from 12 o'clock. */
  function polar(r, deg) {
    var a = (deg * Math.PI) / 180;
    return (r * Math.sin(a)).toFixed(3) + " " + (-r * Math.cos(a)).toFixed(3);
  }

  function ringSector(r0, r1, a0, a1) {
    return "M" + polar(r1, a0) + " A" + r1 + " " + r1 + " 0 0 1 " + polar(r1, a1) +
      " L" + polar(r0, a1) + " A" + r0 + " " + r0 + " 0 0 0 " + polar(r0, a0) + " Z";
  }

  /** The whole wheel as one SVG; returns the parts the animation moves. */
  function buildWheelSvg(winIndex) {
    var STEP = 360 / 37;
    var root = svg("svg", { viewBox: "-100 -100 200 200", "aria-hidden": "true" });
    var defs = svg("defs", {}, root);
    function radial(id, stops, extra) {
      var g = svg("radialGradient", Object.assign({ id: id }, extra || {}), defs);
      stops.forEach(function (s) {
        svg("stop", { offset: s[0], "stop-color": s[1] }, g);
      });
    }
    radial("ssc-rl-wood", [["0.78", "#8f4d22"], ["0.9", "#5b2d12"], ["1", "#2c1407"]]);
    radial("ssc-rl-track", [["0.7", "#0d0907"], ["0.86", "#2c1d14"], ["1", "#120b07"]]);
    radial("ssc-rl-cone", [["0", "#c07a3a"], ["0.6", "#8a4a1e"], ["1", "#4b250d"]], { cx: "40%", cy: "35%" });
    radial("ssc-rl-gold", [["0", "#fff4c2"], ["0.5", "#e2b24a"], ["1", "#8a5b12"]], { cx: "35%", cy: "30%" });
    radial("ssc-rl-ballg", [["0", "#ffffff"], ["0.7", "#e6ebf0"], ["1", "#9aa4ae"]], { cx: "35%", cy: "30%" });

    // Static: wooden bowl, polished track, deflector diamonds.
    svg("circle", { r: 99, fill: "url(#ssc-rl-wood)" }, root);
    svg("circle", { r: 98, fill: "none", stroke: "#e2b24a", "stroke-width": 1.2 }, root);
    svg("circle", { r: 90, fill: "url(#ssc-rl-track)" }, root);
    svg("circle", { r: 90, fill: "none", stroke: "rgba(255,255,255,.18)", "stroke-width": 0.6 }, root);
    for (var dmd = 0; dmd < 8; dmd++) {
      svg("path", {
        d: "M0 -88 L2.2 -84 L0 -80 L-2.2 -84 Z",
        fill: "url(#ssc-rl-gold)",
        transform: "rotate(" + (dmd * 45 + 22.5) + ")",
      }, root);
    }

    // The rotor: pockets, numbers, frets, cone, turret.
    var rotor = svg("g", {}, root);
    svg("circle", { r: 74, fill: "#2a1a10" }, rotor);
    for (var i = 0; i < 37; i++) {
      var n = WHEEL_ORDER[i];
      var col = pocketColor(n);
      var a0 = i * STEP - STEP / 2;
      var a1 = a0 + STEP;
      svg("path", { d: ringSector(63, 73, a0, a1), fill: POCKET_FILL[col] }, rotor);
      svg("path", { d: ringSector(51, 63, a0, a1), fill: POCKET_DEEP[col] }, rotor);
      var label = svg("text", {
        transform: "rotate(" + (i * STEP) + ") translate(0 -68)",
        "text-anchor": "middle",
        "dominant-baseline": "central",
        "font-size": 6.4,
        fill: "#fff",
      }, rotor);
      label.textContent = String(n);
      svg("path", { d: "M" + polar(51, a0) + " L" + polar(73, a0), stroke: "#e2b24a", "stroke-width": 0.7 }, rotor);
    }
    var win = svg("path", {
      class: "ssc-rl-win",
      d: ringSector(51, 73, winIndex * STEP - STEP / 2, winIndex * STEP + STEP / 2),
      fill: "rgba(255,214,90,.25)",
      stroke: "#ffd65a",
      "stroke-width": 1.6,
    }, rotor);
    void win;
    svg("circle", { r: 73, fill: "none", stroke: "#e2b24a", "stroke-width": 1 }, rotor);
    svg("circle", { r: 51, fill: "url(#ssc-rl-cone)", stroke: "#e2b24a", "stroke-width": 1 }, rotor);
    svg("circle", { r: 38, fill: "none", stroke: "rgba(255,230,170,.25)", "stroke-width": 0.6 }, rotor);
    for (var sp = 0; sp < 4; sp++) {
      var spoke = svg("g", { transform: "rotate(" + sp * 90 + ")" }, rotor);
      svg("rect", { x: -1.6, y: -30, width: 3.2, height: 24, rx: 1.6, fill: "url(#ssc-rl-gold)" }, spoke);
      svg("circle", { cy: -31, r: 3.4, fill: "url(#ssc-rl-gold)" }, spoke);
    }
    svg("circle", { r: 9, fill: "url(#ssc-rl-gold)", stroke: "#8a5b12", "stroke-width": 0.8 }, rotor);
    svg("circle", { r: 3.2, fill: "#fff4c2" }, rotor);

    // The ball, positioned every frame.
    var ball = svg("g", {}, root);
    svg("circle", { r: 3.7, fill: "url(#ssc-rl-ballg)" }, ball);
    svg("circle", { cx: -1.1, cy: -1.2, r: 1, fill: "#fff" }, ball);

    return { root: root, rotor: rotor, ball: ball, step: STEP };
  }

  function buildBoard(winning) {
    var board = h("div", "ssc-rl-board");
    var zero = h("div", "ssc-rl-cell ssc-rl-cell--zero", "0");
    board.appendChild(zero);
    var cells = { 0: zero };
    // Real layout: three rows (3, 6 … 36 on top), twelve columns.
    for (var row = 0; row < 3; row++) {
      for (var c = 0; c < 12; c++) {
        var n = c * 3 + (3 - row);
        var cell = h("div", "ssc-rl-cell ssc-rl-cell--" + pocketColor(n));
        cell.style.gridRow = String(row + 1);
        cell.style.gridColumn = String(c + 2);
        cell.appendChild(h("span", null, String(n)));
        board.appendChild(cell);
        cells[n] = cell;
      }
    }
    return { node: board, cell: cells[winning], cells: cells };
  }

  function buildRoulette(ctx) {
    var percent = typeof ctx.opts.percent === "number" && isFinite(ctx.opts.percent)
      ? ctx.opts.percent
      : (ctx.value / 20) * 100;
    // The grade on the wheel's own scale: 0% is the zero, 100% is 36.
    var number = Math.max(0, Math.min(36, Math.round((percent / 100) * 36)));
    var winIndex = WHEEL_ORDER.indexOf(number);
    var colour = pocketColor(number);

    var table = h("div", "ssc-rl-table");
    var felt = h("div", "ssc-rl");
    var wheelBox = h("div", "ssc-rl-wheel");
    var wheel = buildWheelSvg(winIndex);
    wheelBox.appendChild(wheel.root);
    felt.appendChild(wheelBox);
    var board = buildBoard(number);
    felt.appendChild(board.node);
    table.appendChild(felt);
    ctx.main.appendChild(table);

    var call = h("div", "ssc-rl-call", "Rien ne va plus?");
    ctx.main.appendChild(call);

    // The bets go down before the spin: the real grade on the number the
    // ball is going to find, and two to four decoy grades on other numbers.
    // Every chip sits where the same 0-36 scale would put its own grade, so
    // the table gives nothing away; the order and colours are shuffled too.
    var gradeText = String(Math.round(percent));
    var bets = [{ value: Math.round(percent), number: number, real: true }];
    var taken = {};
    taken[number] = true;
    var decoys = 2 + Math.floor(Math.random() * 3);
    for (var tries = 0; bets.length < decoys + 1 && tries < 200; tries++) {
      var fake = 5 + Math.floor(Math.random() * 96);
      var fakeNumber = Math.max(0, Math.min(36, Math.round((fake / 100) * 36)));
      if (taken[fakeNumber] || Math.abs(fake - Math.round(percent)) < 8) continue;
      taken[fakeNumber] = true;
      bets.push({ value: fake, number: fakeNumber, real: false });
    }
    var colours = shuffle(["red", "blue", "green", "black", "purple"]);
    var chips = [];
    shuffle(bets).forEach(function (bet, i) {
      var cell = board.cells[bet.number];
      if (!cell) return;
      var chip = h("i", "ssc-rl-chip ssc-rl-chip--" + colours[i % colours.length]);
      chip.appendChild(h("b", null, String(bet.value)));
      chip.setAttribute("aria-label", "Inzet: " + bet.value + "%");
      chips.push({ node: chip, real: bet.real });
      ctx.later(function () {
        cell.appendChild(chip);
        ctx.tick();
      }, 350 + i * 260);
    });

    var reveal = h("div", "ssc-rl-reveal");
    reveal.setAttribute("aria-live", "polite");
    var revealText = h("div", "ssc-rl-reveal-text");
    revealText.appendChild(h("div", "ssc-rl-reveal-kicker", "JE CIJFER:"));
    revealText.appendChild(h("div", "ssc-rl-reveal-num", gradeText + "%"));
    reveal.appendChild(revealText);

    var button = h("button", "ssc-st-btn", "Gooi de bal");
    button.type = "button";
    ctx.main.appendChild(button);
    ctx.setHint("Waar valt de bal?");

    var TRACK_R = 81;
    var POCKET_R = 57;
    var STEP = wheel.step;
    var idleAngle = Math.random() * 360;
    wheel.rotor.setAttribute("transform", "rotate(" + idleAngle + ")");
    wheel.ball.setAttribute("transform", "rotate(" + (idleAngle + 180) + ") translate(0 " + -TRACK_R + ")");

    var spun = false;

    /*
     * Unscaled timeline:
     *   0 – 5600   the ball runs counter-clockwise, the rotor clockwise
     *   3500       the ball leaves the track, spirals in, bounces over frets
     *   5600       it settles in its pocket and rides along with the rotor
     *   + 1600     decoys swept off, the real chip jumps; then JE CIJFER
     * The rotor keeps turning (it slows over 8s) like a real wheel.
     */
    var LAND_MS = 5600;
    var DROP_MS = 3500;
    var ROTOR_MS = 8000;
    // Long enough to watch the decoys clear and the real chip jump.
    var HOLD_MS = 1600;
    var REVEAL_MS = 2200;

    function easeOut(p, k) {
      return 1 - Math.pow(1 - p, k);
    }

    function doStart() {
      if (spun || ctx.isClosed() || ctx.isFinal()) return;
      spun = true;
      button.disabled = true;
      ctx.startAudio(7);
      ctx.setHint("Escape om te versnellen");
      call.textContent = "Rien ne va plus";

      var rotorTurn = 360 * 2 + Math.random() * 180;
      var relTurns = 360 * 7;
      var land = ctx.scaleMs(LAND_MS);
      var drop = ctx.scaleMs(DROP_MS);
      var rotorMs = ctx.scaleMs(ROTOR_MS);
      var t0 = performance.now();
      var lastPocket = null;
      var landed = false;

      function frame(now) {
        if (ctx.isClosed() || ctx.isFinal()) return;
        var t = now - t0;
        var rotor = idleAngle + rotorTurn * easeOut(Math.min(1, t / rotorMs), 3);

        // The ball, measured in the rotor's frame: it ends dead on its
        // pocket, so the landing is exact whatever the rotor does.
        var p = Math.min(1, t / land);
        var rel = winIndex * STEP + relTurns * (1 - easeOut(p, 4));
        var radius = TRACK_R;
        if (t > drop && p < 1) {
          var u = (t - drop) / (land - drop);
          var fall = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
          // Bounces over the frets: outward hops that die away.
          var hop = Math.abs(Math.sin(u * Math.PI * 3.5)) * Math.pow(1 - u, 1.6) * 9;
          radius = TRACK_R - (TRACK_R - POCKET_R) * fall + hop;
          rel += Math.sin(u * Math.PI * 6) * (1 - u) * 7;
          var pocket = Math.floor(rel / STEP);
          if (pocket !== lastPocket) {
            if (lastPocket !== null) ctx.tick();
            lastPocket = pocket;
          }
        } else if (p >= 1) {
          radius = POCKET_R;
          if (!landed) {
            landed = true;
            ctx.tick();
            settle();
          }
        }

        wheel.rotor.setAttribute("transform", "rotate(" + rotor.toFixed(2) + ")");
        wheel.ball.setAttribute(
          "transform",
          "rotate(" + (rotor + rel).toFixed(2) + ") translate(0 " + (-radius).toFixed(2) + ")"
        );
        if (t < rotorMs) window.requestAnimationFrame(frame);
      }
      window.requestAnimationFrame(frame);
    }

    function settle() {
      felt.setAttribute("data-landed", "1");
      call.textContent = number + " " + COLOR_LABEL[colour];
      if (board.cell) board.cell.setAttribute("data-win", "1");
      chips.forEach(function (chip) {
        chip.node.setAttribute(chip.real ? "data-win" : "data-out", "1");
      });
      ctx.later(function () {
        if (ctx.isClosed() || ctx.isFinal()) return;
        // JE CIJFER: 79% slams in over the table, with the burst behind it.
        ctx.main.appendChild(reveal);
        var sparks = h("div", "ssc-st-fx ssc-st-fx--front");
        sparks.setAttribute("aria-hidden", "true");
        var canvas = h("canvas", "ssc-st-particles");
        sparks.appendChild(canvas);
        ctx.main.appendChild(sparks);
        window.requestAnimationFrame(function () {
          if (!reveal.isConnected) return;
          reveal.setAttribute("data-on", "1");
          burst(canvas, ctx.glow, 64);
        });
        ctx.later(ctx.showFinal, REVEAL_MS);
      }, HOLD_MS);
    }

    button.addEventListener("click", doStart);
    ctx.setStart(doStart);
    if (ctx.queue) ctx.later(doStart, 900);
  }

  /* ---------- style 7: pack ---------- */

  var LOGO_URL = (function () {
    try {
      return chrome.runtime.getURL("assets/icons/logo.svg");
    } catch (e) {
      return "";
    }
  })();

  /** Crimped seal: a zig-zag edge facing the pouch. */
  function crimp(edge) {
    var node = h("i", "ssc-st-crimp ssc-st-crimp--" + edge);
    var teeth = 22;
    var pts = [];
    for (var i = 0; i <= teeth; i++) {
      var x = ((i / teeth) * 100).toFixed(2) + "%";
      var deep = i % 2 ? "100%" : "72%";
      pts.push(edge === "top" ? x + " " + deep : x + " " + (i % 2 ? "0%" : "28%"));
    }
    node.style.clipPath =
      edge === "top" ? "polygon(0 0,100% 0," + pts.reverse().join(",") + ")" : "polygon(" + pts.join(",") + ",100% 100%,0 100%)";
    return node;
  }

  /** The printed foil pouch that covers one half of the pack. */
  function buildFoil(vak) {
    var foil = h("div", "ssc-st-foil");
    if (LOGO_URL) {
      var logo = h("img", "ssc-st-foil-logo");
      logo.src = LOGO_URL;
      logo.alt = "";
      foil.appendChild(logo);
    }
    foil.appendChild(h("i", "ssc-st-foil-band"));
    foil.appendChild(h("div", "ssc-st-foil-name", vak ? String(vak).slice(0, 22) : "Cijfer"));
    foil.appendChild(h("div", "ssc-st-foil-tag", "1 KAART · GEGARANDEERD"));
    foil.appendChild(crimp("top"));
    foil.appendChild(crimp("bottom"));
    return foil;
  }

  function buildPack(ctx) {
    var pack = h("div", "ssc-st-pack");
    pack.setAttribute("data-shake", "1");

    var top = h("div", "ssc-st-pack-half ssc-st-pack-half--top");
    var bottom = h("div", "ssc-st-pack-half ssc-st-pack-half--bottom");
    top.appendChild(buildBack(true, null, ctx.opts.vak || "Cijfer"));
    bottom.appendChild(buildBack(true, null, ctx.opts.vak || "Cijfer"));
    [top, bottom].forEach(function (half) {
      half.appendChild(buildFoil(ctx.opts.vak));
    });
    pack.appendChild(top);
    pack.appendChild(bottom);
    pack.appendChild(h("i", "ssc-st-tear"));

    var flights = [
      ["-120px", "-150px", "-28deg"],
      ["130px", "-120px", "24deg"],
      ["10px", "-180px", "8deg"],
    ];
    for (var i = 0; i < flights.length; i++) {
      var decoy = h("div", "ssc-st-decoy");
      decoy.style.setProperty("--dx", flights[i][0]);
      decoy.style.setProperty("--dy", flights[i][1]);
      decoy.style.setProperty("--rot", flights[i][2]);
      decoy.appendChild(buildBack(true, null, ""));
      pack.appendChild(decoy);
    }

    ctx.main.appendChild(pack);

    var opened = false;

    function doOpen() {
      if (opened || ctx.isClosed() || ctx.isFinal()) return;
      opened = true;
      pack.removeAttribute("data-shake");
      pack.setAttribute("data-open", "1");
      ctx.startAudio(3.2);
      ctx.setHint("Escape om te versnellen");
      ctx.later(ctx.showFinal, 1450);
    }

    var button = h("button", "ssc-st-btn", "Openen");
    button.type = "button";
    button.addEventListener("click", doOpen);
    ctx.main.appendChild(button);

    ctx.setStart(doOpen);
    // The sealed pack shakes until it is opened, in the auto-play queue too.
    ctx.setHint("Klik op Openen, of druk op Enter");
    window.requestAnimationFrame(function () {
      if (!ctx.isClosed()) button.focus();
    });
  }

  var BUILDERS = {
    flip: buildFlip,
    scratch: buildScratch,
    slot: buildSlot,
    roulette: buildRoulette,
    pack: buildPack,
  };

  /* ---------- dispatch ---------- */

  /* "guess" and "random" are not reveals of their own: they pick or precede one of the real styles. */
  var META_STYLES = { guess: true, random: true };
  var REAL_STYLES = ["reel", "tunnel", "flip", "scratch", "slot", "roulette", "pack"];
  var lastRandom = "";

  function rememberStyle(settings) {
    if (!settings) return;
    if (OWN_STYLES[settings.cutsceneStyle] || META_STYLES[settings.cutsceneStyle]) stylePref = settings.cutsceneStyle;
    else if (stylePref !== "reel") stylePref = "reel";
  }

  if (typeof window.sscGet === "function") {
    window.sscGet().then(rememberStyle, function () {});
    if (typeof window.sscOnChange === "function") window.sscOnChange(rememberStyle);
  }

  /** Runs one real style, whatever the user's saved preference is. */
  function runStyle(name, options) {
    if (OWN_STYLES[name]) { play(name, options); return; }
    if (name === "tunnel" && typeof window.sscPlayCutsceneTunnel === "function") {
      if (typeof window.sscCloseSurfaces === "function") window.sscCloseSurfaces();
      window.sscPlayCutsceneTunnel(options);
      return;
    }
    original(options); // the reel (cutscene.js plays the reel unless its own saved preference is "tunnel")
  }

  /** A different style than the last time. */
  function pickRandomStyle() {
    var pool = REAL_STYLES.filter(function (s) { return s !== lastRandom && (s !== "tunnel" || typeof window.sscPlayCutsceneTunnel === "function"); });
    lastRandom = pool[Math.floor(Math.random() * pool.length)] || "reel";
    return lastRandom;
  }

  /*
   * Guess the grade: before the reveal the student sees the test and its maximum, picks a score,
   * and the closer the guess, the more coins. The real score is never put in the dialog.
   * Payout: share of the maximum between the guess and the real score. Exact = 500, then
   * within 2% = 250, 5% = 120, 10% = 60, 20% = 20, else nothing.
   */
  var GUESS_PAYOUT = [[0, 500], [0.02, 250], [0.05, 120], [0.1, 60], [0.2, 20]];
  function guessReward(guess, score, max) {
    var diff = Math.abs(guess - score) / max;
    for (var i = 0; i < GUESS_PAYOUT.length; i++) if (diff <= GUESS_PAYOUT[i][0] + 1e-9) return GUESS_PAYOUT[i][1];
    return 0;
  }

  function giveCoins(n) {
    if (!(n > 0) || typeof window.sscLoadModule !== "function") return;
    window.sscLoadModule("hub").then(function () {
      if (window.sscHubEconomy) window.sscHubEconomy.ready().then(function () { window.sscHubEconomy.give(n); });
    }, function () {});
  }

  /** Our overlays live in a shadow root: the theme stylesheet forces colours/backgrounds on plain divs and made them unreadable. */
  function isolate(node, tag) {
    var host = document.createElement("div");
    host.setAttribute("data-ssc-guess", tag);
    host.style.cssText = "all:initial";
    host.attachShadow({ mode: "open" }).appendChild(node);
    document.documentElement.appendChild(host);
    return host;
  }

  /** Glassy, high-contrast result popup. Goes away by itself (timer + animation), on click, and when the reveal closes. */
  var activeToast = null;
  function dismissToast() { if (activeToast) { activeToast.remove(); activeToast = null; } }
  function toast(line, big, won) {
    dismissToast();
    var t = document.createElement("div");
    t.style.cssText = "position:fixed;left:50%;top:4vh;transform:translateX(-50%);z-index:2147483600;cursor:pointer;background:linear-gradient(135deg,rgba(255,255,255,.14),rgba(255,255,255,.04)),rgba(12,12,20,.58);-webkit-backdrop-filter:blur(22px) saturate(1.6);backdrop-filter:blur(22px) saturate(1.6);color:#fff;border:1px solid " + (won ? "rgba(255,210,74,.75)" : "rgba(255,255,255,.35)") + ";border-radius:18px;padding:16px 30px;text-align:center;font-family:system-ui,sans-serif;box-shadow:0 12px 44px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.35);text-shadow:0 1px 3px rgba(0,0,0,.65);max-width:90vw";
    var a = document.createElement("div"); a.style.cssText = "font:600 17px system-ui,sans-serif;color:#e8e8ee"; a.textContent = line;
    var b = document.createElement("div"); b.style.cssText = "font:800 30px system-ui,sans-serif;margin-top:4px;color:" + (won ? "#ffd24a" : "#fff"); b.textContent = big;
    t.appendChild(a); t.appendChild(b);
    t.addEventListener("click", dismissToast);
    var host = isolate(t, "toast");
    activeToast = host;
    var gone = function () { if (activeToast === host) dismissToast(); else host.remove(); };
    setTimeout(gone, 4500);
    if (t.animate) { var an = t.animate([{ opacity: 1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], { duration: 4500, fill: "forwards" }); an.onfinish = gone; }
  }

  function askGuess(options, go) {
    var max = Number(options.max), score = Number(options.score);
    if (!(max > 0) || !isFinite(score)) { go(null); return; }
    var wrap = document.createElement("div");
    wrap.style.cssText = "position:fixed;inset:0;z-index:2147483500;background:radial-gradient(ellipse at 50% 35%,#1b1b25,#07070a 75%);display:grid;place-items:center;font-family:system-ui,sans-serif";
    var card = document.createElement("div");
    card.style.cssText = "width:min(520px,90vw);background:#0f0f14;color:#fff;text-shadow:none;border:1px solid rgba(255,255,255,.35);border-radius:18px;padding:26px;text-align:center";
    var h = document.createElement("div"); h.style.cssText = "font-size:15px;font-weight:700;letter-spacing:.14em;color:#ffd24a"; h.textContent = "RAAD JE PUNTEN";
    var t = document.createElement("div"); t.style.cssText = "font-size:26px;font-weight:800;color:#fff;margin:8px 0 6px"; t.textContent = (options.titel || "Toets") + (options.vak ? " (" + options.vak + ")" : "");
    var m = document.createElement("div"); m.style.cssText = "color:#f0f0f6;font-size:17px;line-height:1.4;margin-bottom:18px"; m.textContent = "Maximum: " + max + " punten. Hoe dichter je zit, hoe meer munten.";
    var val = document.createElement("div"); val.style.cssText = "font-size:46px;font-weight:800;color:#fff;margin:6px 0";
    var sl = document.createElement("input"); sl.type = "range"; sl.min = "0"; sl.max = String(max); sl.step = max > 40 ? "1" : "0.5"; sl.value = String(Math.round(max * 0.6 * 2) / 2); sl.style.cssText = "width:100%";
    var show = function () { val.textContent = sl.value + " / " + max; };
    sl.addEventListener("input", show); show();
    var row = document.createElement("div"); row.style.cssText = "display:flex;gap:10px;justify-content:center;margin-top:20px";
    var mk = function (label, primary, fn) { var b = document.createElement("button"); b.type = "button"; b.textContent = label; b.style.cssText = "padding:10px 20px;border-radius:12px;border:1px solid rgba(255,255,255,.3);font:700 17px system-ui,sans-serif;text-shadow:none;filter:none;cursor:pointer;color:#fff;background:" + (primary ? "#1f6fcf" : "#34343c"); b.addEventListener("click", fn); return b; };
    var done = false;
    var finish = function (guess) { if (done) return; done = true; wrap.dispatchEvent(new Event("remove-host")); go(guess); };
    row.appendChild(mk("Gok vastleggen", true, function () { finish(Number(sl.value)); }));
    row.appendChild(mk("Overslaan", false, function () { finish(null); }));
    [h, t, m, val, sl, row].forEach(function (n) { card.appendChild(n); });
    wrap.appendChild(card);
    var host = isolate(wrap, "ask");
    wrap.addEventListener("remove-host", function () { host.remove(); });
  }

  /** Runs the reveal and, when a guess was made, settles it once the reveal ends. */
  function playGuess(options) {
    askGuess(options, function (guess) {
      var opts = Object.assign({}, options);
      if (guess !== null) {
        var settled = false;
        var settle = function () {
          if (settled) return; settled = true;
          var score = Number(options.score), max = Number(options.max), coins = guessReward(guess, score, max);
          toast("Je gok: " + guess + "  ·  Het cijfer: " + score, coins > 0 ? "+" + coins + " munten!" : "Geen munten dit keer", coins > 0);
          giveCoins(coins);
        };
        ["onClose", "onComplete"].forEach(function (k) {
          var prev = options[k];
          opts[k] = function () { var had = settled; settle(); if (k === "onClose" && had) dismissToast(); if (typeof prev === "function") return prev.apply(this, arguments); };
        });
      }
      runStyle(typeof window.sscPlayCutsceneTunnel === "function" ? "tunnel" : "reel", opts);
    });
  }

  /**
   * Same option object and callbacks as cutscene.js. The five styles this file owns are
   * intercepted, plus "random" (a different style every time) and "guess" (guess first, then
   * the walkout); reel and tunnel go to the original untouched.
   */
  window.sscPlayCutscene = function (options) {
    var opts = options || {};
    if (stylePref === "guess") playGuess(opts);
    else if (stylePref === "random") runStyle(pickRandomStyle(), opts);
    else if (OWN_STYLES[stylePref]) play(stylePref, opts);
    else original(options);
  };

  window.sscPlayCutsceneStyled = true;
  window.sscPlayCutsceneStyle = play;
})();
