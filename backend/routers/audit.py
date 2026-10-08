"""Read access to the audit log.

A doctor can see their own trail: every request made with their account.
There is no clinic-admin role in this project yet, so nobody can read other
people's entries through the API (they are still in the database).
"""

from fastapi import APIRouter, Depends, Query

import database as db
from middleware.auth import get_current_doctor
from models.doctor import Doctor

router = APIRouter(prefix="/api/audit-log", tags=["audit"])


@router.get("")
async def my_audit_log(
    limit: int = Query(100, ge=1, le=500),
    current: Doctor = Depends(get_current_doctor),
) -> list[dict]:
    cursor = (
        db.audit_logs()
        .find({"actor_id": current.id}, {"_id": 0})
        .sort("ts", -1)
        .limit(limit)
    )
    return await cursor.to_list(length=limit)
