from cloud import ROOT, PROJECT, REGION, api, cli, operation, verify_billing
import json

verify_billing()
try:
    firebase = api(f'firebase.googleapis.com/v1beta1/projects/{PROJECT}')
except RuntimeError as error:
    if '404' not in str(error): raise
    firebase = operation('firebase.googleapis.com', api(f'firebase.googleapis.com/v1beta1/projects/{PROJECT}:addFirebase', {}))
print('Firebase project ready.', flush=True)

databases = cli('firestore', 'databases', 'list', '--format=json')
if not any(item['name'].endswith('/(default)') for item in databases):
    cli('firestore', 'databases', 'create', '--location=' + REGION, '--type=firestore-native', raw=True)
print('Firestore ready in ' + REGION, flush=True)

try:
    config = api(f'identitytoolkit.googleapis.com/admin/v2/projects/{PROJECT}/config')
except RuntimeError as error:
    if '404' not in str(error) and 'CONFIGURATION_NOT_FOUND' not in str(error): raise
    api(f'identitytoolkit.googleapis.com/v2/projects/{PROJECT}/identityPlatform:initializeAuth', {})
config = api(f'identitytoolkit.googleapis.com/admin/v2/projects/{PROJECT}/config?updateMask=signIn.email,signIn.anonymous',
            {'signIn': {'email': {'enabled': True, 'passwordRequired': True}, 'anonymous': {'enabled': True}}}, 'PATCH')
print('Email/password and guest authentication enabled.', flush=True)

apps = api(f'firebase.googleapis.com/v1beta1/projects/{PROJECT}/webApps').get('apps', [])
app = next((item for item in apps if item.get('displayName') == 'Reading Journal'), None)
if app is None:
    app = operation('firebase.googleapis.com', api(f'firebase.googleapis.com/v1beta1/projects/{PROJECT}/webApps', {'displayName': 'Reading Journal'}))
web_config = api(f'firebase.googleapis.com/v1beta1/{app["name"]}/config')
(ROOT / '.local/firebase-config.json').write_text(json.dumps(web_config, indent=2))
(ROOT / 'mobile/.env.local').write_text('\n'.join([
    'EXPO_PUBLIC_FIREBASE_API_KEY=' + web_config['apiKey'],
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=' + web_config['authDomain'],
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID=' + PROJECT,
    'EXPO_PUBLIC_FIREBASE_APP_ID=' + web_config['appId'],
    'EXPO_PUBLIC_API_URL=http://localhost:8080', ''
]))
print('Firebase app configuration saved locally.', flush=True)

ruleset = api(f'firebaserules.googleapis.com/v1/projects/{PROJECT}/rulesets',
              {'source': {'files': [{'name': 'firestore.rules', 'content': (ROOT / 'firestore.rules').read_text()}]}})
release = {'name': f'projects/{PROJECT}/releases/cloud.firestore', 'rulesetName': ruleset['name']}
try:
    api(f'firebaserules.googleapis.com/v1/{release["name"]}')
except RuntimeError as error:
    if '404' not in str(error): raise
    api(f'firebaserules.googleapis.com/v1/projects/{PROJECT}/releases', release)
else:
    api(f'firebaserules.googleapis.com/v1/{release["name"]}', {'release': release, 'updateMask': 'rulesetName'}, 'PATCH')
print('Owner-only Firestore read rules published. Client writes go through verified backend.', flush=True)
