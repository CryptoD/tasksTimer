# Architecture Decision Records

Durable decisions for a **future taskTimer HTTP backend** and optional SPA. The shipped product today is a **GJS/GTK desktop app** — these ADRs are **reference choices** for when that backend is implemented (see [architecture.md](../dev/architecture.md)).

Maintainer ADRs for **this repo’s GJS codebase** live separately under [`docs/dev/adr/`](../dev/adr/README.md).

## Index (Task 78)

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-use-sqlite-for-backend-persistence.md) | SQLite for backend persistence | Accepted |
| [0002](0002-jwt-access-with-refresh-tokens.md) | JWT access tokens + refresh rotation | Accepted |
| [0003](0003-spa-hosting-same-origin-caddy.md) | SPA hosting — same-origin via Caddy | Accepted |
| [0004](0004-background-job-runner-extracted-from-main.md) | Background job runner extracted from `main` | Accepted |
| [0005](0005-offset-pagination-defaults.md) | Offset pagination defaults (`limit` 25, cap 100) | Accepted |

## Format

Each file uses:

- **Status** — Proposed | Accepted | Deprecated | Superseded  
- **Date** — ISO date of acceptance  
- **Context** — forces and constraints  
- **Decision** — what we chose  
- **Consequences** — trade-offs and follow-ups  

## Related contracts

| Topic | Doc |
|-------|-----|
| OpenAPI | [`docs/api/openapi.yaml`](../api/openapi.yaml) |
| Pagination shape | [`docs/api/pagination-contract.md`](../api/pagination-contract.md) |
| API versioning | [`docs/api/versioning-policy.md`](../api/versioning-policy.md) |
| CORS / cookies | [`tooling/cors_cookie_policy.mjs`](../../tooling/cors_cookie_policy.mjs), [`packaging/caddy/Caddyfile`](../../packaging/caddy/Caddyfile) |
| Background jobs outline | [`docs/dev/background-jobs.md`](../dev/background-jobs.md) |

## When to add ADR 0006+

Add a new numbered ADR when a backend choice is **hard to reverse** (storage engine, auth model, deployment topology) or when checklists require an explicit exception. Link it from this index.
