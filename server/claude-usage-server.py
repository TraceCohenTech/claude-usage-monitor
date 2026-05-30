#!/usr/bin/env python3
"""
Tiny local server that receives usage data POSTed by the Chrome extension
and writes it to /tmp/claude-usage.json for the SwiftBar plugin to read.
"""
import json, os
from http.server import HTTPServer, BaseHTTPRequestHandler

DATA_FILE = '/tmp/claude-usage.json'
PORT = 39571


class Handler(BaseHTTPRequestHandler):
    def send_cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors()
        self.end_headers()

    def do_POST(self):
        if self.path != '/usage':
            self.send_response(404)
            self.end_headers()
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length)
            data = json.loads(body)
            with open(DATA_FILE, 'w') as f:
                json.dump(data, f)
            self.send_response(200)
            self.send_cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
        except Exception as e:
            self.send_response(500)
            self.end_headers()

    def log_message(self, *_):
        pass  # suppress request logs


if __name__ == '__main__':
    server = HTTPServer(('127.0.0.1', PORT), Handler)
    print(f'Claude Usage Server running on port {PORT}')
    server.serve_forever()
