#!/bin/bash

# Compile all taskTimer .po files into .mo files and install them both in the
# extension-local locale/ tree and under usr/share/locale/ in the AppDir.
#
# Usage:
#   bin/po_compile.sh
# or with an explicit AppDir:
#   APPDIR=/path/to/AppDir bin/po_compile.sh
#
# When APPDIR is not set, the script assumes the project root (one level above
# taskTimer@CryptoD) is the AppDir staging root.

set -e

ME=$(basename "$0")
MD=$(cd "$(dirname "$0")" && pwd)

echo "$MD"
cd "$MD/../taskTimer@CryptoD"
if [ $? -ne 0 ]; then
  echo "[$ME] Failed to change to extension directory" >&2
  exit 1
fi

echo "[$ME] Working in $(pwd)"

PO_DIR="po"
if [ ! -d "$PO_DIR" ]; then
  echo "[$ME] PO directory '$PO_DIR' not found" >&2
  exit 1
fi

APPDIR_ROOT="${APPDIR:-$(cd .. && pwd)}"
echo "[$ME] Using APPDIR root: $APPDIR_ROOT"

for po in "$PO_DIR"/*.po; do
  [ -f "$po" ] || continue
  lang=$(basename "$po" .po)

  echo "[$ME] Compiling $po for language '$lang'"

  EXT_LOCALE_DIR="locale/$lang/LC_MESSAGES"
  mkdir -p "$EXT_LOCALE_DIR"
  msgfmt -v "$po" -o "$EXT_LOCALE_DIR/tasktimer.mo"

  APP_LOCALE_DIR="$APPDIR_ROOT/usr/share/locale/$lang/LC_MESSAGES"
  mkdir -p "$APP_LOCALE_DIR"
  cp -v "$EXT_LOCALE_DIR/tasktimer.mo" "$APP_LOCALE_DIR/"
done

echo "[$ME] Done compiling and installing .mo files."

