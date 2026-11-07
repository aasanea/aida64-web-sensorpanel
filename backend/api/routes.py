"""REST API Endpoints."""

import time
from services.telemetry_contract import source_meta, field_meta
from fastapi import APIRouter
from models import HealthResponse, SensorData, AppointmentCreateRequest
from core.config import settings
from services.aida_service import get_sensors_and_count, get_sensor_data
from services.appointments_service import AppointmentsService
from services.weather_service import WeatherService
from services.sonar_service import SonarService
from services.matches_service import MatchesService
from services.updater_service import UpdaterService
from services.network_service import NetworkService
from services.audio_meter_service import AudioMeterService
from services.broadcast_service import BroadcastService
from api.websocket import manager
from utils.time_utils import get_current_dates

router = APIRouter()


@router.get('/api/audio-levels')
async def audio_levels():
    return AudioMeterService.get_instance().get_snapshot()

def build_aggregated_sensor_data(fallback_registry: bool) -> SensorData:
    """Builds the aggregated SensorData payload."""
    hardware = get_sensor_data(fallback_registry=fallback_registry)
    weather = WeatherService.get_instance().get_snapshot()
    appointments = AppointmentsService.get_instance().get_summary()
    sonar = SonarService.get_instance().get_snapshot()
    network_snap = NetworkService.get_instance().get_snapshot()
    greg, hijri = get_current_dates()
    
    hw_dump = hardware.model_dump()
    hw_dump["date_gregorian"] = greg
    hw_dump["date_hijri"] = hijri
    hw_dump.update(sonar)
    hw_dump["audio_broadcast"] = BroadcastService.get_instance().get_snapshot()
    hw_dump.update(network_snap)
    sources = hw_dump.setdefault("telemetry_sources", {})
    sources.update(sonar=sonar.get("sonar_source"), network=network_snap.get("network_source"), weather=weather.get("weather_source"), prayer=weather.get("prayer_source"), appointments=source_meta("Local appointment schedule / Riyadh", time.time(), 5))
    fields = hw_dump.setdefault("telemetry_fields", {})
    for key in sonar:
        if key.endswith("_source"):
            continue
        fields[key] = field_meta("sonar", "%" if key.endswith("volume") else "")
    for key in network_snap:
        if key.endswith("_source"):
            continue
        fields[key] = field_meta("network", "Mbps" if key.endswith("mbps") else "GiB" if key.endswith("gb") else "ms" if key.endswith("ms") else "")
    for key in weather:
        if key.endswith("_source"):
            continue
        fields[key] = field_meta("weather" if key.startswith("riyadh") else "prayer", "°C" if key.endswith("temp") else "", "derived" if key.endswith("seconds") else "measured")
    for key in appointments:
        fields[key] = field_meta("appointments", "", "derived" if key.endswith(("seconds", "remaining", "count")) else "configured")

    
    return SensorData(
        **hw_dump,
        **weather,
        **appointments
    )

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint returning system status and sensor count."""
    _, sensor_count = get_sensors_and_count(fallback_registry=settings.fallback_registry)
    return HealthResponse(
        status="healthy",
        timestamp=time.time(),
        sensors_detected=sensor_count,
        active_connections=manager.count,
    )

@router.get("/api/sensors", response_model=SensorData)
@router.get("/api/telemetry", response_model=SensorData)
async def get_sensors():
    """Fetch current snapshot of 24 required dashboard metrics."""
    data = build_aggregated_sensor_data(fallback_registry=settings.fallback_registry)
    return data

@router.get("/api/appointments")
async def get_appointments():
    """Fetch today's appointments and summary."""
    service = AppointmentsService.get_instance()
    return service.get_summary()

@router.post("/api/appointments")
async def create_appointment(req: AppointmentCreateRequest):
    """Add a new appointment."""
    service = AppointmentsService.get_instance()
    new_apt = service.add_appointment(
        title=req.title,
        time_str=req.time,
        date_str=req.date,
        category=req.category,
        category_label=req.category_label,
        location=req.location or "",
    )
    return {"status": "created", "appointment": new_apt}

@router.delete("/api/appointments/{appointment_id}")
async def delete_appointment(appointment_id: str):
    """Delete an appointment by ID."""
    service = AppointmentsService.get_instance()
    deleted = service.delete_appointment(appointment_id)
    if not deleted:
        return {"status": "not_found", "message": f"Appointment {appointment_id} not found"}
    return {"status": "deleted", "appointment_id": appointment_id}

@router.get("/api/matches/today")
async def get_today_matches():
    """Fetch today's matches with emphasis on Saudi Pro League."""
    service = MatchesService.get_instance()
    return service.get_today_matches()

@router.get("/api/matches/saudi-standings")
async def get_saudi_standings():
    """Fetch Saudi Pro League 18-team Standings table."""
    service = MatchesService.get_instance()
    return service.get_standings()


@router.get("/api/system/version")
async def get_system_version():
    """Fetch current system version info, repository, and platform telemetry."""
    service = UpdaterService.get_instance()
    return service.get_version_info()


@router.get("/api/system/check-update")
async def check_system_update(force: bool = False):
    """Check GitHub repository for available updates with caching and semver comparison."""
    service = UpdaterService.get_instance()
    return await service.check_for_updates(force=force)

