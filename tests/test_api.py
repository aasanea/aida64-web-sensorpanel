"""
API Unit tests for AIDA64 Dashboard FastAPI Server.
Verifies /health, /api/sensors, and WebSocket /ws.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from main import app
    return TestClient(app)


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "healthy"
    assert "timestamp" in data
    assert "sensors_detected" in data


def test_sensors_endpoint(client):
    response = client.get("/api/sensors")
    assert response.status_code == 200
    data = response.json()
    
    required_24_fields = [
        "cpu_temp", "cpu_load", "cpu_clock", "cpu_power", "cpu_fan_rpm", "cpu_hotspot_temp",
        "gpu_temp", "gpu_load", "gpu_clock", "gpu_power", "gpu_fan_rpm", "gpu_hotspot_temp",
        "ram_used_percent", "ram_used_gb", "ram_total_gb",
        "vram_used_percent", "vram_used_gb", "vram_total_gb",
        "motherboard_temp", "vrm_temp", "pch_temp", "nvme_temp",
        "network_download_mbps", "network_upload_mbps"
    ]
    
    for key in required_24_fields:
        assert key in data, f"Missing key '{key}' in /api/sensors response"
        val = data[key]
        if val is not None:
            assert isinstance(val, (int, float)), f"Key '{key}' value {val} must be numeric or null"


def test_websocket_stream(client):
    with client.websocket_connect("/ws") as websocket:
        # Receive first live payload
        data = websocket.receive_json()
        assert "cpu_temp" in data or "gpu_temp" in data or "ram_used_percent" in data
        
        # Test ping-pong heartbeat
        websocket.send_text("ping")
        resp = websocket.receive_text()
        assert resp == "pong"


if __name__ == "__main__":
    pytest.main(["-v", __file__])
