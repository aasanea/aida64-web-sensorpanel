"""
AIDA64 Shared Memory and Registry Reader.
Extracts real-time hardware telemetry from AIDA64 (AIDA64_SensorValues).
Complies strictly with HardwareMetrics model (None for missing values).
"""

import ctypes
import re
import winreg
import xml.etree.ElementTree as ET
from ctypes import wintypes
from typing import Dict, Optional, Tuple

from loguru import logger
from models import HardwareMetrics

# ---------------------------------------------------------
# Exact 64-bit Windows Kernel32 Definitions
# ---------------------------------------------------------
FILE_MAP_READ = 4
kernel32 = ctypes.windll.kernel32

kernel32.OpenFileMappingW.argtypes = [
    wintypes.DWORD,
    wintypes.BOOL,
    wintypes.LPCWSTR,
]
kernel32.OpenFileMappingW.restype = wintypes.HANDLE

kernel32.MapViewOfFile.argtypes = [
    wintypes.HANDLE,
    wintypes.DWORD,
    wintypes.DWORD,
    wintypes.DWORD,
    ctypes.c_size_t,
]
kernel32.MapViewOfFile.restype = ctypes.c_void_p

kernel32.UnmapViewOfFile.argtypes = [ctypes.c_void_p]
kernel32.UnmapViewOfFile.restype = wintypes.BOOL

kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
kernel32.CloseHandle.restype = wintypes.BOOL

SHARED_MEMORY_NAME = "AIDA64_SensorValues"
REGISTRY_KEY_PATH = r"Software\FinalWire\AIDA64\SensorValues"


def read_shared_memory() -> Optional[str]:
    """
    Open AIDA64 Shared Memory mapping, read raw string, unmap and close handle safely.
    Returns raw XML string or None if unreadable.
    """
    handle = kernel32.OpenFileMappingW(FILE_MAP_READ, False, SHARED_MEMORY_NAME)
    if not handle:
        return None

    try:
        p_buf = kernel32.MapViewOfFile(handle, FILE_MAP_READ, 0, 0, 0)
        if not p_buf:
            return None

        try:
            raw_bytes = ctypes.string_at(p_buf)
            raw_str = raw_bytes.decode("utf-8", errors="ignore").strip("\x00").strip()
            return raw_str if raw_str else None
        finally:
            kernel32.UnmapViewOfFile(p_buf)
    finally:
        kernel32.CloseHandle(handle)


def read_registry_sensors() -> Dict[str, Dict[str, str]]:
    """
    Fallback: Read AIDA64 sensor values from Windows Registry.
    Extracts {id: {'category': 'reg', 'label': label, 'value': value}}.
    """
    sensors: Dict[str, Dict[str, str]] = {}
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, REGISTRY_KEY_PATH)
        try:
            i = 0
            while True:
                try:
                    name, val, _ = winreg.EnumValue(key, i)
                    i += 1
                    if name.startswith("Value."):
                        sid = name[6:]
                        if sid not in sensors:
                            sensors[sid] = {"category": "reg", "label": sid, "value": str(val)}
                        else:
                            sensors[sid]["value"] = str(val)
                    elif name.startswith("Label."):
                        sid = name[6:]
                        if sid not in sensors:
                            sensors[sid] = {"category": "reg", "label": str(val), "value": ""}
                        else:
                            sensors[sid]["label"] = str(val)
                except OSError:
                    break
        finally:
            winreg.CloseKey(key)
    except Exception as e:
        logger.debug(f"AIDA64 registry read skipped or unavailable: {e}")

    return sensors


def parse_aida_xml(raw_str: str) -> Dict[str, Dict[str, str]]:
    """
    Parse raw AIDA64 XML string wrapped in <root>{raw}</root>.
    Returns dict: {id: {'category': tag, 'label': label, 'value': value}}.
    """
    if not raw_str:
        return {}

    sanitized = re.sub(r"&(?!(amp|lt|gt|quot|apos);)", "&amp;", raw_str)
    xml_content = f"<root>{sanitized}</root>"
    sensors: Dict[str, Dict[str, str]] = {}

    try:
        root = ET.fromstring(xml_content)
        for child in root:
            sid_elem = child.find("id")
            if sid_elem is not None and sid_elem.text:
                sid = sid_elem.text.strip()
                label_elem = child.find("label")
                value_elem = child.find("value")
                label = label_elem.text.strip() if label_elem is not None and label_elem.text else ""
                value = value_elem.text.strip() if value_elem is not None and value_elem.text else ""
                sensors[sid] = {
                    "category": child.tag,
                    "label": label,
                    "value": value,
                }
    except ET.ParseError as pe:
        logger.warning(f"AIDA64 XML parsing error ({pe}), using regex fallback")
        pattern = re.compile(
            r"<(?P<tag>\w+)><id>(?P<id>[^<]+)</id>(?:<label>(?P<label>[^<]*)</label>)?(?:<value>(?P<value>[^<]*)</value>)?</(?P=tag)>"
        )
        for match in pattern.finditer(raw_str):
            tag = match.group("tag")
            sid = match.group("id")
            label = match.group("label") or ""
            value = match.group("value") or ""
            sensors[sid] = {"category": tag, "label": label, "value": value}

    return sensors


def read_aida_sensors(fallback_registry: bool = True) -> Dict[str, Dict[str, str]]:
    """
    Read sensors from shared memory, falling back to registry if unavailable.
    """
    raw_str = read_shared_memory()
    if raw_str:
        sensors = parse_aida_xml(raw_str)
        if sensors:
            return sensors

    if fallback_registry:
        reg_sensors = read_registry_sensors()
        if reg_sensors:
            return reg_sensors

    return {}


def _parse_val(val_str: Optional[str]) -> Optional[float]:
    """Helper to parse a float from sensor value string, returning None if missing or invalid."""
    if val_str is None:
        return None
    cleaned = str(val_str).strip().replace(",", ".")
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def _get_float(sensors: Dict[str, Dict[str, str]], *candidate_ids: str) -> Optional[float]:
    """Return the first existing float value among candidate sensor IDs, else None."""
    for cid in candidate_ids:
        if cid in sensors:
            val = _parse_val(sensors[cid].get("value"))
            if val is not None:
                return val
    return None


def extract_network_rates(sensors: Dict[str, Dict[str, str]]) -> Tuple[Optional[float], Optional[float]]:
    """
    Auto-detect the highest active NIC download/upload rate converted from KB/s to Mbps.
    """
    nic_candidates = []
    for k in sensors:
        match = re.match(r"^SNIC(\d+)DLRATE$", k)
        if match:
            idx = match.group(1)
            dl_raw = _get_float(sensors, f"SNIC{idx}DLRATE")
            ul_raw = _get_float(sensors, f"SNIC{idx}ULRATE")
            if dl_raw is not None or ul_raw is not None:
                total_activity = (dl_raw or 0.0) + (ul_raw or 0.0)
                nic_candidates.append((total_activity, dl_raw, ul_raw, idx))

    if not nic_candidates:
        return None, None

    nic_candidates.sort(key=lambda x: x[0], reverse=True)
    best_activity, best_dl, best_ul, _ = nic_candidates[0]

    dl_mbps = round(best_dl * 8.0 / 1024.0, 2) if best_dl is not None else None
    ul_mbps = round(best_ul * 8.0 / 1024.0, 2) if best_ul is not None else None

    return dl_mbps, ul_mbps


def get_sensors_and_count(fallback_registry: bool = True) -> Tuple[HardwareMetrics, int]:
    """
    Read all sensors, build HardwareMetrics contract, and return along with raw sensor count.
    Missing sensors MUST return None (never 0).
    """
    sensors = read_aida_sensors(fallback_registry=fallback_registry)
    sensor_count = len(sensors)

    # RAM calculations (SUSEDMEM, SFREEMEM in MB -> GB)
    used_mem = _get_float(sensors, "SUSEDMEM")
    free_mem = _get_float(sensors, "SFREEMEM")
    ram_used_gb = round(used_mem / 1024.0, 2) if used_mem is not None else None
    ram_total_gb = (
        round((used_mem + free_mem) / 1024.0, 2)
        if (used_mem is not None and free_mem is not None)
        else None
    )

    # VRAM calculations (SUSEDVMEM, SFREEVMEM in MB -> GB)
    used_vmem = _get_float(sensors, "SUSEDVMEM", "SGPU1USEDDEMEM")
    free_vmem = _get_float(sensors, "SFREEVMEM")
    vram_used_gb = round(used_vmem / 1024.0, 2) if used_vmem is not None else None
    vram_total_gb = (
        round((used_vmem + free_vmem) / 1024.0, 2)
        if (used_vmem is not None and free_vmem is not None)
        else None
    )

    # Network calculations
    dl_mbps, ul_mbps = extract_network_rates(sensors)

    # NVMe SSD Temp (THDD1, THDD2, or any THDD*)
    nvme_temp = _get_float(sensors, "THDD1", "THDD2")
    if nvme_temp is None:
        for sid in sensors:
            if sid.startswith("THDD") and not sid.endswith("TS2"):
                nvme_temp = _get_float(sensors, sid)
                if nvme_temp is not None:
                    break

    # GPU Voltage in mV
    raw_vgpu = _get_float(sensors, "VGPU1", "VGPU")
    if raw_vgpu is not None:
        gpu_voltage_mv = round(raw_vgpu * 1000.0, 1) if raw_vgpu < 10.0 else round(raw_vgpu, 1)
    else:
        gpu_voltage_mv = None

    # Total System Power (CPU + GPU Package/Core)
    cpu_pwr = _get_float(sensors, "PCPUPKG", "PCPUIAC")
    gpu_pwr = _get_float(sensors, "PGPU1", "PGPU")
    if cpu_pwr is not None or gpu_pwr is not None:
        total_power = round((cpu_pwr or 0.0) + (gpu_pwr or 0.0), 1)
    else:
        total_power = None

    # Storage Calculations (Drives C & D)
    drive_c_used_percent = _get_float(sensors, "SDRVCUTI")
    drive_c_free_gb = _get_float(sensors, "SDRVCFREESPC")
    drive_c_used_gb = _get_float(sensors, "SDRVCUSEDSPC")
    drive_c_total_gb = (
        round(drive_c_used_gb + drive_c_free_gb, 0)
        if (drive_c_used_gb is not None and drive_c_free_gb is not None)
        else None
    )

    drive_d_used_percent = _get_float(sensors, "SDRVDUTI")
    drive_d_free_gb = _get_float(sensors, "SDRVDFREESPC")
    drive_d_used_gb = _get_float(sensors, "SDRVDUSEDSPC")
    drive_d_total_gb = (
        round(drive_d_used_gb + drive_d_free_gb, 0)
        if (drive_d_used_gb is not None and drive_d_free_gb is not None)
        else None
    )

    if drive_c_free_gb is not None and drive_d_free_gb is not None:
        storage_total_free_gb = round(drive_c_free_gb + drive_d_free_gb, 1)
    elif drive_c_free_gb is not None:
        storage_total_free_gb = round(drive_c_free_gb, 1)
    elif drive_d_free_gb is not None:
        storage_total_free_gb = round(drive_d_free_gb, 1)
    else:
        storage_total_free_gb = None

    # Max Temperature across all sensors
    all_temps = [
        _parse_val(sinfo.get("value"))
        for sid, sinfo in sensors.items()
        if (sinfo.get("category") == "temp" or sid.startswith("T"))
        and _parse_val(sinfo.get("value")) is not None
        and 0.0 < (_parse_val(sinfo.get("value")) or 0.0) < 150.0
    ]
    max_temp = max(all_temps) if all_temps else None

    # Display Resolution string
    res_val = sensors.get("SDESKRES", {}).get("value")
    display_res = str(res_val).strip() if res_val else None

    # 20-Core Hybrid Metrics (Arrow Lake: 8 P-Cores + 12 E-Cores)
    cpu_cores = []
    has_any_core = False
    for i in range(1, 21):
        core_type = "P" if i <= 8 else "E"
        core_load = _get_float(sensors, f"SCPU{i}UTI")
        core_temp = _get_float(sensors, f"TCC-1-{i}", f"TCPUCORE{i}")
        if core_load is not None or core_temp is not None:
            has_any_core = True
        cpu_cores.append({
            "id": i,
            "type": core_type,
            "load": core_load,
            "temp": core_temp
        })
    if not has_any_core:
        cpu_cores = None

    data = HardwareMetrics(
        # CPU
        cpu_temp=_get_float(sensors, "TCPU", "TCPUPKG"),
        cpu_load=_get_float(sensors, "SCPUUTI"),
        cpu_clock=_get_float(sensors, "SCPUCLK"),
        cpu_power=cpu_pwr,
        cpu_voltage=_get_float(sensors, "VCPU", "VCORE"),
        cpu_fan_rpm=_get_float(sensors, "FCPU"),
        cpu_hotspot_temp=_get_float(sensors, "TCPUPKG", "TCPUHOT"),
        cpu_cores=cpu_cores,
        # GPU
        gpu_temp=_get_float(sensors, "TGPU1", "TGPU"),
        gpu_load=_get_float(sensors, "SGPU1UTI", "SGPUUTI"),
        gpu_clock=_get_float(sensors, "SGPU1CLK", "SGPUCLK"),
        gpu_power=gpu_pwr,
        gpu_voltage_mv=gpu_voltage_mv,
        gpu_fan_rpm=_get_float(sensors, "FGPU1", "FGPU"),
        gpu_hotspot_temp=_get_float(sensors, "TGPU1HOT", "TGPUHOT"),
        # RAM
        ram_used_percent=_get_float(sensors, "SMEMUTI"),
        ram_used_gb=ram_used_gb,
        ram_total_gb=ram_total_gb,
        ram_speed_mhz=_get_float(sensors, "SMEMCLK", "SRAMCLK"),
        ram_temp=_get_float(sensors, "TDIMMTS2", "TDIMMTS4", "TDIMM1", "TDIMM2", "TDIMMA"),
        # VRAM
        vram_used_percent=_get_float(sensors, "SVMEMUSAGE", "SGPU1VMEMUTI"),
        vram_used_gb=vram_used_gb,
        vram_total_gb=vram_total_gb,
        vram_speed_mhz=_get_float(sensors, "SGPU1MEMCLK", "SGPUMEMCLK"),
        vram_temp=_get_float(sensors, "TGPU1MEM", "TGPUMEM"),
        # Temperatures & Cooling
        motherboard_temp=_get_float(sensors, "TMOBO", "TSYS"),
        vrm_temp=_get_float(sensors, "TVRM"),
        pch_temp=_get_float(sensors, "TPCH", "TPCHDIO"),
        nvme_temp=nvme_temp,
        pump_rpm=_get_float(sensors, "FCHA4", "FPUMP", "FWATER", "FCPUOPT", "FCHAS1"),
        # Storage
        drive_c_used_percent=drive_c_used_percent,
        drive_c_free_gb=drive_c_free_gb,
        drive_c_used_gb=drive_c_used_gb,
        drive_c_total_gb=drive_c_total_gb,
        drive_d_used_percent=drive_d_used_percent,
        drive_d_free_gb=drive_d_free_gb,
        drive_d_used_gb=drive_d_used_gb,
        drive_d_total_gb=drive_d_total_gb,
        storage_total_free_gb=storage_total_free_gb,
        # Network
        network_download_mbps=dl_mbps,
        network_upload_mbps=ul_mbps,
        # System Telemetry & Header
        fps=(
            rtss_fps
            if (rtss_fps := _get_float(sensors, "SRTSSFPS")) is not None and rtss_fps > 0
            else (
                aida_fps
                if (aida_fps := _get_float(sensors, "SAIDAFPS")) is not None
                and aida_fps > 0
                and (
                    (vref := _get_float(sensors, "SVREFRATE")) is None
                    or abs(aida_fps - vref) > 1.0
                    or (_get_float(sensors, "SGPU1UTI", "SGPUUTI") or 0.0) > 35.0
                )
                else (0.0 if (_get_float(sensors, "SAIDAFPS") is not None or _get_float(sensors, "SRTSSFPS") is not None) else None)
            )
        ),
        total_power=total_power,
        max_temp=max_temp,
        display_hz=_get_float(sensors, "SVREFRATE"),
        display_volume=_get_float(sensors, "SMASTVOL"),
        display_res=display_res,
        date_gregorian=None,
        date_hijri=None,
    )

    return data, sensor_count


def get_sensor_data(fallback_registry: bool = True) -> HardwareMetrics:
    """Convenience wrapper returning HardwareMetrics directly."""
    data, _ = get_sensors_and_count(fallback_registry=fallback_registry)
    return data
