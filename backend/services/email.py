"""Sends real emails via Gmail SMTP — no browser mail-client popup, this
actually sends. Uses a Gmail App Password, not the account's real password.
"""

import smtplib
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