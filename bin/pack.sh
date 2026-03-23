#!/bin/bash
# Pack the GNOME Shell extension into a .zip for extensions.gnome.org or local install.
# Run from repository root:  bin/pack.sh
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
"$ROOT/bin/check-deps.sh" --pack

ED="taskTimer@CryptoD"
ED_DIR="$ROOT/$ED"

if [ ! -d "$ED_DIR" ]; then
  echo "Extension dir $ED not found" >&2
  exit 1
fi

cd "$ED_DIR"

args=(--podir=po/
  --schema=schemas/org.gnome.shell.extensions.tasktimer.gschema.xml
  --gettext-domain=tasktimer)

shopt -s nullglob
for f in *.js; do
  case "$f" in
    prefs.js|extension.js) ;;
    *) args+=(--extra-source="$f") ;;
  esac
done
for f in *.ogg *.ui; do
  args+=(--extra-source="$f")
done
shopt -u nullglob

args+=(--extra-source=./icons/ --extra-source=./bin/ -o ../ --force)

echo "gnome-extensions pack ${args[*]}"
exec gnome-extensions pack "${args[@]}"
