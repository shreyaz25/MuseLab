import asyncio
import logging
from pathlib import Path

from fastapi import APIRouter, File, Query, UploadFile
from starlette.concurrency import run_in_threadpool

from ...config import get_settings
from ...errors import AppError
from ...schemas import AnalysisResult
from ...services.audio_analyzer import analyze_audio_file
from ...services.file_validation import save_upload_to_temp

logger = logging.getLogger("muselab")
router = APIRouter(prefix="/api", tags=["analysis"])


def _safe_unlink(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.warning("Could not delete temporary file")


@router.post("/analyze", response_model=AnalysisResult)
async def analyze(
    file: UploadFile = File(..., description="WAV, MP3 or FLAC recording"),
    include_spectrogram: bool = Query(True),
) -> dict:
    """Validate, analyse and return the results. The upload is deleted afterwards."""
    settings = get_settings()
    tmp_path = await save_upload_to_temp(file, settings)
    try:
        try:
            return await asyncio.wait_for(
                run_in_threadpool(analyze_audio_file, tmp_path, file.filename, settings, include_spectrogram),
                timeout=settings.analysis_timeout_seconds,
            )
        except asyncio.TimeoutError as exc:
            raise AppError(504, "analysis_timeout", "The analysis took too long and was stopped.") from exc
        except AppError:
            raise
        except Exception as exc:
            logger.exception("Analysis failed")  # no file contents are logged
            raise AppError(500, "analysis_failed", "The recording could not be analysed.") from exc
    finally:
        _safe_unlink(tmp_path)
        await file.close()
