import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { SessionList } from "../api/types";
import { Empty, ErrorBanner, Loading, OfflineNotice } from "../components/ui";
import { useBackend } from "../context/Backend";
import { fmt, fmtDate, fmtDuration, pct } from "../lib/format";

const PAGE = 20;

export default function History() {
  const { status } = useBackend();
  const [data, setData] = useState<SessionList | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ q: "", from: "", to: "" });
  const [offset, setOffset] = useState(0);

  const load = useCallback(() => {
    setError(null);
    api
      .listSessions({ q: applied.q, date_from: applied.from, date_to: applied.to, limit: PAGE, offset })
      .then(setData)
      .catch(setError);
  }, [applied, offset]);

  useEffect(() => {
    if (status !== "offline") load();
  }, [load, status]);

  function search(e: FormEvent) {
    e.preventDefault();
    setOffset(0);
    setApplied({ q, from, to });
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await api.deleteSession(id);
      load(); // refresh from the backend
    } catch (e) {
      setError(e);
    }
  }

  const filtered = applied.q || applied.from || applied.to;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Practice history</h1>
          <p className="muted">Your saved analyses.</p>
        </div>
        <Link className="btn secondary" to="/compare">Compare two sessions</Link>
      </div>
      <OfflineNotice />

      <form className="card grid cols-4" onSubmit={search} aria-label="Filter sessions">
        <div><label htmlFor="q">Title contains</label><input id="q" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div><label htmlFor="from">From date</label><input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><label htmlFor="to">To date</label><input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <button className="btn">Filter</button>
          {filtered && (
            <button type="button" className="btn secondary" onClick={() => { setQ(""); setFrom(""); setTo(""); setOffset(0); setApplied({ q: "", from: "", to: "" }); }}>
              Clear
            </button>
          )}
        </div>
      </form>

      <ErrorBanner error={status === "offline" ? null : error} />
      {!data && status !== "offline" && !error && <Loading />}

      {data && data.total === 0 && (
        <Empty title={filtered ? "No sessions match" : "No saved sessions yet"} action={!filtered ? <Link className="btn" to="/studio">Analyse a recording</Link> : undefined}>
          {filtered ? "Try a different title or date range." : "Analyse a recording and save it to start your history."}
        </Empty>
      )}

      {data && data.total > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr><th>Title</th><th>Date</th><th>Duration</th><th>Median pitch</th><th>Voiced</th><th>Tempo</th><th /></tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id}>
                  <td><Link to={`/history/${s.id}`}>{s.title}</Link></td>
                  <td>{fmtDate(s.created_at)}</td>
                  <td>{fmtDuration(s.duration_seconds)}</td>
                  <td>{s.summary_metrics.median_note ?? "—"} <span className="muted">{s.summary_metrics.median_hz ? `${fmt(s.summary_metrics.median_hz, 0)} Hz` : ""}</span></td>
                  <td>{pct(s.summary_metrics.voiced_ratio)}</td>
                  <td>{s.summary_metrics.tempo_bpm ? `${fmt(s.summary_metrics.tempo_bpm, 0)} BPM` : "—"}</td>
                  <td><button className="btn danger small" onClick={() => remove(s.id, s.title)} aria-label={`Delete ${s.title}`}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
            <span className="muted small">{data.total} session{data.total === 1 ? "" : "s"}</span>
            <div className="row">
              <button className="btn secondary small" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</button>
              <button className="btn secondary small" disabled={offset + PAGE >= data.total} onClick={() => setOffset(offset + PAGE)}>Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
