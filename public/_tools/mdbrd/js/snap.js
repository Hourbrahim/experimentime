import { state }               from './state.js';
import { SNAP_GRID, SNAP_THR } from './config.js';

/**
 * Snap a rect (x,y,w,h) to grid / other images / artboard edges.
 * `exclude` can be a numeric index OR a Set of image ids to skip.
 */
export function snapPos(x, y, w, h, exclude) {
  const thr = SNAP_THR / state.zoomLevel;
  let bx = null, by = null, dx = thr + 1, dy = thr + 1;

  function tryX(edge) {
    let d = Math.abs(x - edge);
    if (d < dx) { bx = edge;     dx = d; }
    d = Math.abs(x + w - edge);
    if (d < dx) { bx = edge - w; dx = d; }
  }
  function tryY(edge) {
    let d = Math.abs(y - edge);
    if (d < dy) { by = edge;     dy = d; }
    d = Math.abs(y + h - edge);
    if (d < dy) { by = edge - h; dy = d; }
  }

  tryX(Math.round(x       / SNAP_GRID) * SNAP_GRID);
  tryX(Math.round((x + w) / SNAP_GRID) * SNAP_GRID - w);
  tryY(Math.round(y       / SNAP_GRID) * SNAP_GRID);
  tryY(Math.round((y + h) / SNAP_GRID) * SNAP_GRID - h);

  for (let i = 0; i < state.imgs.length; i++) {
    const im = state.imgs[i];
    const skip = exclude instanceof Set ? exclude.has(im.id) : i === exclude;
    if (skip) continue;
    tryX(im.x); tryX(im.x + im.w);
    tryY(im.y); tryY(im.y + im.h);
  }

  tryX(state.artboard.x); tryX(state.artboard.x + state.artboard.w);
  tryY(state.artboard.y); tryY(state.artboard.y + state.artboard.h);

  return { x: bx !== null ? bx : x, y: by !== null ? by : y };
}
