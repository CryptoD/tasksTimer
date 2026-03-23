#!/usr/bin/env bash
# TEST 12: full build on the current machine (same steps as CI + Release workflows).
# Requires build dependencies (see bin/check-deps.sh --appimage).
# Usage from repo root:  bash tests/test12_full_build_local.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== TEST 12 (local): clean + lint + test + appimage [+ pack if gnome-extensions] ==="
make clean

make lint

if command -v xvfb-run >/dev/null 2>&1 && command -v dbus-run-session >/dev/null 2>&1; then
  echo "=== make test (xvfb + dbus, CI-style) ==="
  xvfb-run -a dbus-run-session -- make test
else
  echo "=== make test (no xvfb/dbus; install dbus-x11 xvfb for CI parity) ==="
  make test
fi

echo "=== make appimage (Release workflow) ==="
make appimage

if command -v gnome-extensions >/dev/null 2>&1; then
  echo "=== make pack (extension .zip) ==="
  make pack
else
  echo "=== SKIP make pack (need: sudo apt install gnome-shell) ==="
fi

echo "=== Verify artifacts ==="
shopt -s nullglob
zips=(taskTimer@CryptoD*.zip)
imgs=(packaging/appimage/dist/*.AppImage)
shopt -u nullglob

if [ ${#zips[@]} -gt 0 ]; then
  for z in "${zips[@]}"; do
    echo "OK zip: $z ($(stat -c%s "$z") bytes)"
  done
else
  echo "(No extension zip produced — optional without gnome-extensions.)"
fi

if [ ${#imgs[@]} -eq 0 ]; then
  echo "TEST 12 FAIL: no AppImage" >&2
  exit 1
fi
for f in "${imgs[@]}"; do
  sz=$(stat -c%s "$f")
  echo "OK AppImage: $f ($sz bytes)"
  if [ "$sz" -lt 1000 ]; then
    echo "TEST 12 FAIL: AppImage too small" >&2
    exit 1
  fi
done

echo "=== TEST 12 PASSED ==="
