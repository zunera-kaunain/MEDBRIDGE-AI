"""Audit log: a record of who did what, and when.

Every call to the API that touches patient data (anything under /api/), and
every sign-in, sign-up and password request, is written to the audit_logs
collection by the middleware in main.py. Each entry holds:

  ts, actor_id, actor_role   who (taken from the JWT, never the request body)
  method, route, path        what they asked for
  resource_ids               ids from the URL, e.g. patient or session id
  status                     what happened (200 ok, 401 refused, 403 blocked ...)
  ip                         where from

Deliberately NOT stored: request bodies, passwords, tokens, transcripts or
any clinical content. The log says that a record was opened, not what was
in it. Writing is best-effort and runs in the background, so a logging
problem can never break or slow a clinical request.
"""

import asyncio
import logging

from fastapi import Request

import database as db
from models.common import new_id, utcnow
from utils.rate_limit import client_ip
from utils.security import decode_access_token, decode_access_token_role

logger = logging.getLogger(__name__)

# Background tasks need a reference or Python may garbage-collect them
# before they finish.
_pending: set[asyncio.Task] = set()


def _should_log(method: str, path: str) -> bool:
    if method == "OPTIONS":
        return False
    if path.startswith("/api/"):
        return True
    # Sign-in, sign-up, forgot/reset password, Google, account deletion.
    # GET /auth/me is skipped: the app calls it on every page load and it
    # says nothing.
    return path.startswith("/auth/") and method in ("POST", "DELETE")


def _actor(request: Request) -> tuple[str | None, str | None]:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return None, None
    token = header[7:].strip()
    actor_id = decode_access_token(token)
    if actor_id is None:
        return None, None
    return actor_id, decode_access_token_role(token)


async def _write(entry: dict) -> None:
    try:
        await db.audit_logs().insert_one(entry)
    except Exception:
        logger.exception("Could not write audit log entry")


def record_request(request: Request, status_code: int) -> None:
    """Called by the middleware after each response. Never raises."""
    try:
        method, path = request.method, request.url.path
        if not _should_log(method, path):
            return

        actor_id, role = _actor(request)
        route = request.scope.get("route")
        entry = {
            "id": new_id(),
            "ts": utcnow(),
            "actor_id": actor_id,
            "actor_role": role,
            "method": method,
            "route": getattr(route, "path", path),
            "path": path,
            "resource_ids": dict(request.scope.get("path_params") or {}),
            "status": status_code,
            "ip": client_ip(request),
        }
        task = asyncio.create_task(_write(entry))
        _pending.add(task)
        task.add_done_callback(_pending.discard)
    except Exception:
        logger.exception("Audit logging failed")
