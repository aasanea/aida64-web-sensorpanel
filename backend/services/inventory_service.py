"""Cached Windows inventory. Never shell out on the telemetry/ASGI thread."""
import ctypes
import json
import struct
import subprocess
import threading
import time
from services.telemetry_contract import source_meta


def core_topology():
    api = ctypes.windll.kernel32.GetLogicalProcessorInformationEx
    api.argtypes = [ctypes.c_int, ctypes.c_void_p, ctypes.POINTER(ctypes.c_ulong)]
    api.restype = ctypes.c_int
    size = ctypes.c_ulong()
    api(0, None, ctypes.byref(size))
    if not size.value:
        return {}
    buffer = ctypes.create_string_buffer(size.value)
    if not api(0, buffer, ctypes.byref(size)):
        return {}
    raw, offset, logical = buffer.raw, 0, {}
    while offset + 32 <= len(raw):
        relation, length = struct.unpack_from("II", raw, offset)
        if length < 32 or offset + length > len(raw):
            break
        if relation == 0:
            efficiency = raw[offset + 9]
            groups = struct.unpack_from("H", raw, offset + 30)[0]
            stride = ctypes.sizeof(ctypes.c_size_t) + 8
            for group_index in range(groups):
                start = offset + 32 + group_index * stride
                mask = int.from_bytes(raw[start:start + ctypes.sizeof(ctypes.c_size_t)], "little")
                group = struct.unpack_from("H", raw, start + ctypes.sizeof(ctypes.c_size_t))[0]
                for bit in range(ctypes.sizeof(ctypes.c_size_t) * 8):
                    if mask & (1 << bit):
                        logical[group * 64 + bit + 1] = efficiency
        offset += length
    classes = set(logical.values())
    return {key: "P" if value == max(classes) else "E" for key, value in logical.items()} if len(classes) == 2 else {key: None for key in logical}


INVENTORY_SCRIPT = r"""$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new()
$cpu=Get-CimInstance Win32_Processor | Select-Object -First 1 Name,NumberOfCores,NumberOfLogicalProcessors
$gpu=@(Get-CimInstance Win32_VideoController | Select-Object Name,PNPDeviceID)
$memory=@(Get-CimInstance Win32_PhysicalMemory | Select-Object Capacity,ConfiguredClockSpeed,Manufacturer,PartNumber)
$disks=@(Get-Disk | Select-Object Number,FriendlyName,BusType)
$volumes=@{}; foreach($letter in @('C','D')){ $part=Get-Partition -DriveLetter $letter -ErrorAction SilentlyContinue; if($part){$volumes[$letter]=$part.DiskNumber} }
$displays=@(); try { Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class AidaDisplayDpi { [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr context); }'; $null=[AidaDisplayDpi]::SetProcessDpiAwarenessContext([IntPtr](-4)); Add-Type -AssemblyName System.Windows.Forms; $displays=@([System.Windows.Forms.Screen]::AllScreens | ForEach-Object { @{Name=$_.DeviceName;Primary=$_.Primary;Width=$_.Bounds.Width;Height=$_.Bounds.Height} }) } catch {}
@{cpu=$cpu;gpu=$gpu;memory=$memory;disks=$disks;volumes=$volumes;displays=$displays}|ConvertTo-Json -Depth 5 -Compress
"""


class InventoryService:
    _instance = None

    def __init__(self):
        self.snapshot = None
        self.updated_at = 0
        self.last_attempt = 0
        self.refreshing = False
        self.topology = core_topology()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _refresh(self):
        try:
            result = subprocess.run(["powershell.exe", "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", INVENTORY_SCRIPT], capture_output=True, timeout=25, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            if result.returncode == 0:
                data = json.loads(result.stdout.decode("utf-8-sig"))
                data["topology"] = self.topology
                self.snapshot = data
                self.updated_at = time.time()
        except (OSError, ValueError, subprocess.TimeoutExpired):
            pass
        finally:
            self.refreshing = False

    def get_snapshot(self):
        if not self.refreshing and time.time() - self.last_attempt > 60:
            self.last_attempt = time.time()
            self.refreshing = True
            threading.Thread(target=self._refresh, daemon=True, name="hardware-inventory").start()
        return self.snapshot if self.updated_at and time.time() - self.updated_at < 180 else None

    def metadata(self):
        return source_meta("Windows CIM / topology", self.updated_at, 180, available=self.snapshot is not None)
