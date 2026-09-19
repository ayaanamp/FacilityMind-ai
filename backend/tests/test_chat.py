from backend.app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_gemini_chat_endpoint_simple_query():
    payload = {
        "message": "What is the recommended fix for a leaking air conditioner?",
        "history": []
    }
    response = client.post("/api/v1/chat/gemini", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert len(data["reply"]) > 0
    assert "source" in data
    assert "grounded_context" in data

def test_gemini_chat_endpoint_draft_complaint():
    payload = {
        "message": "Please draft a complaint: projector in Room 204 has blinking red light and shut down",
        "history": []
    }
    response = client.post("/api/v1/chat/gemini", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert "complaint_draft" in data
