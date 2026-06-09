#!/usr/bin/env bash
# Verify docs/api/examples.md copy-paste against the reference API server (Task 79).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "verify-api-examples: node required" >&2
  exit 1
fi

# Pick a free port on loopback
PORT="${REFERENCE_API_PORT:-}"
if [ -z "$PORT" ]; then
  PORT="$(node -e "
    const net = require('net');
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { console.log(s.address().port); s.close(); });
  ")"
fi

export REFERENCE_API_HOST=127.0.0.1
export REFERENCE_API_PORT="$PORT"
export API_BASE_URL="http://${REFERENCE_API_HOST}:${REFERENCE_API_PORT}/api/v1"

node tooling/reference_api_server.mjs &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; wait "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

# Wait for listen (401 = route live; 000 = connection refused)
for _ in $(seq 1 50); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "${API_BASE_URL}/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"x","password":"y"}' 2>/dev/null || echo 000)"
  if [ "$CODE" = "401" ] || [ "$CODE" = "200" ]; then
    break
  fi
  sleep 0.1
done
if [ "${CODE:-000}" = "000" ]; then
  echo "verify-api-examples: server did not start on port $PORT" >&2
  exit 1
fi

echo "[verify-api-examples] login (curl)"
LOGIN_JSON="$(curl -sS -X POST "${API_BASE_URL}/auth/login" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-ID: verify-curl' \
  -d '{"email":"admin@example.com","password":"secret"}')"

TOKEN="$(node -e "const j=JSON.parse(process.argv[1]); if(!j.access_token) process.exit(1); console.log(j.access_token);" "$LOGIN_JSON")"

echo "[verify-api-examples] list tasks (curl)"
TASKS_JSON="$(curl -sS "${API_BASE_URL}/tasks?limit=25&offset=0" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'X-Correlation-ID: verify-curl-tasks')"

node -e "
  const t = JSON.parse(process.argv[1]);
  if (!Array.isArray(t.items) || t.total_count < 1) {
    console.error('expected items array and total_count >= 1');
    process.exit(1);
  }
" "$TASKS_JSON"

echo "[verify-api-examples] login → list (node script)"
OUT="$(node docs/api/examples/login_list_tasks.mjs)"
node -e "
  const t = JSON.parse(process.argv[1]);
  if (!Array.isArray(t.items) || t.items.length < 1) process.exit(1);
" "$OUT"

echo "[verify-api-examples] ok"
