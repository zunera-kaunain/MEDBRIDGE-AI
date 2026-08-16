"""Sweep model sizes and quantisation types to find a working configuration.

Diagnoses the case where larger models produce WORSE output than smaller
ones — which indicates a numerical/quantisation fault rather than a model
capability limit.

Also reports audio level, since quiet or clipped input is an independent
cause of Whisper hallucination loops.

Usage:
    python eval/sweep.py eval/data/audio/kn_en_01.wav
    python eval/sweep.py eval/data/audio/kn_en_01.wav --models tiny,small
    python eval/sweep.py eval/data/audio/kn_en_01.wav --no-vad
"""

import argparse
import gc
import os
import platform
import sys
import time
import wave
from pathlib import Path


def register_cuda_dlls() -> int:
    if platform.system() != "Windows":
        return 0
    try:
        import nvidia
    except ImportError:
        return 0

    added = []
    dll_dirs = {
        p.parent
        for root in nvidia.__path__
        for p in Path(root).rglob("*.dll")
    }
    for d in dll_dirs:
        try:
            os.add_dll_directory(str(d))
            added.append(str(d))
        except OSError:
            continue
    if added:
        os.environ["PATH"] = os.pathsep.join(added) + os.pathsep + os.environ.get("PATH", "")
    return len(added)


register_cuda_dlls()


def inspect_audio(path: Path) -> None:
    """Report format and level. Quiet audio causes hallucination loops."""
    print("\n=== Audio ===")
    try:
        with wave.open(str(path), "rb") as w:
            channels = w.getnchannels()
            rate = w.getframerate()
            width = w.getsampwidth()
            frames = w.getnframes()
            raw = w.readframes(frames)
    except wave.Error as exc:
        print(f"  Not a readable WAV: {exc}")
        return

    duration = frames / rate if rate else 0
    print(f"  {rate} Hz, {channels}ch, {width * 8}-bit, {duration:.1f}s")

    if rate != 16000 or channels != 1:
        print("  WARNING: expected 16000 Hz mono. Reconvert:")
        print("    ffmpeg -i input -ar 16000 -ac 1 output.wav")

    if width == 2:
        import array

        samples = array.array("h")
        samples.frombytes(raw)
        peak = max(abs(min(samples)), abs(max(samples))) if samples else 0
        pct = peak / 32768 * 100
        print(f"  Peak level: {pct:.1f}% of full scale")
        if pct < 10:
            print("  WARNING: very quiet. Low level is a known cause of")
            print("           repetition/hallucination in Whisper.")
        elif pct > 99:
            print("  WARNING: likely clipped.")


def try_config(audio: Path, model_name: str, compute: str,
               language: str | None, use_vad: bool) -> dict:
    from faster_whisper import WhisperModel

    result = {
        "model": model_name,
        "compute": compute,
        "rtf": None,
        "text": "",
        "segments": 0,
        "error": None,
    }

    model = None
    try:
        model = WhisperModel(model_name, device="cuda", compute_type=compute)

        kwargs = {"language": language, "beam_size": 5}
        if use_vad:
            kwargs["vad_filter"] = True
            kwargs["vad_parameters"] = {"min_silence_duration_ms": 700}

        t0 = time.perf_counter()
        segs, info = model.transcribe(str(audio), **kwargs)
        segs = list(segs)
        elapsed = time.perf_counter() - t0

        result["rtf"] = elapsed / info.duration if info.duration else 0
        result["segments"] = len(segs)
        result["text"] = " ".join(s.text.strip() for s in segs)
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
    finally:
        # Free VRAM before loading the next model, or the later configs
        # fail for reasons unrelated to what is being tested.
        del model
        gc.collect()

    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio")
    parser.add_argument("--models", default="tiny,small,medium")
    parser.add_argument("--computes", default="float16,int8_float16,int8")
    parser.add_argument("--lang", default="kn")
    parser.add_argument("--no-vad", action="store_true")
    args = parser.parse_args()

    audio = Path(args.audio)
    if not audio.exists():
        print(f"Audio file not found: {audio}")
        return 1

    inspect_audio(audio)

    models = [m.strip() for m in args.models.split(",") if m.strip()]
    computes = [c.strip() for c in args.computes.split(",") if c.strip()]
    language = None if args.lang == "auto" else args.lang

    print(f"\n=== Sweep: {len(models)} models x {len(computes)} compute types ===")
    print(f"  language={language or 'auto'}  vad={not args.no_vad}")
    print("  Models download on first use — the first pass may be slow.\n")

    rows = []
    for model_name in models:
        for compute in computes:
            label = f"{model_name}/{compute}"
            print(f"  running {label} ...", end=" ", flush=True)
            r = try_config(audio, model_name, compute, language, not args.no_vad)
            rows.append(r)
            if r["error"]:
                print(f"FAILED — {r['error'][:60]}")
            else:
                print(f"RTF {r['rtf']:.2f}, {r['segments']} segments")

    print("\n" + "=" * 78)
    print(f"{'CONFIG':<24}{'RTF':>7}  {'SEGS':>4}  TRANSCRIPT (first 40 chars)")
    print("=" * 78)
    for r in rows:
        cfg = f"{r['model']}/{r['compute']}"
        if r["error"]:
            print(f"{cfg:<24}{'—':>7}  {'—':>4}  FAILED")
            continue
        snippet = r["text"][:40].replace("\n", " ") or "(empty)"
        print(f"{cfg:<24}{r['rtf']:>7.2f}  {r['segments']:>4}  {snippet}")

    print("\n=== Full transcripts ===")
    for r in rows:
        if r["error"] or not r["text"]:
            continue
        print(f"\n[{r['model']}/{r['compute']}]  RTF {r['rtf']:.2f}")
        print(f"  {r['text']}")

    print("\n=== Reading this ===")
    print("  A LARGER model producing WORSE output means the quantisation")
    print("  is at fault, not the model. Pick the largest configuration whose")
    print("  transcript is coherent AND whose RTF stays under ~0.3.")
    print("  One segment spanning the whole clip = hallucination loop.")

    return 0


if __name__ == "__main__":
    sys.exit(main())