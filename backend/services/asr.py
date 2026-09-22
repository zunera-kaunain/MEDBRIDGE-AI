"""Speech recognition service.

Public surface used by the WebSocket handler. Routers and the frontend
never import faster-whisper directly — only this module does.

Week 1: mock path only.
Week 3: real streaming implementation lands behind the same signatures.
"""

import time
import asyncio
from typing import AsyncIterator

import numpy as np

from utils.cuda_dlls import register_cuda_dlls

register_cuda_dlls()

from faster_whisper import WhisperModel

from config import settings
from models.common import LanguagePair
from models.session import (
    FinalEvent,
    PartialEvent,
    TranscriptEvent,
    TranscriptSegment,
)

from . import mocks

# Audio frames arrive as raw 16-bit PCM, mono, at this sample rate.
# Must match whatever the frontend/WebSocket handler actually records at.
SAMPLE_RATE = 16000

_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    """Lazily load the streaming Whisper model once per process."""
    global _model
    if _model is None:
        print("[asr] loading whisper model onto GPU, this may take a moment...")
        _model = WhisperModel(
            settings.whisper_model,
            device="cpu",
            compute_type=settings.whisper_compute_type,
        )
        print("[asr] model loaded successfully")
    return _model


def _pcm_to_float32(pcm_bytes: bytes) -> np.ndarray:
    """Convert raw 16-bit PCM bytes into the float32 array faster-whisper wants."""
    audio = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32)
    return audio / 32768.0


def _rms(audio: np.ndarray) -> float:
    """Volume level of a chunk. Used as a cheap stand-in for real VAD."""
    if audio.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(np.square(audio))))


# Below this volume, a frame counts as silence. This is a rough starting
# point, not measured science — if real consultations finalise sentences
# too eagerly or not eagerly enough, tune this first.
_SILENCE_RMS_THRESHOLD = 0.02

# How many seconds of the most recent audio to use for a "partial" preview.
# Keeping this short means partials stay fast and don't slow down the
# longer someone talks — unlike re-transcribing the whole growing buffer.
_PARTIAL_WINDOW_SEC = 5
_BYTES_PER_SEC = SAMPLE_RATE * 2  # 16-bit PCM = 2 bytes per sample


def _transcribe_buffer(audio: np.ndarray, whisper_hint: str) -> str:
    model = _get_model()
    segments, _info = model.transcribe(
        audio,
        language=whisper_hint,
        task="transcribe",   # explicit — task="translate" is Whisper's other
                              # mode and is what silently rewrites sentences
                              # instead of transcribing them (see eval notes)
        vad_filter=False,     # buffer is already short; silence handled below
    )
    text = " ".join(seg.text.strip() for seg in segments).strip()
    print(f"[asr] transcribed buffer ({len(audio)} samples) -> '{text}'")
    return text


async def transcribe_stream(
    audio_queue,
    language_pair: LanguagePair,
) -> AsyncIterator[TranscriptEvent]:
    """Consume audio frames, emit partial and final transcript events.

    audio_queue: asyncio.Queue of raw PCM byte frames (~1s each) pushed by
    the WebSocket handler. Push None onto the queue to signal end of stream
    and flush any remaining audio as a final segment.

    Partials only re-transcribe the last _PARTIAL_WINDOW_SEC of audio, so
    latency stays roughly constant instead of growing with sentence length.
    Finals always transcribe the full segment since the buffer resets after.
    """
    if settings.use_mock:
        async for event in mocks.mock_transcript_stream():
            yield event
        return

    whisper_hint = language_pair.whisper_hint

    buffer = bytearray()
    cursor = 0
    silence_ms = 0.0
    last_partial_at = time.monotonic()
    segment_start_sec = 0.0
    elapsed_sec = 0.0
    frame_ms = 1000  # frames are ~1s each, per the queue contract

    while True:
        frame: bytes | None = await audio_queue.get()
        print(f"[asr] received frame: {'None (stop)' if frame is None else f'{len(frame)} bytes'}")

        if frame is None:
            if buffer:
                audio = _pcm_to_float32(bytes(buffer))
                text = await asyncio.to_thread(_transcribe_buffer, audio, whisper_hint)
                if text:
                    yield FinalEvent(
                        segment=TranscriptSegment(
                            text=text,
                            start_sec=round(segment_start_sec, 2),
                            end_sec=round(elapsed_sec, 2),
                            char_offset=(cursor, cursor + len(text)),
                        )
                    )
            return

        buffer.extend(frame)
        elapsed_sec += frame_ms / 1000

        frame_audio = _pcm_to_float32(frame)
        silence_ms = silence_ms + frame_ms if _rms(frame_audio) < _SILENCE_RMS_THRESHOLD else 0.0

        now = time.monotonic()
        should_finalise = silence_ms >= settings.vad_silence_ms and len(buffer) > 0
        should_partial = (
            not should_finalise
            and (now - last_partial_at) * 1000 >= settings.stream_partial_interval_ms
        )

        if should_finalise:
            # Full segment — buffer is about to be cleared, so this is the
            # only chance to transcribe all of it.
            audio = _pcm_to_float32(bytes(buffer))
            text = await asyncio.to_thread(_transcribe_buffer, audio, whisper_hint)
            if text:
                yield FinalEvent(
                    segment=TranscriptSegment(
                        text=text,
                        start_sec=round(segment_start_sec, 2),
                        end_sec=round(elapsed_sec, 2),
                        char_offset=(cursor, cursor + len(text)),
                    )
                )
                cursor += len(text) + 1

            buffer.clear()
            silence_ms = 0.0
            segment_start_sec = elapsed_sec
            last_partial_at = now

        elif should_partial:
            # Only the recent tail — keeps this fast no matter how long
            # the sentence has been running.
            window_bytes = _PARTIAL_WINDOW_SEC * _BYTES_PER_SEC
            tail = bytes(buffer[-window_bytes:])
            audio = _pcm_to_float32(tail)
            text = await asyncio.to_thread(_transcribe_buffer, audio, whisper_hint)
            if text:
                yield PartialEvent(text=text)
            last_partial_at = now


async def transcribe_file(path: str, language_pair: LanguagePair) -> str:
    """Batch transcription of a complete audio file.

    Used by the evaluation harness, not by the live consultation flow.
    Evaluation is not latency-bound, so this uses the larger eval model.
    """
    if settings.use_mock:
        return mocks.MOCK_TRANSCRIPT

    model = WhisperModel(
        settings.eval_whisper_model,
        device="cpu",
        compute_type=settings.whisper_compute_type,
    )
    segments, _info = model.transcribe(
        path,
        language=language_pair.whisper_hint,
        task="transcribe",
        vad_filter=True,
    )
    return " ".join(seg.text.strip() for seg in segments).strip()