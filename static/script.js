'use strict';

/* ── Languages ── */
const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'ta', label: 'Tamil' },
    { code: 'hi', label: 'Hindi' },
    { code: 'te', label: 'Telugu' },
    { code: 'kn', label: 'Kannada' },
    { code: 'ml', label: 'Malayalam' },
    { code: 'mr', label: 'Marathi' },
    { code: 'bn', label: 'Bengali' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'es', label: 'Spanish' },
    { code: 'ja', label: 'Japanese' },
    { code: 'zh-CN', label: 'Chinese' },
    { code: 'ar', label: 'Arabic' },
    { code: 'pt', label: 'Portuguese' },
    { code: 'ru', label: 'Russian' },
    { code: 'ko', label: 'Korean' },
    { code: 'it', label: 'Italian' },
];

/* ── DOM refs ── */
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('video-file');
const fileBadge = document.getElementById('file-badge');
const fileNameText = document.getElementById('file-name-text');
const transcribeBtn = document.getElementById('transcribe-btn');
const transcribeLoader = document.getElementById('transcribe-loader');
const stepUpload = document.getElementById('step-upload');
const stepPlayer = document.getElementById('step-player');
const mainVideo = document.getElementById('main-video');
const subtitleOverlay = document.getElementById('subtitle-overlay');
const subtitleText = document.getElementById('subtitle-text');
const translateBadge = document.getElementById('translate-badge');
const statusLangLabel = document.getElementById('status-lang-label');
const statusSegCount = document.getElementById('status-seg-count');
const resetBtn = document.getElementById('reset-btn');

// Dropdown elements
const customSelect = document.getElementById('custom-select');
const triggerBtn = document.getElementById('lang-dropdown-btn');
const selLabel = document.getElementById('sel-label');
const langDropdown = document.getElementById('lang-dropdown');

// Action buttons
const showTranscriptBtn = document.getElementById('show-transcript-btn');
const downloadTranscriptBtn = document.getElementById('download-transcript-btn');
const downloadVideoBtn = document.getElementById('download-video-btn');

// Author editor
const toggleEditorBtn = document.getElementById('toggle-editor-btn');
const authorPanel = document.getElementById('author-panel');
const closeEditorBtn = document.getElementById('close-editor-btn');
const editorSegments = document.getElementById('editor-segments');
const burninBtn = document.getElementById('burnin-btn');
const burninLoader = document.getElementById('burnin-loader');

// Transcript modal
const transcriptModal = document.getElementById('transcript-modal');
const transcriptContent = document.getElementById('transcript-content');
const closeModalBtn = document.getElementById('close-modal-btn');

/* ── State ── */
let currentFile = null;
let uploadedFilename = null;
let currentSegments = [];
let segmentCache = {};
let activeLangCode = 'en';
let subtitleRafId = null;
let lastSubIndex = -1;
let dropdownOpen = false;
let vttBlobURL = null;   // current VTT object URL (freed on update)

/* ════════════════════════════════════
   VTT TRACK — for fullscreen subtitles
════════════════════════════════════ */
function toVTTTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = (sec % 60).toFixed(3).padStart(6, '0');
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s}`;
}

function buildVTT(segments) {
    let vtt = 'WEBVTT\n\n';
    segments.forEach((seg, i) => {
        vtt += `${i + 1}\n`;
        vtt += `${toVTTTime(seg.start)} --> ${toVTTTime(seg.end)}\n`;
        vtt += `${seg.text}\n\n`;
    });
    return vtt;
}

function updateVTTTrack(segments) {
    const existing = mainVideo.querySelector('track');
    if (existing) mainVideo.removeChild(existing);
    if (vttBlobURL) { URL.revokeObjectURL(vttBlobURL); vttBlobURL = null; }

    if (!segments || segments.length === 0) return;

    const blob = new Blob([buildVTT(segments)], { type: 'text/vtt' });
    vttBlobURL = URL.createObjectURL(blob);

    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = 'Auto';
    track.src = vttBlobURL;
    track.default = true;
    mainVideo.appendChild(track);

    if (mainVideo.textTracks[0]) {
        mainVideo.textTracks[0].mode = 'hidden';
    }
}

function onFullscreenChange() {
    const isFullscreen = !!(document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement);
    if (isFullscreen) {
        subtitleOverlay.style.display = 'none';
        if (mainVideo.textTracks[0]) mainVideo.textTracks[0].mode = 'showing';
    } else {
        subtitleOverlay.style.display = '';
        if (mainVideo.textTracks[0]) mainVideo.textTracks[0].mode = 'hidden';
    }
}

document.addEventListener('fullscreenchange', onFullscreenChange);
document.addEventListener('webkitfullscreenchange', onFullscreenChange);
document.addEventListener('mozfullscreenchange', onFullscreenChange);

/* ════════════════════════════════════
   BUILD DROPDOWN OPTIONS
════════════════════════════════════ */
function buildDropdown() {
    langDropdown.innerHTML = '';
    LANGUAGES.forEach(lang => {
        const li = document.createElement('li');
        li.role = 'option';
        li.dataset.lang = lang.code;
        li.dataset.label = lang.label;
        li.setAttribute('aria-selected', lang.code === 'en' ? 'true' : 'false');
        li.innerHTML = `
            <span>${lang.label}</span>
            <svg class="opt-check" width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
                aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
        li.addEventListener('click', () => {
            closeDropdown();
            switchLanguage(lang.code, lang.label);
        });
        langDropdown.appendChild(li);
    });
    langDropdown.classList.add('closed');
}
buildDropdown();

triggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownOpen ? closeDropdown() : openDropdown();
});

document.addEventListener('click', () => { if (dropdownOpen) closeDropdown(); });
langDropdown.addEventListener('click', e => e.stopPropagation());

function openDropdown() {
    dropdownOpen = true;
    langDropdown.classList.remove('closed');
    triggerBtn.setAttribute('aria-expanded', 'true');
    const active = langDropdown.querySelector('[aria-selected="true"]');
    if (active) active.scrollIntoView({ block: 'nearest' });
}

function closeDropdown() {
    dropdownOpen = false;
    langDropdown.classList.add('closed');
    triggerBtn.setAttribute('aria-expanded', 'false');
}

function updateDropdownSelection(langCode, langLabel) {
    selLabel.textContent = langLabel;
    langDropdown.querySelectorAll('li').forEach(li => {
        const selected = li.dataset.lang === langCode;
        li.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
}

/* ════════════════════════════════════
   FILE SELECTION — drag/drop + click
════════════════════════════════════ */
let pickerOpen = false;

function openFilePicker() {
    if (pickerOpen) return;
    pickerOpen = true;
    fileInput.click();
    setTimeout(() => { pickerOpen = false; }, 1000);
}

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt =>
    dropZone.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); })
);
dropZone.addEventListener('dragenter', () => dropZone.classList.add('dragover'));
dropZone.addEventListener('dragover', () => dropZone.classList.add('dragover'));
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
});

dropZone.addEventListener('click', openFilePicker);
document.getElementById('browse-btn').addEventListener('click', e => {
    e.stopPropagation();
    openFilePicker();
});

fileInput.addEventListener('change', function () {
    pickerOpen = false;
    if (this.files.length) setFile(this.files[0]);
});

function setFile(file) {
    const isVideo = file.type.startsWith('video/') ||
        /\.(mp4|mkv|mov|avi|webm|m4v|flv)$/i.test(file.name);
    if (!isVideo) {
        showToast('Please upload a valid video file (MP4, MKV, MOV, AVI, WebM).', 'error');
        return;
    }
    currentFile = file;
    const mb = (file.size / 1024 / 1024).toFixed(1);
    fileNameText.textContent = `${file.name}  (${mb} MB)`;
    fileBadge.classList.remove('hidden');
    transcribeBtn.disabled = false;
}

/* ════════════════════════════════════
   STEP 1 — TRANSCRIBE
════════════════════════════════════ */
transcribeBtn.addEventListener('click', async () => {
    if (!currentFile) { showToast('Please select a video first.', 'error'); return; }

    transcribeBtn.disabled = true;
    transcribeLoader.classList.remove('hidden');

    const formData = new FormData();
    formData.append('file', currentFile);

    try {
        const res = await fetch('/transcribe/', { method: 'POST', body: formData });
        let data;
        try { data = await res.json(); } catch { data = {}; }

        if (!res.ok) throw new Error(data.error || data.detail || `Server error ${res.status}`);
        if (!data.segments || data.segments.length === 0)
            throw new Error('No speech detected in the video. Try a different file.');

        uploadedFilename = data.filename;
        currentSegments = data.segments;
        segmentCache['en'] = data.segments;
        activeLangCode = 'en';

        statusLangLabel.textContent = 'English (original)';
        statusSegCount.textContent = `${currentSegments.length} segments`;

        updateDropdownSelection('en', 'English');

        mainVideo.src = `/video/${encodeURIComponent(uploadedFilename)}`;
        mainVideo.load();

        stepUpload.classList.add('hidden');
        stepPlayer.classList.remove('hidden');

        // Reset download video btn
        downloadVideoBtn.classList.add('hidden');
        downloadVideoBtn.dataset.output = '';

        updateVTTTrack(currentSegments);
        startSubtitleLoop();

    } catch (err) {
        console.error('[transcribe]', err);
        showToast(`Error: ${err.message}`, 'error');
        transcribeBtn.disabled = false;
    } finally {
        transcribeLoader.classList.add('hidden');
    }
});

/* ════════════════════════════════════
   LIVE SUBTITLE LOOP
════════════════════════════════════ */
function startSubtitleLoop() {
    cancelAnimationFrame(subtitleRafId);
    lastSubIndex = -1;
    subtitleText.textContent = '';

    function tick() {
        const t = mainVideo.currentTime;
        const seg = findSegment(t);
        if (seg) {
            const idx = currentSegments.indexOf(seg);
            if (idx !== lastSubIndex) {
                subtitleText.textContent = seg.text;
                lastSubIndex = idx;
            }
        } else {
            if (lastSubIndex !== -2) {
                subtitleText.textContent = '';
                lastSubIndex = -2;
            }
        }
        subtitleRafId = requestAnimationFrame(tick);
    }
    subtitleRafId = requestAnimationFrame(tick);
}

function findSegment(time) {
    let lo = 0, hi = currentSegments.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const seg = currentSegments[mid];
        if (time < seg.start) hi = mid - 1;
        else if (time > seg.end) lo = mid + 1;
        else return seg;
    }
    return null;
}

/* ════════════════════════════════════
   LIVE LANGUAGE SWITCH
════════════════════════════════════ */
async function switchLanguage(langCode, langLabel) {
    if (langCode === activeLangCode) return;

    updateDropdownSelection(langCode, langLabel);

    if (segmentCache[langCode]) {
        currentSegments = segmentCache[langCode];
        activeLangCode = langCode;
        lastSubIndex = -1;
        updateVTTTrack(currentSegments);
        updateStatusBar(langLabel);
        return;
    }

    triggerBtn.disabled = true;
    translateBadge.classList.remove('hidden');

    const form = new FormData();
    form.append('filename', uploadedFilename);
    form.append('language', langCode);

    try {
        const res = await fetch('/translate/', { method: 'POST', body: form });
        let data;
        try { data = await res.json(); } catch { data = {}; }
        if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);

        segmentCache[langCode] = data.segments;
        currentSegments = data.segments;
        activeLangCode = langCode;
        lastSubIndex = -1;
        updateVTTTrack(currentSegments);
        updateStatusBar(langLabel);

    } catch (err) {
        console.error('[translate]', err);
        showToast(`Could not translate to ${langLabel}: ${err.message}`, 'error');
        const prev = LANGUAGES.find(l => l.code === activeLangCode);
        if (prev) updateDropdownSelection(prev.code, prev.label);
    } finally {
        translateBadge.classList.add('hidden');
        triggerBtn.disabled = false;
    }
}

function updateStatusBar(langLabel) {
    statusLangLabel.textContent = langLabel;
    statusSegCount.textContent = `${currentSegments.length} segments`;
}

/* ════════════════════════════════════
   SHOW TRANSCRIPT — modal
════════════════════════════════════ */
showTranscriptBtn.addEventListener('click', () => {
    if (!currentSegments.length) {
        showToast('No transcript available.', 'error');
        return;
    }
    transcriptContent.innerHTML = '';

    currentSegments.forEach((seg, i) => {
        const row = document.createElement('div');
        row.className = 'transcript-row';

        const ts = document.createElement('span');
        ts.className = 'transcript-ts';
        ts.textContent = formatTime(seg.start) + ' → ' + formatTime(seg.end);

        const txt = document.createElement('span');
        txt.className = 'transcript-line';
        txt.textContent = seg.text.trim();

        row.appendChild(ts);
        row.appendChild(txt);
        transcriptContent.appendChild(row);
    });

    transcriptModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
});

closeModalBtn.addEventListener('click', closeTranscriptModal);
transcriptModal.addEventListener('click', (e) => {
    if (e.target === transcriptModal) closeTranscriptModal();
});

function closeTranscriptModal() {
    transcriptModal.classList.add('hidden');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeTranscriptModal();
        closeAuthorPanel();
    }
});

/* ════════════════════════════════════
   DOWNLOAD TRANSCRIPT
════════════════════════════════════ */
downloadTranscriptBtn.addEventListener('click', async () => {
    if (!uploadedFilename || !currentSegments.length) {
        showToast('No transcript available to download.', 'error');
        return;
    }

    downloadTranscriptBtn.disabled = true;
    downloadTranscriptBtn.textContent = 'Preparing…';

    try {
        const res = await fetch('/download-transcript/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: uploadedFilename, segments: currentSegments })
        });

        if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.error || `Server error ${res.status}`);
        }

        // Trigger browser download
        const blob = await res.blob();
        const base = uploadedFilename.replace(/\.[^.]+$/, '');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = base + '_transcript.docx';
        a.click();
        URL.revokeObjectURL(url);

        showToast('Transcript downloaded!', 'info');

    } catch (err) {
        console.error('[download-transcript]', err);
        showToast(`Failed to download transcript: ${err.message}`, 'error');
    } finally {
        downloadTranscriptBtn.disabled = false;
        downloadTranscriptBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Transcript`;
    }
});

/* ════════════════════════════════════
   DOWNLOAD SUBTITLED VIDEO
════════════════════════════════════ */
downloadVideoBtn.addEventListener('click', () => {
    const outFile = downloadVideoBtn.dataset.output;
    if (!outFile) return;
    const a = document.createElement('a');
    a.href = `/download-video/${encodeURIComponent(outFile)}`;
    a.download = outFile;
    a.click();
});

/* ════════════════════════════════════
   AUTHOR SUBTITLE EDITOR
════════════════════════════════════ */
toggleEditorBtn.addEventListener('click', () => {
    if (authorPanel.classList.contains('hidden')) {
        openAuthorPanel();
    } else {
        closeAuthorPanel();
    }
});

closeEditorBtn.addEventListener('click', closeAuthorPanel);

function openAuthorPanel() {
    buildEditorRows();
    authorPanel.classList.remove('hidden');
    authorPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toggleEditorBtn.textContent = '✕ Close Editor';
}

function closeAuthorPanel() {
    authorPanel.classList.add('hidden');
    toggleEditorBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Edit Subtitles (Author)`;
}

function buildEditorRows() {
    editorSegments.innerHTML = '';
    currentSegments.forEach((seg, i) => {
        const row = document.createElement('div');
        row.className = 'editor-row';
        row.dataset.index = i;

        const ts = document.createElement('span');
        ts.className = 'editor-ts';
        ts.textContent = `${formatTime(seg.start)} → ${formatTime(seg.end)}`;

        const ta = document.createElement('textarea');
        ta.className = 'editor-textarea';
        ta.rows = 2;
        ta.value = seg.text.trim();
        ta.dataset.index = i;
        ta.addEventListener('input', () => {
            currentSegments[i] = { ...currentSegments[i], text: ta.value };
            // Invalidate caches for current lang so subtitle loop picks new text
            segmentCache[activeLangCode] = currentSegments.map(s => ({ ...s }));
            lastSubIndex = -1;
        });

        row.appendChild(ts);
        row.appendChild(ta);
        editorSegments.appendChild(row);
    });
}

/* ── Burn-in ── */
burninBtn.addEventListener('click', async () => {
    if (!uploadedFilename || !currentSegments.length) {
        showToast('Nothing to burn in.', 'error');
        return;
    }

    burninBtn.disabled = true;
    burninLoader.classList.remove('hidden');
    showToast('Burning subtitles into video, please wait…', 'info');

    try {
        const res = await fetch('/burnin/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: uploadedFilename,
                segments: currentSegments
            })
        });

        let data;
        try { data = await res.json(); } catch { data = {}; }
        if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);

        const outFile = data.output_filename;
        downloadVideoBtn.dataset.output = outFile;
        downloadVideoBtn.classList.remove('hidden');

        showToast('✅ Subtitles burned in! You can now download the video.', 'info');
        closeAuthorPanel();

    } catch (err) {
        console.error('[burnin]', err);
        showToast(`Burn-in failed: ${err.message}`, 'error');
    } finally {
        burninBtn.disabled = false;
        burninLoader.classList.add('hidden');
    }
});

/* ════════════════════════════════════
   RESET
════════════════════════════════════ */
resetBtn.addEventListener('click', () => {
    cancelAnimationFrame(subtitleRafId);
    subtitleRafId = null;

    mainVideo.pause();
    mainVideo.src = '';
    mainVideo.load();

    currentFile = null;
    uploadedFilename = null;
    currentSegments = [];
    segmentCache = {};
    activeLangCode = 'en';
    lastSubIndex = -1;

    updateVTTTrack([]);
    if (vttBlobURL) { URL.revokeObjectURL(vttBlobURL); vttBlobURL = null; }

    fileInput.value = '';
    fileBadge.classList.add('hidden');
    fileNameText.textContent = '';
    transcribeBtn.disabled = true;
    transcribeLoader.classList.add('hidden');
    subtitleText.textContent = '';

    updateDropdownSelection('en', 'English');
    closeDropdown();
    closeAuthorPanel();
    closeTranscriptModal();

    downloadVideoBtn.classList.add('hidden');
    downloadVideoBtn.dataset.output = '';

    stepPlayer.classList.add('hidden');
    stepUpload.classList.remove('hidden');
});

/* ════════════════════════════════════
   UTILITIES
════════════════════════════════════ */
function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ═══ TOAST ═══ */
let toastTimer = null;
function showToast(msg, type = 'info') {
    let el = document.getElementById('__toast');
    if (!el) {
        el = document.createElement('div');
        el.id = '__toast';
        Object.assign(el.style, {
            position: 'fixed', bottom: '2rem', left: '50%',
            transform: 'translateX(-50%) translateY(16px)',
            background: 'rgba(13,15,28,0.97)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#f1f5f9', padding: '0.75rem 1.5rem',
            borderRadius: '12px', fontFamily: 'inherit',
            fontSize: '0.88rem', fontWeight: '500', zIndex: '9999',
            opacity: '0', transition: 'opacity 0.3s, transform 0.3s',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            maxWidth: '90vw', textAlign: 'center', pointerEvents: 'none',
        });
        document.body.appendChild(el);
    }
    el.style.borderColor = type === 'error' ? 'rgba(239,68,68,0.5)' : 'rgba(99,102,241,0.4)';
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(-50%) translateY(16px)';
    }, 4000);
}
