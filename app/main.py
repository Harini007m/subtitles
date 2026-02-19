import os
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request

from app.transcription import transcribe_audio
from app.translation import translate_text
from app.subtitle_utils import generate_srt
from app.video_utils import extract_audio, embed_subtitles

from fastapi.staticfiles import StaticFiles

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/upload/")
async def upload_video(
    file: UploadFile = File(...),
    language: str = Form(...)
):
    video_path = os.path.join(UPLOAD_DIR, file.filename)

    with open(video_path, "wb") as f:
        f.write(await file.read())

    # 1️⃣ Extract Audio
    audio_path = extract_audio(video_path)

    # 2️⃣ Transcribe
    segments = transcribe_audio(audio_path)

    # 3️⃣ Translate
    translated_segments = []
    for seg in segments:
        translated_text = translate_text(seg["text"], language)
        translated_segments.append({
            "start": seg["start"],
            "end": seg["end"],
            "text": translated_text
        })

    # 4️⃣ Generate SRT
    srt_path = generate_srt(translated_segments, file.filename)

    # 5️⃣ Embed Subtitles
    output_video = embed_subtitles(video_path, srt_path)

    return FileResponse(output_video, media_type="video/mp4", filename="captioned_video.mp4")
