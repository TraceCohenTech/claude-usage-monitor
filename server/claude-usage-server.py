#!/usr/bin/env python3
"""
Tiny local server that receives usage data POSTed by the Chrome extension
and writes it to /tmp/claude-usage.json for the SwiftBar plugin to read.
"""
import json, os, stat
from http.server import HTTPServer, BaseHTTPRequestHandler

DATA_FILE = '/tmp/claude-usage.json'
PORT = 39571


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/usage':
            self.send_response(404)
            self.end_headers()
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length > 64_000:
                self.send_response(413)
                self.end_headers()
                return
            body = self.rfile.read(length)
            data = json.loads(body)
            if 'usage' not in data or 'lastUpdated' not in data:
                self.send_response(400)
                self.end_headers()
                return
            fd = os.open(DATA_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, 'w') as f:
                json.dump(data, f)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
        except Exception:
            self.send_response(500)
            self.end_headers()

    def log_message(self, *_):
        pass


if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', PORT), Handler)
    print(f'Claude Usage Server running on port {PORT}')
    server.serve_forever()
