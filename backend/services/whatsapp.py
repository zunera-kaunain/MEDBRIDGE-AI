"""Sends WhatsApp notifications via the Twilio Sandbox REST API.

Text-only, deliberately. Twilio's `MediaUrl` parameter for attachments
needs a publicly reachable URL to fetch from — this backend runs on
localhost during development, so there is nothing for Twilio's servers to
fetch. PDFs (report, patient card, referral) go out over email instead,
which attaches the bytes directly. WhatsApp here is a short notification
("your visit summary is ready, check your email") rather than a document
carrier.

No-ops with a log line (never raises) if Twilio credentials are not set in
.env, mirroring send_email's settings guard but without the hard failure —
a missing WhatsApp integration should never block a report/card/referral
being generated.
"""

import logging

import httpx

from config import settings

logger = logging.getLogger(__name__)

TWILIO_API_URL = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"


async def send_whatsapp_message(to_phone: str, body: str) -> bool:
    """Send a WhatsApp text message. Returns True if sent, False if
    skipped or failed — callers should treat this as best-effort and never
    let a False block the calling route.
    """
    if not (
        settings.twilio_account_sid
        and settings.twilio_auth_token
        and settings.twilio_whatsapp_number
    ):
        logger.info("WhatsApp not configured — skipping send to %s", to_phone)
        return False

    to_number = to_phone if to_phone.startswith("whatsapp:") else f"whatsapp:{to_phone}"
    from_number = settings.twilio_whatsapp_number
    if not from_number.startswith("whatsapp:"):
        from_number = f"whatsapp:{from_number}"

    url = TWILIO_API_URL.format(sid=settings.twilio_account_sid)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                url,
                data={"From": from_number, "To": to_number, "Body": body},
                auth=(settings.twilio_account_sid, settings.twilio_auth_token),
            )
        if resp.status_code >= 300:
            logger.warning(
                "WhatsApp send failed (%s) to %s: %s",
                resp.status_code,
                to_phone,
                resp.text,
            )
            return False
        return True
    except httpx.HTTPError as exc:
        logger.warning("WhatsApp send raised for %s: %s", to_phone, exc)
        return False
