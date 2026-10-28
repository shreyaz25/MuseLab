import { API_BASE_URL } from "../api/client";
import { useBackend } from "../context/Backend";

export default function Settings() {
  const { status, config, recheck } = useBackend();
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Settings &amp; privacy</h1>
          <p className="muted">How MuseLab works and what it keeps.</p>
        </div>
      </div>

      <section className="card stack">
        <h2>Backend connection</h2>
        <div className="row">
          <span className={`dot ${status}`} aria-hidden="true" />
          <strong>{status === "online" ? "Python backend connected" : status === "offline" ? "Python backend not reachable" : "Checking…"}</strong>
          <button className="btn secondary small" onClick={recheck}>Re-check</button>
        </div>
        <p className="muted small">API URL: <code>{API_BASE_URL}</code> (set with <code>VITE_API_BASE_URL</code>)</p>
        {status === "offline" && (
          <div className="banner error">
            Start the backend from the <code>backend/</code> folder with <code>uvicorn app.main:app --reload --port 8000</code>. If it is running on another origin, add this site's address to <code>MUSELAB_CORS_ORIGINS</code>.
          </div>
        )}
      </section>

      <section className="card">
        <h2>How audio is processed</h2>
        <p className="muted">
          Your browser only plays the file and sends it to the Python (FastAPI) backend. All analysis (decoding, pitch estimation with librosa's pYIN, note conversion, energy,
          spectral features, tempo) runs in Python. This interface just displays the numbers it returns.
        </p>
      </section>

      <section className="card">
        <h2>Formats and limits</h2>
        {config ? (
          <ul className="clean">
            <li>Formats: {config.allowed_extensions.map((e) => e.replace(".", "").toUpperCase()).join(", ")}</li>
            <li>Maximum file size: {config.max_upload_mb} MB</li>
            <li>Maximum duration: {config.max_duration_seconds} seconds</li>
            <li>Analysis sample rate: up to {config.analysis_sample_rate} Hz (never upsampled)</li>
          </ul>
        ) : (
          <p className="muted">Connect to the backend to see its configured limits.</p>
        )}
      </section>

      <section className="card">
        <h2>Privacy</h2>
        <ul className="clean muted">
          <li>Uploaded audio is written to a temporary file with a generated name and deleted when processing finishes or fails. It is never kept.</li>
          <li>Saving a session stores only its title, notes, timestamp, file name and analysis numbers in the backend's local SQLite database.</li>
          <li>The backend does not log audio contents. There are no accounts and no third-party services.</li>
          <li>Deleting a session removes its record from the database.</li>
        </ul>
      </section>

      <section className="card">
        <h2>About the results</h2>
        <p className="muted">
          MuseLab is an educational tool. Its numbers are estimates of measurable audio properties, not a judgement of singing ability, and not a medical or professional vocal assessment.
        </p>
      </section>
    </div>
  );
}
