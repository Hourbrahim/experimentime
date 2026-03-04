let images = [];
let params = {
    total: 20,
    radius: 1000,
    speed: 0.5,
    size: 60,
    bgColor: '#ffffff',
    distortion: 0.5,
    uniqueMode: false,
    freqX: 1,
    freqY: 1,
    waveMove: 1,
    strokeLimit: 0.2,
    ratio: 'full',
    t: 0
};

let easycam;
let canvas;
let recorder;
let chunks = [];
let isRecording = false;

function setup() {
    updateCanvasSize();
    canvas.parent('canvas-wrapper');

    easycam = createEasyCam({ distance: 2500 });
    document.oncontextmenu = () => false;
    imageMode(CENTER);
}

function updateCanvasSize() {
    let w, h;
    let container = document.getElementById('canvas-wrapper');
    let maxW = container.clientWidth - 80;
    let maxH = container.clientHeight - 80;

    if (params.ratio === '1:1') {
        w = h = Math.min(maxW, maxH);
    } else if (params.ratio === '4:5') {
        w = Math.min(maxW, maxH * 0.8);
        h = w * 1.25;
        if (h > maxH) { h = maxH; w = h * 0.8; }
    } else if (params.ratio === '16:9') {
        w = maxW;
        h = w * (9 / 16);
        if (h > maxH) { h = maxH; w = h * (16 / 9); }
    } else {
        w = container.clientWidth;
        h = container.clientHeight;
    }

    if (!canvas) {
        canvas = createCanvas(w, h, WEBGL);
    } else {
        resizeCanvas(w, h);
    }
}

function draw() {
    background(params.bgColor);

    // Draw limit stroke if requested
    if (params.strokeLimit > 0) {
        push();
        noFill();
        stroke(0, params.strokeLimit * 255);
        strokeWeight(1);
        // Box showing limits
        box(params.radius * 2.2);
        pop();
    }

    if (images.length === 0) {
        drawPlaceholder();
        return;
    }

    params.t += (0.01 * params.speed);

    rotateY(TWO_PI * (params.t / 20));

    let total = params.total;
    let r = params.radius;
    let t = params.t;
    let morph = params.distortion;

    let count = params.uniqueMode ? images.length : total * total;

    for (let k = 0; k < count; k++) {
        let lon, lat;
        if (params.uniqueMode) {
            let goldenRatio = (1 + Math.sqrt(5)) / 2;
            lon = 2 * PI * k / goldenRatio;
            lat = Math.asin(-1 + 2 * k / count);
        } else {
            let i = k % total;
            let j = Math.floor(k / total);
            lon = map(i, 0, total, -PI, PI);
            lat = map(j, 0, total, -HALF_PI, HALF_PI);
        }
        drawPoint(lon, lat, k % images.length, r, t, morph);
    }
}

function drawPoint(lon, lat, imgIdx, r, t, morph) {
    // 1. Standard Sphere positions
    let xS = r * Math.sin(lon) * Math.cos(lat);
    let yS = r * Math.sin(lon) * Math.sin(lat);
    let zS = r * Math.cos(lon);

    // 2. Refined Waves (avoiding extreme tan glitches)
    let move = params.waveMove;
    let fx = params.freqX;
    let fy = params.freqY;

    // smoother wave mapping using sin/cos combined with controlled tan
    let xD = r * Math.sin(t * lon * fx) * Math.cos(lat * move);
    let yD = r * Math.sin(lon * move) * Math.sin(lat * fy * t);
    let zD = r * Math.cos(t * fx * lon);

    // Add a bit of the "Processing Tan" essence but clamped
    let tanFactor = Math.tan(constrain(t * lon * 0.1, -1.4, 1.4));
    xD += (tanFactor * 100 * morph);

    // 3. Interpolate
    let x = lerp(xS, xD, morph);
    let y = lerp(yS, yD, morph);
    let z = lerp(zS, zD, morph);

    let img = images[imgIdx];

    push();
    translate(x, y, z);

    let displayW, displayH;
    let aspect = img.width / img.height;
    if (aspect > 1) {
        displayW = params.size;
        displayH = params.size / aspect;
    } else {
        displayH = params.size;
        displayW = params.size * aspect;
    }

    texture(img);
    noStroke();
    plane(displayW, displayH);
    pop();
}

function drawPlaceholder() {
    fill(0);
    textAlign(CENTER);
    textSize(14);
    text("PROJECT ASSETS MISSING", 0, 0);
}

// VIDEO RECORDING LOGIC
window.startRecording = function () {
    chunks = [];
    let stream = canvas.elt.captureStream(60);
    recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });

    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = e => {
        let blob = new Blob(chunks, { type: 'video/webm' });
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = url;
        a.download = 'space-animator-export.webm';
        a.click();
    };

    recorder.start();
    isRecording = true;
};

window.stopRecording = function () {
    recorder.stop();
    isRecording = false;
};

window.updateParam = function (key, value) {
    if (params.hasOwnProperty(key)) {
        params[key] = value;
        if (key === 'ratio') updateCanvasSize();
    }
};

window.addImages = function (newImages) {
    images = [...images, ...newImages];
};

function windowResized() {
    updateCanvasSize();
}
