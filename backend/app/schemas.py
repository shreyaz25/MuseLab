"""Pydantic schemas: request validation and response shapes."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

FloatList = list[Optional[float]]


# ---------------------------------------------------------------- analysis
class Overview(BaseModel):
    file_name: str
    duration_seconds: float
    original_sample_rate: int
    analysis_sample_rate: int
    channels: int
    status: str = "completed"


class PitchTrack(BaseModel):
    method: str
    hop_seconds: float
    times: list[float]
    # None where the frame is unvoiced / invalid.
    frequencies: FloatList
    voiced: list[bool]


class PitchSummary(BaseModel):
    available: bool
    reason: Optional[str] = None
    median_hz: Optional[float] = None
    median_note: Optional[str] = None
    median_cents_offset: Optional[float] = None
    range_low_hz: Optional[float] = None
    range_high_hz: Optional[float] = None
    range_low_note: Optional[str] = None
    range_high_note: Optional[str] = None
    voiced_frames: int = 0
    total_frames: int = 0
    voiced_ratio: float = 0.0
    voiced_seconds: float = 0.0
    variation_std_cents: Optional[float] = None
    variation_iqr_cents: Optional[float] = None


class Energy(BaseModel):
    times: list[float]
    rms: FloatList
    mean_rms: Optional[float] = None
    max_rms: Optional[float] = None
    mean_dbfs: Optional[float] = None
    peak_amplitude: Optional[float] = None


class Tempo(BaseModel):
    available: bool
    bpm: Optional[float] = None
    confidence: Optional[str] = None
    reason: Optional[str] = None


class Spectral(BaseModel):
    centroid_times: list[float]
    centroid_hz: FloatList
    mean_centroid_hz: Optional[float] = None
    chroma_labels: list[str]
    chroma_mean: FloatList
    dominant_pitch_class: Optional[str] = None


class Waveform(BaseModel):
    times: list[float]
    min: FloatList
    max: FloatList


class Spectrogram(BaseModel):
    times: list[float]
    freqs_hz: list[float]
    # db[freq_index][time_index]
    db: list[FloatList]


class AnalysisResult(BaseModel):
    analysis_id: str
    overview: Overview
    pitch_track: PitchTrack
    pitch: PitchSummary
    energy: Energy
    tempo: Tempo
    spectral: Spectral
    waveform: Waveform
    spectrogram: Optional[Spectrogram] = None
    warnings: list[str] = []
    limitations: list[str] = []


# ---------------------------------------------------------------- sessions
class SessionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str = Field(default="", max_length=5000)
    analysis: AnalysisResult

    @field_validator("title")
    @classmethod
    def _strip_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title must not be blank.")
        return v


class SessionUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=5000)

    @field_validator("title")
    @classmethod
    def _strip_title(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Title must not be blank.")
        return v


class _UtcModel(BaseModel):
    @field_validator("created_at", check_fields=False)
    @classmethod
    def _utc(cls, v: datetime) -> datetime:
        return v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v


class SessionSummary(_UtcModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    notes: str
    created_at: datetime
    file_name: str
    duration_seconds: float
    sample_rate: int
    channels: int
    summary_metrics: dict


class SessionDetail(SessionSummary):
    analysis: AnalysisResult


class SessionList(BaseModel):
    items: list[SessionSummary]
    total: int
    limit: int
    offset: int


# ---------------------------------------------------------------- stats
class DayPoint(BaseModel):
    date: date
    seconds: float
    sessions: int


class WeekPoint(BaseModel):
    week_start: date
    seconds: float
    sessions: int


class MetricPoint(BaseModel):
    session_id: str
    title: str
    created_at: datetime
    median_hz: Optional[float] = None
    variation_std_cents: Optional[float] = None
    mean_dbfs: Optional[float] = None
    voiced_ratio: Optional[float] = None
    # True when enough voiced audio was detected for pitch metrics to be meaningful.
    pitch_reliable: bool = False


class Consistency(BaseModel):
    active_days_last_30: int
    current_streak_days: int
    longest_streak_days: int


class Stats(BaseModel):
    total_sessions: int
    total_seconds: float
    latest: Optional[SessionSummary] = None
    recent: list[SessionSummary]
    daily: list[DayPoint]
    weekly: list[WeekPoint]
    metrics: list[MetricPoint]
    consistency: Consistency


# ---------------------------------------------------------------- misc
class HealthOut(BaseModel):
    status: str
    service: str
    version: str


class ConfigOut(BaseModel):
    max_upload_mb: float
    max_duration_seconds: float
    allowed_extensions: list[str]
    analysis_sample_rate: int
