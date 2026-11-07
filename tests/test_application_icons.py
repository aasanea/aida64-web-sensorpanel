import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from services.application_icons import ApplicationIconCache,is_audio_observer


def test_native_icon_cache_is_reused_and_changes_after_executable_update(tmp_path):
    source=tmp_path/'app.exe';source.write_bytes(b'version1');calls=[]
    def extract(path):calls.append(path);return b'actual resource'
    cache=ApplicationIconCache(tmp_path/'icons',extract)
    first=cache.get(source)
    assert cache.get(source)==first and len(calls)==1
    assert (tmp_path/'icons'/Path(first).name).read_bytes()==b'actual resource'
    source.write_bytes(b'new executable version')
    assert cache.get(source)!=first and len(calls)==2


def test_missing_resources_do_not_turn_into_invented_icons(tmp_path):
    source=tmp_path/'noicon.exe';source.write_bytes(b'no resource')
    def extract(_path):raise OSError('No embedded icon')
    cache=ApplicationIconCache(tmp_path/'icons',extract)
    assert cache.get(source) is None
    assert cache.get(tmp_path/'not-installed.exe') is None
    assert not (tmp_path/'icons').exists()


def test_only_known_steelseries_audio_observer_is_excluded():
    assert is_audio_observer('C:/Program Files/SteelSeries/GG/apps/engine/engineApps/audiovisualizer/AudioSync.exe')
    assert not is_audio_observer('C:/MyMusic/AudioSync.exe')
    assert not is_audio_observer(None)
    assert not is_audio_observer('C:/Program Files/Google/Chrome/Application/chrome.exe')
