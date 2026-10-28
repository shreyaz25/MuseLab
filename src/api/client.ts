// Central API client: the ONLY place that knows the backend URL.
import type { AnalysisResult, BackendConfig, SessionDetail, SessionList, SessionSummary, Stats } from "./types";

export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
  get isNetwork() {
    return this.code === "network";
  }
}

const networkError = () =>
  new ApiError(0, "network", `Cannot reach the MuseLab Python backend at ${API_BASE_URL}. Is it running, and is CORS configured for this site?`);

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    if (body?.error?.message) return new ApiError(res.status, body.error.code ?? "error", body.error.message);
  } catch {
    /* fall through */
  }
  return new ApiError(res.status, "http_error", `Request failed (${res.status}).`);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw networkError();
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

function looksLikeAnalysis(x: any): x is AnalysisResult {
  return !!x && typeof x.analysis_id === "string" && !!x.overview && !!x.pitch_track && !!x.pitch && !!x.energy && !!x.waveform;
}

export interface AnalyzeOptions {
  onUploadProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  includeSpectrogram?: boolean;
}

/** Upload with progress + cancellation (XHR, because fetch has no upload progress). */
export function analyzeRecording(file: File, opts: AnalyzeOptions = {}): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const qs = opts.includeSpectrogram === false ? "?include_spectrogram=false" : "";
    xhr.open("POST", `${API_BASE_URL}/api/analyze${qs}`);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onUploadProgress?.(e.loaded / e.total);
    xhr.onerror = () => reject(networkError());
    xhr.onabort = () => reject(new ApiError(0, "aborted", "Upload cancelled."));
    xhr.onload = () => {
      const body = xhr.response;
      if (xhr.status >= 200 && xhr.status < 300) {
        if (looksLikeAnalysis(body)) resolve(body);
        else reject(new ApiError(xhr.status, "bad_response", "The backend returned an unexpected response."));
      } else {
        reject(new ApiError(xhr.status, body?.error?.code ?? "http_error", body?.error?.message ?? `Request failed (${xhr.status}).`));
      }
    };
    opts.signal?.addEventListener("abort", () => xhr.abort());
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export const api = {
  health: () => request<{ status: string; service: string; version: string }>("/health"),
  config: () => request<BackendConfig>("/api/config"),
  stats: () => request<Stats>(`/api/stats?tz_offset_minutes=${-new Date().getTimezoneOffset()}`),
  listSessions: (params: { q?: string; date_from?: string; date_to?: string; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && qs.set(k, String(v)));
    return request<SessionList>(`/api/sessions?${qs}`);
  },
  getSession: (id: string) => request<SessionDetail>(`/api/sessions/${id}`),
  createSession: (body: { title: string; notes: string; analysis: AnalysisResult }) =>
    request<SessionDetail>("/api/sessions", json("POST", body)),
  updateSession: (id: string, body: { title?: string; notes?: string }) =>
    request<SessionSummary>(`/api/sessions/${id}`, json("PATCH", body)),
  deleteSession: (id: string) => request<void>(`/api/sessions/${id}`, { method: "DELETE" }),
};
