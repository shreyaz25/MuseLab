"""Optional Plotly demo: analyse a local audio file and write an interactive HTML report.

Usage (from backend/):  python -m scripts.plot_analysis path/to/recording.wav out.html
"""
from __future__ import annotations

import sys
from pathlib import Path

import plotly.graph_objects as go
from plotly.subplots import make_subplots

from app.config import get_settings
from app.services.audio_analyzer import analyze_audio_file


def main(audio_path: str, out_path: str = "analysis.html") -> None:
    result = analyze_audio_file(Path(audio_path), Path(audio_path).name, get_settings())
    fig = make_subplots(rows=2, cols=1, shared_xaxes=True, subplot_titles=("Pitch (Hz)", "RMS energy"))
    track = result["pitch_track"]
    fig.add_trace(go.Scatter(x=track["times"], y=track["frequencies"], mode="lines", name="Pitch"), row=1, col=1)
    fig.add_trace(go.Scatter(x=result["energy"]["times"], y=result["energy"]["rms"], name="RMS"), row=2, col=1)
    fig.update_xaxes(title_text="Time (s)", row=2, col=1)
    fig.write_html(out_path)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("usage: python -m scripts.plot_analysis <audio> [out.html]")
    main(*sys.argv[1:3])
