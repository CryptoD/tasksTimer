#!/bin/bash
# Build a taskTimer AppImage from packaging/appimage/AppDir.
#
# App version for the output filename comes from ../../version.json (repo root).
#
# Steps:
#   1. Sync main.js, config.js, context.js, i18n.js, app_version.js, version.json,
#      platform/, taskTimer@CryptoD/ into AppDir.
#   2. Run bundle_appdir.sh (unless --skip-bundle): hicolor icons, locale .mo, icon cache.
#   3. Run appimagetool to produce packaging/appimage/dist/tasktimer-<version>-<arch>.AppImage.
#
# Tooling: this project uses a thin bundle (system gjs/GTK; see APPDIR.md). The standard
# way to turn an AppDir into an AppImage is appimagetool. linuxdeploy targets bundling ELF
# dependencies into an AppDir; appimage-builder uses a recipe file—neither is required here.
#
# Requires: rsync, python3; bundle_appdir.sh needs convert + msgfmt.
# Optional: curl or wget to fetch appimagetool; or install appimagetool / set APPIMAGETOOL.
#
# Usage: packaging/appimage/build-appimage.sh [--skip-bundle] [--no-download]

set -euo pipefail

ME=$(basename "$0")
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
APPDIR="$SCRIPT_DIR/AppDir"
DIST_DIR="$SCRIPT_DIR/dist"
CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/tasktimer-appimage"

SKIP_BUNDLE=0
NO_DOWNLOAD=0

usage() {
  cat <<EOF
Usage: $ME [options]

Construct AppDir, optionally refresh icons/locales, then run appimagetool.
Writes: packaging/appimage/dist/tasktimer-<version>-<arch>.AppImage

Options:
  --skip-bundle   Skip bundle_appdir.sh (faster when icons/locale are up to date)
  --no-download   Use appimagetool from PATH only (do not download to cache)
  -h, --help      Show this help

Environment:
  APPIMAGETOOL    Full path to appimagetool (skips download and PATH lookup)
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-bundle) SKIP_BUNDLE=1 ;;
    --no-download) NO_DOWNLOAD=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "[$ME] Unknown option: $1" >&2; usage; exit 1 ;;
  esac
  shift
done

get_appimage_arch() {
  case "$(uname -m)" in
    x86_64) echo x86_64 ;;
    aarch64|arm64) echo aarch64 ;;
    *)
      echo "[$ME] Unsupported machine: $(uname -m)" >&2
      exit 1
      ;;
  esac
}

sync_payload() {
  echo "[$ME] Syncing application payload into AppDir..." >&2
  for f in main.js config.js context.js i18n.js app_version.js version.json; do
    if [ ! -f "$REPO_ROOT/$f" ]; then
      echo "[$ME] Missing file: $REPO_ROOT/$f" >&2
      exit 1
    fi
    cp -a "$REPO_ROOT/$f" "$APPDIR/"
  done
  mkdir -p "$APPDIR/platform" "$APPDIR/taskTimer@CryptoD"
  rsync -a --delete "$REPO_ROOT/platform/" "$APPDIR/platform/"
  rsync -a --delete "$REPO_ROOT/taskTimer@CryptoD/" "$APPDIR/taskTimer@CryptoD/"
  if [ -f "$APPDIR/AppRun" ]; then chmod +x "$APPDIR/AppRun"; fi
  if [ -f "$APPDIR/usr/bin/tasktimer" ]; then chmod +x "$APPDIR/usr/bin/tasktimer"; fi
}

# appimagetool expects the primary .desktop and icon at the AppDir root (see AppImage docs).
ensure_appimage_root_links() {
  ln -sf "usr/share/applications/com.github.cryptod.tasktimer.desktop" \
    "$APPDIR/com.github.cryptod.tasktimer.desktop"
  if [ -f "$APPDIR/usr/share/icons/hicolor/256x256/apps/com.github.cryptod.tasktimer.png" ]; then
    ln -sf "usr/share/icons/hicolor/256x256/apps/com.github.cryptod.tasktimer.png" \
      "$APPDIR/com.github.cryptod.tasktimer.png"
  fi
  if [ -f "$APPDIR/usr/share/icons/hicolor/scalable/apps/com.github.cryptod.tasktimer.svg" ]; then
    ln -sf "usr/share/icons/hicolor/scalable/apps/com.github.cryptod.tasktimer.svg" \
      "$APPDIR/com.github.cryptod.tasktimer.svg"
  fi
}

download_appimagetool() {
  local arch="$1"
  local url="https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-${arch}.AppImage"
  local dest="$CACHE_DIR/appimagetool-${arch}.AppImage"
  mkdir -p "$CACHE_DIR"
  if [ -f "$dest" ] && [ -s "$dest" ]; then
    chmod +x "$dest" 2>/dev/null || true
    echo "[$ME] Using cached appimagetool: $dest" >&2
    printf '%s\n' "$dest"
    return 0
  fi
  echo "[$ME] Downloading appimagetool (${arch})..." >&2
  local tmp="${dest}.part"
  rm -f "$tmp"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL -o "$tmp" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$tmp" "$url"
  else
    echo "[$ME] Need curl or wget to download appimagetool." >&2
    exit 1
  fi
  mv "$tmp" "$dest"
  chmod +x "$dest"
  printf '%s\n' "$dest"
}

resolve_appimagetool() {
  local arch="$1"
  if [ -n "${APPIMAGETOOL:-}" ]; then
    if [ ! -f "${APPIMAGETOOL}" ]; then
      echo "[$ME] APPIMAGETOOL is not a file: ${APPIMAGETOOL}" >&2
      exit 1
    fi
    chmod +x "${APPIMAGETOOL}" 2>/dev/null || true
    printf '%s\n' "${APPIMAGETOOL}"
    return 0
  fi
  if command -v appimagetool >/dev/null 2>&1; then
    command -v appimagetool
    return 0
  fi
  if [ "$NO_DOWNLOAD" = 1 ]; then
    echo "[$ME] appimagetool not found in PATH. Install it or set APPIMAGETOOL=..." >&2
    exit 1
  fi
  download_appimagetool "$arch"
}

VERSION=$(python3 -c "import json; print(json.load(open('$REPO_ROOT/version.json'))['version'])")
ARCH=$(get_appimage_arch)
export ARCH

if [ ! -d "$APPDIR" ]; then
  echo "[$ME] AppDir not found: $APPDIR" >&2
  exit 1
fi

sync_payload

if [ "$SKIP_BUNDLE" = 0 ]; then
  "$SCRIPT_DIR/bundle_appdir.sh"
else
  echo "[$ME] Skipping bundle_appdir.sh (--skip-bundle)." >&2
fi

ensure_appimage_root_links

TOOL=$(resolve_appimagetool "$ARCH")
mkdir -p "$DIST_DIR"
OUT="$DIST_DIR/tasktimer-${VERSION}-${ARCH}.AppImage"
rm -f "$OUT"

echo "[$ME] Running appimagetool → $OUT" >&2
export APPIMAGE_EXTRACT_AND_RUN=1
"$TOOL" "$APPDIR" "$OUT"

echo "[$ME] Done: $OUT" >&2
