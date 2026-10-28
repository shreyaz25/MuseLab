# 🎙️ MuseLab — Personal Vocal Practice & Audio Analysis Studio

MuseLab is a personal vocal practice and audio analysis application that helps singers explore measurable properties of their singing recordings, review audio visualizations, save practice sessions, and track their progress over time.

Upload a recording, analyze its audio characteristics, and explore the results through an interactive dashboard.

> **Important:** MuseLab is an educational audio analysis tool. It estimates measurable audio properties; it does not grade singing ability, judge singing accuracy against a target melody, or provide medical or vocal-health advice.

---

## ✨ Features

* **Audio Upload:** Upload supported WAV, MP3, and FLAC recordings.
* **Audio Analysis:** Extract measurable characteristics from singing recordings using Python.
* **Pitch Estimation:** Estimate fundamental frequency and convert detected pitches into musical notes.
* **Audio Visualizations:** Explore analysis results through charts and visual representations.
* **Audio Feature Extraction:** Analyze RMS energy, spectral characteristics, chroma features, and estimated tempo.
* **Practice Sessions:** Save sessions with titles and notes.
* **Practice History:** Browse previously saved sessions.
* **Progress Dashboard:** Explore aggregated practice statistics.
* **Session Management:** Retrieve, update, and delete saved sessions.
* **Python-Powered Processing:** Perform audio analysis on the backend rather than relying on mock results in the frontend.

## 🛠️ Technology Stack

| Component        | Technologies                     |
| ---------------- | -------------------------------- |
| Frontend         | React, TypeScript, Vite          |
| Charts           | Recharts                         |
| Backend          | Python 3.11+, FastAPI            |
| Audio Analysis   | librosa, NumPy, SciPy, SoundFile |
| Database         | SQLite, SQLModel                 |
| Validation       | Pydantic                         |
| API Server       | Uvicorn                          |
| Testing          | pytest, HTTPX                    |
| Containerization | Docker                           |

### Architecture

```text
                    ┌─────────────────────────┐
                    │       Frontend          │
                    │ React + TypeScript      │
                    │ Uploads, Charts, UI     │
                    └────────────┬────────────┘
                                 │
                           HTTP / JSON
                                 │
                    ┌────────────▼────────────┐
                    │       Python API        │
                    │ FastAPI + Uvicorn       │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │     Audio Analysis      │
                    │ Pitch & Audio Features  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      SQLite Database    │
                    │     Saved Sessions      │
                    └─────────────────────────┘
```

The frontend communicates with the Python backend through HTTP requests. Audio validation, decoding, analysis, and session management are handled by the backend.

---

## 📁 Project Structure

```text
MuseLab/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── services/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── errors.py
│   │   ├── main.py
│   │   ├── models.py
│   │   └── schemas.py
│   │
│   ├── tests/
│   │   ├── test_health.py
│   │   ├── test_analysis.py
│   │   └── test_sessions.py
│   │
│   ├── scripts/
│   ├── data/
│   ├── .env.example
│   ├── Dockerfile
│   ├── pytest.ini
│   └── requirements.txt
│
├── src/
│   ├── api/
│   ├── components/
│   ├── context/
│   ├── pages/
│   └── styles.css
│
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
├── .gitignore
└── README.md
```

*Note: This is the intended project structure. Some files or folders may vary depending on the current implementation.*

---

## 💻 Requirements

Before running MuseLab, install the following:

* Python 3.11 or later
* Node.js 18 or later
* npm
* Git (optional, for cloning the repository)
* FFmpeg (recommended for robust MP3 decoding)

---

## 🚀 Getting Started

### 1. Clone the Repository

If you are downloading the project from GitHub, open a terminal and run:

```bash
git clone <YOUR_REPOSITORY_URL>
cd MuseLab
```

Replace `<YOUR_REPOSITORY_URL>` with your actual GitHub repository URL.

If you already have the project on your computer, open its main folder in VS Code instead.

### 2. Set Up the Python Backend

Open a terminal in VS Code.

Navigate to the backend directory:

```powershell
cd backend
```

Create a virtual environment:

```powershell
python -m venv .venv
```

Activate it on Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, you can run the following command for the current terminal session:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
```

Then activate the environment again.

Install the Python dependencies:

```powershell
python -m pip install -r requirements.txt
```

Run the backend:

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

Keep this terminal open while using the application.

### 3. Verify the Backend

Once the server starts, open these addresses in your browser:

* **Health Check:** http://localhost:8000/health
* **Interactive API Documentation:** http://localhost:8000/docs

The API documentation allows you to inspect available endpoints and test supported requests.

### 4. Set Up the Frontend

Open a **second terminal** in VS Code.

Navigate to the main project directory, where `package.json` is located.

If your terminal is still inside `backend`, run:

```powershell
cd ..
```

Create a local environment file:

```powershell
Copy-Item .env.example .env.local
```

If `.env.local` already exists, do not overwrite it unnecessarily.

Install the frontend dependencies:

```powershell
npm install
```

Start the development server:

```powershell
npm run dev
```

Vite will display a local URL, commonly:

http://localhost:5173

Open the URL shown in your terminal to use MuseLab.

### 5. Build the Frontend

To check whether the frontend can be built for production, run:

```powershell
npm run build
```

Run this command from the directory containing the frontend's `package.json`.

---

## 🎵 Audio Analysis

MuseLab uses Python-based audio processing to estimate characteristics of uploaded recordings.

The analysis may include:

* **Fundamental Frequency:** Estimates the pitch frequency detected in the recording.
* **Musical Note Conversion:** Converts estimated frequencies into musical note representations.
* **RMS Energy:** Measures aspects of the recording's signal energy.
* **Spectral Features:** Examines characteristics of the audio frequency spectrum.
* **Chroma Features:** Represents energy associated with musical pitch classes.
* **Tempo Estimation:** Attempts to estimate rhythmic tempo when the recording supports a meaningful estimate.
* **Summary Statistics:** Organizes analysis results for presentation in the user interface.

### Understanding the Results

Audio analysis is an estimation process, not a perfect measurement of singing ability.

Results can be affected by:

* Background noise
* Instrumental accompaniment
* Multiple simultaneous voices
* Recording quality
* Audio length
* The characteristics of the recording itself

Pitch estimates from a single recording should not automatically be treated as a singer's complete vocal range.

---

## 🔌 API Overview

MuseLab uses a FastAPI backend to expose its functionality.

| Method | Endpoint             | Purpose                                      |
| ------ | -------------------- | -------------------------------------------- |
| GET    | `/health`            | Check backend availability                   |
| GET    | `/api/config`        | Retrieve upload limits and supported formats |
| POST   | `/api/analyze`       | Upload and analyze an audio recording        |
| GET    | `/api/sessions`      | List saved practice sessions                 |
| POST   | `/api/sessions`      | Save a practice session                      |
| GET    | `/api/sessions/{id}` | Retrieve a session                           |
| PATCH  | `/api/sessions/{id}` | Update session title or notes                |
| DELETE | `/api/sessions/{id}` | Delete a saved session                       |
| GET    | `/api/stats`         | Retrieve dashboard and progress statistics   |

The analysis endpoint accepts a multipart file upload. An optional `include_spectrogram` query parameter controls whether spectrogram data is included.

The API returns structured JSON responses. Errors use a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Description of the error",
    "details": null
  }
}
```

The actual error code, message, and details depend on the error encountered.

---

## 🧪 Testing

MuseLab includes automated backend tests using pytest and HTTPX.

These tests are intended to cover:

* Backend health checks
* Valid audio analysis
* Unsupported file formats
* Corrupted, empty, or silent audio files
* File-size and duration limits
* Temporary-file cleanup
* Saving and retrieving sessions
* Updating and deleting sessions
* Handling missing sessions

### Run the Tests

Open a terminal and navigate to the backend directory:

```powershell
cd backend
```

Activate your virtual environment if it is not already active:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install the dependencies:

```powershell
python -m pip install -r requirements.txt
```

Run the test suite:

```powershell
python -m pytest -v
```

Review the output to identify any failed tests.

> **Testing status:** Do not assume that all tests pass until you have run them locally. The actual results depend on the installed dependencies and current code.

---

## 🎧 FFmpeg Setup

FFmpeg is recommended for robust decoding of MP3 recordings when the installed audio libraries cannot decode them directly.

### Windows

If Windows Package Manager is available:

```powershell
winget install Gyan.FFmpeg
```

Alternatively, install FFmpeg using another supported installation method.

Close and reopen the terminal, then verify the installation:

```powershell
ffmpeg -version
```

### macOS

```bash
brew install ffmpeg
```

### Debian or Ubuntu

```bash
sudo apt install ffmpeg libsndfile1
```

WAV and FLAC decoding are supported through SoundFile in the configured environment. MP3 decoding can depend on installed libraries and FFmpeg availability.

**M4A/AAC is not supported in this version**, according to the project's current implementation notes.

---

## 🌐 Deployment

MuseLab has two separately deployed components:

1. The React frontend
2. The Python FastAPI backend

A static frontend hosting service cannot run the Python analysis server by itself.

### Deploy the Frontend

The frontend can be built and hosted on a service such as Vercel.

General steps:

1. Push the project to GitHub.
2. Import the repository into your frontend hosting provider.
3. Configure the frontend root directory to the folder containing `package.json`.
4. Set the build command to `npm run build`.
5. Configure the required production environment variables.
6. Deploy the frontend.

### Deploy the Backend

The Python backend can be deployed on a service that supports Python web applications or Docker containers.

The repository includes a backend Dockerfile intended to support containerized deployment.

Before deploying, verify the Dockerfile and hosting configuration.

For a Docker-based deployment, the general commands are:

```bash
cd backend
docker build -t muselab-api .
docker run -p 8000:8000 muselab-api
```

The container configuration, environment variables, database location, and port settings must match the actual deployment environment.

### Connect the Frontend and Backend

The frontend uses the `VITE_API_BASE_URL` environment variable to identify the backend API.

For local development, the default is:

```env
VITE_API_BASE_URL=http://localhost:8000
```

For production, configure it with your deployed backend URL:

```env
VITE_API_BASE_URL=https://your-api.example.com
```

Replace the example URL with your actual backend address.

After changing frontend environment variables, rebuild and redeploy the frontend.

### Configure CORS

The backend uses `MUSELAB_CORS_ORIGINS` to control which frontend origins can access the API through a browser.

Configure this variable with your actual frontend origin or origins.

For example:

```env
MUSELAB_CORS_ORIGINS=https://your-frontend.example.com
```

Use the exact deployed frontend origin rather than a wildcard in production.

### Important Deployment Considerations

* The backend must be reachable from the deployed frontend.
* The backend's CORS configuration must permit the frontend origin.
* Environment variables must be configured in the hosting provider.
* If SQLite is used, persistent storage is needed to retain saved sessions across container replacements.
* The current API has no authentication and is designed as a personal, single-user tool. Do not expose private practice data publicly without adding appropriate access controls.
* Verify the actual hosting provider's port and persistent-storage requirements before deployment.

---

## 🔒 Privacy

MuseLab's documented backend behavior includes temporary-file handling for uploaded recordings.

According to the implementation notes:

* Uploaded audio is processed using a temporary file.
* A generated temporary filename is used rather than the original filename as a filesystem path.
* Temporary audio files are deleted after processing.
* Audio contents are not intended to be logged.
* Saved sessions retain session metadata and analysis results.
* SQLite database files are intended to remain local and be excluded from version control.

These behaviors depend on the actual implementation and configuration. Review the backend code before relying on them for sensitive recordings.

---

## ⚠️ Known Limitations

* Pitch estimation is most reliable when the recording contains one relatively isolated voice.
* Instrumental accompaniment, harmonies, and noise can reduce analysis accuracy.
* Detected low and high pitches describe the analyzed recording and do not necessarily represent the singer's complete vocal range.
* Tempo estimation can be unreliable for unaccompanied vocals.
* Initial analysis may take longer while audio-processing libraries initialize or compile components.
* Long recordings can require substantial processing time.
* SQLite is suited to a small, single-user application; multi-user deployments may require a different database architecture.
* Daily and weekly statistics depend on the timezone offset supplied by the browser.
* The application does not compare singing with a target melody and therefore does not provide a singing-accuracy score.
* Saved sessions may contain full analysis data, including chart arrays, which increases storage requirements.

---

## 🛠️ Troubleshooting

### The interface says "Python API offline"

1. Confirm that the backend server is running.
2. Open http://localhost:8000/health.
3. Check `VITE_API_BASE_URL` in `.env.local`.
4. Restart the frontend development server after changing environment variables.

### The browser reports a CORS error

Check `MUSELAB_CORS_ORIGINS` in the backend configuration.

Make sure the frontend's origin is included, then restart the backend.

### MP3 files cannot be decoded

Verify that FFmpeg is installed and accessible from your terminal.

```powershell
ffmpeg -version
```

Restart the terminal after installing FFmpeg.

### `ModuleNotFoundError: No module named 'app'`

Run the backend commands from inside the `backend` directory.

### Python dependency installation fails

Check your Python version:

```powershell
python --version
```

Use a supported Python version and review the installation output for missing system dependencies or package compatibility problems.

### The first analysis is slow

Some audio-processing libraries may initialize or compile components on the first run. Subsequent analyses may be faster.

---

## 🔄 GitHub Workflow

To upload your latest project changes to GitHub:

```bash
git add .
git commit -m "Update MuseLab"
git push
```

Run these commands from the project's Git repository root.

Make sure `.gitignore` excludes virtual environments, local environment files, caches, generated databases, and other files that should not be committed.

Never commit API keys, passwords, or other private credentials.

---

## 🎯 Project Goal

MuseLab aims to provide singers with an accessible way to explore measurable properties of their vocal recordings, review analysis results, and maintain a record of their practice sessions.

By combining a React-based interface with a Python audio-processing backend, the project separates presentation from analysis and provides a foundation for future improvements in vocal practice and progress tracking.

---

**MuseLab — Explore your voice. Understand your sound. Track your practice.** 🎶
