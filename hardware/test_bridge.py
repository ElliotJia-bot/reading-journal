import tempfile
import unittest
from pathlib import Path
from bookmark_bridge import Queue, parse_event

class BridgeTests(unittest.TestCase):
    def test_noise_and_split_protocol_payload(self):
        self.assertIsNone(parse_event('SMART BOOKMARK V2 READY'))
        self.assertIsNone(parse_event('{broken'))
        self.assertIsNone(parse_event('[]'))
        event = parse_event('OK\x04{"event":"reading_ended","page":2,"page_visit_history":[1],"total_active_seconds":12}')
        self.assertEqual(event['page'], 2)
        self.assertNotIn('page_visit_history', event)

    def test_queue_survives_reopen_and_ack_retry(self):
        with tempfile.TemporaryDirectory() as folder:
            filename = Path(folder) / 'queue.sqlite3'
            q = Queue(filename)
            q.append({'event':'reading_started'}, 1000)
            q.append({'event':'page_started'}, 2000)
            q.db.close()
            q = Queue(filename)
            self.assertTrue(q.get('started'))
            self.assertEqual([e['sequence'] for e in q.batch()], [1,2])
            q.ack(1); q.ack(1)
            self.assertEqual([e['sequence'] for e in q.batch()], [2])
            self.assertEqual(filename.stat().st_mode & 0o777, 0o600)
            q.append({'event': 'reading_ended'}, 3000)
            q.db.close()
            q = Queue(filename)
            self.assertTrue(q.get('ended'))
            q.db.close()

if __name__ == '__main__':
    unittest.main()
