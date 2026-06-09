# Observability — metrics (Task 81)

Reference metrics for a **future taskTimer HTTP API**. The shipped GTK app has no Prometheus scrape target.

## Exposition

| Approach | Status | Path |
|----------|--------|------|
| **Prometheus text** | **Accepted (v1 reference)** | `GET /metrics` on API process root (ops-only, not versioned) |
| **OpenTelemetry OTLP** | Deferred | Add ADR when backend ships; export RED via OTel → Prometheus or Grafana Cloud |

Reference implementation: [`tooling/reference_api_server.mjs`](../../tooling/reference_api_server.mjs) + [`tooling/prometheus_metrics.mjs`](../../tooling/prometheus_metrics.mjs).

**Verify:** `bin/verify-metrics.sh` or `npm run verify:metrics`

```bash
curl -sS http://127.0.0.1:3000/metrics | head
```

Scrape config (Prometheus):

```yaml
scrape_configs:
  - job_name: tasktimer-api
    metrics_path: /metrics
    static_configs:
      - targets: ['api:3000']
```

Do **not** expose `/metrics` on the public internet without auth or network policy; scrape from the observability VPC / k8s cluster only.

---

## RED metrics (Request-driven services)

Use **RED** for the HTTP API ([Google SRE — monitoring distributed systems](https://sre.google/sre-book/monitoring-distributed-systems/)):

| Letter | Meaning | Prometheus (this repo) | Notes |
|--------|---------|------------------------|-------|
| **R** — Rate | Requests per second | `rate(http_requests_total{route!="/metrics"}[5m])` | Exclude scrapes (`route="/metrics"`) from SLI dashboards |
| **E** — Errors | Failed requests | `rate(http_requests_total{status=~"5..",route!="/metrics"}[5m])` | Include **503** on `/readyz` only if you monitor probe path; prefer API routes |
| **D** — Duration | Latency | `rate(http_request_duration_seconds_sum{route!="/metrics"}[5m]) / rate(http_request_duration_seconds_count{route!="/metrics"}[5m])` | Production: use native histogram `http_request_duration_seconds_bucket` |

### Canonical metric names (v1 reference)

| Metric | Type | Labels | Purpose |
|--------|------|--------|---------|
| `http_requests_total` | counter | `method`, `route`, `status` | RED rate + errors |
| `http_request_duration_seconds_sum` | counter | *(none in reference)* | RED duration numerator |
| `http_request_duration_seconds_count` | counter | *(none in reference)* | RED duration denominator |
| `process_start_time_seconds` | gauge | — | Process uptime / staleness checks |

**Production backend:** add `route` label with OpenAPI template paths only (low cardinality). Add histogram buckets and `job`, `instance` via Prometheus scrape labels.

### Example PromQL (API traffic only)

```promql
# Request rate (R)
sum by (route) (rate(http_requests_total{route=~"/api/v1/.*"}[5m]))

# Error ratio (E) — 5xx among API routes
sum(rate(http_requests_total{route=~"/api/v1/.*",status=~"5.."}[5m]))
/
sum(rate(http_requests_total{route=~"/api/v1/.*"}[5m]))

# Mean latency seconds (D) — reference counters; prefer histogram in production
sum(rate(http_request_duration_seconds_sum[5m]))
/
sum(rate(http_request_duration_seconds_count[5m]))
```

---

## Sample Grafana panel (RED overview)

Import [`grafana/api-red-overview.json`](grafana/api-red-overview.json) or create three panels:

| Panel | Type | PromQL |
|-------|------|--------|
| **Request rate** | Time series | `sum(rate(http_requests_total{route=~"/api/v1/.*"}[5m]))` |
| **Error rate (5xx)** | Time series | `sum(rate(http_requests_total{route=~"/api/v1/.*",status=~"5.."}[5m]))` |
| **Mean latency (s)** | Time series | `sum(rate(http_request_duration_seconds_sum[5m])) / sum(rate(http_request_duration_seconds_count[5m]))` |

Dashboard UID in JSON: `tasktimer-api-red` (reference only).

---

## Related

- Probes: [`docs/api/health-probes.md`](../api/health-probes.md) (Task 80)
- Load balancer: [`deployment.md`](deployment.md)
- OpenAPI routes: [`docs/api/openapi.yaml`](../api/openapi.yaml)

## OpenTelemetry (future)

When adding OTel:

1. Instrument HTTP handlers with `http.server.duration` (OTel semconv).
2. Export RED via OTLP gRPC to collector → Prometheus `remote_write` or Grafana Alloy.
3. Keep **`/metrics`** as optional pull endpoint for operators without OTLP.

Document the choice in `docs/adr/` when implemented.
