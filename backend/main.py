"""MedBridge AI — FastAPI application entry point."""

import asyncio
import sys

# Windows' default asyncio event loop can't launch subprocesses, which
# Playwright needs to start its browser. This must run before any other
# asyncio code executes, hence right at the top of the entry point.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

import database as db
from config import settings
from routers import (
    account,
    audit,
    auth,
    doctors,
    evaluation,
    google_auth,
    patient_chat,
    password_reset,
    patients,
    receptionist,
    receptionist_auth,
    reports,
    sessions,
    ws,
)
from services import audit as audit_service
from services import reminders as reminder_service


def check_production_settings() -> None:
    """Refuse to start in production with unsafe defaults.

    The dev JWT secret is public (it is in the source code), so anyone could
    forge a sign-in token for any account if it were used on a real server.
    """
    if settings.environment.lower() != "production":
        return
    problems = []
    if settings.jwt_secret == "dev-secret-change-me" or len(settings.jwt_secret) < 32:
        problems.append("JWT_SECRET must be a random string of at least 32 characters")
    if not settings.mongodb_url:
        problems.append("MONGODB_URL is not set")
    if settings.use_mock:
        problems.append("USE_MOCK must be false (mock mode returns fake transcripts)")
    if problems:
        raise RuntimeError("Unsafe production settings: " + "; ".join(problems))


check_production_settings()


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
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def audit_requests(request, call_next):
    """Record who called what (see services/audit.py)."""
    response = await call_next(request)
    audit_service.record_request(request, response.status_code)
    return response


app.include_router(auth.router)
app.include_router(audit.router)
app.include_router(account.router)
app.include_router(receptionist_auth.router)
app.include_router(password_reset.router)
app.include_router(google_auth.router)
app.include_router(receptionist.router)
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


# --- Serve the built React app (one machine, one URL) -----------------------
# Registered LAST so it can never shadow an API or WebSocket route. Any path
# that is not a real file falls back to index.html so React Router can handle
# URLs like /login or /app/patients/123 on a hard refresh.
_dist = (Path(__file__).parent / settings.frontend_dist).resolve()

if (_dist / "index.html").is_file():
    if (_dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        if full_path.split("/", 1)[0] in {"api", "auth", "ws", "docs", "openapi.json"}:
            raise HTTPException(status_code=404, detail="Not found")
        candidate = (_dist / full_path).resolve()
        if candidate.is_file() and _dist in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(_dist / "index.html")