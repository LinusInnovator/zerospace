#!/usr/bin/env bash
# ZeroSpace local launcher

set -e

PORT=${1:-8080}
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 is not installed or not in PATH."
    exit 1
fi

cd "$DIR"

# Never attach the browser to a stale process. Select the first free local port.
START_PORT=$PORT
MAX_PORT=$((START_PORT + 20))
while ! python3 -c 'import socket, sys; sock = socket.socket(); sock.bind(("127.0.0.1", int(sys.argv[1]))); sock.close()' "$PORT" 2>/dev/null; do
    PORT=$((PORT + 1))
    if [ "$PORT" -gt "$MAX_PORT" ]; then
        echo "Error: no free localhost port found between ${START_PORT} and ${MAX_PORT}."
        exit 1
    fi
done

echo "=========================================================="
echo "ZeroSpace v2.0 — local workspace detective"
echo "URL: http://127.0.0.1:${PORT}"
if [ "$PORT" -ne "$START_PORT" ]; then
    echo "Port ${START_PORT} was occupied; using ${PORT} to avoid a stale server."
fi
echo "Press Ctrl-C to stop ZeroSpace."
echo "=========================================================="

# Open the default browser unless explicitly disabled for headless/test use.
if [ "${ZEROSPACE_NO_BROWSER:-0}" != "1" ]; then
    (sleep 1 && (open "http://127.0.0.1:${PORT}" || xdg-open "http://127.0.0.1:${PORT}" || true)) &
fi

python3 scanner_backend.py --port "$PORT"
