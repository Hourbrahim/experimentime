import { state }                               from './state.js';
import { MIN_ZOOM, MAX_ZOOM, PANEL_W, PAGEBAR_H } from './config.js';

export function doZoom(delta, cx, cy) {
  const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoomLevel + delta));
  const wx = (cx - state.panX) / state.zoomLevel;
  const wy = (cy - state.panY) / state.zoomLevel;
  state.zoomLevel = nz;
  state.panX = cx - wx * state.zoomLevel;
  state.panY = cy - wy * state.zoomLevel;
}

export function fitScreen() {
  const panelEl = document.getElementById('panel');
  const pw = (panelEl && panelEl.offsetWidth) || PANEL_W;
  const aw = window.innerWidth  - pw;
  const ah = window.innerHeight - PAGEBAR_H;
  const zx = aw / state.artboard.w;
  const zy = ah / state.artboard.h;
  const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zx, zy)));

  state.zoomLevel = targetZoom;

  const displayW = state.artboard.w * state.zoomLevel;
  const displayH = state.artboard.h * state.zoomLevel;

  state.panX = (aw - displayW) / 2 - state.artboard.x * state.zoomLevel;
  state.panY =      (ah - displayH) / 2 - state.artboard.y * state.zoomLevel;
}
