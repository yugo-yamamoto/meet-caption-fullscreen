# /// script
# dependencies = []
# ///
import functools, http.server, socketserver, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Content-Security-Policy',
                         "require-trusted-types-for 'script'; trusted-types default; style-src 'self'")
        super().end_headers()
port = int(sys.argv[1])
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', port), H) as httpd:
    httpd.serve_forever()
