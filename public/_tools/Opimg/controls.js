/* ============================================================
   controls.js — UI wiring: sliders, toggles, upload, reset
   ============================================================ */

/* ── Slider value display ── */
function updateVal(id) {
    const el = document.getElementById('sl-' + id);
    const valEl = document.getElementById('val-' + id);
    if (!el || !valEl) return;
    if (id === 'invert') { valEl.textContent = el.value === '1' ? 'on' : 'off'; }
    else if (id === 'colorize') { valEl.textContent = el.value === '1' ? 'on' : 'off'; }
    else if (id === 'exposure' || id === 'contrast') { valEl.textContent = (parseFloat(el.value) / 10).toFixed(1); }
    else if (id === 'stroke') { valEl.textContent = (parseFloat(el.value) / 10).toFixed(1); }
    else { valEl.textContent = el.value; }
}

// Wire up all sliders
document.querySelectorAll('input[type="range"]').forEach(s => {
    const id = s.id.replace('sl-', '');
    if (id && document.getElementById('val-' + id)) {
        s.addEventListener('input', () => updateVal(id));
    }
});

/* ── Input mode toggle (Image / Video) ── */
document.getElementById('input-mode-toggle').addEventListener('click', e => {
    const btn = e.target.closest('.mode-btn');
    if (!btn) return;
    document.querySelectorAll('#input-mode-toggle .mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    inputMode = btn.dataset.mode;

    const uploadBtn = document.getElementById('btn-upload');
    const fileInput = document.getElementById('file-input');
    const videoSection = document.getElementById('video-controls-section');
    const imageExport = document.getElementById('image-export-section');
    const videoExport = document.getElementById('video-export-section');
    const dropZone = document.getElementById('drop-zone');
    const dropText = dropZone.querySelector('div:last-child');

    if (inputMode === 'video') {
        uploadBtn.textContent = 'Upload Video';
        fileInput.accept = 'video/*';
        videoSection.classList.add('visible');
        imageExport.classList.add('hidden');
        videoExport.classList.add('visible');
        dropText.textContent = 'drop video or click upload';
    } else {
        uploadBtn.textContent = 'Upload Image';
        fileInput.accept = 'image/*';
        videoSection.classList.remove('visible');
        imageExport.classList.remove('hidden');
        videoExport.classList.remove('visible');
        dropText.textContent = 'drop image or click upload';
    }

    // Show drop zone when switching modes (unless content is already loaded)
    if (inputMode === 'image' && !photoLoaded) {
        dropZone.classList.remove('hidden');
    } else if (inputMode === 'video' && !videoReady) {
        dropZone.classList.remove('hidden');
    }
});

/* ── File upload ── */
const fileInput = document.getElementById('file-input');
document.getElementById('btn-upload').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
});

/* ── Drag & drop ── */
const canvasContainer = document.getElementById('canvas-container');
canvasContainer.addEventListener('dragover', e => {
    e.preventDefault();
    canvasContainer.classList.add('drag-over');
});
canvasContainer.addEventListener('dragleave', () => canvasContainer.classList.remove('drag-over'));
canvasContainer.addEventListener('drop', e => {
    e.preventDefault();
    canvasContainer.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

/* ── Handle uploaded file — branch on type ── */
function handleFile(file) {
    if (file.type.startsWith('image/')) {
        // Switch to image mode if needed
        if (inputMode !== 'image') {
            document.querySelector('#input-mode-toggle .mode-btn[data-mode="image"]').click();
        }
        resetVideo();
        const url = URL.createObjectURL(file);
        loadImage(url, img => {
            photo = img;
            photoW = img.width;
            photoH = img.height;
            photoLoaded = true;
            document.getElementById('drop-zone').classList.add('hidden');
            URL.revokeObjectURL(url);
        });
    } else if (file.type.startsWith('video/')) {
        // Switch to video mode if needed
        if (inputMode !== 'video') {
            document.querySelector('#input-mode-toggle .mode-btn[data-mode="video"]').click();
        }
        photoLoaded = false;
        photo = null;
        loadVideoFile(file);
    }
}

/* ── Render mode toggle (Lines / Chars) ── */
document.getElementById('mode-toggle').addEventListener('click', e => {
    const btn = e.target.closest('.mode-btn');
    if (!btn) return;
    document.querySelectorAll('#mode-toggle .mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderMode = btn.dataset.mode;
    document.getElementById('char-section').style.display = renderMode === 'chars' ? 'block' : 'none';
});

/* ── Reset ── */
document.getElementById('btn-reset').addEventListener('click', () => {
    document.getElementById('sl-res').value = DEFAULTS.res;
    document.getElementById('sl-stroke').value = DEFAULTS.stroke;
    document.getElementById('sl-thresh').value = DEFAULTS.thresh;
    document.getElementById('sl-bright').value = DEFAULTS.bright;
    document.getElementById('sl-exposure').value = DEFAULTS.exposure;
    document.getElementById('sl-contrast').value = DEFAULTS.contrast;
    document.getElementById('sl-invert').value = DEFAULTS.invert;
    document.getElementById('sl-colorize').value = DEFAULTS.colorize;
    document.getElementById('col-stroke').value = DEFAULTS.colStroke;
    document.getElementById('col-bg').value = DEFAULTS.colBg;
    document.getElementById('char-input').value = '';

    // Reset render mode to lines
    renderMode = 'lines';
    document.querySelectorAll('#mode-toggle .mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#mode-toggle .mode-btn[data-mode="lines"]').classList.add('active');
    document.getElementById('char-section').style.display = 'none';

    // Update all displays
    ['res', 'stroke', 'thresh', 'bright', 'exposure', 'contrast', 'invert', 'colorize'].forEach(updateVal);
});

/* ── Image export ── */
document.getElementById('btn-save').addEventListener('click', () => {
    if (!photoLoaded) return;
    const pg = renderToBuffer();
    pg.save('opimg.png');
});

document.getElementById('btn-save-svg').addEventListener('click', () => {
    if (!photoLoaded) return;
    exportSVG();
});

/* ── Video playback controls ── */
document.getElementById('btn-play-pause').addEventListener('click', toggleVideoPlayback);
initVideoScrubber();

/* ── Video export ── */
document.getElementById('btn-export-video').addEventListener('click', () => {
    if (isRecording) {
        stopVideoExport();
    } else {
        startVideoExport();
    }
});
