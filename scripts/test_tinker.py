"""Use a synthetic reading summary for a minimal live inference test."""
import json
import os
import ssl
import urllib.request
import urllib.error
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
model = os.getenv('TINKER_MODEL', 'thinkingmachines/Inkling-Small:peft:262144:sampling-nvfp4')
key = (ROOT / '.local/tinker.key').read_text().strip()
request = urllib.request.Request('https://tinker.thinkingmachines.dev/services/tinker-prod/oai/api/v1/chat/completions',
    data=json.dumps({'model': model, 'max_tokens': 600, 'messages': [
        {'role':'system','content':'Reply with one short reading suggestion grounded only in the supplied synthetic data. Plain text.'},
        {'role':'user','content':'Synthetic test data: 5 home reading sessions averaged 16.8 minutes; 3 library sessions averaged 32 minutes. Goal: build a reading habit.'}
    ]}).encode(), headers={'Authorization':'Bearer ' + key, 'Content-Type':'application/json', 'User-Agent':'ReadingJournal/0.1'})
try:
    with urllib.request.urlopen(request, timeout=90, context=ssl.create_default_context(cafile='/etc/ssl/cert.pem')) as response:
        result = json.load(response)
    answer = result.get('choices', [{}])[0].get('message', {}).get('content', '')
    summary = {'ok': bool(answer), 'model': model, 'answer': answer, 'usage': result.get('usage')}
    (ROOT / '.local/tinker-probe.json').write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary))
except urllib.error.HTTPError as error:
    details = error.read().decode()
    print(json.dumps({'ok': False, 'status': error.code, 'detail': details.replace(key, '[REDACTED]')[:1200]}))
    raise SystemExit(1)
