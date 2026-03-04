import { state } from './state.js';

let _p;
export function initExportP5(p) { _p = p; }

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function pageBaseName() {
  const raw = state.pages[state.currentPageIdx]?.title || 'moodboard';
  return raw
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80) || 'moodboard';
}


export function exportHD(toastFn, format = 'png') {
  if (!state.imgs.length) { toastFn('Nothing to export'); return; }
  const btn = document.getElementById('btn-export');
  btn.classList.add('loading'); btn.disabled = true;

  setTimeout(() => {
    let buf;
    try {
      const { x: ax, y: ay, w: aw, h: ah } = state.artboard;
      const baseName = pageBaseName();

      if (format === 'pdf') {
        _exportPDF(ax, ay, aw, ah, baseName, toastFn);
      } else {
        buf = _p.createGraphics(Math.round(aw), Math.round(ah));
        buf.imageMode(_p.CORNER);
        buf.background(state.bgColor);

        buf.drawingContext.save();
        buf.drawingContext.beginPath();
        buf.drawingContext.rect(0, 0, aw, ah);
        buf.drawingContext.clip();
        for (const im of state.imgs) {
          if (!im.p5img) continue;
          const ix = im.x - ax, iy = im.y - ay;
          if (ix + im.w <= 0 || iy + im.h <= 0 || ix >= aw || iy >= ah) continue;
          buf.push();
          buf.translate(ix + im.w / 2, iy + im.h / 2);
          if (im.rotation) buf.rotate(im.rotation * Math.PI / 180);
          if (im.flipX)    buf.scale(-1,  1);
          if (im.flipY)    buf.scale( 1, -1);
          buf.imageMode(buf.CENTER);
          if (im.crop) {
            const sx = im.crop.x * im.p5img.width,  sy = im.crop.y * im.p5img.height;
            const sw = im.crop.w * im.p5img.width,  sh = im.crop.h * im.p5img.height;
            buf.image(im.p5img, 0, 0, im.w, im.h, sx, sy, sw, sh);
          } else {
            buf.image(im.p5img, 0, 0, im.w, im.h);
          }
          buf.pop();
        }
        buf.drawingContext.restore();

        const mimeMap = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
        const mime    = mimeMap[format] || 'image/png';
        // Quality 1.0 = maximum quality for JPEG and WEBP
        const quality = (format === 'jpeg' || format === 'webp') ? 1.0 : undefined;
        const dataUrl = quality !== undefined
          ? buf.canvas.toDataURL(mime, quality)
          : buf.canvas.toDataURL(mime);

        if (format === 'webp' && !dataUrl.startsWith('data:image/webp')) {
          toastFn('WEBP not supported in this browser — exported as PNG');
        }

        const a = document.createElement('a');
        a.download = `${baseName}.${format}`;
        a.href = dataUrl;
        a.click();
        if (format !== 'webp' || dataUrl.startsWith('data:image/webp')) {
          toastFn(`Exported ${baseName}.${format}`);
        }
      }
    } catch (err) {
      console.error(err); toastFn('Export failed — see console');
    } finally {
      if (buf) buf.remove();
      btn.classList.remove('loading'); btn.disabled = false;
    }
  }, 60);
}

function _exportPDF(ax, ay, aw, ah, baseName, toastFn) {
  const { jsPDF } = window.jspdf;
  const PX_TO_MM    = 0.264583;
  const orientation = aw >= ah ? 'landscape' : 'portrait';
  const mmW = aw * PX_TO_MM;
  const mmH = ah * PX_TO_MM;

  const doc = new jsPDF({ orientation, unit: 'mm', format: [mmW, mmH] });

  // Render to a buffer so rotation/flip/crop are handled identically to raster export
  const buf = _p.createGraphics(Math.round(aw), Math.round(ah));
  buf.imageMode(_p.CORNER);
  buf.background(state.bgColor);
  buf.drawingContext.save();
  buf.drawingContext.beginPath();
  buf.drawingContext.rect(0, 0, aw, ah);
  buf.drawingContext.clip();
  for (const im of state.imgs) {
    if (!im.p5img) continue;
    const ix = im.x - ax, iy = im.y - ay;
    if (ix + im.w <= 0 || iy + im.h <= 0 || ix >= aw || iy >= ah) continue;
    buf.push();
    buf.translate(ix + im.w / 2, iy + im.h / 2);
    if (im.rotation) buf.rotate(im.rotation * Math.PI / 180);
    if (im.flipX)    buf.scale(-1, 1);
    buf.imageMode(buf.CENTER);
    if (im.crop) {
      const sx = im.crop.x * im.p5img.width,  sy = im.crop.y * im.p5img.height;
      const sw = im.crop.w * im.p5img.width,  sh = im.crop.h * im.p5img.height;
      buf.image(im.p5img, 0, 0, im.w, im.h, sx, sy, sw, sh);
    } else {
      buf.image(im.p5img, 0, 0, im.w, im.h);
    }
    buf.pop();
  }
  buf.drawingContext.restore();

  doc.addImage(buf.canvas.toDataURL('image/png'), 'PNG', 0, 0, mmW, mmH);
  buf.remove();

  doc.save(`${baseName}.pdf`);
  toastFn(`Exported ${baseName}.pdf`);
}
