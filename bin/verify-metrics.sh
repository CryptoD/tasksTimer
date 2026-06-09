#!/usr/bin/env bash
# Verify GET /metrics exposes Prometheus text (Task 81).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pick_port() {
  node -e "
    const net = require('net');
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { console.log(s.address().port); s.close(); });
  "
}

PORT="$(pick_port)"
BASE="http://127.0.0.1:${PORT}"

REFERENCE_API_HOST=127.0.0.1 REFERENCE_API_PORT="$PORT" node tooling/reference_api_server.mjs &
PID=$!
cleanup() { kill -9 "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; }
trap cleanup EXIT

for _ in $(seq 1 50); do
  if curl -sf "${BASE}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

# Generate sample API metrics
curl -sS -X POST "${BASE}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"secret"}' >/dev/null

METRICS="$(curl -sS "${BASE}/metrics")"

echo "$METRICS" | grep -q 'http_requests_total'
echo "$METRICS" | grep -q 'http_request_duration_seconds_sum'
echo "$METRICS" | grep -q 'http_request_duration_seconds_count'
echo "$METRICS" | grep -q 'process_start_time_seconds'
echo "$METRICS" | grep -q 'route="/api/v1/auth/login"'

echo "[verify-metrics] ok"
