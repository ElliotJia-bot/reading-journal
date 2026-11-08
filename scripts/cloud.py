"""Project-scoped Google Cloud administration. Tokens stay in process memory."""
import json
import os
import subprocess
import sys
import time
import urllib.error
import ssl
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = 'project-b00660ba-d6d4-4c9a-a05'
BILLING = '0165AD-23789C-03FBDF'
REGION = 'us-central1'
GCLOUD = str(ROOT / '.tools/google-cloud-sdk/bin/gcloud')
ENV = dict(os.environ, CLOUDSDK_CONFIG=str(ROOT / '.local/gcloud'),
           CLOUDSDK_PYTHON='/Library/Frameworks/Python.framework/Versions/3.10/bin/python3')


def cli(*args, raw=False):
    result = subprocess.run([GCLOUD, *args, '--project=' + PROJECT, '--quiet'], env=ENV,
                            text=True, capture_output=True, check=True)
    return result.stdout if raw else json.loads(result.stdout or '{}')


def api(path, data=None, method=None):
    token = cli('auth', 'print-access-token', raw=True).strip()
    request = urllib.request.Request('https://' + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT},
        method=method)
    try:
        with urllib.request.urlopen(request, timeout=90, context=ssl.create_default_context(cafile='/etc/ssl/cert.pem')) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        details = json.loads(error.read())
        raise RuntimeError(json.dumps({'status': error.code, 'message': details.get('error', {}).get('message')})) from None


def verify_billing():
    info = cli('billing', 'projects', 'describe', PROJECT, '--format=json')
    if info.get('billingAccountName') != 'billingAccounts/' + BILLING or not info.get('billingEnabled'):
        raise RuntimeError('Project billing does not match the authorized trial account. No changes made.')
    return info


def operation(host, result):
    name = result.get('name', '')
    if 'operations/' not in name:
        return result
    for _ in range(60):
        result = api(host + '/v1beta1/' + name)
        if result.get('done'):
            if result.get('error'): raise RuntimeError(str(result['error']))
            return result.get('response', {})
        time.sleep(2)
    raise RuntimeError('Cloud operation still pending')


if __name__ == '__main__':
    command = sys.argv[1]
    if command == 'inspect':
        print(json.dumps({'billing': verify_billing(), 'project': cli('projects', 'describe', PROJECT, '--format=json')}))
    elif command == 'enable':
        verify_billing()
        cli('services', 'enable', 'firebase.googleapis.com', 'identitytoolkit.googleapis.com',
            'firestore.googleapis.com', 'firebaserules.googleapis.com', 'run.googleapis.com',
            'cloudbuild.googleapis.com', 'artifactregistry.googleapis.com', 'secretmanager.googleapis.com',
            'iam.googleapis.com', 'apikeys.googleapis.com', raw=True)
        print('Required project APIs enabled.')
    elif command == 'api':
        print(json.dumps(api(sys.argv[2], json.loads(sys.argv[3]) if len(sys.argv) > 3 else None,
                             sys.argv[4] if len(sys.argv) > 4 else None)))
    elif command == 'gcloud':
        print(cli(*sys.argv[2:], raw=True))
