"""Speech recognition service.

Public surface used by the WebSocket handler. Routers and the frontend
never import faster-whisper directly — only this module does.

Week 1: mock path only.
Week 3: real streaming implementation lands behind the same signatures.
"""

from typing import AsyncIterator

from config import settings
from models.common import LanguagePair
from models.session import TranscriptEvent

from . import mocks


async def transcribe_stream(
    audio_queue,
    language_pair: LanguagePair,
) -> AsyncIterator[TranscriptEvent]:
    """Consume audio frames, emit partial and final transcript events.

    audio_queue: asyncio.Queue of raw PCM byte frames (~1s each) pushed by
    the WebSocket handler. Real implementation appends to a rolling buffer,
    re-transcribes the tail every ~2s for partials, and finalises a segment
    when silero-vad reports >700ms of silence.
    """
    if settings.use_mock:
        async for event in mocks.mock_transcript_stream():
            yield event
        return

    raise NotImplementedError(
        "Real streaming ASR lands in week 3. Set USE_MOCK=true for now."
    )


async def transcribe_file(path: str, language_pair: LanguagePair) -> str:
    """Batch transcription of a complete audio file.

    Used by the evaluation harness, not by the live consultation flow.
    Evaluation is not latency-bound, so this may use a larger model than
    the streaming path (see EVAL_WHISPER_MODEL).
    """
    if settings.use_mock:
        return mocks.MOCK_TRANSCRIPT

    raise NotImplementedError("Real batch ASR lands in week 3.")