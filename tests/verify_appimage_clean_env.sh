#!/bin/bash
# Automated smoke test: run the AppImage in a minimal container without GNOME Shell
# or the extension (approximates "clean VM" for CI). For full GUI verification of
# timers, tray, notifications, and audio, see tests/TEST5_APPIMAGE_VM.md.
#
# Usage:
#   tests/verify_appimage_clean_env.sh [path-to-AppImage]
# Default: packaging/appimage/dist/tasktimer-*-x86_64.AppImage (first match)

set -euo pipefail

ME=$(basename "$0")
ROOT=$(cd "$(dirname "$0")/.." && pwd)
APPIMAGE="${1:-}"
if [ -z "$APPIMAGE" ]; then
  APPIMAGE=$(ls -1 "$ROOT"/packaging/appimage/dist/tasktimer-*-x86_64.AppImage 2>/dev/null | head -1 || true)
fi
if [ -z "$APPIMAGE" ] || [ ! -f "$APPIMAGE" ]; then
  echo "[$ME] No AppImage found. Build with: packaging/appimage/build-appimage.sh" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[$ME] docker not installed; skipping container test." >&2
  exit 2
fi

APPIMAGE_ABS=$(cd "$(dirname "$APPIMAGE")" && pwd)/$(basename "$APPIMAGE")
echo "[$ME] Using: $APPIMAGE_ABS"

docker run --rm \
  -v "$APPIMAGE_ABS:/app/tasktimer.AppImage:ro" \
  ubuntu:22.04 \
  bash -c '
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  libfuse2 \
  xvfb \
  dbus-x11 \
  gjs \
  gir1.2-gtk-3.0 \
  gir1.2-gdkpixbuf-2.0 \
  gir1.2-pango-1.0 \
  gir1.2-gstreamer-1.0 \
  gir1.2-notify-0.7 \
  gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good \
  libgtk-3-0 \
  libnotify4 \
  libayatana-appindicator3-1 \
  at-spi2-core \
  >/dev/null

cp /app/tasktimer.AppImage /tmp/tasktimer.AppImage
chmod +x /tmp/tasktimer.AppImage
cd /tmp
export APPIMAGE_EXTRACT_AND_RUN=1

echo "=== AppImage --version ==="
out=$(xvfb-run -a dbus-run-session -- ./tasktimer.AppImage --version 2>&1) || true
echo "$out"
echo "$out" | grep -q "taskTimer" || { echo "FAIL: expected taskTimer in version output" >&2; exit 1; }

echo "=== AppImage --help ==="
out=$(xvfb-run -a dbus-run-session -- ./tasktimer.AppImage --help 2>&1) || true
echo "$out" | head -8
echo "$out" | grep -q "Usage:" || { echo "FAIL: expected Usage in help" >&2; exit 1; }

echo "=== AppImage startup (6s, no fatal JS/GTK in log) ==="
set +e
log=$(timeout 6 xvfb-run -a dbus-run-session -- ./tasktimer.AppImage 2>&1)
rc=$?
set -e
echo "$log" | tail -25
# 124 = timeout (expected), 0 = early exit ok
if [ "$rc" != 0 ] && [ "$rc" != 124 ]; then
  echo "FAIL: unexpected exit $rc" >&2
  exit 1
fi
if echo "$log" | grep -E "ReferenceError|TypeError|SyntaxError|Gjs-Message:.*Error|Gtk-ERROR|failed to create drawable" ; then
  echo "FAIL: suspicious errors in log" >&2
  exit 1
fi

echo "=== OK: clean-env smoke test passed ==="
'

echo "[$ME] Docker test finished successfully."
