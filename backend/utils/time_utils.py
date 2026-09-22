"""Time and date utility functions."""
import datetime
from typing import Optional, Tuple
from loguru import logger

try:
    from hijri_converter import Gregorian as HijriGregorian
    _HIJRI_AVAILABLE = True
except ImportError:
    _HIJRI_AVAILABLE = False
    logger.warning("hijri-converter not installed — Hijri date will use arithmetic fallback")


def format_12h(time_str: Optional[str], with_period: bool = True) -> Optional[str]:
    """Convert 'HH:MM' (24h) string to 'H:MM' 12-hour format with optional Arabic period (ص/م)."""
    if not time_str or ":" not in str(time_str):
        return time_str
    try:
        parts = str(time_str).strip().split(":")
        h = int(parts[0])
        m = int(parts[1][:2])
        period = "م" if h >= 12 else "ص"
        h12 = h % 12
        if h12 == 0:
            h12 = 12
        if with_period:
            return f"{h12}:{m:02d} {period}"
        return f"{h12}:{m:02d}"
    except Exception:
        return time_str


def get_current_dates() -> Tuple[str, str]:
    """Returns a tuple of (Gregorian Date, Hijri Date)."""
    now = datetime.datetime.now()
    greg_str = now.strftime("%Y/%m/%d")
    if _HIJRI_AVAILABLE:
        h_date = HijriGregorian(now.year, now.month, now.day).to_hijri()
        hijri_str = f"{h_date.year:04d}/{h_date.month:02d}/{h_date.day:02d}"
    else:
        hijri_str = "---"
    return greg_str, hijri_str
