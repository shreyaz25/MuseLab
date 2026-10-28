"""Application configuration, read from environment variables (see .env.example).

Settings are re-read on every call to ``get_settings()`` so tests can change
limits with ``monkeypatch.setenv`` without reloading modules.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent

# Loads backend/.env if present. Real environment variables always win.
load_dotenv(BACKEND_DIR / ".env", override=False)

DEFAULT_CORS = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080"


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    database_url: str
    cors_origins: list[str]
    max_upload_mb: float
    max_duration_seconds: float
    analysis_timeout_seconds: float
    analysis_sample_rate: int
    temp_dir: str | None
    max_chart_points: int
    allowed_extensions: tuple[str, ...] = (".wav", ".mp3", ".flac")

    @property
    def max_upload_bytes(self) -> int:
        return int(self.max_upload_mb * 1024 * 1024)


def get_settings() -> Settings:
    default_db = f"sqlite:///{(BACKEND_DIR / 'data' / 'muselab.db').as_posix()}"
    origins = [o.strip() for o in os.environ.get("MUSELAB_CORS_ORIGINS", DEFAULT_CORS).split(",") if o.strip()]
    return Settings(
        database_url=os.environ.get("MUSELAB_DATABASE_URL", default_db),
        cors_origins=origins,
        max_upload_mb=_float("MUSELAB_MAX_UPLOAD_MB", 25),
        max_duration_seconds=_float("MUSELAB_MAX_DURATION_SECONDS", 180),
        analysis_timeout_seconds=_float("MUSELAB_ANALYSIS_TIMEOUT_SECONDS", 120),
        analysis_sample_rate=_int("MUSELAB_ANALYSIS_SAMPLE_RATE", 22050),
        temp_dir=os.environ.get("MUSELAB_TEMP_DIR") or None,
        max_chart_points=_int("MUSELAB_MAX_CHART_POINTS", 800),
    )
