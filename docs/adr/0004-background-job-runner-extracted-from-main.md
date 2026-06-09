# ADR 0004: Background job runner extracted from `main`

- **Status:** Accepted  
- **Date:** 2026-05-27  

## Context

Long-running work (session/refresh cleanup, reminder dispatch, integration retries, audit compaction) must not block HTTP handlers or live in ad-hoc goroutines started from `main.go` without shutdown. [`docs/dev/background-jobs.md`](../dev/background-jobs.md) outlines extraction for a Go backend that does not exist in this desktop repo.

## Decision

Introduce **`internal/jobs`** (or equivalent) with a explicit **Runner**:

```text
Start(ctx, deps) → spawn worker goroutines
Stop()           → cancel ctx, WaitGroup wait, bounded timeout
```

**Move out of `main`:**

- Refresh-token / session expiry sweeps  
- Scheduled reminders and notification outbox  
- Integration webhook retries with backoff  

**Rules:**

- Every loop `select`s on `<-ctx.Done()`.
- DB calls use context timeouts; no unbounded transactions.
- Jobs are **idempotent** where possible (safe on duplicate tick).

**Testing:** fake clock + in-memory or SQLite test DB; assert **no goroutine leak** after `Stop()`.

**Desktop app:** unchanged — GJS timers remain in-process; this ADR applies **only** to the HTTP backend.

## Consequences

- **Positive:** clean process lifecycle; testable schedules; `main` stays wiring-only.
- **Negative:** small amount of boilerplate vs inline goroutines.
- **Not in scope:** distributed queue (Redis/SQS) until load requires ADR 0006+.
