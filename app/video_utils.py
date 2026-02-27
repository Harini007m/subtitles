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
    """Original embed — keeps source container format."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    output_video = os.path.join(
        OUTPUT_DIR,
        "captioned_" + os.path.basename(video_path)
    )

    srt_path_ffmpeg = srt_path.replace("\\", "/").replace(":", "\\:")

    command = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", f"subtitles='{srt_path_ffmpeg}'",
        output_video
    ]

    subprocess.run(command, check=True)
    return output_video


def embed_subtitles_mp4(video_path, srt_path):
    """Burn subtitles into video and always output a standard .mp4 file.

    Uses libx264 + aac so the result is universally playable, regardless
    of the original container format (MKV, MOV, AVI, WebM …).
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Force output filename extension to .mp4
    base_name = os.path.splitext(os.path.basename(video_path))[0]
    output_video = os.path.join(OUTPUT_DIR, f"captioned_{base_name}.mp4")

    # ffmpeg needs forward-slashes and escaped colons for the subtitles filter
    srt_path_ffmpeg = srt_path.replace("\\", "/").replace(":", "\\:")

    command = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-vf", f"subtitles='{srt_path_ffmpeg}'",
        "-c:v", "libx264",   # H.264 video — universally compatible
        "-preset", "fast",   # balance speed vs. size
        "-crf", "23",         # quality (18=best, 28=worst); 23 is default
        "-c:a", "aac",        # AAC audio — works in every MP4 player
        "-b:a", "128k",
        "-movflags", "+faststart",  # enable streaming / quick open
        output_video
    ]

    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[ffmpeg burnin error]\n{result.stderr}")
        raise RuntimeError(f"ffmpeg burn-in failed: {result.stderr[-400:]}")

    return output_video


def remux_to_mp4(input_path: str, output_path: str) -> str:
    """Re-mux any video into an MP4 container by copying streams (no re-encode).

    This is very fast because audio/video data is not decoded or re-encoded.
    The result is a standard, universally-playable .mp4 file.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    command = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-c", "copy",           # copy all streams as-is — no re-encode
        "-movflags", "+faststart",
        output_path
    ]

    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[ffmpeg remux error]\n{result.stderr}")
        raise RuntimeError(f"ffmpeg remux failed: {result.stderr[-400:]}")

    return output_path
