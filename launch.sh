#!/usr/bin/env bash
# HD Optimizer Detective Launch Script v2.0

set -e

PORT=${1:-8080}
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=========================================================="
echo "⚡ HD OPTIMIZER DETECTIVE v2.0 - STARTING LOCAL DAEMON"
echo "=========================================================="
echo "URL: http://127.0.0.1:${PORT}"
echo "=========================================================="

if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 is not installed or not in PATH."
    exit 1
fi

cd "$DIR"

# Open default browser asynchronously after 1s
(sleep 1 && (open "http://127.0.0.1:${PORT}" || xdg-open "http://127.0.0.1:${PORT}" || true)) &

python3 scanner_backend.py
