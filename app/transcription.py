from faster_whisper import WhisperModel
import torch

device = "cuda" if torch.cuda.is_available() else "cpu"
compute_type = "float16" if torch.cuda.is_available() else "int8"

print(f"Loading Whisper model on {device} with {compute_type} precision...")
model = WhisperModel("tiny", device=device, compute_type=compute_type)

def transcribe_audio(audio_path):
    segments, info = model.transcribe(audio_path, beam_size=1)
    
    result_segments = []
    for seg in segments:
        result_segments.append({
            "start": seg.start,
            "end": seg.end,
            "text": seg.text
        })

    return result_segments
