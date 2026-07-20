#!/usr/bin/env bash
# Serve the Blackjack Verité Drills mirror over HTTPS.
# HTTPS is required so iOS Safari will register the Service Worker (service
# workers only run in a secure context: HTTPS, or http://localhost).
set -euo pipefail
cd "$(dirname "$0")"

PORT="${1:-8443}"
CERT_DIR=".certs"
HOST="$(scutil --get LocalHostName).local"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "error: mkcert is not installed. Run: brew install mkcert nss && mkcert -install" >&2
  exit 1
fi

CERT="${CERT_DIR}/${HOST}.pem"
KEY="${CERT_DIR}/${HOST}-key.pem"

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  echo "Generating a locally-trusted certificate for ${HOST} ..."
  mkdir -p "$CERT_DIR"
  mkcert -cert-file "$CERT" -key-file "$KEY" "$HOST" localhost 127.0.0.1
fi

echo "Serving Blackjack Verité Drills at https://${HOST}:${PORT}/"
echo "Press Ctrl+C to stop."

exec python3 - "$PORT" "$CERT" "$KEY" <<'PY'
import http.server, ssl, sys

port, cert, key = int(sys.argv[1]), sys.argv[2], sys.argv[3]
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(certfile=cert, keyfile=key)

httpd = http.server.HTTPServer(("0.0.0.0", port), http.server.SimpleHTTPRequestHandler)
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
httpd.serve_forever()
PY
