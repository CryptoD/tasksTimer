#!/usr/bin/env bash
# Generate CycloneDX + SPDX SBOMs for npm dev tooling (package-lock.json).
# Outputs: dist/sbom/tasktimer-cyclonedx.json, dist/sbom/tasktimer-spdx.json
# See docs/dev/development.md (Task 65) and docs/dev/deployment.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="${ROOT}/dist/sbom"
mkdir -p "$OUT"

if [ ! -f package-lock.json ]; then
  echo "generate-sbom: package-lock.json missing; run npm ci first" >&2
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[sbom] node_modules missing; running npm ci"
  npm ci
fi

echo "[sbom] CycloneDX (JSON) → ${OUT}/tasktimer-cyclonedx.json"
npx --no-install @cyclonedx/cyclonedx-npm \
  --package-lock-only \
  --output-file "${OUT}/tasktimer-cyclonedx.json" \
  --output-format JSON

echo "[sbom] SPDX (JSON) → ${OUT}/tasktimer-spdx.json"
# `npm sbom` requires npm 10+ (Node 22 CI has it; use pinned npm 10 via npx for reproducibility).
npx --yes npm@10.9.2 sbom --package-lock-only --sbom-format spdx > "${OUT}/tasktimer-spdx.json"

echo "[sbom] done"
