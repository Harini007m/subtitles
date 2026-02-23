import os
import re
import concurrent.futures
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from fastapi.staticfiles import StaticFiles

from app.transcription import transcribe_audio
from app.video_utils import extract_audio

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# In-memory cache: safe_filename -> original segments (English)
transcription_cache = {}


def safe_filename(name: str) -> str:
    """Remove special chars and spaces from filename to avoid ffmpeg/path issues."""
    base, ext = os.path.splitext(name)
    base = re.sub(r"[^\w\-]", "_", base)   # keep letters, digits, _, -
    return base + ext.lower()


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/transcribe/")
async def transcribe_video(file: UploadFile = File(...)):
    """
    Step 1: Upload video and transcribe it. Returns JSON segments.
    """
    fname = safe_filename(file.filename)
    video_path = os.path.join(UPLOAD_DIR, fname)

    # Write uploaded file to disk
    with open(video_path, "wb") as f:
        content = await file.read()
        f.write(content)

    try:
        # Extract audio (works for any video format)
        audio_path = extract_audio(video_path)

        # Transcribe with Whisper
        segments = transcribe_audio(audio_path)
    except Exception as e:
        print(f"[transcription error] {e}")
        return JSONResponse(
            {"error": f"Transcription failed: {str(e)}"},
            status_code=500
        )

    # Cache original segments
    transcription_cache[fname] = segments

    return JSONResponse({
        "filename": fname,
        "segments": segments
    })


@app.get("/video/{filename}")
async def stream_video(filename: str):
    """Serve the uploaded video for playback."""
    video_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(video_path):
        return JSONResponse({"error": "File not found"}, status_code=404)

    # Pick correct MIME type
    ext = os.path.splitext(filename)[1].lower()
    mime_map = {
        ".mp4": "video/mp4",
        ".mkv": "video/x-matroska",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".webm": "video/webm",
    }
    media_type = mime_map.get(ext, "video/mp4")

    return FileResponse(video_path, media_type=media_type)


@app.post("/translate/")
async def translate_segments(
    filename: str = Form(...),
    language: str = Form(...)
):
    """
    Step 2 (live): Translate already-transcribed segments into a new language.
    Returns translated JSON segments instantly (no video re-encoding needed).
    """
    if filename not in transcription_cache:
        return JSONResponse(
            {"error": "Video not transcribed yet. Please upload again."},
            status_code=400
        )

    segments = transcription_cache[filename]
    all_texts = [seg["text"] for seg in segments]

    if language == "en":
        translated_texts = all_texts
    else:
        try:
            from deep_translator import GoogleTranslator
            translator = GoogleTranslator(source="auto", target=language)

            def translate_single(text):
                try:
                    result = translator.translate(text)
                    return result if result else text
                except Exception:
                    return text

            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                translated_texts = list(executor.map(translate_single, all_texts))

        except Exception as e:
            print(f"[translation error] {e}")
            translated_texts = all_texts

    translated_segments = [
        {
            "start": seg["start"],
            "end": seg["end"],
            "text": translated_texts[i]
        }
        for i, seg in enumerate(segments)
    ]

    return JSONResponse({"segments": translated_segments})
