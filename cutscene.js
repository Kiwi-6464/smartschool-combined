/**
 * Smartschool Combined — cutscene (FIFA walkout).
 *
 * Two sources, deliberately kept apart:
 *
 *   1. The MOTION comes from inspiration/CijferReveal/extension/shared/
 *      opening/ — the CS:GO-style reel. `createSpinPlan`, `reelProgress`,
 *      `brakeArea`, `brakeIntegral` and `settle` are a verbatim port of
 *      choreography.ts / ReelEngine.ts, constants included. That is the
 *      deceleration that reads as a real case opening, and rewriting it by
 *      eye would lose it.
 *
 *   2. The LOOK comes from old versions/01/cutscene.js — the FIFA card. The
 *      shield silhouette, the four tiers, the shine sweep and the walkout
 *      entry now live in fifa-card.js. This file adds the packaging around
 *      them: pull-through, light streaks, the dramatic pause and the flip.
 *
 * Sequence (one cutscene):
 *
 *      0.00 – 0.90s   pull-through: sealed card rushes the camera, streaks peak
 *      0.90 – ~5.1s   reel: sealed packs decelerate past the marker
 *      +0.90s pause   the landed pack holds, dead still, glow rising
 *      0.70s          flip: pack turns over into the FIFA card, flash
 *      1.10s          the /20 rating counts up; particles on the icon tier
 *      then           Volgende / Stop de reeks
 *
 * No dependencies, no build step, no !important. Everything lives in the
 * existing shadow root; nothing is appended to document.body.
 */
(function () {
  "use strict";

  // Sign-in pages: do nothing at all (see guard.js).
  if (window.sscSkipPage) return;

  if (window.sscPlayCutscene) return;

  /* ---------- our own timings ---------- */

  var PULL_MS = 900;
  var PAUSE_MS = 900;
  var FLIP_MS = 700;
  var COUNT_MS = 1100;

  var VOLUME = 0.8;

  /* ---------- trajectory, ported verbatim from ReelEngine.ts ---------- */

  var ORIGINAL_SPIN_MS = 3500;
  var ORIGINAL_SPEED = 0.00808;
  var ORIGINAL_POSITION = ORIGINAL_SPEED * (ORIGINAL_SPIN_MS - 447 - 160 / 2);
  var ORIGINAL_TICK_OFFSET = 5.3;
  var ORIGINAL_TICK_DURATION = 0.17;
  var ORIGINAL_REVEAL_OFFSET = 6.47;

  var REDUCED_STOP_MS = 650;

  function brakeArea(power) {
    return 1 - 2 / (power + 1) + 1 / (2 * power + 1);
  }

  function brakeIntegral(u, power) {
    return (
      u -
      (2 * Math.pow(u, power + 1)) / (power + 1) +
      Math.pow(u, 2 * power + 1) / (2 * power + 1)
    );
  }

  function settle(u) {
    return u * u * u * (10 + u * (-15 + 6 * u));
  }

  function reelProgress(ms, plan) {
    var startMs = plan.startMs;
    var accelerationMs = plan.accelerationMs;
    var brakeMs = plan.brakeMs;
    var approachMs = plan.approachMs;
    var stopMs = plan.stopMs;
    var speed = plan.speed;
    var power = plan.power;
    var distance = plan.distance;
    var landingOffset = plan.landingOffset;

    if (ms <= startMs) return 0;
    if (ms >= stopMs) return distance;
    if (ms >= approachMs) {
      return distance + landingOffset * (1 - settle((ms - approachMs) / (stopMs - approachMs)));
    }

    var elapsed = ms - startMs;
    if (elapsed < accelerationMs) {
      var u = elapsed / accelerationMs;
      return speed * accelerationMs * (u * u * u - 0.5 * u * u * u * u);
    }
    if (ms < brakeMs) return speed * (elapsed - accelerationMs / 2);

    var duration = approachMs - brakeMs;
    var b = (ms - brakeMs) / duration;
    return speed * (brakeMs - startMs - accelerationMs / 2 + duration * brakeIntegral(b, power));
  }

  function createSpinPlan(random) {
    var initialIndex = 4;
    var targetIndex = initialIndex + 30 + Math.floor(random() * 5);

    var choice = random();
    var landingMode = choice < 0.5 ? "soft" : choice < 0.78 ? "edge" : "near-miss";
    var landingOffset =
      landingMode === "soft"
        ? -0.16 - random() * 0.14
        : landingMode === "edge"
          ? 0.2 + random() * 0.17
          : 0.54 + random() * 0.06;

    var startMs = 447;
    var accelerationMs = 160;
    var brakeMs = ORIGINAL_SPIN_MS;
    var power = 1.5 + random() * 1.2;

    var distance = targetIndex - initialIndex;
    var travel = distance + landingOffset;
    var speed = ORIGINAL_SPEED;
    var approachMs = brakeMs + (travel - ORIGINAL_POSITION) / (speed * brakeArea(power));
    var stopMs =
      approachMs + 320 + random() * 100 + (landingMode === "near-miss" ? 120 : 0);

    var base = {
      startMs: startMs,
      accelerationMs: accelerationMs,
      brakeMs: brakeMs,
      approachMs: approachMs,
      stopMs: stopMs,
      revealMs: stopMs + 140,
      power: power,
      initialIndex: initialIndex,
      targetIndex: targetIndex,
      landingOffset: landingOffset,
      landingMode: landingMode,
      distance: distance,
      speed: speed,
    };

    // Binary-search the exact moment each pack boundary is crossed, so the
    // click lands on the frame the pack actually passes the marker.
    var ticks = [];
    for (var boundary = 0.5; boundary < travel; boundary++) {
      var low = startMs;
      var high = approachMs;
      for (var i = 0; i < 48; i++) {
        var middle = (low + high) / 2;
        if (reelProgress(middle, base) < boundary) low = middle;
        else high = middle;
      }
      ticks.push((low + high) / 2);
    }

    if (landingMode === "near-miss") {
      var lo = approachMs;
      var hi = stopMs;
      for (var k = 0; k < 48; k++) {
        var mid = (lo + hi) / 2;
        if (reelProgress(mid, base) > distance + 0.5) lo = mid;
        else hi = mid;
      }
      ticks.push((lo + hi) / 2);
    }

    base.ticks = ticks;
    base.grades = decoys(targetIndex + 10, random);
    return base;
  }

  /* ---------- values ---------- */

  function fmt1(value) {
    return Number(value).toFixed(1).replace(".", ",");
  }

  /**
   * Decoy values for the reel. A shuffled tenths bag 2,0..20,0 guarantees the
   * whole /20 range appears on every spin.
   */
  function decoys(count, random) {
    var bag = [];
    for (var n = 20; n <= 200; n++) bag.push(n);

    var out = [];
    while (out.length < count) {
      for (var i = bag.length - 1; i > 0; i--) {
        var j = Math.floor(random() * (i + 1));
        var tmp = bag[i];
        bag[i] = bag[j];
        bag[j] = tmp;
      }
      for (var b = 0; b < bag.length && out.length < count; b++) {
        out.push(fmt1(bag[b] / 10));
      }
    }
    return out;
  }

  /* ---------- style ---------- */

  var STYLE = [
    /* --- overlay shell --- */
    // The theme backdrop (backdrop.js) is painted behind this element and
    // carries the blur; a second backdrop-filter here would re-blur an
    // already-blurred layer once per frame.
    ".ssc-cutscene-overlay{",
    "  --sc-text:#f5f7fa;--sc-muted:#c1c9d4;--sc-focus:#7cb4ff;",
    "  position:fixed;inset:0;z-index:2147483001;display:flex;flex-direction:column;",
    "  overflow:auto;box-sizing:border-box;background:rgba(7,9,13,.55);color:var(--sc-text);",
    "  font-family:system-ui,-apple-system,'Segoe UI',sans-serif;pointer-events:auto;",
    "  opacity:0;transition:opacity 320ms ease;",
    "}",
    ".ssc-cutscene-overlay[data-in='1']{opacity:1;}",
    ".ssc-cutscene-overlay *{box-sizing:border-box;}",
    ".ssc-cutscene-overlay:focus{outline:none;}",

    /* --- header / footer --- */
    ".ssc-cutscene-header{position:relative;z-index:6;display:flex;align-items:center;",
    "  justify-content:space-between;gap:20px;padding:24px clamp(20px,4vw,40px);",
    "  color:var(--sc-muted);font-size:12px;}",
    ".ssc-cutscene-brand{min-width:0;color:var(--sc-text);font-weight:600;}",
    ".ssc-cutscene-count{flex:none;letter-spacing:.08em;font-size:11px;font-variant-numeric:tabular-nums;}",
    ".ssc-cutscene-footer{position:relative;z-index:6;min-height:112px;padding:16px 24px 28px;text-align:center;}",
    ".ssc-cutscene-footer p{margin:0;color:var(--sc-muted);font-size:11px;letter-spacing:.06em;}",
    ".ssc-cutscene-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:12px;margin-top:18px;",
    "  opacity:0;transition:opacity 320ms ease;}",
    ".ssc-cutscene-actions[data-on='1']{opacity:1;}",
    ".ssc-cutscene-primary,.ssc-cutscene-secondary{min-height:44px;padding:10px 22px;",
    "  border:1px solid transparent;border-radius:8px;font:inherit;font-size:14px;cursor:pointer;",
    "  transition:background-color 140ms ease,border-color 140ms ease;}",
    ".ssc-cutscene-primary{border-color:#e4eaf3;background:#e4eaf3;color:#121720;}",
    ".ssc-cutscene-primary:hover{background:#fff;}",
    ".ssc-cutscene-secondary{border-color:#596477;background:#18202b;color:var(--sc-text);}",
    ".ssc-cutscene-secondary:hover{border-color:#8996a7;background:#222c3a;}",
    ".ssc-cutscene-overlay button:focus-visible{outline:2px solid var(--sc-focus);outline-offset:3px;}",

    /* --- stage --- */
    ".ssc-cutscene-main{position:relative;z-index:2;flex:1;min-height:340px;display:grid;",
    "  grid-template-columns:minmax(0,1fr);align-content:center;justify-items:center;",
    "  overflow:hidden;text-align:center;}",
    ".ssc-cutscene-stage{grid-area:1/1;width:100%;display:flex;flex-direction:column;align-items:center;}",
    ".ssc-cutscene-reel-item .ssc-fc-wrap{width:100%;height:100%;}",
    ".ssc-cutscene-spin-context{margin:0 24px 26px;}",
    ".ssc-cutscene-spin-context h1{margin:0 0 6px;font-size:clamp(20px,3vw,28px);font-weight:600;}",
    ".ssc-cutscene-spin-context p{margin:0;max-width:55ch;color:var(--sc-muted);font-size:13px;line-height:1.5;}",

    /* --- light streaks: rush past the camera, then fall away --- */
    ".ssc-cutscene-streaks{position:absolute;inset:0;width:100%;height:100%;",
    "  pointer-events:none;z-index:1;opacity:.9;transition:opacity 600ms ease;}",
    ".ssc-cutscene-streaks[data-off='1']{opacity:0;}",

    /* --- pull-through --- */
    ".ssc-cutscene-pull{position:absolute;inset:0;z-index:5;display:grid;place-items:center;",
    "  pointer-events:none;perspective:1200px;}",
    ".ssc-cutscene-pull[data-run='1']{animation:ssc-cutscene-pull " + PULL_MS + "ms cubic-bezier(.2,.9,.2,1) both;}",
    "@keyframes ssc-cutscene-pull{",
    "  0%{opacity:0;transform:translateZ(-420px) scale(.62);filter:blur(9px);}",
    "  32%{opacity:1;filter:blur(0);}",
    "  72%{opacity:1;transform:translateZ(0) scale(1);}",
    "  100%{opacity:0;transform:translateZ(260px) scale(1.55);filter:blur(3px);}",
    "}",

    /* --- the reel --- */
    ".ssc-cutscene-lane{position:relative;width:min(100%,1180px);height:300px;overflow:hidden;",
    "  perspective:900px;",
    "  -webkit-mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent);",
    "  mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent);}",
    ".ssc-cutscene-track{position:absolute;top:21px;left:0;display:flex;gap:20px;",
    "  transform-style:preserve-3d;will-change:transform;}",
    ".ssc-cutscene-reel-item{flex:0 0 clamp(152px,16vw,184px);height:258px;",
    "  transform:translateZ(-52px) scale(.9);opacity:.5;",
    "  filter:blur(calc(.8px + var(--ssc-reel-blur,0px))) saturate(.7);",
    "  transition:transform 340ms cubic-bezier(.22,1,.36,1),opacity 340ms ease;}",
    // The blur follows the reel's speed (set per frame in paint()); the
    // centre card keeps half of it so it still reads as moving.
    ".ssc-cutscene-reel-item.is-center{transform:translateZ(18px) scale(1.07);opacity:1;",
    "  filter:blur(calc(var(--ssc-reel-blur,0px) * .5));}",
    ".ssc-cutscene-reel-item.is-center .ssc-fc-wrap{",
    "  filter:drop-shadow(0 0 26px rgba(190,220,255,.35)) drop-shadow(0 16px 22px rgba(0,0,0,.55));}",

    /* --- centre marker --- */
    ".ssc-cutscene-marker{position:absolute;z-index:2;top:21px;height:258px;left:50%;width:1px;",
    "  transform:translateX(-50%);pointer-events:none;",
    "  background:linear-gradient(180deg,rgba(217,232,240,.44),transparent 25%,",
    "    transparent 75%,rgba(217,232,240,.44));}",
    ".ssc-cutscene-marker::before,.ssc-cutscene-marker::after{position:absolute;left:50%;",
    "  width:14px;height:9px;background:#dce9f7;content:'';transform:translateX(-50%);}",
    ".ssc-cutscene-marker::before{top:-14px;clip-path:polygon(0 0,100% 0,50% 100%);}",
    ".ssc-cutscene-marker::after{bottom:-14px;clip-path:polygon(0 100%,100% 100%,50% 0);}",
    ".ssc-cutscene-stopped .ssc-cutscene-marker{filter:drop-shadow(0 0 7px rgba(220,233,247,.6));}",

    /* --- dramatic pause: the landed pack breathes, nothing moves --- */
    ".ssc-cutscene-lane[data-pause='1'] .ssc-cutscene-reel-item.is-center{",
    "  animation:ssc-cutscene-breathe " + PAUSE_MS + "ms ease-in-out both;}",
    "@keyframes ssc-cutscene-breathe{",
    "  0%{transform:translateZ(18px) scale(1.07);}",
    "  45%{transform:translateZ(46px) scale(1.12);}",
    "  100%{transform:translateZ(18px) scale(1.07);}",
    "}",
    ".ssc-cutscene-lane[data-pause='1'] .ssc-cutscene-reel-item.is-center .ssc-fc-wrap{",
    "  filter:drop-shadow(0 0 52px rgba(220,236,255,.6)) drop-shadow(0 16px 22px rgba(0,0,0,.55));",
    "  transition:filter 700ms ease;}",

    /* --- result / flip --- */
    ".ssc-cutscene-result{grid-area:1/1;position:relative;width:100%;min-height:420px;",
    "  display:grid;place-items:center;perspective:1400px;}",
    /*
     * The reveal's light: full-screen fixed layers, not children sized by the
     * stage. Inside the stage (overflow:hidden, between header and footer)
     * the rays, sparks and flash stopped short of the screen's edges.
     */
    ".ssc-cutscene-fx{position:fixed;top:0;left:0;width:100vw;height:100vh;overflow:hidden;pointer-events:none;z-index:0;}",
    ".ssc-cutscene-fx--front{z-index:3;}",
    ".ssc-cutscene-rays{position:absolute;left:var(--cx,50%);top:var(--cy,50%);width:300vmax;height:300vmax;",
    "  margin:-150vmax 0 0 -150vmax;pointer-events:none;opacity:0;",
    "  transition:opacity 600ms ease;animation:ssc-cutscene-spin 46s linear infinite;",
    "  -webkit-mask-image:radial-gradient(circle,#000 0%,transparent 34%);",
    "  mask-image:radial-gradient(circle,#000 0%,transparent 34%);",
    "  background:repeating-conic-gradient(from 0deg,",
    "    var(--sc-rays) 0deg 6deg,transparent 6deg 18deg);}",
    ".ssc-cutscene-rays[data-on='1']{opacity:1;}",
    "@keyframes ssc-cutscene-spin{to{transform:rotate(360deg);}}",

    ".ssc-cutscene-flash{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9;background:#fff;opacity:0;",
    "  pointer-events:none;}",
    ".ssc-cutscene-flash[data-go='1']{animation:ssc-cutscene-flash 700ms ease-out;}",
    "@keyframes ssc-cutscene-flash{0%{opacity:.92;}100%{opacity:0;}}",

    ".ssc-cutscene-flip{position:relative;z-index:2;width:min(320px,72vw,50vh);aspect-ratio:5/7;",
    "  transform-style:preserve-3d;transition:transform " + FLIP_MS + "ms cubic-bezier(.2,.9,.2,1);}",
    ".ssc-cutscene-flip[data-flipped='1']{transform:rotateY(180deg);}",
    ".ssc-cutscene-face{position:absolute;inset:0;width:100%;height:100%;",
    "  backface-visibility:hidden;-webkit-backface-visibility:hidden;}",
    ".ssc-cutscene-face .ssc-fc-wrap{width:100%;height:100%;}",
    ".ssc-cutscene-face--front{transform:rotateY(180deg);}",

    /* --- particles --- */
    ".ssc-cutscene-particles{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;}",

    /* --- small screens --- */
    "@media (max-width:720px){",
    "  .ssc-cutscene-lane{height:250px;}",
    "  .ssc-cutscene-track{top:16px;gap:14px;}",
    "  .ssc-cutscene-reel-item{flex-basis:clamp(138px,42vw,160px);height:218px;}",
    "  .ssc-cutscene-marker{top:16px;height:218px;}",
    "  .ssc-cutscene-result{min-height:360px;}",
    "}",
    "@media not all{" /* was prefers-reduced-motion: cutscenes always play in full */,
    "  .ssc-cutscene-overlay{transition:none;}",
    "  .ssc-cutscene-pull[data-run='1'],.ssc-cutscene-rays,.ssc-cutscene-flash[data-go='1'],",
    "  .ssc-cutscene-lane[data-pause='1'] .ssc-cutscene-reel-item.is-center{animation:none;}",
    "}",
  ].join("\n");

  /* ---------- DOM helpers ---------- */

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
    if (shadow.querySelector("style[data-ssc-cutscene]")) return;
    var style = document.createElement("style");
    style.setAttribute("data-ssc-cutscene", "1");
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

  /* ---------- cards ---------- */

  /**
   * fifa-card.js is loaded before this file, but a cutscene that hard-fails
   * because one script did not load is worse than a plain card.
   */
  function cardModule() {
    return window.sscFifaCard || null;
  }

  function buildBackCard(tierId, label, fill) {
    var card = cardModule();
    if (card) return card.buildBack({ fill: fill !== false, label: label, tier: tierId });

    var wrap = h("div", "ssc-fc-wrap");
    var back = h("div", "ssc-fc ssc-fc--back ssc-fc--fill");
    if (tierId) back.classList.add("tier-" + tierId);
    back.appendChild(h("div", "ssc-fc-back-mark", "?"));
    wrap.appendChild(back);
    return { node: wrap, card: back };
  }

  function buildFrontCard(grade) {
    var card = cardModule();
    if (card) {
      // reveal:true logs the data the final card was actually built from, so a
      // wrong card can be traced to its source (Bug 10).
      return card.build(grade, {
        fill: true,
        animateShine: false,
        enter: false,
        reveal: true,
      });
    }

    // Degraded path, only when fifa-card.js did not load. It still obeys
    // Bug 9: the big number is the percentage, the /20 is the small line.
    var wrap = h("div", "ssc-fc-wrap");
    var front = h("div", "ssc-fc ssc-fc--fill tier-gold");
    front.appendChild(h("div", "ssc-fc-name", grade.vak || "Cijfer"));
    var percentText =
      typeof grade.percentage === "number" && isFinite(grade.percentage)
        ? String(Math.round(grade.percentage))
        : "–";
    var num = h("div", "ssc-fc-num", percentText);
    front.appendChild(num);
    var sub = null;
    if (grade.op20 !== null && grade.op20 !== undefined) {
      sub = h("div", "ssc-fc-sub", fmt1(grade.op20) + " / 20");
      front.appendChild(sub);
    }
    wrap.appendChild(front);
    return {
      node: wrap,
      card: front,
      numNode: sub,
      ratingText: grade.op20 === null ? "–" : fmt1(grade.op20),
      percentNode: num,
      percentText: percentText,
    };
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

  /* ---------- audio ---------- */

  function assetUrl(name) {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
        return chrome.runtime.getURL("assets/audio/" + name);
      }
    } catch (e) {
      /* Extension context invalidated. */
    }
    return null;
  }

  /**
   * ONE AudioContext for the whole page.
   *
   * An AudioContext created without a user gesture starts suspended, and a
   * context that was resumed stays resumed. Creating a fresh one per cutscene
   * would therefore make the first (click-gated) one audible and every
   * queued one silent. This is the shared context the gate unlocks.
   */
  var sharedAudio = null;

  function unlockAudio() {
    try {
      sharedAudio = sharedAudio || new AudioContext();
      return sharedAudio.resume().catch(function () {});
    } catch (e) {
      return Promise.resolve();
    }
  }

  // Decoded buffers are large and immutable; re-decoding them before every
  // cutscene in a queue would stall the start of each one.
  var sharedBuffers = {};

  function createAudio() {
    var context = null;
    var buffers = sharedBuffers;
    var sources = [];
    var preparing = null;

    function prepare() {
      if (preparing) return preparing;
      preparing = (function () {
        try {
          sharedAudio = sharedAudio || new AudioContext();
          context = sharedAudio;
        } catch (e) {
          return Promise.resolve();
        }
        var names = ["case-opening.mp3", "high-grade-accent.mp3"];
        return Promise.all(
          names.map(function (name) {
            if (buffers[name]) return Promise.resolve();
            var url = assetUrl(name);
            if (!url) return Promise.resolve();
            return fetch(url)
              .then(function (r) {
                if (!r.ok) throw new Error("audio " + r.status);
                return r.arrayBuffer();
              })
              .then(function (data) {
                return context.decodeAudioData(data);
              })
              .then(function (buffer) {
                buffers[name] = buffer;
              })
              .catch(function () {
                /* The cutscene runs silent. */
              });
          })
        );
      })();
      return preparing;
    }

    function unlock() {
      return unlockAudio().then(function () {
        context = sharedAudio || null;
      });
    }

    function play(name, volume, when, duration, offset, fade) {
      var buffer = buffers[name];
      if (!buffer || !context) return false;
      var source = context.createBufferSource();
      var gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = volume * (name === "high-grade-accent.mp3" ? 0.08 : 1);
      source.connect(gain);
      gain.connect(context.destination);

      var startAt = when === undefined ? context.currentTime : when;
      if (duration && fade) {
        gain.gain.setValueAtTime(gain.gain.value, startAt + duration - fade);
        gain.gain.linearRampToValueAtTime(0, startAt + duration);
      }
      source.start(startAt, offset || 0, duration);
      source.onended = function () {
        try {
          source.disconnect();
          gain.disconnect();
        } catch (e) {
          /* already detached */
        }
        sources = sources.filter(function (s) {
          return s !== source;
        });
      };
      sources.push(source);
      return true;
    }

    /**
     * Schedules the recording around the reel. `leadMs` is the pull-through,
     * so the audio clock and the reel clock start from the same instant.
     */
    function start(plan, volume, leadMs) {
      if (!context) return Promise.resolve(null);
      return prepare().then(function () {
        if (!context || context.state === "suspended" || context.state === "closed") {
          return null;
        }
        if (!buffers["case-opening.mp3"]) return null;

        var beginning = context.currentTime + 0.06;

        // 1. The mixed recording, underneath the whole spin.
        play("case-opening.mp3", volume, beginning, ORIGINAL_SPIN_MS / 1000, 0, 0.02);

        // 2. Clicks for every pack crossing after the recording hands over.
        for (var i = 0; i < plan.ticks.length; i++) {
          var ms = plan.ticks[i];
          if (ms < ORIGINAL_SPIN_MS) continue;
          play(
            "case-opening.mp3",
            volume,
            beginning + (leadMs + ms) / 1000,
            ORIGINAL_TICK_DURATION,
            ORIGINAL_TICK_OFFSET,
            0.025
          );
        }

        // 3. The release tail, at the reveal.
        play(
          "case-opening.mp3",
          volume,
          beginning + (leadMs + plan.revealMs) / 1000,
          undefined,
          ORIGINAL_REVEAL_OFFSET
        );

        var latency = context.outputLatency || context.baseLatency || 0;
        var elapsed = 0;

        return function () {
          // Follow the audible output clock so the reel cannot drift from the
          // sound, and never rewind when the estimate improves.
          var output = context.getOutputTimestamp ? context.getOutputTimestamp() : null;
          var age =
            output && typeof output.performanceTime === "number"
              ? (performance.now() - output.performanceTime) / 1000
              : Infinity;
          var audible =
            output &&
            typeof output.contextTime === "number" &&
            output.contextTime > 0 &&
            age >= 0 &&
            age < 0.15 &&
            context.state === "running"
              ? Math.min(context.currentTime, output.contextTime + age)
              : context.currentTime - latency;
          elapsed = Math.max(elapsed, (audible - beginning) * 1000);
          return elapsed;
        };
      });
    }

    function accent(volume, long) {
      play("high-grade-accent.mp3", volume, undefined, long ? 6 : 3.5);
    }

    function pause() {
      if (context) context.suspend().catch(function () {});
    }

    function resume() {
      if (context && context.state === "suspended") context.resume().catch(function () {});
    }

    function stop() {
      for (var i = 0; i < sources.length; i++) {
        try {
          sources[i].stop();
        } catch (e) {
          /* already ended */
        }
      }
      sources = [];
    }

    return {
      prepare: prepare,
      unlock: unlock,
      play: play,
      start: start,
      accent: accent,
      pause: pause,
      resume: resume,
      stop: stop,
    };
  }

  /* ---------- particles ---------- */

  function burst(canvas, color, count) {
    var ctx = null;
    try {
      ctx = canvas.getContext("2d");
    } catch (e) {
      return null;
    }
    if (!ctx) return null;

    // A canvas with no intrinsic size reports its backing store (200x150),
    // not its CSS box, so measure the box explicitly.
    var rect = canvas.getBoundingClientRect();
    var w = Math.round(rect.width) || canvas.clientWidth;
    var hgt = Math.round(rect.height) || canvas.clientHeight;
    if (!w || !hgt) return null;

    var dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = hgt * dpr;
    ctx.scale(dpr, dpr);

    var points = [];
    for (var i = 0; i < count; i++) {
      var angle = (i / count) * Math.PI * 2;
      points.push({
        dx: Math.cos(angle) * (90 + Math.random() * 240),
        dy: Math.sin(angle) * (80 + Math.random() * 190),
        size: 1 + Math.random() * 2,
      });
    }

    var start = performance.now();
    var frame = 0;

    function draw() {
      var t = (performance.now() - start) / 1600;
      ctx.clearRect(0, 0, w, hgt);
      if (t >= 1) return;

      ctx.fillStyle = color;
      ctx.globalAlpha = Math.pow(1 - t, 2);

      for (var p = 0; p < points.length; p++) {
        var point = points[p];
        var x = w / 2 + point.dx * (0.5 + t);
        var y = hgt / 2 + point.dy * (0.5 + t) + 70 * t * t;
        if (Math.abs(x - w / 2) < 96 && Math.abs(y - hgt / 2) < 150) continue;
        ctx.fillRect(x, y, point.size, point.size * 2);
      }
      frame = requestAnimationFrame(draw);
    }

    draw();
    return function () {
      cancelAnimationFrame(frame);
    };
  }

  /* ---------- light streaks ---------- */

  /**
   * Radial lines rushing outward from the centre. They peak during the
   * pull-through and fade as the reel takes over, so the two never compete.
   */
  function streaks(canvas, totalMs) {
    var ctx = null;
    try {
      ctx = canvas.getContext("2d");
    } catch (e) {
      return null;
    }
    if (!ctx) return null;

    var rect = canvas.getBoundingClientRect();
    var w = Math.round(rect.width) || canvas.clientWidth;
    var hgt = Math.round(rect.height) || canvas.clientHeight;
    if (!w || !hgt) return null;

    var dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = hgt * dpr;
    ctx.scale(dpr, dpr);

    var cx = w / 2;
    var cy = hgt * 0.46;
    var reach = Math.hypot(cx, cy);
    var lines = [];

    for (var i = 0; i < 46; i++) {
      lines.push({
        angle: Math.random() * Math.PI * 2,
        from: Math.random() * 0.5,
        // The streaks lengthen as they travel, like a real speed blur.
        speed: 0.5 + Math.random() * 1.4,
        width: 0.7 + Math.random() * 1.6,
        alpha: 0.18 + Math.random() * 0.42,
      });
    }

    var start = performance.now();
    var frame = 0;

    function draw() {
      var t = (performance.now() - start) / totalMs;
      ctx.clearRect(0, 0, w, hgt);
      if (t >= 1) return;

      // Ramp up over the first 260ms, then fall away.
      var power = t < 0.29 ? t / 0.29 : Math.pow(1 - (t - 0.29) / 0.71, 1.6);
      ctx.lineCap = "round";

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var travel = (t * line.speed) % 1;
        var near = reach * (0.12 + travel * 0.95);
        var far = near + reach * (0.06 + travel * 0.2);
        if (far <= near) continue;

        var cos = Math.cos(line.angle);
        var sin = Math.sin(line.angle);

        ctx.beginPath();
        ctx.moveTo(cx + cos * near, cy + sin * near);
        ctx.lineTo(cx + cos * far, cy + sin * far);
        ctx.lineWidth = line.width;
        ctx.strokeStyle = "rgba(198,222,255," + (line.alpha * power).toFixed(3) + ")";
        ctx.stroke();
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

  /**
   * The tunnel cutscene (tunnel.js) has its own overlay and its own state, so
   * it counts here through a shared counter rather than through `active`.
   * Without it, a click during a walkout would stack the reel on top.
   */
  var externalActive = 0;

  function busy() {
    return !!active || externalActive > 0;
  }

  function setExternalActive(on) {
    externalActive += on ? 1 : -1;
    if (externalActive < 0) externalActive = 0;
  }

  function playReel(options) {
    var opts = options || {};
    var value = Number(opts.grade);

    if (!isFinite(value) || value < 0) {
      if (opts.onClose) opts.onClose();
      return;
    }
    if (busy()) {
      // One at a time. The callback still fires, or a caller that was waiting
      // on it (the queue) would stall on a request we silently dropped.
      if (opts.onClose) opts.onClose();
      return;
    }

    var live = getLive();
    if (!live) {
      if (opts.onClose) opts.onClose();
      return;
    }

    ensureStyle(live.shadow);
    if (cardModule() && cardModule().ensureStyles) cardModule().ensureStyles(live.shadow);

    var reduced = prefersReduced();

    // /20 is the number; the percentage decides the tier. Derive it when the
    // caller only has a /20 value.
    var percent =
      typeof opts.percent === "number" && isFinite(opts.percent)
        ? opts.percent
        : (value / 20) * 100;
    var tierId = tierIdForPercent(percent);
    var glow = tierGlowForPercent(percent);
    var valueText = fmt1(value);

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

    var overlay = h("div", "ssc-cutscene-overlay");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Cijfer onthullen");
    overlay.tabIndex = -1;
    overlay.style.setProperty("--sc-rays", glow + "a6");

    var mainEl = h("div", "ssc-cutscene-main");
    var footerEl = h("footer", "ssc-cutscene-footer");

    var header = h("header", "ssc-cutscene-header");
    header.appendChild(h("div", "ssc-cutscene-brand", "Cijfer openen"));
    var counter = null;
    if (opts.total > 1 && opts.index >= 1) {
      counter = h("span", "ssc-cutscene-count", opts.index + " / " + opts.total);
      header.appendChild(counter);
    } else {
      header.appendChild(h("span", "ssc-cutscene-count", "SMARTSCHOOL COMBINED"));
    }

    overlay.appendChild(header);
    overlay.appendChild(mainEl);
    overlay.appendChild(footerEl);

    // The theme's own photograph (or its gradient) behind the whole reel.
    if (typeof window.sscCutsceneBackdrop === "function") {
      var reelTotalMs =
        PULL_MS + ORIGINAL_SPIN_MS + PAUSE_MS + FLIP_MS + COUNT_MS;
      window.sscCutsceneBackdrop(live.shadow, overlay, {
        totalMs: reelTotalMs,
        reduced: reduced,
      });
    }

    var state = {
      phase: "pull",
      plan: null,
      frame: 0,
      timer: null,
      cleanupBurst: null,
      cleanupStreaks: null,
      finished: false,
      overlay: overlay,
      main: mainEl,
      footer: footerEl,
      track: null,
      lane: null,
      cardWidth: 0,
      gap: 0,
      laneWidth: 0,
      lastCenter: -1,
    };

    active = state;

    var previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    /* --- phase 1 + 2: pull-through, then the reel --- */

    function renderReel() {
      mainEl.textContent = "";

      var stage = h("section", "ssc-cutscene-stage");

      var context = h("div", "ssc-cutscene-spin-context");
      if (opts.vak) context.appendChild(h("h1", null, opts.vak));
      if (opts.titel) context.appendChild(h("p", null, opts.titel));
      stage.appendChild(context);

      var lane = h("div", "ssc-cutscene-lane");
      lane.appendChild(h("div", "ssc-cutscene-marker"));

      var track = h("div", "ssc-cutscene-track");
      var plan = state.plan;
      var backLabel = opts.vak || "Cijfer";

      for (var i = 0; i < plan.grades.length; i++) {
        var item = h("div", "ssc-cutscene-reel-item");
        item.setAttribute("data-index", String(i));

        // Sealed packs, tinted by the value behind them: a bronze pack flying
        // past still tells the eye this one was low, without showing a grade.
        var decoyPercent =
          i === plan.targetIndex ? percent : (parseFloat(plan.grades[i].replace(",", ".")) / 20) * 100;
        var card = buildBackCard(tierIdForPercent(decoyPercent), backLabel);
        item.appendChild(card.node);
        track.appendChild(item);
      }

      lane.appendChild(track);
      stage.appendChild(lane);
      mainEl.appendChild(stage);

      state.lane = lane;
      state.track = track;

      footerEl.textContent = "";
      footerEl.appendChild(h("p", null, "Escape om te versnellen"));

      // Layout, then measure. At progress 0 the track is stationary.
      measure();
      paint(0);

      var center = track.children[plan.initialIndex];
      if (center) center.classList.add("is-center");
      state.lastCenter = plan.initialIndex;
    }

    function measure() {
      if (!state.track) return;
      var first = state.track.firstElementChild;
      if (!first) return;
      state.cardWidth = parseFloat(getComputedStyle(first).width) || 0;
      state.gap = parseFloat(getComputedStyle(state.track).columnGap) || 0;
      state.laneWidth = state.lane ? state.lane.clientWidth : 0;
    }

    function paint(progress) {
      if (!state.track || !state.cardWidth) return;
      var pitch = state.cardWidth + state.gap;
      var position = state.plan.initialIndex + progress;

      state.track.style.transform =
        "translate3d(" +
        (state.laneWidth / 2 - position * pitch - state.cardWidth / 2) +
        "px,0,0)";

      // Motion blur from the reel's speed: cards per second -> px of blur,
      // capped so a card never smears past legibility while it slows down.
      var now = performance.now();
      if (state.lastPaint) {
        var dt = Math.max(1, now - state.lastPaint.t);
        var speed = Math.abs(position - state.lastPaint.p) / dt; // cards per ms
        var blur = Math.min(5, speed * pitch * 0.55);
        state.track.style.setProperty("--ssc-reel-blur", blur < 0.3 ? "0px" : blur.toFixed(2) + "px");
      }
      state.lastPaint = { t: now, p: position };

      var center = Math.round(position);
      if (center !== state.lastCenter) {
        var previous = state.track.querySelector(".ssc-cutscene-reel-item.is-center");
        if (previous) previous.classList.remove("is-center");

        var next = state.track.children[center];
        if (next) next.classList.add("is-center");
        state.lastCenter = center;
      }
    }

    function startReel() {
      if (state.phase !== "starting" && state.phase !== "pull") return;
      state.phase = "mystery";

      // Render first, then wait on the buffers. The reel is motionless until
      // plan.startMs (447ms) anyway, so a slow decode is invisible — whereas
      // an empty stage while we await it would read as a dropped frame.
      renderReel();

      var plan = state.plan;
      audio.start(plan, VOLUME, 0).then(function (audioClock) {
        if (!active || active !== state) {
          audio.stop();
          return;
        }

        // Time 0 is the moment the reel starts; the recording is scheduled
        // from that same instant, so no offset is needed here.
        var beginning = performance.now();
        var pausedAt = document.hidden ? beginning : null;
        var pausedDuration = 0;

        function visualClock() {
          var now = performance.now();
          var effective = pausedAt !== null ? pausedAt : now;
          return Math.max(0, effective - beginning - pausedDuration);
        }

        var clock = audioClock || visualClock;

        function onVisibility() {
          if (document.hidden) {
            if (pausedAt === null) pausedAt = performance.now();
            audio.pause();
          } else if (pausedAt !== null) {
            pausedDuration += performance.now() - pausedAt;
            pausedAt = null;
            audio.resume();
          }
        }
        document.addEventListener("visibilitychange", onVisibility);
        state.visibility = onVisibility;

        if (document.hidden) audio.pause();

        function tick() {
          if (!active || active !== state) return;
          if (state.phase !== "mystery" && state.phase !== "stopped") return;

          var elapsed = clock();
          paint(reelProgress(elapsed, plan));

          if (elapsed >= plan.stopMs && state.phase === "mystery") {
            state.phase = "stopped";
            if (state.lane) {
              state.lane.classList.add("ssc-cutscene-stopped");
              state.lane.setAttribute("data-pause", "1");
            }
            // The dramatic pause is a real hold, not a slow reveal: nothing
            // moves for PAUSE_MS, then the flip happens in one gesture.
            state.timer = window.setTimeout(function () {
              if (active === state) reveal();
            }, PAUSE_MS);
            return;
          }
          state.frame = requestAnimationFrame(tick);
        }
        state.frame = requestAnimationFrame(tick);
      });
    }

    /* --- phase 3: the flip and the card --- */

    function reveal() {
      state.phase = "flip";
      state.finished = true;
      if (opts.onComplete) opts.onComplete();

      // Escape during the pull-through arrives here with the pull card still
      // mounted on top of the stage.
      var stalledPull = overlay.querySelector(".ssc-cutscene-pull");
      if (stalledPull && stalledPull.parentNode) stalledPull.parentNode.removeChild(stalledPull);

      mainEl.textContent = "";

      var result = h("div", "ssc-cutscene-result");

      var rays = h("div", "ssc-cutscene-rays");
      var raysFx = h("div", "ssc-cutscene-fx");
      raysFx.setAttribute("aria-hidden", "true");
      raysFx.appendChild(rays);
      // In the stage, not the result: the result's perspective would make it
      // the fixed layers' containing block and clip them again.
      if (!reduced) mainEl.appendChild(raysFx);

      var canvas = null;
      if (!reduced) {
        var sparksFx = h("div", "ssc-cutscene-fx ssc-cutscene-fx--front");
        sparksFx.setAttribute("aria-hidden", "true");
        canvas = h("canvas", "ssc-cutscene-particles");
        sparksFx.appendChild(canvas);
        mainEl.appendChild(sparksFx);
      }

      var flip = h("div", "ssc-cutscene-flip");
      var backFace = h("div", "ssc-cutscene-face ssc-cutscene-face--back");
      var frontFace = h("div", "ssc-cutscene-face ssc-cutscene-face--front");

      backFace.appendChild(buildBackCard(tierId, opts.vak || "Cijfer").node);

      var front = buildFrontCard(grade);
      frontFace.appendChild(front.node);

      flip.appendChild(backFace);
      flip.appendChild(frontFace);
      result.appendChild(flip);

      var flash = h("div", "ssc-cutscene-flash");
      mainEl.appendChild(flash);

      mainEl.appendChild(result);

      // The rays turn round the card, wherever the stage put it.
      var flipRect = flip.getBoundingClientRect();
      if (flipRect.width) {
        raysFx.style.setProperty("--cx", Math.round(flipRect.left + flipRect.width / 2) + "px");
        raysFx.style.setProperty("--cy", Math.round(flipRect.top + flipRect.height / 2) + "px");
      }

      footerEl.textContent = "";
      var actions = h("div", "ssc-cutscene-actions");
      var hasQueue = !!opts.hasNext;
      var primary = h("button", "ssc-cutscene-primary", hasQueue ? "Volgende" : "Terug naar Smartschool");
      primary.type = "button";
      primary.addEventListener("click", close);
      actions.appendChild(primary);
      if (opts.onStop) {
        var stopBtn = h("button", "ssc-cutscene-secondary", "Stop de reeks");
        stopBtn.type = "button";
        stopBtn.addEventListener("click", function () {
          if (opts.onStop) opts.onStop();
          close();
        });
        actions.appendChild(stopBtn);
      }
      // Queue only: mark this grade and all remaining ones as seen, close.
      if (typeof opts.onSkipAll === "function") {
        var skipAllBtn = h("button", "ssc-cutscene-secondary", "Skip alles");
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

      function afterFlip() {
        if (!active || active !== state) return;
        state.phase = "result";

        if (!reduced) {
          rays.setAttribute("data-on", "1");
          flash.setAttribute("data-go", "1");
        }

        var shine = front.card ? front.card.querySelector(".ssc-fc-shine") : null;
        if (shine && !reduced) shine.setAttribute("data-on", "1");

        // Bug 9: the big number is the percentage. fifa-card.js exposes it as
        // percentNode; numNode is the small "/20" line and is already final.
        var counter = front.percentNode || front.numNode;
        var counterText =
          front.percentText !== undefined ? front.percentText : front.ratingText;
        if (counter && cardModule() && cardModule().countUp) {
          // build() seeds the real value so a style without a count-up is
          // never stuck on a placeholder; here we do animate, so start at 0.
          counter.textContent = reduced ? counterText : "0";
          cardModule().countUp(counter, counterText, reduced ? 0 : COUNT_MS);
        } else if (counter) {
          counter.textContent = counterText;
        }

        if (!reduced && canvas) {
          window.requestAnimationFrame(function () {
            if (!canvas.isConnected || !active || active !== state) return;
            if (state.cleanupBurst) state.cleanupBurst();
            var count =
              tierId === "icon" ? 90 : tierId === "gold" ? 56 : tierId === "silver" ? 32 : 20;
            state.cleanupBurst = burst(canvas, glow, count);
          });
        }

        if (tierId === "icon") audio.accent(VOLUME, true);

        state.timer = window.setTimeout(function () {
          if (active === state) actions.setAttribute("data-on", "1");
        }, reduced ? 0 : COUNT_MS);
      }

      if (reduced) {
        flip.setAttribute("data-flipped", "1");
        afterFlip();
        return;
      }

      // Two frames: one to lay out the back, one so the transition has a
      // from-value to animate out of.
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          if (!active || active !== state) return;
          flip.setAttribute("data-flipped", "1");
          window.setTimeout(afterFlip, FLIP_MS);
        });
      });
    }

    /* --- skip / close --- */

    function skipToResult() {
      if (state.phase === "pull" || state.phase === "starting") {
        // Nothing rendered yet: jump the reel and open the card immediately.
        cancelAnimationFrame(state.frame);
        if (state.timer) window.clearTimeout(state.timer);
        audio.stop(); // reveal() fires onComplete
        reveal();
        return true;
      }
      if (state.phase === "mystery" || state.phase === "stopped") {
        cancelAnimationFrame(state.frame);
        if (state.timer) window.clearTimeout(state.timer);
        audio.stop();
        reveal();
        return true;
      }
      return false;
    }

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        // Escape skips the reel; a second Escape closes the result and lets
        // the queue continue with the next grade.
        if (!skipToResult()) close();
        return;
      }
      if (e.key === "Enter" && state.phase === "result" && e.target === overlay) {
        e.preventDefault();
        close();
      }
    }

    function close() {
      if (!active || active !== state) return;

      cancelAnimationFrame(state.frame);
      if (state.timer) window.clearTimeout(state.timer);
      if (state.visibility) document.removeEventListener("visibilitychange", state.visibility);
      if (state.cleanupBurst) state.cleanupBurst();
      if (state.cleanupStreaks) state.cleanupStreaks();

      audio.stop();
      document.documentElement.style.overflow = previousOverflow;

      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);

      active = null;
      if (opts.onClose) opts.onClose();
    }

    overlay.addEventListener("keydown", onKey);
    live.layer.appendChild(overlay);

    /* --- open --- */

    var soundOn = opts.sound !== false;
    if (soundOn) audio.unlock();
    audio.prepare();

    state.plan = createSpinPlan(Math.random);

    // The streak canvas lives above the stage but below the pull card, so the
    // whole first second reads as one gesture.
    if (!reduced) {
      var streakCanvas = h("canvas", "ssc-cutscene-streaks");
      streakCanvas.setAttribute("aria-hidden", "true");
      overlay.insertBefore(streakCanvas, mainEl);
      window.requestAnimationFrame(function () {
        state.cleanupStreaks = streaks(streakCanvas, PULL_MS + 1400);
      });
    }

    // Not `fill`: the pull-through card must keep its own 5/7 size, since its
    // parent is a full-viewport grid rather than a fixed box.
    var pullCard = h("div", "ssc-cutscene-pull");
    pullCard.appendChild(buildBackCard(tierId, opts.vak || "Cijfer", false).node);
    overlay.appendChild(pullCard);

    overlay.focus();

    window.requestAnimationFrame(function () {
      overlay.setAttribute("data-in", "1");
      if (!reduced) pullCard.setAttribute("data-run", "1");
    });

    state.timer = window.setTimeout(function () {
      if (!active || active !== state) return;
      if (pullCard.parentNode) pullCard.parentNode.removeChild(pullCard);
      state.phase = "starting";
      startReel();
      // Reveal the reel under the fading pull card.
      state.timer = window.setTimeout(function () {
        var canvas = overlay.querySelector(".ssc-cutscene-streaks");
        if (canvas) canvas.setAttribute("data-off", "1");
      }, 500);
    }, reduced ? 60 : PULL_MS);
  }

  /* ---------- style dispatch ---------- */

  /**
   * The chosen style is cached rather than fetched per play: a click handler
   * that awaits chrome.storage would lose its user gesture, and the audio
   * context unlock rides on that gesture.
   */
  var stylePref = "reel";

  function rememberStyle(settings) {
    if (!settings) return;
    stylePref = settings.cutsceneStyle === "tunnel" ? "tunnel" : "reel";
  }

  if (typeof window.sscGet === "function") {
    window.sscGet().then(rememberStyle, function () {});
    if (typeof window.sscOnChange === "function") window.sscOnChange(rememberStyle);
  }

  /**
   * One entry point, two styles. Callers (the auto-play queue, the replay on
   * un-ticking, and click-per-grade) stay unaware of which one runs; both take
   * the same options object and honour the same callbacks.
   */
  function sscPlayCutscene(options) {
    var opts = options || {};
    // Bug 6: a cutscene is a surface of its own. Nothing else may be open
    // behind it.
    if (typeof window.sscCloseSurfaces === "function") window.sscCloseSurfaces();
    if (stylePref === "tunnel" && typeof window.sscPlayCutsceneTunnel === "function") {
      window.sscPlayCutsceneTunnel(opts);
      return;
    }
    playReel(opts);
  }

  /* ---------- grade parsing for page clicks ---------- */

  /**
   * The results page gives us DOM, not API objects. Only unambiguous forms
   * are converted: "15/20", "79%". Anything else returns null.
   */
  function sscGradeFromElement(el) {
    if (!el) return null;
    var text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return null;

    var fraction = /(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/.exec(text);
    if (fraction) {
      var achieved = parseFloat(fraction[1].replace(",", "."));
      var total = parseFloat(fraction[2].replace(",", "."));
      if (isFinite(achieved) && isFinite(total) && total > 0) {
        return Math.round((achieved / total) * 20 * 10) / 10;
      }
    }

    var percent = /(\d+(?:[.,]\d+)?)\s*%/.exec(text);
    if (percent) {
      var pct = parseFloat(percent[1].replace(",", "."));
      if (isFinite(pct)) return Math.round((pct / 100) * 20 * 10) / 10;
    }

    return null;
  }

  function sscGradeToTwenty(achieved, total) {
    var a = Number(achieved);
    var t = Number(total);
    if (!isFinite(a) || !isFinite(t) || t <= 0) return null;
    return Math.round((a / t) * 20 * 10) / 10;
  }

  function sscSubjectFromElement(el) {
    if (!el || !el.closest) return "";
    var row = el.closest("tr, li, .evaluation, .result-row") || el.parentElement;
    if (!row) return "";

    var candidates = row.querySelectorAll("h1, h2, h3, h4, strong, .course, .vak");
    for (var i = 0; i < candidates.length; i++) {
      var text = (candidates[i].textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 80) continue;
      if (candidates[i].contains(el)) continue;
      if (/^\d+([.,]\d+)?\s*(\/|%)/.test(text)) continue;
      return text;
    }
    return "";
  }

  window.sscPlayCutscene = sscPlayCutscene;
  window.sscGradeFromElement = sscGradeFromElement;
  window.sscGradeToTwenty = sscGradeToTwenty;
  window.sscSubjectFromElement = sscSubjectFromElement;
  window.sscCutsceneBusy = busy;
  window.sscSetCutsceneActive = setExternalActive;
  /** Called from a real click, once per page, when sound is enabled. */
  window.sscUnlockAudio = unlockAudio;
  /** The shared AudioContext bridge, for tunnel.js. */
  window.sscCreateCutsceneAudio = createAudio;

  /**
   * Decode the cutscene audio BEFORE the first card (Bug 11, part B). Called
   * while the Resultaten loader is still up, so the first cutscene starts on
   * time instead of after a fetch+decode stall. Best-effort by design: a
   * browser that refuses to create an AudioContext yet simply leaves the
   * buffers empty, and the cutscene runs silent — never blocked.
   */
  window.sscPreloadAudio = function () {
    try {
      var audio = createAudio();
      if (audio && typeof audio.prepare === "function") return audio.prepare();
    } catch (e) {
      /* Silent cutscene. */
    }
    return Promise.resolve();
  };
})();
