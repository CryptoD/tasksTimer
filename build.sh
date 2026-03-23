#!/usr/bin/env bash
# Full local build: lint → test → gettext compile → gnome-extensions pack (.zip).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "==> lint"
make lint

echo "==> test"
make test

echo "==> translate (gettext) + package (extension zip)"
make pack

echo "==> build complete"
