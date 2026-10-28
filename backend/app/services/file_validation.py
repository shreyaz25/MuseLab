"""Server-side validation and safe temporary storage of uploaded files."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import UploadFile

from ..config import Settings
from ..errors import AppError

CHUNK_SIZE = 1024 * 1024  # 1 MiB


def clean_display_name(filename: str | None) -> str:
    """Return a harmless display name. NEVER used to build filesystem paths."""
    name = os.path.basename((filename or "recording").replace("\\", "/"))
    name = "".join(ch for ch in name if ch.isprintable()).strip()
    return (name or "recording")[:120]


def validate_extension(filename: str | None, settings: Settings) -> str:
    ext = Path(clean_display_name(filename)).suffix.lower()
    if ext not in settings.allowed_extensions:
        allowed = ", ".join(e.lstrip(".").upper() for e in settings.allowed_extensions)
        raise AppError(415, "unsupported_format", f"Unsupported file type. Please upload one of: {allowed}.")
    return ext


def sniff_format(header: bytes) -> str | None:
    """Identify WAV / FLAC / MP3 from magic bytes (extension alone is not trusted)."""
    if header[:4] == b"RIFF" and header[8:12] == b"WAVE":
        return ".wav"
    if header[:4] == b"fLaC":
        return ".flac"
    if header[:3] == b"ID3" or (len(header) > 1 and header[0] == 0xFF and (header[1] & 0xE0) == 0xE0):
        return ".mp3"
    return None


async def save_upload_to_temp(upload: UploadFile, settings: Settings) -> Path:
    """Stream the upload into a temp file with a generated name, enforcing the size limit.

    The caller must delete the returned file (see routes/analysis.py ``finally``).
    """
    ext = validate_extension(upload.filename, settings)
    fd, tmp_name = tempfile.mkstemp(prefix="muselab_", suffix=ext, dir=settings.temp_dir)
    tmp_path = Path(tmp_name)
    total = 0
    try:
        with os.fdopen(fd, "wb") as out:
            first = True
            while True:
                chunk = await upload.read(CHUNK_SIZE)
                if not chunk:
                    break
                if first:
                    first = False
                    detected = sniff_format(chunk[:16])
                    if detected is None or detected != ext:
                        raise AppError(
                            415,
                            "unsupported_format",
                            "The file content does not look like a valid WAV, MP3 or FLAC file.",
                        )
                total += len(chunk)
                if total > settings.max_upload_bytes:
                    raise AppError(
                        413,
                        "file_too_large",
                        f"The file is larger than the {settings.max_upload_mb:g} MB limit.",
                    )
                out.write(chunk)
        if total == 0:
            raise AppError(400, "empty_file", "The uploaded file is empty.")
    except BaseException:
        tmp_path.unlink(missing_ok=True)
        raise
    return tmp_path
