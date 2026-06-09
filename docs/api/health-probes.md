# Health and readiness probes (Task 80)

Ops-only endpoints on the **API process root** (not under `/api/v1`). See [versioning-policy.md](versioning-policy.md).

| Path | Purpose | DB check | Success | Failure |
|------|---------|----------|---------|---------|
| **`GET /health`** | **Liveness** — process accepting HTTP | No | **200** `{ "status": "ok" }` | *(process down → TCP failure)* |
| **`GET /readyz`** | **Readiness** — can serve traffic | Yes (`SELECT 1` / ping) | **200** `{ "status": "ready", "checks": { "database": "ok" } }` | **503** `{ "status": "not_ready", "checks": { "database": "unreachable" }, "error_code": "SERVICE_UNAVAILABLE" }` |
| **`GET /metrics`** | **Prometheus scrape** (Task 81) | No | **200** `text/plain` exposition | — |

**Load balancer / orchestrator rules:**

- Use **`/health`** for **liveness** (cheap; do not remove pod on transient DB blip).
- Use **`/readyz`** for **readiness** and **load-balancer member health** — **503** removes instance from rotation until DB recovers.

Reference implementation: [`tooling/reference_api_server.mjs`](../../tooling/reference_api_server.mjs). Verify: `bin/verify-health-probes.sh`.

Metrics and RED dashboards: [`docs/dev/observability.md`](../dev/observability.md) (Task 81).
