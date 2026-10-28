import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { SessionDetail } from "../api/types";
import { ResultsView } from "../components/ResultsView";
import { Empty, ErrorBanner, Loading } from "../components/ui";
import { fmtDate } from "../lib/format";

export default function SessionPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    api
      .getSession(id)
      .then((s) => {
        setSession(s);
        setTitle(s.title);
        setNotes(s.notes);
      })
      .catch(setError);
  }, [id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(false);
    try {
      const updated = await api.updateSession(id, { title, notes });
      setSession((s) => (s ? { ...s, title: updated.title, notes: updated.notes } : s));
      setSavedMsg(true);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this session? This cannot be undone.")) return;
    try {
      await api.deleteSession(id);
      navigate("/history");
    } catch (err) {
      setError(err);
    }
  }

  if (error instanceof ApiError && error.status === 404)
    return (
      <Empty title="Session not found" action={<Link className="btn" to="/history">Back to history</Link>}>
        It may have been deleted.
      </Empty>
    );
  if (!session) return error ? <ErrorBanner error={error} /> : <Loading />;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{session.title}</h1>
          <p className="muted">Saved {fmtDate(session.created_at)}</p>
        </div>
        <div className="row">
          <Link className="btn secondary" to="/history">← History</Link>
          <button className="btn danger" onClick={remove}>Delete</button>
        </div>
      </div>
      <form className="card stack" onSubmit={save}>
        <div className="grid cols-2">
          <div><label htmlFor="t">Title</label><input id="t" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div><label htmlFor="n">Notes</label><textarea id="n" value={notes} maxLength={5000} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <ErrorBanner error={error} />
        <div className="row">
          <button className="btn" disabled={saving || !title.trim()}>{saving ? "Saving…" : "Save changes"}</button>
          {savedMsg && <span className="muted small" role="status">Saved.</span>}
        </div>
      </form>
      <ResultsView result={session.analysis} />
    </div>
  );
}
