import type { AnalysisResult } from "../api/types";
import { fmt, fmtDuration, pct } from "../lib/format";
import { ChromaBars, SpectrogramCanvas, TimeLine, WaveformCanvas } from "./charts";
import { Stat } from "./ui";

/** Renders exactly what the Python backend returned. Nothing is computed here. */
export function ResultsView({ result }: { result: AnalysisResult }) {
  const { overview, pitch, pitch_track, energy, tempo, spectral, waveform, spectrogram } = result;

  return (
    <div className="stack">
      <section className="grid cols-4" aria-label="Recording overview">
        <Stat label="File" value={<span style={{ fontSize: "1rem", wordBreak: "break-all" }}>{overview.file_name}</span>} hint={`Status: ${overview.status}`} />
        <Stat label="Duration" value={fmtDuration(overview.duration_seconds)} hint={`${overview.duration_seconds.toFixed(2)} s`} />
        <Stat label="Sample rate" value={`${(overview.original_sample_rate / 1000).toFixed(2)} kHz`} hint={`analysed at ${overview.analysis_sample_rate} Hz`} />
        <Stat label="Channels" value={overview.channels} hint={overview.channels === 1 ? "mono" : overview.channels === 2 ? "stereo (mixed to mono)" : "mixed to mono"} />
      </section>

      {result.warnings.length > 0 && (
        <div className="banner warn" role="note">
          <strong>Heads-up</strong>
          <ul className="clean">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="card" aria-label="Pitch analysis">
        <div className="chart-title">
          <h2>Estimated pitch over time</h2>
          <span className="badge">method: {pitch_track.method === "pyin" ? "pYIN" : "YIN (fallback)"}</span>
        </div>
        {pitch.available ? (
          <>
            <TimeLine times={pitch_track.times} values={pitch_track.frequencies} unit="Hz" label="Pitch" referenceY={pitch.median_hz} digits={1} />
            <p className="explain">
              Gaps are frames where no clear voiced pitch was found (silence, breath, consonants). The dashed line is the median pitch. Values are
              estimates, and this chart does not show whether the notes were "right".
            </p>
            <div className="grid cols-4" style={{ marginTop: 14 }}>
              <Stat label="Median pitch" value={fmt(pitch.median_hz, 1, " Hz")} hint={`≈ ${pitch.median_note ?? "—"}`} />
              <Stat label="Detected range (5th–95th pct.)" value={`${pitch.range_low_note ?? "—"} – ${pitch.range_high_note ?? "—"}`} hint={`${fmt(pitch.range_low_hz, 0)}–${fmt(pitch.range_high_hz, 0)} Hz in this recording`} />
              <Stat label="Voiced audio" value={pct(pitch.voiced_ratio)} hint={`${pitch.voiced_seconds.toFixed(1)} s of usable pitch`} />
              <Stat label="Pitch variation" value={fmt(pitch.variation_std_cents, 0, " cents")} hint={`IQR ${fmt(pitch.variation_iqr_cents, 0)} cents`} />
            </div>
            <p className="explain">
              <strong>Pitch variation</strong> is the spread (standard deviation) of the voiced pitch around its median, in cents (100 cents = one semitone).
              A steady held note gives a small value; melodies with many different notes, vibrato or slides give larger ones. More variation is not a
              mistake. This is not an accuracy score, because MuseLab has no target melody to compare against. The detected range describes only this
              recording, not your absolute vocal range.
            </p>
          </>
        ) : (
          <div className="banner info">{pitch.reason ?? "Pitch could not be estimated for this recording."}</div>
        )}
      </section>

      <section className="card" aria-label="Audio energy">
        <h2>Energy (RMS) over time</h2>
        <TimeLine times={energy.times} values={energy.rms} unit="RMS" label="RMS energy" color="#a78bfa" digits={3} />
        <div className="grid cols-3" style={{ marginTop: 14 }}>
          <Stat label="Mean RMS" value={fmt(energy.mean_rms, 3)} hint={`${fmt(energy.mean_dbfs, 1)} dBFS`} />
          <Stat label="Max RMS" value={fmt(energy.max_rms, 3)} />
          <Stat label="Peak amplitude" value={fmt(energy.peak_amplitude, 3)} hint="1.0 = digital full scale" />
        </div>
        <p className="explain">RMS is a measured signal amplitude. It is not the same as perceived loudness, which also depends on pitch, timbre and playback volume.</p>
      </section>

      <section className="card" aria-label="Waveform">
        <h2>Waveform</h2>
        <WaveformCanvas waveform={waveform} />
      </section>

      <section className="grid cols-2">
        <div className="card" aria-label="Tempo">
          <h2>Tempo estimate</h2>
          {tempo.available ? (
            <>
              <div className="stat">
                <div className="value">{fmt(tempo.bpm, 0, " BPM")}</div>
                <div className="hint">confidence: {tempo.confidence}</div>
              </div>
              <p className="explain">Estimated from rhythmic onsets. Tempo detection on unaccompanied vocals can be unreliable, so treat this as a rough guide.</p>
            </>
          ) : (
            <>
              <div className="banner info">No tempo shown: {tempo.reason}</div>
              <p className="explain">MuseLab reports "unavailable" rather than guessing a BPM.</p>
            </>
          )}
        </div>
        <div className="card" aria-label="Spectral centroid">
          <h2>Spectral centroid</h2>
          <div className="stat">
            <div className="value">{fmt(spectral.mean_centroid_hz, 0, " Hz")}</div>
            <div className="hint">mean over active frames</div>
          </div>
          <p className="explain">The "centre of mass" of the sound's spectrum. Higher values usually sound brighter. It describes tone colour, not quality.</p>
        </div>
      </section>

      <section className="grid cols-2">
        <div className="card">
          <h2>Centroid over time</h2>
          <TimeLine times={spectral.centroid_times} values={spectral.centroid_hz} unit="Hz" label="Spectral centroid" height={200} digits={0} />
        </div>
        <div className="card">
          <h2>Chroma (pitch classes)</h2>
          <ChromaBars labels={spectral.chroma_labels} values={spectral.chroma_mean} />
          <p className="explain">
            Average strength of the 12 note names (octaves merged){spectral.dominant_pitch_class ? `; strongest here: ${spectral.dominant_pitch_class}` : ""}. It shows which
            notes were prominent, not which notes were intended.
          </p>
        </div>
      </section>

      {spectrogram && (
        <section className="card" aria-label="Spectrogram">
          <h2>Spectrogram</h2>
          <SpectrogramCanvas spec={spectrogram} />
          <p className="explain">Brighter colours mean more energy at that frequency and time (decibels relative to the loudest point, 80 dB range).</p>
        </section>
      )}

      <section className="card" aria-label="Limitations">
        <h2>About these results</h2>
        <ul className="clean muted">
          {result.limitations.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
