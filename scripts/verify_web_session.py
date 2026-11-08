"""Verify the disposable browser-test journal from another authenticated client.

Run after logging a session in the website with .local/web-test-account.json.
Use --cleanup after signing the test account out of the browser.
"""
import json
import ssl
import sys
import urllib.request
from cloud import ROOT, PROJECT, api as google_api

account_file = ROOT / '.local/web-test-account.json'
account = json.loads(account_file.read_text())
assert account['email'].startswith('web-qa-') and account['email'].endswith('@example.invalid')
config = json.loads((ROOT / '.local/firebase-config.json').read_text())
context = ssl.create_default_context(cafile='/etc/ssl/cert.pem')


def request(url, body=None, token=None, method=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                 headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=90, context=context) as response:
        return json.load(response)


login = request('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + config['apiKey'],
                {'email': account['email'], 'password': account['password'], 'returnSecureToken': True})
assert login['localId'] == account['uid']
token = login['idToken']
base = (ROOT / '.local/backend-url').read_text().strip()

if '--cleanup' in sys.argv:
    path = f'firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/users/{account["uid"]}'
    for collection in ['books', 'sessions', 'insights', 'private']:
        for doc in google_api(path + '/' + collection).get('documents', []):
            google_api('firestore.googleapis.com/v1/' + doc['name'], method='DELETE')
    google_api(path, method='DELETE')
    request('https://identitytoolkit.googleapis.com/v1/accounts:delete?key=' + config['apiKey'], {'idToken': token})
    account_file.unlink()
    print('Disposable web-test account and its private records removed.')
else:
    data = request(base + '/v1/data', token=token)
    assert len(data['books']) == 1 and data['books'][0]['title'] == 'Phone & Web Test Book'
    assert len(data['sessions']) >= 1 and data['books'][0]['position'] == 12
    session = data['sessions'][0]
    assert session['startPosition'] == 0 and session['endPosition'] == 12
    assert session['location'] == 'Library'
    assert request(base + '/v1/community', token=token)['testMode'] is False
    print('PASS: independent sign-in sees the exact book, saved session, page progress and location from the browser.')
    profile = data['profile']
    request(base + '/v1/profile', {'goal': 'Synced from another device', 'topics': profile['topics'],
                                 'timezone': profile['timezone']}, token, 'PUT')
    print('Second client updated reading goal; return to the browser to verify focus refresh.')
