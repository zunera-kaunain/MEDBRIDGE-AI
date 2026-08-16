"""First-run diagnostic for faster-whisper.

Answers three questions before any streaming code gets written:

  1. Does CTranslate2 actually reach the GPU?
  2. How long does the model take to load, and what is the real-time factor?
  3. What does it do with code-switched Kannada-English audio?

Usage:
    python eval/whisper_check.py eval/data/audio/kn_en_01.wav
    python eval/whisper_check.py eval/data/audio/kn_en_01.wav --model small
    python eval/whisper_check.py eval/data/audio/kn_en_01.wav --lang auto
    python eval/whisper_check.py eval/data/audio/kn_en_01.wav --cpu
"""

import argparse
import os
import platform
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# CUDA DLL registration MUST run before faster_whisper is imported.
#
# The nvidia-*-cu12 pip packages drop DLLs in site-packages/nvidia/*/bin,
# which Windows does not search. Without this, CTranslate2 raises
# "Library cublas64_12.dll is not found or cannot be loaded".
# ---------------------------------------------------------------------------


def register_cuda_dlls() -> list[str]:
    if platform.system() != "Windows":
        return []
    try:
        import nvidia
    except ImportError:
        return []

    # nvidia-* are NAMESPACE packages: __file__ is None, so __path__ is the
    # only way to locate them. Using __file__ raises TypeError.
    roots = [Path(p) for p in nvidia.__path__]
    added = []
    dll_dirs = {p.parent for root in roots for p in root.rglob("*.dll")}
    for dll_dir in dll_dirs:
        try:
            os.add_dll_directory(str(dll_dir))
            added.append(str(dll_dir))
        except OSError:
            continue
    return added


_DLL_DIRS = register_cuda_dlls()


def report_gpu() -> bool:
    try:
        import ctranslate2

        count = ctranslate2.get_cuda_device_count()
    except Exception as exc:
        print(f"  ctranslate2 unavailable: {exc}")
        return False

    if count == 0:
        print("  No CUDA device visible.")
        print("  Install the bundled libraries:")
        print("    pip install nvidia-cublas-cu12 nvidia-cudnn-cu12")
        return False

    print(f"  CUDA devices visible: {count}")
    if _DLL_DIRS:
        print(f"  Registered {len(_DLL_DIRS)} NVIDIA DLL directory(ies)")

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


def load_model(name: str, device: str, compute: str):
    from faster_whisper import WhisperModel

    t0 = time.perf_counter()
    model = WhisperModel(name, device=device, compute_type=compute)
    return model, time.perf_counter() - t0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    parser.add_argument("--model", default="medium",
                        help="tiny | base | small | medium | large-v3")
    parser.add_argument("--lang", default="kn",
                        help="kn, hi, ta, te, ml, or 'auto'")
    parser.add_argument("--compute", default="int8_float16")
    parser.add_argument("--cpu", action="store_true",
                        help="Force CPU even if a GPU is present")
    args = parser.parse_args()

    audio = Path(args.audio)
    if not audio.exists():
        print(f"Audio file not found: {audio}")
        return 1

    print("\n=== Device ===")
    has_gpu = (not args.cpu) and report_gpu()
    device = "cuda" if has_gpu else "cpu"
    compute = args.compute if has_gpu else "int8"
    print(f"  Using: device={device} compute_type={compute}")

    print(f"\n=== Loading model '{args.model}' ===")
    model, load_time = load_model(args.model, device, compute)
    print(f"  Loaded in {load_time:.1f}s")

    print(f"\n=== Transcribing {audio.name} ===")
    language = None if args.lang == "auto" else args.lang
    print(f"  Language hint: {language or 'auto-detect'}")

    def run(m):
        t0 = time.perf_counter()
        segs, info = m.transcribe(
            str(audio),
            language=language,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 700},
            beam_size=5,
        )
        segs = list(segs)  # generator is lazy — consume it before timing
        return segs, info, time.perf_counter() - t0

    try:
        segments, info, infer_time = run(model)
    except RuntimeError as exc:
        if "not found or cannot be loaded" not in str(exc):
            raise
        print(f"\n  GPU inference failed: {exc}")
        print("  Falling back to CPU. Transcript is valid, but timings are")
        print("  not representative of the deployed configuration.")
        model, load_time = load_model(args.model, "cpu", "int8")
        device = "cpu"
        segments, info, infer_time = run(model)

    print(f"\n  Detected language: {info.language} "
          f"(confidence {info.language_probability:.2f})")
    print(f"  Audio duration:    {info.duration:.1f}s")
    print(f"  Inference time:    {infer_time:.1f}s")

    rtf = infer_time / info.duration if info.duration else 0
    verdict = "faster" if rtf < 1 else "SLOWER"
    print(f"  Real-time factor:  {rtf:.2f}x ({verdict} than real time)")

    print("\n=== Transcript ===")
    if not segments:
        print("  (nothing returned — audio may be silent or too quiet)")
    for s in segments:
        print(f"  [{s.start:6.2f} - {s.end:6.2f}]  {s.text.strip()}")

    print("\n=== Full text ===")
    print(" ", " ".join(s.text.strip() for s in segments))

    print(f"\n=== Summary: {args.model} on {device}, RTF {rtf:.2f} ===")
    print("  1. Are BOTH languages present, or did it collapse to one?")
    print("  2. Are drug names and dosages correct? ('paracetamol 500mg')")
    print("  3. Is RTF below ~0.3? Streaming needs headroom.")
    print("  4. Do segment boundaries land on natural pauses?")

    return 0


if __name__ == "__main__":
    sys.exit(main())