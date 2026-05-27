# HTTP API reference (taskTimer)

This folder holds **reference contracts** for a future taskTimer HTTP backend. The shipped product is a **GJS/GTK desktop app** without a bundled API server.

| Document | Purpose |
|----------|---------|
| **[`openapi.yaml`](openapi.yaml)** | OpenAPI 3.0 initial slice (Task 73): auth, tasks, projects, admin users, errors |
| [`errors.md`](errors.md) | JSON error envelope + stable `error_code` values |
| [`pagination-contract.md`](pagination-contract.md) | List endpoint pagination request/response shape |
| [`collection-get-endpoints.md`](collection-get-endpoints.md) | Endpoint inventory (N/A until backend exists) |

## Viewing the spec

```bash
# Redocly CLI (optional)
npx @redocly/cli preview-docs docs/api/openapi.yaml

# Swagger UI via Docker (optional)
docker run --rm -p 8080:8080 \
  -e SWAGGER_JSON=/spec/openapi.yaml \
  -v "$(pwd)/docs/api/openapi.yaml:/spec/openapi.yaml" \
  swaggerapi/swagger-ui
```

## Client mapping

User-facing error strings: [`src/api/api_error_messages.js`](../../src/api/api_error_messages.js) (must stay in sync with `ErrorCode` in `openapi.yaml` and `errors.md`).

**Verify:** `gjs tests/test20_openapi_spec.js`

**Drift check (Task 74):** `bin/check-openapi-drift.sh` — see [CONTRIBUTING.md](../../CONTRIBUTING.md) Task 96.
