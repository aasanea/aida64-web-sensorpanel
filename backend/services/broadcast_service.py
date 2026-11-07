"""Read the dedicated StreamDock broadcast controller; guard app output routes."""
import asyncio
import json
import math
import os
from pathlib import Path
import subprocess
import time

DATA = Path(os.environ.get('APPDATA', '.')) / 'LoadingSonarControl'


def read_controller():
    try:
        value = json.loads((DATA / 'broadcast-state.json').read_text(encoding='utf-8'))
        observed=value.get('observed_at')
        if isinstance(observed,bool) or not isinstance(observed,(int,float)) or not math.isfinite(observed) or abs(time.time()-observed) > 3:
            return {'available':False,'reason':'controller_stale'}
        return dict(value, available=value.get('available') is True)
    except (OSError, ValueError, TypeError):
        return {'available':False,'reason':'controller_unavailable'}


class BroadcastService:
    _instance = None

    def __init__(self):
        self.task = None
        self.route_errors = []
        self.attempted = {}

    @classmethod
    def get_instance(cls):
        if cls._instance is None: cls._instance=cls()
        return cls._instance

    def get_snapshot(self):
        return dict(read_controller(), routing_errors=list(self.route_errors))

    async def start(self):
        self.task=asyncio.create_task(self._guard())

    async def stop(self):
        if self.task:
            self.task.cancel()
            try: await self.task
            except asyncio.CancelledError: pass

    def guard_once(self, applications, devices):
        try:
            config=json.loads((DATA/'broadcast-config.json').read_text(encoding='utf-8'))
            if config.get('enabled') is not True: return
            targets={d.get('role'):d['id'] for d in devices}
            backup=Path(config['backupDirectory'])/'app-routing.json'
            records=json.loads(backup.read_text(encoding='utf-8')) if backup.exists() else {}
            errors=[]
            for item in applications:
                discord=item['executable'].lower()=='discord.exe'
                if not discord and (not item.get('active') or item.get('in_program_bus')): continue
                target=targets.get('chatRender' if discord else 'game')
                if not target or item['device_id']==target: continue
                key=(item['pid'],target)
                if self.attempted.get(key,0)>=3: continue
                self.attempted[key]=self.attempted.get(key,0)+1
                args=['C:/MyTools/ProgramAudioRoute.exe']
                try:
                    record_key=str(item['pid'])
                    if record_key not in records:
                        previous=subprocess.run(args+['get',record_key],capture_output=True,text=True,timeout=5,creationflags=0x08000000,check=True)
                        records[record_key]={'executable':item['executable'],'before':json.loads(previous.stdout)}
                        backup.write_text(json.dumps(records,indent=2),encoding='utf-8')
                    subprocess.run(args+['set',record_key,target],capture_output=True,timeout=5,creationflags=0x08000000,check=True)
                except (OSError,ValueError,subprocess.SubprocessError):
                    errors.append({'application':item['name'],'reason':'route_not_applied'})
            self.route_errors=errors
        except (OSError,ValueError,KeyError):
            pass

    async def _guard(self):
        from .audio_meter_service import AudioMeterService
        from .sonar_service import SonarService
        while True:
            apps=AudioMeterService.get_instance().get_snapshot().get('applications',[])
            await asyncio.to_thread(self.guard_once, apps, SonarService.get_instance().get_session_devices())
            await asyncio.sleep(2)
