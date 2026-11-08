"""End-to-end isolation, idempotency and model tests against a real backend.
Creates two disposable guest users. Removes its own test records on completion.
No tokens or secrets are printed.
"""
import json
import os
import ssl
import time
import urllib.error
import urllib.request
import uuid
from cloud import ROOT, PROJECT, api as google_api

base = os.getenv('BACKEND_URL') or (ROOT / '.local/backend-url').read_text().strip()
config = json.loads((ROOT / '.local/firebase-config.json').read_text())
context = ssl.create_default_context(cafile='/etc/ssl/cert.pem')


def request(url, data=None, method='GET', token=None, expected=200):
    headers = {'Content-Type': 'application/json', 'User-Agent': 'ReadingJournal/0.1'}
    if token: headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=85, context=context) as response:
            status = response.status
            result = json.load(response)
    except urllib.error.HTTPError as error:
        status = error.code
        result = json.loads(error.read())
    assert status == expected, f'Unexpected HTTP {status}; expected {expected}: {result}'
    return result


users = []
try:
    assert request(base + '/health')['ok']
    request(base + '/v1/data', expected=401)
    for _ in range(2):
        users.append(request('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + config['apiKey'], {'returnSecureToken': True}, 'POST'))
    first, second = users
    token = first['idToken']
    book_id = 'smoke-' + uuid.uuid4().hex
    book = {'title': 'Disposable test book', 'author': 'Test', 'unit': 'pages', 'totalPages': 200, 'baselinePosition': 0, 'status': 'Reading', 'topics': ['Fiction', 'Design']}
    request(base + '/v1/books/' + book_id, book, 'PUT', token)
    now = int(time.time() * 1000)
    session_id = 'smoke-' + uuid.uuid4().hex
    session = {'bookId': book_id, 'startedAt': now - 1200000, 'endedAt': now, 'durationSeconds': 1200, 'startPosition': 0, 'endPosition': 12, 'unit': 'pages', 'location': 'Library', 'reaction': 'Liked it', 'stopReason': 'Time was up', 'topics': [], 'note': '', 'source': 'manual'}
    request(base + '/v1/sessions/' + session_id, session, 'PUT', token)
    request(base + '/v1/sessions/' + session_id, session, 'PUT', token)
    data = request(base + '/v1/data', token=token)
    assert len(data['sessions']) == 1 and data['books'][0]['position'] == 12
    stats = request(base + '/v1/stats?days=7&timezone=America%2FNew_York', token=token)
    assert stats['totalMinutes'] == 20 and stats['topics']['Fiction'] == 600
    assert request(base + '/v1/data', token=second['idToken'])['books'] == []
    request(base + '/v1/sessions/foreign', session, 'PUT', second['idToken'], expected=404)
    document = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/users/{first["localId"]}/books/{book_id}'
    request(document, token=second['idToken'], expected=403)
    request(document, token=token)
    request(document, {'fields': {}}, 'PATCH', token, expected=403)
    print('PASS: authenticated save, retry deduplication, statistics, cross-user isolation and direct-write denial.', flush=True)
    report = request(base + '/v1/insights', {'days': 7, 'timezone': 'America/New_York'}, 'POST', token)
    assert len(report['cards']) == 3
    cached = request(base + '/v1/insights', {'days': 7, 'timezone': 'America/New_York'}, 'POST', token)
    assert cached['cached'] and cached['id'] == report['id']
    print('PASS: real Tinker insights generated, evidence checked, persisted and reused from cache.', flush=True)
    request(base + '/v1/insights/' + report['id'] + '/feedback', {'value': 'helpful', 'reason': ''}, 'PUT', token)
    request(base + '/v1/sessions/' + session_id, method='DELETE', token=token)
    assert request(base + '/v1/data', token=token)['books'][0]['position'] == 0
    (ROOT / '.local/smoke-result.json').write_text(json.dumps({'passed': True, 'backend': base, 'testedAt': int(time.time() * 1000)}, indent=2))
finally:
    for user in users:
        path = f'firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/users/{user["localId"]}'
        for collection in ['books', 'sessions', 'insights', 'private']:
            for document in google_api(path + '/' + collection).get('documents', []):
                google_api('firestore.googleapis.com/v1/' + document['name'], method='DELETE')
        google_api(path, method='DELETE')
        request('https://identitytoolkit.googleapis.com/v1/accounts:delete?key=' + config['apiKey'], {'idToken': user['idToken']}, 'POST')
    print('Disposable test users and their records removed.', flush=True)
