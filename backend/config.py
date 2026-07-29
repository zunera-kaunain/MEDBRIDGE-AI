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
    eval_whisper_model: str = "large-v3"           # offline eval only
    whisper_compute_type: str = "int8"
    stream_partial_interval_ms: int = 2000
    vad_silence_ms: int = 700

    # Development
    use_mock: bool = True
    cache_llm_responses: bool = True


settings = Settings()