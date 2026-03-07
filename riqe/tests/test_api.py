"""
API Verification Test
────────────────────
Tests all RIQE API endpoints in-process (no server required).
Verifies: onboarding, signal processing, state, roadmap, history, metrics.
Uses in-memory DB when SUPABASE_URL/SUPABASE_KEY are not set.
"""

"""
Run from project root: python -m riqe.tests.test_api
Or: pytest riqe/tests/test_api.py -v
"""
from fastapi.testclient import TestClient

from riqe.api.api import app


def test_onboard(client: TestClient):
    """POST /onboard — create user state and initial roadmap."""
    resp = client.post(
        "/onboard",
        json={
            "user_id": "api_test_user",
            "resume_text": "MS in applied math, strong in probability and stats. Learning quant finance. Python and R.",
            "skill_scores": {"probability": 0.7, "statistics": 0.65, "python": 0.6},
            "interests": ["derivatives", "risk management", "ML for finance"],
            "field_of_study": "mathematics",
            "timeframe_weeks": 12,
            "learning_history": [],
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "state" in data
    assert "roadmap" in data
    assert data["state"]["user_id"] == "api_test_user"
    assert isinstance(data["state"]["user_vector"], list)
    assert len(data["state"]["user_vector"]) > 0
    assert data["roadmap"]["user_id"] == "api_test_user"
    assert "nodes" in data["roadmap"]
    assert len(data["roadmap"]["nodes"]) > 0
    for node in data["roadmap"]["nodes"]:
        assert "topic_id" in node
        assert "recommendation_score" in node
        assert "prerequisites" in node
    assert "quality_score" in data["roadmap"]
    return data["roadmap"]["roadmap_id"]


def test_signal(client: TestClient, roadmap_id: str):
    """POST /signal — process text and return updated roadmap."""
    resp = client.post(
        "/signal",
        json={
            "user_id": "api_test_user",
            "text": "Studied Ito's lemma today. For f(S,t) with GBM dS, df = (partial_t f + mu*S*partial_S f + 0.5*sigma^2*S^2*partial_SS f)dt + sigma*S*partial_S f dW. Essential for Black-Scholes derivation.",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["user_id"] == "api_test_user"
    assert len(data["nodes"]) > 0
    assert data["version"] >= 1
    return data


def test_get_state(client: TestClient):
    """GET /state/{user_id} — retrieve knowledge state."""
    resp = client.get("/state/api_test_user")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["user_id"] == "api_test_user"
    assert "user_vector" in data
    assert "completed_topics" in data
    assert "strong_signals" in data


def test_roadmap_history(client: TestClient, roadmap_id: str):
    """GET /roadmap/{roadmap_id}/history — roadmap versions."""
    resp = client.get(f"/roadmap/{roadmap_id}/history")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["roadmap_id"] == roadmap_id
    assert "versions" in data
    assert len(data["versions"]) >= 1


def test_metrics(client: TestClient):
    """GET /metrics/{user_id} — metrics snapshots."""
    resp = client.get("/metrics/api_test_user")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["user_id"] == "api_test_user"
    assert "metrics" in data


def test_signal_unknown_user(client: TestClient):
    """POST /signal with unknown user returns 404."""
    resp = client.post(
        "/signal",
        json={"user_id": "nonexistent_user_xyz", "text": "Some text."},
    )
    assert resp.status_code == 404


def test_state_unknown_user(client: TestClient):
    """GET /state for unknown user returns 404."""
    resp = client.get("/state/nonexistent_user_xyz")
    assert resp.status_code == 404


def run_all():
    print("API verification tests (in-memory pipeline)")
    print("-" * 50)
    with TestClient(app) as client:
        roadmap_id = test_onboard(client)
        print("  [OK] POST /onboard")
        test_signal(client, roadmap_id)
        print("  [OK] POST /signal")
        test_get_state(client)
        print("  [OK] GET /state/{user_id}")
        test_roadmap_history(client, roadmap_id)
        print("  [OK] GET /roadmap/{id}/history")
        test_metrics(client)
        print("  [OK] GET /metrics/{user_id}")
        test_signal_unknown_user(client)
        print("  [OK] POST /signal 404 for unknown user")
        test_state_unknown_user(client)
        print("  [OK] GET /state 404 for unknown user")
    print("-" * 50)
    print("All API tests passed.")


if __name__ == "__main__":
    run_all()
