"""Read-only Windows endpoint peaks. No capture buffers, recording or audio playback."""
import asyncio
import ctypes as ct
import math
import sys
import threading
import time
import uuid


class GUID(ct.Structure):
    _fields_ = [("bytes", ct.c_ubyte * 16)]

    def __init__(self, value):
        super().__init__()
        self.bytes[:] = uuid.UUID(value).bytes_le


def com_call(pointer, index, *args):
    types, values = zip(*args) if args else ((), ())
    table = ct.cast(pointer, ct.POINTER(ct.POINTER(ct.c_void_p))).contents
    method = ct.WINFUNCTYPE(ct.c_int32, ct.c_void_p, *types)(table[index])
    result = method(pointer, *values)
    if result < 0:
        raise OSError(f"Core Audio HRESULT {result & 0xffffffff:08X}")


def release(pointer):
    if pointer and pointer.value:
        com_call(pointer, 2)


class WindowsPeakReader:
    """Every COM object is created, read and released on one worker thread."""
    def __init__(self):
        self.ole = ct.OleDLL('ole32')
        self.ole.CoInitializeEx(None, 0)
        self.enumerator = ct.c_void_p()
        clsid = GUID('BCDE0395-E52F-467C-8E3D-C4579291692E')
        iid = GUID('A95664D2-9614-4F35-A746-DE8DB63617E6')
        try:
            self.ole.CoCreateInstance(ct.byref(clsid), None, 1, ct.byref(iid), ct.byref(self.enumerator))
        except OSError:
            self.ole.CoUninitialize()
            raise
        self.meters = {}

    def read(self, device_id):
        if device_id not in self.meters:
            device, meter = ct.c_void_p(), ct.c_void_p()
            try:
                com_call(self.enumerator, 5, (ct.c_wchar_p, device_id), (ct.POINTER(ct.c_void_p), ct.byref(device)))
                iid = GUID('C02216F6-8C67-4B5B-9D00-D008E73E0064')
                com_call(device, 3, (ct.POINTER(GUID), ct.byref(iid)), (ct.c_uint32, 23), (ct.c_void_p, None), (ct.POINTER(ct.c_void_p), ct.byref(meter)))
                self.meters[device_id] = meter
            finally:
                release(device)
        peak = ct.c_float()
        try:
            com_call(self.meters[device_id], 3, (ct.POINTER(ct.c_float), ct.byref(peak)))
        except OSError:
            release(self.meters.pop(device_id))
            raise
        if not math.isfinite(peak.value) or not 0 <= peak.value <= 1:
            raise ValueError('Invalid peak')
        return round(peak.value, 6)

    def retain(self, ids):
        for device_id in list(self.meters):
            if device_id not in ids:
                release(self.meters.pop(device_id))

    def close(self):
        self.retain(set())
        release(self.enumerator)
        self.ole.CoUninitialize()


class AudioMeterService:
    _instance = None
    interval = 1 / 30

    def __init__(self):
        self._stop = threading.Event()
        self._thread = None
        self._snapshot = self.empty()
        self._apps = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @staticmethod
    def empty():
        return {'observed_at': None, 'source': 'Windows Core Audio / endpoint peak', 'routes': {}}

    def get_snapshot(self):
        sample = self._snapshot
        if not sample['observed_at'] or time.time() - sample['observed_at'] > 0.5:
            return self.empty()
        return sample

    async def start(self):
        if sys.platform != 'win32' or self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name='endpoint-peaks', daemon=True)
        self._thread.start()

    async def stop(self):
        self._stop.set()
        if self._thread:
            await asyncio.to_thread(self._thread.join)
        self._thread = None
        self._snapshot = self.empty()

    def sample(self, reader, routes):
        result = {}
        reader.retain({item['id'] for item in routes.values() if item})
        # Shared endpoints are read once per sample; all paths get the same timestamp.
        peaks = {}
        for key, device in routes.items():
            value = {**(device or {}), 'peak': None, 'status': 'unavailable'}
            if device:
                try:
                    if device['id'] not in peaks:
                        peaks[device['id']] = reader.read(device['id'])
                    value.update(peak=peaks[device['id']], status='live')
                except (OSError, ValueError):
                    pass
            result[key] = value
        from .sonar_service import SonarService
        applications = self._apps.sample(SonarService.get_instance().get_session_devices()) if self._apps else []
        self._snapshot = {'observed_at': time.time(), 'source': 'Windows Core Audio / endpoint peak', 'routes': result, 'applications':applications}

    def _run(self):
        from services.sonar_service import SonarService
        while not self._stop.is_set():
            reader = None
            try:
                reader = WindowsPeakReader()
                from services.audio_app_sessions import AppSessionReader
                self._apps = AppSessionReader(reader)
                while not self._stop.is_set():
                    started = time.monotonic()
                    self.sample(reader, SonarService.get_instance().get_meter_routes())
                    self._stop.wait(max(0, self.interval - (time.monotonic() - started)))
            except (OSError, ValueError):
                self._snapshot = self.empty()
            finally:
                if self._apps:
                    self._apps.close()
                    self._apps = None
                if reader:
                    reader.close()
            self._stop.wait(2)
