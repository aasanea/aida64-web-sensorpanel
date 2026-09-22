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
from datetime import datetime, timedelta
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
        self._last_weather_fetch: float = 0.0
        self._last_prayer_fetch: float = 0.0
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
                    self._raw_timings = cached.get("raw_timings", {})
                    for key in ["prayer_fajr", "prayer_sunrise", "prayer_dhuhr", "prayer_asr", "prayer_maghrib", "prayer_isha"]:
                        if key in self._data and self._data[key]:
                            self._data[key] = format_12h(self._data[key], with_period=False)
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
                    "raw_timings": self._raw_timings
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
                    wcode = data.get("weather_code", 0)
                    is_day = bool(data.get("is_day", 1))

                    code_info = WMO_WEATHER_CODES.get(wcode, ("معتدل", "معتدل", "☀️", "🌙"))
                    desc = code_info[0] if is_day else code_info[1]
                    icon = code_info[2] if is_day else code_info[3]

                    self._data["riyadh_temp"] = round(float(temp), 1) if temp is not None else None
                    self._data["riyadh_weather_desc"] = desc
                    self._data["riyadh_weather_icon"] = icon
                    self._last_weather_fetch = time.time()
                    self._save_cache()
                    logger.debug(f"Riyadh Weather updated: {self._data['riyadh_temp']}°C, {desc}")
        except Exception as e:
            logger.warning(f"Error fetching Riyadh weather: {e}")

    async def fetch_prayer_times(self):
        """Fetch Riyadh prayer times from Aladhan API (Method 4: Umm Al-Qura)."""
        url = "https://api.aladhan.com/v1/timingsByCity?city=Riyadh&country=Saudi%20Arabia&method=4"
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    timings = resp.json().get("data", {}).get("timings", {})
                    if timings:
                        self._raw_timings = timings
                        self._data["prayer_fajr"] = format_12h(timings.get("Fajr", "04:23")[:5], with_period=False)
                        self._data["prayer_sunrise"] = format_12h(timings.get("Sunrise", "05:41")[:5], with_period=False)
                        self._data["prayer_dhuhr"] = format_12h(timings.get("Dhuhr", "11:46")[:5], with_period=False)
                        self._data["prayer_asr"] = format_12h(timings.get("Asr", "15:13")[:5], with_period=False)
                        self._data["prayer_maghrib"] = format_12h(timings.get("Maghrib", "17:51")[:5], with_period=False)
                        self._data["prayer_isha"] = format_12h(timings.get("Isha", "19:21")[:5], with_period=False)
                        self._last_prayer_fetch = time.time()
                        self._calculate_prayer_intervals()
                        self._save_cache()
                        logger.info(f"Riyadh Prayer times updated: Fajr {self._data['prayer_fajr']}, Dhuhr {self._data['prayer_dhuhr']}")
        except Exception as e:
            logger.warning(f"Error fetching prayer times: {e}")

    def _calculate_prayer_intervals(self):
        """Calculate next and previous prayer names and remaining/elapsed seconds."""
        if not self._raw_timings:
            return

        now = datetime.now()
        today = now.date()

        # The 5 primary prayers in order
        prayer_names_ar = [
            ("الفجر", "Fajr"),
            ("الظهر", "Dhuhr"),
            ("العصر", "Asr"),
            ("المغرب", "Maghrib"),
            ("العشاء", "Isha")
        ]

        # Parse times for today
        prayers_today = []
        for ar_name, en_name in prayer_names_ar:
            time_str = self._raw_timings.get(en_name, "")[:5]
            if time_str:
                try:
                    h, m = map(int, time_str.split(":"))
                    p_dt = datetime(today.year, today.month, today.day, h, m)
                    prayers_today.append((ar_name, time_str, p_dt))
                except ValueError:
                    continue

        if not prayers_today:
            return

        # Find next and previous prayer
        next_prayer = None
        prev_prayer = None

        for i, (ar_name, time_str, p_dt) in enumerate(prayers_today):
            if p_dt > now:
                next_prayer = (ar_name, time_str, p_dt)
                if i > 0:
                    prev_prayer = prayers_today[i - 1]
                else:
                    # Before Fajr today -> previous was Isha yesterday
                    prev_ar, prev_time, _ = prayers_today[-1]
                    h, m = map(int, prev_time.split(":"))
                    yesterday = today - timedelta(days=1)
                    prev_dt = datetime(yesterday.year, yesterday.month, yesterday.day, h, m)
                    prev_prayer = (prev_ar, prev_time, prev_dt)
                break

        if next_prayer is None:
            # After Isha today -> next is Fajr tomorrow
            next_ar, next_time, _ = prayers_today[0]
            h, m = map(int, next_time.split(":"))
            tomorrow = today + timedelta(days=1)
            next_dt = datetime(tomorrow.year, tomorrow.month, tomorrow.day, h, m)
            next_prayer = (next_ar, next_time, next_dt)
            prev_prayer = prayers_today[-1]

        # Calculate seconds
        next_secs = max(0, int((next_prayer[2] - now).total_seconds()))
        prev_secs = max(0, int((now - prev_prayer[2]).total_seconds()))

        self._data["next_prayer_name"] = next_prayer[0]
        self._data["next_prayer_time"] = format_12h(next_prayer[1], with_period=False)
        self._data["next_prayer_seconds"] = next_secs
        self._data["prev_prayer_name"] = prev_prayer[0]
        self._data["prev_prayer_time"] = format_12h(prev_prayer[1], with_period=False)
        self._data["prev_prayer_seconds"] = prev_secs

    def get_snapshot(self) -> Dict[str, Any]:
        """Return the latest snapshot with real-time prayer countdown recalculation."""
        self._calculate_prayer_intervals()
        return dict(self._data)

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
                if now - self._last_prayer_fetch > 43200 or not self._raw_timings:
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
                    if cur_time - self._last_prayer_fetch >= 43200:
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
