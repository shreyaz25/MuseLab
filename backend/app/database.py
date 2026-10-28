"""Database engine and session helpers (SQLModel + SQLite).

Only standard SQLAlchemy features are used, so moving to PostgreSQL later means
changing ``MUSELAB_DATABASE_URL`` and adding a migration tool such as Alembic.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Iterator

from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

from . import models  # noqa: F401  (registers tables on SQLModel.metadata)
from .config import get_settings


@lru_cache(maxsize=8)
def get_engine(url: str) -> Engine:
    kwargs: dict = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
        # Make sure the folder holding the SQLite file exists.
        path = url.replace("sqlite:///", "", 1)
        if path and path != ":memory:" and not url.startswith("sqlite://:memory:"):
            Path(path).parent.mkdir(parents=True, exist_ok=True)
    return create_engine(url, **kwargs)


def init_db() -> None:
    """Create tables if they do not exist yet. Safe to call on every start."""
    SQLModel.metadata.create_all(get_engine(get_settings().database_url))


def get_session() -> Iterator[Session]:
    """FastAPI dependency yielding a database session."""
    with Session(get_engine(get_settings().database_url)) as session:
        yield session
