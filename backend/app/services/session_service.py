"""Session helpers: headline metrics extraction."""
from __future__ import annotations

from ..schemas import AnalysisResult


def build_summary_metrics(analysis: AnalysisResult) -> dict:
    """Small flat dict used by lists, dashboard, progress and comparison."""
    p, e, t, s = analysis.pitch, analysis.energy, analysis.tempo, analysis.spectral
    return {
        "median_hz": p.median_hz,
        "median_note": p.median_note,
        "range_low_hz": p.range_low_hz,
        "range_high_hz": p.range_high_hz,
        "range_low_note": p.range_low_note,
        "range_high_note": p.range_high_note,
        "voiced_ratio": p.voiced_ratio,
        "variation_std_cents": p.variation_std_cents,
        "mean_rms": e.mean_rms,
        "mean_dbfs": e.mean_dbfs,
        "tempo_bpm": t.bpm if t.available else None,
        "mean_centroid_hz": s.mean_centroid_hz,
    }
