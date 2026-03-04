import { state }          from './state.js';
import { UNDO_MAX }       from './config.js';
import { toast }          from './toast.js';
import { scheduleSave }   from './persist.js';

export function saveState() {
  const { imgs, undoStack } = state;
  const geom = JSON.parse(JSON.stringify(
    imgs.map(i => ({ id: i.id, x: i.x, y: i.y, w: i.w, h: i.h }))
  ));
  const snap = geom.map((g, idx) => ({
    ...g,
    url:      imgs[idx].url,
    ar:       imgs[idx].ar,
    p5img:    imgs[idx].p5img,
    rotation: imgs[idx].rotation || 0,
    flipX:    imgs[idx].flipX    || false,
    flipY:    imgs[idx].flipY    || false,
    crop:     imgs[idx].crop ? { ...imgs[idx].crop } : null,
  }));
  undoStack.push(snap);
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  updateUndoBtn();
}

export function restoreState() {
  if (!state.undoStack.length) return;
  const snap = state.undoStack.pop();
  for (const saved of snap) {
    const im = state.imgs.find(i => i.id === saved.id);
    if (im) {
      im.x = saved.x; im.y = saved.y; im.w = saved.w; im.h = saved.h;
      im.ar       = saved.ar;
      im.rotation = saved.rotation || 0;
      im.flipX    = saved.flipX    || false;
      im.flipY    = saved.flipY    || false;
      im.crop     = saved.crop ? { ...saved.crop } : null;
    }
  }
  for (const saved of snap) {
    if (!state.imgs.find(i => i.id === saved.id) && saved.p5img) {
      state.imgs.push({
        id: saved.id, url: saved.url, p5img: saved.p5img,
        ar: saved.ar, x: saved.x, y: saved.y, w: saved.w, h: saved.h,
        rotation: saved.rotation || 0,
        flipX:    saved.flipX    || false,
        flipY:    saved.flipY    || false,
        crop:     saved.crop ? { ...saved.crop } : null,
      });
    }
  }
  // Restore array order from snapshot (makes z-order changes undoable)
  const ordered = snap.map(s => state.imgs.find(i => i.id === s.id)).filter(Boolean);
  state.imgs.length = 0;
  state.imgs.push(...ordered);
  state.selIdx = -1;
  state.selectedIds.clear();
  updateUndoBtn();
  toast('Undo');
  scheduleSave();
}

export function updateUndoBtn() {
  const btn = document.getElementById('btn-undo');
  if (!btn) return;
  const n = state.undoStack.length;
  btn.textContent = n > 0 ? `Undo (${n})` : 'Undo';
  btn.disabled    = n === 0;
}
