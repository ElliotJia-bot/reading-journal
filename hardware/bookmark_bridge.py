#!/usr/bin/env python3
"""Pico V2 USB -> durable local queue -> paired Remarked cloud session.

No Firebase password or service-account key is needed. --run-v2 executes the
preserved V2 file in RAM through raw REPL; it never writes Pico flash files.
"""
import argparse
import getpass
import json
import os
from pathlib import Path
import secrets
import signal
import sqlite3
import ssl
import threading
import time
import urllib.error
import urllib.request

EVENTS = {"reading_started", "page_completed", "page_started", "reading_paused", "reading_resumed", "navigation_limit", "reading_ended"}
FIELDS = {"event", "page", "paused", "elapsed_seconds", "active_reading_seconds", "paused_seconds", "start_page", "completed_page", "new_page", "current_page", "last_page", "time_on_page_seconds", "visit_number", "navigation_reason", "direction", "forward_turns", "backward_turns", "total_active_seconds", "total_paused_seconds", "firmware_version"}
DEFAULT_API = "https://reading-journal-api-au6vfycphq-uc.a.run.app"


def parse_event(line):
    """Ignore Thonny banners/REPL framing, never eval anything from USB."""
    text = line.decode("utf-8", errors="replace") if isinstance(line, bytes) else line
    start = text.find('{')
    if start < 0:
        return None
    try:
        raw = json.loads(text[start:].strip())
    except (ValueError, TypeError):
        return None
    if not isinstance(raw, dict) or raw.get("event") not in EVENTS:
        return None
    # V2 repeats all visits in reading_ended. Individual completed events are
    # already queued; retain the full summary in the private raw log instead.
    return {key: value for key, value in raw.items() if key in FIELDS}


class Queue:
    def __init__(self, filename):
        self.path = Path(filename).expanduser().resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.db = sqlite3.connect(self.path, check_same_thread=False)
        os.chmod(self.path, 0o600)
        self.db.execute('CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
        self.db.execute('CREATE TABLE IF NOT EXISTS events (sequence INTEGER PRIMARY KEY, payload TEXT NOT NULL, sent INTEGER NOT NULL DEFAULT 0)')
        self.db.commit()

    def get(self, key):
        with self.lock:
            row = self.db.execute('SELECT value FROM metadata WHERE key=?', (key,)).fetchone()
        return json.loads(row[0]) if row else None

    def set(self, key, value):
        with self.lock:
            self.db.execute('INSERT OR REPLACE INTO metadata VALUES (?,?)', (key, json.dumps(value)))
            self.db.commit()

    def append(self, event, at):
        with self.lock:
            seq = self.db.execute('SELECT COALESCE(MAX(sequence),0)+1 FROM events').fetchone()[0]
            payload = {'sequence': seq, 'observedAt': at, 'event': event}
            self.db.execute('INSERT INTO events(sequence,payload) VALUES (?,?)', (seq, json.dumps(payload)))
            if event['event'] in ('reading_started', 'reading_ended'):
                key = 'started' if event['event'] == 'reading_started' else 'ended'
                self.db.execute('INSERT OR REPLACE INTO metadata VALUES (?,?)', (key, 'true'))
            self.db.commit()
        return seq

    def batch(self):
        with self.lock:
            rows = self.db.execute('SELECT payload FROM events WHERE sent=0 ORDER BY sequence LIMIT 20').fetchall()
        return [json.loads(row[0]) for row in rows]

    def ack(self, through):
        with self.lock:
            self.db.execute('UPDATE events SET sent=1 WHERE sequence<=?', (through,))
            self.db.commit()


def request(api, path, payload, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    data = json.dumps(payload).encode()
    ctx = ssl.create_default_context(cafile='/etc/ssl/cert.pem' if Path('/etc/ssl/cert.pem').exists() else None)
    req = urllib.request.Request(api.rstrip('/') + '/bookmark-bridge/' + path, data=data, headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10, context=ctx) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        try:
            message = json.loads(error.read()).get('error', 'Bridge request failed')
        except ValueError:
            message = 'Bridge request failed'
        raise RuntimeError(f'HTTP {error.code}: {message}') from None


def run_v2(port):
    source = (Path(__file__).parent / 'firmware/bookmark_v2.py').read_bytes()
    port.write(b'\x03\x03')
    time.sleep(0.15)
    port.write(b'\x01')
    deadline = time.monotonic() + 4
    received = b''
    while time.monotonic() < deadline:
        received += port.read(max(1, port.in_waiting))
        if b'raw REPL; CTRL-B to exit' in received and received.rstrip().endswith(b'>'):
            break
    else:
        raise RuntimeError('Pico raw REPL is unavailable. Close Thonny and check the USB device.')
    for offset in range(0, len(source), 128):
        port.write(source[offset:offset + 128])
        time.sleep(0.008)
    port.write(b'\x04')
    print('V2 launched in RAM. Existing Pico files are unchanged.', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', help='USB port, e.g. /dev/cu.usbmodem3101 or COM4')
    parser.add_argument('--list-ports', action='store_true')
    parser.add_argument('--api', default=DEFAULT_API)
    parser.add_argument('--state', default='.local/bookmark/bridge.sqlite3', help='Private persistent queue; use a new file for each paired reading')
    parser.add_argument('--code-file', help='Optional private file containing the one-time pairing code')
    parser.add_argument('--run-v2', action='store_true', help='Start a fresh copy of preserved V2 in RAM; stops the currently running program')
    parser.add_argument('--resume', action='store_true', help='Resume this queue and token without claiming a new code')
    parser.add_argument('--upload-only', action='store_true', help='With --resume, flush stored events without connecting USB')
    args = parser.parse_args()
    if args.upload_only and (not args.resume or args.run_v2):
        parser.error('--upload-only requires --resume and cannot run V2.')
    import serial
    from serial.tools import list_ports
    ports = list(list_ports.comports())
    if args.list_ports:
        for item in ports:
            print(f'{item.device} — {item.description}')
        return
    if not args.port and not args.upload_only:
        matches = [p.device for p in ports if p.vid == 0x2e8a]
        if len(matches) != 1:
            parser.error('Specify --port; use --list-ports to see connected devices.')
        args.port = matches[0]
    if not args.api.startswith('https://') and not args.api.startswith(('http://127.0.0.1:', 'http://localhost:')):
        parser.error('Use HTTPS for the cloud backend.')
    queue = Queue(args.state)
    saved = queue.get('pairing')
    if args.resume:
        if not saved:
            parser.error('No saved pairing in this state file.')
        if saved['api'] != args.api:
            parser.error('Saved pairing belongs to a different backend.')
        if args.run_v2 and queue.get('started'):
            parser.error('Use a new pairing/state file to restart V2; do not mix two readings.')
    else:
        if saved:
            parser.error('This state file already has a pairing. Use --resume or choose a new --state file.')
        code = Path(args.code_file).read_text().strip() if args.code_file else getpass.getpass('Pairing code from Remarked: ').strip()
        token = secrets.token_hex(32)
        paired = request(args.api, 'pair', {'code': code, 'token': token})
        saved = dict(paired, token=token, api=args.api)
        queue.set('pairing', saved)
    print(f'Paired. Starting page: {saved["startPage"]}.', flush=True)
    stop = threading.Event()
    fatal = threading.Event()
    connected = threading.Event()
    ended = threading.Event()
    if queue.get('ended') or args.upload_only:
        ended.set()
    def shutdown(*_):
        stop.set()
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    def upload():
        heartbeat = 0.0
        last_error = ''
        while not stop.is_set():
            try:
                batch = queue.batch()
                if batch:
                    response = request(args.api, 'events', {'events': batch}, saved['token'])
                    queue.ack(response['acceptedThrough'])
                    print(f'Synced through event {response["acceptedThrough"]}.', flush=True)
                if time.monotonic() - heartbeat > 5:
                    request(args.api, 'heartbeat', {'connected': connected.is_set()}, saved['token'])
                    heartbeat = time.monotonic()
                last_error = ''
                if ended.is_set() and not queue.batch():
                    print('All queued events synced.' + (' Finish & log is ready in Remarked.' if queue.get('ended') else ''), flush=True)
                    stop.set()
                    return
            except Exception as error:
                message = str(error)
                if message != last_error:
                    print('Sync waiting: ' + message + '. Your queue is retained locally.', flush=True)
                    last_error = message
                if message.startswith(('HTTP 400:', 'HTTP 401:', 'HTTP 409:')):
                    fatal.set(); stop.set(); return
                stop.wait(2)
            stop.wait(0.3)
    thread = threading.Thread(target=upload, daemon=True)
    raw_path = queue.path.with_suffix('.serial.ndjson')
    raw = open(raw_path, 'ab', buffering=0)
    os.chmod(raw_path, 0o600)
    port = None
    try:
        if args.upload_only or queue.get('ended'):
            thread.start()
            while not stop.wait(0.3):
                pass
            if fatal.is_set():
                raise RuntimeError('Cloud rejected queued events. Queue retained.')
            return
        port = serial.Serial(args.port, baudrate=115200, timeout=0.2, write_timeout=4, exclusive=True)
        connected.set()
        if args.run_v2:
            run_v2(port)
        thread.start()
        print('Single: next · Double: back · Hold 1.5s: pause/resume · Triple: end', flush=True)
        buffer = b''
        while not stop.is_set():
            chunk = port.read(max(1, min(4096, port.in_waiting)))
            if not chunk:
                continue
            buffer += chunk
            if len(buffer) > 2_000_000:
                raise RuntimeError('USB line is unexpectedly large; stop and inspect the firmware output.')
            while b'\n' in buffer:
                line, buffer = buffer.split(b'\n', 1)
                raw.write(line + b'\n')
                event = parse_event(line)
                if not event:
                    continue
                if not queue.get('started'):
                    if event['event'] != 'reading_started':
                        print('Waiting for reading_started. Run V2 after the bridge is connected.', flush=True)
                        continue
                seq = queue.append(event, round(time.time() * 1000))
                print(f'USB {seq}: {event["event"]} · device page {event.get("page", "?")}', flush=True)
                if event['event'] == 'reading_ended':
                    ended.set()
        if fatal.is_set():
            raise RuntimeError('Cloud rejected this session. Queue retained; check the message above before restarting.')
    finally:
        connected.clear()
        stop.set()
        if port:
            port.close()
        if thread.is_alive():
            thread.join(timeout=11)
        try:
            request(args.api, 'heartbeat', {'connected': False}, saved['token'])
        except Exception:
            pass
        raw.close()
        if queue.batch():
            print('Unsent events remain. Restart with the same --state file and --resume to retry.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit(str(error)) from None
