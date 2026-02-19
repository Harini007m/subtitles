document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('video-file');
    const fileNameDisplay = document.getElementById('file-name');
    const generateBtn = document.getElementById('generate-btn');
    const loadingDiv = document.getElementById('loading');
    const resultDiv = document.getElementById('result');
    const outputVideo = document.getElementById('output-video');
    const downloadLink = document.getElementById('download-link');
    const languageSelect = document.getElementById('language');

    // Drag and Drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropZone.classList.add('dragover');
    }

    function unhighlight() {
        dropZone.classList.remove('dragover');
    }

    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    dropZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', function () {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('video/')) {
                fileInput.files = files; // Sync if dropped
                fileNameDisplay.textContent = file.name;
                generateBtn.disabled = false;
            } else {
                alert('Please upload a valid video file.');
            }
        }
    }

    // Generate Subtitles
    generateBtn.addEventListener('click', async () => {
        if (!fileInput.files.length) {
            alert('Please select a video file first.');
            return;
        }

        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('language', languageSelect.value);

        // UI State
        generateBtn.disabled = true;
        resultDiv.classList.add('hidden');
        loadingDiv.classList.remove('hidden');

        try {
            const response = await fetch('/upload/', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Failed to generate subtitles');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            outputVideo.src = url;
            downloadLink.href = url;
            downloadLink.download = `captioned_${file.name}`;

            resultDiv.classList.remove('hidden');
        } catch (error) {
            console.error(error);
            alert('An error occurred while generating subtitles.');
        } finally {
            loadingDiv.classList.add('hidden');
            generateBtn.disabled = false;
        }
    });
});
