"""Automated follow-up reminders.

When a report is confirmed with a parseable follow-up duration and the
patient has an email on file, a reminder is scheduled and stored in
Mongo. A background loop (started from main.py's lifespan) wakes up
every few minutes and sends anything that's come due.

This is a solo-project scheduler, not a durable job queue: it only fires
while the backend process is running. If the backend is off when a
reminder comes due, nothing is lost — it's just sent late, the next time
the backend is running and this loop's check runs.
"""

import asyncio
from datetime import timedelta

import database as db
from models.common import utcnow
from models.patient import Patient
from models.report import Report
from models.reminder import Reminder
from services import email as email_service
from services.followup import parse_followup_days

CHECK_INTERVAL_SECONDS = 300  # 5 minutes


async def schedule_followup_reminder(report: Report, patient: Patient) -> Reminder | None:
    """Called right after a report is confirmed. Returns the created
    Reminder, or None if no reminder could be scheduled — no email on
    file, no follow-up duration extracted, or the duration text couldn't
    be parsed into a concrete number of days.
    """
    if not patient.email:
        return None
    if report.followup.duration is None:
        return None

    days = parse_followup_days(report.followup.duration.text)
    if days is None:
        return None

    send_at = utcnow() + timedelta(days=days)

    message_lines = [
        f"Hi {patient.full_name},",
        "",
        "This is a reminder for your follow-up visit, as advised during your last consultation.",
    ]
    if report.followup.instructions:
        message_lines.append(f"Instructions: {report.followup.instructions.text}")

    reminder = Reminder(
        session_id=report.session_id,
        doctor_id=report.doctor_id,
        patient_id=patient.id,
        patient_email=patient.email,
        patient_name=patient.full_name,
        send_at=send_at,
        message="\n".join(message_lines),
    )

    await db.reminders().insert_one(reminder.model_dump())
    return reminder


async def _send_due_reminders() -> None:
    now = utcnow()
    cursor = db.reminders().find({"sent": False, "send_at": {"$lte": now}})
    async for doc in cursor:
        reminder = Reminder(**doc)
        try:
            email_service.send_email(
                to_address=reminder.patient_email,
                subject=f"Follow-up reminder for {reminder.patient_name}",
                body=reminder.message,
            )
            await db.reminders().update_one(
                {"id": reminder.id},
                {"$set": {"sent": True, "sent_at": utcnow()}},
            )
        except Exception as exc:
            # Don't let one bad address kill the loop — it stays unsent
            # and is retried next cycle.
            print(f"WARNING: could not send reminder {reminder.id} — {exc}")


async def run_reminder_loop() -> None:
    """Runs forever in the background, checking for due reminders."""
    while True:
        try:
            await _send_due_reminders()
        except Exception as exc:
            print(f"WARNING: reminder loop check failed — {exc}")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)