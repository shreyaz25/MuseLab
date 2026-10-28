export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds)) return "—";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h}h ${m}m`;
  return m ? `${m}m ${r}s` : `${r}s`;
}
export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
export function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export const fmt = (v: number | null | undefined, digits = 1, unit = ""): string =>
  v == null || !isFinite(v) ? "—" : `${v.toFixed(digits)}${unit}`;
export const pct = (v: number | null | undefined): string => (v == null ? "—" : `${Math.round(v * 100)}%`);
