import { state }                                        from './state.js';
import { PANEL_W, SNAP_GRID, MIN_ZOOM, MAX_ZOOM }        from './config.js';
import { doZoom, fitScreen }                            from './viewport.js';
import { saveState, restoreState }                      from './undo.js';
import { snapPos }                                      from './snap.js';
import { initFilesP5, removeSelected }                  from './files.js';
import { initExportP5 }                                 from './export.js';
import {
  initUI, updateDimDisplay, hideSizePanel,
  updateSelectionUI, selectAll, syncPageUI,
  zOrderOp, doShuffle,
} from './ui.js';
import { initPages, renderPageBar } from './pages.js';
import { restoreSession, scheduleSave } from './persist.js';

export function createSketch(p) {

  /* ══════════════════════════════════════════════
     SETUP
  ══════════════════════════════════════════════ */
  let lastWheelTime = 0;
  p.setup = function () {
    const cnv = p.createCanvas(p.windowWidth, p.windowHeight);
    cnv.style('position', 'fixed');
    cnv.style('top',  '0');
    cnv.style('left', '0');
    cnv.style('z-index', '0');
    p.imageMode(p.CORNER);
    p.rectMode(p.CORNER);
    p.textAlign(p.CENTER, p.CENTER);
    p.noSmooth();
    fitScreen();
    initFilesP5(p);
    initExportP5(p);
    initUI(fitScreen);
    initPages();
    restoreSession(p).then(restored => {
      if (restored) { renderPageBar(); syncPageUI(); }
      fitScreen();
    });
  };

  p.windowResized = function () {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
  };

  /* ══════════════════════════════════════════════
     DRAW
  ══════════════════════════════════════════════ */
  p.draw = function () {
    const body = document.body;
    const light = body && body.classList.contains('theme-light');
    p.background(light ? '#e8e4df' : '#141414');

    p.push();
    p.translate(state.panX, state.panY);
    p.scale(state.zoomLevel);

    if (state.snapEnabled) drawSnapGrid();

    // Pass 1 – all images at 40 % opacity (visible outside artboard)
    if (state.imgs.some(i => i.p5img)) {
      p.tint(255, 102);
      for (const im of state.imgs) {
        if (im.p5img) drawImage(im);
      }
      p.noTint();
    }

    // Artboard fill (no shadow)
    p.drawingContext.shadowBlur  = 0;
    p.drawingContext.shadowColor = 'transparent';
    p.fill(state.bgColor);
    p.noStroke();
    p.rect(state.artboard.x, state.artboard.y, state.artboard.w, state.artboard.h);

    // Pass 2 – full-opacity, clipped to artboard
    p.drawingContext.save();
    p.drawingContext.beginPath();
    p.drawingContext.rect(state.artboard.x, state.artboard.y, state.artboard.w, state.artboard.h);
    p.drawingContext.clip();
    for (const im of state.imgs) {
      if (im.p5img && rectsOverlap(im, state.artboard))
        drawImage(im);
    }
    p.drawingContext.restore();

    // Artboard border
    p.noFill();
    p.stroke(255);
    p.strokeWeight(1 / state.zoomLevel);
    p.rect(state.artboard.x, state.artboard.y, state.artboard.w, state.artboard.h);

    drawCornerMarkers();
    if (state.currentRatio === 'Free') drawArtboardHandles();

    // Page title label below artboard
    const currentPage = state.pages[state.currentPageIdx];
    if (currentPage) {
      p.noStroke();
      p.fill(255, 255, 255, 28);
      p.textSize(11 / state.zoomLevel);
      p.text(
        currentPage.title,
        state.artboard.x + state.artboard.w / 2,
        state.artboard.y + state.artboard.h + 18 / state.zoomLevel
      );
    }

    // ── Multi-select highlights (dashed border + resize handle) ──
    if (state.selectedIds.size > 0 && !state.cropTarget) {
      const bounds = getSelectedBounds();
      p.drawingContext.save();
      p.drawingContext.globalCompositeOperation = 'difference'; // always visible on any bg
      p.drawingContext.setLineDash([6, 4]);
      p.noFill();
      p.stroke(255);
      p.strokeWeight(2.5 / state.zoomLevel);

      if (state.selectedIds.size === 1) {
        // Single selection highlight
        const im = state.imgs.find(i => i.id === Array.from(state.selectedIds)[0]);
        if (im && im.p5img) p.rect(im.x, im.y, im.w, im.h);
      } else {
        // Group highlight (bounding box)
        p.rect(bounds.x, bounds.y, bounds.w, bounds.h);
        p.strokeWeight(1 / state.zoomLevel);
        p.stroke(255, 128);
        for (const id of state.selectedIds) {
          const im = state.imgs.find(i => i.id === id);
          if (im && im.p5img) p.rect(im.x, im.y, im.w, im.h);
        }
      }
      p.drawingContext.setLineDash([]);

      // Resize handle at bottom-right (same difference context)
      const hs = 10 / state.zoomLevel;
      p.fill(255); p.noStroke();
      p.rect(bounds.x + bounds.w - hs / 2, bounds.y + bounds.h - hs / 2, hs, hs);
      p.drawingContext.restore();
    }

    // ── Rubber-band rect ──
    if (state.dragMode === 'rubberband' && state.rbStart && state.rbEnd) {
      const x1 = Math.min(state.rbStart.x, state.rbEnd.x);
      const y1 = Math.min(state.rbStart.y, state.rbEnd.y);
      const x2 = Math.max(state.rbStart.x, state.rbEnd.x);
      const y2 = Math.max(state.rbStart.y, state.rbEnd.y);
      p.drawingContext.save();
      p.drawingContext.setLineDash([5, 4]);
      p.stroke(255);
      p.strokeWeight(1 / state.zoomLevel);
      p.fill(255, 255, 255, 0x20);
      p.rect(x1, y1, x2 - x1, y2 - y1);
      p.drawingContext.setLineDash([]);
      p.drawingContext.restore();
    }

    // ── Crop overlay ──
    if (state.cropTarget && state.cropRect) {
      const im = state.imgs.find(i => i.id === state.cropTarget);
      if (im) drawCropUI(im);
    }

    p.pop();

    // Empty-board hint
    if (state.imgs.length === 0) {
      p.noStroke();
      p.fill(255, 255, 255, 18);
      p.textSize(13);
      p.text('Upload or drop images to begin', p.width / 2, p.height / 2);
    }

    document.getElementById('zoom-val').textContent = Math.round(state.zoomLevel * 100) + '%';
  };

  /* ── helpers ── */
  function getPanelW() {
    const el = document.getElementById('panel');
    return (el && el.offsetWidth) || PANEL_W;
  }

  function drawSnapGrid() {
    const x1 = (0                             - state.panX) / state.zoomLevel;
    const y1 = (0                             - state.panY) / state.zoomLevel;
    const x2 = (p.windowWidth - getPanelW()   - state.panX) / state.zoomLevel;
    const y2 = (p.windowHeight                - state.panY) / state.zoomLevel;
    if (((x2 - x1) / SNAP_GRID) * ((y2 - y1) / SNAP_GRID) > 6000) return;
    p.noStroke(); p.fill(255, 255, 255, 16);
    const r  = 1.5 / state.zoomLevel;
    const sx = Math.floor(x1 / SNAP_GRID) * SNAP_GRID;
    const sy = Math.floor(y1 / SNAP_GRID) * SNAP_GRID;
    for (let gx = sx; gx <= x2; gx += SNAP_GRID)
      for (let gy = sy; gy <= y2; gy += SNAP_GRID)
        p.ellipse(gx, gy, r * 2, r * 2);
  }

  function drawCornerMarkers() {
    p.stroke(180);
    p.strokeWeight(1.5 / state.zoomLevel);
    const arm = 18 / state.zoomLevel;
    const gap =  8 / state.zoomLevel;
    const { x, y, w, h } = state.artboard;
    p.line(x - gap - arm, y,     x - gap,           y);
    p.line(x,             y - gap - arm, x,          y - gap);
    p.line(x + w + gap,   y,     x + w + gap + arm,  y);
    p.line(x + w,         y - gap - arm, x + w,      y - gap);
    p.line(x - gap - arm, y + h, x - gap,            y + h);
    p.line(x,             y + h + gap,   x,           y + h + gap + arm);
    p.line(x + w + gap,   y + h, x + w + gap + arm,  y + h);
    p.line(x + w,         y + h + gap,   x + w,       y + h + gap + arm);
  }

  function drawArtboardHandles() {
    const s = 9 / state.zoomLevel;
    const { x, y, w, h } = state.artboard;
    p.noStroke(); p.fill(255);
    [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy]) =>
      p.rect(cx - s / 2, cy - s / 2, s, s));
  }

  /* ══════════════════════════════════════════════
     COORDINATE HELPERS
  ══════════════════════════════════════════════ */
  function s2w(sx, sy) {
    return { x: (sx - state.panX) / state.zoomLevel, y: (sy - state.panY) / state.zoomLevel };
  }

  function hitTest(wx, wy) {
    for (let i = state.imgs.length - 1; i >= 0; i--) {
      const im = state.imgs[i];
      if (wx >= im.x && wx < im.x + im.w && wy >= im.y && wy < im.y + im.h) return i;
    }
    return -1;
  }

  function getSelectedBounds() {
    if (state.selectedIds.size === 0) return { x: 0, y: 0, w: 0, h: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of state.selectedIds) {
      const im = state.imgs.find(i => i.id === id);
      if (im) {
        minX = Math.min(minX, im.x);
        minY = Math.min(minY, im.y);
        maxX = Math.max(maxX, im.x + im.w);
        maxY = Math.max(maxY, im.y + im.h);
      }
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function isOnResizeHandle(wx, wy) {
    if (state.selectedIds.size === 0) return false;
    const bounds = getSelectedBounds();
    const t = 14 / state.zoomLevel;
    return Math.abs(wx - (bounds.x + bounds.w)) < t && Math.abs(wy - (bounds.y + bounds.h)) < t;
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function drawImage(im) {
    p.push();
    p.translate(im.x + im.w / 2, im.y + im.h / 2);
    if (im.rotation) p.rotate(im.rotation * Math.PI / 180);
    if (im.flipX)    p.scale(-1,  1);
    if (im.flipY)    p.scale( 1, -1);
    p.imageMode(p.CENTER);
    // For 90°/270° the draw dimensions must be swapped so the image fills the
    // (already-swapped) slot — drawing (w,h) in a 90°-rotated frame occupies
    // (h,w) on screen, so we invert to get the slot dimensions back.
    const rot = im.rotation || 0;
    const dw = (rot === 90 || rot === 270) ? im.h : im.w;
    const dh = (rot === 90 || rot === 270) ? im.w : im.h;
    if (im.crop) {
      const sx = im.crop.x * im.p5img.width;
      const sy = im.crop.y * im.p5img.height;
      const sw = im.crop.w * im.p5img.width;
      const sh = im.crop.h * im.p5img.height;
      p.image(im.p5img, 0, 0, dw, dh, sx, sy, sw, sh);
    } else {
      p.image(im.p5img, 0, 0, dw, dh);
    }
    p.pop();
  }

  function drawCropUI(im) {
    const cr = state.cropRect;
    const rx = im.x + cr.x * im.w;
    const ry = im.y + cr.y * im.h;
    const rw = cr.w * im.w;
    const rh = cr.h * im.h;

    // Dark mask outside crop rect
    p.noStroke();
    p.fill(0, 0, 0, 140);
    p.rect(im.x,      im.y,      im.w,         ry - im.y);
    p.rect(im.x,      ry + rh,   im.w,         im.y + im.h - ry - rh);
    p.rect(im.x,      ry,        rx - im.x,    rh);
    p.rect(rx + rw,   ry,        im.x + im.w - rx - rw, rh);

    // Crop border
    p.noFill();
    p.stroke(255);
    p.strokeWeight(1.5 / state.zoomLevel);
    p.rect(rx, ry, rw, rh);

    // Rule-of-thirds grid
    p.stroke(255, 80);
    p.strokeWeight(0.5 / state.zoomLevel);
    for (let t = 1; t <= 2; t++) {
      p.line(rx + rw * t / 3, ry, rx + rw * t / 3, ry + rh);
      p.line(rx, ry + rh * t / 3, rx + rw, ry + rh * t / 3);
    }

    // Corner handles
    const hs = 8 / state.zoomLevel;
    p.fill(255); p.noStroke();
    [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]].forEach(([hx, hy]) => {
      p.rect(hx - hs / 2, hy - hs / 2, hs, hs);
    });
  }

  function getCropHandle(wx, wy, im) {
    if (!state.cropRect) return null;
    const cr = state.cropRect;
    const rx = im.x + cr.x * im.w, ry = im.y + cr.y * im.h;
    const rw = cr.w * im.w,        rh = cr.h * im.h;
    const t  = 14 / state.zoomLevel;
    const corners = [
      { n: 'tl', x: rx,      y: ry      },
      { n: 'tr', x: rx + rw, y: ry      },
      { n: 'bl', x: rx,      y: ry + rh },
      { n: 'br', x: rx + rw, y: ry + rh },
    ];
    for (const c of corners)
      if (Math.abs(wx - c.x) < t && Math.abs(wy - c.y) < t) return c.n;
    return null;
  }

  function applyCrop() {
    const im = state.imgs.find(i => i.id === state.cropTarget);
    if (im && state.cropRect) {
      const cr  = state.cropRect;
      const EPS = 0.005;
      const nativeAr = im.p5img.width / im.p5img.height;
      const rot      = im.rotation || 0;
      const swapped  = rot === 90 || rot === 270;

      if (cr.x < EPS && cr.y < EPS && cr.w > 1 - EPS && cr.h > 1 - EPS) {
        im.crop = null;
        im.ar   = swapped ? 1 / nativeAr : nativeAr;
      } else {
        im.crop = { ...cr };
        // Cropped-region aspect ratio in source-image space, then account for rotation
        const cropAr = (cr.w / cr.h) * nativeAr;
        im.ar = swapped ? 1 / cropAr : cropAr;
      }
      // Resize height so the slot matches the new proportions without distortion
      im.h = im.w / im.ar;
    }
    state.cropTarget = null;
    state.cropRect   = null;
    const btn = document.getElementById('btn-crop');
    if (btn) btn.classList.remove('active');
    scheduleSave();
  }

  function isOnArtboardBorder(wx, wy) {
    const t = 9 / state.zoomLevel;
    const { x, y, w, h } = state.artboard;
    const inH = wy >= y - t && wy <= y + h + t;
    const inV = wx >= x - t && wx <= x + w + t;
    return (Math.abs(wx - x)       < t && inH) ||
           (Math.abs(wx - (x + w)) < t && inH) ||
           (Math.abs(wy - y)       < t && inV) ||
           (Math.abs(wy - (y + h)) < t && inV);
  }

  function getArtboardCorner(wx, wy) {
    const t = 14 / state.zoomLevel;
    const { x, y, w, h } = state.artboard;
    if (Math.abs(wx - x)     < t && Math.abs(wy - y)     < t) return 'tl';
    if (Math.abs(wx - x - w) < t && Math.abs(wy - y)     < t) return 'tr';
    if (Math.abs(wx - x)     < t && Math.abs(wy - y - h) < t) return 'bl';
    if (Math.abs(wx - x - w) < t && Math.abs(wy - y - h) < t) return 'br';
    return null;
  }

  function resizeArtboardCorner() {
    const dx = (p.mouseX - state.dragRef.mx) / state.zoomLevel;
    const dy = (p.mouseY - state.dragRef.my) / state.zoomLevel;
    const { ab } = state.dragRef;
    const MIN = 100;
    switch (state.dragCorner) {
      case 'tl':
        state.artboard.x = ab.x + dx;       state.artboard.y = ab.y + dy;
        state.artboard.w = Math.max(MIN, ab.w - dx); state.artboard.h = Math.max(MIN, ab.h - dy); break;
      case 'tr':
        state.artboard.y = ab.y + dy;
        state.artboard.w = Math.max(MIN, ab.w + dx); state.artboard.h = Math.max(MIN, ab.h - dy); break;
      case 'bl':
        state.artboard.x = ab.x + dx;
        state.artboard.w = Math.max(MIN, ab.w - dx); state.artboard.h = Math.max(MIN, ab.h + dy); break;
      case 'br':
        state.artboard.w = Math.max(MIN, ab.w + dx); state.artboard.h = Math.max(MIN, ab.h + dy); break;
    }
  }

  /* ══════════════════════════════════════════════
     MOUSE EVENTS
  ══════════════════════════════════════════════ */
  p.mousePressed = function () {
    if (p.mouseX > p.width - getPanelW()) return;
    const w = s2w(p.mouseX, p.mouseY);
    state.didDrag = false;

    // 0. Crop mode — intercept all mouse input
    if (state.cropTarget) {
      const im = state.imgs.find(i => i.id === state.cropTarget);
      if (im) {
        const handle = getCropHandle(w.x, w.y, im);
        if (handle) {
          state.dragMode = 'crop-handle';
          state.dragRef  = { mx: p.mouseX, my: p.mouseY, handle, cr: { ...state.cropRect }, im: { x: im.x, y: im.y, w: im.w, h: im.h } };
          return false;
        }
        // Drag inside crop rect to pan the crop window
        const cr = state.cropRect;
        const rx = im.x + cr.x * im.w, ry = im.y + cr.y * im.h;
        if (w.x >= rx && w.x <= rx + cr.w * im.w && w.y >= ry && w.y <= ry + cr.h * im.h) {
          state.dragMode = 'crop-move';
          state.dragRef  = { mx: p.mouseX, my: p.mouseY, cr: { ...state.cropRect }, im: { x: im.x, y: im.y, w: im.w, h: im.h } };
          return false;
        }
      }
      return false; // eat clicks outside crop area while in crop mode
    }

    // 1. Free-mode artboard corner resize
    if (state.currentRatio === 'Free') {
      const c = getArtboardCorner(w.x, w.y);
      if (c) {
        state.dragMode   = 'corner';
        state.dragCorner = c;
        state.dragRef    = { mx: p.mouseX, my: p.mouseY, ab: { ...state.artboard } };
        return false;
      }
    }

    // 2. Resize handle
    if (state.selectedIds.size > 0 && isOnResizeHandle(w.x, w.y)) {
      saveState();
      const bounds = getSelectedBounds();
      state.dragMode = 'resize';
      state.dragRef = {
        mx: p.mouseX,
        startBounds: bounds,
        initialStates: Array.from(state.selectedIds).map(id => {
          const im = state.imgs.find(i => i.id === id);
          return { id, x: im.x, y: im.y, w: im.w, h: im.h };
        })
      };
      return false;
    }

    // 3. Artboard border drag
    if (isOnArtboardBorder(w.x, w.y)) {
      state.dragMode = 'artboard';
      state.dragRef  = { mx: p.mouseX, my: p.mouseY, ax: state.artboard.x, ay: state.artboard.y };
      return false;
    }

    // 4. Image hit
    const hit = hitTest(w.x, w.y);
    if (hit !== -1) {
      const hitId = state.imgs[hit].id;

      if (state.selectedIds.has(hitId) && state.selectedIds.size > 1) {
        // Group drag: clicked image is part of an existing multi-selection
        saveState();
        state.dragMode = 'group';
        state.dragRef  = {
          mx: p.mouseX, my: p.mouseY,
          leadId: hitId,
          offsets: Array.from(state.selectedIds).map(id => {
            const im = state.imgs.find(i => i.id === id);
            return { id, ix: im.x, iy: im.y };
          }),
        };
      } else {
        // Single select + drag
        saveState();
        state.selectedIds.clear();
        state.selectedIds.add(hitId);
        state.selIdx   = hit;
        state.dragMode = 'image';
        state.dragRef  = { mx: p.mouseX, my: p.mouseY, ix: state.imgs[hit].x, iy: state.imgs[hit].y };
        updateSelectionUI();
      }
      return false;
    }

    // 5. Empty area — left drag = rubber-band, middle/right drag = pan
    if (p.mouseButton === 'right' || p.mouseButton === 'center') {
      state.selectedIds.clear();
      state.selIdx   = -1;
      state.dragMode = 'pan';
      state.dragRef  = { mx: p.mouseX, my: p.mouseY, px: state.panX, py: state.panY };
    } else {
      state.dragMode = 'rubberband';
      state.rbStart  = { x: w.x, y: w.y };
      state.rbEnd    = { x: w.x, y: w.y };
      state.dragRef  = {};
    }
    return false;
  };

  p.mouseDragged = function () {
    if (!state.dragMode || !state.dragRef) return false;
    state.didDrag = true;

    if (state.dragMode === 'crop-handle') {
      const dx = (p.mouseX - state.dragRef.mx) / state.zoomLevel;
      const dy = (p.mouseY - state.dragRef.my) / state.zoomLevel;
      const { handle, cr: o, im } = state.dragRef;
      const MIN = 0.05;
      let { x, y, w, h } = o;
      if (handle === 'tl') {
        const nx = Math.min(x + w - MIN, x + dx / im.w);
        const ny = Math.min(y + h - MIN, y + dy / im.h);
        w += x - nx; h += y - ny; x = nx; y = ny;
      } else if (handle === 'tr') {
        const ny = Math.min(y + h - MIN, y + dy / im.h);
        h += y - ny; y = ny; w = Math.max(MIN, w + dx / im.w);
      } else if (handle === 'bl') {
        const nx = Math.min(x + w - MIN, x + dx / im.w);
        w += x - nx; x = nx; h = Math.max(MIN, h + dy / im.h);
      } else {
        w = Math.max(MIN, w + dx / im.w); h = Math.max(MIN, h + dy / im.h);
      }
      x = Math.max(0, Math.min(x, 1 - MIN));
      y = Math.max(0, Math.min(y, 1 - MIN));
      w = Math.max(MIN, Math.min(w, 1 - x));
      h = Math.max(MIN, Math.min(h, 1 - y));
      state.cropRect = { x, y, w, h };

    } else if (state.dragMode === 'crop-move') {
      const dx = (p.mouseX - state.dragRef.mx) / state.zoomLevel;
      const dy = (p.mouseY - state.dragRef.my) / state.zoomLevel;
      const { cr: o, im } = state.dragRef;
      let x = Math.max(0, Math.min(o.x + dx / im.w, 1 - o.w));
      let y = Math.max(0, Math.min(o.y + dy / im.h, 1 - o.h));
      state.cropRect = { x, y, w: o.w, h: o.h };

    } else if (state.dragMode === 'image' && state.selIdx >= 0) {
      const dx = (p.mouseX - state.dragRef.mx) / state.zoomLevel;
      const dy = (p.mouseY - state.dragRef.my) / state.zoomLevel;
      let nx = state.dragRef.ix + dx, ny = state.dragRef.iy + dy;
      if (state.snapEnabled)
        ({ x: nx, y: ny } = snapPos(nx, ny, state.imgs[state.selIdx].w, state.imgs[state.selIdx].h, state.selIdx));
      state.imgs[state.selIdx].x = nx;
      state.imgs[state.selIdx].y = ny;

    } else if (state.dragMode === 'group') {
      const dx = (p.mouseX - state.dragRef.mx) / state.zoomLevel;
      const dy = (p.mouseY - state.dragRef.my) / state.zoomLevel;

      if (state.snapEnabled) {
        const leadOff = state.dragRef.offsets.find(o => o.id === state.dragRef.leadId);
        const leadIm  = state.imgs.find(i => i.id === state.dragRef.leadId);
        if (leadOff && leadIm) {
          const { x: sx, y: sy } = snapPos(
            leadOff.ix + dx, leadOff.iy + dy,
            leadIm.w, leadIm.h, state.selectedIds
          );
          const sdx = sx - leadOff.ix, sdy = sy - leadOff.iy;
          for (const off of state.dragRef.offsets) {
            const im = state.imgs.find(i => i.id === off.id);
            if (im) { im.x = off.ix + sdx; im.y = off.iy + sdy; }
          }
        }
      } else {
        for (const off of state.dragRef.offsets) {
          const im = state.imgs.find(i => i.id === off.id);
          if (im) { im.x = off.ix + dx; im.y = off.iy + dy; }
        }
      }

    } else if (state.dragMode === 'resize') {
      const dx = (p.mouseX - state.dragRef.mx) / state.zoomLevel;
      const { startBounds, initialStates } = state.dragRef;
      const scale = Math.max(0.01, (startBounds.w + dx) / startBounds.w);

      for (const st of initialStates) {
        const im = state.imgs.find(i => i.id === st.id);
        if (im) {
          // Resize relative to selection top-left
          const relX = st.x - startBounds.x;
          const relY = st.y - startBounds.y;
          im.w = Math.max(5, st.w * scale);
          im.h = im.w / (im.ar || 1);
          im.x = startBounds.x + relX * scale;
          im.y = startBounds.y + relY * scale;
        }
      }

    } else if (state.dragMode === 'artboard') {
      const dx = (p.mouseX - state.dragRef.mx) / state.zoomLevel;
      const dy = (p.mouseY - state.dragRef.my) / state.zoomLevel;
      state.artboard.x = state.dragRef.ax + dx;
      state.artboard.y = state.dragRef.ay + dy;

    } else if (state.dragMode === 'corner') {
      resizeArtboardCorner();

    } else if (state.dragMode === 'pan') {
      state.panX = state.dragRef.px + (p.mouseX - state.dragRef.mx);
      state.panY = state.dragRef.py + (p.mouseY - state.dragRef.my);

    } else if (state.dragMode === 'rubberband') {
      const wc = s2w(p.mouseX, p.mouseY);
      state.rbEnd = { x: wc.x, y: wc.y };
    }
    return false;
  };

  p.mouseReleased = function () {
    const wasDragging = state.didDrag;

    if (state.dragMode === 'corner') {
      updateDimDisplay();
      document.getElementById('ratio-sel').value = 'Free';
      state.currentRatio = 'Free';
      scheduleSave();
    }

    if (state.dragMode === 'rubberband') {
      if (!wasDragging) {
        // Plain click on empty canvas → deselect all
        state.selectedIds.clear();
        state.selIdx = -1;
      } else if (state.rbStart && state.rbEnd) {
        const x1 = Math.min(state.rbStart.x, state.rbEnd.x);
        const y1 = Math.min(state.rbStart.y, state.rbEnd.y);
        const x2 = Math.max(state.rbStart.x, state.rbEnd.x);
        const y2 = Math.max(state.rbStart.y, state.rbEnd.y);
        const rb = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
        state.selectedIds.clear();
        for (const im of state.imgs) {
          if (rectsOverlap(im, rb)) state.selectedIds.add(im.id);
        }
        state.selIdx = -1;
      }
      state.rbStart = null;
      state.rbEnd   = null;
      updateSelectionUI();
    }

    state.dragMode   = null;
    state.dragRef    = null;
    state.dragCorner = null;
    state.didDrag    = false;
  };

  p.mouseWheel = function (event) {
    if (p.mouseX > p.width - getPanelW()) return;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (now - lastWheelTime < 50) return false;  // ~20fps cap kills trackpad momentum
    lastWheelTime = now;
    // Normalize line-mode (mouse wheel) to pixel equivalent, then scale + cap at ±10% per event
    const raw    = event.deltaMode === 1 ? event.deltaY * 40 : event.deltaY;
    const factor = Math.max(-0.10, Math.min(0.10, raw * 0.0008));
    // Multiplicative zoom: consistent feel at every zoom level
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoomLevel * (1 - factor)));
    const wx = (p.mouseX - state.panX) / state.zoomLevel;
    const wy = (p.mouseY - state.panY) / state.zoomLevel;
    state.zoomLevel = newZoom;
    state.panX = p.mouseX - wx * state.zoomLevel;
    state.panY = p.mouseY - wy * state.zoomLevel;
    return false;
  };

  /* ══════════════════════════════════════════════
     KEYBOARD
  ══════════════════════════════════════════════ */
  p.keyPressed = function () {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.isContentEditable)) return;

    // Crop mode: Enter = apply, Escape = cancel, eat everything else
    if (state.cropTarget) {
      if (p.keyCode === p.ENTER)  { applyCrop(); return false; }
      if (p.keyCode === p.ESCAPE) {
        state.cropTarget = null; state.cropRect = null;
        const btn = document.getElementById('btn-crop');
        if (btn) btn.classList.remove('active');
        return false;
      }
      return false;
    }

    // Escape → dismiss welcome if visible, then close size panel
    if (p.keyCode === p.ESCAPE) {
      const wc = document.getElementById('welcome');
      if (wc && wc.classList.contains('show')) { wc.classList.remove('show'); return false; }
      document.getElementById('ratio-sel').value = state.currentRatio;
      hideSizePanel(); return false;
    }

    const ctrl = p.keyIsDown(p.CONTROL) || p.keyIsDown(91);

    // Ctrl+Z → Undo
    if (p.keyCode === 90 && ctrl) { restoreState(); return false; }
    // Ctrl+A → Select All
    if (p.keyCode === 65 && ctrl) { selectAll(); return false; }

    // Space → Shuffle
    if (p.key === ' ') { doShuffle(); return false; }

    // F → Fit to screen
    if (p.key === 'f' || p.key === 'F') { fitScreen(); return false; }

    // Delete / Backspace → remove selected
    if ((p.key === 'Delete' || p.keyCode === p.BACKSPACE) && state.selectedIds.size > 0) {
      saveState(); removeSelected(); updateSelectionUI(); return false;
    }

    // ── Image shortcuts (require a selection) ──
    if (state.selectedIds.size > 0) {
      // Alt+↑ / Alt+Shift+↑ → move forward / bring to front
      if (p.keyIsDown(18) && p.keyCode === p.UP_ARROW) {
        zOrderOp(p.keyIsDown(p.SHIFT) ? 'top' : 'up'); return false;
      }
      // Alt+↓ / Alt+Shift+↓ → move backward / send to back
      if (p.keyIsDown(18) && p.keyCode === p.DOWN_ARROW) {
        zOrderOp(p.keyIsDown(p.SHIFT) ? 'bottom' : 'down'); return false;
      }

      // Letter shortcuts — skip if Ctrl is held (avoids browser conflicts)
      if (!ctrl) {
        if (p.key === 'r' || p.key === 'R') {
          document.getElementById('btn-rotate').click(); return false;
        }
        if (p.key === 'h' || p.key === 'H') {
          document.getElementById('btn-flip-h').click(); return false;
        }
        if (p.key === 'v' || p.key === 'V') {
          document.getElementById('btn-flip-v').click(); return false;
        }
        if ((p.key === 'c' || p.key === 'C') && state.selectedIds.size === 1) {
          const btn = document.getElementById('btn-crop');
          if (btn && btn.style.display !== 'none') { btn.click(); return false; }
        }
      }
    }
  };
}
