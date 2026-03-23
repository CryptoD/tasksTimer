#!/usr/bin/env bash
# Run TEST 12 in a clean ubuntu:24.04 container (requires Docker).
# Usage: from repository root:  bash tests/run_test12_docker.sh
#
# Note: This can take 10+ minutes (apt + gnome-shell + appimagetool download).
# Run from a normal terminal if your IDE/agent aborts long Docker jobs.
# For the same pipeline without Docker, use: bash tests/test12_full_build_local.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker not found. Use: bash tests/test12_full_build_local.sh" >&2
  exit 1
fi

exec docker run --rm \
  -v "$ROOT:/src:rw" \
  -w /src \
  ubuntu:24.04 \
  bash /src/tests/test12_full_build_in_container.sh
