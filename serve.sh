#!/usr/bin/env bash
# Serve the app over HTTPS.
# HTTPS is required so iOS Safari will register the Service Worker (service
# workers only run in a secure context: HTTPS, or http://localhost).
#
# Usage: ./serve.sh [PORT]   (default port 8443)
set -euo pipefail
cd "$(dirname "$0")"

PORT="${1:-8443}"
if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  echo "usage: ./serve.sh [PORT]" >&2
  exit 1
fi

if ! command -v mkcert >/dev/null 2>&1; then
  echo "error: mkcert is not installed. Run: brew install mkcert nss && mkcert -install" >&2
  exit 1
fi

CERT_DIR=".certs"
HOST="$(scutil --get LocalHostName).local"
CERT="${CERT_DIR}/${HOST}.pem"
KEY="${CERT_DIR}/${HOST}-key.pem"

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  echo "Generating a locally-trusted certificate for ${HOST} ..."
  mkdir -p "$CERT_DIR"
  mkcert -cert-file "$CERT" -key-file "$KEY" "$HOST" localhost 127.0.0.1
fi

echo "Serving Blackjack Verité at https://${HOST}:${PORT}/"
echo "Press Ctrl+C to stop."

exec python3 - "$PORT" "$CERT" "$KEY" <<'PY'
import http.server, functools, ssl, sys, urllib.request, urllib.error

port, cert, key = int(sys.argv[1]), sys.argv[2], sys.argv[3]
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(certfile=cert, keyfile=key)

# Strategy import (/Apps/z<code>.php), side-bet game import (/Apps/u<code>.php) and the
# casino database (/apps/cbjn7.php) are server-side PHP endpoints on qfit.com, not static
# files. Forward those requests to the live site so the browser sees the same
# same-origin behavior it does on qfit.com (no CORS, no mixed content).
UPSTREAM = "https://www.qfit.com"

# Only the app's own files are served (not .git, node_modules, tests, certificates...).
PUBLIC = ("/", "/index.html", "/manifest.webmanifest", "/sw.js")
PUBLIC_DIRS = ("/src/", "/assets/")

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.lower().startswith("/apps/"):
            self.proxy_to_qfit()
        elif path in PUBLIC or path.startswith(PUBLIC_DIRS):
            super().do_GET()
        else:
            self.send_error(404)

    def proxy_to_qfit(self):
        try:
            with urllib.request.urlopen(UPSTREAM + self.path, timeout=15) as r:
                body, status = r.read(), r.status
                ctype = r.headers.get("Content-Type", "text/plain")
        except urllib.error.HTTPError as e:
            body, status = e.read(), e.code
            ctype = e.headers.get("Content-Type", "text/plain")
        except Exception as e:
            self.send_error(502, "proxy error: %s" % e)
            return
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_one_request(self):
        # A browser may drop a connection mid-reply (canceled prefetch, backgrounded
        # tab). That is expected, not a server error, so don't spew a traceback.
        try:
            super().handle_one_request()
        except (ConnectionResetError, BrokenPipeError, ssl.SSLError):
            self.close_connection = True

# Threaded so the phone's burst of asset requests is served concurrently instead of
# serialized; a single-threaded server starves parallel connections and the browser
# then resets them (errno 54), which surfaces in the app as failed loads.
handler = functools.partial(Handler, directory=".")
httpd = http.server.ThreadingHTTPServer(("0.0.0.0", port), handler)
httpd.daemon_threads = True
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
httpd.serve_forever()
PY
