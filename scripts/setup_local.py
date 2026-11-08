"""Loopback-only setup form. Secrets never appear in command arguments or logs."""
import html
import json
import os
import re
import secrets
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '.local'
PRIVATE.mkdir(mode=0o700, exist_ok=True)
os.chmod(PRIVATE, 0o700)
os.umask(0o077)
GCLOUD = str(ROOT / '.tools/google-cloud-sdk/bin/gcloud')
ENV = dict(os.environ, CLOUDSDK_CONFIG=str(PRIVATE / 'gcloud'),
           CLOUDSDK_PYTHON='/Library/Frameworks/Python.framework/Versions/3.10/bin/python3')
TOKEN = secrets.token_urlsafe(32)
state = {'google': 'Not connected', 'auth_url': '', 'key_saved': (PRIVATE / 'tinker.key').exists()}
process = None


def login():
    global process
    state['google'] = 'Waiting for Google sign-in'
    process = subprocess.Popen([GCLOUD, 'auth', 'login', '--no-launch-browser', '--quiet'],
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.STDOUT, text=True, env=ENV)
    for line in process.stdout:
        match = re.search(r'https://accounts\.google\.com/\S+', line)
        if match:
            state['auth_url'] = match.group(0)
    code = process.wait()
    state['google'] = 'Connected' if code == 0 else 'Sign-in needs retry'
    state['auth_url'] = ''


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def respond(self, data, content_type='text/html; charset=utf-8', status=200):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(data.encode())

    def do_GET(self):
        if self.headers.get('Host') != '127.0.0.1:8766':
            return self.respond('Invalid host', status=403)
        if self.path == '/status':
            return self.respond(json.dumps({k: v for k, v in state.items() if k != 'auth_url'}), 'application/json')
        if self.path != '/':
            return self.respond('Not found', status=404)
        hidden = f'<input type="hidden" name="csrf" value="{TOKEN}">'
        link = ''
        if state['auth_url']:
            link = f'<p><a target="_blank" rel="noopener noreferrer" href="{html.escape(state["auth_url"], quote=True)}">Open Google sign-in</a></p>'
        self.respond(f'''<!doctype html><html lang="en"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reading Journal · Local Setup</title>
        <style>body{{background:#fdf9f3;color:#14422d;font:17px system-ui;max-width:620px;margin:50px auto;padding:24px}}section{{background:#f2ede8;padding:24px;border-radius:18px;margin:20px 0}}input,button{{box-sizing:border-box;width:100%;padding:14px;margin:8px 0;border:1px solid #c0c9c1;border-radius:8px;font:inherit}}button{{background:#14422d;color:white}}small{{color:#414943}}a{{color:#14422d}}</style>
        <h1>Connect Reading Journal</h1><p>This page runs only on your Mac. Credentials are saved in a private local folder excluded from the project source.</p>
        <section><h2>Google Cloud</h2><p>Project: project-b00660ba-d6d4-4c9a-a05</p><p>Status: {html.escape(state['google'])}</p>
        <form method="post" action="/google-start">{hidden}<button>Start Google sign-in</button></form>{link}
        <p>After signing in, paste the verification code here.</p><form method="post" action="/google-code">{hidden}<input name="code" type="password" autocomplete="off" required placeholder="Google verification code"><button>Complete connection</button></form></section>
        <section><h2>Thinking Machines</h2><p>Key status: {'Saved locally' if state['key_saved'] else 'Waiting for key'}</p>
        <form method="post" action="/tinker">{hidden}<input type="password" name="key" autocomplete="off" required placeholder="reading-journal-backend API key"><button>Save Tinker key securely</button></form><small>The key is never displayed. It will be used only by the backend.</small></section><p><a href="/">Refresh connection status</a></p></html>''')

    def do_POST(self):
        # Embedded browsers may omit Origin or send "null". The per-process
        # CSRF token still requires access to this loopback-only form.
        origin = self.headers.get('Origin')
        if self.headers.get('Host') != '127.0.0.1:8766' or origin not in (None, 'null', 'http://127.0.0.1:8766'):
            return self.respond('Invalid origin', status=403)
        size = int(self.headers.get('Content-Length', 0))
        if size > 8192:
            return self.respond('Request too large', status=413)
        data = parse_qs(self.rfile.read(size).decode())
        if not secrets.compare_digest(data.get('csrf', [''])[0], TOKEN):
            return self.respond('Invalid request', status=403)
        if self.path == '/google-start' and (process is None or process.poll() is not None):
            threading.Thread(target=login, daemon=True).start()
        elif self.path == '/google-code' and process and process.poll() is None:
            code = data.get('code', [''])[0].strip()
            if '\n' in code or '\r' in code:
                return self.respond('Invalid code', status=400)
            process.stdin.write(code + '\n')
            process.stdin.flush()
        elif self.path == '/tinker':
            key = data.get('key', [''])[0].strip()
            if len(key) < 16 or any(c.isspace() for c in key):
                return self.respond('Check the key and try again.', status=400)
            (PRIVATE / 'tinker.key').write_text(key)
            os.chmod(PRIVATE / 'tinker.key', 0o600)
            state['key_saved'] = True
        self.send_response(303)
        self.send_header('Location', '/')
        self.end_headers()


print('Local setup available at http://127.0.0.1:8766', flush=True)
ThreadingHTTPServer(('127.0.0.1', 8766), Handler).serve_forever()
