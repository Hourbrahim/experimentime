import { state }           from './state.js';
import { ARTBOARD_PRESETS } from './config.js';

const VALID_RATIOS = new Set([...Object.keys(ARTBOARD_PRESETS), 'Free']);
const RATIO_MIGRATE = { '9:16': '1:2', '4:3': '16:9', 'A4P': 'A4', 'A4L': 'A4' };
function migrateRatio(r) {
  if (VALID_RATIOS.has(r)) return r;
  return RATIO_MIGRATE[r] || '16:9';
}

const DB_NAME    = 'mdbrd-session';
const DB_VERSION = 1;
let db = null;

async function openDB() {
  if (db) return db;
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB unavailable')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('session')) d.createObjectStore('session');
      if (!d.objectStoreNames.contains('blobs'))   d.createObjectStore('blobs');
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror   = ()  => reject(req.error);
  });
}

function idbPut(store, key, val) {
  return openDB().then(d => new Promise((res, rej) => {
    const tx = d.transaction(store, 'readwrite');
    tx.objectStore(store).put(val, key);
    tx.oncomplete = res;
    tx.onerror    = () => rej(tx.error);
  }));
}

function idbGet(store, key) {
  return openDB().then(d => new Promise((res, rej) => {
    const tx  = d.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  }));
}

function idbDel(store, key) {
  return openDB().then(d => new Promise((res, rej) => {
    const tx = d.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = res;
    tx.onerror    = () => rej(tx.error);
  }));
}

function idbClear(store) {
  return openDB().then(d => new Promise((res, rej) => {
    const tx = d.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete = res;
    tx.onerror    = () => rej(tx.error);
  }));
}

/* ── Public: blob storage ── */

export function saveBlobForImage(id, blob) {
  return idbPut('blobs', id, blob).catch(() => {});
}

export function deleteBlobForImage(id) {
  return idbDel('blobs', id).catch(() => {});
}

/* ── Public: session save/restore ── */

export async function saveSession() {
  try {
    const pagesData = state.pages.map((page, i) => {
      const live = i === state.currentPageIdx;
      return {
        title:        page.title,
        artboard:     { ...(live ? state.artboard    : page.artboard) },
        currentRatio: live ? state.currentRatio   : page.currentRatio,
        bgColor:      live ? state.bgColor        : page.bgColor,
        layoutMode:   live ? state.layoutMode     : page.layoutMode,
        orientation:  live ? state.orientation    : page.orientation,
        numCols:      live ? state.numCols        : page.numCols,
        numRows:      live ? state.numRows        : page.numRows,
        layoutGap:    live ? state.layoutGap      : page.layoutGap,
        imgs: (live ? state.imgs : page.imgs).map(im => ({
          id: im.id, x: im.x, y: im.y, w: im.w, h: im.h, ar: im.ar,
          rotation: im.rotation || 0,
          flipX:    im.flipX    || false,
          flipY:    im.flipY    || false,
          crop:     im.crop     || null,
        })),
      };
    });
    await idbPut('session', 'main', {
      pages:          pagesData,
      currentPageIdx: state.currentPageIdx,
      uid:            state.uid,
      snapEnabled:    state.snapEnabled,
    });
  } catch (_) { /* persistence is best-effort */ }
}

export async function restoreSession(p5instance) {
  try {
    const session = await idbGet('session', 'main');
    if (!session) { await idbClear('blobs').catch(() => {}); return false; }

    const newPages = [];
    for (const pd of session.pages) {
      const pageImgs = [];
      for (const meta of pd.imgs) {
        const blob = await idbGet('blobs', meta.id).catch(() => null);
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        pageImgs.push({ id: meta.id, url, p5img: null,
                        ar: meta.ar, x: meta.x, y: meta.y, w: meta.w, h: meta.h,
                        rotation: meta.rotation || 0,
                        flipX:    meta.flipX    || false,
                        flipY:    meta.flipY    || false,
                        crop:     meta.crop     || null });
      }
      const ratio = migrateRatio(pd.currentRatio);
      const ab    = { ...pd.artboard };
      newPages.push({
        title:        pd.title,
        imgs:         pageImgs,
        artboard:     ab,
        currentRatio: ratio,
        bgColor:      pd.bgColor       || '#ffffff',
        layoutMode:   (['cloud', 'scatter'].includes(pd.layoutMode) ? pd.layoutMode : 'masonry'),
        orientation:  ab.w >= ab.h ? 'landscape' : 'portrait',
        numCols:      pd.numCols   ?? 0,
        numRows:      pd.numRows   ?? 0,
        layoutGap:    pd.layoutGap ?? 0,
        undoStack:    [],
      });
    }

    if (!newPages.length) return false;

    // Load all images into p5 before swapping state
    await Promise.all(
      newPages.flatMap(page =>
        page.imgs.map(im =>
          new Promise(res => {
            p5instance.loadImage(im.url, p5img => { im.p5img = p5img; res(); }, res);
          })
        )
      )
    );

    // Swap state
    state.pages       = newPages;
    state.uid         = session.uid        || 0;
    state.snapEnabled = session.snapEnabled || false;

    const idx  = Math.min(session.currentPageIdx || 0, newPages.length - 1);
    const page = newPages[idx];
    state.currentPageIdx = idx;
    state.imgs        = page.imgs;
    state.artboard    = page.artboard;
    state.currentRatio = page.currentRatio;
    state.bgColor     = page.bgColor;
    state.layoutMode  = page.layoutMode;
    state.orientation = page.artboard.w >= page.artboard.h ? 'landscape' : 'portrait';
    state.numCols     = page.numCols;
    state.numRows     = page.numRows   || 0;
    state.layoutGap   = page.layoutGap ?? 0;
    state.undoStack   = page.undoStack;

    return true;
  } catch (_) { return false; }
}

/* ── Debounced save trigger ── */
let _saveTimer = null;
export function scheduleSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(saveSession, 1000);
}
