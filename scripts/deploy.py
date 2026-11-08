"""Deploy only backend sources, with a dedicated runtime identity and secret."""
import json
import os
import subprocess
from cloud import ROOT, PROJECT, BILLING, REGION, cli, verify_billing, ENV, GCLOUD

os.chdir(ROOT)
verify_billing()
upload_files = set(cli('meta', 'list-files-for-upload', raw=True).splitlines())
allowed_files = {'Dockerfile', 'package.json', 'backend/package.json', 'backend/package-lock.json', 'backend/tsconfig.json'}
allowed_files.update(str(path.relative_to(ROOT)) for path in (ROOT / 'backend/src').glob('*.ts'))
allowed_files.update(str(path.relative_to(ROOT)) for path in (ROOT / 'shared').glob('*.ts'))
if upload_files != allowed_files:
    raise RuntimeError('Upload files differ from the backend source allowlist. Check .gcloudignore before deploying.')
runtime = f'reading-journal-api@{PROJECT}.iam.gserviceaccount.com'
builder = f'reading-journal-build@{PROJECT}.iam.gserviceaccount.com'
accounts = cli('iam', 'service-accounts', 'list', '--format=json')
emails = {account['email'] for account in accounts}
for name, email in [('reading-journal-api', runtime), ('reading-journal-build', builder)]:
    if email not in emails:
        cli('iam', 'service-accounts', 'create', name, '--display-name=Reading Journal ' + name, raw=True)
for email, role in [(runtime, 'roles/datastore.user'), (runtime, 'roles/firebaseauth.viewer'), (builder, 'roles/run.builder')]:
    cli('projects', 'add-iam-policy-binding', PROJECT, '--member=serviceAccount:' + email, '--role=' + role, '--condition=None', raw=True)
print('Dedicated runtime and build identities ready.', flush=True)

secrets = cli('secrets', 'list', '--format=json')
if not any(secret['name'].endswith('/reading-journal-tinker') for secret in secrets):
    cli('secrets', 'create', 'reading-journal-tinker', '--replication-policy=automatic', raw=True)
version_file = ROOT / '.local/secret-version'
if version_file.exists():
    version = version_file.read_text().strip()
else:
    result = cli('secrets', 'versions', 'add', 'reading-journal-tinker', '--data-file=' + str(ROOT / '.local/tinker.key'), '--format=json')
    version = result['name'].split('/')[-1]
    version_file.write_text(version)
cli('secrets', 'add-iam-policy-binding', 'reading-journal-tinker', '--member=serviceAccount:' + runtime,
    '--role=roles/secretmanager.secretAccessor', '--condition=None', raw=True)
print('Tinker secret stored in Secret Manager.', flush=True)

print('Building and deploying Cloud Run (may take several minutes).', flush=True)
site = json.loads((ROOT / 'hosting.config.json').read_text())['site']
origins = ','.join(['http://localhost:8081', 'http://127.0.0.1:8081',
                    f'https://{site}.web.app', f'https://{site}.firebaseapp.com'])
args = [GCLOUD, 'run', 'deploy', 'reading-journal-api', '--project=' + PROJECT, '--region=' + REGION,
        '--source=' + str(ROOT), '--service-account=' + runtime,
        '--build-service-account=projects/' + PROJECT + '/serviceAccounts/' + builder,
        '--allow-unauthenticated', '--min=0', '--max=1', '--concurrency=10', '--memory=512Mi', '--cpu=1',
        '--timeout=90', '--set-env-vars=^|^GOOGLE_CLOUD_PROJECT=' + PROJECT + '|ALLOWED_ORIGINS=' + origins,
        '--set-secrets=TINKER_API_KEY=reading-journal-tinker:' + version, '--quiet']
subprocess.run(args, env=ENV, cwd=ROOT, check=True)
service = cli('run', 'services', 'describe', 'reading-journal-api', '--region=' + REGION, '--format=json')
url = service['status']['url']
(ROOT / '.local/backend-url').write_text(url)
envfile = ROOT / 'mobile/.env.local'
lines = [line for line in envfile.read_text().splitlines() if not line.startswith('EXPO_PUBLIC_API_URL=')]
envfile.write_text('\n'.join(lines + ['EXPO_PUBLIC_API_URL=' + url, '']))
print(json.dumps({'backend': url, 'region': REGION, 'billingAccount': BILLING, 'maxInstances': 1}))
