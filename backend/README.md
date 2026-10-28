# MuseLab backend (Python / FastAPI)

Independent of the frontend. Run everything from this `backend/` folder.

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- Docs: http://localhost:8000/docs · Health: http://localhost:8000/health
- Tests: `pytest -v`
- Optional Plotly report for a local file: `python -m scripts.plot_analysis recording.wav out.html`

## Configuration (environment variables, see `.env.example`)

| Variable | Default | Meaning |
|---|---|---|
| `MUSELAB_DATABASE_URL` | `sqlite:///backend/data/muselab.db` | SQLAlchemy URL |
| `MUSELAB_CORS_ORIGINS` | localhost dev origins | Comma-separated allowed frontend origins. Avoid `*` |
| `MUSELAB_MAX_UPLOAD_MB` | 25 | Max upload size |
| `MUSELAB_MAX_DURATION_SECONDS` | 180 | Max audio length |
| `MUSELAB_ANALYSIS_TIMEOUT_SECONDS` | 120 | Request-level analysis timeout |
| `MUSELAB_ANALYSIS_SAMPLE_RATE` | 22050 | Analysis rate (never upsamples) |
| `MUSELAB_MAX_CHART_POINTS` | 800 | Cap on points per returned series |
| `MUSELAB_TEMP_DIR` | system temp | Folder for temporary uploads |

## Code map

- `app/services/audio_analyzer.py`: loading, mono/resampling, pYIN (YIN fallback is flagged in `warnings`), `hz_to_note` (MIDI = 69 + 12·log2(f/440)), RMS, centroid, chroma, tempo with a pulse-clarity check, waveform and spectrogram downsampling. Summaries use all frames; only chart arrays are downsampled.
- `app/services/file_validation.py`: extension and magic-byte checks, streamed size limit, generated temp filenames.
- `app/api/routes/`: thin HTTP layer. `app/database.py` and `app/models.py`: persistence, kept apart from routes and audio code.

## Docker

```bash
docker build -t muselab-api .
docker run -p 8000:8000 -v muselab-data:/data -e MUSELAB_CORS_ORIGINS=http://localhost:5173 muselab-api
```
