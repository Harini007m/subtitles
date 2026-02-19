# 🎬 AI Subtitle Generator

A powerful web application that automatically generates and embeds subtitles for validation videos using AI. Built with **FastAPI**, **Faster-Whisper**, and **FFmpeg**.

## 🚀 Features

- **Blazing Fast Transcription**: Uses `faster-whisper` (CTranslate2) for high-performance speech-to-text.
- **Multi-Language Support**: Translates subtitles into multiple languages (English, Spanish, French, German, Hindi, Japanese, Chinese).
- **Auto-Embedding**: Automatically burns subtitles into the video using FFmpeg.
- **Modern UI**: Clean, responsive dark-mode interface with drag-and-drop support.
- **GPU Acceleration**: Automatically utilizes CUDA if available for even faster processing.

## 🛠️ Tech Stack

- **Backend**: FastAPI, Python
- **AI Model**: faster-whisper (OpenAI Whisper implementation)
- **Translation**: deep-translator (Google Translate)
- **Media Processing**: FFmpeg
- **Frontend**: HTML5, CSS3, JavaScript

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

1.  **Python 3.8+**
2.  **FFmpeg**: Must be installed and added to your system's PATH.
    *   [Download FFmpeg](https://ffmpeg.org/download.html)
    *   *Verify installation by running `ffmpeg -version` in your terminal.*

## 🔧 Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/subtitle-generator.git
    cd subtitle-generator
    ```

2.  **Create a virtual environment**
    ```bash
    python -m venv venv
    # Windows
    venv\Scripts\activate
    # Mac/Linux
    source venv/bin/activate
    ```

3.  **Install dependencies**
    ```bash
    pip install -r requirements.txt
    ```

## ▶️ Usage

1.  **Start the server**
    ```bash
    uvicorn app.main:app --reload
    ```

2.  **Open the application**
    Navigate to `http://127.0.0.1:8000` in your web browser.

3.  **Generate Subtitles**
    *   Upload a video file (mp4, mov, avi, etc.).
    *   Select your target language.
    *   Click **Generate Subtitles**.
    *   Wait for the process to complete and download your video!

## 📂 Project Structure

```
subtitle-generator/
├── app/
│   ├── main.py            # FastAPI entry point & logic
│   ├── transcription.py   # Whisper AI transcription logic
│   ├── translation.py     # Text translation logic
│   ├── subtitle_utils.py  # SRT file generation
│   └── video_utils.py     # FFmpeg audio extraction & embedding
├── static/
│   ├── style.css          # Frontend styling
│   └── script.js          # Frontend logic
├── templates/
│   └── index.html         # Main UI
├── uploads/               # Temporary storage for uploaded videos
├── outputs/               # Storage for processed videos
├── requirements.txt       # Python dependencies
└── README.md              # Project documentation
```

## ⚡ Performance Tips

- **GPU vs CPU**: For best performance, run on a machine with an NVIDIA GPU and CUDA installed. The app automatically detects CUDA availability.
- **Model Size**: The app defaults to the `tiny` model for speed. You can change this to `base`, `small`, `medium`, or `large` in `app/transcription.py` for better accuracy at the cost of speed.

## 📄 License

This project is open-source and available under the MIT License.
