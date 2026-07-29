"""First-run diagnostic for faster-whisper.

Run this BEFORE building the streaming service. It answers three questions:

  1. Does CTranslate2 see the GPU, or is it silently falling back to CPU?
  2. How long does the model take to load, and how much VRAM does it hold?
  3. What does the model actually do with code-switched Kannada-English audio?

Usage:
    python eval/whisper_check.py eval/data/audio/kn_en_01.wav
    python eval/whisper_check.py eval/data/audio/kn_en_01.wav --model large-v3
    python eval/whisper_check.py eval/data/audio/kn_en_01.wav --lang hi
"""

import argparse
import sys
import time
from pathlib import Path


def report_gpu() -> bool:
    """Return True if a CUDA device is visible to CTranslate2."""
    try:
        import ctranslate2

        count = ctranslate2.get_cuda_device_count()
    except Exception as exc:
        print(f"  ctranslate2 import failed: {exc}")
        return False

    if count == 0:
        print("  No CUDA device visible to CTranslate2.")
        print("  If you have an NVIDIA card, install the CUDA libraries:")
        print("    pip install nvidia-cublas-cu12 nvidia-cudnn-cu12")
        return False

    print(f"  CUDA devices visible: {count}")

    # nvidia-smi gives the VRAM figure; it is not required, only informative.
    try:
        import subprocess

        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,memory.used",
             "--format=csv,noheader"],
            capture_output=True, text=True, timeout=10,
        )
        if out.returncode == 0:
            print(f"  {out.stdout.strip()}")
    except Exception:
        pass

    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", help="Path to a 16kHz mono WAV file")
    parser.add_argument("--model", default="medium",
                        help="tiny | base | small | medium | large-v3")
    parser.add_argument("--lang", default="kn",
                        help="Language hint: kn, hi, ta, te, ml, or 'auto'")
    parser.add_argument("--compute", default="int8_float16",
                        help="int8 | int8_float16 | float16")
    args = parser.parse_args()

    audio = Path(args.audio)
    if not audio.exists():
        print(f"Audio file not found: {audio}")
        return 1

    print("\n=== Device ===")
    has_gpu = report_gpu()
    device = "cuda" if has_gpu else "cpu"
    compute = args.compute if has_gpu else "int8"
    print(f"  Using: device={device} compute_type={compute}")

    print(f"\n=== Loading model '{args.model}' ===")
    print("  First run downloads weights (medium is ~1.5GB). Be patient.")

    from faster_whisper import WhisperModel

    t0 = time.perf_counter()
    model = WhisperModel(args.model, device=device, compute_type=compute)
    load_time = time.perf_counter() - t0
    print(f"  Loaded in {load_time:.1f}s")

    print(f"\n=== Transcribing {audio.name} ===")
    language = None if args.lang == "auto" else args.lang
    print(f"  Language hint: {language or 'auto-detect'}")

    t0 = time.perf_counter()
    segments, info = model.transcribe(
        str(audio),
        language=language,
        vad_filter=True,                      # drops silence before decoding
        vad_parameters={"min_silence_duration_ms": 700},
        beam_size=5,
    )
    # transcribe() is lazy — the generator does the work, so consume it
    # before timing anything.
    segments = list(segments)
    infer_time = time.perf_counter() - t0

    print(f"\n  Detected language: {info.language} "
          f"(confidence {info.language_probability:.2f})")
    print(f"  Audio duration:    {info.duration:.1f}s")
    print(f"  Inference time:    {infer_time:.1f}s")

    rtf = infer_time / info.duration if info.duration else 0
    print(f"  Real-time factor:  {rtf:.2f}x  "
          f"({'faster' if rtf < 1 else 'SLOWER'} than real time)")

    print("\n=== Transcript ===")
    if not segments:
        print("  (nothing returned — audio may be silent or too quiet)")
    for s in segments:
        print(f"  [{s.start:6.2f} - {s.end:6.2f}]  {s.text.strip()}")

    print("\n=== Full text ===")
    print(" ", " ".join(s.text.strip() for s in segments))

    print("\n=== What to look for ===")
    print("  1. Are BOTH languages present, or did it collapse to one?")
    print("  2. Are drug names and dosages correct? ('paracetamol 500mg')")
    print("  3. Is RTF comfortably below 1.0? Streaming needs headroom.")
    print("  4. Are segment boundaries at natural pauses?")

    return 0


if __name__ == "__main__":
    sys.exit(main())