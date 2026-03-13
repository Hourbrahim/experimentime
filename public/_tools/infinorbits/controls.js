/* ── Controls ── */

window.params = {
  canvasW: 600,
  canvasH: 600,
  loops: 8,
  pointSize: 2.3,
  density: 0.031,
  radius: 100,
  charVal: '',
  speed: 1,
  loopFrames: 600,
  colorMode: 'solid',
  elemColor: '#ffffff',
  bgColor: '#000000',
  bgColorSin: '#000000',
  freqR: 0.004,
  freqG: 0.005,
  freqB: 0.01,
  autoRotate: true,
  orbitSens: 1,
  exportFmt: 'gif',
  exportFps: 30,
};

document.addEventListener('DOMContentLoaded', function () {
  var p = window.params;

  function $(id) { return document.getElementById(id); }

  function bindSlider(id, key, valId, fmt) {
    var el = $(id);
    var val = $(valId);
    if (!el || !val) return;
    el.addEventListener('input', function () {
      p[key] = parseFloat(el.value);
      val.textContent = fmt ? fmt(p[key]) : p[key];
    });
  }

  // ── Collapsible sections ──
  document.querySelectorAll('.section-head[data-toggle]').forEach(function (head) {
    head.addEventListener('click', function () {
      var body = $(head.getAttribute('data-toggle'));
      if (!body) return;
      body.classList.toggle('collapsed');
      head.classList.toggle('collapsed');
    });
  });

  // ── Canvas ratio dropdown ──
  $('canvasRatio').addEventListener('change', function () {
    var sel = $('canvasRatio');
    var opt = sel.options[sel.selectedIndex];
    var val = sel.value;

    if (val === 'custom') {
      $('customSize').classList.remove('hidden');
      return;
    }

    $('customSize').classList.add('hidden');
    var w = parseInt(opt.getAttribute('data-w'));
    var h = parseInt(opt.getAttribute('data-h'));
    applyCanvasSize(w, h);
  });

  $('applyCustom').addEventListener('click', function () {
    var w = parseInt($('canvasW').value) || 600;
    var h = parseInt($('canvasH').value) || 600;
    applyCanvasSize(w, h);
  });

  function applyCanvasSize(w, h) {
    p.canvasW = w;
    p.canvasH = h;
    resizeCanvas(w, h);
    perspective(PI / 3, w / h, 1, 5000);
  }

  // ── Geometry ──
  bindSlider('loops', 'loops', 'loopsVal');
  bindSlider('pointSize', 'pointSize', 'pointSizeVal');
  bindSlider('density', 'density', 'densityVal');
  bindSlider('radius', 'radius', 'radiusVal');

  $('charVal').addEventListener('input', function (e) {
    p.charVal = e.target.value;
  });

  // ── Animation ──
  bindSlider('speed', 'speed', 'speedVal', function (v) { return v.toFixed(2); });

  $('loopFrames').addEventListener('change', function (e) {
    p.loopFrames = parseInt(e.target.value) || 600;
  });

  // ── Colors ──
  $('colorMode').addEventListener('change', function (e) {
    p.colorMode = e.target.value;
    $('solidColors').classList.toggle('hidden', e.target.value !== 'solid');
    $('sinColors').classList.toggle('hidden', e.target.value !== 'sinusoidal');
  });

  $('elemColor').addEventListener('input', function (e) { p.elemColor = e.target.value; });
  $('bgColor').addEventListener('input', function (e) { p.bgColor = e.target.value; });
  $('bgColorSin').addEventListener('input', function (e) { p.bgColorSin = e.target.value; });

  bindSlider('freqR', 'freqR', 'freqRVal', function (v) { return v.toFixed(4); });
  bindSlider('freqG', 'freqG', 'freqGVal', function (v) { return v.toFixed(4); });
  bindSlider('freqB', 'freqB', 'freqBVal', function (v) { return v.toFixed(4); });

  // ── Camera ──
  $('autoRotate').addEventListener('change', function (e) {
    p.autoRotate = e.target.checked;
  });

  bindSlider('orbitSens', 'orbitSens', 'orbitSensVal', function (v) { return v.toFixed(1); });

  $('resetCam').addEventListener('click', function () {
    camRotX = 0;
    camRotY = 0;
    autoRotAcc = 0;
    camDist = 400;
  });

  // ── Export ──
  $('exportFmt').addEventListener('change', function (e) { p.exportFmt = e.target.value; });
  $('exportFps').addEventListener('change', function (e) { p.exportFps = parseInt(e.target.value) || 30; });

  $('exportBtn').addEventListener('click', function () {
    if (p.exportFmt === 'screenshot') {
      saveCanvas('infinorbits', 'png');
      return;
    }

    $('exportBtn').classList.add('hidden');
    $('exportStop').classList.remove('hidden');
    $('exportProgress').classList.remove('hidden');

    if (p.exportFmt === 'webm') {
      startWebmRecording();
    } else {
      startCapture();
    }
  });

  $('exportStop').addEventListener('click', function () {
    stopCapture();
  });
});

function startWebmRecording() {
  var cnv = document.querySelector('#canvas-container canvas');
  var fps = window.params.exportFps;
  var stream = cnv.captureStream(fps);

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
    hideExportProgress();
  };

  fc = 0;
  paused = false;
  recorder.start();

  var frameDurationMs = (window.params.loopFrames / 60) * 1000 / window.params.speed;
  var elapsed = 0;
  var interval = setInterval(function () {
    elapsed += 100;
    updateExportProgress(elapsed / frameDurationMs);
    if (elapsed >= frameDurationMs) {
      clearInterval(interval);
      recorder.stop();
      paused = true;
    }
  }, 100);

  document.getElementById('exportStop').addEventListener('click', function () {
    clearInterval(interval);
    try { recorder.stop(); } catch (e) {}
    paused = true;
  }, { once: true });
}
