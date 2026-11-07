"""
Unit tests for AIDA64 Shared Memory Reader & Data Contract.
Verifies compliance with Master Prompt v4.0 (24 metrics, None for missing values).
"""

import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import pytest


def test_reader_import():
    try:
        import services.aida_service as aida_reader
        assert aida_reader is not None
    except ImportError as e:
        pytest.fail(f"Failed to import services.aida_service as aida_reader: {e}")


def test_models_sensor_data_fields():
    from models import SensorData
    
    required_24_fields = [
        "cpu_temp", "cpu_load", "cpu_clock", "cpu_power", "cpu_fan_rpm", "cpu_hotspot_temp",
        "gpu_temp", "gpu_load", "gpu_clock", "gpu_power", "gpu_fan_rpm", "gpu_hotspot_temp",
        "ram_used_percent", "ram_used_gb", "ram_total_gb",
        "vram_used_percent", "vram_used_gb", "vram_total_gb",
        "motherboard_temp", "vrm_temp", "pch_temp", "nvme_temp",
        "network_download_mbps", "network_upload_mbps"
    ]
    
    fields = SensorData.model_fields
    for field_name in required_24_fields:
        assert field_name in fields, f"Missing required field in SensorData: {field_name}"
        
    # Check default is None (not 0)
    sample = SensorData()
    for field_name in required_24_fields:
        val = getattr(sample, field_name)
        assert val is None, f"Field {field_name} default must be None, but got {val}"


def test_live_aida_read():
    import services.aida_service as aida_reader
    
    sensors = aida_reader.read_aida_sensors()
    assert isinstance(sensors, dict), "Sensors output must be a dictionary"
    
    data = aida_reader.get_sensor_data()
    assert data is not None, "get_sensor_data() returned None"
    
    # Validate the public schema rather than assuming one machine's topology.
    from models import SensorData
    SensorData.model_validate(data.model_dump())
    for core in data.cpu_cores or []:
        assert isinstance(core["id"], int)
        assert core.get("type") in ("P", "E", None)
        for name in ("load", "temp"):
            value = core.get(name)
            assert value is None or isinstance(value, (int, float))


if __name__ == "__main__":
    pytest.main(["-v", __file__])
