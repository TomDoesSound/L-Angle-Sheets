from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import sys

HOST = '127.0.0.1'
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
VERSION = '0.16'

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

print(f'L-Angle Sheets v{VERSION} running at http://{HOST}:{PORT}')
print('Press Ctrl+C to stop.')
ThreadingHTTPServer((HOST, PORT), NoCacheHandler).serve_forever()
