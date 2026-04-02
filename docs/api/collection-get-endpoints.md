## Collection GET endpoints inventory

### Summary

This repository does **not** contain a Go HTTP backend (no `*.go`, no `internal/server/`).
It’s a **GJS/GTK desktop application** (see `docs/dev/architecture.md` and `Dockerfile.api`).

Because of that, there are **no collection GET endpoints** to inventory here (tasks, projects, users, tags, reports, audit, webhooks, integrations, etc. are **N/A** for this codebase).

### Expected grep (not applicable in this repo)

If this were a Go service, this inventory would be produced by grepping:

- `router.GET(` in `internal/server/*.go`

In this repo those files do not exist.

### Table

| Path | Auth | Pagination today | Max cap | Sort |
|------|------|------------------|---------|------|
| *(none — no backend routes in this repo)* | — | — | — | — |

### Task 7 note: `GET /users` pagination (admin user list)

The Task 7 objective references a Go backend route `GET /users` plus `database.ListUsers`,
`validation.ParsePagination`, and a `listProjects` response shape. None of these exist in this repository,
so there is nothing to implement or test here.

