"""Consultation session models and the streaming transcript contract."""

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field

from .common import LanguagePair, new_id, utcnow


class SessionStatus(str, Enum):
    RECORDING = "recording"
    PROCESSING = "processing"       # extraction running as a BackgroundTask
    READY = "ready"                 # report generated, awaiting doctor review
    CONFIRMED = "confirmed"         # locked, immutable
    FAILED = "failed"


class SessionCreate(BaseModel):
    patient_id: str
    language_pair: LanguagePair


class Session(BaseModel):
    id: str = Field(default_factory=new_id)
    doctor_id: str
    patient_id: str
    language_pair: LanguagePair
    status: SessionStatus = SessionStatus.RECORDING

    transcript: str = ""
    audio_duration_sec: float = 0.0

    # Patient (or their attendant) must explicitly consent to this
    # consultation being recorded and processed before recording starts.
    # Recording/upload endpoints must reject audio until this is True —
    # see routers/sessions.py.
    consent_given: bool = False
    consent_timestamp: datetime | None = None

    # Four distinct timestamps. ABDM treats these as different things and
    # retrofitting them later is painful.
    encounter_start: datetime = Field(default_factory=utcnow)
    encounter_end: datetime | None = None
    report_generated_at: datetime | None = None
    confirmed_at: datetime | None = None


class ConsentConfirm(BaseModel):
    """Body for POST /api/sessions/{id}/consent. Just a confirmation flag —
    the timestamp is stamped server-side, never trusted from the client."""

    confirmed: bool = True


class TranscriptSegment(BaseModel):
    """One finalised utterance, bounded by VAD silence detection."""

    text: str
    start_sec: float
    end_sec: float
    char_offset: tuple[int, int]        # span within Session.transcript


# ---------------------------------------------------------------------------
# WebSocket message contract  (/ws/session/{id})
#
# Client -> server: raw PCM audio bytes, ~1 second per frame.
# Server -> client: the JSON events below.
#
# PARTIAL text is provisional and WILL rewrite itself as more audio arrives.
# Render it grey/italic. FINAL segments are settled — render solid and append.
# ---------------------------------------------------------------------------


class PartialEvent(BaseModel):
    type: Literal["partial"] = "partial"
    text: str


class FinalEvent(BaseModel):
    type: Literal["final"] = "final"
    segment: TranscriptSegment


class StatusEvent(BaseModel):
    type: Literal["status"] = "status"
    status: SessionStatus


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str


TranscriptEvent = PartialEvent | FinalEvent | StatusEvent | ErrorEvent