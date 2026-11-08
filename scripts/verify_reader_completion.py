"""Verify only the disposable browser-QA reader account; never modifies real users."""
import json, ssl, urllib.request
from cloud import ROOT
cfg = json.loads((ROOT / '.local/firebase-config.json').read_text())
a = json.loads((ROOT / '.local/reader-test-account.json').read_text())
assert a['email'].startswith('reader-qa-') and a['email'].endswith('@example.invalid')
ctx = ssl.create_default_context(cafile='/etc/ssl/cert.pem')
def request(url, body=None, token=None, method=None):
    headers = {'Content-Type': 'application/json'}
    if token: headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    with urllib.request.urlopen(req, context=ctx, timeout=40) as r: return json.load(r)
login = request('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + cfg['apiKey'], {**{k:a[k] for k in ['email','password']}, 'returnSecureToken':True})
assert login['localId'] == a['uid']
token = login['idToken']
base = (ROOT / '.local/backend-url').read_text().strip()
data = request(base + '/v1/data', token=token)
assert len(data['sessions']) == 1, 'Expected exactly one completed reader session'
s = data['sessions'][0]
assert s['source'] == 'reader'
assert s['durationSeconds'] > 180
assert s['startPosition'] == 0 and s['endPosition'] == 4
assert s['location'] == 'Library' and s['reaction'] == 'Liked it'
book = next(b for b in data['books'] if b['id'] == s['bookId'])
assert book['position'] == 4
visits = request(base + '/v1/reader/books/' + book['id'] + '/visits', token=token)['visits']
assert len({v['page'] for v in visits if v['sessionId'] == s['id']}) == 4
active = sum(v['activeMs'] for v in visits if v['sessionId'] == s['id'])
assert 0 <= active - s['durationSeconds'] * 1000 < 1000
body = {k:v for k,v in s.items() if k not in ['id','createdAt','updatedAt']}
request(base + '/v1/sessions/' + s['id'], body, token, 'PUT')
assert len(request(base + '/v1/data', token=token)['sessions']) == 1
print('PASS: one reader session, >3 active minutes, 4 pages, location/reaction, exact page-event time, retry deduplication.')
print('Saved active reading seconds:', s['durationSeconds'])
