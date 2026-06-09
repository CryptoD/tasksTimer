#!/usr/bin/env bash
# Verify GET /health (liveness) and GET /readyz (readiness + DB) — Task 80.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
  echo "verify-health-probes: node and curl required" >&2
  exit 1
fi

pick_port() {
  node -e "
    const net = require('net');
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { console.log(s.address().port); s.close(); });
  "
}

run_probe_case() {
  local db_ok="$1"
  local label="$2"
  local expect_ready="$3"

  local port
  port="$(pick_port)"
  local base="http://127.0.0.1:${port}"

  REFERENCE_API_HOST=127.0.0.1 REFERENCE_API_PORT="$port" REFERENCE_API_DB_OK="$db_ok" \
    node tooling/reference_api_server.mjs &
  local pid=$!

  cleanup() { kill -9 "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; }
  trap cleanup RETURN

  local code=000
  for _ in $(seq 1 50); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "${base}/health" 2>/dev/null || true)"
    code="${code:-000}"
    if [ "$code" = "200" ]; then
      break
    fi
    sleep 0.1
  done
  if [ "$code" != "200" ]; then
    echo "verify-health-probes: ${label}: server did not start" >&2
    return 1
  fi

  local health
  health="$(curl -sS "${base}/health")"
  node -e "const j=JSON.parse(process.argv[1]); if(j.status!=='ok') process.exit(1)" "$health"

  local ready_code
  ready_code="$(curl -s -o /dev/null -w '%{http_code}' "${base}/readyz")"
  if [ "$ready_code" != "$expect_ready" ]; then
    echo "verify-health-probes: ${label}: /readyz expected ${expect_ready}, got ${ready_code}" >&2
    return 1
  fi

  if [ "$expect_ready" = "200" ]; then
    local body
    body="$(curl -sS "${base}/readyz")"
    node -e "const j=JSON.parse(process.argv[1]); if(j.checks.database!=='ok') process.exit(1)" "$body"
  fi

  trap - RETURN
  cleanup
}

echo "[verify-health-probes] DB ok"
run_probe_case 1 "db_ok" 200

echo "[verify-health-probes] DB down → 503, /health still 200"
run_probe_case 0 "db_down" 503

echo "[verify-health-probes] ok"
