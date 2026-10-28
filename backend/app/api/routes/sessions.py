from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func
from sqlalchemy.orm import defer
from sqlmodel import Session, select

from ...database import get_session
from ...errors import AppError
from ...models import PracticeSession
from ...schemas import (
    SessionCreate,
    SessionDetail,
    SessionList,
    SessionSummary,
    SessionUpdate,
    Stats,
)
from ...services.session_service import build_summary_metrics
from ...services.stats_service import compute_stats

router = APIRouter(prefix="/api", tags=["sessions"])


def _get_or_404(db: Session, session_id: str) -> PracticeSession:
    row = db.get(PracticeSession, session_id)
    if row is None:
        raise AppError(404, "session_not_found", "No saved session with that id exists.")
    return row


@router.get("/sessions", response_model=SessionList)
def list_sessions(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: Optional[str] = Query(None, max_length=200, description="Title search"),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_session),
) -> SessionList:
    stmt = select(PracticeSession)
    if q:
        stmt = stmt.where(PracticeSession.title.contains(q, autoescape=True))
    if date_from:
        stmt = stmt.where(PracticeSession.created_at >= datetime.combine(date_from, time.min))
    if date_to:
        stmt = stmt.where(PracticeSession.created_at < datetime.combine(date_to + timedelta(days=1), time.min))
    total = db.exec(select(func.count()).select_from(stmt.subquery())).one()
    rows = db.exec(
        stmt.options(defer(PracticeSession.analysis))
        .order_by(PracticeSession.created_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return SessionList(
        items=[SessionSummary.model_validate(r) for r in rows], total=int(total), limit=limit, offset=offset
    )


@router.post("/sessions", response_model=SessionDetail, status_code=201)
def create_session(payload: SessionCreate, db: Session = Depends(get_session)) -> SessionDetail:
    a = payload.analysis
    row = PracticeSession(
        title=payload.title,
        notes=payload.notes,
        file_name=a.overview.file_name,
        duration_seconds=a.overview.duration_seconds,
        sample_rate=a.overview.original_sample_rate,
        channels=a.overview.channels,
        summary_metrics=build_summary_metrics(a),
        analysis=a.model_dump(mode="json"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return SessionDetail.model_validate(row)


@router.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session_detail(session_id: str, db: Session = Depends(get_session)) -> SessionDetail:
    return SessionDetail.model_validate(_get_or_404(db, session_id))


@router.patch("/sessions/{session_id}", response_model=SessionSummary)
def update_session(session_id: str, payload: SessionUpdate, db: Session = Depends(get_session)) -> SessionSummary:
    row = _get_or_404(db, session_id)
    if payload.title is not None:
        row.title = payload.title
    if payload.notes is not None:
        row.notes = payload.notes
    db.add(row)
    db.commit()
    db.refresh(row)
    return SessionSummary.model_validate(row)


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: str, db: Session = Depends(get_session)) -> Response:
    row = _get_or_404(db, session_id)
    db.delete(row)
    db.commit()
    return Response(status_code=204)


@router.get("/stats", response_model=Stats, tags=["stats"])
def stats(
    tz_offset_minutes: int = Query(0, ge=-840, le=840, description="Client UTC offset, e.g. 330 for IST"),
    db: Session = Depends(get_session),
) -> dict:
    """Dashboard and progress statistics computed from saved sessions."""
    return compute_stats(db, tz_offset_minutes)
