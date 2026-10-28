import uuid


def _save(client, analysis, title="Morning warm-up", notes="felt good"):
    return client.post("/api/sessions", json={"title": title, "notes": notes, "analysis": analysis})


def test_save_retrieve_delete_session(client, analysis_payload):
    created = _save(client, analysis_payload)
    assert created.status_code == 201, created.text
    session_id = created.json()["id"]

    fetched = client.get(f"/api/sessions/{session_id}")
    assert fetched.status_code == 200
    body = fetched.json()
    assert body["title"] == "Morning warm-up"
    assert body["notes"] == "felt good"
    assert body["summary_metrics"]["median_note"] == "A3"
    assert body["analysis"]["analysis_id"] == analysis_payload["analysis_id"]

    deleted = client.delete(f"/api/sessions/{session_id}")
    assert deleted.status_code == 204
    assert client.get(f"/api/sessions/{session_id}").status_code == 404


def test_missing_session_errors(client):
    missing = uuid.uuid4().hex
    r = client.get(f"/api/sessions/{missing}")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "session_not_found"
    assert client.delete(f"/api/sessions/{missing}").status_code == 404
    assert client.patch(f"/api/sessions/{missing}", json={"title": "x"}).status_code == 404


def test_validation_errors(client, analysis_payload):
    assert client.post("/api/sessions", json={"title": "   ", "analysis": analysis_payload}).status_code == 422
    assert client.post("/api/sessions", json={"title": "ok"}).status_code == 422
    r = client.post("/api/sessions", json={"title": "ok", "analysis": {"bogus": True}})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_list_search_and_pagination(client, analysis_payload):
    for title in ["Scales", "Song practice", "Scales again"]:
        assert _save(client, analysis_payload, title=title).status_code == 201

    everything = client.get("/api/sessions").json()
    assert everything["total"] == 3

    scales = client.get("/api/sessions", params={"q": "scales"}).json()
    assert scales["total"] == 2

    page = client.get("/api/sessions", params={"limit": 1, "offset": 1}).json()
    assert len(page["items"]) == 1 and page["total"] == 3
    assert "analysis" not in page["items"][0]  # list responses stay small


def test_update_title_and_notes(client, analysis_payload):
    sid = _save(client, analysis_payload).json()["id"]
    r = client.patch(f"/api/sessions/{sid}", json={"title": "Renamed", "notes": "new notes"})
    assert r.status_code == 200
    assert r.json()["title"] == "Renamed"
    assert client.get(f"/api/sessions/{sid}").json()["notes"] == "new notes"


def test_stats_empty_and_with_data(client, analysis_payload):
    empty = client.get("/api/stats").json()
    assert empty["total_sessions"] == 0
    assert empty["latest"] is None
    assert len(empty["daily"]) == 30

    _save(client, analysis_payload)
    data = client.get("/api/stats", params={"tz_offset_minutes": 330}).json()
    assert data["total_sessions"] == 1
    assert data["total_seconds"] > 0
    assert data["latest"]["title"] == "Morning warm-up"
    assert data["consistency"]["active_days_last_30"] == 1
    assert data["metrics"][0]["pitch_reliable"] is True
