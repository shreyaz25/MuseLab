import { useEffect, useRef } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NumList, Spectrogram, Waveform } from "../api/types";

const CYAN = "#22d3ee";
const VIOLET = "#a78bfa";
const GRID = "#263053";
const AXIS = { stroke: "#9aa3c4", fontSize: 12 } as const;
const TOOLTIP = { contentStyle: { background: "#151c33", border: "1px solid #263053", borderRadius: 8 }, labelStyle: { color: "#9aa3c4" } };

const zip = (times: number[], values: NumList, key = "v") => times.map((t, i) => ({ t, [key]: values[i] ?? null }));

const secs = (v: number) => `${v.toFixed(0)}s`;

export function TimeLine({
  times,
  values,
  unit,
  label,
  color = CYAN,
  height = 240,
  referenceY,
  digits = 1,
}: {
  times: number[];
  values: NumList;
  unit: string;
  label: string;
  color?: string;
  height?: number;
  referenceY?: number | null;
  digits?: number;
}) {
  const data = zip(times, values);
  return (
    <div role="img" aria-label={`${label} over time`}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={secs} {...AXIS} />
          <YAxis width={52} {...AXIS} domain={["auto", "auto"]} tickFormatter={(v) => Number(v).toFixed(digits === 0 ? 0 : digits > 2 ? 3 : 0)} />
          <Tooltip {...TOOLTIP} labelFormatter={(v) => `${Number(v).toFixed(2)} s`} formatter={(v) => [`${Number(v).toFixed(digits)} ${unit}`, label]} />
          {referenceY != null && <ReferenceLine y={referenceY} stroke={VIOLET} strokeDasharray="4 4" />}
          <Line type="linear" dataKey="v" stroke={color} dot={false} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DurationBars({ data, xKey, yKey, label, unit, color = VIOLET, formatX }: { data: any[]; xKey: string; yKey: string; label: string; unit: string; color?: string; formatX?: (v: string) => string }) {
  return (
    <div role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={formatX} {...AXIS} minTickGap={18} />
          <YAxis width={40} allowDecimals={false} {...AXIS} />
          <Tooltip {...TOOLTIP} formatter={(v) => [`${v} ${unit}`, label]} labelFormatter={(v) => (formatX ? formatX(String(v)) : String(v))} />
          <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MetricLine({ data, yKey, unit, label, formatX }: { data: any[]; yKey: string; unit: string; label: string; formatX: (v: string) => string }) {
  return (
    <div role="img" aria-label={`${label} across sessions`}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
          <XAxis dataKey="created_at" tickFormatter={formatX} {...AXIS} minTickGap={24} />
          <YAxis width={48} domain={["auto", "auto"]} {...AXIS} />
          <Tooltip {...TOOLTIP} labelFormatter={(v) => formatX(String(v))} formatter={(v) => [`${Number(v).toFixed(1)} ${unit}`, label]} />
          <Line type="linear" dataKey={yKey} stroke={CYAN} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChromaBars({ labels, values }: { labels: string[]; values: NumList }) {
  const data = labels.map((l, i) => ({ l, v: values[i] ?? 0 }));
  return (
    <div role="img" aria-label="Average strength of each pitch class (chroma)">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="l" {...AXIS} />
          <YAxis width={36} domain={[0, 1]} {...AXIS} />
          <Tooltip {...TOOLTIP} formatter={(v) => [Number(v).toFixed(2), "relative strength"]} />
          <Bar dataKey="v" fill={CYAN} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Min/max envelope of the waveform returned by the Python backend, drawn on a canvas. */
export function WaveformCanvas({ waveform }: { waveform: Waveform }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = 140;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#11172b";
    ctx.fillRect(0, 0, w, h);
    const n = waveform.times.length;
    if (!n) return;
    const peak = Math.max(0.01, ...waveform.max.map((v) => Math.abs(v ?? 0)), ...waveform.min.map((v) => Math.abs(v ?? 0)));
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = Math.max(1, w / n - 0.5);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const lo = waveform.min[i];
      const hi = waveform.max[i];
      if (lo == null || hi == null) continue;
      const x = ((i + 0.5) / n) * w;
      ctx.moveTo(x, h / 2 - (hi / peak) * (h / 2 - 4));
      ctx.lineTo(x, h / 2 - (lo / peak) * (h / 2 - 4));
    }
    ctx.stroke();
  }, [waveform]);
  const total = waveform.times.length ? waveform.times[waveform.times.length - 1] : 0;
  return (
    <div role="img" aria-label="Audio waveform">
      <canvas ref={ref} style={{ height: 140 }} />
      <div className="row small muted" style={{ justifyContent: "space-between" }}>
        <span>0 s</span>
        <span>time (s)</span>
        <span>{total.toFixed(1)} s</span>
      </div>
    </div>
  );
}

function colour(t: number): string {
  // t in 0..1 -> dark navy -> violet -> cyan
  const c = Math.min(1, Math.max(0, t));
  const stops = [
    [11, 16, 32],
    [109, 74, 224],
    [34, 211, 238],
  ];
  const seg = c < 0.5 ? 0 : 1;
  const f = c < 0.5 ? c / 0.5 : (c - 0.5) / 0.5;
  const [a, b] = [stops[seg], stops[seg + 1]];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(",")})`;
}

export function SpectrogramCanvas({ spec }: { spec: Spectrogram }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const rows = spec.db.length;
    const cols = spec.times.length;
    if (!rows || !cols) return;
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const v = spec.db[r][c];
        ctx.fillStyle = v == null ? "#0b1020" : colour((v + 80) / 80);
        ctx.fillRect(c, rows - 1 - r, 1, 1); // low frequencies at the bottom
      }
  }, [spec]);
  const maxF = spec.freqs_hz.length ? spec.freqs_hz[spec.freqs_hz.length - 1] : 0;
  const total = spec.times.length ? spec.times[spec.times.length - 1] : 0;
  return (
    <div role="img" aria-label="Mel spectrogram">
      <canvas ref={ref} style={{ height: 220, imageRendering: "auto" }} />
      <div className="row small muted" style={{ justifyContent: "space-between" }}>
        <span>0 s</span>
        <span>time (s) → · frequency ↑ 0–{Math.round(maxF)} Hz (mel scale)</span>
        <span>{total.toFixed(1)} s</span>
      </div>
    </div>
  );
}

