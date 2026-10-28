// Mirrors backend/app/schemas.py. All values come from the Python API.
export type NumList = Array<number | null>;

export interface Overview {
  file_name: string;
  duration_seconds: number;
  original_sample_rate: number;
  analysis_sample_rate: number;
  channels: number;
  status: string;
}
export interface PitchTrack {
  method: string;
  hop_seconds: number;
  times: number[];
  frequencies: NumList;
  voiced: boolean[];
}
export interface PitchSummary {
  available: boolean;
  reason?: string | null;
  median_hz?: number | null;
  median_note?: string | null;
  median_cents_offset?: number | null;
  range_low_hz?: number | null;
  range_high_hz?: number | null;
  range_low_note?: string | null;
  range_high_note?: string | null;
  voiced_frames: number;
  total_frames: number;
  voiced_ratio: number;
  voiced_seconds: number;
  variation_std_cents?: number | null;
  variation_iqr_cents?: number | null;
}
export interface Energy {
  times: number[];
  rms: NumList;
  mean_rms?: number | null;
  max_rms?: number | null;
  mean_dbfs?: number | null;
  peak_amplitude?: number | null;
}
export interface Tempo {
  available: boolean;
  bpm?: number | null;
  confidence?: string | null;
  reason?: string | null;
}
export interface Spectral {
  centroid_times: number[];
  centroid_hz: NumList;
  mean_centroid_hz?: number | null;
  chroma_labels: string[];
  chroma_mean: NumList;
  dominant_pitch_class?: string | null;
}
export interface Waveform {
  times: number[];
  min: NumList;
  max: NumList;
}
export interface Spectrogram {
  times: number[];
  freqs_hz: number[];
  db: NumList[];
}
export interface AnalysisResult {
  analysis_id: string;
  overview: Overview;
  pitch_track: PitchTrack;
  pitch: PitchSummary;
  energy: Energy;
  tempo: Tempo;
  spectral: Spectral;
  waveform: Waveform;
  spectrogram?: Spectrogram | null;
  warnings: string[];
  limitations: string[];
}

export interface SummaryMetrics {
  median_hz?: number | null;
  median_note?: string | null;
  range_low_hz?: number | null;
  range_high_hz?: number | null;
  range_low_note?: string | null;
  range_high_note?: string | null;
  voiced_ratio?: number | null;
  variation_std_cents?: number | null;
  mean_rms?: number | null;
  mean_dbfs?: number | null;
  tempo_bpm?: number | null;
  mean_centroid_hz?: number | null;
}
export interface SessionSummary {
  id: string;
  title: string;
  notes: string;
  created_at: string;
  file_name: string;
  duration_seconds: number;
  sample_rate: number;
  channels: number;
  summary_metrics: SummaryMetrics;
}
export interface SessionDetail extends SessionSummary {
  analysis: AnalysisResult;
}
export interface SessionList {
  items: SessionSummary[];
  total: number;
  limit: number;
  offset: number;
}
export interface Stats {
  total_sessions: number;
  total_seconds: number;
  latest: SessionSummary | null;
  recent: SessionSummary[];
  daily: { date: string; seconds: number; sessions: number }[];
  weekly: { week_start: string; seconds: number; sessions: number }[];
  metrics: {
    session_id: string;
    title: string;
    created_at: string;
    median_hz: number | null;
    variation_std_cents: number | null;
    mean_dbfs: number | null;
    voiced_ratio: number | null;
    pitch_reliable: boolean;
  }[];
  consistency: { active_days_last_30: number; current_streak_days: number; longest_streak_days: number };
}
export interface BackendConfig {
  max_upload_mb: number;
  max_duration_seconds: number;
  allowed_extensions: string[];
  analysis_sample_rate: number;
}
