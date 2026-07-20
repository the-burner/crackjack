#!/usr/bin/env bash
# Serve one of the bundled apps over HTTPS.
# HTTPS is required so iOS Safari will register the Service Worker (service
# workers only run in a secure context: HTTPS, or http://localhost).
#
# Usage: ./serve.sh --drill [PORT]
#        ./serve.sh --game  [PORT]
set -euo pipefail
cd "$(dirname "$0")"

APP=""
PORT="8443"
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

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=app)
httpd = http.server.HTTPServer(("0.0.0.0", port), handler)
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
httpd.serve_forever()
PY
