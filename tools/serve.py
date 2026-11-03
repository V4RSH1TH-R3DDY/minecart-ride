#!/usr/bin/env python3
"""Static dev server that tells the browser never to cache (python's http.server lets it keep stale modules and asset lists).
Usage: python3 tools/serve.py [port]      (serves the project folder, default port 8000)"""
import http.server, os, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()
http.server.ThreadingHTTPServer(('0.0.0.0', int(sys.argv[1]) if len(sys.argv) > 1 else 8000), H).serve_forever()
