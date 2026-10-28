import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Stats } from "../api/types";
import { DurationBars, MetricLine } from "../components/charts";
import { Empty, ErrorBanner, Loading, OfflineNotice, Stat } from "../components/ui";
import { useBackend } from "../context/Backend";
import { fmtShortDate } from "../lib/format";

type MetricKey = "median_hz" | "variation_std_cents" | "mean_dbfs";
const METRICS: Record<MetricKey, { label: string; unit: string; pitch: boolean }> = {
  median_hz: { label: "Median pitch", unit: "Hz", pitch: true },
  variation_std_cents: { label: "Pitch variation", unit: "cents", pitch: true },
  mean_dbfs: { label: "Mean level", unit: "dBFS", pitch: false },
};

export default function Progress() {
  const { status } = useBackend();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [metric, setMetric] = useState<MetricKey>("median_hz");

  useEffect(() => {
    if (status === "offline") return;
    api.stats().then(setStats).catch(setError);
  }, [status]);

  const def = METRICS[metric];
  const points = (stats?.metrics ?? []).filter((m) => m[metric] != null && (!def.pitch || m.pitch_reliable));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Practice progress</h1>
          <p className="muted">Built from your saved sessions.</p>
        </div>
      </div>
      <OfflineNotice />
      <ErrorBanner error={status === "offline" ? null : error} />
      {!stats && status !== "offline" && !error && <Loading />}
      {stats && stats.total_sessions === 0 && (
        <Empty title="No progress to show yet" action={<Link className="btn" to="/studio">Analyse a recording</Link>}>
          Save a few sessions and your practice consistency and metrics will appear here.
        </Empty>
      )}
      {stats && stats.total_sessions > 0 && (
        <>
          <div className="grid cols-3">
            <Stat label="Active days (last 30)" value={stats.consistency.active_days_last_30} />
            <Stat label="Current streak" value={`${stats.consistency.current_streak_days} d`} />
            <Stat label="Longest streak" value={`${stats.consistency.longest_streak_days} d`} />
          </div>
          <div className="grid cols-2">
            <div className="card">
              <h2>Practice time per week (min)</h2>
              <DurationBars
                data={stats.weekly.map((w) => ({ ...w, minutes: Math.round((w.seconds / 60) * 10) / 10 }))}
                xKey="week_start" yKey="minutes" label="Minutes" unit="min"
                formatX={(v) => `wk ${fmtShortDate(v + "T12:00:00")}`}
              />
            </div>
            <div className="card">
              <h2>Sessions per week</h2>
              <DurationBars
                data={stats.weekly} xKey="week_start" yKey="sessions" label="Sessions" unit="sessions" color="#22d3ee"
                formatX={(v) => `wk ${fmtShortDate(v + "T12:00:00")}`}
              />
            </div>
          </div>
          <div className="card">
            <div className="chart-title">
              <h2>Metric across recordings</h2>
              <div style={{ minWidth: 200 }}>
                <label htmlFor="metric" className="small">Metric</label>
                <select id="metric" value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>
                  {Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            {points.length >= 2 ? (
              <MetricLine data={points} yKey={metric} unit={def.unit} label={def.label} formatX={fmtShortDate} />
            ) : (
              <p className="muted">Not enough comparable sessions yet. At least two are needed{def.pitch ? ", each with enough detected voiced audio" : ""}.</p>
            )}
            <p className="explain">
              Changes in estimated pitch metrics do not necessarily indicate vocal improvement. Different songs, keys, accompaniment, microphones and recording conditions
              all change these numbers. Use this chart to notice patterns, not to grade yourself.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
