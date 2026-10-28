import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { analyzeRecording, ApiError } from "../api/client";
import { ErrorBanner, OfflineNotice } from "../components/ui";
import { useBackend, useCurrentAnalysis } from "../context/Backend";
import { fmtBytes } from "../lib/format";

const FALLBACK_EXT = [".wav", ".mp3", ".flac"];

export default function Studio() {
  const { config, status } = useBackend();
  const { setCurrent } = useCurrentAnalysis();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "analysing">("idle");
  const [progress, setProgress] = useState(0);

  const allowed = config?.allowed_extensions ?? FALLBACK_EXT;
  const maxMb = config?.max_upload_mb ?? 25;
  const audioUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  // Client-side pre-check only; the Python backend repeats and enforces every check.
  function choose(f: File | undefined) {
    setError(null);
    if (!f) return;
    const ext = "." + (f.name.split(".").pop() ?? "").toLowerCase();
    if (!allowed.includes(ext)) return setError(new Error(`Unsupported file type. Please choose: ${allowed.join(", ")}`));
    if (f.size > maxMb * 1024 * 1024) return setError(new Error(`That file is ${fmtBytes(f.size)}; the limit is ${maxMb} MB.`));
    if (f.size === 0) return setError(new Error("That file is empty."));
    setFile(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    choose(e.dataTransfer.files?.[0]);
  }

  async function run() {
    if (!file) return;
    setError(null);
    setProgress(0);
    setPhase("uploading");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const result = await analyzeRecording(file, {
        signal: ctrl.signal,
        onUploadProgress: (f) => {
          setProgress(f);
          if (f >= 1) setPhase("analysing");
        },
      });
      setCurrent(result);
      navigate("/results");
    } catch (e) {
      if (!(e instanceof ApiError && e.code === "aborted")) setError(e);
    } finally {
      setPhase("idle");
      abortRef.current = null;
    }
  }

  const busy = phase !== "idle";

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Analysis Studio</h1>
          <p className="muted">Upload a recording. The Python backend analyses it and sends back measurements.</p>
        </div>
      </div>
      <OfflineNotice />

      <div className="banner info">
        Pitch estimation works best on a single, relatively isolated voice. Backing music, harmonies, several singers, background noise or very quiet
        recordings can reduce accuracy.
      </div>

      <div
        className={`dropzone ${over ? "over" : ""}`}
        role="button"
        tabIndex={0}
        aria-label="Choose or drop an audio file"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <div style={{ fontSize: "2rem" }} aria-hidden="true">♫</div>
        <strong>Drop an audio file here, or click to browse</strong>
        <p className="muted small">
          {allowed.map((e) => e.replace(".", "").toUpperCase()).join(", ")} · up to {maxMb} MB
          {config ? ` · up to ${Math.round(config.max_duration_seconds / 60 * 10) / 10} min` : ""}
        </p>
        <input ref={inputRef} type="file" hidden accept={allowed.join(",") + ",audio/*"} onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
      </div>

      <ErrorBanner error={error} />

      {file && (
        <div className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong style={{ wordBreak: "break-all" }}>{file.name}</strong>
              <div className="muted small">{fmtBytes(file.size)}</div>
            </div>
            <button className="btn secondary small" onClick={() => setFile(null)} disabled={busy}>Remove file</button>
          </div>
          {audioUrl && <audio controls src={audioUrl} aria-label="Preview of the selected recording" />}
          {busy && (
            <div>
              <div className={`progress ${phase === "analysing" ? "indeterminate" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                <div style={{ width: `${progress * 100}%` }} />
              </div>
              <p className="muted small" role="status">
                {phase === "uploading" ? `Uploading… ${Math.round(progress * 100)}%` : "Analysing on the Python backend… this can take a little while for longer recordings."}
              </p>
            </div>
          )}
          <div className="row">
            <button className="btn" onClick={run} disabled={busy || status === "offline"}>
              {busy ? "Working…" : "Analyse Recording"}
            </button>
            {busy && (
              <button className="btn secondary" onClick={() => abortRef.current?.abort()}>
                Cancel
              </button>
            )}
          </div>
          <p className="muted small">
            Playback happens in your browser; the analysis itself runs in Python. The uploaded audio is deleted from the server as soon as processing finishes.
          </p>
        </div>
      )}
    </div>
  );
}
