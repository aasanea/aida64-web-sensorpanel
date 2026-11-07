"""
Riyadh Weather & Prayer Times Service.
Fetches:
1. Riyadh Live Weather from Open-Meteo (Zero-key, accurate, fast).
2. Riyadh Prayer Times from Aladhan API (Umm Al-Qura method=4).
3. Maintains local file cache for offline/resilience.
4. Calculates Next & Previous prayers with seconds remaining and elapsed.
"""

import os
import json
import time
import asyncio
from datetime import datetime, timedelta, timezone
from services.telemetry_contract import source_meta
RIYADH_TZ = timezone(timedelta(hours=3))
from typing import Dict, Any, Optional
import httpx
from loguru import logger

from utils.time_utils import format_12h

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
CACHE_FILE = os.path.join(CACHE_DIR, "riyadh_cache.json")

# Riyadh Coordinates
RIYADH_LAT = 24.7136
RIYADH_LON = 46.6753

WMO_WEATHER_CODES = {
    0: ("مشمس", "صافي", "☀️", "🌙"),
    1: ("صافي غالباً", "صافي غالباً", "🌤️", "🌤️"),
    2: ("غائم جزئياً", "غائم جزئياً", "⛅", "⛅"),
    3: ("غائم", "غائم", "☁️", "☁️"),
    45: ("ضباب", "ضباب", "🌫️", "🌫️"),
    48: ("ضباب صقيعي", "ضباب صقيعي", "🌫️", "🌫️"),
    51: ("رذاذ خفيف", "رذاذ خفيف", "🌦️", "🌦️"),
    53: ("رذاذ معتدل", "رذاذ معتدل", "🌦️", "🌦️"),
    55: ("رذاذ كثيف", "رذاذ كثيف", "🌧️", "🌧️"),
    61: ("أمطار خفيفة", "أمطار خفيفة", "🌧️", "🌧️"),
    63: ("أمطار معتدلة", "أمطار معتدلة", "🌧️", "🌧️"),
    65: ("أمطار غزيرة", "أمطار غزيرة", "⛈️", "⛈️"),
    80: ("زخات مطر", "زخات مطر", "🌦️", "🌦️"),
    81: ("زخات مطر معتدلة", "زخات مطر معتدلة", "🌧️", "🌧️"),
    82: ("زخات مطر عنيفة", "زخات مطر عنيفة", "⛈️", "⛈️"),
    95: ("عواصف رعدية", "عواصف رعدية", "⛈️", "⛈️"),
    96: ("عواصف رعدية مع بَرَد", "عواصف رعدية مع بَرَد", "⛈️", "⛈️"),
    99: ("عواصف رعدية شديدة", "عواصف رعدية شديدة", "⛈️", "⛈️"),
}


class WeatherService:
    _instance: Optional["WeatherService"] = None

    def __init__(self):
        self._data: Dict[str, Any] = {
            "riyadh_temp": None,
            "riyadh_weather_desc": None,
            "riyadh_weather_icon": "☀️",
            "prayer_fajr": None,
            "prayer_sunrise": None,
            "prayer_dhuhr": None,
            "prayer_asr": None,
            "prayer_maghrib": None,
            "prayer_isha": None,
            "next_prayer_name": None,
            "next_prayer_time": None,
            "next_prayer_seconds": None,
            "prev_prayer_name": None,
            "prev_prayer_time": None,
            "prev_prayer_seconds": None,
        }
        self._raw_timings: Dict[str, str] = {}
        self._schedule = {}
        self._weather_cached = False
        self._last_weather_fetch: float = 0.0
        self._last_prayer_fetch: float = 0.0
        self._last_prayer_attempt = 0.0
        self._running: bool = False
        self._task: Optional[asyncio.Task] = None
        self._load_cache()

    @classmethod
    def get_instance(cls) -> "WeatherService":
        if cls._instance is None:
            cls._instance = WeatherService()
        return cls._instance

    def _load_cache(self):
        """Load previously cached data if available."""
        try:
            if os.path.exists(CACHE_FILE):
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    cached = json.load(f)
                    self._data.update(cached.get("data", {}))
                    self._last_weather_fetch = cached.get("weather_observed_at", cached.get("timestamp", 0))
                    self._weather_cached = True
                    self._schedule = cached.get("schedule", {})
                    for item in self._schedule.values():
                        item["cached"] = True
                    self._calculate_prayer_intervals()
                    logger.info("Loaded Riyadh data from cache")
        except Exception as e:
            logger.warning(f"Failed to load Riyadh cache: {e}")

    def _save_cache(self):
        """Persist current snapshot to local file."""
        try:
            os.makedirs(CACHE_DIR, exist_ok=True)
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump({
                    "timestamp": time.time(),
                    "data": self._data,
                    "raw_timings": self._raw_timings,
                    "weather_observed_at": self._last_weather_fetch,
                    "schedule": self._schedule
                }, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save Riyadh cache: {e}")

    async def fetch_weather(self):
        """Fetch current weather for Riyadh from Open-Meteo."""
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={RIYADH_LAT}&longitude={RIYADH_LON}&"
            f"current=temperature_2m,relative_humidity_2m,weather_code,apparent_temperature,is_day&"
            f"timezone=Asia%2FRiyadh"
        )
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json().get("current", {})
                    temp = data.get("temperature_2m")
                    wcode = data.get("weather_code")
                    is_day = bool(data.get("is_day", 1))

                    code_info = WMO_WEATHER_CODES.get(wcode, (None, None, None, None))
                    desc = code_info[0] if is_day else code_info[1]
                    icon = code_info[2] if is_day else code_info[3]

                    self._data["riyadh_temp"] = round(float(temp), 1) if temp is not None else None
                    self._data["riyadh_weather_desc"] = desc
                    self._data["riyadh_weather_icon"] = icon
                    self._last_weather_fetch = time.time()
                    self._weather_cached = False
                    self._save_cache()
                    logger.debug(f"Riyadh Weather updated: {self._data['riyadh_temp']}°C, {desc}")
        except Exception as e:
            self._weather_cached = True
            logger.warning(f"Error fetching Riyadh weather: {e}")

    async def fetch_prayer_times(self):
        today = datetime.now(RIYADH_TZ).date()
        self._last_prayer_attempt = time.time()
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            for shift in (-1, 0, 1):
                day = today + timedelta(days=shift)
                key = day.isoformat()
                try:
                    response = await client.get(f"https://api.aladhan.com/v1/timingsByCity/{day.strftime('%d-%m-%Y')}?city=Riyadh&country=Saudi%20Arabia&method=4&timezonestring=Asia%2FRiyadh")
                    response.raise_for_status()
                    payload = response.json().get("data", {})
                    if payload.get("date", {}).get("gregorian", {}).get("date") != day.strftime('%d-%m-%Y'):
                        raise ValueError("Prayer response date does not match request")
                    timings = payload.get("timings", {})
                    for name in ("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"):
                        datetime.strptime(timings[name][:5], "%H:%M")
                    self._schedule[key] = {"timings": timings, "observed_at": time.time(), "cached": False}
                except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
                    if key in self._schedule:
                        self._schedule[key]["cached"] = True
                    logger.debug(f"Prayer schedule {key}: {error}")
        self._schedule = {key: item for key, item in self._schedule.items() if abs((datetime.fromisoformat(key).date()-today).days) <= 1}
        if today.isoformat() in self._schedule and not self._schedule[today.isoformat()].get("cached"):
            self._last_prayer_fetch = time.time()
        self._calculate_prayer_intervals()
        self._save_cache()

    def _calculate_prayer_intervals(self, now=None):
        now = now or datetime.now(RIYADH_TZ)
        if now.tzinfo is None:
            now = now.replace(tzinfo=RIYADH_TZ)
        today = now.date().isoformat()
        for key in self._data:
            if key.startswith(("prayer_", "next_prayer_", "prev_prayer_")):
                self._data[key] = None
        current = self._schedule.get(today)
        self._raw_timings = current.get("timings", {}) if current else {}
        if not current:
            return
        for name in ("Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"):
            raw = self._raw_timings.get(name)
            self._data[f"prayer_{name.lower()}"] = format_12h(raw[:5], with_period=False) if raw else None
        events = []
        for date, item in self._schedule.items():
            for arabic, name in (("الفجر", "Fajr"), ("الظهر", "Dhuhr"), ("العصر", "Asr"), ("المغرب", "Maghrib"), ("العشاء", "Isha")):
                raw = item.get("timings", {}).get(name)
                if raw:
                    try:
                        at = datetime.fromisoformat(date + "T" + raw[:5]).replace(tzinfo=RIYADH_TZ)
                        events.append((at, arabic, raw[:5]))
                    except ValueError:
                        continue
        upcoming = sorted((event for event in events if event[0] > now), key=lambda event: event[0])
        previous = sorted((event for event in events if event[0] <= now), key=lambda event: event[0])
        for prefix, event in (("next", upcoming[0] if upcoming else None), ("prev", previous[-1] if previous else None)):
            if event:
                self._data[f"{prefix}_prayer_name"] = event[1]
                self._data[f"{prefix}_prayer_time"] = format_12h(event[2], with_period=False)
                self._data[f"{prefix}_prayer_seconds"] = int(abs((event[0]-now).total_seconds()))

    def get_snapshot(self):
        self._calculate_prayer_intervals()
        result = dict(self._data)
        weather = source_meta("Open-Meteo / Riyadh", self._last_weather_fetch, 3600, cached=self._weather_cached)
        if weather["status"] in ("stale", "unavailable"):
            for key in ("riyadh_temp", "riyadh_weather_desc", "riyadh_weather_icon"):
                result[key] = None
        today = datetime.now(RIYADH_TZ).date().isoformat()
        schedule = self._schedule.get(today, {})
        result["weather_source"] = weather
        result["prayer_source"] = source_meta("Aladhan / Umm Al-Qura / Riyadh", schedule.get("observed_at"), 86400, cached=schedule.get("cached", False), available=bool(schedule))
        if result["prayer_source"]["status"] in ("stale", "unavailable"):
            for key in result:
                if key.startswith(("prayer_", "next_prayer_", "prev_prayer_")) and not key.endswith("source"):
                    result[key] = None
        result["prayer_date"] = today if schedule else None
        return result

    async def start(self):
        """Start background loop for periodic fetching."""
        if self._running:
            return
        self._running = True
        logger.info("Starting Weather Service background loop...")

        async def _loop():
            # Initial background fetch without blocking FastAPI startup
            try:
                now = time.time()
                if now - self._last_weather_fetch > 1800 or self._data["riyadh_temp"] is None:
                    await self.fetch_weather()
                if now - self._last_prayer_fetch > 43200 or datetime.now(RIYADH_TZ).date().isoformat() not in self._schedule:
                    await self.fetch_prayer_times()
            except Exception as e:
                logger.warning(f"Weather Service initial background fetch warning: {e}")

            while self._running:
                try:
                    cur_time = time.time()
                    # Weather: fetch every 15 minutes (900 seconds)
                    if cur_time - self._last_weather_fetch >= 900:
                        await self.fetch_weather()

                    # Prayer times: fetch every 12 hours (43200 seconds)
                    if cur_time - self._last_prayer_attempt >= 60 and (cur_time - self._last_prayer_fetch >= 43200 or datetime.now(RIYADH_TZ).date().isoformat() not in self._schedule):
                        await self.fetch_prayer_times()

                    # Recompute intervals every 1 second
                    self._calculate_prayer_intervals()
                except Exception as e:
                    logger.warning(f"Weather Service loop error: {e}")

                await asyncio.sleep(1.0)

        self._task = asyncio.create_task(_loop())

    async def stop(self):
        """Stop the background loop."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Weather Service stopped.")
