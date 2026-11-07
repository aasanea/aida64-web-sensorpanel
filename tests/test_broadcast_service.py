import ctypes as ct
import json
import sys
import time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from services import broadcast_service as broadcast
from services import audio_app_sessions as sessions
from services.sonar_service import SonarService


def test_controller_rejects_stale_future_invalid_or_missing(tmp_path,monkeypatch):
    monkeypatch.setattr(broadcast,'DATA',tmp_path)
    for observed in [time.time()-4,time.time()+4,float('nan'),True,None]:
        (tmp_path/'broadcast-state.json').write_text(json.dumps({'available':True,'observed_at':observed}))
        assert broadcast.read_controller()['available'] is False
    (tmp_path/'broadcast-state.json').write_text(json.dumps({'available':True,'observed_at':time.time(),'muted':True}))
    assert broadcast.read_controller()['muted'] is True
    (tmp_path/'broadcast-state.json').write_text('{')
    assert broadcast.read_controller()['available'] is False


def test_capture_route_discovered_dynamically_and_ambiguity_is_unavailable():
    d=dict(id='dynamic-capture',dataFlow='capture',role='stream',isVad=True,state='active')
    assert SonarService.select_meter_routes([d],[],'stream')['stream_input']['id']=='dynamic-capture'
    assert SonarService.select_meter_routes([d,dict(d,id='duplicate')],[],'stream')['stream_input'] is None


def test_app_activity_uses_real_peaks_and_ignores_invalid_values(monkeypatch):
    now=[10.0];peak=[.2]
    monkeypatch.setattr(sessions.time,'monotonic',lambda:now[0])
    def call(_pointer,_index,*args): args[0][1]._obj.value=peak[0]
    monkeypatch.setattr(sessions,'com_call',call)
    reader=sessions.AppSessionReader(None);reader.last_scan=10
    entry=dict(pid=1,device_id='game',executable='Riff.exe',name='Riff',emoji='🎵',role='game',meter=ct.c_void_p(1),session_muted=False,session_volume=1)
    reader.entries=[entry]
    assert reader.sample([])[0]['active']
    peak[0]=0;now[0]=10.4
    assert reader.sample([])[0]['active']  # Short silence keeps the chip stable.
    reader.last_active.clear();assert not reader.sample([])[0]['active']
    peak[0]=float('nan');assert reader.sample([])==[]
    peak[0]=.2;entry['session_muted']=True;assert not reader.sample([])[0]['active']


def test_route_guard_saves_previous_route_before_changing_and_excludes_discord(tmp_path,monkeypatch):
    monkeypatch.setattr(broadcast,'DATA',tmp_path)
    (tmp_path/'broadcast-config.json').write_text(json.dumps({'enabled':True,'backupDirectory':str(tmp_path)}))
    calls=[]
    class Response: stdout='{"0":"","1":"","2":""}'
    def run(args,**kwargs):
        calls.append(args)
        if args[1]=='set':
            records=json.loads((tmp_path/'app-routing.json').read_text())
            assert str(args[2]) in records
        return Response()
    monkeypatch.setattr(broadcast.subprocess,'run',run)
    apps=[dict(pid=1,executable='Discord.exe',device_id='game',name='Discord',active=False,in_program_bus=True),dict(pid=2,executable='Riff.exe',device_id='physical',name='Riff',active=True,in_program_bus=False),dict(pid=3,executable='Chrome.exe',device_id='game',name='Chrome',active=True,in_program_bus=True)]
    service=broadcast.BroadcastService();service.guard_once(apps,[dict(role='game',id='game'),dict(role='chatRender',id='chat')])
    assert [args[2:] for args in calls if args[1]=='set']==[['1','chat'],['2','game']]
    assert service.route_errors==[]
