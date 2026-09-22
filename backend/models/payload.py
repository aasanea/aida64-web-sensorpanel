"""Aggregator models."""
from pydantic import BaseModel
from .hardware import HardwareMetrics
from .weather import WeatherMetrics
from .appointments import AppointmentsMetrics

class SensorData(HardwareMetrics, WeatherMetrics, AppointmentsMetrics):
    """
    Contract of 24 required dashboard metrics.
    CRITICAL REQUIREMENT: All fields MUST be Optional[float] = None.
    Missing sensors MUST return None (JSON null), NEVER 0!
    The Aggregator model that combines the above into the legacy SensorData structure for the WebSocket.
    """
    pass

class HealthResponse(BaseModel):
    """Response model for /health endpoint."""
    status: str = "healthy"
    timestamp: float
    sensors_detected: int
    active_connections: int = 0
