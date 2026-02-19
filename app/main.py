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
    import concurrent.futures

    # Batch translate all text at once to reduce overhead
    all_texts = [seg["text"] for seg in segments]
    
    if language != "en":
        try:
             # Deep Translator sometimes has character limits, but for typical subtitles batching 
             # by sentence is okay. However, to be safe and fast, let's use a batch approach 
             # if the library supports it, or optimize the loop. 
             # iterating with a single translator instance is faster than recreating it.
             
             from deep_translator import GoogleTranslator
             translator = GoogleTranslator(source='auto', target=language)
             
             # Translate sequentially but with a single instance (GoogleTranslator doesn't support list natively in all versions)
             # But we can use concurrent execution more effectively.
             
             def translate_single(text):
                 try:
                     return translator.translate(text)
                 except:
                     return text

             with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                 translated_texts = list(executor.map(translate_single, all_texts))
                 
        except Exception as e:
            print(f"Translation failed: {e}")
            translated_texts = all_texts
    else:
        translated_texts = all_texts

    translated_segments = []
    for i, seg in enumerate(segments):
        translated_segments.append({
            "start": seg["start"],
            "end": seg["end"],
            "text": translated_texts[i]
        })

    # 4️⃣ Generate SRT
    srt_path = generate_srt(translated_segments, file.filename)

    # 5️⃣ Embed Subtitles
    output_video = embed_subtitles(video_path, srt_path)

    return FileResponse(output_video, media_type="video/mp4", filename="captioned_video.mp4")
