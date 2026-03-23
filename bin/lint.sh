#!/usr/bin/env bash
# Static checks: gettext PO validation; shell scripts via shellcheck or bash -n.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[lint] gettext: msgfmt --check on .po files"
shopt -s nullglob
po=(taskTimer@CryptoD/po/*.po)
shopt -u nullglob
if [ ${#po[@]} -eq 0 ]; then
  echo "[lint] no .po files under taskTimer@CryptoD/po" >&2
else
  for f in "${po[@]}"; do
    msgfmt -c -o /dev/null "$f"
  done
fi

mapfile -t scripts < <(
  if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "$ROOT" ls-files '*.sh'
  else
    find "$ROOT" -name '*.sh' -not -path '*/.git/*' | sed "s|^$ROOT/||"
  fi
)

if [ ${#scripts[@]} -eq 0 ]; then
  echo "[lint] no shell scripts found" >&2
  exit 0
fi

if command -v shellcheck >/dev/null 2>&1; then
  echo "[lint] shellcheck (${#scripts[@]} scripts)"
  shellcheck "${scripts[@]}"
else
  echo "[lint] shellcheck not found; using bash -n (install shellcheck for stricter checks)" >&2
  for f in "${scripts[@]}"; do
    bash -n "$f"
  done
fi

echo "[lint] ok"
