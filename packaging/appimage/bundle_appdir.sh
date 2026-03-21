#!/bin/bash
# Populate packaging/appimage/AppDir with hicolor icons (raster + scalable + symbolic)
# and compiled gettext catalogs under usr/share/locale/.
#
# Requires: ImageMagick `convert` (SVG→PNG), GNU gettext `msgfmt`.
# Usage: from repo root —  packaging/appimage/bundle_appdir.sh

set -euo pipefail

ME=$(basename "$0")
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
# packaging/appimage → repository root is two levels up
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
APPDIR="$SCRIPT_DIR/AppDir"
SVG_SRC="$REPO_ROOT/taskTimer@CryptoD/icons/kitchen-timer-blackjackshellac-full.svg"
SYM_SRC="$REPO_ROOT/taskTimer@CryptoD/icons/tasktimer-symbolic.svg"

if [ ! -f "$SVG_SRC" ]; then
  echo "[$ME] Missing SVG: $SVG_SRC" >&2
  exit 1
fi
if ! command -v convert >/dev/null 2>&1; then
  echo "[$ME] ImageMagick 'convert' is required to render PNG icons." >&2
  exit 1
fi

echo "[$ME] AppDir: $APPDIR"

# Raster sizes (freedesktop hicolor)
for s in 16 22 24 32 48 64 128 256 512; do
  outdir="$APPDIR/usr/share/icons/hicolor/${s}x${s}/apps"
  mkdir -p "$outdir"
  convert -background none -density 300 "$SVG_SRC" -resize "${s}x${s}" \
    "$outdir/com.github.cryptod.tasktimer.png"
  echo "[$ME]  ${s}x${s} PNG"
done

# Scalable full-color (source of truth for vectors)
mkdir -p "$APPDIR/usr/share/icons/hicolor/scalable/apps"
cp -f "$SVG_SRC" "$APPDIR/usr/share/icons/hicolor/scalable/apps/com.github.cryptod.tasktimer.svg"
echo "[$ME]  scalable SVG"

# Symbolic (panel / symbolic theme)
if [ -f "$SYM_SRC" ]; then
  mkdir -p "$APPDIR/usr/share/icons/hicolor/symbolic/apps"
  cp -f "$SYM_SRC" "$APPDIR/usr/share/icons/hicolor/symbolic/apps/com.github.cryptod.tasktimer-symbolic.svg"
  echo "[$ME]  symbolic SVG"
fi

# Compiled translations → usr/share/locale/<lang>/LC_MESSAGES/tasktimer.mo
export APPDIR="$APPDIR"
"$REPO_ROOT/bin/po_compile.sh"
rm -f "$APPDIR/usr/share/locale/.gitkeep"

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t "$APPDIR/usr/share/icons/hicolor" || true
  echo "[$ME]  gtk-update-icon-cache"
fi

echo "[$ME] Done."
