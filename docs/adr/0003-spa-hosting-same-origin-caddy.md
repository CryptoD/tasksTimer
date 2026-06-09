# ADR 0003: SPA hosting — same-origin via Caddy

- **Status:** Accepted  
- **Date:** 2026-05-27  

## Context

A future web UI needs static asset hosting and API access without CORS complexity for first-party browsers. Checklists mention nginx/Caddy, CSP, and cookie SameSite behavior. This repo already ships a reference [`packaging/caddy/Caddyfile`](../../packaging/caddy/Caddyfile) and [`Dockerfile.caddy`](../../Dockerfile.caddy).

API versioning policy chooses path prefix **`/api/v1`** ([`versioning-policy.md`](../api/versioning-policy.md)).

## Decision

Host the **SPA** and **API** on the **same origin**:

```text
https://app.example.com/           → static SPA (index.html fallback)
https://app.example.com/api/v1/…   → reverse_proxy to backend
```

**Reference stack:** Caddy (or nginx equivalent) terminating TLS, serving `frontend/dist/` (or `dist/`), proxying `/api/*` to the API process.

**Headers:** apply [`tooling/security_headers_middleware.mjs`](../../tooling/security_headers_middleware.mjs) defaults (CSP with `connect-src 'self'` for same-origin API).

**Client config:** [`frontend/config.js`](../../frontend/config.js) defaults to `REACT_APP_API_BASE_URL=/api/v1`.

**Not chosen for v1:** separate API subdomain (`api.example.com`) unless a later ADR documents cross-origin CORS + cookie policy.

## Consequences

- **Positive:** no credentialed CORS preflight for normal SPA calls; simpler cookie model.
- **Negative:** static and API deploy together or share reverse proxy config; CDN for SPA only needs path rules for `/api`.
- **Ops:** see [deployment.md](../dev/deployment.md) Task 66/67 snippets.
