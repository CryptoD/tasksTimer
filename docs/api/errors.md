# API errors (client-facing contract)

This repository is primarily a **GJS/GTK desktop app** without a bundled HTTP backend. Future or optional integrations (updates, telemetry, federation, etc.) should still follow a **predictable JSON error envelope** so the UI never surfaces raw backend payloads to end users.

The **canonical client implementation** mapping `error_code` + HTTP status to **gettext catalog strings** (English `msgid` keys) is:

- [`src/api/api_error_messages.js`](../../src/api/api_error_messages.js)

---

## Response envelope

Error responses SHOULD return JSON with at least:

| Field | Required | Audience | Purpose |
|--------|----------|-----------|---------|
| `error_code` | Recommended | Clients | Stable machine-readable code (`UPPER_SNAKE_CASE`). Prefer this for mapping user-facing text. |
| `message` | Optional | Logs / operators | Short diagnostic; clients MUST NOT prefer this string over mapped catalog text unless **dev/debug mode** is enabled. |
| `details` | Optional | Debugging | Arbitrary structured detail; NEVER shown to end users unless **dev/debug mode** is enabled. |

Non-JSON or empty bodies: clients SHOULD fall back to HTTP status semantics (below).

---

## Stable `error_code` values

These codes are wired in `gettextMsgIdForApiError()` (see [`api_error_messages.js`](../../src/api/api_error_messages.js)). Add new codes there and in POT/PO whenever the backend introduces them.

| `error_code` | Typical HTTP | User-facing gist (English `msgid`) |
|----------------|-------------|-------------------------------------|
| `UNAUTHORIZED` | 401 | Session invalid / sign in again |
| `FORBIDDEN` | 403 | Missing permission |
| `NOT_FOUND` | 404 | Resource missing |
| `CONFLICT` | 409 | Data conflict |
| `VALIDATION_ERROR` | 422 | Invalid input fields |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVICE_UNAVAILABLE` | 503 | Server / dependency down |
| `REQUEST_TIMEOUT` | 408 | Server gave up waiting |
| `NETWORK_ERROR` | *(none)* | Transport / unreachable (client-side convention) |

Unknown `error_code` → resolve by HTTP status bucket, then generic fallback.

---

## HTTP status → fallback when `error_code` is absent

For status codes without an explicit mapping, callers still get bucketed gettext strings (implementation groups 5xx, 408, etc.).

---

## Gettext catalog (i18n keys)

English source strings exposed to translators live in **`taskTimer@CryptoD/po/tasktimer.pot`** (see entries referenced from [`api_error_messages.js`](../../src/api/api_error_messages.js)).

Toast / inline surfaces MUST use:

```text
formatApiErrorForUser(httpStatus, parsedBodyJson, { gettext: _ })
```

…not concatenation with `details` / `message` from the payload.

---

## Dev / debug-only raw details

End users MUST NOT see `details` or ad-hoc `message` fragments **except** in development-style diagnostics:

- **`TASKTIMER_API_DEV_ERRORS=1`** in the process environment exposes a suffix with HTTP status plus serialized `details` / `message` (see `formatApiErrorForUser`).

This must never be enabled in production packaging.

---

## Versioning

When the API adds new `error_code` values, update in lockstep:

1. This document (table).
2. `src/api/api_error_messages.js`.
3. `taskTimer@CryptoD/po/tasktimer.pot` (+ `fr.po` or translators follow).
