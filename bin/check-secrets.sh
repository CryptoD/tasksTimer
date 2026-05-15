#!/usr/bin/env bash
# Scan tracked files for common accidental secret patterns.
# Usage: bin/check-secrets.sh
# See docs/dev/development.md → "Secret scanning hygiene".
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "check-secrets.sh: not a git repository" >&2
  exit 1
fi

mapfile -t files < <(git ls-files -z | tr '\0' '\n' | grep -vE '^package-lock\.json$|^LICENSE$' || true)

if [ ${#files[@]} -eq 0 ]; then
  echo "[check-secrets] no tracked files"
  exit 0
fi

# Paths with intentional mock tokens / test strings (still scanned elsewhere).
EXCLUDE_REGEX='^(e2e/critical-path\.spec\.mjs|tests/test16_api_error_messages\.js)$'

patterns=(
  'sk-[A-Za-z0-9]{20,}'
  'BEGIN (RSA |OPENSSH |EC |PGP )?PRIVATE KEY'
  'ghp_[A-Za-z0-9]{36,}'
  'github_pat_[A-Za-z0-9_]{20,}'
  'AKIA[0-9A-Z]{16}'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
)

found=0
for pat in "${patterns[@]}"; do
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    file="${line%%:*}"
    if [[ "$file" =~ $EXCLUDE_REGEX ]]; then
      continue
    fi
    echo "[check-secrets] MATCH ($pat): $line" >&2
    found=1
  done < <(grep -nE "$pat" "${files[@]}" 2>/dev/null || true)
done

if [ "$found" -ne 0 ]; then
  echo "[check-secrets] FAILED — review matches above (or extend bin/check-secrets.sh exclusions with justification)" >&2
  exit 1
fi

echo "[check-secrets] ok (no high-risk patterns in tracked files)"
