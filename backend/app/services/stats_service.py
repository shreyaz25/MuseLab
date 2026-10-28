"""Dashboard / progress statistics computed from saved sessions."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import defer
from sqlmodel import Session, select

from ..models import PracticeSession, utcnow
from ..schemas import SessionSummary

MIN_RELIABLE_VOICED_RATIO = 0.2


def _streaks(days: set[date], today: date) -> tuple[int, int]:
    current = 0
    d = today if today in days else today - timedelta(days=1)
    while d in days:
        current += 1
        d -= timedelta(days=1)
    longest = run = 0
    prev: date | None = None
    for d in sorted(days):
        run = run + 1 if prev is not None and d - prev == timedelta(days=1) else 1
        longest = max(longest, run)
        prev = d
    return current, longest


def compute_stats(db: Session, tz_offset_minutes: int = 0) -> dict:
    offset = timedelta(minutes=tz_offset_minutes)
    total = db.exec(select(func.count()).select_from(PracticeSession)).one()
    total_seconds = db.exec(select(func.coalesce(func.sum(PracticeSession.duration_seconds), 0.0))).one()

    rows = db.exec(
        select(PracticeSession).options(defer(PracticeSession.analysis)).order_by(PracticeSession.created_at.asc())
    ).all()

    per_day: dict[date, list[float]] = defaultdict(lambda: [0.0, 0])
    for r in rows:
        d = (r.created_at + offset).date()
        per_day[d][0] += r.duration_seconds
        per_day[d][1] += 1

    today = (utcnow() + offset).date()
    daily = []
    for i in range(29, -1, -1):
        d = today - timedelta(days=i)
        secs, n = per_day.get(d, [0.0, 0])
        daily.append({"date": d, "seconds": round(secs, 1), "sessions": n})

    per_week: dict[date, list[float]] = defaultdict(lambda: [0.0, 0])
    for d, (secs, n) in per_day.items():
        ws = d - timedelta(days=d.weekday())
        per_week[ws][0] += secs
        per_week[ws][1] += n
    this_week = today - timedelta(days=today.weekday())
    weekly = []
    for i in range(11, -1, -1):
        ws = this_week - timedelta(weeks=i)
        secs, n = per_week.get(ws, [0.0, 0])
        weekly.append({"week_start": ws, "seconds": round(secs, 1), "sessions": n})

    metrics = []
    for r in rows:
        m = r.summary_metrics or {}
        ratio = m.get("voiced_ratio")
        metrics.append(
            {
                "session_id": r.id,
                "title": r.title,
                "created_at": r.created_at,
                "median_hz": m.get("median_hz"),
                "variation_std_cents": m.get("variation_std_cents"),
                "mean_dbfs": m.get("mean_dbfs"),
                "voiced_ratio": ratio,
                "pitch_reliable": bool(ratio is not None and ratio >= MIN_RELIABLE_VOICED_RATIO and m.get("median_hz")),
            }
        )

    days = set(per_day.keys())
    current, longest = _streaks(days, today)
    active_30 = sum(1 for d in days if 0 <= (today - d).days < 30)

    recent_rows = list(reversed(rows))[:5]
    recent = [SessionSummary.model_validate(r) for r in recent_rows]
    return {
        "total_sessions": int(total),
        "total_seconds": round(float(total_seconds), 1),
        "latest": recent[0] if recent else None,
        "recent": recent,
        "daily": daily,
        "weekly": weekly,
        "metrics": metrics,
        "consistency": {
            "active_days_last_30": active_30,
            "current_streak_days": current,
            "longest_streak_days": longest,
        },
    }
