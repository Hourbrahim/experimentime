/* ============================================================
   video.js — Video loading, playback, frame capture & export
   ============================================================ */

let videoEl = null;       // The hidden <video> element
let videoReady = false;
let videoW = 0, videoH = 0;
let videoDuration = 0;
let isRecording = false;
let mediaRecorder = null;
let recordedChunks = [];

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

    // Draw video frame onto the p5 drawingContext, then grab it as a p5 image
    const pg = createGraphics(videoW, videoH);
    pg.drawingContext.drawImage(videoEl, 0, 0, videoW, videoH);
    photo = pg.get();
    pg.remove();
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

/* ── Export video using MediaRecorder ── */
function startVideoExport() {
    if (!videoEl || !videoReady || isRecording) return;

    const canvas = document.querySelector('#canvas-container canvas');
    if (!canvas) return;

    const stream = canvas.captureStream(30); // 30 fps
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

    mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8000000
    });

    recordedChunks = [];

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'opimg-video.webm';
        a.click();
        URL.revokeObjectURL(url);
        isRecording = false;
        updateRecordButton(false);
    };

    // Rewind to start and play
    videoEl.currentTime = 0;
    videoEl.play();

    const playBtn = document.getElementById('btn-play-pause');
    playBtn.textContent = '❚❚';

    mediaRecorder.start(100); // collect data every 100ms
    isRecording = true;
    updateRecordButton(true);

    // Stop recording when video loops back (reaches end)
    const checkEnd = () => {
        if (!isRecording) return;
        if (videoEl.currentTime >= videoDuration - 0.15) {
            stopVideoExport();
        } else {
            requestAnimationFrame(checkEnd);
        }
    };
    requestAnimationFrame(checkEnd);
}

function stopVideoExport() {
    if (!mediaRecorder || !isRecording) return;
    mediaRecorder.stop();
    videoEl.pause();
    const playBtn = document.getElementById('btn-play-pause');
    playBtn.textContent = '▶';
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
