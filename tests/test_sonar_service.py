"""
Unit tests for SteelSeries GG Sonar Audio Service.
Tests discovery, parsing of volumeSettings, error resilience, and model contracts.
"""

import sys
import os
import json
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from services.sonar_service import SonarService
from models.hardware import HardwareMetrics
from models.payload import SensorData


@pytest.mark.asyncio
async def test_sonar_service_snapshot_defaults():
    service = SonarService()
    snap = service.get_snapshot()
    assert snap["sonar_connected"] is False
    assert snap["audio_mic_muted"] is None
    assert snap["audio_mic_volume"] is None
    assert snap["audio_master_volume"] is None


@pytest.mark.asyncio
async def test_sonar_fetch_volume_settings_success():
    service = SonarService()
    service._sonar_base_url = "http://127.0.0.1:61723"

    mock_json = {
        "masters": {
            "classic": {"volume": 0.75, "muted": False}
        },
        "devices": {
            "game": {"classic": {"volume": 0.80, "muted": False}},
            "chatRender": {"classic": {"volume": 0.90, "muted": False}},
            "chatCapture": {"classic": {"volume": 1.0, "muted": True}},
            "media": {"classic": {"volume": 0.50, "muted": False}},
            "aux": {"classic": {"volume": 0.40, "muted": True}},
        }
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_json

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp

    success = await service._fetch_volume_settings(mock_client)
    assert success is True

    snap = service.get_snapshot()
    assert snap["sonar_connected"] is True
    assert snap["audio_master_volume"] == 75.0
    assert snap["audio_master_muted"] is False
    assert snap["audio_mic_muted"] is True
    assert snap["audio_mic_volume"] == 100.0
    assert snap["audio_game_volume"] == 80.0
    assert snap["audio_game_muted"] is False
    assert snap["audio_chat_volume"] == 90.0
    assert snap["audio_media_volume"] == 50.0
    assert snap["audio_aux_volume"] == 40.0
    assert snap["audio_aux_muted"] is True


@pytest.mark.asyncio
async def test_sonar_fetch_volume_settings_offline():
    service = SonarService()
    service._sonar_base_url = "http://127.0.0.1:61723"

    mock_client = AsyncMock()
    mock_client.get.side_effect = Exception("Connection refused")

    success = await service._fetch_volume_settings(mock_client)
    assert success is False
    assert service._sonar_base_url is None
    snap = service.get_snapshot()
    assert snap["sonar_connected"] is False


def test_hardware_metrics_includes_sonar_fields():
    data = HardwareMetrics(
        sonar_connected=True,
        audio_mic_muted=False,
        audio_mic_volume=100.0,
        audio_master_volume=70.0,
        audio_game_volume=85.0
    )
    dump = data.model_dump()
    assert dump["sonar_connected"] is True
    assert dump["audio_mic_muted"] is False
    assert dump["audio_mic_volume"] == 100.0
    assert dump["audio_master_volume"] == 70.0
    assert dump["audio_game_volume"] == 85.0
