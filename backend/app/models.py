"""Database tables."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    """Naive UTC timestamp (SQLite does not store timezones)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PracticeSession(SQLModel, table=True):
    """A saved analysis. The original audio is NOT stored, only results."""

    __tablename__ = "practice_sessions"

    id: str = Field(default_factory=lambda: uuid.uuid4().hex, primary_key=True)
    title: str = Field(index=True, max_length=200)
    notes: str = Field(default="", max_length=5000)
    created_at: datetime = Field(default_factory=utcnow, index=True)
    file_name: str = Field(default="", max_length=200)
    duration_seconds: float
    sample_rate: int
    channels: int
    # Small, flat dict of headline numbers used by lists, dashboard and comparison.
    summary_metrics: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    # Full AnalysisResult as JSON.
    analysis: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
