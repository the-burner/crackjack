#!/usr/bin/env bash
# Serve one of the bundled apps over HTTPS.
# HTTPS is required so iOS Safari will register the Service Worker (service
# workers only run in a secure context: HTTPS, or http://localhost).
#
# Usage: ./serve.sh --drill [PORT]   (default port 8443)
#        ./serve.sh --game  [PORT]   (default port 8444)
set -euo pipefail
cd "$(dirname "$0")"

APP=""
PORT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --drill) APP="drill" ;;
    --game)  APP="game" ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        PORT="$1"
      else
        echo "error: unknown argument '$1'" >&2
        echo "usage: ./serve.sh --drill|--game [PORT]" >&2
        exit 1
      fi
      ;;
  esac
  shift
done

if [ -z "$APP" ]; then
  echo "error: specify which app to serve." >&2
  echo "usage: ./serve.sh --drill|--game [PORT]" >&2
  exit 1
fi

# Default to a per-app port so both apps can run at once without clashing.
if [ -z "$PORT" ]; then
  case "$APP" in
    drill) PORT="8443" ;;
    game)  PORT="8444" ;;
  esac
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

echo "Serving ${APP} at https://${HOST}:${PORT}/"
echo "Press Ctrl+C to stop."

exec python3 - "$PORT" "$CERT" "$KEY" "$APP" <<'PY'
import http.server, functools, ssl, sys

port, cert, key, app = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(certfile=cert, keyfile=key)

class Handler(http.server.SimpleHTTPRequestHandler):
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
handler = functools.partial(Handler, directory=app)
httpd = http.server.ThreadingHTTPServer(("0.0.0.0", port), handler)
httpd.daemon_threads = True
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
httpd.serve_forever()
PY
