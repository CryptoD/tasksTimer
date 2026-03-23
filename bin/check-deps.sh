#!/usr/bin/env bash
# Verify system dependencies before build targets. Fails fast with install hints.
#
# Usage:
#   bin/check-deps.sh [--compile] [--runtime] [--pack] [--appimage] [--install]
#   Default (no flags): same as --compile --runtime --pack (extension zip + tests).
#
# Notes:
#   - taskTimer uses GTK 3 only (not GTK 4). GTK 4 is reported as informational.
#   - AppImages are built with appimagetool (see packaging/appimage/build-appimage.sh).
#     linuxdeploy and appimage-builder are not used; do not install them for this repo.

set -euo pipefail

ME=$(basename "$0")
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED=$'\033[0;31m'
BOLD=$'\033[1m'
RESET=$'\033[0m'

die() {
	echo "${RED}${BOLD}[$ME]${RESET} $*" >&2
	exit 1
}

need_cmd() {
	local hint=$1
	shift
	local name=$1
	shift
	if ! command -v "$name" >/dev/null 2>&1; then
		die "Missing required command '${name}'. ${hint}"
	fi
}

gjs_import_ok() {
	local label=$1
	shift
	local code=$1
	if ! gjs -c "$code" >/dev/null 2>&1; then
		die "GJS check failed (${label}). Install GObject Introspection typelibs (see README / distro packages)."
	fi
}

DO_COMPILE=0
DO_RUNTIME=0
DO_PACK=0
DO_APPIMAGE=0
DO_INSTALL=0

if [ $# -eq 0 ]; then
	DO_COMPILE=1
	DO_RUNTIME=1
	DO_PACK=1
else
	while [ $# -gt 0 ]; do
		case "$1" in
		--compile) DO_COMPILE=1 ;;
		--runtime) DO_RUNTIME=1 ;;
		--pack) DO_PACK=1 ;;
		--appimage) DO_APPIMAGE=1 ;;
		--install) DO_INSTALL=1 ;;
		-h | --help)
			sed -n '1,20p' "$0" | tail -n +2
			exit 0
			;;
		*)
			die "Unknown option: $1 (try --help)"
			;;
		esac
		shift
	done
fi

# --appimage implies pack + runtime + compile (full toolchain for image)
if [ "$DO_APPIMAGE" = 1 ]; then
	DO_COMPILE=1
	DO_RUNTIME=1
	DO_PACK=1
fi

# --pack implies runtime + compile for a consistent dev environment
if [ "$DO_PACK" = 1 ]; then
	DO_COMPILE=1
	DO_RUNTIME=1
fi

if [ "$DO_COMPILE" = 1 ]; then
	echo "[$ME] Checking compile tools (gettext)..."
	need_cmd "e.g. Debian/Ubuntu: sudo apt install gettext" msgfmt
fi

if [ "$DO_RUNTIME" = 1 ]; then
	echo "[$ME] Checking GJS and GObject introspection (GTK 3, GStreamer)..."
	need_cmd "e.g. Debian/Ubuntu: sudo apt install gjs" gjs
	gjs_import_ok "GTK 3" 'imports.gi.versions.Gtk = "3.0"; void imports.gi.Gtk;'
	gjs_import_ok "GStreamer" 'imports.gi.versions.Gst = "1.0"; void imports.gi.Gst;'

	if gjs -c 'imports.gi.versions.Gtk = "4.0"; void imports.gi.Gtk;' >/dev/null 2>&1; then
		echo "[$ME] GTK 4 typelibs are available (optional; this project uses GTK 3 only)."
	else
		echo "[$ME] GTK 4 typelibs not found — OK, taskTimer targets GTK 3 only."
	fi
fi

if [ "$DO_PACK" = 1 ]; then
	echo "[$ME] Checking GNOME Shell extension packager..."
	need_cmd "e.g. Debian/Ubuntu: sudo apt install gnome-shell" gnome-extensions
fi

if [ "$DO_INSTALL" = 1 ]; then
	echo "[$ME] Checking schema compiler (local install)..."
	need_cmd "e.g. Debian/Ubuntu: sudo apt install libglib2.0-bin" glib-compile-schemas
fi

if [ "$DO_APPIMAGE" = 1 ]; then
	echo "[$ME] Checking AppImage tooling (this project uses appimagetool, not linuxdeploy/appimage-builder)..."
	need_cmd "e.g. Debian/Ubuntu: sudo apt install imagemagick" convert
	need_cmd "e.g. Debian/Ubuntu: sudo apt install rsync" rsync
	need_cmd "e.g. Debian/Ubuntu: sudo apt install python3" python3
	if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
		die "Need curl or wget to fetch appimagetool when not in PATH. e.g. sudo apt install curl"
	fi
	if command -v appimagetool >/dev/null 2>&1; then
		echo "[$ME] appimagetool found in PATH."
	else
		echo "[$ME] appimagetool not in PATH — build-appimage.sh will download it (requires curl or wget)."
	fi
	if command -v linuxdeploy >/dev/null 2>&1 || command -v linuxdeploy-plugin-appimage >/dev/null 2>&1; then
		echo "[$ME] Note: linuxdeploy is present but not used by packaging/appimage/build-appimage.sh."
	fi
	if command -v appimage-builder >/dev/null 2>&1; then
		echo "[$ME] Note: appimage-builder is present but not used by this repository."
	fi
fi

echo "[$ME] All selected dependency checks passed."
