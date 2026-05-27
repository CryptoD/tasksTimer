## Collection GET endpoints inventory

### Summary

This repository does **not** contain a Go HTTP backend (no `*.go`, no `internal/server/`).
It’s a **GJS/GTK desktop application** (see `docs/dev/architecture.md`).

**Reference API spec:** [`openapi.yaml`](openapi.yaml) (Task 73) documents intended collection routes.
Until a backend is implemented, runtime endpoints below remain **N/A**.

### Table (planned — from OpenAPI)

| Path | Auth | Pagination today | Max cap | Sort |
|------|------|------------------|---------|------|
| `GET /tasks` | Bearer / session | offset (`limit`/`offset`) | 100 | `sort`, `order` |
| `GET /projects` | Bearer / session | offset | 100 | `sort`, `order` |
| `GET /users` | Admin | offset | 100 | `sort`, `order` |

See [`pagination-contract.md`](pagination-contract.md) for request/response shape.

### Task 7 note: `GET /users` pagination (admin user list)

Implementation belongs in the backend repo that owns the routes in `openapi.yaml`.
Mirror `listProjects` pagination handler shape and enforce caps per `pagination-contract.md`.
