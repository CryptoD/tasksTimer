## Pagination contract (list endpoints)

### Status for this repository

**N/A**: `taskTimer` is a GJS/GTK desktop application and does not expose an HTTP API in this repo.
This document exists as the **single source of truth** for list pagination parameters and response
shape for the backend service repository that implements the API.

### Scope

Applies to **collection/list** endpoints (e.g. tasks, projects, users, tags, reports, audit log,
webhooks, integrations).

### Request parameters (offset pagination)

- **`limit`**: integer
  - Default: **25**
  - Min: **1**
  - Max cap: **100** (server-enforced; values above cap are clamped or rejected)
- **`offset`**: integer
  - Default: **0**
  - Min: **0**

Validation rules:

- Non-integers: **400** (or treat as missing and apply defaults; pick one behavior and keep consistent)
- Negative values: **400**
- `limit=0`: **400**

### Request parameters (cursor pagination — optional)

If a list endpoint uses cursor pagination, it must accept:

- **`cursor`**: opaque string token returned by prior request (mutually exclusive with `offset`)
- **`limit`**: same rules/caps as above

Rules:

- Supplying both `cursor` and `offset`: **400**
- Sorting must be deterministic and stable for cursor mode.

### Sorting parameters

If supported by an endpoint, it must accept:

- **`sort`**: string field name (endpoint-defined allowlist)
- **`order`**: `asc` | `desc` (default `asc`)

Rules:

- Unknown `sort`: **400** (preferred) or default to server’s canonical sort (must be documented per endpoint)

### Response shape (canonical)

Every list endpoint must return:

```json
{
  "items": [],
  "total_count": 0,
  "limit": 25,
  "offset": 0,
  "sort": "created_at",
  "order": "desc"
}
```

Notes:

- `items`: array of entity objects
- `total_count`: integer count of all matching rows **ignoring** pagination
- `limit`/`offset`: echo the applied pagination (post-defaulting / post-clamping)
- `sort`/`order`: echo the applied sort (if supported; otherwise omit consistently)

Cursor variant:

```json
{
  "items": [],
  "total_count": 0,
  "limit": 25,
  "next_cursor": "opaque-token"
}
```

Rules:

- If `next_cursor` is omitted or null, the client must treat it as “no more pages”.

### Exemptions

Endpoints may be exempt only if they are **not production-facing** or the dataset is provably bounded.
Exemptions must be recorded in the endpoint inventory table with a short rationale (or an ADR entry).

