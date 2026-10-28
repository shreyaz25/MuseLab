"""MuseLab FastAPI application. Run from the backend/ folder:

    uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import analysis, health, sessions
from .config import get_settings
from .database import init_db
from .errors import register_error_handlers


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="MuseLab API",
        version="1.0.0",
        description="Python audio-analysis and practice-session API for MuseLab.",
        lifespan=lifespan,
    )
    from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://muselab-ic6zt43ig-shuah.vercel.app",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
    origins = get_settings().cors_origins
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,  # explicit list from MUSELAB_CORS_ORIGINS
            allow_credentials=False,
            allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["*"],
        )
    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(analysis.router)
    app.include_router(sessions.router)
    return app



app = create_app()
