"""Local development backend using the existing Google CLI login."""
import os
from pathlib import Path
from cloud import ROOT, PROJECT, ENV, GCLOUD
node = Path('/Users/elliotjia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
env = dict(ENV, GOOGLE_CLOUD_PROJECT=PROJECT,
           GOOGLE_APPLICATION_CREDENTIALS=str(ROOT / '.local/gcloud/application_default_credentials.json'),
           TINKER_API_KEY=(ROOT / '.local/tinker.key').read_text().strip())
os.execve(str(node), [str(node), str(ROOT / 'backend/dist/backend/src/server.js')], env)
