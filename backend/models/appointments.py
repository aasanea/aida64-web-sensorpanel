"""Appointments metrics models."""
from typing import Optional
from pydantic import BaseModel, Field

class AppointmentsMetrics(BaseModel):
    # Daily Appointments Telemetry
    appointments_count: Optional[int] = Field(default=None, description="Total appointments scheduled for today")
    appointments_remaining: Optional[int] = Field(default=None, description="Remaining appointments today")
    next_appointment_title: Optional[str] = Field(default=None, description="Next appointment title")
    next_appointment_time: Optional[str] = Field(default=None, description="Next appointment formatted time")
    next_appointment_category: Optional[str] = Field(default=None, description="Next appointment category")
    next_appointment_category_label: Optional[str] = Field(default=None, description="Next appointment category label")
    next_appointment_location: Optional[str] = Field(default=None, description="Next appointment location or platform")
    next_appointment_seconds: Optional[int] = Field(default=None, description="Seconds remaining until next appointment")
    next_appointment_ongoing: Optional[bool] = Field(default=None, description="Whether next appointment is currently ongoing")
    today_appointments: Optional[list] = Field(default=None, description="Full list of today's appointments")

class AppointmentCreateRequest(BaseModel):
    """Payload to create a new appointment."""
    title: str = Field(..., description="Appointment title in Arabic or English")
    time: str = Field(..., description="Time in HH:MM (24-hour) format")
    category: str = Field(default="work", description="Category: work, personal, urgent, meeting")
    category_label: str = Field(default="عمل", description="Category label in Arabic")
    location: Optional[str] = Field(default="", description="Location or meeting platform")
