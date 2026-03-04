import { state }                                  from './state.js';
import { layoutImages }                           from './layout.js';
import { saveBlobForImage, deleteBlobForImage,
         scheduleSave }                           from './persist.js';

let _p;
export function initFilesP5(p) { _p = p; }

export function loadFiles(fileList, fitScreenFn, toastFn) {
  const ok = ['image/jpeg', 'image/png', 'image/webp'];
  const files = Array.from(fileList).filter(f => ok.includes(f.type));
  if (!files.length) return;

  let done = 0;
  const isFirst = state.imgs.length === 0;

  files.forEach(f => {
    const url  = URL.createObjectURL(f);
    const item = { id: 'i' + (++state.uid), url, p5img: null, x: 0, y: 0, w: 0, h: 0, ar: 1, rotation: 0, flipX: false, flipY: false, crop: null };
    state.imgs.push(item);
    saveBlobForImage(item.id, f);   // persist raw file blob immediately

    _p.loadImage(url,
      p5img => {
        item.p5img = p5img;
        item.ar = (p5img.width / p5img.height) || 1;
        if (++done === files.length) {
          layoutImages();
          if (isFirst || done === files.length) fitScreenFn();
          toastFn(`Added ${files.length} image${files.length > 1 ? 's' : ''}`);
          scheduleSave();
        }
      },
      () => {
        const idx = state.imgs.indexOf(item);
        if (idx !== -1) state.imgs.splice(idx, 1);
        URL.revokeObjectURL(url);
        deleteBlobForImage(item.id);
        if (++done === files.length && state.imgs.length) { layoutImages(); fitScreenFn(); }
      }
    );
  });
}

export function removeSelected() {
  const { selectedIds, imgs } = state;
  if (!selectedIds.size) return;
  for (const id of [...selectedIds]) {
    const idx = imgs.findIndex(i => i.id === id);
    if (idx !== -1) {
      if (imgs[idx].url) URL.revokeObjectURL(imgs[idx].url);
      deleteBlobForImage(imgs[idx].id);
      imgs.splice(idx, 1);
    }
  }
  selectedIds.clear();
  state.selIdx = -1;
  scheduleSave();
}
