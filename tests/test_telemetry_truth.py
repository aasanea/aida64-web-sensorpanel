"""Source failures, real zeroes, mode switching and dated clocks. No real settings mutated."""
import sys
import time
import socket
from pathlib import Path
from types import SimpleNamespace
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from services.sonar_service import SonarService
from services.network_service import NetworkService
from services.weather_service import WeatherService, RIYADH_TZ
from services.appointments_service import AppointmentsService
from services.telemetry_contract import source_meta
from services import aida_service


def response(payload, url="http://localhost/test", status=200):
    return httpx.Response(status, json=payload, request=httpx.Request("GET", url))


@pytest.mark.asyncio
async def test_sonar_stream_classic_switch_failure_and_recovery():
    service = SonarService()
    service._sonar_base_url = "http://localhost"
    stream = {"masters": {"stream": {"monitoring": {"volume": 0, "muted": True}, "streaming": {"volume": 1, "muted": False}}}, "devices": {"media": {"stream": {"monitoring": {"volume": .12, "muted": False}, "streaming": {"volume": .3, "muted": True}}}}}
    client = AsyncMock()
    client.get.side_effect = [response("stream"), response(stream)]
    assert await service._fetch_volume_settings(client)
    data = service.get_snapshot()
    assert data["audio_master_volume"] == 0
    assert data["audio_master_muted"] is True
    assert data["sonar_channels"]["media"]["streaming"] == {"volume": 30, "muted": True}
    assert data["audio_game_volume"] is None  # Missing is not full volume.
    assert client.get.call_args_list[-1].args[0].endswith("/volumeSettings/streamer")

    service._mode_checked_at = 0
    client.get.side_effect = [response("classic"), response({"masters": {"classic": {"volume": .8, "muted": False}}})]
    assert await service._fetch_volume_settings(client)
    assert service.get_snapshot()["sonar_mode"] == "classic"
    assert "streaming" not in service.get_snapshot()["sonar_channels"]["master"]
    client.get.side_effect = httpx.ConnectError("offline")
    assert not await service._fetch_volume_settings(client)
    assert service.get_snapshot()["audio_master_volume"] is None
    assert service.get_snapshot()["sonar_channels"] is None
    service._sonar_base_url = "http://localhost"
    client.get.side_effect = [response("stream"), response(stream)]
    assert await service._fetch_volume_settings(client)
    assert service.get_snapshot()["audio_master_volume"] == 0


@pytest.mark.parametrize("volume", [float("nan"), float("inf"), -1, 2, True, "0.5", None])
def test_sonar_rejects_invalid_values(volume):
    assert SonarService._channel({"volume": volume, "muted": "false"}) == {"volume": None, "muted": None}


def test_expired_sonar_clears_channels():
    service = SonarService()
    service._data.update(sonar_connected=True, audio_master_volume=80)
    service._observed_at = time.time() - 3
    assert service.get_snapshot()["audio_master_volume"] is None


def test_hardware_mapping_keeps_zero_and_does_not_fabricate_power_pump_or_fps():
    sensors = {key: {"value": str(value), "label": key} for key, value in {"SRTSSFPS": 0, "SAIDAFPS": 240, "SVREFRATE": 240, "PCPUPKG": 20, "FCHA4": 1500, "SCPU1UTI": 0, "SCPU3UTI": 10}.items()}
    inventory = SimpleNamespace(topology={1: "P", 3: "E"}, get_snapshot=lambda: None, metadata=lambda: source_meta("Windows", None, 180))
    with patch.object(aida_service, "read_aida_sensors", return_value=sensors), patch.object(aida_service.InventoryService, "get_instance", return_value=inventory):
        data = aida_service.get_sensor_data()
    assert data.fps == 240 and data.display_hz == 240
    assert data.total_power is None and data.cpu_gpu_power is None
    assert data.pump_rpm is None
    assert [core["id"] for core in data.cpu_cores] == [1, 3]
    assert data.cpu_cores[0]["load"] == 0
    assert data.cpu_cores[1]["type"] == "E"
    sensors["PGPU1"] = {"value": "0"}
    sensors.pop("SRTSSFPS")
    sensors.pop("SAIDAFPS")
    sensors.pop("SVREFRATE")
    with patch.object(aida_service, "read_aida_sensors", return_value=sensors), patch.object(aida_service.InventoryService, "get_instance", return_value=inventory):
        data = aida_service.get_sensor_data()
    assert data.cpu_gpu_power == 20 and data.fps is None


def test_nvme_requires_identity_match_and_partial_storage_declares_scope():
    inventory = SimpleNamespace(topology={}, get_snapshot=lambda: {"disks": [{"FriendlyName": "Real NVMe", "BusType": "NVMe"}]}, metadata=lambda: {})
    sensors = {"THDD1": {"label": "SATA disk", "value": "70"}, "THDD2": {"label": "Real NVMe", "value": "0"}, "SDRVCFREESPC": {"value": "25"}}
    with patch.object(aida_service, "read_aida_sensors", return_value=sensors), patch.object(aida_service.InventoryService, "get_instance", return_value=inventory):
        data = aida_service.get_sensor_data()
    assert data.nvme_temp == 0 and data.nvme_sensor_name == "Real NVMe"
    assert data.storage_total_scope == "C فقط" and data.storage_total_free_gb == 25


def test_network_connections_do_not_read_process_disk_io():
    process = MagicMock()
    process.name.return_value = "chrome.exe"
    connection = SimpleNamespace(status="ESTABLISHED", pid=1, raddr=SimpleNamespace(ip="8.8.8.8"))
    with patch("services.network_service.psutil.net_connections", return_value=[connection]), patch("services.network_service.psutil.Process", return_value=process):
        apps, count = NetworkService()._sample_processes()
    assert count == 1 and apps[0]["connections"] == 1
    assert apps[0]["dl_kbps"] is None and apps[0]["ul_kbps"] is None
    process.io_counters.assert_not_called()


def test_nic_rates_speed_ip_share_one_interface_and_handle_reset():
    service = NetworkService()
    route = MagicMock()
    route.__enter__.return_value = route
    route.getsockname.return_value = ("192.168.1.10", 123)
    addresses = {"Ethernet": [SimpleNamespace(family=socket.AF_INET, address="192.168.1.10")], "VPN": [SimpleNamespace(family=socket.AF_INET, address="10.1.1.1")]}
    counters = {"Ethernet": SimpleNamespace(bytes_recv=100, bytes_sent=100), "VPN": SimpleNamespace(bytes_recv=999999, bytes_sent=999999)}
    with patch("services.network_service.socket.socket", return_value=route), patch("services.network_service.psutil.net_if_addrs", return_value=addresses), patch("services.network_service.psutil.net_if_stats", return_value={"Ethernet": SimpleNamespace(isup=True, speed=1000)}), patch("services.network_service.psutil.net_io_counters", return_value=counters), patch("services.network_service.time.perf_counter", side_effect=[1, 2, 3]):
        first = service._extract_nic_metadata()
        assert first["download_mbps"] is None
        counters["Ethernet"] = SimpleNamespace(bytes_recv=125100, bytes_sent=100)
        second = service._extract_nic_metadata()
        assert second["download_mbps"] == 1 and second["upload_mbps"] == 0
        assert second["interface"] == "Ethernet" and second["link_speed"] == 1000
        counters["Ethernet"] = SimpleNamespace(bytes_recv=0, bytes_sent=0)
        assert service._extract_nic_metadata()["download_mbps"] is None


def test_expired_network_drops_held_readings():
    service = NetworkService()
    service._observed_at = time.time() - 6
    service._snapshot["network_ping_ms"] = 20
    assert service.get_snapshot()["network_ping_ms"] is None


def weather():
    with patch.object(WeatherService, "_load_cache"):
        return WeatherService()


def schedule(fajr):
    return {"timings": {"Fajr": fajr, "Dhuhr": "12:00", "Asr": "15:30", "Maghrib": "18:00", "Isha": "19:30"}, "observed_at": time.time(), "cached": False}


def test_prayer_after_isha_uses_tomorrow_and_clears_without_it():
    service = weather()
    service._schedule = {"2026-10-06": schedule("04:50"), "2026-10-07": schedule("04:51")}
    now = datetime(2026, 10, 6, 23, 59, tzinfo=RIYADH_TZ)
    service._calculate_prayer_intervals(now)
    assert service._data["next_prayer_seconds"] == 17520
    assert service._data["next_prayer_time"] == "4:51"
    del service._schedule["2026-10-07"]
    service._calculate_prayer_intervals(now)
    assert service._data["next_prayer_seconds"] is None
    service._calculate_prayer_intervals(now + timedelta(minutes=2))
    assert service._data["prayer_fajr"] is None


def test_prayer_missing_schedule_has_no_fixed_fallback():
    service = weather()
    service._calculate_prayer_intervals()
    assert service._data["prayer_fajr"] is None
    assert service._data["next_prayer_name"] is None
    assert service.get_snapshot()["prayer_source"]["status"] == "unavailable"


def test_expired_prayer_schedule_preserves_failure_metadata():
    service = weather()
    today = datetime.now(RIYADH_TZ).date().isoformat()
    service._schedule[today] = schedule("04:50")
    service._schedule[today]["observed_at"] = time.time() - 90000
    data = service.get_snapshot()
    assert data["prayer_fajr"] is None
    assert data["prayer_source"]["status"] == "stale"


def test_sports_has_no_assumed_broadcaster_or_clock_or_future_completed_match():
    from services.matches_service import MatchesService
    service = MatchesService.__new__(MatchesService)
    game = {"id": 1, "homeCompetitor": {"id": 1, "name": "A", "score": 0}, "awayCompetitor": {"id": 2, "name": "B", "score": 0}, "competitionId": 649, "statusText": "بعد ركلات الترجيح", "startTime": "2026-10-06T15:00:00Z"}
    parsed = service._parse_game(game)
    assert parsed["is_ended"] and not parsed["is_live"]
    assert parsed["channel"] is None
    game.update(statusText="مباشر", gameTimeStatus=1)
    parsed = service._parse_game(game)
    assert parsed["live_minute"] == ""
    game["tvNetworks"] = [{"name": "API channel"}]
    assert service._parse_game(game)["channel"] == "API channel"


def test_appointment_recurrence_invalid_time_and_exact_elapsed():
    service = AppointmentsService.__new__(AppointmentsService)
    service._appointments = [{"title": "Today", "time": "12:00", "days": ["tuesday"]}, {"title": "Other day", "time": "12:00", "days": ["monday"]}, {"title": "Invalid", "time": "25:00", "days": ["all"]}]
    now = datetime(2026, 10, 6, 12, 22, tzinfo=RIYADH_TZ)
    data = service.get_summary(now)
    assert data["appointments_count"] == 1
    assert data["next_appointment_ongoing"]
    assert data["today_appointments"][0]["seconds_until"] == -1320
    assert data["next_appointment_time"] == "12:00 م"
    assert service.get_summary(now + timedelta(minutes=24))["appointments_remaining"] == 0


def test_source_cached_and_stale_are_distinct():
    assert source_meta("API", time.time(), 10, cached=True)["status"] == "cached"
    assert source_meta("API", time.time()-20, 10, cached=True)["status"] == "stale"
    assert source_meta("API", None, 10)["status"] == "unavailable"


def test_partial_sports_failure_cannot_mask_expired_data():
    from services.matches_service import MatchesService
    service = MatchesService.__new__(MatchesService)
    service._matches = service._saudi_matches = service._upcoming_matches = []
    service._saudi_round_info = {}
    service._matches_partial = True
    service._last_matches_update = (datetime.now() - timedelta(minutes=10)).isoformat()
    assert service.get_today_matches()["source_meta"]["status"] == "stale"
    service._last_matches_update = datetime.now().isoformat()
    assert service.get_today_matches()["source_meta"]["status"] == "cached"
