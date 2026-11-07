"""
Unit and integration tests for Appointments Service and REST APIs.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from main import app
from services.appointments_service import AppointmentsService
from utils.time_utils import format_12h


@pytest.fixture
def client():
    return TestClient(app)


def test_format_12h_helper():
    assert "9:30 ص" in format_12h("09:30", with_period=True)
    assert "1:00 م" in format_12h("13:00", with_period=True)
    assert "11:45 م" in format_12h("23:45", with_period=True)
    assert "12:00 ص" in format_12h("00:00", with_period=True)
    assert "12:15 م" in format_12h("12:15", with_period=True)


def test_appointments_service_get_today():
    service = AppointmentsService.get_instance()
    items = service.get_today_appointments()
    assert isinstance(items, list)
    assert len(items) >= 1
    first = items[0]
    assert "id" in first
    assert "title" in first
    assert "time" in first
    assert "time_12h" in first
    assert "status" in first
    assert first["status"] in ("upcoming", "ongoing", "completed")


def test_appointments_summary():
    service = AppointmentsService.get_instance()
    summary = service.get_summary()
    assert "appointments_count" in summary
    assert "appointments_remaining" in summary
    assert "today_appointments" in summary
    assert summary["appointments_count"] >= 1


def test_api_get_appointments(client):
    response = client.get("/api/appointments")
    assert response.status_code == 200
    data = response.json()
    assert "appointments_count" in data
    assert "today_appointments" in data
    assert isinstance(data["today_appointments"], list)


def test_api_add_and_delete_appointment(client):
    # Add new appointment
    new_payload = {
        "title": "موعد اختبار مؤقت للوحدة",
        "time": "23:59",
        "category": "personal",
        "category_label": "شخصي",
        "location": "غرفة الاختبار",
    }
    create_resp = client.post("/api/appointments", json=new_payload)
    assert create_resp.status_code == 200
    created_data = create_resp.json()
    assert created_data["status"] == "created"
    new_id = created_data["appointment"]["id"]
    assert new_id is not None

    # Delete the created appointment
    del_resp = client.delete(f"/api/appointments/{new_id}")
    assert del_resp.status_code == 200
    del_data = del_resp.json()
    assert del_data["status"] == "deleted"

def test_api_add_appointment_with_specific_date(client):
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone(timedelta(hours=3)))
    today_str = now.strftime("%Y-%m-%d")
    future_str = "2099-12-31"

    # 1. Add appointment for today
    payload_today = {
        "title": "موعد مؤرخ لليوم",
        "time": "23:58",
        "date": today_str,
        "category": "work",
        "category_label": "عمل",
        "location": "الرياض",
    }
    resp1 = client.post("/api/appointments", json=payload_today)
    assert resp1.status_code == 200
    apt1_id = resp1.json()["appointment"]["id"]

    # 2. Add appointment for a future date
    payload_future = {
        "title": "موعد مستقبلي محدد",
        "time": "10:00",
        "date": future_str,
        "category": "health",
        "category_label": "صحة",
        "location": "المستشفى",
    }
    resp2 = client.post("/api/appointments", json=payload_future)
    assert resp2.status_code == 200
    apt2_id = resp2.json()["appointment"]["id"]

    # 3. Verify get_appointments
    get_resp = client.get("/api/appointments")
    assert get_resp.status_code == 200
    data = get_resp.json()
    today_ids = [a["id"] for a in data["today_appointments"]]
    all_ids = [a["id"] for a in data.get("all_appointments", [])]

    assert apt1_id in today_ids, "Today's dated appointment must appear in today_appointments"
    assert apt2_id not in today_ids, "Future dated appointment must NOT appear in today_appointments"
    assert apt1_id in all_ids, "Today's appointment must appear in all_appointments"
    assert apt2_id in all_ids, "Future appointment must appear in all_appointments"

    # Clean up
    client.delete(f"/api/appointments/{apt1_id}")
    client.delete(f"/api/appointments/{apt2_id}")

