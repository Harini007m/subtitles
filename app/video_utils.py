import os
import subprocess

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"

def extract_audio(video_path):
    audio_path = video_path.replace(".mp4", ".wav")
    command = f'ffmpeg -y -i "{video_path}" -q:a 0 -map a "{audio_path}"'
    subprocess.call(command, shell=True)
    return audio_path


def embed_subtitles(video_path, srt_path):
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    output_video = os.path.join(
        OUTPUT_DIR,
        "captioned_" + os.path.basename(video_path)
    )

    # Convert Windows path to FFmpeg-safe format
    srt_path_ffmpeg = srt_path.replace("\\", "/")

    command = [
        "ffmpeg",
        "-y",
        "-i", video_path,
        "-vf", f"subtitles='{srt_path_ffmpeg}'",
        output_video
    ]

    subprocess.run(command)

    return output_video
