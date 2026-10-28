# MuseLab: personal vocal practice and audio analysis studio

MuseLab lets you upload a singing recording (WAV, MP3 or FLAC), analyse measurable properties of the audio, explore charts of the result, save practice sessions, and track practice over time.

> **Status note.** All code in this repository was written without being able to install dependencies or run the test suite in the environment that generated it (the package registries were blocked). Run `pytest` and `npm run build` on your machine first (see below) and fix anything they report. Treat the test results you get locally as the source of truth.

MuseLab is an educational tool. It reports *estimates of measurable audio properties*. It does **not** score singing ability, judge accuracy (there is no target melody), or give medical or vocal-health advice.

## Architecture

```
Browser (React UI)  ──HTTP/JSON──▶  Python FastAPI backend  ──▶  SQLite
 plays audio, uploads,              validation, decoding, pitch,    saved sessions
 draws charts                       features, sessions, stats
```

| Part | Technology | Where |
|---|---|---|
| UI (thin): upload, playback, charts, forms | Vite + React + TypeScript + Recharts (the stack Lovable generates) | repo root: `src/`, `index.html`, `package.json` |
| **All analysis and data logic** | **Python 3.11+**, FastAPI, librosa, NumPy, SciPy, SoundFile, SQLModel/SQLite, Pydantic | `backend/` |

Python does: server-side file validation, decoding and resampling, pYIN pitch estimation, frequency-to-note conversion, RMS/spectral/chroma/tempo features, summary statistics, session storage, dashboard statistics and all API responses. The frontend only displays numbers returned by the API; it computes nothing about the audio.

**What runs where.** Lovable (or any static host) can build and preview the *frontend only*. The Python backend is a separate server you run locally or deploy yourself (Docker/Render/Fly/Railway/VPS). Lovable's preview does not run it. The UI shows an honest "Python API offline" status when it can't reach the backend; there is no fake/sample data.

## Repository structure

```
MuseLab/
├── README.md
├── .gitignore
├── package.json, tsconfig.json, vite.config.ts, index.html, .env.example   (frontend)
├── src/
│   ├── api/            client.ts (the only place with the API URL), types.ts
│   ├── components/     charts.tsx, ResultsView.tsx, ui.tsx
│   ├── context/        Backend.tsx (connection status, current analysis)
│   ├── pages/          Dashboard, Studio, Results, History, SessionPage, Compare, Progress, Settings
│   └── styles.css
└── backend/
    ├── app/
    │   ├── main.py  config.py  database.py  models.py  schemas.py  errors.py
    │   ├── api/routes/   health.py  analysis.py  sessions.py
    │   └── services/     audio_analyzer.py  file_validation.py  session_service.py  stats_service.py
    ├── tests/            conftest.py  test_health.py  test_analysis.py  test_sessions.py
    ├── scripts/          plot_analysis.py (optional Plotly HTML report)
    ├── requirements.txt  .env.example  Dockerfile  pytest.ini  README.md
```

## Run the Python backend

Requires Python 3.11+ (newer stable versions should work). From a fresh checkout:

**macOS / Linux**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # optional; defaults work for local use
uvicorn app.main:app --reload --port 8000
```

**Windows (PowerShell)**

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
# If activation is blocked:  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

Then open:
- Health check: <http://localhost:8000/health>
- Interactive API docs (Swagger): <http://localhost:8000/docs>

Always run `uvicorn` from inside `backend/` so `app.main` imports resolve.

### FFmpeg (for MP3 and robust decoding)

WAV and FLAC decode with libsndfile (bundled in the `soundfile` wheels). MP3 works through libsndfile on recent versions and otherwise falls back to FFmpeg, so installing FFmpeg is recommended.

- **Windows:** `winget install Gyan.FFmpeg` (or `choco install ffmpeg`), then reopen the terminal and check `ffmpeg -version`.
- **macOS:** `brew install ffmpeg`
- **Debian/Ubuntu:** `sudo apt install ffmpeg libsndfile1`

M4A/AAC is **not** supported in this version.

## Run the frontend

Requires Node.js 18+.

```bash
# from the repo root
cp .env.example .env.local     # Windows: copy .env.example .env.local
npm install
npm run dev                    # http://localhost:5173
```

`VITE_API_BASE_URL` (in `.env.local`) is the backend URL, `http://localhost:8000` by default. It is read in exactly one place, `src/api/client.ts`. Restart `npm run dev` after changing it.

The backend must allow the frontend's origin: `MUSELAB_CORS_ORIGINS` in `backend/.env` (defaults include `http://localhost:5173`).

## Tests

```bash
cd backend
pip install -r requirements.txt   # includes pytest and httpx
pytest -v
```

Tests generate synthetic audio with NumPy (no real recordings needed), use a temporary SQLite file and a temporary upload folder per test, and cover: health, valid analysis, unsupported/corrupted/empty/silent files, size and duration limits, cleanup of temp files after success and failure, and saving/retrieving/updating/deleting sessions including 404s.

## API summary

| Method & path | Purpose |
|---|---|
| `GET /health` | Service status |
| `GET /api/config` | Upload limits and supported formats |
| `POST /api/analyze` | Multipart upload (`file`); returns the full analysis JSON. Optional `?include_spectrogram=false` |
| `GET /api/sessions` | List (`limit`, `offset`, `q` title search, `date_from`, `date_to`) |
| `POST /api/sessions` | Save a session (`title`, `notes`, `analysis`) |
| `GET /api/sessions/{id}` | Session details with full analysis |
| `PATCH /api/sessions/{id}` | Edit title / notes |
| `DELETE /api/sessions/{id}` | Delete (404 if missing) |
| `GET /api/stats` | Dashboard/progress aggregates (`tz_offset_minutes`) |

Errors always look like `{"error": {"code": "...", "message": "...", "details": ...}}`.

## Deploy the backend separately and connect the frontend

1. Build and run the container: `cd backend && docker build -t muselab-api . && docker run -p 8000:8000 -v muselab-data:/data -e MUSELAB_CORS_ORIGINS=https://your-frontend.example muselab-api`. The Dockerfile installs FFmpeg and libsndfile. Mount a volume at `/data` or saved sessions are lost when the container is replaced.
2. On a host such as Render, Fly.io or Railway, deploy `backend/` with that Dockerfile (they provide `$PORT`), attach a persistent disk at `/data`, and set `MUSELAB_CORS_ORIGINS` to your frontend's exact origin(s), comma-separated.
3. Set `VITE_API_BASE_URL=https://your-api.example` in the frontend host's environment (in Lovable: project environment/secrets settings) and rebuild.
4. **CORS security:** never set the origin list to `*` in production. Any website could then call your API from a visitor's browser. Keep an explicit list. Credentials are not used.

The API has no authentication; it is designed as a personal, single-user tool. Do not expose a public instance holding private practice data without adding auth.

## Getting the source out of Lovable / onto GitHub

1. Connect the project to GitHub (Lovable: *GitHub* → *Connect project*), which syncs this repository, including `backend/`.
2. On GitHub choose **Code → Download ZIP**, or clone: `git clone <your-repo-url>`.
3. No ZIP archive is bundled with this project; the repository is the deliverable.

To start a repo yourself: `git init && git add . && git commit -m "MuseLab" && git remote add origin <url> && git push -u origin main`.

## Privacy

Uploads are streamed to a temp file with a generated name (the original filename is never used in paths), analysed, and deleted in a `finally` block. Audio is never stored; no audio contents are logged. Saved sessions keep only title, notes, timestamp, file name and analysis numbers, in a local SQLite file (`backend/data/muselab.db`, git-ignored).

## Known limitations

- Pitch estimation is best for one isolated voice. Accompaniment, harmonies and noise reduce accuracy. Detected low/high pitches describe that recording only, not your vocal range.
- Tempo on unaccompanied vocals is often unreliable. MuseLab shows "unavailable" instead of guessing.
- The analysis timeout returns an error to the client, but the worker thread may finish in the background.
- SQLite is single-file and suited to one user. Moving to PostgreSQL means changing `MUSELAB_DATABASE_URL` and adding migrations (e.g. Alembic). The schema uses only portable SQLAlchemy types.
- Daily/weekly stats use the browser's UTC offset sent with the request; no user accounts or multi-user separation.
- No target-melody comparison, so no "accuracy" metric exists by design.
- Sessions store the full analysis JSON (including chart arrays), which keeps old sessions viewable but uses more disk than summary-only storage.

## Troubleshooting

- **UI says "Python API offline":** start the backend, check `VITE_API_BASE_URL`, and open `/health` in a browser.
- **Browser console shows a CORS error:** add the frontend origin to `MUSELAB_CORS_ORIGINS` and restart the backend.
- **MP3 fails with "could not be decoded":** install FFmpeg (see above) and restart the terminal.
- **`ModuleNotFoundError: app`:** run commands from inside `backend/`.
- **First analysis is slow:** librosa/numba compile code on first use; later runs are faster. pYIN on a 3-minute file can take tens of seconds.
- **Windows `pip install` build errors:** use a recent Python 3.11/3.12 so prebuilt wheels are available.
