## Background jobs extracted from `main`

### Status

**N/A in this repository.**

### Why

This repo is the `taskTimer` GJS/GTK desktop application:

- Entry point is `main.js` (GJS), not `main.go`
- There is no `internal/` directory or Go package layout
- No goroutines, `context.Context`, or `*db.Database`

See `docs/dev/architecture.md` for the explicit “no Go backend” statement.

### What to do in the backend repository (outline)

When working in the actual Go backend repo that owns `main.go` and the DB:

- Create `internal/jobs` (or similar) with a small runner:
  - `Start(ctx context.Context, db *db.Database, cfg Config, clock Clock)` (or a `Runner` type with methods)
  - `Stop()` that cancels context and waits for all goroutines (use a `sync.WaitGroup`)
- Move reminder scheduling + token cleanup loops out of `main` into jobs:
  - Ensure all loops `select` on `<-ctx.Done()` to avoid orphaned goroutines
  - Ensure DB work is bounded and uses timeouts (child contexts)
- Add unit tests that inject a fake clock and assert:
  - jobs start/stop cleanly
  - no goroutines keep running after `Stop()`
  - cleanup/reminder logic runs on schedule

