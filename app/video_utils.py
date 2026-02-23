import os
import subprocess

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"


def extract_audio(video_path: str) -> str:
    """Extract audio from any video format to WAV using ffmpeg."""
    # Use os.path.splitext so ANY video format works (mp4, mkv, mov, avi, webm...)
    base = os.path.splitext(video_path)[0]
    audio_path = base + ".wav"

    command = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vn",                  # no video
        "-acodec", "pcm_s16le", # wav format
        "-ar", "16000",         # 16kHz – ideal for Whisper
        "-ac", "1",             # mono
        audio_path
    ]

    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[ffmpeg error]\n{result.stderr}")
        raise RuntimeError(f"ffmpeg audio extraction failed: {result.stderr[-300:]}")

    return audio_path


def embed_subtitles(video_path, srt_path):
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    output_video = os.path.join(
        OUTPUT_DIR,
        "captioned_" + os.path.basename(video_path)
    )

    # Convert Windows backslashes to forward slashes for ffmpeg subtitle filter
    srt_path_ffmpeg = srt_path.replace("\\", "/").replace(":", "\\:")

    command = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", f"subtitles='{srt_path_ffmpeg}'",
        output_video
    ]

    subprocess.run(command)
    return output_video
