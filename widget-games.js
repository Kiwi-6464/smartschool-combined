/**
 * Smartschool Combined — mini-games for the start-page widgets.
 *
 *   snake  canvas Snake on a 16×16 board, smooth (interpolated) movement,
 *          arrows / WASD / swipe, speeds up as it grows
 *   2048   the sliding-tile puzzle, DOM tiles with slide/merge animations;
 *          the board survives a reload
 *
 * Both are rendered by widgets.js into a widget card through
 * window.sscWidgetGames[name](body, api). The api gives them the shared
 * widget storage (chrome.storage.local, key sscWidgetData) for high scores
 * and a place to register their cleanup.
 *
 * Pausing: a game is frozen while its card is being dragged, sits in the
 * widget bag, the page is in widget edit mode, or the tab is hidden. Snake
 * stops its clock and shows "Gepauzeerd"; when the card is back in the grid
 * it counts 3-2-1 and carries on. Keys are only taken while the board has
 * focus, so the arrows never scroll the page out from under the player.
 *
 * Loaded lazily with the widgets (lazy.js), into the same isolated world.
 */
(function () {
  "use strict";

  if (window.sscSkipPage) return;
  if (window.sscWidgetGames) return;

  function h(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  /** True while the card must not run: dragged, in the bag, edit mode, hidden tab. */
  function frozen(node) {
    if (!node || !node.isConnected || document.hidden) return true;
    if (document.body && document.body.classList.contains("ssc-widget-edit-mode")) return true;
    return !!node.closest(".ssc-widget-dragging, .ssc-widget-preview, .ssc-widget-bag");
  }

  var KEY_DIR = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
    W: [0, -1], S: [0, 1], A: [-1, 0], D: [1, 0],
  };

  /** Swipe on a touch screen or with a pen: calls back with [dx, dy] once per gesture. */
  function onSwipe(node, cb) {
    var start = null;
    node.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse") return;
      start = { x: e.clientX, y: e.clientY };
    });
    node.addEventListener("pointerup", function (e) {
      if (!start) return;
      var dx = e.clientX - start.x;
      var dy = e.clientY - start.y;
      start = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      cb(Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1]);
    });
  }

  function statBox(label) {
    var box = h("div", "ssc-gm-stat");
    box.appendChild(h("span", "ssc-gm-stat-label", label));
    var value = h("b", "ssc-gm-stat-value", "0");
    box.appendChild(value);
    return { node: box, value: value };
  }

  var SVG_NS = "http://www.w3.org/2000/svg";
  function glyph(d) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
    return svg;
  }
  var PATH_PLAY = "M8 5.5v13l10.5-6.5z";
  var PATH_PAUSE = "M7 5h3.6v14H7zM13.4 5H17v14h-3.6z";
  var PATH_RESTART = "M12 5a7 7 0 1 1-6.6 4.7l1.9.6A5 5 0 1 0 12 7v3L7.5 6 12 2z";

  function iconButton(path, label) {
    var b = h("button", "ssc-gm-btn");
    b.type = "button";
    b.title = label;
    b.setAttribute("aria-label", label);
    b.appendChild(glyph(path));
    return b;
  }

  function setGlyph(button, path) {
    button.textContent = "";
    button.appendChild(glyph(path));
  }

  /* ================================================================ */
  /* Snake                                                             */
  /* ================================================================ */

  var SNAKE_N = 16;

  /*
   * Coins: played inside the Hub, both games pay into the arcade balance as you
   * go (window.sscHubEconomy), so stopping early keeps what you earned.
   *   Snake  1 coin per point, +1 per point for every 5 points already scored.
   *   2048   1 coin per 20 points, +1 per 20 for every 4000 points already scored.
   */
  function pay(n) {
    var eco = window.sscHubEconomy;
    if (eco && n > 0) eco.give(n);
  }

  function snake(body, api) {
    var best = Number((api.get("snake", {}) || {}).best) || 0;

    var hud = h("div", "ssc-gm-hud");
    var scoreBox = statBox("Score");
    var bestBox = statBox("Record");
    bestBox.value.textContent = String(best);
    var coinBox = statBox("Munten");
    var earned = 0;
    hud.appendChild(scoreBox.node);
    hud.appendChild(bestBox.node);
    hud.appendChild(coinBox.node);
    var spacer = h("span", "ssc-gm-spacer");
    hud.appendChild(spacer);
    var playBtn = iconButton(PATH_PLAY, "Start / pauze");
    hud.appendChild(playBtn);
    body.appendChild(hud);

    var stage = h("div", "ssc-gm-stage ssc-gm-stage--snake");
    stage.tabIndex = 0;
    stage.setAttribute("role", "application");
    stage.setAttribute("aria-label", "Snake. Pijltjes of WASD om te sturen, spatie om te pauzeren.");
    var canvas = h("canvas", "ssc-gm-canvas");
    stage.appendChild(canvas);
    var veil = h("div", "ssc-gm-veil");
    var veilTitle = h("div", "ssc-gm-veil-title", "Snake");
    var veilSub = h("div", "ssc-gm-veil-sub", "Klik en gebruik de pijltjes");
    veil.appendChild(veilTitle);
    veil.appendChild(veilSub);
    stage.appendChild(veil);
    body.appendChild(stage);

    var ctx = canvas.getContext("2d");
    var state = "ready"; // ready | run | paused | frozen | count | over
    var snakeCells, prevCells, dir, queued, food, score, stepMs, lastStep, timer = 0, frame = 0, countLeft = 0;
    var size = 0;
    var dpr = 1;

    function reset() {
      var mid = Math.floor(SNAKE_N / 2);
      snakeCells = [[mid, mid], [mid - 1, mid], [mid - 2, mid]];
      prevCells = snakeCells.map(function (c) { return c.slice(); });
      dir = [1, 0];
      queued = [];
      score = 0;
      earned = 0;
      coinBox.value.textContent = "+0";
      stepMs = 150;
      scoreBox.value.textContent = "0";
      placeFood();
    }

    function placeFood() {
      var free = [];
      for (var y = 0; y < SNAKE_N; y++) {
        for (var x = 0; x < SNAKE_N; x++) {
          if (!snakeCells.some(function (c) { return c[0] === x && c[1] === y; })) free.push([x, y]);
        }
      }
      food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
    }

    function resize() {
      var w = Math.round(stage.clientWidth);
      if (!w) return false;
      dpr = window.devicePixelRatio || 1;
      if (w === size && canvas.width === Math.round(w * dpr)) return true;
      size = w;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(w * dpr);
      return true;
    }

    function css(name, fallback) {
      var v = getComputedStyle(stage).getPropertyValue(name).trim();
      return v || fallback;
    }

    function roundRect(x, y, w, hgt, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + hgt, r);
      ctx.arcTo(x + w, y + hgt, x, y + hgt, r);
      ctx.arcTo(x, y + hgt, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function draw(t) {
      if (!resize()) return;
      var cell = size / SNAKE_N;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      // Board: a faint checker on the stage's own background.
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      for (var y = 0; y < SNAKE_N; y++) {
        for (var x = (y % 2); x < SNAKE_N; x += 2) ctx.fillRect(x * cell, y * cell, cell, cell);
      }

      // Food: a glossy apple with a soft glow.
      if (food) {
        var fx = (food[0] + 0.5) * cell;
        var fy = (food[1] + 0.5) * cell;
        var pulse = 1 + Math.sin(performance.now() / 220) * 0.06;
        ctx.save();
        ctx.shadowColor = "rgba(255,70,90,0.8)";
        ctx.shadowBlur = cell * 0.8;
        var g = ctx.createRadialGradient(fx - cell * 0.12, fy - cell * 0.14, cell * 0.05, fx, fy, cell * 0.42);
        g.addColorStop(0, "#ffd0d6");
        g.addColorStop(0.35, "#ff4d63");
        g.addColorStop(1, "#b0122b");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(fx, fy, cell * 0.36 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#3ba37a";
        ctx.beginPath();
        ctx.ellipse(fx + cell * 0.1, fy - cell * 0.36, cell * 0.12, cell * 0.06, -0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      // The snake: segments eased from their previous cell to the current
      // one, so it glides instead of jumping a cell per tick.
      var accent = css("--ssc-gm-accent", "#3ba37a");
      var n = snakeCells.length;
      for (var i = n - 1; i >= 0; i--) {
        var cur = snakeCells[i];
        var prev = prevCells[i] || cur;
        // No easing across a wrap or on a freshly grown tail.
        var jump = Math.abs(cur[0] - prev[0]) + Math.abs(cur[1] - prev[1]) > 1;
        var px = jump ? cur[0] : prev[0] + (cur[0] - prev[0]) * t;
        var py = jump ? cur[1] : prev[1] + (cur[1] - prev[1]) * t;
        var inset = cell * (0.08 + (i / n) * 0.14);
        ctx.globalAlpha = 1 - (i / n) * 0.35;
        ctx.fillStyle = accent;
        roundRect(px * cell + inset, py * cell + inset, cell - inset * 2, cell - inset * 2, cell * 0.32);
        ctx.fill();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = "#fff";
        roundRect(px * cell + inset + cell * 0.08, py * cell + inset + cell * 0.06, cell - inset * 2 - cell * 0.16, (cell - inset * 2) * 0.32, cell * 0.2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (i === 0) {
          // Eyes, looking where it is going.
          var ex = (px + 0.5) * cell + dir[0] * cell * 0.14;
          var ey = (py + 0.5) * cell + dir[1] * cell * 0.14;
          var ox = dir[1] * cell * 0.17;
          var oy = dir[0] * cell * 0.17;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(ex + ox, ey + oy, cell * 0.11, 0, Math.PI * 2);
          ctx.arc(ex - ox, ey - oy, cell * 0.11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#101418";
          ctx.beginPath();
          ctx.arc(ex + ox + dir[0] * cell * 0.04, ey + oy + dir[1] * cell * 0.04, cell * 0.055, 0, Math.PI * 2);
          ctx.arc(ex - ox + dir[0] * cell * 0.04, ey - oy + dir[1] * cell * 0.04, cell * 0.055, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function showVeil(title, sub) {
      veilTitle.textContent = title;
      veilSub.textContent = sub || "";
      veil.removeAttribute("data-off");
    }

    function hideVeil() {
      veil.setAttribute("data-off", "1");
    }

    function step() {
      if (queued.length) {
        var next = queued.shift();
        if (next[0] !== -dir[0] || next[1] !== -dir[1]) dir = next;
      }
      var head = snakeCells[0];
      var nx = head[0] + dir[0];
      var ny = head[1] + dir[1];
      var old = snakeCells;
      var eating = food && nx === food[0] && ny === food[1];
      var rest = eating ? old : old.slice(0, -1);
      var hitWall = nx < 0 || ny < 0 || nx >= SNAKE_N || ny >= SNAKE_N;
      var hitSelf = rest.some(function (c) { return c[0] === nx && c[1] === ny; });
      if (hitWall || hitSelf) {
        gameOver();
        return;
      }
      snakeCells = [[nx, ny]].concat(rest);
      // Segment i eases from where segment i was to where it is now (the
      // head from the old head); a grown tail appears in place.
      prevCells = old.map(function (c) { return c.slice(); });
      if (eating) {
        prevCells.push(old[old.length - 1].slice());
        score++;
        scoreBox.value.textContent = String(score);
        var coins = 1 + Math.floor((score - 1) / 5);
        earned += coins;
        coinBox.value.textContent = "+" + earned;
        pay(coins);
        stepMs = Math.max(70, 150 - score * 4);
        stage.setAttribute("data-bump", "1");
        api.later(function () {
          stage.removeAttribute("data-bump");
        }, 180);
        placeFood();
      }
    }

    function gameOver() {
      state = "over";
      stopLoop();
      var record = score > best;
      if (record) {
        best = score;
        bestBox.value.textContent = String(best);
        api.patch("snake", { best: best });
      }
      stage.setAttribute("data-dead", "1");
      showVeil(record ? "Nieuw record!" : "Game over", "Score " + score + " · klik om opnieuw te spelen");
      setGlyph(playBtn, PATH_RESTART);
      draw(1);
    }

    function loop(now) {
      frame = 0;
      if (state !== "run") return;
      if (frozen(stage)) {
        freeze();
        return;
      }
      if (!lastStep) lastStep = now;
      // After a stall (a busy page, a throttled window) take one step, not
      // every missed one: replaying them would run the snake into a wall
      // before the player sees a frame.
      if (now - lastStep > stepMs * 3) lastStep = now - stepMs;
      while (now - lastStep >= stepMs && state === "run") {
        lastStep += stepMs;
        step();
      }
      if (state !== "run") return;
      draw(Math.min(1, (now - lastStep) / stepMs));
      frame = window.requestAnimationFrame(loop);
    }

    function startLoop() {
      stopLoop();
      lastStep = 0;
      frame = window.requestAnimationFrame(loop);
    }

    function stopLoop() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    }

    function play() {
      if (state === "over" || state === "ready") {
        reset();
        stage.removeAttribute("data-dead");
      }
      state = "run";
      hideVeil();
      setGlyph(playBtn, PATH_PAUSE);
      startLoop();
    }

    function pause(reason) {
      if (state !== "run" && state !== "count") return;
      state = reason === "frozen" ? "frozen" : "paused";
      stopLoop();
      if (countLeft) countLeft = 0;
      showVeil("Gepauzeerd", reason === "frozen" ? "Gaat verder zodra de widget terug staat" : "Klik of druk op spatie");
      setGlyph(playBtn, PATH_PLAY);
    }

    function freeze() {
      pause("frozen");
    }

    /** After a drag: 3-2-1, then play on. */
    function countdown() {
      state = "count";
      countLeft = 3;
      (function tick() {
        if (state !== "count") return;
        if (frozen(stage)) {
          freeze();
          return;
        }
        if (countLeft === 0) {
          play();
          return;
        }
        showVeil(String(countLeft), "Maak je klaar");
        countLeft--;
        api.later(tick, 650);
      })();
    }

    function toggle() {
      if (state === "run") pause("user");
      else if (state === "count") return;
      else play();
    }

    playBtn.addEventListener("click", function () {
      toggle();
      stage.focus();
    });
    stage.addEventListener("click", function () {
      stage.focus();
      if (state !== "run" && state !== "count") play();
    });
    stage.addEventListener("keydown", function (e) {
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        toggle();
        return;
      }
      var d = KEY_DIR[e.key];
      if (!d) return;
      e.preventDefault();
      if (state === "ready" || state === "over") play();
      else if (state === "paused") play();
      if (queued.length < 3) queued.push(d);
    });
    onSwipe(stage, function (d) {
      if (state !== "run") play();
      if (queued.length < 3) queued.push(d);
    });

    // A watcher for the freeze conditions: start the 3-2-1 once the card is
    // back, keep the canvas sharp when the column width changes.
    api.every(function () {
      if (state === "frozen" && !frozen(stage)) countdown();
      if (state !== "run" && resize()) draw(1);
    }, 300);

    reset();
    api.later(function () {
      draw(1);
    }, 0);
    api.onDispose(stopLoop);
  }

  /* ================================================================ */
  /* 2048                                                              */
  /* ================================================================ */

  var G = 5; // 5 × 5 board: it always plays on the large grid, so scores can climb far beyond 2048

  function g2048(body, api) {
    var saved = api.get("g2048", {}) || {};
    var best = Number(saved.best) || 0;

    var hud = h("div", "ssc-gm-hud");
    var scoreBox = statBox("Score");
    var bestBox = statBox("Record");
    bestBox.value.textContent = String(best);
    var coinBox = statBox("Munten");
    var earned = 0; // coins this game
    var carry = 0; // points not yet worth a coin
    coinBox.value.textContent = "+0";
    hud.appendChild(scoreBox.node);
    hud.appendChild(bestBox.node);
    hud.appendChild(coinBox.node);
    hud.appendChild(h("span", "ssc-gm-spacer"));
    var newBtn = iconButton(PATH_RESTART, "Nieuw spel");
    hud.appendChild(newBtn);
    body.appendChild(hud);

    var board = h("div", "ssc-gm-stage ssc-gm-board");
    board.tabIndex = 0;
    board.setAttribute("role", "application");
    board.setAttribute("aria-label", "2048. Pijltjes of WASD om de tegels te schuiven.");
    for (var i = 0; i < G * G; i++) board.appendChild(h("i", "ssc-gm-slot"));
    var veil = h("div", "ssc-gm-veil");
    veil.setAttribute("data-off", "1");
    var veilTitle = h("div", "ssc-gm-veil-title", "");
    var veilSub = h("div", "ssc-gm-veil-sub", "");
    veil.appendChild(veilTitle);
    veil.appendChild(veilSub);
    board.appendChild(veil);
    body.appendChild(board);

    var grid; // grid[r][c] = tile | null (G × G)
    var tiles = []; // every tile with a DOM node
    var score = 0;
    var nextId = 1;
    var won = false;
    var busy = false;

    function makeTile(r, c, value, fresh) {
      var node = h("div", "ssc-gm-tile");
      var tile = { id: nextId++, r: r, c: c, value: value, node: node };
      paintTile(tile);
      if (fresh) node.setAttribute("data-new", "1");
      board.appendChild(node);
      tiles.push(tile);
      return tile;
    }

    function paintTile(tile) {
      tile.node.textContent = String(tile.value);
      tile.node.setAttribute("data-v", String(Math.min(tile.value, 4096)));
      tile.node.style.setProperty("--r", String(tile.r));
      tile.node.style.setProperty("--c", String(tile.c));
      tile.node.setAttribute("data-len", String(String(tile.value).length));
    }

    function emptyCells() {
      var out = [];
      for (var r = 0; r < G; r++) for (var c = 0; c < G; c++) if (!grid[r][c]) out.push([r, c]);
      return out;
    }

    function spawn() {
      var free = emptyCells();
      if (!free.length) return;
      var at = free[Math.floor(Math.random() * free.length)];
      grid[at[0]][at[1]] = makeTile(at[0], at[1], Math.random() < 0.9 ? 2 : 4, true);
    }

    function clearBoard() {
      tiles.forEach(function (t) {
        t.node.remove();
      });
      tiles = [];
      grid = [];
      for (var r = 0; r < G; r++) {
        grid.push([]);
        for (var c = 0; c < G; c++) grid[r].push(null);
      }
    }

    function newGame() {
      clearBoard();
      score = 0;
      earned = 0;
      carry = 0;
      coinBox.value.textContent = "+0";
      won = false;
      scoreBox.value.textContent = "0";
      veil.setAttribute("data-off", "1");
      spawn();
      spawn();
      persist();
    }

    function persist() {
      var cells = grid.map(function (row) {
        return row.map(function (t) {
          return t ? t.value : 0;
        });
      });
      api.patch("g2048", { best: best, score: score, cells: cells, won: won });
    }

    function restore() {
      if (!Array.isArray(saved.cells) || saved.cells.length !== G) return false;
      clearBoard();
      var any = false;
      for (var r = 0; r < G; r++) {
        for (var c = 0; c < G; c++) {
          var v = Number(saved.cells[r] && saved.cells[r][c]) || 0;
          if (v) {
            grid[r][c] = makeTile(r, c, v, false);
            any = true;
          }
        }
      }
      if (!any) return false;
      score = Number(saved.score) || 0;
      won = !!saved.won;
      scoreBox.value.textContent = String(score);
      return true;
    }

    function canMove() {
      if (emptyCells().length) return true;
      for (var r = 0; r < G; r++) {
        for (var c = 0; c < G; c++) {
          var v = grid[r][c].value;
          if ((c < G - 1 && grid[r][c + 1].value === v) || (r < G - 1 && grid[r + 1][c].value === v)) return true;
        }
      }
      return false;
    }

    /** Slide every line towards [dx, dy]; merges pair up once per move. */
    function move(dx, dy) {
      if (busy || frozen(board)) return;
      var moved = false;
      var gained = 0;
      var removals = [];
      var order = [];
      for (var i = 0; i < G; i++) order.push(i);
      var rows = dy > 0 ? order.slice().reverse() : order;
      var cols = dx > 0 ? order.slice().reverse() : order;
      var merged = {};
      rows.forEach(function (r) {
        cols.forEach(function (c) {
          var tile = grid[r][c];
          if (!tile) return;
          var nr = r;
          var nc = c;
          while (true) {
            var tr = nr + dy;
            var tc = nc + dx;
            if (tr < 0 || tr >= G || tc < 0 || tc >= G) break;
            var other = grid[tr][tc];
            if (!other) {
              nr = tr;
              nc = tc;
              continue;
            }
            if (other.value === tile.value && !merged[other.id]) {
              // Slide onto it, then the other tile doubles and this one goes.
              grid[r][c] = null;
              tile.r = tr;
              tile.c = tc;
              paintPos(tile);
              other.value *= 2;
              merged[other.id] = true;
              gained += other.value;
              removals.push({ gone: tile, keep: other });
              moved = true;
              return;
            }
            break;
          }
          if (nr !== r || nc !== c) {
            grid[r][c] = null;
            grid[nr][nc] = tile;
            tile.r = nr;
            tile.c = nc;
            paintPos(tile);
            moved = true;
          }
        });
      });
      if (!moved) {
        board.setAttribute("data-nudge", dx ? "x" : "y");
        api.later(function () {
          board.removeAttribute("data-nudge");
        }, 160);
        return;
      }
      busy = true;
      if (gained) {
        // The rate per 20 points climbs with the score, so a long game pays far more per point.
        carry += gained * (1 + Math.floor(score / 4000));
        var coins = Math.floor(carry / 20);
        carry -= coins * 20;
        earned += coins;
        coinBox.value.textContent = "+" + earned;
        pay(coins);
      }
      score += gained;
      scoreBox.value.textContent = String(score);
      if (gained) {
        scoreBox.node.setAttribute("data-gain", "1");
        api.later(function () {
          scoreBox.node.removeAttribute("data-gain");
        }, 400);
      }
      if (score > best) {
        best = score;
        bestBox.value.textContent = String(best);
      }
      api.later(function () {
        removals.forEach(function (m) {
          m.gone.node.remove();
          tiles = tiles.filter(function (t) {
            return t !== m.gone;
          });
          paintTile(m.keep);
          m.keep.node.removeAttribute("data-pop");
          void m.keep.node.offsetWidth;
          m.keep.node.setAttribute("data-pop", "1");
          if (m.keep.value === 2048 && !won) {
            won = true;
            veilTitle.textContent = "2048!";
            veilSub.textContent = "Gewonnen · klik om verder te spelen";
            veil.removeAttribute("data-off");
          }
        });
        tiles.forEach(function (t) {
          t.node.removeAttribute("data-new");
        });
        spawn();
        busy = false;
        persist();
        if (!canMove()) {
          veilTitle.textContent = "Geen zetten meer";
          veilSub.textContent = "Score " + score + " · klik op ↻ voor een nieuw spel";
          veil.removeAttribute("data-off");
        }
      }, 120);
    }

    function paintPos(tile) {
      tile.node.style.setProperty("--r", String(tile.r));
      tile.node.style.setProperty("--c", String(tile.c));
    }

    board.addEventListener("keydown", function (e) {
      var d = KEY_DIR[e.key];
      if (!d) return;
      e.preventDefault();
      move(d[0], d[1]);
    });
    board.addEventListener("click", function () {
      board.focus();
      if (won && !veil.hasAttribute("data-off") && canMove()) veil.setAttribute("data-off", "1");
    });
    onSwipe(board, function (d) {
      move(d[0], d[1]);
    });
    newBtn.addEventListener("click", function () {
      newGame();
      board.focus();
    });

    clearBoard();
    if (!restore()) newGame();
  }

  window.sscWidgetGames = { snake: snake, g2048: g2048 };

  /* Card styles; widgets.js appends them to the widget sheet. */
  window.sscWidgetGamesCss = [
    ".ssc-wg-card .ssc-gm-hud { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }",
    ".ssc-wg-card .ssc-gm-spacer { flex: 1; }",
    ".ssc-wg-card .ssc-gm-stat { display: flex; flex-direction: column; align-items: center; min-width: 54px; padding: 4px 10px;",
    "  border-radius: 9px; background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 7%, transparent);",
    "  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 10%, transparent); transition: transform .2s ease; }",
    ".ssc-wg-card .ssc-gm-stat[data-gain='1'] { transform: scale(1.08); }",
    ".ssc-wg-card .ssc-gm-stat-label { font-size: 9.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--ssc-muted); }",
    ".ssc-wg-card .ssc-gm-stat-value { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.2; }",
    ".ssc-wg-card .ssc-gm-btn { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border-radius: 9px; cursor: pointer;",
    "  border: 1px solid var(--ssc-line); background: color-mix(in srgb, var(--ssc-text, #1a1a2e) 5%, transparent); color: inherit; }",
    ".ssc-wg-card .ssc-gm-btn:hover { background: var(--ssc-accent-soft); color: var(--ssc-accent-ink); border-color: transparent; }",
    ".ssc-wg-card .ssc-gm-btn:focus-visible { outline: 2px solid var(--ssc-accent-ink); outline-offset: 2px; }",
    ".ssc-wg-card .ssc-gm-btn svg { width: 15px; height: 15px; fill: currentColor; }",
    ".ssc-wg-card .ssc-gm-stage { --ssc-gm-accent: var(--ssc-accent, #3ba37a); position: relative; width: 100%; aspect-ratio: 1;",
    "  border-radius: 12px; overflow: hidden; outline: none; cursor: pointer; touch-action: none;",
    "  background: radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--ssc-gm-accent) 14%, #161b22), #0d1117 70%);",
    "  box-shadow: inset 0 0 0 1px rgba(255,255,255,.07), inset 0 10px 30px rgba(0,0,0,.45);",
    "  transition: box-shadow .2s ease, transform .18s ease; }",
    ".ssc-wg-card .ssc-gm-stage:focus-visible, .ssc-wg-card .ssc-gm-stage:focus { box-shadow: inset 0 0 0 1px rgba(255,255,255,.07),",
    "  inset 0 10px 30px rgba(0,0,0,.45), 0 0 0 2px var(--ssc-accent-ink); }",
    ".ssc-wg-card .ssc-gm-stage[data-bump='1'] { transform: scale(1.012); }",
    ".ssc-wg-card .ssc-gm-stage[data-dead='1'] { animation: ssc-gm-shake .35s ease; }",
    "@keyframes ssc-gm-shake { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }",
    ".ssc-wg-card .ssc-gm-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }",
    ".ssc-wg-card .ssc-gm-veil { position: absolute; inset: 0; z-index: 5; display: flex; flex-direction: column; align-items: center; justify-content: center;",
    "  gap: 4px; padding: 12px; text-align: center; color: #fff; background: rgba(6, 9, 14, .62); backdrop-filter: blur(3px);",
    "  transition: opacity .2s ease; }",
    ".ssc-wg-card .ssc-gm-veil[data-off='1'] { opacity: 0; pointer-events: none; }",
    ".ssc-wg-card .ssc-gm-veil-title { font-size: 22px; font-weight: 900; letter-spacing: .02em; text-shadow: 0 1px 3px rgba(0,0,0,.8); }",
    ".ssc-wg-card .ssc-gm-veil-sub { font-size: 11.5px; font-weight: 600; opacity: .9; text-shadow: 0 1px 3px rgba(0,0,0,.8); }",
    /* 2048 */
    ".ssc-wg-card .ssc-gm-board { --gap: 7px; display: grid; grid-template-columns: repeat(5, 1fr); grid-template-rows: repeat(5, 1fr);",
    "  gap: var(--gap); padding: var(--gap); box-sizing: border-box; background: linear-gradient(160deg, #2a2f3a, #1a1e26); }",
    ".ssc-wg-card .ssc-gm-board[data-nudge='x'] { animation: ssc-gm-nudge-x .16s ease; }",
    ".ssc-wg-card .ssc-gm-board[data-nudge='y'] { animation: ssc-gm-nudge-y .16s ease; }",
    "@keyframes ssc-gm-nudge-x { 50% { transform: translateX(3px); } }",
    "@keyframes ssc-gm-nudge-y { 50% { transform: translateY(3px); } }",
    ".ssc-wg-card .ssc-gm-slot { border-radius: 8px; background: rgba(255,255,255,.06); box-shadow: inset 0 2px 4px rgba(0,0,0,.35); }",
    ".ssc-wg-card .ssc-gm-tile { position: absolute; left: var(--gap); top: var(--gap); z-index: 2;",
    "  width: calc((100% - var(--gap) * 6) / 5); height: calc((100% - var(--gap) * 6) / 5);",
    "  transform: translate(calc(var(--c) * (100% + var(--gap))), calc(var(--r) * (100% + var(--gap))));",
    "  transition: transform .12s ease-in-out; display: grid; place-items: center; border-radius: 8px;",
    "  font-weight: 900; font-size: clamp(12px, 1.8vw, 20px); font-variant-numeric: tabular-nums; color: #3b2f22;",
    "  background: #eee4da; box-shadow: inset 0 -3px 0 rgba(0,0,0,.14), inset 0 1px 0 rgba(255,255,255,.5), 0 3px 8px rgba(0,0,0,.25); }",
    ".ssc-wg-card .ssc-gm-tile[data-len='3'] { font-size: clamp(12px, 1.8vw, 20px); }",
    ".ssc-wg-card .ssc-gm-tile[data-len='4'] { font-size: clamp(9px, 1.3vw, 14px); }",
    ".ssc-wg-card .ssc-gm-tile[data-len='5'], .ssc-wg-card .ssc-gm-tile[data-len='6'], .ssc-wg-card .ssc-gm-tile[data-len='7'] { font-size: clamp(7px, 1vw, 11px); letter-spacing: -.04em; }",
    ".ssc-wg-card .ssc-gm-tile[data-new='1'] { animation: ssc-gm-appear .18s .1s ease-out both; }",
    ".ssc-wg-card .ssc-gm-tile[data-pop='1'] { animation: ssc-gm-pop .18s ease-out; z-index: 3; }",
    "@keyframes ssc-gm-appear { from { opacity: 0; scale: .3; } to { opacity: 1; scale: 1; } }",
    "@keyframes ssc-gm-pop { 50% { scale: 1.16; } }",
    ".ssc-wg-card .ssc-gm-tile[data-v='4'] { background: #ede0c8; }",
    ".ssc-wg-card .ssc-gm-tile[data-v='8'] { background: linear-gradient(160deg, #f6b47c, #f2944f); color: #fff; }",
    ".ssc-wg-card .ssc-gm-tile[data-v='16'] { background: linear-gradient(160deg, #f89a6b, #f47b3f); color: #fff; }",
    ".ssc-wg-card .ssc-gm-tile[data-v='32'] { background: linear-gradient(160deg, #fa8366, #f05f45); color: #fff; }",
    ".ssc-wg-card .ssc-gm-tile[data-v='64'] { background: linear-gradient(160deg, #f8664a, #e8402a); color: #fff; }",
    ".ssc-wg-card .ssc-gm-tile[data-v='128'] { background: linear-gradient(160deg, #f4dc7e, #e9c94f); color: #fff; box-shadow: 0 0 14px rgba(243,215,116,.45), inset 0 -3px 0 rgba(0,0,0,.12); }",
    ".ssc-wg-card .ssc-gm-tile[data-v='256'] { background: linear-gradient(160deg, #f3d86c, #e6c23a); color: #fff; box-shadow: 0 0 18px rgba(243,215,116,.55), inset 0 -3px 0 rgba(0,0,0,.12); }",
    ".ssc-wg-card .ssc-gm-tile[data-v='512'] { background: linear-gradient(160deg, #f1d35a, #e2b922); color: #fff; box-shadow: 0 0 22px rgba(243,215,116,.65), inset 0 -3px 0 rgba(0,0,0,.12); }",
    ".ssc-wg-card .ssc-gm-tile[data-v='1024'] { background: linear-gradient(160deg, #8fd3ff, #4a8dff); color: #fff; box-shadow: 0 0 24px rgba(110,168,255,.7), inset 0 -3px 0 rgba(0,0,0,.12); }",
    ".ssc-wg-card .ssc-gm-tile[data-v='2048'], .ssc-wg-card .ssc-gm-tile[data-v='4096'] {",
    "  background: linear-gradient(135deg, #ff6bd5, #8a6bff 50%, #3fd2ff); color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.6);",
    "  box-shadow: 0 0 28px rgba(160,120,255,.8), inset 0 -3px 0 rgba(0,0,0,.15); }",
    ".ssc-wg-card .ssc-gm-tile[data-v='8'], .ssc-wg-card .ssc-gm-tile[data-v='16'], .ssc-wg-card .ssc-gm-tile[data-v='32'],",
    ".ssc-wg-card .ssc-gm-tile[data-v='64'], .ssc-wg-card .ssc-gm-tile[data-v='128'], .ssc-wg-card .ssc-gm-tile[data-v='256'],",
    ".ssc-wg-card .ssc-gm-tile[data-v='512'], .ssc-wg-card .ssc-gm-tile[data-v='1024'] { text-shadow: 0 1px 2px rgba(0,0,0,.35); }",
  ].join("\n");
})();
