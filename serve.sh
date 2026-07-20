#!/usr/bin/env bash
# Serve the Blackjack Verité Drills mirror locally over HTTP.
# The app loads screens/data via XMLHttpRequest, so it must be served (not opened as file://).
set -euo pipefail
PORT="${1:-8000}"
cd "$(dirname "$0")"
echo "Serving Blackjack Verité Drills at http://localhost:${PORT}/"
echo "Press Ctrl+C to stop."
exec python3 -m http.server "$PORT"
