"""Core application configuration using Pydantic Settings."""

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DB_PATH = (PROJECT_ROOT / "data" / "app.db").resolve().as_posix()


class Settings(BaseSettings):
    """Application settings with environment variable fallback and validation."""

    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # API Configuration
    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    API_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "FacilityMind AI"
    VERSION: str = "1.0.0"

    # Authentication & Security
    SECRET_KEY: str = "facilitymind-super-secure-session-secret-key-2026-xyz"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # CORS Configuration
    CORS_ORIGINS: list[str] | str = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, str) and v.startswith("["):
            import json

            return json.loads(v)
        return v

    # Database Configuration (SQLite default with async support, Postgres ready)
    DATABASE_URL: str = f"sqlite+aiosqlite:///{DEFAULT_DB_PATH}"

    # LLM Providers (Secure backend secrets)
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    DEFAULT_MODEL: str = "gemini-2.5-flash"

    # Vector Storage
    VECTOR_STORE_TYPE: str = "chroma"
    VECTOR_STORE_PATH: str = (PROJECT_ROOT / "data" / "chroma").resolve().as_posix()

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Return cached singleton instance of Settings."""
    return Settings()
