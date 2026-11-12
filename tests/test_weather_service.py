"""Unit and integration tests for Riyadh Weather & Prayer Times Hybrid Engine."""

import pytest
from services.weather_service import WeatherService, WMO_WEATHER_CODES


def test_metar_parser_rain_variants():
    ws = WeatherService.get_instance()

    # Light rain
    light_rain = ws._parse_metar({"wxString": "-RA", "cover": "OVC", "temp": 18}, is_day=True)
    assert light_rain is not None
    assert light_rain["has_phenomenon"] is True
    assert light_rain["desc"] == "أمطار خفيفة"
    assert light_rain["icon"] == "🌧️"

    # Moderate rain
    mod_rain = ws._parse_metar({"wxString": "RA", "cover": "BKN", "temp": 17}, is_day=True)
    assert mod_rain is not None
    assert mod_rain["desc"] == "أمطار معتدلة"
    assert mod_rain["icon"] == "🌧️"

    # Heavy rain
    heavy_rain = ws._parse_metar({"wxString": "+RA", "cover": "OVC", "temp": 16}, is_day=True)
    assert heavy_rain is not None
    assert heavy_rain["desc"] == "أمطار غزيرة"
    assert heavy_rain["icon"] == "⛈️"

    # Thunderstorm
    ts = ws._parse_metar({"wxString": "TSRA", "cover": "BKN", "temp": 20}, is_day=False)
    assert ts is not None
    assert ts["desc"] == "عواصف رعدية ممطرة"
    assert ts["icon"] == "⛈️"


def test_metar_parser_cloud_cover():
    ws = WeatherService.get_instance()

    # Broken clouds
    bkn = ws._parse_metar({"wxString": None, "cover": "BKN", "temp": 17}, is_day=True)
    assert bkn is not None
    assert bkn["has_phenomenon"] is False
    assert bkn["desc"] == "غائم"
    assert bkn["icon"] == "☁️"

    # Overcast
    ovc = ws._parse_metar({"wxString": None, "cover": "OVC", "temp": 15}, is_day=False)
    assert ovc is not None
    assert ovc["desc"] == "غائم كلياً"
    assert ovc["icon"] == "☁️"

    # Scattered
    sct = ws._parse_metar({"wxString": None, "cover": "SCT", "temp": 22}, is_day=True)
    assert sct is not None
    assert sct["desc"] == "غائم جزئياً"
    assert sct["icon"] == "⛅"

    # Clear
    clr_day = ws._parse_metar({"wxString": None, "cover": "CAVOK", "temp": 28}, is_day=True)
    assert clr_day is not None
    assert clr_day["desc"] == "مشمس"
    assert clr_day["icon"] == "☀️"

    clr_night = ws._parse_metar({"wxString": None, "cover": "SKC", "temp": 19}, is_day=False)
    assert clr_night is not None
    assert clr_night["desc"] == "صافي"
    assert clr_night["icon"] == "🌙"


@pytest.mark.asyncio
async def test_live_weather_hybrid_fetch():
    ws = WeatherService.get_instance()
    await ws.fetch_weather()
    snap = ws.get_snapshot()

    assert snap["riyadh_temp"] is not None
    assert snap["riyadh_weather_desc"] is not None
    assert snap["riyadh_weather_icon"] is not None
    assert "Hybrid" in snap["weather_source"]["source"]
    assert snap["weather_source"]["status"] == "live"
