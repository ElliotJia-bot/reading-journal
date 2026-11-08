"""Publish the web-only Expo export to this project's existing Firebase Hosting.

Uses the official Hosting REST API. Credentials remain in memory. Only a
validated static export is uploaded; private/backend sources are never sent.
"""
import gzip
import hashlib
import json
import re
import ssl
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from cloud import ROOT, PROJECT, REGION, api, cli, verify_billing


def main():
    setting = json.loads((ROOT / 'hosting.config.json').read_text())
    site = setting['site']
    directory = ROOT / setting['public']
    assert directory == ROOT / 'mobile/dist-web', 'Unexpected export directory'
    assert (directory / 'index.html').is_file(), 'Export the web app first'
    assert (directory / 'manifest.webmanifest').is_file(), 'Missing install manifest'
    app_version = json.loads((ROOT / 'mobile/app.json').read_text())['expo']['version']
    package_version = json.loads((ROOT / 'mobile/package.json').read_text())['version']
    export_version = json.loads((directory / 'release.json').read_text())['version']
    assert re.fullmatch(r'\d+\.\d+\.\d+', app_version), 'Invalid release version'
    assert app_version == package_version == export_version, 'Release versions differ; rebuild before publishing'
    manifest = json.loads((directory / 'manifest.webmanifest').read_text())
    assert all((directory / icon['src'].lstrip('/')).is_file() for icon in manifest['icons'])
    allowed = {'.html', '.js', '.css', '.json', '.webmanifest', '.png', '.jpg',
               '.jpeg', '.webp', '.gif', '.svg', '.ico', '.ttf', '.otf', '.woff', '.woff2'}
    files, blobs = {}, {}
    secret = (ROOT / '.local/tinker.key').read_bytes().strip()
    for path in sorted(directory.rglob('*')):
        if not path.is_file():
            continue
        relative = path.relative_to(directory)
        assert not path.is_symlink()
        assert path.suffix in allowed, 'Unexpected file in export: ' + str(relative)
        if relative.parts[0] == 'assets':
            # Metro preserves package paths for emitted font/image assets.
            assert path.suffix in {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.ttf', '.otf', '.woff', '.woff2'}
            assert re.search(r'\.[a-f0-9]{32}(?:@\dx)?\.', path.name), 'Unhashed package asset'
        else:
            assert not any(part.startswith('.') or part in {'node_modules', 'backend', 'android', 'ios'} for part in relative.parts)
        raw = path.read_bytes()
        assert not secret or secret not in raw, 'Private key found in export; publishing stopped'
        assert b'-----BEGIN PRIVATE KEY-----' not in raw, 'Credential found; publishing stopped'
        compressed = gzip.compress(raw, mtime=0)
        digest = hashlib.sha256(compressed).hexdigest()
        files['/' + str(relative)] = digest
        blobs[digest] = compressed
    assert len(files) < 1000, 'Batch larger exports before deployment'
    verify_billing()
    sites = api(f'firebasehosting.googleapis.com/v1beta1/projects/{PROJECT}/sites')['sites']
    assert any(s['name'].endswith('/sites/' + site) for s in sites), 'Site is not in this project'
    config = api(f'identitytoolkit.googleapis.com/admin/v2/projects/{PROJECT}/config')
    expected_domains = {site + '.web.app', site + '.firebaseapp.com'}
    assert expected_domains.issubset(set(config['authorizedDomains'])), 'Hosting login domains must be authorized'

    origins = ','.join(['http://localhost:8081', 'http://127.0.0.1:8081',
                        f'https://{site}.web.app', f'https://{site}.firebaseapp.com'])
    service = cli('run', 'services', 'describe', 'reading-journal-api', '--region=' + REGION, '--format=json')
    current_env = service['spec']['template']['spec']['containers'][0].get('env', [])
    if not any(entry.get('name') == 'ALLOWED_ORIGINS' and entry.get('value') == origins for entry in current_env):
        cli('run', 'services', 'update', 'reading-journal-api', '--region=' + REGION,
            '--update-env-vars=^|^ALLOWED_ORIGINS=' + origins, raw=True)
    print('Published origins enabled; existing backend identity and instance limits preserved.', flush=True)
    base = 'firebasehosting.googleapis.com/v1beta1/'
    version = api(base + f'sites/{site}/versions', {'config': setting['config']}, 'POST')
    name = version['name']
    (ROOT / '.local/hosting-pending.json').write_text(json.dumps({'version': name, 'site': site}))
    populated = api(base + name + ':populateFiles', {'files': files}, 'POST')
    token = cli('auth', 'print-access-token', raw=True).strip()
    context = ssl.create_default_context(cafile='/etc/ssl/cert.pem')
    def upload(digest):
        req = urllib.request.Request(populated['uploadUrl'] + '/' + digest,
            data=blobs[digest], headers={'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/octet-stream'}, method='POST')
        with urllib.request.urlopen(req, timeout=90, context=context) as response:
            response.read()
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(upload, populated.get('uploadRequiredHashes', [])))
    api(base + name + '?updateMask=status', {'status': 'FINALIZED'}, 'PATCH')
    release = api(base + f'sites/{site}/releases?versionName=' + name,
                  {'message': f'Remarked {app_version}: web release'}, 'POST')
    result = {'url': f'https://{site}.web.app', 'appVersion': app_version, 'version': name,
              'release': release['name'], 'files': len(files)}
    (ROOT / '.local/hosting-release.json').write_text(json.dumps(result, indent=2))
    (ROOT / '.local/hosting-pending.json').unlink(missing_ok=True)
    print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main()
