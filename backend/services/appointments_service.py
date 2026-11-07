"""
Appointments Service for AIDA64 Glassmorphism Dashboard.
Manages daily appointments, calculates status (completed, ongoing, upcoming),
and tracks countdown to the next scheduled appointment.
"""

import os
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from loguru import logger

from utils.time_utils import format_12h

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
APPOINTMENTS_FILE = os.path.join(DATA_DIR, "appointments.json")


class AppointmentsService:
    """Singleton service for managing daily appointments and countdowns."""

    _instance: Optional["AppointmentsService"] = None

    def __init__(self) -> None:
        self.appointments_file = APPOINTMENTS_FILE
        self._appointments: List[Dict[str, Any]] = []
        self._load_appointments()

    @classmethod
    def get_instance(cls) -> "AppointmentsService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load_appointments(self) -> None:
        """Load appointments from JSON file or initialize with defaults."""
        os.makedirs(DATA_DIR, exist_ok=True)
        if os.path.exists(self.appointments_file):
            try:
                with open(self.appointments_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._appointments = data.get("appointments", [])
                    logger.info(f"Loaded {len(self._appointments)} appointments from {self.appointments_file}")
                    return
            except Exception as e:
                logger.error(f"Failed to read appointments file: {e}")

        # Default sample appointments if file not found or corrupted
        self._appointments = [
            {
                "id": "apt_1",
                "title": "مراجعة تقارير السيرفرات والشبكة",
                "time": "09:30",
                "category": "work",
                "category_label": "عمل",
                "location": "المكتب",
                "days": ["all"],
            },
            {
                "id": "apt_2",
                "title": "اجتماع فريق التطوير والعمليات",
                "time": "13:00",
                "category": "meeting",
                "category_label": "اجتماع",
                "location": "عن بعد",
                "days": ["all"],
            },
            {
                "id": "apt_3",
                "title": "متابعة أداء لوحات المراقبة AIDA64",
                "time": "16:30",
                "category": "urgent",
                "category_label": "هام",
                "location": "محطة العمل",
                "days": ["all"],
            },
            {
                "id": "apt_4",
                "title": "قراءة تقنية وجلسة تعلم وتطوير",
                "time": "20:00",
                "category": "personal",
                "category_label": "شخصي",
                "location": "المنزل",
                "days": ["all"],
            },
        ]
        self._save_appointments()

    def _save_appointments(self) -> None:
        """Persist current appointments list to JSON file."""
        try:
            with open(self.appointments_file, "w", encoding="utf-8") as f:
                json.dump({"appointments": self._appointments}, f, ensure_ascii=False, indent=2)
            logger.info("Appointments persisted successfully.")
        except Exception as e:
            logger.error(f"Failed to save appointments: {e}")

    def get_today_appointments(self, now: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Get today's appointments sorted by scheduled time, enriched with 12h time,
        live status (upcoming, ongoing, completed), and seconds until/since start.
        """
        if now is None:
            now = datetime.now(timezone(timedelta(hours=3)))

        today_items = []
        today_date_str = now.strftime("%Y-%m-%d")
        current_time_minutes = now.hour * 60 + now.minute
        current_time_seconds = current_time_minutes * 60 + now.second

        for apt in getattr(self, "_appointments", []):
            # Check date or recurrence
            date_filter = apt.get("date")
            if date_filter:
                if date_filter != today_date_str:
                    continue
            else:
                days = apt.get("days", ["all"])
                weekday = now.strftime("%A").lower()
                weekday_ar = ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"][now.weekday()]
                if "all" not in days and weekday not in [str(day).lower() for day in days] and weekday_ar not in days:
                    continue

            time_str = apt.get("time") or ""
            try:
                parts = time_str.split(":")
                apt_hour = int(parts[0])
                apt_min = int(parts[1])
                if not 0 <= apt_hour < 24 or not 0 <= apt_min < 60:
                    continue
            except Exception:
                continue

            apt_seconds = (apt_hour * 60 + apt_min) * 60
            diff_seconds = apt_seconds - current_time_seconds

            # Status logic:
            # An appointment is considered 'ongoing' within 45 mins after start time
            # 'completed' if > 45 mins after start
            # 'upcoming' if in the future
            if diff_seconds > 0:
                status = "upcoming"
                status_label = "قادم"
            elif diff_seconds >= -2700:  # within 45 minutes
                status = "ongoing"
                status_label = "جاري الآن"
            else:
                status = "completed"
                status_label = "منقضي"

            today_items.append({
                "id": apt.get("id", f"apt_{len(today_items)+1}"),
                "title": apt.get("title", "موعد بدون عنوان"),
                "time": time_str,
                "time_12h": format_12h(time_str, with_period=True),
                "date": apt.get("date"),
                "category": apt.get("category", "general"),
                "category_label": apt.get("category_label", "عام"),
                "location": apt.get("location", ""),
                "status": status,
                "status_label": status_label,
                "seconds_until": diff_seconds,
            })

        # Sort chronologically
        today_items.sort(key=lambda x: x["time"])
        return today_items

    def get_all_appointments(self) -> List[Dict[str, Any]]:
        """
        Return all appointments enriched with 12h time and date,
        sorted chronologically by date and time.
        """
        all_items = []
        for apt in getattr(self, "_appointments", []):
            time_str = apt.get("time") or ""
            all_items.append({
                "id": apt.get("id", ""),
                "title": apt.get("title", "موعد بدون عنوان"),
                "time": time_str,
                "time_12h": format_12h(time_str, with_period=True),
                "date": apt.get("date"),
                "category": apt.get("category", "general"),
                "category_label": apt.get("category_label", "عام"),
                "location": apt.get("location", ""),
                "days": apt.get("days", ["all"]),
            })
        all_items.sort(key=lambda x: (x["date"] or "9999-99-99", x["time"]))
        return all_items

    def get_summary(self, now: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Compute dashboard summary for appointments card:
        - Total appointments count today
        - Upcoming & ongoing count
        - Next appointment details and countdown seconds
        - All today's items
        - All scheduled appointments
        """
        items = self.get_today_appointments(now=now)

        # Find next appointment: first ongoing or upcoming item
        next_apt = None
        for item in items:
            if item["status"] in ("upcoming", "ongoing"):
                next_apt = item
                break

        total_count = len(items)
        remaining_count = sum(1 for i in items if i["status"] in ("upcoming", "ongoing"))

        next_title = next_apt["title"] if next_apt else None
        next_time = next_apt["time_12h"] if next_apt else None
        next_category = next_apt["category"] if next_apt else None
        next_category_label = next_apt["category_label"] if next_apt else None
        next_location = next_apt.get("location") if next_apt else None
        next_seconds = max(0, next_apt["seconds_until"]) if next_apt else None
        is_ongoing = (next_apt["status"] == "ongoing") if next_apt else False

        return {
            "appointments_count": total_count,
            "appointments_remaining": remaining_count,
            "next_appointment_title": next_title,
            "next_appointment_time": next_time,
            "next_appointment_category": next_category,
            "next_appointment_category_label": next_category_label,
            "next_appointment_location": next_location,
            "next_appointment_seconds": next_seconds,
            "next_appointment_ongoing": is_ongoing,
            "today_appointments": items,
            "all_appointments": self.get_all_appointments(),
        }

    def add_appointment(
        self,
        title: str,
        time_str: str,
        category: str = "work",
        category_label: str = "عمل",
        location: str = "",
        days: Optional[List[str]] = None,
        date_str: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Add a new appointment."""
        apt_id = f"apt_{int(time.time()*1000)}"
        clean_date = date_str.strip() if date_str and isinstance(date_str, str) and date_str.strip() else None
        new_item = {
            "id": apt_id,
            "title": title.strip(),
            "time": time_str.strip(),
            "category": category.strip(),
            "category_label": category_label.strip(),
            "location": location.strip(),
            "days": days or ["all"],
        }
        if clean_date:
            new_item["date"] = clean_date

        self._appointments.append(new_item)
        self._save_appointments()
        return new_item

    def delete_appointment(self, appointment_id: str) -> bool:
        """Delete an appointment by ID."""
        initial_len = len(self._appointments)
        self._appointments = [a for a in self._appointments if a.get("id") != appointment_id]
        if len(self._appointments) < initial_len:
            self._save_appointments()
            return True
        return False
