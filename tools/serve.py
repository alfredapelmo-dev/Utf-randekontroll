# -*- coding: utf-8 -*-
"""
Enkel statisk server för demon (helt lokal). Sätter rätt MIME-typer för
ES-moduler och webmanifest, och binder 0.0.0.0 så att en iPhone/iPad på samma
nätverk kan nå den via datorns IP-adress.

Trådad (ThreadingHTTPServer) – en PWA gör många parallella anrop (moduler +
service worker som förcachar alla filer samtidigt), och en enkeltrådad server
kan annars blockera nästa sidnavigering.

Kör:  python Demo/tools/serve.py [port]   (port default 8000, eller env PORT)
Öppna sedan:  http://localhost:8000
"""
import http.server
import mimetypes
import os
import sys
import socket

mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('text/javascript', '.mjs')
mimetypes.add_type('application/manifest+json', '.webmanifest')

# Port: argument (python serve.py 8080), annars miljövariabel PORT, annars 8000.
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT', '8000'))
ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
os.chdir(ROOT)


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Underlätta utveckling: undvik cache av app-filer (SW sköter offline).
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            self.close_connection = True


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'


if __name__ == '__main__':
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    httpd = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    httpd.daemon_threads = True
    print(f'Servar {ROOT}')
    print(f'  Desktop:  http://localhost:{PORT}')
    print(f'  iPhone:   http://{lan_ip()}:{PORT}   (samma wifi)')
    print('Ctrl+C för att avsluta.')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nAvslutar.')
        httpd.shutdown()
