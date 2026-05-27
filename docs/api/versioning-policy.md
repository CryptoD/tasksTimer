# API versioning policy (Task 75)

## Decision

taskTimer uses a **URL path prefix** for every public HTTP route:

```text
/api/v1/{resource}
```

We do **not** ship an “unversioned stable” public API. Version **`v1`** is the first stable
contract, documented in [`openapi.yaml`](openapi.yaml).

## Rationale

| Approach | Choice |
|----------|--------|
| Path prefix (`/api/v1`) | **Yes** — visible in logs, proxies, and client config |
| Header versioning (`Accept-Version`) | No — not used for v1 |
| Unversioned `/api/*` only | **No** — breaking changes would be ambiguous |

Same-origin deployments terminate TLS at Caddy/nginx and proxy **`/api/*`** to the backend
(see [`packaging/caddy/Caddyfile`](../../packaging/caddy/Caddyfile)). The browser SPA uses a
**relative** base of **`/api/v1`** so cookies and CSP `connect-src 'self'` stay same-origin.

## OpenAPI `servers`

Canonical entries in [`openapi.yaml`](openapi.yaml):

| Server URL | Use |
|------------|-----|
| `https://app.example.com/api/v1` | Production (SPA + API same host) |
| `http://localhost:8080/api/v1` | Local Caddy (`Dockerfile.caddy`) |
| `http://localhost:3000/api/v1` | Backend process direct (no proxy) |

OpenAPI **path keys** remain resource-relative (`/auth/login`, `/tasks`, …). The **`servers`**
URL includes `/api/v1`; clients must not double the prefix.

Example resolved URL:

```text
server https://app.example.com/api/v1  +  path /tasks  →  GET https://app.example.com/api/v1/tasks
```

## Client configuration

Reference SPA config: [`frontend/config.js`](../../frontend/config.js).

| Variable | Default | Purpose |
|----------|---------|---------|
| `REACT_APP_API_BASE_URL` | `/api/v1` | Base URL for `fetch` / HTTP clients (relative same-origin) |

Override only for cross-origin dev (e.g. `http://localhost:3000/api/v1`) — then CORS/cookie
policy in Task 67 applies.

**Not** the desktop JSON settings module: root [`config.js`](../../config.js) is XDG
`config.json` for the GTK app only.

## Backend routing

When a Go (or other) server is added:

- Mount all public handlers under **`/api/v1`** (or strip `/api/v1` at the reverse proxy and
  mount internally — but external contract stays `/api/v1/...`).
- Health/readiness probes may live at **`/health`** (unversioned, ops-only) — not part of the
  public product API.

## Breaking changes

1. Publish **`/api/v2`** OpenAPI + implementation.
2. Keep **`/api/v1`** until clients migrate (document sunset in CHANGELOG).
3. Bump **`info.version`** in `openapi.yaml` when the **spec document** changes; bump **`vN`**
   in the URL only for **breaking** HTTP contract changes.

## Related docs

- [`openapi.yaml`](openapi.yaml) — route catalog
- [`README.md`](../../README.md) — product summary + API versioning
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) Task 96 — OpenAPI drift when handlers change
