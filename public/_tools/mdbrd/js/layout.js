import { state } from './state.js';

// Caches random layout structure so adjusting gap doesn't reshuffle
let _structureCache = { key: '', slots: null, hPrime: null, jitter: null };
function _cacheKey(ready, mode) {
  return `${mode}|${state.numRows}|${state.orientation}|${ready.map(im => im.id).join(',')}`;
}

function layoutMasonry(ready) {
  const n = ready.length;
  const { artboard } = state;
  const g = state.layoutGap || 0;

  let numCols;
  if (state.numCols > 0) {
    numCols = Math.max(1, Math.min(state.numCols, n));
  } else {
    let baseCols = n <= 2 ? n
      : n <= 4  ? 2
      : n <= 9  ? 3
      : n <= 16 ? 4
      : n <= 25 ? 5
      : 6;
    if (state.orientation === 'landscape' && baseCols < 6) baseCols += 1;
    else if (state.orientation === 'portrait' && baseCols > 1) baseCols -= 1;
    numCols = baseCols;
  }

  const nomColW = Math.max(1, (artboard.w - (numCols - 1) * g) / numCols);

  // First pass: simulate greedy column heights at nominal width (including gaps)
  const simH = new Array(numCols).fill(0);
  for (const im of ready) {
    let col = 0;
    for (let c = 1; c < numCols; c++) if (simH[c] < simH[col]) col = c;
    if (simH[col] > 0) simH[col] += g;
    simH[col] += nomColW / (im.ar || 1);
  }
  const maxColH = Math.max(...simH);

  // Scale to fit artboard height; gaps scale proportionally
  const scale  = maxColH > artboard.h ? artboard.h / maxColH : 1;
  const colW   = nomColW * scale;
  const scaledG = g * scale;
  const startX = artboard.x + (artboard.w - numCols * colW - (numCols - 1) * scaledG) / 2;

  // Second pass: place images
  const colY = new Array(numCols).fill(artboard.y);
  for (const im of ready) {
    let col = 0;
    for (let c = 1; c < numCols; c++) if (colY[c] < colY[col]) col = c;
    im.w = colW;
    im.h = colW / (im.ar || 1);
    im.x = startX + col * (colW + scaledG);
    im.y = colY[col];
    colY[col] += im.h + scaledG;
  }
}

// Clean justified rows: all images in a row share the same height,
// row fills the full artboard width edge-to-edge.
function layoutRows(ready) {
  const { artboard } = state;
  const n = ready.length;
  if (!n) return;

  const isPortrait = state.orientation === 'portrait';

  let numRows;
  if (state.numRows > 0) {
    numRows = Math.max(1, Math.min(state.numRows, n));
  } else {
    numRows = Math.max(1, Math.round(Math.pow(n, 0.55)));
    if (isPortrait) numRows = Math.max(1, Math.round(numRows * 1.3));
  }

  const totalAr = ready.reduce((s, im) => s + (im.ar || 1), 0);
  // Target row height: even split, capped so rows fit within artboard height
  const rowH = Math.min(artboard.w * numRows / totalAr, artboard.h / numRows);
  const targetAr = artboard.w / rowH;

  // Greedy row fill
  const rows = [];
  let row = [], rowAr = 0;
  for (let i = 0; i < n; i++) {
    const im = ready[i];
    row.push(im);
    rowAr += im.ar || 1;
    const isLast = i === n - 1;
    const nextAr = isLast ? 0 : (ready[i + 1].ar || 1);
    if (isLast || (rows.length < numRows - 1 && rowAr + nextAr / 2 > targetAr && row.length > 0)) {
      rows.push({ items: [...row], aspectSum: rowAr });
      row = []; rowAr = 0;
    }
  }

  // Justified height per row; clamp total to artboard height and center
  const g = state.layoutGap || 0;
  const rowHeights = rows.map(r => Math.max(1, artboard.w - (r.items.length - 1) * g) / r.aspectSum);
  const totalH  = rowHeights.reduce((s, h) => s + h, 0) + (rows.length - 1) * g;
  const hScale  = totalH > artboard.h ? artboard.h / totalH : 1;
  const scaledG = g * hScale;
  let floatY = artboard.y + (artboard.h - totalH * hScale) / 2;

  for (let ri = 0; ri < rows.length; ri++) {
    const r   = rows[ri];
    const rH  = rowHeights[ri] * hScale;   // scaled row height
    const rowW = rH * r.aspectSum;          // images width (without gaps)
    const intY = Math.round(floatY);
    const intH = Math.round(floatY + rH) - intY;
    const totalRowW = rowW + (r.items.length - 1) * scaledG;
    let floatX = artboard.x + (artboard.w - totalRowW) / 2;  // center row
    for (const im of r.items) {
      const ar = im.ar || 1;
      const imW = rH * ar;
      im.x = Math.round(floatX);
      im.y = intY;
      im.w = Math.round(floatX + imW) - im.x;
      im.h = intH;
      floatX += imW + scaledG;
    }
    floatY += rH + scaledG;
  }
}

// Groups consecutive images into slots of 1, 2, or 3 for vertical stacking.
// combined_ar = 1 / Σ(1/ar_i) — images sharing slot width always fill slot height exactly.
function buildSlots(ready) {
  const slots = [];
  let i = 0;
  while (i < ready.length) {
    const remaining = ready.length - i;
    let tier;
    if (remaining === 1) {
      tier = 1;
    } else if (remaining === 2) {
      tier = Math.random() < 0.5 ? 1 : 2;
    } else {
      const r = Math.random();
      tier = r < 0.4 ? 1 : r < 0.78 ? 2 : 3;
    }
    const imgs = ready.slice(i, i + Math.min(tier, remaining));
    const invArSum = imgs.reduce((s, im) => s + 1 / (im.ar || 1), 0);
    slots.push({ images: imgs, combinedAr: 1 / invArSum });
    i += imgs.length;
  }
  return slots;
}

// Places a slot's images as a vertical stack at (slotIntX, floatY) with slotW / slotH.
function placeSlotImages(sl, slotIntX, slotIntW, slotW, floatY) {
  let floatImY = floatY;
  for (const im of sl.images) {
    const imH = slotW / (im.ar || 1);
    im.x = slotIntX;
    im.y = Math.round(floatImY);
    im.w = slotIntW;
    im.h = Math.round(floatImY + imH) - im.y;
    floatImY += imH;
  }
}

// Justified rows with 1/2/3-image vertical slots.
function layoutBricks(ready) {
  const { artboard } = state;
  if (!ready.length) return;

  const key = _cacheKey(ready, 'bricks');
  let slots;
  if (_structureCache.key === key && _structureCache.slots) {
    slots = _structureCache.slots;
  } else {
    slots = buildSlots(ready);
    _structureCache = { key, slots, hPrime: null, jitter: null };
  }
  const ns = slots.length;
  const isPortrait = state.orientation === 'portrait';

  let numRows;
  if (state.numRows > 0) {
    numRows = Math.max(1, Math.min(state.numRows, ns));
  } else {
    numRows = Math.max(1, Math.round(Math.pow(ns, 0.55)));
    if (isPortrait) numRows = Math.max(1, Math.round(numRows * 1.3));
  }

  const totalAr  = slots.reduce((s, sl) => s + sl.combinedAr, 0);
  const rowH     = Math.min(artboard.w * numRows / totalAr, artboard.h / numRows);
  const targetAr = artboard.w / rowH;

  const rows = [];
  let row = [], rowAr = 0;
  for (let j = 0; j < ns; j++) {
    const sl = slots[j];
    row.push(sl); rowAr += sl.combinedAr;
    const isLast = j === ns - 1;
    const nextAr = isLast ? 0 : slots[j + 1].combinedAr;
    if (isLast || (rows.length < numRows - 1 && rowAr + nextAr / 2 > targetAr && row.length > 0)) {
      rows.push({ slots: [...row], aspectSum: rowAr });
      row = []; rowAr = 0;
    }
  }

  const g = state.layoutGap || 0;
  const rowHeights = rows.map(r => Math.max(1, artboard.w - (r.slots.length - 1) * g) / r.aspectSum);
  const totalH  = rowHeights.reduce((s, h) => s + h, 0) + (rows.length - 1) * g;
  const hScale  = totalH > artboard.h ? artboard.h / totalH : 1;
  const scaledG = g * hScale;
  let floatY = artboard.y + (artboard.h - totalH * hScale) / 2;

  for (let ri = 0; ri < rows.length; ri++) {
    const slotH  = rowHeights[ri] * hScale;        // scaled row height
    const rowW   = slotH * rows[ri].aspectSum;      // slots width (without gaps)
    const totalRowW = rowW + (rows[ri].slots.length - 1) * scaledG;
    let floatX   = artboard.x + (artboard.w - totalRowW) / 2;  // center row
    for (const sl of rows[ri].slots) {
      const slotW    = slotH * sl.combinedAr;
      const slotIntX = Math.round(floatX);
      const slotIntW = Math.round(floatX + slotW) - slotIntX;
      placeSlotImages(sl, slotIntX, slotIntW, slotW, floatY);
      floatX += slotW + scaledG;
    }
    floatY += slotH + scaledG;
  }
}

// Original organic cloud: sine-profile row widths, random height jitter,
// scaled to 85% of artboard and centered. One image per slot.
function layoutCloud(ready) {
  const { artboard } = state;
  const n = ready.length;
  if (!n) return;

  const isPortrait = state.orientation === 'portrait';

  let numRows;
  if (state.numRows > 0) {
    numRows = Math.max(1, Math.min(state.numRows, n));
  } else {
    numRows = Math.max(1, Math.round(Math.pow(n, 0.55)));
    if (isPortrait) numRows = Math.max(1, Math.round(numRows * 1.3));
  }

  const profile = [];
  let totalProfile = 0;
  for (let r = 0; r < numRows; r++) {
    const val = Math.pow(Math.sin(Math.PI * (r + 0.5) / numRows), 0.7);
    profile.push(val);
    totalProfile += val;
  }

  let totalAspect = 0;
  for (const im of ready) totalAspect += (im.ar || 1);

  let rows = Array.from({ length: numRows }, () => ({ items: [], aspectSum: 0 }));
  let r = 0, currentAspect = 0;
  let targetAspect = totalAspect * (profile[r] / totalProfile);

  for (let i = 0; i < n; i++) {
    const im = ready[i];
    const ar = im.ar || 1;
    if (r < numRows - 1 && currentAspect + ar / 2 > targetAspect && rows[r].items.length > 0) {
      r++; currentAspect = 0;
      targetAspect = totalAspect * (profile[r] / totalProfile);
    }
    rows[r].items.push(im);
    rows[r].aspectSum += ar;
    currentAspect += ar;
  }

  rows = rows.filter(row => row.items.length > 0);
  numRows = rows.length;

  const g = state.layoutGap || 0;

  // Cache H_prime + row jitter so gap changes don't reshuffle
  const key = _cacheKey(ready, 'cloud');
  let H_prime, jitter;
  if (_structureCache.key === key && _structureCache.hPrime?.length === numRows) {
    H_prime = _structureCache.hPrime;
    jitter  = _structureCache.jitter;
  } else {
    H_prime = [];
    jitter  = [];
    for (let i = 0; i < numRows; i++) {
      H_prime.push(0.85 + 0.4 * Math.random());
      jitter.push(Math.random() * 0.06 - 0.03);
    }
    _structureCache = { key, slots: null, hPrime: H_prime, jitter };
  }

  let clusterW_prime = 0, clusterH_prime = 0;
  for (let i = 0; i < numRows; i++) {
    clusterW_prime = Math.max(clusterW_prime, H_prime[i] * rows[i].aspectSum);
    clusterH_prime += H_prime[i];
  }

  // Scale to fit 85% of artboard, accounting for gaps
  let scale = Math.min(artboard.w * 0.85 / clusterW_prime, artboard.h * 0.85 / clusterH_prime);
  if (g > 0) {
    scale = Math.min(scale, Math.max(0, artboard.h * 0.85 - (numRows - 1) * g) / clusterH_prime);
    for (let i = 0; i < numRows; i++) {
      const len = rows[i].items.length;
      if (len > 1)
        scale = Math.min(scale, Math.max(0, artboard.w * 0.85 - (len - 1) * g) / (H_prime[i] * rows[i].aspectSum));
    }
    scale = Math.max(scale, 0.001);
  }

  const cx = artboard.x + artboard.w / 2;
  const cy = artboard.y + artboard.h / 2;
  const totalClusterH = clusterH_prime * scale + (numRows - 1) * g;
  let floatY = cy - totalClusterH / 2;

  for (let i = 0; i < numRows; i++) {
    const row       = rows[i];
    const absH      = H_prime[i] * scale;
    const absW      = absH * row.aspectSum;
    const rowTotalW = absW + (row.items.length - 1) * g;
    const nextFloatY = floatY + absH;
    const intY = Math.round(floatY);
    const intH = Math.round(nextFloatY) - intY;
    let floatX = cx - rowTotalW / 2 + rowTotalW * jitter[i];

    for (const im of row.items) {
      const ar = im.ar || 1;
      const imW = absH * ar;
      im.x = Math.round(floatX);
      im.y = intY;
      im.w = Math.round(floatX + imW) - im.x;
      im.h = intH;
      floatX += imW + g;
    }
    floatY = nextFloatY + g;
  }
}

// Cloud Bricks: organic cloud sizing + 1/2/3-image vertical slots.
// Slots get the sine-profile distribution and random height jitter of Cloud,
// but each slot is a vertical stack of up to 3 images.
function layoutCloudBricks(ready) {
  const { artboard } = state;
  if (!ready.length) return;

  // Cache slots so gap changes don't trigger new random groupings
  const key = _cacheKey(ready, 'cloudbricks');
  const cachedSlots = _structureCache.key === key && _structureCache.slots;
  const slots = cachedSlots ? _structureCache.slots : buildSlots(ready);
  const ns = slots.length;
  const isPortrait = state.orientation === 'portrait';

  let numRows;
  if (state.numRows > 0) {
    numRows = Math.max(1, Math.min(state.numRows, ns));
  } else {
    numRows = Math.max(1, Math.round(Math.pow(ns, 0.55)));
    if (isPortrait) numRows = Math.max(1, Math.round(numRows * 1.3));
  }

  // Sine profile (wider rows in the middle)
  const profile = [];
  let totalProfile = 0;
  for (let r = 0; r < numRows; r++) {
    const val = Math.pow(Math.sin(Math.PI * (r + 0.5) / numRows), 0.7);
    profile.push(val); totalProfile += val;
  }

  // Distribute slots across rows proportional to profile
  let totalAspect = 0;
  for (const sl of slots) totalAspect += sl.combinedAr;

  let rows = Array.from({ length: numRows }, () => ({ slots: [], aspectSum: 0 }));
  let r = 0, currentAspect = 0;
  let targetAspect = totalAspect * (profile[r] / totalProfile);

  for (let j = 0; j < ns; j++) {
    const sl = slots[j];
    const ar = sl.combinedAr;
    if (r < numRows - 1 && currentAspect + ar / 2 > targetAspect && rows[r].slots.length > 0) {
      r++; currentAspect = 0;
      targetAspect = totalAspect * (profile[r] / totalProfile);
    }
    rows[r].slots.push(sl);
    rows[r].aspectSum += ar;
    currentAspect += ar;
  }

  rows = rows.filter(row => row.slots.length > 0);
  numRows = rows.length;

  const g = state.layoutGap || 0;

  // Cache H_prime + row jitter (reuse slots from above if already cached)
  let H_prime, jitter;
  if (cachedSlots && _structureCache.hPrime?.length === numRows) {
    H_prime = _structureCache.hPrime;
    jitter  = _structureCache.jitter;
  } else {
    H_prime = [];
    jitter  = [];
    for (let i = 0; i < numRows; i++) {
      H_prime.push(0.85 + 0.4 * Math.random());
      jitter.push(Math.random() * 0.06 - 0.03);
    }
    _structureCache = { key, slots, hPrime: H_prime, jitter };
  }

  let clusterW_prime = 0, clusterH_prime = 0;
  for (let i = 0; i < numRows; i++) {
    clusterW_prime = Math.max(clusterW_prime, H_prime[i] * rows[i].aspectSum);
    clusterH_prime += H_prime[i];
  }

  // Scale to fit 85% of artboard, accounting for gaps
  let scale = Math.min(artboard.w * 0.85 / clusterW_prime, artboard.h * 0.85 / clusterH_prime);
  if (g > 0) {
    scale = Math.min(scale, Math.max(0, artboard.h * 0.85 - (numRows - 1) * g) / clusterH_prime);
    for (let i = 0; i < numRows; i++) {
      const len = rows[i].slots.length;
      if (len > 1)
        scale = Math.min(scale, Math.max(0, artboard.w * 0.85 - (len - 1) * g) / (H_prime[i] * rows[i].aspectSum));
    }
    scale = Math.max(scale, 0.001);
  }

  const cx = artboard.x + artboard.w / 2;
  const cy = artboard.y + artboard.h / 2;
  const totalClusterH = clusterH_prime * scale + (numRows - 1) * g;
  let floatY = cy - totalClusterH / 2;

  for (let i = 0; i < numRows; i++) {
    const row       = rows[i];
    const absH      = H_prime[i] * scale;
    const absW      = absH * row.aspectSum;
    const rowTotalW = absW + (row.slots.length - 1) * g;
    const nextFloatY = floatY + absH;
    let floatX = cx - rowTotalW / 2 + rowTotalW * jitter[i];

    for (const sl of row.slots) {
      const slotW    = absH * sl.combinedAr;
      const slotIntX = Math.round(floatX);
      const slotIntW = Math.round(floatX + slotW) - slotIntX;
      placeSlotImages(sl, slotIntX, slotIntW, slotW, floatY);
      floatX += slotW + g;
    }
    floatY = nextFloatY + g;
  }
}

function layoutScatter(ready) {
  const { artboard } = state;
  const n = ready.length;
  if (!n) return;

  // Virtual grid for even spatial distribution
  const aspect = artboard.w / artboard.h;
  const numCols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
  const numRows = Math.max(1, Math.ceil(n / numCols));
  const cellW = artboard.w / numCols;
  const cellH = artboard.h / numRows;
  const cellArea = cellW * cellH;

  // Build a shuffled cell list so image-to-cell assignment is random
  const cells = [];
  for (let row = 0; row < numRows; row++)
    for (let col = 0; col < numCols; col++)
      cells.push({ row, col });
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  for (let i = 0; i < n; i++) {
    const im   = ready[i];
    const ar   = im.ar || 1;
    const cell = cells[i % cells.length];

    // Area-normalized size with ±40% variation → images have similar visual weight
    const sizeVar = 0.6 + Math.random() * 0.8; // 0.6 … 1.4
    im.h = Math.round(Math.sqrt(cellArea * sizeVar / ar));
    im.w = Math.round(im.h * ar);

    // Cell centre
    const cx = artboard.x + (cell.col + 0.5) * cellW;
    const cy = artboard.y + (cell.row + 0.5) * cellH;

    // Large jitter (±45 % of cell) causes natural overlap between neighbours
    const jx = (Math.random() * 2 - 1) * 0.45 * cellW;
    const jy = (Math.random() * 2 - 1) * 0.45 * cellH;
    im.x = Math.round(cx + jx - im.w / 2);
    im.y = Math.round(cy + jy - im.h / 2);
  }
}

export function layoutImages() {
  const ready = state.imgs.filter(i => i.p5img);
  if (!ready.length) return;

  if      (state.layoutMode === 'scatter')      layoutScatter(ready);
  else if (state.layoutMode === 'bricks')       layoutBricks(ready);
  else if (state.layoutMode === 'cloud')        layoutCloud(ready);
  else if (state.layoutMode === 'cloudbricks')  layoutCloudBricks(ready);
  else if (state.layoutMode === 'rows')         layoutRows(ready);
  else layoutMasonry(ready);
}

export function shuffleLayout(saveStateFn) {
  if (!state.imgs.length) return;
  saveStateFn();
  const imgs = state.imgs;
  for (let i = imgs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
  }
  layoutImages();
  state.selIdx = -1;
  state.selectedIds.clear();
}
