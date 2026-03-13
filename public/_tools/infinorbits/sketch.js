/* ── Infinorbits – p5.js sketch ── */
/* shared state: window.params is set by controls.js */

var fc = 0;
var paused = false;
var capturing = false;
var captureFrames = [];
var captureCount = 0;
var captureTotal = 0;

// camera: only rotate + zoom, no pan
var camRotX = 0, camRotY = 0;
var autoRotAcc = 0;
var camDist = 400;
var dragging = false;
var prevMX = 0, prevMY = 0;

let myFont;

function preload() {
  myFont = loadFont('inter.woff2');
}

function setup() {
  var p = window.params;
  setAttributes('preserveDrawingBuffer', true);
  var c = createCanvas(p.canvasW, p.canvasH, WEBGL);
  c.parent('canvas-container');
  pixelDensity(1);
  perspective(PI / 3, width / height, 1, 5000);

  // fallback loop for headless/background tabs where rAF doesn't fire
  setTimeout(function () {
    if (frameCount < 2) {
      window._fallbackLoop = setInterval(function () { try { redraw(); } catch (e) { } }, 16);
    }
  }, 500);
}

function draw() {
  var p = window.params;

  if (!paused) {
    fc += p.speed;
  }

  var t = fc / p.loopFrames;

  // ── background ──
  if (p.colorMode === 'solid') {
    background(p.bgColor);
  } else {
    background(p.bgColorSin);
  }

  // ── camera (clean, isolated) ──
  if (p.autoRotate && !paused) {
    autoRotAcc += 0.003 * p.speed;
  }

  // 1) manual orbit
  rotateX(camRotX);
  rotateY(camRotY);

  // 2) zoom
  scale(camDist / 400);

  // 3) auto-rotation + time animation
  rotateY(autoRotAcc + TWO_PI * t);

  // ── geometry (fully isolated so cumulative rotations don't leak to camera) ──
  push();
  drawOrbit(p, t);
  pop();

  // ── capture frames ──
  if (capturing) {
    captureFrames.push(get());
    captureCount++;
    updateExportProgress(captureCount / captureTotal);
    if (captureCount >= captureTotal) {
      finishCapture();
    }
  }
}

function drawOrbit(p, t) {
  var l1 = PI * p.loops;
  var d1 = p.density;
  var r = p.radius;
  var sz = p.pointSize;
  var sinCol = p.colorMode === 'sinusoidal';
  var charMode = p.charVal && p.charVal.length > 0;
  var vertexMode = p.drawMode === 'vertex';

  if (vertexMode) {
    noFill();
    strokeWeight(p.strokeWeight);
    if (!sinCol) stroke(p.elemColor);
    beginShape();
  } else {
    noStroke();
    if (charMode) {
      textFont(myFont);
      textAlign(CENTER, CENTER);
      textSize(max(sz * 3, 6));
    }
  }

  var idx = 0;
  var lastColor = [255, 255, 255];

  for (var i = 0; i <= l1; i += d1) {
    var cr, cg, cb;
    if (sinCol) {
      cr = 127 + 127 * sin(p.freqR * idx * 100 - t * 4);
      cg = 127 + 127 * cos(p.freqG * idx * 100 + t * 5);
      cb = 127 + 127 * cos(p.freqB * idx * 100 + t * 3);
      lastColor = [cr, cg, cb];
    }

    push();
    // cumulative rotations create the 3D toroidal winding
    rotateZ(4.2 * cos(0.00001 * TWO_PI * (t / l1 * r)));
    rotateY(100 * cos(0.00001 * TWO_PI * (t / l1 * r)));

    var px = r * sin(2 * PI * t + i);
    var py = 0;
    var pz = r * cos(2 * PI * t + i);

    if (vertexMode) {
      // In WEBGL, vertex colors are supported when passed individually, or we can just draw paths
      // Note: p5 WEBGL doesn't perfectly support auto-gradient lines without custom shaders.
      // We'll apply stroke color if solid, otherwise we just let the line build. 
      if (sinCol) stroke(cr, cg, cb);
      vertex(px, py, pz);
    } else {
      if (sinCol) fill(cr, cg, cb);
      else fill(p.elemColor);

      translate(px, py, pz);

      if (charMode) {
        text(p.charVal, 0, 0);
      } else {
        ellipse(0, 0, sz, sz);
      }
    }
    pop();
    idx++;
  }

  if (vertexMode) {
    endShape();
  }
}

// ── Mouse: rotate + zoom only, no pan ──
function isOverCanvas() {
  return mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
}

function mousePressed() {
  if (!isOverCanvas()) return;
  dragging = true;
  prevMX = mouseX;
  prevMY = mouseY;
}

function mouseDragged() {
  if (!dragging) return;
  var dx = mouseX - prevMX;
  var dy = mouseY - prevMY;
  var sens = window.params.orbitSens * 0.006;

  camRotY += dx * sens;
  camRotX -= dy * sens;
  camRotX = constrain(camRotX, -HALF_PI * 0.95, HALF_PI * 0.95);

  prevMX = mouseX;
  prevMY = mouseY;
}

function mouseReleased() {
  dragging = false;
}

function mouseWheel(e) {
  if (!isOverCanvas()) return false;
  var factor = e.delta > 0 ? 1.08 : 0.93;
  camDist *= factor;
  camDist = constrain(camDist, 50, 2000);
  return false;
}

// prevent right-click context menu on canvas
function contextmenu(e) { e.preventDefault(); }

// ── Export helpers ──
function startCapture() {
  capturing = true;
  captureFrames = [];
  captureCount = 0;
  captureTotal = window.params.loopFrames;
  fc = 0;
  paused = false;
}

function stopCapture() {
  capturing = false;
  captureFrames = [];
  captureCount = 0;
  hideExportProgress();
}

function finishCapture() {
  capturing = false;
  paused = true;
  var p = window.params;

  if (p.exportFmt === 'screenshot') {
    saveCanvas('infinorbits', 'png');
    hideExportProgress();
    return;
  }
  if (p.exportFmt === 'png') { exportPngSequence(); return; }
  if (p.exportFmt === 'gif') { exportGif(); return; }
  if (p.exportFmt === 'webm') { exportWebm(); return; }
}

function exportPngSequence() {
  updateExportStatus('Saving PNGs...');
  for (var i = 0; i < captureFrames.length; i++) {
    captureFrames[i].save('infinorbits_' + nf(i, 4), 'png');
  }
  captureFrames = [];
  hideExportProgress();
}

function exportGif() {
  updateExportStatus('Encoding GIF...');
  var delay = Math.round(1000 / window.params.exportFps);

  if (typeof GIF === 'undefined') {
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js';
    script.onload = function () { encodeGif(delay); };
    document.head.appendChild(script);
  } else {
    encodeGif(delay);
  }
}

function encodeGif(delay) {
  var gif = new GIF({
    workers: 2, quality: 10, width: width, height: height,
    workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'
  });
  for (var i = 0; i < captureFrames.length; i++) {
    gif.addFrame(captureFrames[i].canvas, { copy: true, delay: delay });
  }
  gif.on('finished', function (blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'infinorbits.gif'; a.click();
    URL.revokeObjectURL(url);
    captureFrames = [];
    hideExportProgress();
  });
  gif.on('progress', function (prog) {
    updateExportStatus('Encoding GIF: ' + Math.round(prog * 100) + '%');
  });
  gif.render();
}

function exportWebm() {
  updateExportStatus('Encoding WebM...');
  var cnv = document.querySelector('#canvas-container canvas');
  var stream = cnv.captureStream(window.params.exportFps);
  var mimeType = 'video/webm; codecs=vp9';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

  var recorder = new MediaRecorder(stream, { mimeType: mimeType });
  var chunks = [];
  recorder.ondataavailable = function (e) { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = function () {
    var blob = new Blob(chunks, { type: 'video/webm' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'infinorbits.webm'; a.click();
    URL.revokeObjectURL(url);
    captureFrames = [];
    hideExportProgress();
  };
  fc = 0; paused = false; capturing = false;
  recorder.start();
  var totalMs = (window.params.loopFrames / 60) * 1000;
  setTimeout(function () { recorder.stop(); paused = true; }, totalMs);
}

function updateExportProgress(pct) {
  var el = document.getElementById('exportProgress');
  var fill = document.getElementById('exportBarFill');
  var status = document.getElementById('exportStatus');
  el.classList.remove('hidden');
  fill.style.width = (pct * 100) + '%';
  status.textContent = Math.round(pct * 100) + '%';
}

function updateExportStatus(msg) {
  document.getElementById('exportStatus').textContent = msg;
}

function hideExportProgress() {
  document.getElementById('exportProgress').classList.add('hidden');
  document.getElementById('exportBarFill').style.width = '0%';
  document.getElementById('exportStop').classList.add('hidden');
  document.getElementById('exportBtn').classList.remove('hidden');
}
