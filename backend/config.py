"""Application settings, loaded from backend/.env."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    mongodb_url: str = ""
    db_name: str = "medbridge"

    # Auth
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 8
    google_client_id: str = ""
    google_client_secret: str = ""

    # Claude
    anthropic_api_key: str = ""
    nlp_model: str = "claude-haiku-4-5-20251001"   # extraction — cheap
    card_model: str = "claude-sonnet-5"            # patient card — quality

    # Whisper
    whisper_model: str = "medium"                  # streaming, 6GB VRAM
    eval_whisper_model: str = "medium"           # offline eval only
    whisper_compute_type: str = "int8"
    stream_partial_interval_ms: int = 2000
    vad_silence_ms: int = 700

    # Development
    use_mock: bool = True
    cache_llm_responses: bool = True

    smtp_email: str = ""
    smtp_app_password: str = ""

    # Used to build the link in password-reset emails.
    frontend_url: str = "http://localhost:5173"

    # Deployment
    # "production" turns on startup safety checks (see main.py).
    environment: str = "development"
    # Comma-separated list of browser origins allowed to call the API.
    # Needed only when the frontend is served from somewhere else; when
    # FastAPI serves the built React app itself, everything is one origin.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    # Where `npm run build` puts the React app. If it exists, FastAPI serves it.
    frontend_dist: str = "../frontend/dist"

    # WhatsApp (Twilio sandbox) — all optional; whatsapp.py no-ops with a
    # log line if these aren't set, same spirit as the SMTP guard above.
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_whatsapp_number: str = ""   # Twilio's sandbox number, "whatsapp:+1415..."


settings = Settings()