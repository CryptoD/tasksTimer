#!/usr/bin/env bash
# TEST 12: full build pipeline in a clean Ubuntu environment (CI + Release equivalent).
#
# Run as a file inside the container (do not pipe the script on stdin to bash -s
# without docker run -i, or nothing will execute).
#
#   docker run --rm -v "$REPO:/src:rw" -w /src ubuntu:24.04 bash /src/tests/test12_full_build_in_container.sh
#   # or: bash tests/run_test12_docker.sh
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

echo "=== TEST 12: install dependencies (Ubuntu) ==="
apt-get update -qq
apt-get install -y -qq \
  ca-certificates \
  curl \
  dbus-daemon \
  dbus-x11 \
  gettext \
  gjs \
  gir1.2-gstreamer-1.0 \
  gir1.2-gtk-3.0 \
  imagemagick \
  libgtk-3-bin \
  gnome-shell \
  make \
  python3 \
  rsync \
  shellcheck \
  wget \
  xvfb

echo "=== make clean ==="
make clean

echo "=== make lint (CI) ==="
make lint

echo "=== make test (CI: xvfb + dbus) ==="
xvfb-run -a dbus-run-session -- make test

echo "=== make pack (extension .zip) ==="
make pack

echo "=== make appimage (Release) ==="
make appimage

echo "=== Verify artifacts ==="
shopt -s nullglob
zips=(taskTimer@CryptoD*.zip)
imgs=(packaging/appimage/dist/*.AppImage)
shopt -u nullglob

if [ ${#zips[@]} -eq 0 ]; then
  echo "TEST 12 FAIL: no extension zip in /src" >&2
  ls -la
  exit 1
fi
for z in "${zips[@]}"; do
  echo "OK zip: $z ($(stat -c%s "$z") bytes)"
done

if [ ${#imgs[@]} -eq 0 ]; then
  echo "TEST 12 FAIL: no AppImage under packaging/appimage/dist/" >&2
  ls -la packaging/appimage/dist/ 2>/dev/null || true
  exit 1
fi
for f in "${imgs[@]}"; do
  sz=$(stat -c%s "$f")
  echo "OK AppImage: $f ($sz bytes)"
  if [ "$sz" -lt 1000 ]; then
    echo "TEST 12 FAIL: AppImage suspiciously small" >&2
    exit 1
  fi
done

echo "=== TEST 12 PASSED ==="
