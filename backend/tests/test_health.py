def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "muselab-backend"


def test_config_exposes_limits(client):
    r = client.get("/api/config")
    assert r.status_code == 200
    body = r.json()
    assert ".wav" in body["allowed_extensions"]
    assert body["max_upload_mb"] > 0
