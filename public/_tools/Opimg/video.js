/* ============================================================
   video.js — Video loading, playback, frame capture & export
   ============================================================ */

let videoEl = null;       // The hidden <video> element
let videoReady = false;
let videoW = 0, videoH = 0;
let videoDuration = 0;
let isRecording = false;
let recAborted = false;
const useWebCodecs = typeof VideoEncoder !== 'undefined';

/* ── Load a video file into the hidden <video> element ── */
function loadVideoFile(file) {
    const url = URL.createObjectURL(file);

    videoEl = document.getElementById('video-source');
    videoEl.src = url;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.loop = true;
    videoEl.preload = 'auto';

    videoEl.onloadedmetadata = () => {
        videoW = videoEl.videoWidth;
        videoH = videoEl.videoHeight;
        videoDuration = videoEl.duration;

        // Set scrubber range
        const scrubber = document.getElementById('video-scrubber');
        scrubber.max = Math.floor(videoDuration * 1000); // ms precision
        scrubber.value = 0;

        document.getElementById('video-total-time').textContent = formatTime(videoDuration);
        document.getElementById('video-current-time').textContent = formatTime(0);

        videoReady = true;
        photo = null; // Clear any existing image
        photoLoaded = false;

        document.getElementById('drop-zone').classList.add('hidden');

        // Auto-play
        videoEl.play();
    };

    videoEl.onerror = () => {
        console.error('Failed to load video');
        videoReady = false;
    };
}

/* ── Capture the current video frame as a p5 image ── */
function captureVideoFrame() {
    if (!videoEl || !videoReady || videoEl.readyState < 2) return;

    if (!window._opimgVideoGraphics) {
        window._opimgVideoGraphics = createGraphics(videoW, videoH);
    }
    if (window._opimgVideoGraphics.width !== videoW || window._opimgVideoGraphics.height !== videoH) {
        window._opimgVideoGraphics.resizeCanvas(videoW, videoH);
    }

    const pg = window._opimgVideoGraphics;
    pg.drawingContext.drawImage(videoEl, 0, 0, videoW, videoH);
    photo = pg;
}

/* ── Update video UI (scrubber, time display) ── */
function updateVideoUI() {
    if (!videoEl || !videoReady) return;
    const currentTime = videoEl.currentTime;

    const scrubber = document.getElementById('video-scrubber');
    // Only update scrubber if user is not dragging it
    if (!scrubber._dragging) {
        scrubber.value = Math.floor(currentTime * 1000);
    }
    document.getElementById('video-current-time').textContent = formatTime(currentTime);
}

/* ── Play / Pause toggle ── */
function toggleVideoPlayback() {
    if (!videoEl || !videoReady) return;
    const btn = document.getElementById('btn-play-pause');
    if (videoEl.paused) {
        videoEl.play();
        btn.textContent = '❚❚';
    } else {
        videoEl.pause();
        btn.textContent = '▶';
    }
}

/* ── Scrubber seek ── */
function initVideoScrubber() {
    const scrubber = document.getElementById('video-scrubber');

    scrubber.addEventListener('mousedown', () => { scrubber._dragging = true; });
    scrubber.addEventListener('touchstart', () => { scrubber._dragging = true; });

    scrubber.addEventListener('input', () => {
        if (!videoEl || !videoReady) return;
        const timeMs = parseInt(scrubber.value);
        videoEl.currentTime = timeMs / 1000;
    });

    scrubber.addEventListener('mouseup', () => { scrubber._dragging = false; });
    scrubber.addEventListener('touchend', () => { scrubber._dragging = false; });
    scrubber.addEventListener('change', () => { scrubber._dragging = false; });
}

/* ── Export video using WebCodecs/WASM ── */
async function startVideoExport() {
    if (!videoEl || !videoReady || isRecording) return;

    const canvasEl = document.querySelector('#canvas-container canvas');
    if (!canvasEl) return;

    if (!videoDuration) return;
    // Use user-specified duration or full video duration
    const durInput = document.getElementById('inp-video-dur');
    const durVal = parseFloat(durInput.value);
    const recDuration = (durVal > 0 && isFinite(durVal)) ? Math.min(durVal, videoDuration) : videoDuration;

    const recFps = parseInt(document.getElementById('sel-rec-fps').value);
    const recBitrate = parseInt(document.getElementById('sel-rec-quality').value);
    const totalFrames = Math.floor(recDuration * recFps);

    isRecording = true;
    recAborted = false;

    updateRecordButton(true);

    const progressWrap = document.getElementById('rec-progress');
    const progressFill = document.getElementById('rec-progress-fill');
    const progressText = document.getElementById('rec-progress-text');
    progressWrap.classList.add('active');
    progressFill.style.width = '0%';
    progressText.textContent = 'Preparing encoder...';

    // Pause normal playback and p5 render loop
    videoEl.pause();
    noLoop();
    const w = canvasEl.width;
    const h = canvasEl.height;

    // Ensure even dimensions (WebCodecs AVC requirement)
    // and ALSO ensure they are multiples of 2 properly for the encoder
    const encW = Math.floor(w / 2) * 2;
    const encH = Math.floor(h / 2) * 2;

    let blob;

    try {
        if (useWebCodecs) {
            blob = await recordWebCodecs(canvasEl, totalFrames, recFps, recBitrate, encW, encH, progressFill, progressText);
        } else {
            blob = await recordWasm(canvasEl, totalFrames, recFps, recBitrate, encW, encH, progressFill, progressText);
        }
    } catch (err) {
        console.error('Recording error:', err);
        progressText.textContent = 'Error: ' + err.message;
        finishRecordingUI();
        return;
    }

    if (blob && !recAborted) {
        progressText.textContent = 'Downloading...';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `opimg-video-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        progressText.textContent = 'Done!';
    } else if (recAborted) {
        progressText.textContent = 'Stopped.';
    }

    finishRecordingUI();
}

function stopVideoExport() {
    if (!isRecording) return;
    recAborted = true;
}

function finishRecordingUI() {
    isRecording = false;
    recAborted = false;
    updateRecordButton(false);

    const playBtn = document.getElementById('btn-play-pause');
    if (videoEl && !videoEl.paused) {
        playBtn.textContent = '❚❚';
    } else {
        playBtn.textContent = '▶';
    }

    loop(); // Resume p5 render loop

    setTimeout(() => {
        document.getElementById('rec-progress').classList.remove('active');
    }, 2000);
}

// Helper to wait for the video to seek to a specific time
function seekVideo(time) {
    return new Promise((resolve) => {
        const onSeeked = () => {
            videoEl.removeEventListener('seeked', onSeeked);
            resolve();
        };
        videoEl.addEventListener('seeked', onSeeked);
        videoEl.currentTime = time;
    });
}

// ── WebCodecs + mp4-muxer ──────────────────────────
async function recordWebCodecs(canvasEl, totalFrames, fps, bitrate, w, h, progressFill, progressText) {
    const target = new Mp4Muxer.ArrayBufferTarget();
    const muxer = new Mp4Muxer.Muxer({
        target,
        video: { codec: 'avc', width: w, height: h },
        fastStart: 'in-memory'
    });

    let encodedCount = 0;

    const encoder = new VideoEncoder({
        output: (chunk, meta) => {
            muxer.addVideoChunk(chunk, meta);
            encodedCount++;
        },
        error: (e) => {
            console.error("VideoEncoder error: ", e);
            throw e;
        }
    });

    encoder.configure({
        codec: 'avc1.640033', // High profile, Level 5.1 — better quality at same bitrate
        width: w,
        height: h,
        bitrate: bitrate,
        framerate: fps,
        latencyMode: 'quality',
        hardwareAcceleration: 'prefer-hardware'
    });

    const startTime = 0; // Start at the beginning of the video, or current time? Let's fix to 0 for consistent export

    for (let i = 0; i < totalFrames; i++) {
        if (recAborted) break;

        const time = startTime + (i / fps);

        // Loop video time if recording is longer than video
        const loopedTime = time % videoDuration;

        await seekVideo(loopedTime);

        // Render a frame
        redraw();

        const timestamp = i * (1_000_000 / fps); // microseconds
        const frame = new VideoFrame(canvasEl, { timestamp });
        encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
        frame.close();

        // Update progress
        const pct = ((i + 1) / totalFrames * 100);
        progressFill.style.width = pct + '%';
        progressText.textContent = `Recording ${i + 1} / ${totalFrames} frames`;

        // Yield to browser every 4 frames
        if (i % 4 === 0) await new Promise(r => setTimeout(r, 0));
    }

    await encoder.flush();
    encoder.close();
    muxer.finalize();

    if (recAborted) return null;
    return new Blob([target.buffer], { type: 'video/mp4' });
}

// ── h264-mp4-encoder (WASM fallback) ───────────────
async function recordWasm(canvasEl, totalFrames, fps, bitrate, w, h, progressFill, progressText) {
    progressText.textContent = 'Loading WASM encoder...';
    const encoder = await HME.createH264MP4Encoder();
    encoder.width = w;
    encoder.height = h;
    encoder.frameRate = fps;
    // Map bitrate to quantization: lower QP = higher quality
    // 25M→8, 15M→10, 8M→15
    const qp = bitrate >= 25000000 ? 8 : bitrate >= 15000000 ? 10 : 15;
    encoder.quantizationParameter = qp;
    encoder.initialize();

    const ctx = canvasEl.getContext('2d');
    const startTime = 0;

    for (let i = 0; i < totalFrames; i++) {
        if (recAborted) break;

        const time = startTime + (i / fps);
        const loopedTime = time % videoDuration;

        await seekVideo(loopedTime);

        redraw();

        const imgData = ctx.getImageData(0, 0, w, h);
        encoder.addFrameRgba(imgData.data);

        const pct = ((i + 1) / totalFrames * 100);
        progressFill.style.width = pct + '%';
        progressText.textContent = `Recording ${i + 1} / ${totalFrames} frames`;

        if (i % 2 === 0) await new Promise(r => setTimeout(r, 0));
    }

    if (recAborted) { encoder.delete(); return null; }

    progressText.textContent = 'Encoding MP4...';
    encoder.finalize();
    const data = encoder.FS.readFile(encoder.outputFilename);
    encoder.delete();

    return new Blob([data], { type: 'video/mp4' });
}

function updateRecordButton(recording) {
    const btn = document.getElementById('btn-export-video');
    if (recording) {
        btn.classList.add('recording');
        btn.textContent = '⏺ Recording...';
    } else {
        btn.classList.remove('recording');
        btn.textContent = 'Export Video';
    }
}

/* ── Clean up video state ── */
function resetVideo() {
    if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute('src');
        videoEl.load();
    }
    videoReady = false;
    videoW = 0;
    videoH = 0;
    videoDuration = 0;
    isRecording = false;
    photo = null;

    const scrubber = document.getElementById('video-scrubber');
    scrubber.value = 0;
    document.getElementById('video-current-time').textContent = '0:00';
    document.getElementById('video-total-time').textContent = '0:00';

    const playBtn = document.getElementById('btn-play-pause');
    playBtn.textContent = '▶';
    updateRecordButton(false);
}

/* ── Utility ── */
function formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
