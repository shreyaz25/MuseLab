import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { SessionSummary, SummaryMetrics } from "../api/types";
import { Empty, ErrorBanner, Loading, OfflineNotice } from "../components/ui";
import { useBackend } from "../context/Backend";
import { fmt, fmtDate, fmtDuration, pct } from "../lib/format";

const MIN_VOICED = 0.2;

const ROWS: { label: string; pitch: boolean; get: (s: SessionSummary) => string }[] = [
  { label: "Duration", pitch: false, get: (s) => fmtDuration(s.duration_seconds) },
  { label: "Mean RMS level (dBFS)", pitch: false, get: (s) => fmt(s.summary_metrics.mean_dbfs, 1, " dB") },
  { label: "Median pitch", pitch: true, get: (s) => (s.summary_metrics.median_hz ? `${s.summary_metrics.median_note} · ${fmt(s.summary_metrics.median_hz, 1, " Hz")}` : "—") },
  { label: "Detected range (this recording)", pitch: true, get: (s) => (s.summary_metrics.range_low_note ? `${s.summary_metrics.range_low_note} – ${s.summary_metrics.range_high_note}` : "—") },
  { label: "Pitch variation", pitch: true, get: (s) => fmt(s.summary_metrics.variation_std_cents, 0, " cents") },
  { label: "Voiced audio", pitch: false, get: (s) => pct(s.summary_metrics.voiced_ratio) },
  { label: "Tempo (if reliable)", pitch: false, get: (s) => (s.summary_metrics.tempo_bpm ? fmt(s.summary_metrics.tempo_bpm, 0, " BPM") : "unavailable") },
  { label: "Spectral centroid", pitch: false, get: (s) => fmt(s.summary_metrics.mean_centroid_hz, 0, " Hz") },
];

const pitchOk = (m: SummaryMetrics) => (m.voiced_ratio ?? 0) >= MIN_VOICED && !!m.median_hz;

export default function Compare() {
  const { status } = useBackend();
  const [items, setItems] = useState<SessionSummary[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  useEffect(() => {
    if (status === "offline") return;
    api.listSessions({ limit: 100 }).then((r) => setItems(r.items)).catch(setError);
  }, [status]);

  const sa = items?.find((s) => s.id === a);
  const sb = items?.find((s) => s.id === b);
  const comparablePitch = !!sa && !!sb && pitchOk(sa.summary_metrics) && pitchOk(sb.summary_metrics);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Compare sessions</h1>
          <p className="muted">Side-by-side measurements from two saved recordings.</p>
        </div>
        <Link className="btn secondary" to="/history">← History</Link>
      </div>
      <OfflineNotice />
      <ErrorBanner error={status === "offline" ? null : error} />
      {!items && status !== "offline" && !error && <Loading />}
      {items && items.length < 2 && <Empty title="Not enough sessions">Save at least two analyses to compare them.</Empty>}
      {items && items.length >= 2 && (
        <>
          <div className="card grid cols-2">
            {[["First session", a, setA, b], ["Second session", b, setB, a]].map(([label, val, set, other]) => (
              <div key={label as string}>
                <label htmlFor={label as string}>{label as string}</label>
                <select id={label as string} value={val as string} onChange={(e) => (set as (v: string) => void)(e.target.value)}>
                  <option value="">Choose…</option>
                  {items.filter((s) => s.id !== other).map((s) => (
                    <option key={s.id} value={s.id}>{s.title} — {fmtDate(s.created_at)}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {sa && sb && (
            <div className="card table-wrap">
              {!comparablePitch && (
                <div className="banner warn" style={{ marginBottom: 12 }}>
                  Pitch metrics are hidden because at least one recording has too little detected voiced audio to compare reliably.
                </div>
              )}
              <table>
                <thead><tr><th>Metric</th><th>{sa.title}</th><th>{sb.title}</th></tr></thead>
                <tbody>
                  {ROWS.map((r) => (
                    <tr key={r.label}>
                      <td>{r.label}</td>
                      <td>{r.pitch && !pitchOk(sa.summary_metrics) ? "n/a" : r.get(sa)}</td>
                      <td>{r.pitch && !pitchOk(sb.summary_metrics) ? "n/a" : r.get(sb)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="explain">
                Differences can come from the song, key, microphone, room, background music or how loudly you sang. They are not a measure of improvement or quality.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
