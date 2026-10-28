import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useBackend } from "../context/Backend";

export function Logo() {
  const heights = [8, 14, 20, 12, 17, 9];
  return (
    <Link to="/" className="logo" aria-label="MuseLab home">
      <span className="bars" aria-hidden="true">
        {heights.map((h, i) => (
          <i key={i} style={{ height: h }} />
        ))}
      </span>
      <span>
        Muse<em>Lab</em>
      </span>
    </Link>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="banner error" role="alert">
      {message}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="glyph" aria-hidden="true">
        ♪
      </div>
      <h2>{title}</h2>
      <p className="muted">{children}</p>
      {action}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p className="muted" role="status">
      {label}
    </p>
  );
}

/** Shown on pages that need the Python API when it is unreachable. */
export function OfflineNotice() {
  const { status, recheck } = useBackend();
  if (status !== "offline") return null;
  return (
    <div className="banner error" role="alert">
      The Python backend is not reachable, so analysis and saved sessions are unavailable. Start it with{" "}
      <code>uvicorn app.main:app --reload --port 8000</code> (inside <code>backend/</code>) and check{" "}
      <code>VITE_API_BASE_URL</code>.{" "}
      <button className="btn secondary small" onClick={recheck}>
        Retry
      </button>
    </div>
  );
}
