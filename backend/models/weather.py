"""Weather metrics models."""
from typing import Optional
from pydantic import BaseModel, Field

class WeatherMetrics(BaseModel):
    # Riyadh Weather & Prayer Times
    riyadh_temp: Optional[float] = Field(default=None, description="Riyadh Temperature in °C")
    riyadh_weather_desc: Optional[str] = Field(default=None, description="Weather Description in Arabic")
    riyadh_weather_icon: Optional[str] = Field(default=None, description="Weather Icon Emoji")
    prayer_fajr: Optional[str] = Field(default=None, description="Fajr time HH:MM")
    prayer_sunrise: Optional[str] = Field(default=None, description="Sunrise time HH:MM")
    prayer_dhuhr: Optional[str] = Field(default=None, description="Dhuhr time HH:MM")
    prayer_asr: Optional[str] = Field(default=None, description="Asr time HH:MM")
    prayer_maghrib: Optional[str] = Field(default=None, description="Maghrib time HH:MM")
    prayer_isha: Optional[str] = Field(default=None, description="Isha time HH:MM")
    next_prayer_name: Optional[str] = Field(default=None, description="Next prayer Arabic name")
    next_prayer_time: Optional[str] = Field(default=None, description="Next prayer time HH:MM")
    next_prayer_seconds: Optional[int] = Field(default=None, description="Seconds remaining to next prayer")
    prev_prayer_name: Optional[str] = Field(default=None, description="Previous prayer Arabic name")
    prev_prayer_time: Optional[str] = Field(default=None, description="Previous prayer time HH:MM")
    prev_prayer_seconds: Optional[int] = Field(default=None, description="Seconds elapsed since previous prayer")
