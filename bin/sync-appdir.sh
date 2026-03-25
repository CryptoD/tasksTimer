#!/usr/bin/env bash
# Copy application payload from the repo root into packaging/appimage/AppDir.
# Same logic as sync_payload in packaging/appimage/build-appimage.sh — run this
# after changing main.js, platform/, or taskTimer@CryptoD/ when testing the
# AppDir locally (those paths are gitignored; see .gitignore).
#
# Usage: bin/sync-appdir.sh [REPO_ROOT]
# Default REPO_ROOT: parent of bin/

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "${1:-$SCRIPT_DIR/..}" && pwd)
APPDIR="$REPO_ROOT/packaging/appimage/AppDir"

if [ ! -d "$APPDIR" ]; then
  echo "sync-appdir: AppDir not found: $APPDIR" >&2
  exit 1
fi

for f in main.js config.js context.js i18n.js app_version.js version.json; do
  if [ ! -f "$REPO_ROOT/$f" ]; then
    echo "sync-appdir: missing $REPO_ROOT/$f" >&2
    exit 1
  fi
  cp -a "$REPO_ROOT/$f" "$APPDIR/"
done

mkdir -p "$APPDIR/platform" "$APPDIR/taskTimer@CryptoD"
rsync -a --delete "$REPO_ROOT/platform/" "$APPDIR/platform/"
rsync -a --delete "$REPO_ROOT/taskTimer@CryptoD/" "$APPDIR/taskTimer@CryptoD/"

if [ -f "$APPDIR/AppRun" ]; then chmod +x "$APPDIR/AppRun"; fi
if [ -f "$APPDIR/usr/bin/tasktimer" ]; then chmod +x "$APPDIR/usr/bin/tasktimer"; fi

echo "sync-appdir: synced $APPDIR from $REPO_ROOT" >&2
