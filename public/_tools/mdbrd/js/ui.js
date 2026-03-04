import { state }                         from './state.js';
import { ARTBOARD_PRESETS }              from './config.js';
import { toast }                         from './toast.js';
import { doZoom }                        from './viewport.js';
import { saveState, restoreState, updateUndoBtn } from './undo.js';
import { shuffleLayout, layoutImages }   from './layout.js';
import { loadFiles, removeSelected }      from './files.js';
import { exportHD }                      from './export.js';
import { scheduleSave, deleteBlobForImage } from './persist.js';

export { toast };

/* ── Z-order (module-level so sketch.js can bind keys to it) ── */
export function zOrderOp(op) {
  if (!state.selectedIds.size) return;
  saveState();
  const imgs = state.imgs;
  if (op === 'top') {
    const sel  = imgs.filter(i =>  state.selectedIds.has(i.id));
    const rest = imgs.filter(i => !state.selectedIds.has(i.id));
    imgs.length = 0; imgs.push(...rest, ...sel);
  } else if (op === 'bottom') {
    const sel  = imgs.filter(i =>  state.selectedIds.has(i.id));
    const rest = imgs.filter(i => !state.selectedIds.has(i.id));
    imgs.length = 0; imgs.push(...sel, ...rest);
  } else if (op === 'up') {
    for (let i = imgs.length - 2; i >= 0; i--)
      if (state.selectedIds.has(imgs[i].id) && !state.selectedIds.has(imgs[i + 1].id))
        [imgs[i], imgs[i + 1]] = [imgs[i + 1], imgs[i]];
  } else if (op === 'down') {
    for (let i = 1; i < imgs.length; i++)
      if (state.selectedIds.has(imgs[i].id) && !state.selectedIds.has(imgs[i - 1].id))
        [imgs[i], imgs[i - 1]] = [imgs[i - 1], imgs[i]];
  }
  scheduleSave();
}

export function doShuffle() {
  shuffleLayout(saveState);
  scheduleSave();
}

/* ── Selection UI ── */
export function updateSelectionUI() {
  const count = state.selectedIds.size;
  const el = document.getElementById('sel-count');
  if (el) el.textContent = count > 0 ? `${count} selected` : '';

  const show = count > 0;
  ['img-act-sep', 'img-act-section'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.style.display = show ? '' : 'none';
  });
  const cropBtn = document.getElementById('btn-crop');
  if (cropBtn) {
    cropBtn.style.display = count === 1 ? '' : 'none';
    if (!state.cropTarget) cropBtn.classList.remove('active');
  }
}

export function selectAll() {
  state.selectedIds = new Set(state.imgs.map(i => i.id));
  state.selIdx = -1;
  updateSelectionUI();
}

/* ── Dim display / size panel ── */
export function updateDimDisplay() {
  const w = Math.round(state.artboard.w), h = Math.round(state.artboard.h);
  document.getElementById('dim-display').textContent =
    state.currentRatio === 'Free' ? `Free | ${w} × ${h}` : `${w} × ${h}`;
}

export function showSizePanel() {
  const panel     = document.getElementById('size-panel');
  const sidePanel = document.getElementById('panel');
  const anchor    = document.getElementById('dim-display');
  const rect      = anchor.getBoundingClientRect();
  document.getElementById('sp-w').value = Math.round(state.artboard.w);
  document.getElementById('sp-h').value = Math.round(state.artboard.h);
  panel.classList.add('open');  // add first so offsetWidth is measurable
  const panelLeft = sidePanel ? sidePanel.getBoundingClientRect().left : (window.innerWidth - 200);
  panel.style.top  = rect.top + 'px';
  panel.style.left = (panelLeft - panel.offsetWidth - 8) + 'px';
  setTimeout(() => document.getElementById('sp-w').focus(), 0);
}

export function hideSizePanel() {
  document.getElementById('size-panel').classList.remove('open');
}

export function setRatio(key, fitScreenFn) {
  state.currentRatio = key;
  if (ARTBOARD_PRESETS[key]) {
    state.artboard.w = ARTBOARD_PRESETS[key].w;
    state.artboard.h = ARTBOARD_PRESETS[key].h;
    state.orientation = state.artboard.w >= state.artboard.h ? 'landscape' : 'portrait';
  }
  updateDimDisplay();
  fitScreenFn();
}

/* ── Main UI init ── */
export function initUI(fitScreenFn) {
  const fileIn = document.getElementById('file-input');

  document.getElementById('btn-upload').onclick = () => fileIn.click();
  fileIn.addEventListener('change', () => {
    loadFiles(fileIn.files, fitScreenFn, toast);
    fileIn.value = '';
  });

  // Drag & drop
  let dragCnt = 0;
  const dropOv = document.getElementById('drop-ov');
  document.addEventListener('dragenter', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    if (++dragCnt > 0) dropOv.classList.add('on');
  });
  document.addEventListener('dragleave', () => {
    if (--dragCnt <= 0) { dragCnt = 0; dropOv.classList.remove('on'); }
  });
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault(); dragCnt = 0; dropOv.classList.remove('on');
    if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files, fitScreenFn, toast);
  });

  // Toolbar buttons
  document.getElementById('btn-shuffle').onclick = () => { shuffleLayout(saveState); scheduleSave(); };
  document.getElementById('btn-fit').onclick     = fitScreenFn;
  document.getElementById('btn-zin').onclick     = () => doZoom( 0.1, window.innerWidth / 2, window.innerHeight / 2);
  document.getElementById('btn-zout').onclick    = () => doZoom(-0.1, window.innerWidth / 2, window.innerHeight / 2);
  document.getElementById('btn-undo').onclick    = restoreState;
  document.getElementById('btn-select-all').onclick = selectAll;

  const snapBtn = document.getElementById('btn-snap');
  function syncSnapButton() {
    if (!snapBtn) return;
    snapBtn.textContent = state.snapEnabled ? 'Snap ON' : 'Snap OFF';
    snapBtn.classList.toggle('active', state.snapEnabled);
    snapBtn.classList.toggle('snap-on', state.snapEnabled);
    snapBtn.classList.toggle('snap-off', !state.snapEnabled);
  }
  if (snapBtn) {
    snapBtn.onclick = () => {
      state.snapEnabled = !state.snapEnabled;
      syncSnapButton();
      toast(state.snapEnabled ? 'Snap on' : 'Snap off');
    };
    syncSnapButton();
  }

  document.getElementById('btn-clear').onclick = () => {
    if (!state.imgs.length) return;
    saveState();
    const idsToDelete = state.imgs.map(im => im.id);
    state.imgs.forEach(im => { if (im.url) URL.revokeObjectURL(im.url); });
    state.imgs = []; state.selIdx = -1; state.selectedIds.clear();
    updateSelectionUI();
    idsToDelete.forEach(id => deleteBlobForImage(id));
    scheduleSave();
    toast('Board cleared');
  };

  document.getElementById('btn-export').onclick = () => {
    const fmt = document.getElementById('export-fmt').value;
    exportHD(toast, fmt);
  };

  // Layout mode toggle
  const btnLayoutStructured    = document.getElementById('btn-layout-structured');
  const btnLayoutRows          = document.getElementById('btn-layout-rows');
  const btnLayoutBricks        = document.getElementById('btn-layout-bricks');
  const btnLayoutCloud         = document.getElementById('btn-layout-cloud');
  const btnLayoutCloudBricks   = document.getElementById('btn-layout-cloudbricks');
  const btnLayoutScatter       = document.getElementById('btn-layout-scatter');
  const btnLayoutOrient        = document.getElementById('btn-layout-orient');
  const colrowWrap             = document.getElementById('colrow-wrap');
  const colrowLabel            = document.getElementById('colrow-label');
  const colrowInput            = document.getElementById('colrow-input');
  const gapInput               = document.getElementById('gap-input');
  const btnOrient              = document.getElementById('btn-orient');
  const btnThemeLight          = document.getElementById('btn-theme-light');
  const btnThemeDark           = document.getElementById('btn-theme-dark');

  const SVG_LANDSCAPE = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><rect x="1" y="4.5" width="16" height="9" rx="1.5"/></svg>`;
  const SVG_PORTRAIT  = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><rect x="4.5" y="1" width="9" height="16" rx="1.5"/></svg>`;

  function syncLayoutButtons() {
    if (!btnLayoutStructured || !btnLayoutRows) return;
    btnLayoutStructured.classList.toggle('active', state.layoutMode === 'masonry');
    btnLayoutRows.classList.toggle('active', state.layoutMode === 'rows');
    if (btnLayoutBricks)      btnLayoutBricks.classList.toggle('active', state.layoutMode === 'bricks');
    if (btnLayoutCloud)       btnLayoutCloud.classList.toggle('active', state.layoutMode === 'cloud');
    if (btnLayoutCloudBricks) btnLayoutCloudBricks.classList.toggle('active', state.layoutMode === 'cloudbricks');
    if (btnLayoutScatter)     btnLayoutScatter.classList.toggle('active', state.layoutMode === 'scatter');
    syncColRowControl();
  }

  function syncColRowControl() {
    if (!colrowWrap) return;
    if (state.layoutMode === 'scatter') {
      colrowWrap.style.display = 'none';
      return;
    }
    colrowWrap.style.display = '';
    if (state.layoutMode === 'masonry') {
      colrowLabel.textContent = 'Cols';
      colrowInput.value = state.numCols > 0 ? state.numCols : '';
    } else {
      colrowLabel.textContent = 'Rows';
      colrowInput.value = state.numRows > 0 ? state.numRows : '';
    }
    if (gapInput) gapInput.value = state.layoutGap > 0 ? state.layoutGap : '';
  }

  function syncOrientationButtons() {
    // Canvas button: reflect actual artboard shape
    if (btnOrient)
      btnOrient.innerHTML = state.artboard.w >= state.artboard.h ? SVG_LANDSCAPE : SVG_PORTRAIT;
    // Layout button: reflect layout orientation state
    if (btnLayoutOrient)
      btnLayoutOrient.innerHTML = state.orientation === 'landscape' ? SVG_LANDSCAPE : SVG_PORTRAIT;
  }

  function applyOrientation(target) {
    const isLandscape = state.artboard.w >= state.artboard.h;
    const wantLandscape = target === 'landscape';
    if (isLandscape !== wantLandscape) {
      const tmp = state.artboard.w;
      state.artboard.w = state.artboard.h;
      state.artboard.h = tmp;
      updateDimDisplay();
      fitScreenFn();
    }
    state.orientation = target;
    syncOrientationButtons();
    layoutImages();
    scheduleSave();
  }

  const THEME_KEY = 'moodflow-theme';
  function applyTheme(theme) {
    const body = document.body;
    const t = theme === 'light' ? 'light' : 'dark';
    body.classList.remove('theme-light', 'theme-dark');
    body.classList.add('theme-' + t);
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch (e) {
      // ignore storage errors
    }
    if (btnThemeLight && btnThemeDark) {
      btnThemeLight.classList.toggle('active', t === 'light');
      btnThemeDark.classList.toggle('active', t === 'dark');
    }
  }

  if (colrowInput) {
    colrowInput.addEventListener('change', () => {
      const v = parseInt(colrowInput.value, 10);
      const val = (isNaN(v) || v < 1) ? 0 : Math.min(v, 20);
      colrowInput.value = val > 0 ? val : '';
      if (state.layoutMode === 'masonry') {
        state.numCols = val;
      } else {
        state.numRows = val;
      }
      layoutImages();
      scheduleSave();
    });
  }

  if (gapInput) {
    gapInput.addEventListener('change', () => {
      const v = parseInt(gapInput.value, 10);
      const val = (isNaN(v) || v < 0) ? 0 : Math.min(v, 500);
      gapInput.value = val > 0 ? val : '';
      state.layoutGap = val;
      layoutImages();
      scheduleSave();
    });
  }

  if (btnLayoutStructured && btnLayoutRows) {
    const setLayout = mode => {
      state.layoutMode = mode;
      syncLayoutButtons();
      layoutImages();
      scheduleSave();
    };
    btnLayoutStructured.onclick  = () => setLayout('masonry');
    btnLayoutRows.onclick        = () => setLayout('rows');
    if (btnLayoutBricks)       btnLayoutBricks.onclick       = () => setLayout('bricks');
    if (btnLayoutCloud)        btnLayoutCloud.onclick        = () => setLayout('cloud');
    if (btnLayoutCloudBricks)  btnLayoutCloudBricks.onclick  = () => setLayout('cloudbricks');
    if (btnLayoutScatter)      btnLayoutScatter.onclick      = () => setLayout('scatter');
    syncLayoutButtons();
  }

  if (btnLayoutOrient) {
    btnLayoutOrient.onclick = () => {
      state.orientation = state.orientation === 'landscape' ? 'portrait' : 'landscape';
      syncOrientationButtons();
      layoutImages();
      scheduleSave();
    };
    syncOrientationButtons();
  }

  if (btnOrient) {
    btnOrient.onclick = () => {
      const isLandscape = state.artboard.w >= state.artboard.h;
      applyOrientation(isLandscape ? 'portrait' : 'landscape');
    };
    syncOrientationButtons();
  }

  // Apply initial theme (dark default, overridden by saved preference)
  let initialTheme = 'dark';
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') initialTheme = saved;
  } catch (e) {
    // ignore storage errors
  }
  applyTheme(initialTheme);

  if (btnThemeLight && btnThemeDark) {
    btnThemeLight.onclick = () => applyTheme('light');
    btnThemeDark.onclick  = () => applyTheme('dark');
  }

  document.getElementById('ratio-sel').addEventListener('change', function () {
    if (this.value === 'Free') {
      showSizePanel();
    } else {
      hideSizePanel();
      setRatio(this.value, fitScreenFn);
      syncOrientationButtons();
      scheduleSave();
    }
  });

  document.getElementById('dim-display').addEventListener('click', showSizePanel);

  document.getElementById('bg-color').addEventListener('input', function () {
    state.bgColor = this.value;
    scheduleSave();
  });

  document.getElementById('sp-apply').onclick = () => {
    const w = parseInt(document.getElementById('sp-w').value, 10);
    const h = parseInt(document.getElementById('sp-h').value, 10);
    if (!w || !h || w < 100 || w > 8000 || h < 100 || h > 8000) {
      toast('Enter values between 100 and 8000 px'); return;
    }
    state.artboard.w = w; state.artboard.h = h;
    state.currentRatio = 'Free';
    document.getElementById('ratio-sel').value = 'Free';
    updateDimDisplay();
    fitScreenFn();
    hideSizePanel();
    scheduleSave();
  };

  document.getElementById('sp-cancel').onclick = () => {
    document.getElementById('ratio-sel').value = state.currentRatio;
    hideSizePanel();
  };

  document.addEventListener('mousedown', e => {
    const panel = document.getElementById('size-panel');
    if (!panel.classList.contains('open')) return;
    const ignored = ['size-panel', 'dim-display', 'ratio-sel', 'sp-w', 'sp-h', 'sp-apply', 'sp-cancel'];
    if (!panel.contains(e.target) && !ignored.includes(e.target.id)) {
      document.getElementById('ratio-sel').value = state.currentRatio;
      hideSizePanel();
    }
  });

  // ── Image actions (Rotate, Flip, Crop) ──
  const btnRotate = document.getElementById('btn-rotate');
  const btnFlipH  = document.getElementById('btn-flip-h');
  const btnFlipV  = document.getElementById('btn-flip-v');
  const btnCrop   = document.getElementById('btn-crop');

  if (btnRotate) {
    btnRotate.onclick = () => {
      if (!state.selectedIds.size) return;
      saveState();
      for (const id of state.selectedIds) {
        const im = state.imgs.find(i => i.id === id);
        if (!im) continue;
        im.rotation = ((im.rotation || 0) + 90) % 360;
        // Each 90° step swaps slot dimensions and aspect ratio
        [im.w, im.h] = [im.h, im.w];
        im.ar = im.w / im.h;
      }
      scheduleSave();
    };
  }

  if (btnFlipH) {
    btnFlipH.onclick = () => {
      if (!state.selectedIds.size) return;
      saveState();
      for (const id of state.selectedIds) {
        const im = state.imgs.find(i => i.id === id);
        if (im) im.flipX = !im.flipX;
      }
      scheduleSave();
    };
  }

  if (btnFlipV) {
    btnFlipV.onclick = () => {
      if (!state.selectedIds.size) return;
      saveState();
      for (const id of state.selectedIds) {
        const im = state.imgs.find(i => i.id === id);
        if (im) im.flipY = !im.flipY;
      }
      scheduleSave();
    };
  }

  if (btnCrop) {
    btnCrop.onclick = () => {
      if (state.cropTarget) {
        // Apply
        const im = state.imgs.find(i => i.id === state.cropTarget);
        if (im && state.cropRect) {
          const cr = state.cropRect;
          const EPS = 0.005;
          im.crop = (cr.x < EPS && cr.y < EPS && cr.w > 1 - EPS && cr.h > 1 - EPS)
            ? null : { ...cr };
        }
        state.cropTarget = null;
        state.cropRect   = null;
        btnCrop.classList.remove('active');
        scheduleSave();
      } else if (state.selectedIds.size === 1) {
        // Enter crop mode
        const id = [...state.selectedIds][0];
        const im = state.imgs.find(i => i.id === id);
        if (!im) return;
        state.cropTarget = id;
        state.cropRect   = im.crop ? { ...im.crop } : { x: 0, y: 0, w: 1, h: 1 };
        btnCrop.classList.add('active');
      }
    };
  }

  // ── Delete selected ──
  const btnDelete = document.getElementById('btn-delete');
  if (btnDelete) {
    btnDelete.onclick = () => {
      if (!state.selectedIds.size) return;
      saveState();
      removeSelected();
      updateSelectionUI();
      scheduleSave();
    };
  }

  // ── Z-order controls ──
  const btnZTop    = document.getElementById('btn-z-top');
  const btnZUp     = document.getElementById('btn-z-up');
  const btnZDown   = document.getElementById('btn-z-down');
  const btnZBottom = document.getElementById('btn-z-bottom');
  if (btnZTop)    btnZTop.onclick    = () => zOrderOp('top');
  if (btnZUp)     btnZUp.onclick     = () => zOrderOp('up');
  if (btnZDown)   btnZDown.onclick   = () => zOrderOp('down');
  if (btnZBottom) btnZBottom.onclick = () => zOrderOp('bottom');

  // ── Panel resize ──
  const panelEl2     = document.getElementById('panel');
  const resizeHandle = document.getElementById('panel-resize');
  const PN_KEY = 'moodflow-panel-w', PN_MIN = 170, PN_MAX = 280, PN_DEF = 200;

  function applyPanelWidth(w) {
    document.documentElement.style.setProperty('--panel-w', w + 'px');
  }

  try {
    const saved = parseInt(localStorage.getItem(PN_KEY), 10);
    if (saved >= PN_MIN && saved <= PN_MAX) applyPanelWidth(saved);
    else applyPanelWidth(PN_DEF);
  } catch { applyPanelWidth(PN_DEF); }

  if (resizeHandle && panelEl2) {
    let rDragging = false, rStartX = 0, rStartW = 0;
    resizeHandle.addEventListener('mousedown', e => {
      rDragging = true;
      rStartX   = e.clientX;
      rStartW   = panelEl2.offsetWidth;
      resizeHandle.classList.add('dragging');
      document.body.style.cursor     = 'ew-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!rDragging) return;
      const w = Math.max(PN_MIN, Math.min(PN_MAX, rStartW - (e.clientX - rStartX)));
      applyPanelWidth(w);
      fitScreenFn();
    });
    document.addEventListener('mouseup', () => {
      if (!rDragging) return;
      rDragging = false;
      resizeHandle.classList.remove('dragging');
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
      try { localStorage.setItem(PN_KEY, panelEl2.offsetWidth); } catch {}
    });
  }

  updateDimDisplay();
  updateUndoBtn();
  initWelcome();
}

function initWelcome() {
  const WK = 'mdbrd-welcome-seen';
  const el  = document.getElementById('welcome');
  if (!el) return;

  function show() { el.classList.add('show'); }
  function dismiss() {
    el.classList.remove('show');
    try { localStorage.setItem(WK, '1'); } catch {}
  }

  try { if (!localStorage.getItem(WK)) setTimeout(show, 350); } catch { setTimeout(show, 350); }

  document.getElementById('wc-close')?.addEventListener('click', dismiss);
  document.getElementById('wc-ok')?.addEventListener('click', dismiss);
  document.getElementById('btn-shortcuts')?.addEventListener('click', show);
}

/* ── Sync all toolbar DOM to current page's state ── */
export function syncPageUI() {
  const ratioSel = document.getElementById('ratio-sel');
  const bgColor = document.getElementById('bg-color');
  if (ratioSel) ratioSel.value = state.currentRatio;
  if (bgColor) bgColor.value = state.bgColor;

  const btnLayoutStructured    = document.getElementById('btn-layout-structured');
  const btnLayoutRowsSync      = document.getElementById('btn-layout-rows');
  const btnLayoutBricksSync    = document.getElementById('btn-layout-bricks');
  const btnLayoutCloudSync     = document.getElementById('btn-layout-cloud');
  const btnLayoutCloudBricksSync = document.getElementById('btn-layout-cloudbricks');
  const btnLayoutScatterSync   = document.getElementById('btn-layout-scatter');
  if (btnLayoutStructured && btnLayoutRowsSync) {
    btnLayoutStructured.classList.toggle('active', state.layoutMode === 'masonry');
    btnLayoutRowsSync.classList.toggle('active', state.layoutMode === 'rows');
    if (btnLayoutBricksSync)      btnLayoutBricksSync.classList.toggle('active', state.layoutMode === 'bricks');
    if (btnLayoutCloudSync)       btnLayoutCloudSync.classList.toggle('active', state.layoutMode === 'cloud');
    if (btnLayoutCloudBricksSync) btnLayoutCloudBricksSync.classList.toggle('active', state.layoutMode === 'cloudbricks');
    if (btnLayoutScatterSync)     btnLayoutScatterSync.classList.toggle('active', state.layoutMode === 'scatter');
  }

  const _colrowWrap  = document.getElementById('colrow-wrap');
  const _colrowLabel = document.getElementById('colrow-label');
  const _colrowInput = document.getElementById('colrow-input');
  const _gapInput    = document.getElementById('gap-input');
  if (_colrowWrap) {
    if (state.layoutMode === 'scatter') {
      _colrowWrap.style.display = 'none';
    } else {
      _colrowWrap.style.display = '';
      if (state.layoutMode === 'masonry') {
        _colrowLabel.textContent = 'Cols';
        _colrowInput.value = state.numCols > 0 ? state.numCols : '';
      } else {
        _colrowLabel.textContent = 'Rows';
        _colrowInput.value = state.numRows > 0 ? state.numRows : '';
      }
      if (_gapInput) _gapInput.value = state.layoutGap > 0 ? state.layoutGap : '';
    }
  }

  const _svgL = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><rect x="1" y="4.5" width="16" height="9" rx="1.5"/></svg>`;
  const _svgP = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><rect x="4.5" y="1" width="9" height="16" rx="1.5"/></svg>`;
  const _canvasIsL = state.artboard.w >= state.artboard.h;
  const _layoutIsL = state.orientation === 'landscape';
  const _bo  = document.getElementById('btn-orient');
  if (_bo)  _bo.innerHTML  = _canvasIsL ? _svgL : _svgP;
  const _blo = document.getElementById('btn-layout-orient');
  if (_blo) _blo.innerHTML = _layoutIsL ? _svgL : _svgP;

  const snapBtn = document.getElementById('btn-snap');
  if (snapBtn) {
    snapBtn.textContent = state.snapEnabled ? 'Snap ON' : 'Snap OFF';
    snapBtn.classList.toggle('active',   state.snapEnabled);
    snapBtn.classList.toggle('snap-on',  state.snapEnabled);
    snapBtn.classList.toggle('snap-off', !state.snapEnabled);
  }

  updateDimDisplay();
  updateUndoBtn();
  updateSelectionUI();
}
