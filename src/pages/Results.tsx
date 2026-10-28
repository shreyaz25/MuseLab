import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { ResultsView } from "../components/ResultsView";
import { Empty, ErrorBanner } from "../components/ui";
import { useCurrentAnalysis } from "../context/Backend";

export default function Results() {
  const { current } = useCurrentAnalysis();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (!current) {
    return (
      <Empty title="No analysis yet" action={<Link className="btn" to="/studio">Analyse a recording</Link>}>
        Upload a recording in the Studio to see results here.
      </Empty>
    );
  }
  const analysis = current;

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api.createSession({ title: title.trim() || analysis.overview.file_name, notes, analysis });
      const saved = await api.getSession(created.id); // confirm it was really stored
      navigate(`/history/${saved.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Analysis results</h1>
          <p className="muted">Measured by the Python backend. Not saved yet.</p>
        </div>
        <Link className="btn secondary" to="/studio">Analyse another</Link>
      </div>

      <form className="card stack" onSubmit={save}>
        <h2>Save to practice history</h2>
        <div className="grid cols-2">
          <div>
            <label htmlFor="title">Title</label>
            <input id="title" value={title} maxLength={200} placeholder={analysis.overview.file_name} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label htmlFor="notes">Notes (optional)</label>
            <textarea id="notes" value={notes} maxLength={5000} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <ErrorBanner error={error} />
        <div className="row">
          <button className="btn" disabled={saving}>{saving ? "Saving…" : "Save session"}</button>
          <span className="muted small">Only the results are stored, never the audio.</span>
        </div>
      </form>

      <ResultsView result={analysis} />
    </div>
  );
}
