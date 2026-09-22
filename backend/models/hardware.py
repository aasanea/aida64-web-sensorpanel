"""Hardware metrics models."""
from typing import Optional
from pydantic import BaseModel, Field

class HardwareMetrics(BaseModel):
    # CPU Metrics
    cpu_temp: Optional[float] = Field(default=None, description="CPU Temperature in °C")
    cpu_load: Optional[float] = Field(default=None, description="CPU Utilization in %")
    cpu_clock: Optional[float] = Field(default=None, description="CPU Clock Speed in MHz")
    cpu_power: Optional[float] = Field(default=None, description="CPU Package Power in Watts")
    cpu_voltage: Optional[float] = Field(default=None, description="CPU Voltage in Volts")
    cpu_fan_rpm: Optional[float] = Field(default=None, description="CPU Fan Speed in RPM")
    cpu_hotspot_temp: Optional[float] = Field(default=None, description="CPU Hotspot/Package Temperature in °C")
    cpu_cores: Optional[list[dict]] = Field(default=None, description="20-Core Hybrid Telemetry (Arrow Lake: 8 P-Cores + 12 E-Cores)")

    # GPU Metrics
    gpu_temp: Optional[float] = Field(default=None, description="GPU Core Temperature in °C")
    gpu_load: Optional[float] = Field(default=None, description="GPU Utilization in %")
    gpu_clock: Optional[float] = Field(default=None, description="GPU Core Clock in MHz")
    gpu_power: Optional[float] = Field(default=None, description="GPU Power Draw in Watts")
    gpu_voltage_mv: Optional[float] = Field(default=None, description="GPU Voltage in mV")
    gpu_fan_rpm: Optional[float] = Field(default=None, description="GPU Fan Speed in RPM")
    gpu_hotspot_temp: Optional[float] = Field(default=None, description="GPU Hotspot Temperature in °C")

    # RAM Metrics
    ram_used_percent: Optional[float] = Field(default=None, description="System RAM Used %")
    ram_used_gb: Optional[float] = Field(default=None, description="System RAM Used in GB")
    ram_total_gb: Optional[float] = Field(default=None, description="System RAM Total in GB")
    ram_speed_mhz: Optional[float] = Field(default=None, description="RAM Clock Speed in MHz")
    ram_temp: Optional[float] = Field(default=None, description="RAM Temperature in °C")

    # VRAM Metrics
    vram_used_percent: Optional[float] = Field(default=None, description="GPU VRAM Used %")
    vram_used_gb: Optional[float] = Field(default=None, description="GPU VRAM Used in GB")
    vram_total_gb: Optional[float] = Field(default=None, description="GPU VRAM Total in GB")
    vram_speed_mhz: Optional[float] = Field(default=None, description="VRAM Memory Clock in MHz")
    vram_temp: Optional[float] = Field(default=None, description="VRAM Temperature in °C")

    # Motherboard, Thermals & Cooling
    motherboard_temp: Optional[float] = Field(default=None, description="Motherboard Temperature in °C")
    vrm_temp: Optional[float] = Field(default=None, description="VRM Temperature in °C")
    pch_temp: Optional[float] = Field(default=None, description="PCH / Chipset Temperature in °C")
    nvme_temp: Optional[float] = Field(default=None, description="NVMe SSD Temperature in °C")
    pump_rpm: Optional[float] = Field(default=None, description="Cooling Pump Speed in RPM")

    # Storage Metrics (Drives C & D)
    drive_c_used_percent: Optional[float] = Field(default=None, description="Drive C: Utilization %")
    drive_c_free_gb: Optional[float] = Field(default=None, description="Drive C: Free Space in GB")
    drive_c_used_gb: Optional[float] = Field(default=None, description="Drive C: Used Space in GB")
    drive_c_total_gb: Optional[float] = Field(default=None, description="Drive C: Total Space in GB")
    drive_d_used_percent: Optional[float] = Field(default=None, description="Drive D: Utilization %")
    drive_d_free_gb: Optional[float] = Field(default=None, description="Drive D: Free Space in GB")
    drive_d_used_gb: Optional[float] = Field(default=None, description="Drive D: Used Space in GB")
    drive_d_total_gb: Optional[float] = Field(default=None, description="Drive D: Total Space in GB")
    storage_total_free_gb: Optional[float] = Field(default=None, description="Total Free Storage across drives in GB")

    # Network Metrics
    network_download_mbps: Optional[float] = Field(default=None, description="Active NIC Download Rate in Mbps")
    network_upload_mbps: Optional[float] = Field(default=None, description="Active NIC Upload Rate in Mbps")

    # System & Header Telemetry
    fps: Optional[float] = Field(default=None, description="FPS / Refresh Counter")
    total_power: Optional[float] = Field(default=None, description="Total System Power in Watts")
    max_temp: Optional[float] = Field(default=None, description="Maximum Temperature across all nodes in °C")
    display_hz: Optional[float] = Field(default=None, description="Display Refresh Rate in Hz")
    display_volume: Optional[float] = Field(default=None, description="Master Volume in %")
    display_res: Optional[str] = Field(default=None, description="Display Resolution WxH")
    date_gregorian: Optional[str] = Field(default=None, description="Gregorian Date string")
    date_hijri: Optional[str] = Field(default=None, description="Hijri Date string")

    # SteelSeries Sonar Audio Telemetry
    sonar_connected: Optional[bool] = Field(default=None, description="SteelSeries GG Sonar Connection Status")
    audio_mic_muted: Optional[bool] = Field(default=None, description="Microphone Mute Status")
    audio_mic_volume: Optional[float] = Field(default=None, description="Microphone Volume %")
    audio_master_volume: Optional[float] = Field(default=None, description="Sonar Master Volume %")
    audio_master_muted: Optional[bool] = Field(default=None, description="Sonar Master Muted")
    audio_game_volume: Optional[float] = Field(default=None, description="Sonar Game Volume %")
    audio_game_muted: Optional[bool] = Field(default=None, description="Sonar Game Muted")
    audio_chat_volume: Optional[float] = Field(default=None, description="Sonar Chat Volume %")
    audio_chat_muted: Optional[bool] = Field(default=None, description="Sonar Chat Muted")
    audio_media_volume: Optional[float] = Field(default=None, description="Sonar Media Volume %")
    audio_media_muted: Optional[bool] = Field(default=None, description="Sonar Media Muted")
    audio_aux_volume: Optional[float] = Field(default=None, description="Sonar Aux Volume %")
    audio_aux_muted: Optional[bool] = Field(default=None, description="Sonar Aux Muted")

