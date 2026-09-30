"""WebSocket endpoint for live consultation transcription.

Browser opens one connection per session and keeps it open for the whole
consultation. Audio flows in, transcript events flow out.

Finalised segments are appended to the session's transcript in MongoDB as
they arrive — the extraction step later reads that stored transcript, not
anything held only in the browser's local state.
"""

import asyncio
import json

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

import database as db
from models.common import LanguagePair
from models.session import FinalEvent
from services import asr
from utils.security import decode_access_token

router = APIRouter()


@router.websocket("/ws/session/{session_id}")
async def session_websocket(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(...),
    language_pair: LanguagePair = LanguagePair.EN,
):
    """
    Client -> server: raw PCM audio bytes, sent as binary WebSocket frames,
    roughly 1 second of audio per frame.

    Server -> client: JSON text frames matching the TranscriptEvent shapes
    (partial / final / status / error) from models/session.py.

    Client sends the text message "stop" to end the session cleanly and
    flush any remaining audio as a final segment.

    Browsers can't attach an Authorization header to a WebSocket handshake,
    so the JWT travels as a query param instead (?token=...) — same token
    issued at login, just carried differently for this one endpoint. The
    connection is rejected, not merely closed after accepting, if the token
    is invalid or the session doesn't belong to that doctor: rejecting
    before accept() sends a clean handshake failure rather than a false
    "connected" moment.
    """
    doctor_id = decode_access_token(token)
    if doctor_id is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    session = await db.sessions().find_one({"id": session_id})
    if session is None or session.get("doctor_id") != doctor_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()

    audio_queue: asyncio.Queue = asyncio.Queue()
    transcript_parts: list[str] = []

    async def receive_audio():
        """Pull frames off the WebSocket and push them onto the queue."""
        try:
            while True:
                message = await websocket.receive()

                if message.get("type") == "websocket.disconnect":
                    break

                if "bytes" in message and message["bytes"] is not None:
                    await audio_queue.put(message["bytes"])

                elif "text" in message and message["text"] == "stop":
                    await audio_queue.put(None)  # tells asr.py to flush + stop
                    break

        except WebSocketDisconnect:
            await audio_queue.put(None)

    receiver_task = asyncio.create_task(receive_audio())

    try:
        async for event in asr.transcribe_stream(audio_queue, language_pair):
            if isinstance(event, FinalEvent):
                transcript_parts.append(event.segment.text)
                # Persist immediately, not just at the end — a crash or
                # dropped connection mid-consultation shouldn't lose
                # everything transcribed so far.
                await db.sessions().update_one(
                    {"id": session_id},
                    {"$set": {"transcript": " ".join(transcript_parts)}},
                )

            await websocket.send_text(event.model_dump_json())

    except Exception as exc:
        # Surface the error to the client instead of just dropping silently.
        try:
            await websocket.send_text(
                json.dumps({"type": "error", "message": str(exc)})
            )
        except Exception:
            pass

    finally:
        receiver_task.cancel()
        try:
            await websocket.close()
        except Exception:
            pass