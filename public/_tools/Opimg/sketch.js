/* ============================================================
   sketch.js — p5.js setup / draw + op-art rendering pipeline
   ============================================================ */

let photo = null;
let photoLoaded = false;
let renderMode = 'lines';
let inputMode = 'image';   // 'image' | 'video'
let photoW = 0, photoH = 0;

// Default values for reset
const DEFAULTS = {
  res: 80, stroke: 16, thresh: 100, bright: 0,
  exposure: 10, contrast: 10, invert: 0, colorize: 0,
  colStroke: '#ffffff', colBg: '#000000'
};

/* ── Helpers to read slider values ── */
function sl(id)  { return parseInt(document.getElementById('sl-' + id).value); }
function slF(id) { return parseFloat(document.getElementById('sl-' + id).value); }

/* ── Compute render dims that fit the source aspect within the canvas ── */
function getRenderDims(srcW, srcH) {
  if (srcW <= 0 || srcH <= 0) return { rw: 0, rh: 0, ox: 0, oy: 0 };
  const aspect = srcW / srcH;
  let rw, rh;
  if (aspect >= 1) {
    rw = Math.min(width, width);
    rh = rw / aspect;
    if (rh > height) { rh = height; rw = rh * aspect; }
  } else {
    rh = Math.min(height, height);
    rw = rh * aspect;
    if (rw > width) { rw = width; rh = rw / aspect; }
  }
  const ox = (width - rw) / 2;
  const oy = (height - rh) / 2;
  return { rw, rh, ox, oy };
}

/* ── Read all current control values into an object ── */
function getParams() {
  return {
    res:       sl('res'),
    thresh:    sl('thresh'),
    bAdj:      sl('bright'),
    expo:      slF('exposure') / 10,
    cont:      slF('contrast') / 10,
    inv:       sl('invert') === 1,
    useColor:  sl('colorize') === 1,
    strokeCol: document.getElementById('col-stroke').value,
    bgCol:     document.getElementById('col-bg').value,
    strokeW:   slF('stroke') / 10,
    chr:       document.getElementById('char-input').value || '/'
  };
}

/* ── Core op-art render — works on any p5 graphics target & source image ── */
function renderOpArt(target, source, srcW, srcH, outW, outH, p) {
  const aspect = srcW / srcH;
  const tileBase = (aspect >= 1 ? outW : outH) / p.res;
  const resX = Math.max(1, Math.round(outW / tileBase));
  const resY = Math.max(1, Math.round(outH / tileBase));
  const tsX = outW / resX;
  const tsY = outH / resY;

  const tmp = source.get();
  tmp.resize(resX, resY);
  tmp.loadPixels();

  for (let x = 0; x < resX; x++) {
    for (let y = 0; y < resY; y++) {
      const idx = (y * resX + x) * 4;
      let r = tmp.pixels[idx], g = tmp.pixels[idx + 1], b = tmp.pixels[idx + 2];

      let br = 0.299 * r + 0.587 * g + 0.114 * b;
      br = Math.pow(br / 255, 1 / p.expo) * 255;
      br = ((br - 127.5) * p.cont) + 127.5 + p.bAdj;
      br = Math.max(0, Math.min(255, br));
      if (p.inv) br = 255 - br;

      const w = map(br, 0, 255, 0.1, p.strokeW * 1.5);

      if (p.useColor) {
        let cr = Math.pow(r / 255, 1 / p.expo) * 255;
        let cg = Math.pow(g / 255, 1 / p.expo) * 255;
        let cb = Math.pow(b / 255, 1 / p.expo) * 255;
        cr = constrain(cr + p.bAdj, 0, 255);
        cg = constrain(cg + p.bAdj, 0, 255);
        cb = constrain(cb + p.bAdj, 0, 255);
        target.stroke(cr, cg, cb);
        target.fill(cr, cg, cb);
      } else {
        const sc = color(p.strokeCol);
        const a = map(br, 0, 255, 30, 255);
        target.stroke(red(sc), green(sc), blue(sc), a);
        target.fill(red(sc), green(sc), blue(sc), a);
      }

      target.strokeWeight(w);

      if (renderMode === 'lines') {
        if (br >= p.thresh) {
          target.line((x + 1) * tsX, y * tsY, x * tsX, (y + 1) * tsY);
        } else {
          target.line(x * tsX, y * tsY, (x + 1) * tsX, (y + 1) * tsY);
        }
      } else {
        target.noStroke();
        const sz = map(br, 0, 255, 2, Math.min(tsX, tsY) * 1.1);
        target.textSize(sz);
        target.text(p.chr, x * tsX + tsX / 2, y * tsY + tsY / 2);
      }
    }
  }
}

/* ── Render to off-screen buffer (for PNG export) ── */
function renderToBuffer() {
  const p = getParams();
  const pg = createGraphics(photoW, photoH);
  pg.background(p.bgCol);
  pg.textFont('monospace');
  pg.textAlign(CENTER, CENTER);
  renderOpArt(pg, photo, photoW, photoH, photoW, photoH, p);
  return pg;
}

/* ── SVG export ── */
function exportSVG() {
  const p   = getParams();
  const outW = photoW, outH = photoH;
  const aspect = photoW / photoH;
  const tileBase = (aspect >= 1 ? outW : outH) / p.res;
  const resX = Math.max(1, Math.round(outW / tileBase));
  const resY = Math.max(1, Math.round(outH / tileBase));
  const tsX  = outW / resX;
  const tsY  = outH / resY;

  const tmp = photo.get();
  tmp.resize(resX, resY);
  tmp.loadPixels();

  let lines = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${outW} ${outH}">`);
  lines.push(`<rect width="${outW}" height="${outH}" fill="${p.bgCol}"/>`);

  for (let x = 0; x < resX; x++) {
    for (let y = 0; y < resY; y++) {
      const idx = (y * resX + x) * 4;
      let r = tmp.pixels[idx], g = tmp.pixels[idx + 1], b = tmp.pixels[idx + 2];
      let br = 0.299 * r + 0.587 * g + 0.114 * b;
      br = Math.pow(br / 255, 1 / p.expo) * 255;
      br = ((br - 127.5) * p.cont) + 127.5 + p.bAdj;
      br = Math.max(0, Math.min(255, br));
      if (p.inv) br = 255 - br;

      const w = mapVal(br, 0, 255, 0.1, p.strokeW * 1.5);
      let col = p.strokeCol;
      if (p.useColor) {
        const rr = Math.min(255, Math.max(0, Math.pow(r / 255, 1 / p.expo) * 255 + p.bAdj));
        const gg = Math.min(255, Math.max(0, Math.pow(g / 255, 1 / p.expo) * 255 + p.bAdj));
        const bb = Math.min(255, Math.max(0, Math.pow(b / 255, 1 / p.expo) * 255 + p.bAdj));
        col = `rgb(${Math.round(rr)},${Math.round(gg)},${Math.round(bb)})`;
      }

      if (renderMode === 'lines') {
        if (br >= p.thresh) {
          lines.push(`<line x1="${(x+1)*tsX}" y1="${y*tsY}" x2="${x*tsX}" y2="${(y+1)*tsY}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`);
        } else {
          lines.push(`<line x1="${x*tsX}" y1="${y*tsY}" x2="${(x+1)*tsX}" y2="${(y+1)*tsY}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`);
        }
      } else {
        const sz = mapVal(br, 0, 255, 2, Math.min(tsX, tsY) * 1.1);
        lines.push(`<text x="${x*tsX + tsX/2}" y="${y*tsY + tsY/2}" fill="${col}" font-size="${sz}" text-anchor="middle" dominant-baseline="central" font-family="monospace">${escapeXml(p.chr)}</text>`);
      }
    }
  }
  lines.push('</svg>');

  const blob = new Blob([lines.join('\n')], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'opimg.svg';
  a.click();
  URL.revokeObjectURL(a.href);
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function mapVal(v, inMin, inMax, outMin, outMax) {
  return outMin + (v - inMin) * (outMax - outMin) / (inMax - inMin);
}

/* ── p5.js lifecycle ── */
function setup() {
  const container = document.getElementById('canvas-container');
  const cnv = createCanvas(container.offsetWidth, container.offsetHeight);
  cnv.parent('canvas-container');
  pixelDensity(1);
  textFont('monospace');
  textAlign(CENTER, CENTER);
}

function draw() {
  const p = getParams();
  background(p.bgCol);

  /* ── Video mode ── */
  if (inputMode === 'video' && videoReady) {
    captureVideoFrame();
    if (!photo) return;
    const { rw, rh, ox, oy } = getRenderDims(videoW, videoH);
    if (rw <= 0 || rh <= 0) return;

    push();
    translate(ox, oy);
    renderOpArt(window, photo, videoW, videoH, rw, rh, p);
    pop();

    updateVideoUI();
    return;
  }

  /* ── Image mode ── */
  if (!photoLoaded || !photo) return;

  const { rw, rh, ox, oy } = getRenderDims(photoW, photoH);
  if (rw <= 0 || rh <= 0) return;

  push();
  translate(ox, oy);
  renderOpArt(window, photo, photoW, photoH, rw, rh, p);
  pop();
}

function windowResized() {
  const container = document.getElementById('canvas-container');
  resizeCanvas(container.offsetWidth, container.offsetHeight);
}
