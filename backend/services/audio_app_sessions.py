"""Read application session peaks. Never captures or records audio buffers."""
import ctypes as ct
import math
import time
import psutil
from .application_icons import ApplicationIconCache, is_audio_observer
from .audio_meter_service import GUID, com_call, release


def app_identity(pid):
    try:
        process = psutil.Process(pid)
        executable = process.name()
        key = executable.lower()
        if key == 'discord.exe': return executable, 'Discord', '💬'
        if key == 'riff.exe': return executable, 'Riff', '🎵'
        if 'tiktok' in key: return executable, 'TikTok', '🎶'
        if key == 'hd-player.exe':
            tiktok = any('musically' in arg or 'zhiliao' in arg for arg in process.cmdline())
            return executable, 'TikTok' if tiktok else 'Android', '🎶' if tiktok else '📱'
        browsers = {'comet.exe':'Comet', 'chrome.exe':'Chrome', 'msedge.exe':'Edge', 'firefox.exe':'Firefox', 'brave.exe':'Brave'}
        if key in browsers: return executable, browsers[key], '🌐'
        if key == 'spotify.exe': return executable, 'Spotify', '🎧'
        return executable, executable.removesuffix('.exe'), '🔊'
    except (psutil.Error, OSError):
        return '', 'برنامج غير معروف', '🔊'


class AppSessionReader:
    def __init__(self, endpoint_reader):
        self.reader = endpoint_reader
        self.entries = []
        self.last_scan = 0
        self.last_active = {}
        self.icons = ApplicationIconCache()

    def close(self):
        for item in self.entries:
            release(item['meter'])
        self.entries = []

    def scan(self, devices):
        self.close()
        for device in devices:
            endpoint, manager, enumerator = ct.c_void_p(), ct.c_void_p(), ct.c_void_p()
            try:
                com_call(self.reader.enumerator, 5, (ct.c_wchar_p, device['id']), (ct.POINTER(ct.c_void_p), ct.byref(endpoint)))
                iid = GUID('77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F')
                com_call(endpoint, 3, (ct.POINTER(GUID), ct.byref(iid)), (ct.c_uint32, 23), (ct.c_void_p, None), (ct.POINTER(ct.c_void_p), ct.byref(manager)))
                com_call(manager, 5, (ct.POINTER(ct.c_void_p), ct.byref(enumerator)))
                count = ct.c_int()
                com_call(enumerator, 3, (ct.POINTER(ct.c_int), ct.byref(count)))
                for index in range(count.value):
                    control, control2, meter, volume = (ct.c_void_p() for _ in range(4))
                    try:
                        com_call(enumerator, 4, (ct.c_int, index), (ct.POINTER(ct.c_void_p), ct.byref(control)))
                        iid = GUID('bfb7ff88-7239-4fc9-8fa2-07c950be9c6d')
                        com_call(control, 0, (ct.POINTER(GUID), ct.byref(iid)), (ct.POINTER(ct.c_void_p), ct.byref(control2)))
                        pid, state = ct.c_uint32(), ct.c_int()
                        com_call(control2, 14, (ct.POINTER(ct.c_uint32), ct.byref(pid)))
                        com_call(control, 3, (ct.POINTER(ct.c_int), ct.byref(state)))
                        if not pid.value or state.value == 2: continue
                        executable, name, emoji = app_identity(pid.value)
                        if not executable or executable.lower() in ('steelseriessonar.exe','audiodg.exe','system'): continue
                        try: executable_path=psutil.Process(pid.value).exe()
                        except (psutil.Error,OSError): executable_path=None
                        if is_audio_observer(executable_path): continue
                        icon_url=self.icons.get(executable_path)
                        iid = GUID('C02216F6-8C67-4B5B-9D00-D008E73E0064')
                        com_call(control, 0, (ct.POINTER(GUID), ct.byref(iid)), (ct.POINTER(ct.c_void_p), ct.byref(meter)))
                        muted, gain = ct.c_int(), ct.c_float()
                        iid = GUID('87ce5498-68d6-44e5-9215-6da47ef883d8')
                        com_call(control, 0, (ct.POINTER(GUID), ct.byref(iid)), (ct.POINTER(ct.c_void_p), ct.byref(volume)))
                        com_call(volume, 6, (ct.POINTER(ct.c_int), ct.byref(muted)))
                        com_call(volume, 4, (ct.POINTER(ct.c_float), ct.byref(gain)))
                        self.entries.append({'pid':pid.value,'executable':executable,'name':name,'icon_url':icon_url,'device_id':device['id'],'role':device.get('role'),'meter':meter,'session_muted':bool(muted.value),'session_volume':gain.value})
                        meter = ct.c_void_p()  # Ownership transferred.
                    except (OSError, ValueError):
                        pass
                    finally:
                        for pointer in (control, control2, meter, volume): release(pointer)
            except (OSError, ValueError):
                pass
            finally:
                for pointer in (endpoint, manager, enumerator): release(pointer)
        self.last_scan = time.monotonic()
        live_keys = {(entry['pid'], entry['device_id']) for entry in self.entries}
        self.last_active = {key: value for key, value in self.last_active.items() if key in live_keys}

    def sample(self, devices):
        if time.monotonic() - self.last_scan > 1:
            self.scan(devices)
        now = time.monotonic()
        result = {}
        for entry in self.entries:
            try:
                peak = ct.c_float()
                com_call(entry['meter'], 3, (ct.POINTER(ct.c_float), ct.byref(peak)))
                if not math.isfinite(peak.value) or not 0 <= peak.value <= 1:
                    continue
                if peak.value > 0.0001 and not entry['session_muted'] and entry['session_volume'] > 0:
                    self.last_active[(entry['pid'],entry['device_id'])] = now
                active = now-self.last_active.get((entry['pid'],entry['device_id']),-100) < 1.2
                item = {key:value for key,value in entry.items() if key != 'meter'}
                item.update(peak=max(0,min(1,peak.value)),active=active,excluded=entry['executable'].lower()=='discord.exe',in_program_bus=entry.get('role') in ('game','media','aux'))
                key = (item['pid'],item['device_id'])
                if key not in result or item['peak']>result[key]['peak']: result[key]=item
            except OSError:
                pass
        return list(result.values())
