"""MedBridge AI — FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import database as db
from config import settings
from routers import auth, doctors


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Indexes are idempotent, so creating them on every boot is safe and
    # means a fresh clone works without a manual migration step.
    if settings.mongodb_url:
        await db.ensure_indexes()
    yield
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


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "mock_mode": settings.use_mock}


# NOTE: in week 6, StaticFiles for the React build gets mounted at "/" —
# it must come AFTER every router above or it will shadow the API routes.