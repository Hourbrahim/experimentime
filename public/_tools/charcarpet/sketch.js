/* ═══════════════════════════════════════════
   Char Carpet Animator — P5.js Sketch
   Faithful port from Processing (Java)
   ═══════════════════════════════════════════ */

let pg;              // offscreen graphics buffer
let t = 0;           // cumulative time variable (same as original)
let openSansFont;

// ─── Aspect Ratio ───
const RATIOS = {
  '1:1': { w: 1080, h: 1080 },
  '4:3': { w: 1440, h: 1080 },
  '3:4': { w: 1080, h: 1440 },
  '9:16': { w: 1080, h: 1920 },
};
let currentRatio = '1:1';
let currentFont = 'Open Sans';
let inputMode = 'text'; // 'text' or 'emoji'

// ─── Control References ───
const ctrl = {};

// ─── 2D Pad State ───
let padX = 200, padY = 200;  // mapped values (100–1000)
const PAD_MIN = 100, PAD_MAX = 1000;
let padDragging = false;

// ─── WebM Recorder ───
let mediaRecorder = null;
let recordedChunks = [];
let isRecordingWebM = false;

// ─── GIF Recording ───
let isRecordingGif = false;

function preload() {
  openSansFont = loadFont('https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/opensans/OpenSans%5Bwdth%2Cwght%5D.ttf');
}

function setup() {
  // Canvas sized to fill the container (the pg buffer is always 1080×1080)
  const container = document.getElementById('canvas-container');
  const cnv = createCanvas(container.offsetWidth, container.offsetHeight);
  cnv.parent('canvas-container');

  rebuildPG();

  textFont(openSansFont);

  // Cache DOM control references
  ctrl.charInput = document.getElementById('char-input');
  ctrl.sliderF = document.getElementById('slider-f');
  ctrl.sliderA = document.getElementById('slider-a');
  ctrl.sliderB = document.getElementById('slider-b');
  ctrl.sliderC = document.getElementById('slider-c');
  ctrl.sliderD = document.getElementById('slider-d');
  ctrl.sliderE = document.getElementById('slider-e');

  // Readout spans
  ctrl.valF = document.getElementById('val-f');
  ctrl.valA = document.getElementById('val-a');
  ctrl.valB = document.getElementById('val-b');
  ctrl.valC = document.getElementById('val-c');
  ctrl.valD = document.getElementById('val-d');
  ctrl.valE = document.getElementById('val-e');
  ctrl.padReadout = document.getElementById('pad-readout');
  ctrl.exportStatus = document.getElementById('export-status');

  // Slider readout updates
  for (const key of ['f', 'a', 'b', 'c', 'd', 'e']) {
    const sl = ctrl['slider' + key.toUpperCase()];
    sl.addEventListener('input', () => {
      ctrl['val' + key.toUpperCase()].textContent = parseFloat(sl.value).toPrecision(4);
    });
  }

  // 2D Pad setup
  setupPad();

  // Buttons
  document.getElementById('btn-png').addEventListener('click', downloadPNG);
  document.getElementById('btn-gif').addEventListener('click', recordGif);
  document.getElementById('btn-webm').addEventListener('click', recordWebM);

  // Ratio buttons
  document.querySelectorAll('.btn-ratio[data-ratio]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-ratio[data-ratio]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRatio = btn.dataset.ratio;
      rebuildPG();
    });
  });

  // Mode buttons
  const btnText = document.getElementById('btn-mode-text');
  const btnEmoji = document.getElementById('btn-mode-emoji');

  btnText.addEventListener('click', () => {
    inputMode = 'text';
    btnText.classList.add('active');
    btnEmoji.classList.remove('active');
    document.getElementById('section-text').classList.remove('hidden');
    document.getElementById('section-emoji').classList.add('hidden');
    document.getElementById('section-font').classList.remove('hidden');
    rebuildPG();
  });

  btnEmoji.addEventListener('click', () => {
    inputMode = 'emoji';
    btnEmoji.classList.add('active');
    btnText.classList.remove('active');
    // document.getElementById('section-text').classList.add('hidden'); // Keep text input visible for custom emojis
    document.getElementById('section-emoji').classList.remove('hidden');
    document.getElementById('section-font').classList.add('hidden');
    currentFont = 'sans-serif'; // Use system font for emoji
    rebuildPG();
  });

  // Font dropdown
  const fontSel = document.getElementById('font-selector');
  fontSel.addEventListener('change', () => {
    currentFont = fontSel.value;
    rebuildPG();
  });

  // Emoji buttons
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ctrl.charInput.value = btn.textContent;
    });
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    const c = document.getElementById('canvas-container');
    resizeCanvas(c.offsetWidth, c.offsetHeight);
  });
}

// ═══════════════════════════════════════════
// Rebuild PG buffer for current ratio
// ═══════════════════════════════════════════

function rebuildPG() {
  const dims = RATIOS[currentRatio];
  pg = createGraphics(dims.w, dims.h);

  if (currentFont === 'Open Sans') {
    pg.textFont(openSansFont);
  } else {
    // These fonts are loaded via CSS in index.html, so we can use their names
    pg.textFont(currentFont);
  }

  pg.textAlign(CENTER, CENTER);
}

// ═══════════════════════════════════════════
// DRAW — main loop
// ═══════════════════════════════════════════

function draw() {
  // ── Read controls ──
  const charStr = ctrl.charInput.value || 'A';
  const slA = parseFloat(ctrl.sliderA.value);
  const slB = parseFloat(ctrl.sliderB.value);
  const slC = parseFloat(ctrl.sliderC.value);
  const slD = parseFloat(ctrl.sliderD.value);
  const slE_raw = parseFloat(ctrl.sliderE.value);
  const slF = parseFloat(ctrl.sliderF.value);
  const slE = max(slE_raw, slF * 0.2); // Safety: spacing should be proportional to font size to avoid infinite loops

  const nbrFrames = 8 * slD;
  const t0 = (nbrFrames > 0) ? (1.0 * frameCount / nbrFrames) : 0;

  const sh = padX;  // 2D pad X
  const sv = padY;  // 2D pad Y

  const W = pg.width;
  const H = pg.height;

  // ── Read colors ──
  const bgHex = document.getElementById('color-bg').value;
  const txtHex = document.getElementById('color-text').value;
  const bgCol = color(bgHex);
  const txtCol = color(txtHex);
  const txtR = red(txtCol), txtG = green(txtCol), txtB = blue(txtCol);

  // ── Draw on offscreen buffer ──
  pg.background(bgCol);
  pg.noStroke();
  pg.textSize(slF);

  for (let x = 70; x < W - 70; x += slE) {
    for (let y = 70; y < H - 70; y += slE) {
      const sum = slA * sv * sh * sin((x + y) * (slB * (t0 / (W * H))));
      const brightness = (127 + (127 * y * x) * tan(cos(slA * (x * y) + sum * (t0 / W * H) * slC))) / 255;
      const br = constrain(brightness, 0, 1);

      if (inputMode === 'emoji') {
        // For emojis, we just use the brightness to modulate the opacity or just render it
        // Note: pg.fill() often doesn't affect bitmap emojis in many browsers, 
        // but we can try to use it for 'tinting' if they are vector-based in some environments.
        pg.fill(255, 255 * br);
      } else {
        pg.fill(txtR * br, txtG * br, txtB * br);
      }

      pg.text(charStr, x, y);
    }
    // Safety: break if we're taking too long or have too many columns
    if (x > W + slE) break;
  }

  // ── Compose final canvas ──
  background(0);

  // Scale pg to fit the available canvas height, centered
  const scale_ = min(width / pg.width, height / pg.height);
  const drawW = pg.width * scale_;
  const drawH = pg.height * scale_;
  const drawX = (width - drawW) / 2;
  const drawY = (height - drawH) / 2;
  image(pg, drawX, drawY, drawW, drawH);

  // ── Border around preview (not part of pg / exports) ──
  noFill();
  stroke(255, 255, 255, 60);
  strokeWeight(1);
  rect(drawX, drawY, drawW, drawH);

  // ── Restore sizing if recording is happening ──
  // Note: if width/height match pg.width/pg.height, we draw full-screen for saveGif
  if (isRecordingGif && width === pg.width && height === pg.height) {
    background(0);
    image(pg, 0, 0, width, height);
  }
}

// ═══════════════════════════════════════════
// 2D Pad
// ═══════════════════════════════════════════

function setupPad() {
  const padEl = document.getElementById('pad-container');
  const dotEl = document.getElementById('pad-dot');

  function updateDot() {
    const pctX = (padX - PAD_MIN) / (PAD_MAX - PAD_MIN);
    const pctY = (padY - PAD_MIN) / (PAD_MAX - PAD_MIN);
    dotEl.style.left = (pctX * 100) + '%';
    dotEl.style.top = (pctY * 100) + '%';
    ctrl.padReadout.textContent = `(${padX.toFixed(0)}, ${padY.toFixed(0)})`;
  }

  function pointerToValue(e) {
    const rect = padEl.getBoundingClientRect();
    const px = constrain((e.clientX - rect.left) / rect.width, 0, 1);
    const py = constrain((e.clientY - rect.top) / rect.height, 0, 1);
    padX = lerp(PAD_MIN, PAD_MAX, px);
    padY = lerp(PAD_MIN, PAD_MAX, py);
    updateDot();
  }

  padEl.addEventListener('pointerdown', (e) => {
    padDragging = true;
    padEl.setPointerCapture(e.pointerId);
    pointerToValue(e);
  });
  padEl.addEventListener('pointermove', (e) => {
    if (padDragging) pointerToValue(e);
  });
  padEl.addEventListener('pointerup', () => { padDragging = false; });
  padEl.addEventListener('pointercancel', () => { padDragging = false; });

  // Initial position
  updateDot();
}

// ═══════════════════════════════════════════
// Export: PNG
// ═══════════════════════════════════════════

function downloadPNG() {
  pg.save('char-carpet.png');
}

// ═══════════════════════════════════════════
// Export: GIF Loop (P5.js built-in saveGif)
// ═══════════════════════════════════════════

function recordGif() {
  if (isRecordingGif) return;
  isRecordingGif = true;

  const slD = parseFloat(ctrl.sliderD.value);
  const durationSec = 8; // Exactly 8 seconds
  const nbrFrames = durationSec * 60;

  setStatus('Recording GIF… (' + nbrFrames + ' frames)');

  // To capture exactly the size of the sketch, we'll temporarily 
  // resize the main canvas to match the PG buffer during recording.
  const container = document.getElementById('canvas-container');
  const originalW = container.offsetWidth;
  const originalH = container.offsetHeight;

  resizeCanvas(pg.width, pg.height);

  // P5 built-in: saveGif(filename, durationInSeconds)
  saveGif('char-carpet', durationSec, { units: 'seconds', delay: 0 });

  // Wait for duration + processing time, then resize back
  setTimeout(() => {
    isRecordingGif = false;
    setBtnsDisabled(false);
    resizeCanvas(originalW, originalH); // Restore view
    setStatus('GIF saved!');
    setTimeout(() => setStatus(''), 3000);
  }, (durationSec + 0.5) * 1000); // 0.5s buffer
}

// ═══════════════════════════════════════════
// Export: WebM via MediaRecorder
// ═══════════════════════════════════════════

function recordWebM() {
  if (isRecordingWebM) return;
  isRecordingWebM = true;
  recordedChunks = [];

  const slD = parseFloat(ctrl.sliderD.value);
  const durationMs = 8000; // Exactly 8 seconds

  setStatus('Recording MP4 (WebM)… (' + (durationMs / 1000).toFixed(1) + 's)');
  setBtnsDisabled(true);

  // Grab the underlying canvas of the pg buffer
  const stream = pg.canvas.captureStream(60);
  mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'video/webm; codecs=vp9',
    videoBitsPerSecond: 8_000_000,
  });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'char-carpet.mp4'; // Try forcing extension for user convenience, though still webm format
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    isRecordingWebM = false;
    setBtnsDisabled(false);
    setStatus('WebM saved!');
    setTimeout(() => setStatus(''), 3000);
  };

  mediaRecorder.start();

  // Stop after one loop duration
  setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }, durationMs);
}

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

function setStatus(msg) {
  ctrl.exportStatus.textContent = msg;
}

function setBtnsDisabled(state) {
  document.getElementById('btn-png').disabled = state;
  document.getElementById('btn-gif').disabled = state;
  document.getElementById('btn-webm').disabled = state;
}
