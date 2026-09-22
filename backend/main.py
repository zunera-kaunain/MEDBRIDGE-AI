"""MedBridge AI — FastAPI application entry point."""

import asyncio
import sys

# Windows' default asyncio event loop can't launch subprocesses, which
# Playwright needs to start its browser. This must run before any other
# asyncio code executes, hence right at the top of the entry point.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import database as db
from config import settings
from routers import auth, doctors, patients, sessions, reports, evaluation, patient_chat, ws
from services import reminders as reminder_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Indexes are idempotent, so creating them on every boot is safe and
    # means a fresh clone works without a manual migration step.
    if settings.mongodb_url:
        try:
            await db.ensure_indexes()
        except Exception as exc:
            print(f"WARNING: could not reach MongoDB — {exc}")

    reminder_task = asyncio.create_task(reminder_service.run_reminder_loop())

    yield

    reminder_task.cancel()
    await db.close_db()


app = FastAPI(
    title="MedBridge AI",
    description="Multilingual OPD Documentation Assistant",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(doctors.router)
app.include_router(patients.router)
app.include_router(sessions.router)
app.include_router(reports.router)
app.include_router(ws.router)
app.include_router(evaluation.router)
app.include_router(patient_chat.router)


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "mock_mode": settings.use_mock}


# NOTE: in week 6, StaticFiles for the React build gets mounted at "/" —
# it must come AFTER every router above or it will shadow the API routes.