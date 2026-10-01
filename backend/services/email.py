"""Sends real emails via Gmail SMTP — no browser mail-client popup, this
actually sends. Uses a Gmail App Password, not the account's real password.
"""

import smtplib
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import settings


def send_email(to_address: str, subject: str, body: str) -> None:
    if not settings.smtp_email or not settings.smtp_app_password:
        raise RuntimeError("SMTP_EMAIL and SMTP_APP_PASSWORD must be set in .env")

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_email
    msg["To"] = to_address

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(settings.smtp_email, settings.smtp_app_password)
        server.send_message(msg)


class EmailAttachment:
    """A single PDF (or other binary) attachment for send_email_with_attachments."""

    def __init__(self, filename: str, content: bytes, mime_subtype: str = "pdf"):
        self.filename = filename
        self.content = content
        self.mime_subtype = mime_subtype


def send_email_with_attachments(
    to_address: str,
    subject: str,
    body: str,
    attachments: list[EmailAttachment],
) -> None:
    """Same as send_email, but attaches one or more files (e.g. PDFs).

    Kept as a separate function rather than adding an optional parameter to
    send_email, so every existing call site (plain-text referral/card
    emails) is untouched and this is purely additive.
    """
    if not settings.smtp_email or not settings.smtp_app_password:
        raise RuntimeError("SMTP_EMAIL and SMTP_APP_PASSWORD must be set in .env")

    msg = MIMEMultipart()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_email
    msg["To"] = to_address
    msg.attach(MIMEText(body, "plain", "utf-8"))

    for attachment in attachments:
        part = MIMEApplication(attachment.content, _subtype=attachment.mime_subtype)
        part.add_header(
            "Content-Disposition", "attachment", filename=attachment.filename
        )
        msg.attach(part)

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(settings.smtp_email, settings.smtp_app_password)
        server.send_message(msg)