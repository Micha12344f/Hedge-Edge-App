#!/bin/bash
set -e

echo "Starting MT5 Worker ${WORKER_ID}..."

export WINEPREFIX="${WINEPREFIX:-/root/.wine}"
export MT5_PATH="${MT5_PATH:-C:/Program Files/MetaTrader 5/terminal64.exe}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-root}"

if [ ! -f "/root/.wine/drive_c/Program Files/MetaTrader 5/terminal64.exe" ]; then
	echo "MetaTrader 5 terminal not found in Wine prefix. Rebuild the image or verify MT5 installation."
	exit 1
fi

mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

# Clear stale X locks before starting Xvfb
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99

# Start Xvfb (virtual display)
Xvfb :99 -screen 0 1024x768x16 &
sleep 3

echo "Xvfb started on display :99"

# Start the Flask API using Wine Python
echo "Starting Flask API..."
cd /app
wine python mt5_worker_api.py
