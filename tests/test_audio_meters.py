import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from services.sonar_service import SonarService
from services.audio_meter_service import AudioMeterService


def device(id, flow, role='none', vad=False):
    return dict(id=id, dataFlow=flow, role=role, isVad=vad, state='active', friendlyName=id)


def test_stream_routes_follow_sonar_not_windows_defaults():
    devices=[device('processed','capture','chatCapture',True),device('raw','capture'),device('headset','render'),device('bus','render'),device('other','render')]
    routes=[dict(streamRedirectionId=key,deviceId=id,isRunning=True) for key,id in [('mic','raw'),('monitoring','headset'),('streaming','bus')]]
    selected=SonarService.select_meter_routes(devices,routes,'stream')
    assert {key:val['id'] for key,val in selected.items() if val}==dict(mic='processed',input='raw',monitoring='headset',streaming='bus')
    assert selected['stream_input'] is None
    routes[1]['isRunning']=False
    assert SonarService.select_meter_routes(devices,routes,'stream')['monitoring'] is None
    devices[0]['state']='disabled'
    assert SonarService.select_meter_routes(devices,routes,'stream')['mic'] is None


def test_classic_ambiguous_outputs_are_not_guessed():
    devices=[device('one','render'),device('two','render')]
    routes=[dict(id='game',deviceId='one',isRunning=True),dict(id='media',deviceId='two',isRunning=True)]
    selected=SonarService.select_meter_routes(devices,routes,'classic')
    assert selected['monitoring'] is None and selected['streaming'] is None
    routes[1]['deviceId']='one'
    assert SonarService.select_meter_routes(devices,routes,'classic')['monitoring']['id']=='one'


class Reader:
    def __init__(self): self.calls=[]
    def retain(self, ids): self.ids=ids
    def read(self, id):
        self.calls.append(id)
        if id=='missing': raise OSError('unplugged')
        return 0.0


def test_silence_is_real_zero_and_disconnect_is_unavailable():
    reader=Reader();service=AudioMeterService()
    service.sample(reader,{'mic':{'id':'shared'},'monitoring':{'id':'shared'},'streaming':{'id':'missing'}})
    routes=service.get_snapshot()['routes']
    assert routes['mic']['peak']==0 and routes['mic']['status']=='live'
    assert routes['streaming']['peak'] is None and routes['streaming']['status']=='unavailable'
    assert reader.calls==['shared','missing']
    service.sample(reader,{})
    assert service.get_snapshot()['routes']=={} and reader.ids==set()


def test_expired_peaks_and_routing_clear_without_transport_failure():
    service=AudioMeterService();service._snapshot={'observed_at':time.time()-1,'routes':{'mic':{'peak':1}}}
    assert service.get_snapshot()['routes']=={}
    sonar=SonarService();sonar._data['sonar_connected']=True;sonar._meter_routes={'mic':{'id':'old'}};sonar._routes_observed_at=time.time()-3
    assert sonar.get_meter_routes()=={}


def test_stop_clears_sample():
    import asyncio
    service=AudioMeterService();service.sample(Reader(),{'mic':{'id':'raw'}})
    asyncio.run(service.stop())
    assert service.get_snapshot()['routes']=={}


def test_audio_opt_in_and_serialized_sends():
    import asyncio
    from api.websocket import ConnectionManager
    class Client:
        def __init__(self): self.messages=[]; self.busy=False
        async def accept(self): pass
        async def send_json(self,data):
            assert not self.busy
            self.busy=True
            await asyncio.sleep(0)
            self.messages.append(data)
            self.busy=False
    async def check():
        manager=ConnectionManager();legacy=Client();modern=Client()
        await manager.connect(legacy);await manager.connect(modern)
        manager.audio_subscribers.add(modern)
        await asyncio.gather(manager.broadcast_json({'type':'audio-levels'},audio_only=True),manager.broadcast_json({'cpu_temp':42}))
        assert legacy.messages==[{'cpu_temp':42}]
        assert len(modern.messages)==2
        await manager.disconnect(modern)
        assert not manager.audio_subscribers and modern not in manager._send_locks
    asyncio.run(check())


def test_slow_audio_client_does_not_stall_healthy_clients():
    import asyncio
    from api.websocket import ConnectionManager
    class Client:
        def __init__(self,slow=False): self.slow=slow;self.sent=False
        async def accept(self): pass
        async def send_json(self,data):
            if self.slow: await asyncio.sleep(10)
            self.sent=True
    async def check():
        manager=ConnectionManager();slow=Client(True);healthy=Client()
        await manager.connect(slow);await manager.connect(healthy)
        manager.audio_subscribers.update([slow,healthy])
        started=time.monotonic()
        await manager.broadcast_json({'type':'audio-levels'},audio_only=True)
        assert healthy.sent and not slow.sent and slow not in manager.active_connections
        assert time.monotonic()-started<1
    asyncio.run(check())
