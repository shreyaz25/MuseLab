"""Audio analysis engine (librosa / NumPy / SciPy).

Pipeline: load -> validate samples -> mono + resample -> pitch (pYIN, YIN fallback)
-> energy -> spectral features -> tempo -> chart-friendly JSON.

Everything returned is plain Python (floats/lists); non-finite values become None.
"""
from __future__ import annotations

import math
import uuid
from dataclasses import dataclass
from pathlib import Path

import librosa
import numpy as np
from scipy import stats as sp_stats

from ..config import Settings
from ..errors import AppError
from .file_validation import clean_display_name

HOP_LENGTH = 512
FRAME_LENGTH = 2048
PITCH_FMIN = float(librosa.note_to_hz("C2"))  # ~65.4 Hz
PITCH_FMAX = float(librosa.note_to_hz("C7"))  # ~2093 Hz
MIN_VOICED_FRAMES = 10  # ~0.23 s at 22.05 kHz / hop 512
SILENCE_PEAK = 1e-4
NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

LIMITATIONS = [
    "Pitch values are estimates. They are most reliable for a single, relatively isolated voice.",
    "Backing music, harmonies, several singers, noise or very quiet recordings can reduce accuracy.",
    "The lowest/highest detected pitches describe this recording only, not your absolute vocal range.",
    "Without a reference melody, MuseLab cannot tell whether the notes sung were 'correct'.",
    "RMS energy is a measured amplitude, not perceived loudness.",
    "Tempo estimation on unaccompanied vocals is often unreliable.",
    "MuseLab is an educational tool, not a vocal diagnosis or singing-quality score.",
]


# ----------------------------------------------------------------- helpers
def _num(x, digits: int = 4) -> float | None:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return round(v, digits) if math.isfinite(v) else None


def _num_list(arr, digits: int = 4) -> list[float | None]:
    return [_num(v, digits) for v in np.asarray(arr, dtype=float).ravel().tolist()]


def _sample_indices(n: int, max_points: int) -> np.ndarray:
    """Evenly spaced indices so chart arrays stay small (summaries use full data)."""
    if n <= max_points:
        return np.arange(n)
    return np.unique(np.linspace(0, n - 1, max_points).round().astype(int))


# ------------------------------------------------- frequency -> musical note
def hz_to_midi(freq_hz: float) -> float:
    """MIDI note number: 69 + 12 * log2(f / 440). A4 = 440 Hz = MIDI 69."""
    return 69.0 + 12.0 * math.log2(freq_hz / 440.0)


def hz_to_note(freq_hz: float | None) -> str | None:
    """Nearest equal-tempered note name with octave (scientific pitch, C4 = middle C)."""
    if freq_hz is None or not math.isfinite(freq_hz) or freq_hz <= 0:
        return None
    midi = int(round(hz_to_midi(freq_hz)))
    return f"{NOTE_NAMES[midi % 12]}{midi // 12 - 1}"


def cents_from_nearest_note(freq_hz: float | None) -> float | None:
    if freq_hz is None or not math.isfinite(freq_hz) or freq_hz <= 0:
        return None
    midi = hz_to_midi(freq_hz)
    return (midi - round(midi)) * 100.0


# ------------------------------------------------------------------ loading
@dataclass
class LoadedAudio:
    y: np.ndarray  # mono, analysis sample rate
    sr: int
    original_sr: int
    channels: int
    duration: float
    peak: float


def load_audio(path: Path, settings: Settings) -> LoadedAudio:
    try:
        y, sr = librosa.load(str(path), sr=None, mono=False, duration=settings.max_duration_seconds + 1.0)
    except Exception as exc:  # decoder errors vary by backend
        raise AppError(422, "invalid_audio", "The file could not be decoded as audio. It may be corrupted.") from exc

    y = np.asarray(y, dtype=np.float32)
    if y.size == 0 or sr <= 0:
        raise AppError(422, "invalid_audio", "The file contains no audio samples.")
    if not np.all(np.isfinite(y)):
        raise AppError(422, "invalid_audio", "The audio contains invalid (non-finite) samples.")

    channels = 1 if y.ndim == 1 else int(y.shape[0])
    duration = y.shape[-1] / float(sr)
    if duration > settings.max_duration_seconds + 1e-3:
        raise AppError(
            413,
            "duration_exceeded",
            f"The recording is longer than the {settings.max_duration_seconds:g} second limit.",
        )

    mono = librosa.to_mono(y) if y.ndim > 1 else y
    peak = float(np.max(np.abs(mono)))
    if peak < SILENCE_PEAK:
        raise AppError(422, "silent_audio", "The recording appears to be silent, so it cannot be analysed.")

    target_sr = min(int(sr), settings.analysis_sample_rate)  # never upsample
    if sr != target_sr:
        mono = librosa.resample(mono, orig_sr=sr, target_sr=target_sr)
    return LoadedAudio(np.ascontiguousarray(mono, dtype=np.float32), target_sr, int(sr), channels, duration, peak)


# -------------------------------------------------------------------- pitch
@dataclass
class PitchResult:
    times: np.ndarray
    f0: np.ndarray  # NaN where invalid
    voiced: np.ndarray  # bool
    method: str
    warnings: list[str]


def estimate_pitch(y: np.ndarray, sr: int) -> PitchResult:
    """pYIN (probabilistic YIN) with a clearly-flagged YIN fallback."""
    fmax = min(PITCH_FMAX, 0.4 * sr)
    warnings: list[str] = []
    try:
        f0, voiced_flag, _ = librosa.pyin(
            y, fmin=PITCH_FMIN, fmax=fmax, sr=sr, frame_length=FRAME_LENGTH, hop_length=HOP_LENGTH
        )
        method = "pyin"
        voiced = np.asarray(voiced_flag, dtype=bool)
    except Exception:
        warnings.append("pYIN failed; the simpler YIN method was used, so pitch results are less reliable.")
        f0 = librosa.yin(y, fmin=PITCH_FMIN, fmax=fmax, sr=sr, frame_length=FRAME_LENGTH, hop_length=HOP_LENGTH)
        rms = librosa.feature.rms(y=y, frame_length=FRAME_LENGTH, hop_length=HOP_LENGTH)[0]
        n = min(len(f0), len(rms))
        f0, rms = f0[:n], rms[:n]
        voiced = rms > 0.1 * float(np.max(rms)) if n else np.zeros(0, dtype=bool)
        method = "yin"

    f0 = np.asarray(f0, dtype=float)
    valid = np.isfinite(f0) & (f0 >= PITCH_FMIN) & (f0 <= fmax)
    if method == "yin":  # YIN returns bound values when it finds nothing
        valid &= (f0 > PITCH_FMIN * 1.01) & (f0 < fmax * 0.99)
    voiced = voiced & valid
    f0 = np.where(voiced, f0, np.nan)
    times = librosa.times_like(f0, sr=sr, hop_length=HOP_LENGTH)
    return PitchResult(times, f0, voiced, method, warnings)


def summarize_pitch(p: PitchResult, sr: int) -> dict:
    """Robust summary over voiced frames only (median, 5th-95th percentile, cents spread)."""
    total = int(len(p.f0))
    voiced_f0 = p.f0[p.voiced]
    n_voiced = int(len(voiced_f0))
    base = {
        "voiced_frames": n_voiced,
        "total_frames": total,
        "voiced_ratio": _num(n_voiced / total if total else 0.0) or 0.0,
        "voiced_seconds": _num(n_voiced * HOP_LENGTH / sr, 3) or 0.0,
    }
    if n_voiced < MIN_VOICED_FRAMES:
        return {"available": False, "reason": "Not enough voiced audio was detected to estimate pitch.", **base}

    median = float(np.median(voiced_f0))
    low, high = (float(v) for v in np.percentile(voiced_f0, [5, 95]))
    cents = 1200.0 * np.log2(voiced_f0 / median)
    return {
        "available": True,
        "reason": None,
        "median_hz": _num(median, 2),
        "median_note": hz_to_note(median),
        "median_cents_offset": _num(cents_from_nearest_note(median), 1),
        "range_low_hz": _num(low, 2),
        "range_high_hz": _num(high, 2),
        "range_low_note": hz_to_note(low),
        "range_high_note": hz_to_note(high),
        "variation_std_cents": _num(np.std(cents), 1),
        "variation_iqr_cents": _num(sp_stats.iqr(cents), 1),
        **base,
    }


# ------------------------------------------------------------- other features
def compute_energy(y: np.ndarray, sr: int, peak: float, max_points: int) -> tuple[dict, np.ndarray]:
    rms = librosa.feature.rms(y=y, frame_length=FRAME_LENGTH, hop_length=HOP_LENGTH)[0]
    times = librosa.times_like(rms, sr=sr, hop_length=HOP_LENGTH)
    idx = _sample_indices(len(rms), max_points)
    mean_rms = float(np.mean(rms))
    return (
        {
            "times": _num_list(times[idx], 3),
            "rms": _num_list(rms[idx], 5),
            "mean_rms": _num(mean_rms, 5),
            "max_rms": _num(np.max(rms), 5),
            "mean_dbfs": _num(20 * math.log10(mean_rms + 1e-10), 1),
            "peak_amplitude": _num(peak, 4),
        },
        rms,
    )


def compute_spectral(y: np.ndarray, sr: int, rms: np.ndarray, max_points: int) -> dict:
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, n_fft=FRAME_LENGTH, hop_length=HOP_LENGTH)[0]
    times = librosa.times_like(centroid, sr=sr, hop_length=HOP_LENGTH)
    n = min(len(centroid), len(rms))
    active = rms[:n] > 0.1 * float(np.max(rms)) if n else np.zeros(0, dtype=bool)
    mean_centroid = float(np.mean(centroid[:n][active])) if active.any() else float(np.mean(centroid))
    idx = _sample_indices(len(centroid), max_points)

    chroma = librosa.feature.chroma_stft(y=y, sr=sr, n_fft=FRAME_LENGTH, hop_length=HOP_LENGTH)
    chroma_mean = chroma.mean(axis=1)
    top = float(chroma_mean.max())
    if top > 0:
        chroma_mean = chroma_mean / top
    return {
        "centroid_times": _num_list(times[idx], 3),
        "centroid_hz": _num_list(centroid[idx], 1),
        "mean_centroid_hz": _num(mean_centroid, 1),
        "chroma_labels": NOTE_NAMES,
        "chroma_mean": _num_list(chroma_mean, 3),
        "dominant_pitch_class": NOTE_NAMES[int(np.argmax(chroma_mean))] if top > 0 else None,
    }


def estimate_tempo(y: np.ndarray, sr: int, duration: float) -> dict:
    """Beat-tracking tempo with a pulse-clarity check; reports 'unavailable' rather than guessing."""
    def unavailable(reason: str) -> dict:
        return {"available": False, "bpm": None, "confidence": None, "reason": reason}

    if duration < 5:
        return unavailable("The recording is too short (under 5 seconds) for a meaningful tempo estimate.")
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP_LENGTH)
    if onset_env.size == 0 or float(np.max(onset_env)) <= 1e-6:
        return unavailable("No rhythmic onsets were detected.")
    try:
        tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=HOP_LENGTH)
    except Exception:
        return unavailable("Beat tracking failed on this recording.")
    bpm = float(np.atleast_1d(tempo)[0])
    if not math.isfinite(bpm) or bpm <= 0 or len(beats) < 4:
        return unavailable("No steady beat could be found.")

    # Pulse clarity: autocorrelation of the onset envelope at the beat period.
    centered = onset_env - onset_env.mean()
    ac = librosa.autocorrelate(centered)
    strength = 0.0
    lag = int(round(60.0 * sr / (HOP_LENGTH * bpm)))
    if ac[0] > 0 and 0 < lag < len(ac):
        strength = float(ac[lag] / ac[0])
    if strength < 0.1:
        return unavailable("The rhythm is too irregular to give a reliable BPM (common with unaccompanied vocals).")
    confidence = "high" if strength >= 0.3 else "medium" if strength >= 0.2 else "low"
    return {"available": True, "bpm": _num(bpm, 1), "confidence": confidence, "reason": None}


def compute_waveform(y: np.ndarray, sr: int, buckets: int) -> dict:
    buckets = max(1, min(buckets, len(y)))
    size = len(y) // buckets
    trimmed = y[: size * buckets].reshape(buckets, size)
    times = (np.arange(buckets) + 0.5) * size / sr
    return {"times": _num_list(times, 3), "min": _num_list(trimmed.min(axis=1), 4), "max": _num_list(trimmed.max(axis=1), 4)}


def compute_spectrogram(y: np.ndarray, sr: int, max_frames: int = 240, n_mels: int = 64) -> dict:
    fmax = min(8000.0, sr / 2.0)
    mel = librosa.feature.melspectrogram(
        y=y, sr=sr, n_fft=FRAME_LENGTH, hop_length=HOP_LENGTH, n_mels=n_mels, fmax=fmax
    )
    db = librosa.power_to_db(mel, ref=np.max, top_db=80.0)
    times = librosa.times_like(db[0], sr=sr, hop_length=HOP_LENGTH)
    if db.shape[1] > max_frames:  # average blocks of frames
        groups = np.array_split(np.arange(db.shape[1]), max_frames)
        db = np.stack([db[:, g].mean(axis=1) for g in groups], axis=1)
        times = np.array([times[g].mean() for g in groups])
    freqs = librosa.mel_frequencies(n_mels=n_mels, fmin=0.0, fmax=fmax)
    return {
        "times": _num_list(times, 3),
        "freqs_hz": _num_list(freqs, 1),
        "db": [_num_list(row, 1) for row in db],
    }


# --------------------------------------------------------------- entry point
def analyze_audio_file(
    path: Path, original_filename: str | None, settings: Settings, include_spectrogram: bool = True
) -> dict:
    """Run the full analysis on a (already validated) audio file; returns a JSON-safe dict."""
    audio = load_audio(path, settings)
    y, sr = audio.y, audio.sr
    max_points = settings.max_chart_points
    warnings: list[str] = []

    if audio.channels > 1:
        warnings.append(f"The {audio.channels}-channel recording was mixed down to mono for analysis.")
    if audio.original_sr != sr:
        warnings.append(f"Audio was resampled from {audio.original_sr} Hz to {sr} Hz for analysis.")
    if audio.duration < 3:
        warnings.append("Very short recording: estimates may not be representative.")
    if audio.peak >= 0.999:
        warnings.append("The recording reaches full scale and may be clipped, which can affect pitch estimates.")

    pitch = estimate_pitch(y, sr)
    warnings.extend(pitch.warnings)
    pitch_summary = summarize_pitch(pitch, sr)
    if pitch_summary["available"] and pitch_summary["voiced_ratio"] < 0.2:
        warnings.append("Little voiced audio was detected; pitch statistics may be unreliable.")
    elif not pitch_summary["available"]:
        warnings.append(pitch_summary["reason"])

    idx = _sample_indices(len(pitch.f0), max_points)
    pitch_track = {
        "method": pitch.method,
        "hop_seconds": _num(HOP_LENGTH / sr, 5),
        "times": _num_list(pitch.times[idx], 3),
        "frequencies": _num_list(pitch.f0[idx], 2),  # NaN -> None for unvoiced frames
        "voiced": [bool(v) for v in pitch.voiced[idx]],
    }

    energy, rms = compute_energy(y, sr, audio.peak, max_points)
    spectral = compute_spectral(y, sr, rms, max_points)
    tempo = estimate_tempo(y, sr, audio.duration)

    return {
        "analysis_id": uuid.uuid4().hex,
        "overview": {
            "file_name": clean_display_name(original_filename),
            "duration_seconds": _num(audio.duration, 3),
            "original_sample_rate": audio.original_sr,
            "analysis_sample_rate": sr,
            "channels": audio.channels,
            "status": "completed",
        },
        "pitch_track": pitch_track,
        "pitch": pitch_summary,
        "energy": energy,
        "tempo": tempo,
        "spectral": spectral,
        "waveform": compute_waveform(y, sr, max_points),
        "spectrogram": compute_spectrogram(y, sr) if include_spectrogram else None,
        "warnings": warnings,
        "limitations": LIMITATIONS,
    }
