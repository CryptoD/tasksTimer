# Audit log review (Task 71)

## Status

**N/A for the shipped GTK desktop app** — there is no HTTP admin API, no user model, and no
immutable audit store in this repository. This document records the **spot-check** and the
**contract** for a future backend.

## Spot-check (this repo)

| Action | Implemented? | Appears in audit trail? | `correlation_id`? |
|--------|--------------|-------------------------|-------------------|
| Admin password set / reset | **No** (no login/admin API) | **No** | **No** |
| User delete | **No** (no users) | **No** | **No** |
| Integration create / update / delete | **No** (only `TASKTIMER_INTEGRATION_SECRET` env at startup) | **No** | **No** |

**Correlation IDs:** grep for `correlation`, `correlation_id`, `X-Correlation-ID` → **zero**
matches before Task 71 policy was added.

**Application logging only:** `taskTimer@CryptoD/logger.js` is debug/diagnostic output, not an
audit trail (no actor, no immutable store, no correlation id).

### Verify locally

```bash
# No audit middleware or DB layer
rg -i 'auditlog|audit_log|correlation_id' --glob '*.{go,js,mjs,ts}' || true

# Policy + test (reference contract for future API)
gjs tests/test18_audit_log_policy.js
```

## Required when a backend is added

Canonical constants and validation: [`src/api/audit_log_policy.js`](../../src/api/audit_log_policy.js).

Every handler for the actions below MUST:

1. Read or generate **`X-Correlation-ID`** and attach it to the request context.
2. Persist an **append-only** audit row **before** returning success to the client.
3. Include at minimum: `action`, `correlation_id`, `actor_id`, `occurred_at` (ISO-8601 UTC).

| Category | `action` values |
|----------|-----------------|
| Admin password | `admin.password.set`, `admin.password.reset` |
| User delete | `user.delete` |
| Integration changes | `integration.create`, `integration.update`, `integration.delete` |

### Example audit row (integration update)

```json
{
  "action": "integration.update",
  "correlation_id": "req-550e8400-e29b-41d4-a716-446655440000",
  "actor_id": "user-admin-42",
  "occurred_at": "2026-05-27T12:00:00.000Z",
  "target_type": "integration",
  "target_id": "slack-webhook-7",
  "metadata": { "fields_changed": ["webhook_url"] }
}
```

## Test coverage (Task 71)

**Gap found:** integration changes were not audited anywhere in this tree.

**Test added:** `tests/test18_audit_log_policy.js` asserts `integration.update` is a required
action and that records **without** `correlation_id` fail validation.

When login/admin routes exist in the backend repo, add **integration tests** that perform each
sensitive action and assert a row appears in `GET /audit-logs` filtered by the request’s
correlation id.

## Related docs

- List pagination for audit log collections: [`docs/api/pagination-contract.md`](../api/pagination-contract.md)
- Checklist mapping (backend-specific rows): [`checklist-mapping.md`](checklist-mapping.md)
