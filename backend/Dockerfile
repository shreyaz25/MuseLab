FROM python:3.11-slim

# libsndfile: WAV/FLAC (and MP3 on recent versions); ffmpeg: fallback decoder for MP3 and other formats
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV PYTHONUNBUFFERED=1 \
    MUSELAB_DATABASE_URL=sqlite:////data/muselab.db
# Mount a volume at /data to keep saved sessions between container restarts.
VOLUME ["/data"]

EXPOSE 8000
# Platforms like Render/Fly set $PORT; default to 8000 locally.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
