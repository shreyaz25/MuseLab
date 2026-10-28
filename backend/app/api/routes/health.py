from fastapi import APIRouter

from ...config import get_settings
from ...schemas import ConfigOut, HealthOut

router = APIRouter()


@router.get("/health", response_model=HealthOut, tags=["health"])
def health() -> HealthOut:
    """Confirms the Python backend is running."""
    return HealthOut(status="ok", service="muselab-backend", version="1.0.0")


@router.get("/api/config", response_model=ConfigOut, tags=["health"])
def config() -> ConfigOut:
    """Upload limits and supported formats (no secrets)."""
    s = get_settings()
    return ConfigOut(
        max_upload_mb=s.max_upload_mb,
        max_duration_seconds=s.max_duration_seconds,
        allowed_extensions=list(s.allowed_extensions),
        analysis_sample_rate=s.analysis_sample_rate,
    )
