import os

import numpy as np
import pytest

from app.services.audio_analyzer import cents_from_nearest_note, hz_to_midi, hz_to_note

from .conftest import make_silent_wav_bytes, make_wav_bytes


# ------------------------------------------------------------ unit: notes
@pytest.mark.parametrize(
    "hz, note",
    [(440.0, "A4"), (261.63, "C4"), (220.0, "A3"), (82.41, "E2"), (1046.5, "C6")],
)
def test_hz_to_note(hz, note):
    assert hz_to_note(hz) == note


def test_hz_to_note_rejects_invalid():
    assert hz_to_note(None) is None
    assert hz_to_note(0) is None
    assert hz_to_note(-5) is None
    assert hz_to_note(float("nan")) is None


def test_midi_and_cents():
    assert hz_to_midi(440.0) == pytest.approx(69.0)
    assert cents_from_nearest_note(440.0) == pytest.approx(0.0, abs=1e-6)
    assert cents_from_nearest_note(440.0 * 2 ** (25 / 1200)) == pytest.approx(25.0, abs=0.01)


# ------------------------------------------------------------ API: analyze
def test_analyze_valid_tone(client, tone_wav, upload_dir):
    r = client.post("/api/analyze", files={"file": ("tone.wav", tone_wav, "audio/wav")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["overview"]["status"] == "completed"
    assert body["overview"]["channels"] == 1
    assert body["overview"]["duration_seconds"] == pytest.approx(2.0, abs=0.05)
    pitch = body["pitch"]
    assert pitch["available"] is True
    assert pitch["median_hz"] == pytest.approx(220.0, rel=0.03)
    assert pitch["median_note"] == "A3"
    assert pitch["voiced_ratio"] > 0.5
    track = body["pitch_track"]
    assert len(track["times"]) == len(track["frequencies"]) == len(track["voiced"])
    assert body["limitations"]
    assert body["spectrogram"] is not None
    assert os.listdir(upload_dir) == []  # temp file removed


def test_analyze_without_spectrogram(client, tone_wav):
    r = client.post("/api/analyze?include_spectrogram=false", files={"file": ("t.wav", tone_wav)})
    assert r.status_code == 200
    assert r.json()["spectrogram"] is None


def test_rejects_unsupported_extension(client, upload_dir):
    r = client.post("/api/analyze", files={"file": ("notes.txt", b"hello", "text/plain")})
    assert r.status_code == 415
    assert r.json()["error"]["code"] == "unsupported_format"
    assert os.listdir(upload_dir) == []


def test_rejects_wrong_content_with_audio_extension(client, upload_dir):
    r = client.post("/api/analyze", files={"file": ("fake.wav", b"this is not audio at all", "audio/wav")})
    assert r.status_code == 415
    assert os.listdir(upload_dir) == []


def test_rejects_corrupted_audio(client, upload_dir):
    corrupted = b"RIFF\x00\x00\x00\x00WAVE" + os.urandom(200)
    r = client.post("/api/analyze", files={"file": ("broken.wav", corrupted, "audio/wav")})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_audio"
    assert os.listdir(upload_dir) == []  # cleaned up after a failure


def test_rejects_empty_file(client, upload_dir):
    r = client.post("/api/analyze", files={"file": ("empty.wav", b"", "audio/wav")})
    assert r.status_code in (400, 415)
    assert os.listdir(upload_dir) == []


def test_rejects_silent_audio(client, upload_dir):
    r = client.post("/api/analyze", files={"file": ("silent.wav", make_silent_wav_bytes(), "audio/wav")})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "silent_audio"
    assert os.listdir(upload_dir) == []


def test_rejects_too_long(client, monkeypatch, upload_dir):
    monkeypatch.setenv("MUSELAB_MAX_DURATION_SECONDS", "1")
    r = client.post("/api/analyze", files={"file": ("long.wav", make_wav_bytes(seconds=3), "audio/wav")})
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "duration_exceeded"
    assert os.listdir(upload_dir) == []


def test_rejects_too_large(client, monkeypatch, upload_dir):
    monkeypatch.setenv("MUSELAB_MAX_UPLOAD_MB", "0.01")  # ~10 KB
    r = client.post("/api/analyze", files={"file": ("big.wav", make_wav_bytes(seconds=2), "audio/wav")})
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "file_too_large"
    assert os.listdir(upload_dir) == []


def test_analysis_failure_returns_error_and_cleans_up(client, monkeypatch, upload_dir, tone_wav):
    def boom(*args, **kwargs):
        raise RuntimeError("simulated crash")

    monkeypatch.setattr("app.api.routes.analysis.analyze_audio_file", boom)
    r = client.post("/api/analyze", files={"file": ("tone.wav", tone_wav, "audio/wav")})
    assert r.status_code == 500
    assert r.json()["error"]["code"] == "analysis_failed"
    assert os.listdir(upload_dir) == []


def test_stereo_is_mixed_down(client):
    import io

    import soundfile as sf

    mono = np.frombuffer(make_wav_bytes(), dtype=np.uint8)  # just to reuse generator import
    del mono
    t = np.arange(44100) / 22050
    left = 0.4 * np.sin(2 * np.pi * 330 * t)
    stereo = np.stack([left, left], axis=1).astype(np.float32)
    buf = io.BytesIO()
    sf.write(buf, stereo, 22050, format="WAV")
    r = client.post("/api/analyze", files={"file": ("stereo.wav", buf.getvalue(), "audio/wav")})
    assert r.status_code == 200
    body = r.json()
    assert body["overview"]["channels"] == 2
    assert any("mono" in w for w in body["warnings"])
