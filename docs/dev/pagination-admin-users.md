## Pagination: admin user list (`GET /users`)

### Status

**N/A in this repository.**

### Why

This repo is the `taskTimer` GJS/GTK desktop app and contains:

- No Go backend (`*.go` files are absent)
- No HTTP router or `GET /users`
- No `database.ListUsers`, `validation.ParsePagination`, or `listProjects` handler to mirror

See `docs/dev/architecture.md` (explicitly calls out the absence of `internal/server/` and `main.go`).

### What to do in the backend repo (outline)

When working in the actual backend repository that owns `GET /users`:

- Add pagination inputs (`limit`/`offset` or cursor) and validation caps (reuse `validation.ParsePagination`)
- Extend `database.ListUsers` to return `(users, totalCount)` (or equivalent) and enforce max cap
- Update handler to return `total_count` and mirror the existing `listProjects` response shape
- Update admin UI to use pagination (if it assumes full list)
- Add tests for bounds/caps and `total_count`

