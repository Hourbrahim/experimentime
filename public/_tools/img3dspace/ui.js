document.addEventListener('DOMContentLoaded', () => {
    // Parameter Sliders Mapping
    const sliders = [
        { id: 'morph-slider', key: 'distortion', display: 'morph-val' },
        { id: 'speed-slider', key: 'speed', display: 'speed-val' },
        { id: 'radius-slider', key: 'radius', display: 'radius-val' },
        { id: 'freq-x', key: 'freqX', display: null },
        { id: 'freq-y', key: 'freqY', display: null },
        { id: 'wave-move', key: 'waveMove', display: null },
        { id: 'stroke-slider', key: 'strokeLimit', display: null }
    ];

    sliders.forEach(s => {
        const el = document.getElementById(s.id);
        if (!el) return;

        el.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (s.display) {
                const displayEl = document.getElementById(s.display);
                if (displayEl) displayEl.textContent = val;
            }
            window.updateParam(s.key, val);
        });
    });

    // Ratio Selector
    const ratioSelect = document.getElementById('canvas-ratio');
    ratioSelect.addEventListener('change', (e) => {
        window.updateParam('ratio', e.target.value);
    });

    // Unique Distribution Toggle
    document.getElementById('unique-toggle').addEventListener('change', (e) => {
        window.updateParam('uniqueMode', e.target.checked);
    });

    // Recording Logic
    const recBtn = document.getElementById('record-btn');
    const recStatus = document.getElementById('record-status');
    let isRecording = false;

    recBtn.addEventListener('click', () => {
        if (!isRecording) {
            window.startRecording();
            recBtn.textContent = 'STOP RECORDING';
            recBtn.classList.add('recording');
            recStatus.textContent = 'RECORDING LIVE...';
            isRecording = true;
        } else {
            window.stopRecording();
            recBtn.textContent = 'START RECORDING';
            recBtn.classList.remove('recording');
            recStatus.textContent = 'EXPORTING VIDEO...';
            setTimeout(() => {
                recStatus.textContent = 'READY TO EXPORT';
            }, 3000);
            isRecording = false;
        }
    });

    // Image Upload Handling (Cleaned up - no thumbnails)
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');

    const handleFiles = (files) => {
        const fileList = Array.from(files);
        const imageFiles = fileList.filter(f => f.type.startsWith('image/'));

        imageFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                // Using P5.js loadImage globally accessible via sketch.js
                window.loadImage(e.target.result, (img) => {
                    window.addImages([img]);
                });
            };
            reader.readAsDataURL(file);
        });

        // Brief visual feedback for upload
        const originalText = dropZone.querySelector('p').innerHTML;
        dropZone.querySelector('p').style.color = 'black';
        dropZone.querySelector('p').textContent = 'ASSETS ADDED';
        setTimeout(() => {
            dropZone.querySelector('p').innerHTML = originalText;
        }, 2000);
    };

    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // Drag and Drop events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.background = '#f0f0f0';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.background = 'transparent';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = 'transparent';
        handleFiles(e.dataTransfer.files);
    });

    dropZone.addEventListener('click', () => fileInput.click());
});
