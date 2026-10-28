import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Stats } from "../api/types";
import { DurationBars, MetricLine } from "../components/charts";
import { Empty, ErrorBanner, Loading, OfflineNotice, Stat } from "../components/ui";
import { useBackend } from "../context/Backend";
import { fmt, fmtDate, fmtDuration, fmtShortDate } from "../lib/format";

export default function Dashboard() {
  const { status } = useBackend();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (status === "offline") return;
    api.stats().then(setStats).catch(setError);
  }, [status]);

  const reliable = stats?.metrics.filter((m) => m.pitch_reliable && m.median_hz != null) ?? [];

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Welcome back to the studio</h1>
          <p className="muted">Record, analyse and keep track of your practice.</p>
        </div>
        <Link className="btn" to="/studio">Analyse a new recording</Link>
      </div>
      <OfflineNotice />
      <ErrorBanner error={status === "offline" ? null : error} />
      {!stats && status !== "offline" && !error && <Loading />}

      {stats && stats.total_sessions === 0 && (
        <Empty title="Your practice history starts here" action={<Link className="btn" to="/studio">Analyse your first recording</Link>}>
          Upload a singing recording, explore its pitch and energy, and save it to see your stats appear.
        </Empty>
      )}

      {stats && stats.total_sessions > 0 && (
        <>
          <div className="grid cols-4">
            <Stat label="Practice sessions" value={stats.total_sessions} />
            <Stat label="Total recorded time" value={fmtDuration(stats.total_seconds)} />
            <Stat label="Active days (last 30)" value={stats.consistency.active_days_last_30} hint={`current streak ${stats.consistency.current_streak_days} d`} />
            <Stat
              label="Most recent analysis"
              value={<span style={{ fontSize: "1.05rem" }}>{stats.latest?.title}</span>}
              hint={stats.latest ? `${fmtDate(stats.latest.created_at)} · median ${fmt(stats.latest.summary_metrics.median_hz, 0, " Hz")}` : undefined}
            />
          </div>

          <div className="grid cols-2">
            <div className="card">
              <h2>Recorded time, last 30 days</h2>
              <DurationBars
                data={stats.daily.map((d) => ({ ...d, minutes: Math.round((d.seconds / 60) * 10) / 10 }))}
                xKey="date"
                yKey="minutes"
                label="Minutes"
                unit="min"
                formatX={(v) => fmtShortDate(v + "T12:00:00")}
              />
            </div>
            <div className="card">
              <h2>Median pitch across sessions</h2>
              {reliable.length >= 2 ? (
                <>
                  <MetricLine data={reliable} yKey="median_hz" unit="Hz" label="Median pitch" formatX={fmtShortDate} />
                  <p className="explain">Only sessions with enough detected voiced audio are shown. Changes here do not necessarily mean vocal improvement.</p>
                </>
              ) : (
                <p className="muted">Save at least two recordings with clear voiced audio to see how this metric changes.</p>
              )}
            </div>
          </div>

          <div className="card">
            <div className="chart-title">
              <h2>Recent activity</h2>
              <Link to="/history">View all →</Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Title</th><th>Date</th><th>Duration</th><th>Median pitch</th></tr>
                </thead>
                <tbody>
                  {stats.recent.map((s) => (
                    <tr key={s.id}>
                      <td><Link to={`/history/${s.id}`}>{s.title}</Link></td>
                      <td>{fmtDate(s.created_at)}</td>
                      <td>{fmtDuration(s.duration_seconds)}</td>
                      <td>{s.summary_metrics.median_note ?? "—"} {s.summary_metrics.median_hz ? `(${fmt(s.summary_metrics.median_hz, 0)} Hz)` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
