# ADR 0005: Offset pagination defaults (`limit` 25, cap 100)

- **Status:** Accepted  
- **Date:** 2026-05-27  

## Context

List endpoints (`GET /tasks`, `/projects`, `/users`, …) need consistent pagination. [`docs/api/pagination-contract.md`](../api/pagination-contract.md) defines the canonical request/response shape. OpenAPI parameters reference `limit`, `offset`, `sort`, and `order`.

Alternatives: cursor-only pagination, unlimited lists, or different defaults (10, 50).

## Decision

Use **offset pagination** as the **default** for all collection GET endpoints in v1:

| Parameter | Default | Constraints |
|-----------|---------|-------------|
| `limit` | **25** | min 1, max **100** (clamp or 400 — pick one per handler; prefer **clamp** for UX) |
| `offset` | **0** | min 0 |
| `sort` | endpoint-specific allowlist | unknown → **400** |
| `order` | `asc` | `asc` \| `desc` |

**Response** must include `items`, `total_count`, echoed `limit`/`offset`, and optional `sort`/`order` per contract.

**Cursor pagination:** optional later for high-churn lists; if added, **mutually exclusive** with `offset` (400 if both supplied).

**Admin `GET /users`:** same defaults ([`pagination-admin-users.md`](../dev/pagination-admin-users.md)).

## Consequences

- **Positive:** matches OpenAPI spec and admin UI table patterns; easy total counts for modest datasets.
- **Negative:** deep offsets costly at very large scale → cursor ADR when needed.
- **Implementation:** shared `ParsePagination(r)` helper in backend; tests for bounds, clamp, and `total_count`.
