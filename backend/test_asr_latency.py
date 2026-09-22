"""Standalone test: diagnoses whether ASR slowness is caused by model
settings or by underlying hardware/thread limitations, and tests GPU in
isolation from the live pipeline.

Run from inside backend/, with USE_MOCK=false in .env:
    python test_asr_latency.py
"""

import os
import time
from pathlib import Path

import soundfile as sf

# Must register CUDA DLL directories BEFORE faster_whisper is imported
# anywhere, including transitively.
from services.asr import _get_model  # noqa: F401 (import order matters)
from config import settings
from faster_whisper import WhisperModel

AUDIO_DIR = Path(__file__).parent.parent / "eval" / "data" / "audio"
TEST_FILE = AUDIO_DIR / "kn_en_02.wav"
WINDOW_SEC = 5


def _time_model(label: str, model) -> None:
    audio, sample_rate = sf.read(TEST_FILE, dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    chunk = audio[: WINDOW_SEC * sample_rate]

    print(f"\n=== {label} ===")
    times = []
    for i in range(3):
        start = time.perf_counter()
        segments, _info = model.transcribe(
            chunk, language="en", task="transcribe", vad_filter=False
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        elapsed = time.perf_counter() - start
        times.append(elapsed)
        print(f"  [{i + 1}/3] {elapsed:.2f}s -> '{text[:50]}'")
    print(f"  Mean: {sum(times) / len(times):.2f}s")


def main():
    if not TEST_FILE.exists():
        print(f"Test file not found: {TEST_FILE}")
        return

    print(f"CPU cores available on this machine: {os.cpu_count()}")
    print(f".env says: WHISPER_MODEL={settings.whisper_model}, "
          f"WHISPER_COMPUTE_TYPE={settings.whisper_compute_type}")

    # Test 1: tiny model, CPU, default threads — establishes the floor.
    # If even this is slow, the problem is hardware, not model choice.
    print("\nLoading tiny/int8 on CPU (default threads)...")
    tiny_model = WhisperModel("tiny", device="cpu", compute_type="int8")
    _time_model("tiny / int8 / default threads", tiny_model)

    # Test 2: tiny model, CPU, forced high thread count.
    print("\nLoading tiny/int8 on CPU (8 threads)...")
    tiny_threaded = WhisperModel("tiny", device="cpu", compute_type="int8", cpu_threads=8)
    _time_model("tiny / int8 / 8 threads", tiny_threaded)

    # Test 3: your current .env config, for direct comparison.
    print(f"\nLoading {settings.whisper_model}/{settings.whisper_compute_type} on CPU (current .env)...")
    current_model = WhisperModel(
        settings.whisper_model, device="cpu", compute_type=settings.whisper_compute_type
    )
    _time_model(f"{settings.whisper_model} / {settings.whisper_compute_type} / default threads", current_model)

    # Test 4: GPU, in isolation — safe even if it fails, this is a
    # standalone process, not your live pipeline.
    print("\nAttempting GPU (cuda)...")
    try:
        gpu_model = WhisperModel(settings.whisper_model, device="cuda", compute_type="int8_float16")
        _time_model(f"{settings.whisper_model} / GPU", gpu_model)
    except Exception as e:
        print(f"  GPU failed: {e}")

    print("\n--- Reading this ---")
    print("If even 'tiny / default threads' takes 10+ seconds for a 5s clip,")
    print("this machine's CPU itself is the bottleneck, not model choice.")
    print("If 8-threads is much faster than default, thread count was limiting you.")
    print("Under ~2s per 5s chunk is what 'feels responsive' for live use.")


if __name__ == "__main__":
    main()