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

/* ── State ── */
let currentFile = null;
let uploadedFilename = null;
let currentSegments = [];
let segmentCache = {};
let activeLangCode = 'en';
let subtitleRafId = null;
let lastSubIndex = -1;
let dropdownOpen = false;

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
    // start closed
    langDropdown.classList.add('closed');
}
buildDropdown();

/* ── Toggle dropdown ── */
triggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownOpen ? closeDropdown() : openDropdown();
});

// Close on outside click
document.addEventListener('click', () => { if (dropdownOpen) closeDropdown(); });
langDropdown.addEventListener('click', e => e.stopPropagation());

function openDropdown() {
    dropdownOpen = true;
    langDropdown.classList.remove('closed');
    triggerBtn.setAttribute('aria-expanded', 'true');
    // scroll active option into view
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

        // Reset dropdown to English
        updateDropdownSelection('en', 'English');

        mainVideo.src = `/video/${encodeURIComponent(uploadedFilename)}`;
        mainVideo.load();

        stepUpload.classList.add('hidden');
        stepPlayer.classList.remove('hidden');

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

    // Update trigger button UI immediately
    updateDropdownSelection(langCode, langLabel);

    // Instant from cache
    if (segmentCache[langCode]) {
        currentSegments = segmentCache[langCode];
        activeLangCode = langCode;
        lastSubIndex = -1;
        updateStatusBar(langLabel, langFlag);
        return;
    }

    // Fetch from server
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
        updateStatusBar(langLabel, langFlag);

    } catch (err) {
        console.error('[translate]', err);
        showToast(`Could not translate to ${langLabel}: ${err.message}`, 'error');
        // Revert dropdown
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

    fileInput.value = '';
    fileBadge.classList.add('hidden');
    fileNameText.textContent = '';
    transcribeBtn.disabled = true;
    transcribeLoader.classList.add('hidden');
    subtitleText.textContent = '';

    updateDropdownSelection('en', 'English', '🇬🇧');
    closeDropdown();

    stepPlayer.classList.add('hidden');
    stepUpload.classList.remove('hidden');
});

/* ════════════════════════════════════
   TOAST
════════════════════════════════════ */
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
