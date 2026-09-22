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
