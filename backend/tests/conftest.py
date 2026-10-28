"""Shared fixtures: temporary DB + temp upload dir, synthetic audio generators."""
from __future__ import annotations

import io

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from app.database import get_engine
from app.main import create_app


@pytest.fixture(autouse=True)
def isolated_env(tmp_path, monkeypatch):
    """Every test gets its own SQLite file and upload temp folder (never the real data)."""
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    db_url = f"sqlite:///{(tmp_path / 'test.db').as_posix()}"
    monkeypatch.setenv("MUSELAB_DATABASE_URL", db_url)
    monkeypatch.setenv("MUSELAB_TEMP_DIR", str(upload_dir))
    yield upload_dir
    get_engine(db_url).dispose()


@pytest.fixture
def upload_dir(isolated_env):
    return isolated_env


@pytest.fixture
def client():
    with TestClient(create_app()) as c:
        yield c


def make_wav_bytes(freq: float = 220.0, seconds: float = 2.0, sr: int = 22050, amplitude: float = 0.5) -> bytes:
    t = np.arange(int(seconds * sr)) / sr
    # fundamental + two harmonics so it resembles a voiced sound
    y = amplitude * (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t) + 0.1 * np.sin(6 * np.pi * freq * t))
    y = (y / 1.4).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, y, sr, format="WAV")
    return buf.getvalue()


def make_silent_wav_bytes(seconds: float = 1.0, sr: int = 22050) -> bytes:
    buf = io.BytesIO()
    sf.write(buf, np.zeros(int(seconds * sr), dtype=np.float32), sr, format="WAV")
    return buf.getvalue()


@pytest.fixture
def tone_wav() -> bytes:
    return make_wav_bytes()


@pytest.fixture
def analysis_payload(client, tone_wav) -> dict:
    """A real analysis result produced by the API (used to test sessions)."""
    r = client.post("/api/analyze", files={"file": ("tone.wav", tone_wav, "audio/wav")})
    assert r.status_code == 200, r.text
    return r.json()
