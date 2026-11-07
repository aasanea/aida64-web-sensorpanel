"""Read-only comparison of the dashboard's Sonar fields with Sonar itself."""
import datetime
import json
import os
from pathlib import Path
import re
import urllib.request

def get(url):
    with urllib.request.urlopen(url, timeout=5) as response:
        return json.load(response)

out = Path(__file__).parent / 'artifacts' / 'av-card-20261103'
out.mkdir(parents=True, exist_ok=True)
log = (Path(os.environ['APPDATA']) / 'LoadingSonarControl' / 'plugin.log').read_text(encoding='utf-8')
endpoint = re.findall(r'Sonar connected[^\n]*: (http://127\.0\.0\.1:\d+)', log)[-1]
dashboard = get('http://localhost:8088/api/sensors')
raw = get(endpoint + '/volumeSettings/streamer')
checks = []
for channel, role in [('master', None), ('game', 'game'), ('chat', 'chatRender'), ('media', 'media'), ('aux', 'aux'), ('mic', 'chatCapture')]:
    item = raw['masters'] if role is None else raw['devices'][role]
    for route in ['monitoring', 'streaming']:
        expected = item['stream'][route]
        actual = dashboard['sonar_channels'][channel][route]
        checks.append({'channel': channel, 'path': route,
                       'volumeMatches': actual['volume'] == round(expected['volume'] * 100, 1),
                       'muteMatches': actual['muted'] == expected['muted']})
result = {'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'display': {key: dashboard.get(key) for key in ['fps', 'fps_source', 'display_hz', 'display_res', 'frametime_ms', 'audio_mic_muted']},
          'sonarChecks': checks, 'routes': get(endpoint + '/streamRedirections'),
          'limitation': 'Sequential read-only samples; hardware FPS accuracy under a game is not independently benchmarked.'}
(out / 'live-readings.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'display': result['display'], 'matchedSonarPaths': sum(c['volumeMatches'] and c['muteMatches'] for c in checks), 'totalPaths': len(checks)}, ensure_ascii=False))
assert all(c['volumeMatches'] and c['muteMatches'] for c in checks), 'Source changed between samples; inspect the saved evidence.'
