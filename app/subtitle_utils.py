import srt
import os
from datetime import timedelta

OUTPUT_DIR = "outputs"

def generate_srt(segments, original_filename):
    subtitles = []

    for i, seg in enumerate(segments):
        subtitle = srt.Subtitle(
            index=i+1,
            start=timedelta(seconds=seg["start"]),
            end=timedelta(seconds=seg["end"]),
            content=seg["text"]
        )
        subtitles.append(subtitle)

    srt_content = srt.compose(subtitles)

    base_name = os.path.splitext(original_filename)[0]
    srt_path = os.path.join(OUTPUT_DIR, base_name + ".srt")



    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(srt_content)

    return srt_path
