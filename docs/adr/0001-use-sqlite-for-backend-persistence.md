# ADR 0001: SQLite for backend persistence

- **Status:** Accepted  
- **Date:** 2026-05-27  

## Context

A future taskTimer API needs durable storage for users, tasks, projects, sessions, and audit rows. Checklist options include PostgreSQL, MySQL, or embedded SQLite. Early deployments may be **single-node** (one VM, one container, homelab) before any multi-tenant SaaS scale-out.

## Decision

Use **SQLite** as the **default** database for v1 backend deployments, accessed through a single Go (or equivalent) data layer with **WAL mode**, **foreign keys ON**, and **migration files** checked into the repo.

**Production guidance:**

- One writer process (API server) per database file; background jobs share the same `*sql.DB` pool.
- File lives on persistent volume (not ephemeral container root).
- Backups: file-level snapshot or `sqlite3 .backup` on schedule.

**When to revisit:** multi-region writes, horizontal API scaling with concurrent writers, or managed DB requirements → ADR supersession to PostgreSQL (or similar).

## Consequences

- **Positive:** zero external DB dependency for small installs; simple backup; fast local dev.
- **Negative:** not ideal for many concurrent writers; operators must plan migration before scaling past one active writer.
- **Links:** pagination and entities in [`docs/api/openapi.yaml`](../api/openapi.yaml); no SQL in this desktop repo today.
