/*
 * Start page widget system. Started as a port of Smartschool++'s
 * src/widgets/widgets.ts and keeps its pieces: the .ssc-widget card, the bag
 * hanging from the top with its handle, the Done button, edit mode via the
 * pencil, mouse-event dragging (mousedown on the card, mousemove/mouseup on
 * document; no HTML5 drag and drop), "drop on the handle = remove".
 *
 * What changed against smpp:
 *   - Masonry: #container holds #ssc-widget-grid with 3, 4 or 5 equal
 *     columns (settings.widgetColumns). Each column stacks its cards with no
 *     row grid, so a short card sits right under the card above it. While
 *     dragging, a dashed drop slot moves to the spot under the cursor (which
 *     column, between which cards) and the cards around it slide; on release
 *     the card takes the slot's place.
 *   - Smartschool's news (#centercontainer) is a normal card that can go
 *     into the bag like any other block. Its id is kept: Smartschool's own
 *     scripts may still look it up.
 *   - Layout v3 is { version: 3, columns: [[names], ...] } in
 *     chrome.storage.local under sscWidgetLayout. Older layouts (v2: one
 *     flat list; v1: smpp's pannels) are dealt out over the columns once.
 *   - The bag, the Done button and the dragged card hang off documentElement,
 *     never inside body (CLAUDE.md). The edit-mode classes stay on body, so
 *     the CSS reaches the root-level parts through :root:has(> body.x).
 *   - Escape cancels a drag, then closes the bag, then leaves edit mode.
 */
(function () {
  "use strict";

  if (window.sscSkipPage) return;
  if (window.__sscWidgetSystem) return;
  window.__sscWidgetSystem = true;

  var LAYOUT_KEY = "sscWidgetLayout";
  var STYLE_ID = "ssc-widget-system-style";
  var GRID_ID = "ssc-widget-grid";
  var EDIT_ATTR = "data-ssc-edit-btn";
  var NEWS_NAME = "SmartschoolWidget-news";
  var COLUMN_CHOICES = [3, 4, 5];
  var DEFAULT_COLUMNS = 4;
  var AUTOSCROLL_EDGE = 60;

  var CATEGORIES = [
    ["ssc", "Onze Widgets"],
    ["smartschool", "Smartschool Widgets"],
  ];

  var widgetSystemCreated = false;
  var widgetEditModeInit = false;
  var widgetEditMode = false;
  var widgets = [];

  var hoveringBag = false;
  var curDragInfo = null;

  var grid = null;
  var widgetBag = null;
  var widgetBagHandle = null;
  var doneButton = null;
  var editButton = null;

  function registerWidget(widget) {
    widgets.push(widget);
  }

  function animationsOn() {
    return !!document.body && document.body.classList.contains("ssc-anim");
  }

  /* ---------- storage ---------- */

  function loadLayout() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get([LAYOUT_KEY], function (res) {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(normalizeLayout(res && res[LAYOUT_KEY]));
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  /**
   * v3 → { columns }. v2 (flat list) and v1 (smpp's pannels, flattened
   * left → news → right) → { flat }, dealt out over the columns at build time.
   */
  function normalizeLayout(data) {
    if (!data || typeof data !== "object") return null;
    if (Array.isArray(data.columns)) {
      return {
        columns: data.columns.map(function (c) {
          return Array.isArray(c) ? c.slice() : [];
        }),
      };
    }
    if (Array.isArray(data.widgets)) return { flat: data.widgets.slice() };
    if (!Array.isArray(data.leftPannels) || !Array.isArray(data.rightPannels)) return null;
    var names = [];
    function take(pannels) {
      pannels.forEach(function (p) {
        (p && Array.isArray(p.widgets) ? p.widgets : []).forEach(function (n) {
          names.push(n);
        });
      });
    }
    take(data.leftPannels);
    if (data.news !== false) names.push(NEWS_NAME);
    take(data.rightPannels);
    return { flat: names };
  }

  /** Reading order kept: card i goes to column i % n. */
  function dealOut(names, n) {
    var cols = [];
    for (var i = 0; i < n; i++) cols.push([]);
    names.forEach(function (name, i) {
      cols[i % n].push(name);
    });
    return cols;
  }

  function storeLayout(data) {
    return new Promise(function (resolve) {
      try {
        var obj = {};
        obj[LAYOUT_KEY] = data;
        chrome.storage.local.set(obj, function () {
          resolve();
        });
      } catch (e) {
        resolve();
      }
    });
  }

  function saveWidgets() {
    if (!grid) return Promise.resolve();
    var columns = columnEls().map(function (col) {
      var names = [];
      for (var i = 0; i < col.children.length; i++) {
        var name = col.children[i].dataset.widgetName;
        if (name) names.push(name);
      }
      return names;
    });
    return storeLayout({ version: 3, columns: columns });
  }

  /* ---------- columns ---------- */

  function columnCount(value) {
    var n = Number(value);
    return COLUMN_CHOICES.indexOf(n) < 0 ? DEFAULT_COLUMNS : n;
  }

  function columnEls() {
    return grid ? Array.prototype.slice.call(grid.querySelectorAll(":scope > .ssc-widget-col")) : [];
  }

  function makeColumn() {
    var col = document.createElement("div");
    col.className = "ssc-widget-col";
    return col;
  }

  function cardsIn(col) {
    return Array.prototype.filter.call(col.children, function (k) {
      return k.classList.contains("ssc-widget");
    });
  }

  function columnHeight(col) {
    return cardsIn(col).reduce(function (sum, k) {
      return sum + k.offsetHeight;
    }, 0);
  }

  /**
   * Live change of the column count. More columns: empty ones are added on
   * the right. Fewer: the cards of the removed columns go, top to bottom, to
   * whichever remaining column is shortest at that moment.
   */
  function applyColumns(value) {
    if (!grid) return;
    var n = columnCount(value);
    var cols = columnEls();
    if (cols.length === n) return;
    if (curDragInfo) curDragInfo.widget.drop(true);
    flipGrid(function () {
      while (cols.length < n) {
        var col = makeColumn();
        grid.appendChild(col);
        cols.push(col);
      }
      var extra = cols.splice(n);
      extra.forEach(function (col) {
        cardsIn(col).forEach(function (card) {
          var shortest = cols.reduce(function (a, b) {
            return columnHeight(b) < columnHeight(a) ? b : a;
          });
          shortest.appendChild(card);
        });
        col.remove();
      });
    });
    saveWidgets();
  }

  /* ---------- WidgetBase ---------- */

  class WidgetBase {
    constructor() {
      this.element = this._createWidgetDiv();
      this.isActive = false;
      this._content = null;
      this._preview = false;
      this._aboutToDel = false;
      this._bagPlaceHolder = null;
      this._bagGroup = null;
    }

    createWidgetErrorContent(name) {
      var p = document.createElement("p");
      p.classList.add("ssc-error-widget");
      var span = document.createElement("span");
      span.textContent = "Probleem bij het laden van de widget: ";
      var code = document.createElement("code");
      code.className = "ssc-widget-code";
      code.textContent = name;
      p.appendChild(span);
      p.appendChild(code);
      return p;
    }

    _createWidgetDiv() {
      var widgetDiv = document.createElement("div");
      var self = this;
      widgetDiv.addEventListener("mousedown", function (e) {
        if (!widgetEditMode || e.button !== 0) return;
        // No text selection, no focus change, no native image/link drag.
        e.preventDefault();
        self.startDragging(e.clientX, e.clientY);
      });
      widgetDiv.classList.add("ssc-widget");
      return widgetDiv;
    }

    _intoBag() {
      if (this._bagGroup && this.element.parentElement === this._bagGroup) return;

      if (this._bagPlaceHolder && this._bagPlaceHolder.parentNode) {
        this._bagGroup.insertBefore(this.element, this._bagPlaceHolder);
        this._bagPlaceHolder.remove();
      } else {
        this.element.remove();
      }
      this._setPreview(true);
    }

    _setPreview(preview) {
      if (this._preview === preview && this._content !== null) return;

      var newContent;
      try {
        if (preview) {
          this.element.classList.add("ssc-widget-preview");
          newContent = this.createPreview();
        } else {
          this.element.classList.remove("ssc-widget-preview");
          newContent = this.createContent();
          this.isActive = true;
        }
      } catch (e) {
        console.error("[SSC] widget content failed", this.name, e);
        newContent = this.createWidgetErrorContent(this.name);
      }
      if (!newContent) newContent = this.createWidgetErrorContent(this.name);

      if (this._content && this._content !== newContent) {
        this._content.remove();
        this.onContentDropped(this._content);
      }
      newContent.classList.add("ssc-widget-content");
      this._content = newContent;
      this.element.dataset.widgetName = this.name;
      this.element.textContent = "";
      this.element.appendChild(this._content);
      this._preview = preview;
    }

    createIfNotExist() {
      if (!this._content) this._intoBag();
    }

    setBagPlaceHolder(group, placeholder) {
      this._bagPlaceHolder = placeholder;
      this._bagGroup = group;
    }

    addToGrid(target) {
      this._setPreview(false);
      target.appendChild(this.element);
    }

    aboutToDel(value) {
      this._aboutToDel = value;
      this.element.classList.toggle("ssc-widget-delete", !!value);
      if (value && curDragInfo && curDragInfo.drop.parentNode) {
        // The slot leaves the grid while the card hovers the bag, so the page
        // already shows the layout without it.
        flipGrid(function () {
          curDragInfo.drop.remove();
        });
      }
    }

    dragMove(x, y) {
      if (!curDragInfo || curDragInfo.widget !== this) return;
      var offset = curDragInfo.offset;
      this.element.style.left = x - offset.x + "px";
      this.element.style.top = y - offset.y + "px";
      if (!hoveringBag) placeDrop(x, y);
      autoScroll(y);
    }

    drop(cancel) {
      if (!curDragInfo || curDragInfo.widget !== this) return Promise.resolve();

      var info = curDragInfo;
      var el = this.element;
      el.classList.remove("ssc-widget-dragging");
      el.removeAttribute("style");

      var toBag = !cancel && this._aboutToDel;
      var slotCol = info.drop.parentNode;
      var landed = !cancel && !toBag && !!slotCol && slotCol.parentNode === grid;

      bagHoverExit();
      curDragInfo = null;

      if (landed) {
        slotCol.replaceChild(el, info.drop);
        this._setPreview(false);
      } else {
        info.drop.remove();
        if (toBag || info.fromBag) {
          if (toBag) {
            this.onRemove();
            this.isActive = false;
          }
          this._intoBag();
        } else {
          // Cancelled, or released outside the grid: back to where it was.
          var col = info.sourceCol && info.sourceCol.parentNode === grid ? info.sourceCol : columnEls()[0];
          var next = info.sourceNext && info.sourceNext.parentNode === col ? info.sourceNext : null;
          col.insertBefore(el, next);
        }
      }

      document.body.classList.remove("ssc-widget-dragging-something");
      return saveWidgets();
    }

    startDragging(grabX, grabY) {
      if (!widgetEditMode || curDragInfo) return;
      var el = this.element;
      var rect = el.getBoundingClientRect();

      var drop = document.createElement("div");
      drop.className = "ssc-widget-drop";

      var fromBag = !!this._bagGroup && el.parentElement === this._bagGroup;
      var sourceCol = null;
      var sourceNext = null;
      if (fromBag) {
        this._bagGroup.insertBefore(this._bagPlaceHolder, el);
        el.remove();
      } else {
        sourceCol = el.parentElement;
        sourceNext = el.nextElementSibling;
        drop.style.height = rect.height + "px";
        sourceCol.replaceChild(drop, el);
      }

      curDragInfo = {
        widget: this,
        drop: drop,
        fromBag: fromBag,
        sourceCol: sourceCol,
        sourceNext: sourceNext,
        offset: { x: grabX - rect.left, y: grabY - rect.top },
      };
      document.body.classList.add("ssc-widget-dragging-something");
      el.style.width = rect.width + "px";
      el.style.left = rect.left + "px";
      el.style.top = rect.top + "px";
      el.style.transformOrigin = curDragInfo.offset.x + "px " + curDragInfo.offset.y + "px";

      el.classList.add("ssc-widget-dragging");

      // smpp: document.body. Ours hang off the root, never inside body.
      document.documentElement.appendChild(el);

      closeBag();
    }

    get name() {
      return "Widget";
    }
    get category() {
      return "other";
    }
    createContent() {
      return null;
    }
    createPreview() {
      return this.createContent();
    }
    onContentDropped() {}
    onRemove() {}
  }

  /* One of our widgets, rendered by widgets.js. */
  class SscWidget extends WidgetBase {
    constructor(def) {
      super();
      this.def = def;
    }
    get name() {
      return "SscWidget-" + this.def.id;
    }
    get category() {
      return "ssc";
    }
    createContent() {
      var r = window.sscWidgetKit.render(this.def.id);
      r.node.__sscDispose = r.dispose;
      return r.node;
    }
    onContentDropped(node) {
      if (node && typeof node.__sscDispose === "function") node.__sscDispose();
    }
  }

  /* One of Smartschool's own homepage blocks, moved as-is. */
  class SmartschoolWidget extends WidgetBase {
    constructor(content, id) {
      super();
      this.smContent = content;
      this.smId = id;
      this.smContent.classList.add("ssc-widget-smartschool");
    }
    get category() {
      return "smartschool";
    }
    get name() {
      return "SmartschoolWidget-" + this.smId;
    }
    createContent() {
      return this.smContent;
    }
  }

  /* Smartschool's news column, as a card. */
  class NewsWidget extends SmartschoolWidget {
    constructor(content) {
      super(content, "news");
      this.smContent.classList.add("ssc-news-widget");
    }
  }

  /* ---------- the drop slot ---------- */

  /**
   * FLIP: measure every card, run `mutate`, then slide each card from its old
   * place to its new one. This is what makes the cards around the drop slot
   * glide aside instead of jumping.
   */
  function flipGrid(mutate) {
    if (!grid || !animationsOn()) {
      mutate();
      return;
    }
    var kids = Array.prototype.slice.call(grid.querySelectorAll(":scope > .ssc-widget-col > .ssc-widget"));
    var before = kids.map(function (k) {
      return k.getBoundingClientRect();
    });
    mutate();
    // Measure the new places without any slide that is still running.
    kids.forEach(function (k) {
      k.style.transition = "none";
      k.style.transform = "";
    });
    kids.forEach(function (k, i) {
      var after = k.getBoundingClientRect();
      var dx = before[i].left - after.left;
      var dy = before[i].top - after.top;
      if (!k.parentNode || (!dx && !dy)) {
        k.style.transition = "";
        return;
      }
      k.style.transform = "translate(" + dx + "px, " + dy + "px)";
      // Force the start position before the transition is switched back on.
      void k.offsetWidth;
      k.style.transition = "transform 0.22s ease";
      k.style.transform = "";
      k.addEventListener("transitionend", function clear() {
        k.removeEventListener("transitionend", clear);
        k.style.transition = "";
      });
    });
  }

  /**
   * Moves the drop slot under the cursor: the column whose x-range holds the
   * cursor (else the nearest), and in it before the first card whose middle
   * is below the cursor. smpp's onPannelHover rule, per column. Once the slot
   * is there the same rule gives the same answer, so it cannot flicker.
   */
  function placeDrop(x, y) {
    if (!grid || !curDragInfo) return;
    var drop = curDragInfo.drop;
    var g = grid.getBoundingClientRect();
    if (x < g.left || x > g.right || y < g.top || y > g.bottom) return;

    var cols = columnEls();
    var col = null;
    var bestDx = Infinity;
    cols.forEach(function (c) {
      var r = c.getBoundingClientRect();
      var dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      if (dx < bestDx) {
        bestDx = dx;
        col = c;
      }
    });
    if (!col) return;

    var ref = null;
    var cards = cardsIn(col);
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].getBoundingClientRect();
      if (r.top + r.height / 2 > y) {
        ref = cards[i];
        break;
      }
    }
    if (drop.parentNode === col && drop.nextElementSibling === ref) return;
    flipGrid(function () {
      col.insertBefore(drop, ref);
    });
  }

  var scrollParent = null;

  function findScrollParent(node) {
    for (var n = node && node.parentElement; n && n !== document.body; n = n.parentElement) {
      var oy = getComputedStyle(n).overflowY;
      if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) return n;
    }
    return null;
  }

  function autoScroll(y) {
    var step = y < AUTOSCROLL_EDGE ? -14 : y > window.innerHeight - AUTOSCROLL_EDGE ? 14 : 0;
    if (!step || hoveringBag) return;
    if (scrollParent === null) scrollParent = findScrollParent(grid) || false;
    if (scrollParent) scrollParent.scrollTop += step;
    else window.scrollBy(0, step);
  }

  /* ---------- building ---------- */

  function getWidgetByName(name) {
    for (var i = 0; i < widgets.length; i++) {
      if (widgets[i].name === name) return widgets[i];
    }
    return null;
  }

  function smartschoolId(block, index) {
    return block.id || "block-" + index;
  }

  function createWidgetSystem() {
    var container = document.getElementById("container");
    if (!container) return Promise.resolve(false);
    if (!document.getElementById("centercontainer")) return Promise.resolve(false);

    var kit = window.sscWidgetKit;

    return Promise.all([
      loadLayout(),
      kit ? kit.defaultIds() : Promise.resolve([]),
      window.sscGet ? window.sscGet() : Promise.resolve({}),
    ]).then(function (res) {
      var layout = res[0];
      var defaultIds = res[1] || [];
      var settings = res[2] || {};
      // Smartschool may have rendered in the meantime; re-check.
      container = document.getElementById("container");
      var news = document.getElementById("centercontainer");
      if (!container || !news || widgetSystemCreated) return false;

      if (kit) {
        kit.defs.forEach(function (def) {
          registerWidget(new SscWidget(def));
        });
      }

      var left = [];
      var right = [];
      var index = 0;
      document.querySelectorAll("#leftcontainer .homepage__block").forEach(function (block) {
        var w = new SmartschoolWidget(block, smartschoolId(block, index++));
        registerWidget(w);
        left.push(w.name);
      });
      var newsWidget = new NewsWidget(news);
      registerWidget(newsWidget);
      document.querySelectorAll("#rightcontainer .homepage__block").forEach(function (block) {
        var w = new SmartschoolWidget(block, smartschoolId(block, index++));
        registerWidget(w);
        right.push(w.name);
      });

      var n = columnCount(settings.widgetColumns);
      var columns;
      if (layout && layout.columns) {
        columns = layout.columns;
      } else if (layout && layout.flat) {
        columns = dealOut(layout.flat, n);
      } else {
        // Smartschool's own places: its left blocks in the first column, the
        // news next to them, its right blocks in the last column. The widgets
        // that were switched on in the old list fill up the shortest columns.
        // Everything else waits in the bag.
        columns = [];
        for (var c = 0; c < n; c++) columns.push([]);
        columns[0] = columns[0].concat(left);
        columns[1].push(newsWidget.name);
        columns[n - 1] = columns[n - 1].concat(right);
        defaultIds.forEach(function (id) {
          var shortest = columns.reduce(function (a, b) {
            return b.length < a.length ? b : a;
          });
          shortest.push("SscWidget-" + id);
        });
      }

      grid = document.createElement("div");
      grid.id = GRID_ID;
      grid.className = "ssc-widget-grid";
      columns.forEach(function (names) {
        var col = makeColumn();
        names.forEach(function (name) {
          var widget = getWidgetByName(name);
          // A block that is gone, or a duplicate in a hand-edited layout.
          if (!widget || widget.element.parentElement) return;
          widget.addToGrid(col);
        });
        grid.appendChild(col);
      });
      if (!columns.length) grid.appendChild(makeColumn());

      container.textContent = "";
      container.appendChild(grid);
      // A stored layout with another column count follows the setting.
      applyColumns(n);

      if (typeof window.sscOnChange === "function") {
        window.sscOnChange(function (s) {
          applyColumns(s.widgetColumns);
        });
      }

      widgetSystemCreated = true;
      return true;
    });
  }

  /* ---------- bag ---------- */

  function bagHoverEnter() {
    if (!widgetBag) return;
    hoveringBag = true;
    if (curDragInfo) {
      widgetBag.classList.add("ssc-widget-bag-delete");
      curDragInfo.widget.aboutToDel(true);
    }
  }

  function bagHoverExit() {
    if (!widgetBag) return;
    hoveringBag = false;
    widgetBag.classList.remove("ssc-widget-bag-delete");
    if (curDragInfo) curDragInfo.widget.aboutToDel(false);
  }

  function createGroup(bag, name, displayName) {
    var group = document.createElement("div");
    group.classList.add("ssc-widget-bag-group");
    widgets.forEach(function (widget) {
      if (widget.category !== name) return;
      var pl = document.createElement("div");
      pl.classList.add("ssc-widget-bag-placeholder");
      widget.setBagPlaceHolder(group, pl);
      group.appendChild(pl);
    });
    var groupTitle = document.createElement("h2");
    groupTitle.classList.add("ssc-widget-bag-group-title");
    groupTitle.textContent = displayName;
    bag.appendChild(groupTitle);
    bag.appendChild(group);
  }

  var BAG_HANDLE_SVG =
    '<svg class="ssc-widget-bag-handle-icon" version="1.1" viewBox="0 0 448 448" xmlns="http://www.w3.org/2000/svg"><g transform="translate(-.898 -124.01)"><path d="m26.458 288.48 198.44 119.06 198.44-119.06" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="39.511"/></g></svg>';

  function createWidgetBag() {
    var bag = document.createElement("div");
    bag.classList.add("ssc-widget-bag");

    var content = document.createElement("div");
    content.classList.add("ssc-widget-bag-content");

    var innerContent = document.createElement("div");
    innerContent.classList.add("ssc-widget-bag-inner-content");

    CATEGORIES.forEach(function (c) {
      createGroup(innerContent, c[0], c[1]);
    });
    content.appendChild(innerContent);
    bag.appendChild(content);

    var handle = document.createElement("div");
    handle.classList.add("ssc-widget-bag-handle");
    handle.title = "Widgets";
    handle.addEventListener("click", toggleBag);
    handle.innerHTML = BAG_HANDLE_SVG;
    bag.appendChild(handle);

    widgets.forEach(function (widget) {
      widget.createIfNotExist();
    });

    document.documentElement.appendChild(bag);
    return bag;
  }

  function isBagOpen() {
    return !!widgetBag && widgetBag.classList.contains("ssc-widget-bag-open");
  }

  function closeBag() {
    if (widgetBag) widgetBag.classList.remove("ssc-widget-bag-open");
    if (doneButton) {
      changeDoneButtonState("noBag");
      doneButton.classList.remove("ssc-widget-bag-open");
    }
    bagHoverExit();
  }

  function openBag() {
    if (widgetBag) widgetBag.classList.add("ssc-widget-bag-open");
    if (doneButton) {
      changeDoneButtonState("inBag");
      doneButton.classList.add("ssc-widget-bag-open");
    }
    if (curDragInfo) bagHoverEnter();
  }

  function toggleBag() {
    if (isBagOpen()) closeBag();
    else if (!curDragInfo) openBag();
  }

  /* ---------- done button ---------- */

  var DONE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" class="done-icon" viewBox="0 0 193 180" fill="none"><rect x="108.281" y="146.148" width="45" height="116.069" rx="22.5" transform="rotate(131 108.281 146.148)"/><rect x="159.568" y="-8" width="45" height="198" rx="22.5" transform="rotate(35 159.568 -8)"/></svg>';

  function setEditModeFalse() {
    setEditMode(false);
  }

  function createWidgetsDoneButton() {
    doneButton = document.createElement("button");
    doneButton.type = "button";
    doneButton.innerHTML = "Klaar " + DONE_SVG;
    doneButton.classList.add("ssc-widgets-done-button");
    doneButton.classList.add("ssc-hidden");
    doneButton.addEventListener("click", setEditModeFalse);
    document.documentElement.appendChild(doneButton);
  }

  function changeDoneButtonState(state) {
    doneButton.removeEventListener("click", setEditModeFalse);
    doneButton.removeEventListener("click", toggleBag);
    doneButton.addEventListener("click", state === "inBag" ? toggleBag : setEditModeFalse);
  }

  function updateDoneButtonState(value) {
    requestAnimationFrame(function () {
      doneButton.classList.toggle("ssc-hidden", !value);
    });
  }

  /* ---------- edit mode ---------- */

  function setEditMode(value) {
    if (!widgetSystemCreated) return Promise.resolve();
    if (value && !widgetEditModeInit) initWidgetEditMode();
    if (value && typeof window.sscCloseSurfaces === "function") window.sscCloseSurfaces();

    if (!doneButton) createWidgetsDoneButton();

    var pending = Promise.resolve();
    if (value) {
      document.body.classList.add("ssc-widget-edit-mode");
      if (!widgetBag) {
        widgetBag = createWidgetBag();
        widgetBagHandle = widgetBag.querySelector(".ssc-widget-bag-handle");
      }
    } else {
      if (curDragInfo) pending = curDragInfo.widget.drop(true);
      closeBag();
      document.body.classList.remove("ssc-widget-edit-mode");
    }
    updateDoneButtonState(value);
    widgetEditMode = !!value;
    if (editButton) editButton.setAttribute("aria-pressed", widgetEditMode ? "true" : "false");
    return pending;
  }

  function initWidgetEditMode() {
    if (widgetEditModeInit || !widgetSystemCreated) return;
    widgetEditModeInit = true;

    document.addEventListener("mouseup", function () {
      if (curDragInfo) curDragInfo.widget.drop(false);
    });

    document.addEventListener("mousemove", function (e) {
      if (!curDragInfo) return;

      var handleBounds = widgetBagHandle.getBoundingClientRect();
      if (e.clientY < handleBounds.bottom && e.clientX > handleBounds.left && e.clientX < handleBounds.right) {
        bagHoverEnter();
      } else if (hoveringBag) {
        bagHoverExit();
      }

      curDragInfo.widget.dragMove(e.clientX, e.clientY);
    });

    // The mouse can be released outside the window; treat that as a cancel.
    window.addEventListener("blur", function () {
      if (curDragInfo) curDragInfo.widget.drop(true);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !widgetEditMode) return;
      if (curDragInfo) {
        curDragInfo.widget.drop(true);
      } else if (isBagOpen()) {
        closeBag();
      } else {
        setEditMode(false);
      }
    });
  }

  /* ---------- pencil in the topbar ---------- */

  var PENCIL_SVG =
    '<svg data-ssc-glyph="1" viewBox="0 0 24 24" width="20" height="20" focusable="false" aria-hidden="true" fill="currentColor">' +
    '<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"></path>' +
    "</svg>";

  function topbarNav() {
    return document.querySelector("nav.topnav") || document.querySelector(".smsc-topnav") || document.querySelector(".topnav");
  }

  /**
   * Insert-or-repair, like the gear: content.js calls this after every topbar
   * repair, so it must write nothing when the pencil is already in place.
   * Place: right before the gear, else before the search wrapper.
   */
  function mountEditButton() {
    if (!widgetSystemCreated) return;
    var nav = topbarNav();
    if (!nav) return;

    if (!editButton) {
      editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "topnav__btn";
      editButton.setAttribute(EDIT_ATTR, "1");
      editButton.setAttribute("aria-label", "Widgets bewerken");
      editButton.setAttribute("aria-pressed", "false");
      editButton.title = "Ga in/uit edit mode om de positie van je widgets te veranderen.";
      editButton.innerHTML = PENCIL_SVG;
      editButton.addEventListener("click", function () {
        setEditMode(!widgetEditMode);
      });
    }

    var gear = nav.querySelector("[data-ssc-topbar-btn]");
    var anchor = gear;
    if (!anchor) {
      var search = nav.querySelector(".topnav__btn--icon--search") || nav.querySelector(".js-btn-search");
      anchor = search && search.parentElement !== nav ? search.parentElement : search;
    }
    if (anchor && anchor.parentNode === nav) {
      if (editButton.parentNode !== nav || editButton.nextSibling !== anchor) nav.insertBefore(editButton, anchor);
    } else if (editButton.parentNode !== nav) {
      nav.appendChild(editButton);
    }
  }

  /* ---------- styles ---------- */

  /*
   * smpp's widgets.css for the card, bag and Done button, ungated: --color-*
   * became --ssc-* with a fallback for "Geen thema", where every --ssc-* is
   * `initial`. The gated copy in themes.css still applies with a theme
   * on; the grid rules use the #ssc-widget-grid id so they outrank it.
   */
  var BASE01 = "var(--ssc-base01, #ffffff)";
  var BASE02 = "var(--ssc-base02, #eef0f3)";
  var BASE03 = "var(--ssc-base03, #d5d9e0)";
  var TEXT = "var(--ssc-text, #1a1a2e)";
  var ACCENT = "var(--ssc-accent, #2b6cb0)";
  var SHADOW = "var(--ssc-shadow, rgba(0, 0, 0, 0.18))";
  var RED = "var(--ssc-red, #e5484d)";
  var YELLOW = "var(--ssc-yellow, #f5c400)";
  var BLACK = "var(--ssc-black, #000000)";
  var GREEN = "var(--ssc-green, #3ba37a)";
  var EDIT = ":root:has(> body.ssc-widget-edit-mode)";
  var ANIM = ":root:has(> body.ssc-anim)";
  var G = "#" + GRID_ID;

  var CSS = [
    ":root {",
    "  --ssc-widget-bag-margin: 3%;",
    "  --ssc-widget-bag-handle-radius: 40px;",
    "  --ssc-widget-bag-handle-height: 60px;",
    "  --pannel-width: calc(300px + 1rem * 2);",
    "  --preview-width: calc(var(--pannel-width) * 0.7);",
    "  --bag-close-transformy: calc(-100% - var(--ssc-widget-bag-margin) - 8px + var(--ssc-widget-bag-handle-height));",
    "}",

    /* The masonry: equal columns, each one stacks its own cards. */
    G + " {",
    "  display: flex; flex-direction: row; align-items: stretch; gap: 1.6rem; padding: 1.6rem;",
    "  box-sizing: border-box; width: 100%; min-height: 60vh;",
    "}",
    G + " > .ssc-widget-col { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 1.6rem; }",
    G + " > .ssc-widget-col > .ssc-widget { margin: 0; min-width: 0; max-width: none; flex: none; }",
    /* An empty column is still a place to drop on. */
    "body.ssc-widget-edit-mode " + G + " > .ssc-widget-col:empty { border: 2px dashed " + BASE03 + "; border-radius: 1.2rem; }",
    /* Anything Smartschool puts back into #container next to the grid. */
    "#container:has(> " + G + ") > :not(" + G + ") { display: none; }",
    ".ssc-widget-drop {",
    "  box-sizing: border-box; min-height: 8rem; border-radius: 1.2rem;",
    "  border: 3px dashed " + ACCENT + "; background: color-mix(in srgb, " + ACCENT + " 10%, transparent);",
    "}",

    /* Smartschool's news as a card: drop the column layout it had. */
    ".ssc-widget > #centercontainer.ssc-news-widget {",
    "  width: auto; max-width: none; min-width: 0; float: none; margin: 0; height: auto; position: static;",
    "  overflow: hidden; border: none; padding: 1.2rem 1.5rem; box-sizing: border-box;",
    "}",

    /* Card */
    ".ssc-widget {",
    "  height: min-content; transform: scale(1) rotate(0deg); position: relative;",
    "  transition: transform 0.35s cubic-bezier(.2, .8, .2, 1), box-shadow 0.35s, padding 0.25s;",
    "  background-color: " + BASE01 + "; color: " + TEXT + ";",
    "  padding: 1.4rem; border-radius: 1.2rem;",
    // An inner top highlight and a hairline inner ring give the card an
    // edge; the two outer shadows give it depth.
    "  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07), inset 0 0 0 1px rgba(255, 255, 255, 0.025),",
    "    0 1px 2px rgba(0, 0, 0, 0.06), 0 14px 32px -16px " + SHADOW + ";",
    "  margin: 0 1rem; border: 1px solid " + BASE03 + "; box-sizing: border-box; font-size: 1rem;",
    "}",
    /* Our signature: a short accent bar on the card's top edge. */
    ".ssc-widget:not(.ssc-widget-transparent)::before {",
    "  content: ''; position: absolute; top: -1px; left: 1.4rem; width: 3.2rem; height: 4px;",
    "  border-radius: 0 0 4px 4px; background: " + ACCENT + "; opacity: 0.85; pointer-events: none;",
    "}",
    G + " .ssc-widget:not(.ssc-widget-dragging):hover {",
    "  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.04),",
    "    0 2px 4px rgba(0, 0, 0, 0.08), 0 22px 44px -18px " + SHADOW + ";",
    "  border-color: color-mix(in srgb, " + ACCENT + " 35%, " + BASE03 + ");",
    "}",
    "body:not(.ssc-widget-edit-mode) " + G + " .ssc-widget:not(.ssc-widget-dragging):hover { transform: translateY(-2px); }",
    ".ssc-widget-preview { overflow: visible; position: relative; }",
    ".ssc-widget.ssc-widget-preview { margin: 0; min-width: var(--preview-width); max-width: var(--preview-width); }",
    ".ssc-widget.ssc-widget-preview:has(> .ssc-widget-smartschool) { min-width: var(--pannel-width); max-width: var(--pannel-width); }",
    ":root > .ssc-widget-bag .ssc-widget-preview:has(> .ssc-widget-smartschool) { max-height: 26rem; overflow: hidden; }",
    ".ssc-widget:has(> .ssc-widget-smartschool) { padding: 0; overflow: hidden; }",

    ".ssc-widget-bag-placeholder { display: none; }",

    /* Edit mode */
    "body.ssc-widget-edit-mode { user-select: none; }",
    "body.ssc-widget-edit-mode .topnav { pointer-events: none; filter: saturate(50%); opacity: 0.9; }",
    "body.ssc-anim.ssc-widget-edit-mode .topnav { filter: blur(1px) saturate(50%); }",
    "body.ssc-anim .topnav { transition: opacity 0.3s ease-in-out, filter 0.3s ease-in-out; }",
    "body.ssc-widget-edit-mode:not(.ssc-widget-dragging-something) .ssc-widget:not(.ssc-widget-preview):not(.ssc-widget-dragging) {",
    "  border-color: transparent; outline: 4px dashed " + BLACK + "; box-shadow: 0 0 0 3.5px " + YELLOW + ";",
    "}",
    "body.ssc-widget-edit-mode .ssc-widget > *, .ssc-widget-preview > *, .ssc-widget-dragging > * { pointer-events: none; user-select: none; }",
    "body.ssc-widget-edit-mode:not(.ssc-widget-dragging-something) .ssc-widget:hover,",
    EDIT + ":not(:has(> body.ssc-widget-dragging-something)) .ssc-widget-bag .ssc-widget:hover {",
    "  transform: translateY(-5px); cursor: move;",
    "}",
    ".ssc-widget.ssc-widget-dragging { margin: 0; position: fixed; z-index: 10000000; pointer-events: none; opacity: 0.5; cursor: move; }",
    ".ssc-widget.ssc-widget-delete { animation: sscWidgetDelete 0.4s infinite; border-color: " + RED + "; }",
    "@keyframes sscWidgetDelete { 0% { transform: rotate(5deg); } 50% { transform: rotate(-5deg); } 100% { transform: rotate(5deg); } }",

    /* Bag */
    ".ssc-widget-bag {",
    "  position: fixed; left: var(--ssc-widget-bag-margin); right: var(--ssc-widget-bag-margin);",
    "  top: var(--ssc-widget-bag-margin); bottom: var(--ssc-widget-bag-margin);",
    "  display: flex; flex-direction: column; align-items: center; pointer-events: none;",
    "  transform: translateY(-100vh); z-index: 100; font-size: 1rem;",
    "}",
    EDIT + " .ssc-widget-bag { transform: translateY(calc(var(--bag-close-transformy) - 10px)); }",
    EDIT + " .ssc-widget-bag.ssc-widget-bag-delete,",
    EDIT + " .ssc-widget-bag:not(.ssc-widget-bag-open):hover { transform: translateY(var(--bag-close-transformy)); }",
    EDIT + " .ssc-widget-bag.ssc-widget-bag-open { transform: translateY(0px); }",
    ANIM + " .ssc-widget-bag { transition: transform 0.5s; }",
    ".ssc-widget-bag-content {",
    "  width: 100%; box-sizing: border-box; background-color: " + BASE01 + "; color: " + TEXT + ";",
    "  border: solid " + ACCENT + " 3px; border-radius: 2rem; box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.65);",
    "  flex-grow: 1; display: flex; flex-direction: column; pointer-events: auto; overflow: hidden;",
    "}",
    ".ssc-widget-bag-inner-content { padding-top: 20px; overflow: auto; flex-grow: 1; display: flex; flex-direction: column; height: 100%; }",
    ".ssc-widget-bag.ssc-widget-bag-delete .ssc-widget-bag-handle,",
    ".ssc-widget-bag.ssc-widget-bag-delete .ssc-widget-bag-content { border-color: " + RED + "; }",
    ".ssc-widget-bag-group { margin: 1rem; gap: 2rem; display: flex; flex-direction: row; flex-wrap: wrap; align-items: flex-start; }",
    ".ssc-widget-bag-group:last-child { margin-bottom: 1rem; }",
    ".ssc-widget-bag-group-title {",
    "  margin: 1rem 1rem 0.5rem 3rem; padding: 0; width: fit-content; font-size: 2.5rem; font-weight: 700; line-height: 1.3;",
    "  color: " + TEXT + "; border-bottom: 3px solid " + BASE02 + ";",
    "}",
    ".ssc-widget-bag-handle {",
    "  height: var(--ssc-widget-bag-handle-height); width: 40%; box-sizing: border-box;",
    "  background-color: " + BASE01 + "; color: " + ACCENT + ";",
    "  border: solid " + ACCENT + " 4px; border-top: none;",
    "  border-bottom-left-radius: var(--ssc-widget-bag-handle-radius); border-bottom-right-radius: var(--ssc-widget-bag-handle-radius);",
    "  display: flex; flex-direction: column; align-items: center; pointer-events: auto; cursor: pointer;",
    "}",
    ".ssc-widget-bag.ssc-widget-bag-delete .ssc-widget-bag-handle-icon { color: " + RED + "; }",
    ANIM + " .ssc-widget-bag-handle-icon, " + ANIM + " .ssc-widget-bag-handle { transition: border-color 0.5s, color 0.5s, transform 0.5s; }",
    ".ssc-widget-bag-open .ssc-widget-bag-handle-icon { transform: rotate(180deg); }",
    ".ssc-widget-bag-handle-icon { width: 50px; display: block; }",

    /* Error card */
    ".ssc-error-widget { color: " + RED + "; display: flex; flex-direction: column; justify-content: center; font-weight: bold; margin: 0; }",
    ".ssc-error-widget .ssc-widget-code { text-align: center; display: block; }",

    /* Done button */
    "@keyframes moveDoneButton { 0% { opacity: 0; } 50% { opacity: 0; transform: translateY(-30px); filter: blur(4px); } 70% { opacity: 1; filter: blur(0); transform: translateY(10px); } 100% { transform: translateY(0); } }",
    "@keyframes moveDoneButtonBack { 0% { opacity: 0; } 50% { opacity: 0; transform: translateY(-30px); filter: blur(4px); } 90% { opacity: 1; filter: blur(0); transform: translateY(2px); } 100% { transform: translateY(0); } }",
    ".ssc-widgets-done-button {",
    "  position: fixed; right: 0.5rem; top: 0.5rem; height: 3.25rem; display: flex; gap: 1rem;",
    "  align-items: center; justify-content: center; font: inherit; font-size: 1.7rem; font-weight: 700;",
    "  color: " + TEXT + "; opacity: 1; border-radius: 100000px; padding: 0 1.5rem; cursor: pointer;",
    "  border: 3px solid " + BASE02 + "; background-color: " + BASE01 + ";",
    "  box-shadow: 0 -0.5rem 2rem 1rem rgba(0, 0, 0, 0.5); z-index: 90;",
    "}",
    ".ssc-widgets-done-button:active { scale: 0.9; }",
    ANIM + " .ssc-widgets-done-button { animation: moveDoneButtonBack 0.5s ease-in-out 0s 1; transition: 0.1s ease-out; }",
    ANIM + " .ssc-widgets-done-button.ssc-widget-bag-open { animation: moveDoneButton 0.5s ease-in-out 0s 1; }",
    ".ssc-widgets-done-button.ssc-widget-bag-open { top: 5%; right: 5%; z-index: 1000; height: 4rem; font-size: 2rem; box-shadow: 0 0 2rem 0 rgba(0, 0, 0, 0.194); }",
    ".ssc-widgets-done-button:hover { border-color: " + BASE03 + "; background-color: " + BASE02 + "; }",
    /* smpp keeps it in the layout at opacity 0; it must not catch clicks there. */
    ".ssc-widgets-done-button.ssc-hidden { opacity: 0; pointer-events: none; }",
    ".ssc-widgets-done-button > svg { width: 1.7rem; overflow: visible; margin: 0; fill: " + TEXT + "; }",
    ".ssc-widgets-done-button:hover > svg { fill: " + GREEN + "; }",

    /* Pencil pressed state */
    "[" + EDIT_ATTR + "][aria-pressed='true'] { color: " + ACCENT + "; }",

    /* Outside body nothing inherits the page font; take it from body. */
    ":root > .ssc-widget-bag, :root > .ssc-widgets-done-button, :root > .ssc-widget {",
    "  font-family: var(--ssc-page-font, system-ui, sans-serif); line-height: var(--ssc-page-line-height, 1.4);",
    "}",
  ].join("\n");

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var bodyStyle = getComputedStyle(document.body);
    document.documentElement.style.setProperty("--ssc-page-font", bodyStyle.fontFamily);
    document.documentElement.style.setProperty("--ssc-page-line-height", bodyStyle.lineHeight);
    var style = document.createElement("style");
    style.id = STYLE_ID;
    var kitCss = window.sscWidgetKit && window.sscWidgetKit.CSS ? "\n" + window.sscWidgetKit.CSS : "";
    style.textContent = CSS + kitCss;
    (document.head || document.documentElement).appendChild(style);
  }

  /* ---------- start ---------- */

  var OPEN_FLAG = "sscOpenWidgetEdit";
  var starting = false;

  /*
   * Smartschool can paint #container and its blocks after document_idle.
   * Wait until the columns are there, and give the blocks up to 3s to arrive
   * so the first layout includes them.
   */
  function whenContainerReady(cb) {
    var t0 = Date.now();
    var done = false;
    var observer = null;
    var timer = null;

    function check() {
      if (done) return;
      var ready = document.getElementById("container") && document.getElementById("centercontainer");
      var blocks = document.querySelector("#leftcontainer .homepage__block, #rightcontainer .homepage__block");
      var waited = Date.now() - t0;
      if (ready && (blocks || waited > 3000)) {
        finish(true);
      } else if (waited > 15000) {
        finish(false);
      }
    }
    function finish(ok) {
      done = true;
      if (observer) observer.disconnect();
      if (timer) clearInterval(timer);
      cb(ok);
    }

    check();
    if (done) return;
    if (typeof MutationObserver === "function") {
      observer = new MutationObserver(check);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    // The observer only fires on mutations; this covers the 3s/15s limits.
    timer = setInterval(check, 500);
  }

  function sscWidgetSystemStart() {
    if (widgetSystemCreated || starting) return;
    starting = true;
    whenContainerReady(function (ok) {
      if (!ok) {
        starting = false;
        return;
      }
      injectStyles();
      createWidgetSystem().then(function (created) {
        starting = false;
        if (!created) return;
        initWidgetEditMode();
        mountEditButton();
        var wantEdit = false;
        try {
          wantEdit = sessionStorage.getItem(OPEN_FLAG) === "1";
          sessionStorage.removeItem(OPEN_FLAG);
        } catch (e) {
          /* Storage blocked: just don't auto-open. */
        }
        if (wantEdit) setEditMode(true);
      }, function (e) {
        starting = false;
        console.error("[SSC] widget system failed", e);
      });
    });
  }

  /**
   * For the settings window's "Widgets bewerken" button. On the start page it
   * enters edit mode; elsewhere it goes to the start page and opens it there.
   */
  function openWidgetEditor() {
    if (widgetSystemCreated) {
      setEditMode(true);
      return true;
    }
    try {
      sessionStorage.setItem(OPEN_FLAG, "1");
    } catch (e) {
      /* Without the flag the user just presses the pencil there. */
    }
    location.href = "/";
    return false;
  }

  window.sscWidgetSystemStart = sscWidgetSystemStart;
  window.sscMountWidgetEditButton = mountEditButton;
  window.sscWidgetEditor = {
    open: openWidgetEditor,
    setEditMode: setEditMode,
    isEditing: function () {
      return widgetEditMode;
    },
    isReady: function () {
      return widgetSystemCreated;
    },
  };
})();