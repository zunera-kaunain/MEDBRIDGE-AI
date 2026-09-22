"""Automated follow-up reminder.

Stored in Mongo (not an in-memory timer) so it survives a backend
restart — the background loop in services/reminders.py just polls for
anything due and sends it.
"""

from datetime import datetime

from pydantic import BaseModel, Field

from .common import new_id, utcnow


class Reminder(BaseModel):
    id: str = Field(default_factory=new_id)
    session_id: str
    doctor_id: str
    patient_id: str
    patient_email: str
    patient_name: str

    send_at: datetime
    message: str

    sent: bool = False
    sent_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)