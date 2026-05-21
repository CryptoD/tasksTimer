# ADR 0002: No per-account login lockout — rate limit only (Task 69)

- **Status:** Accepted  
- **Date:** 2026-05-21  

## Context

Security checklists often require **account lockout** after *N* failed logins (per username) in addition to **rate limiting** (per IP or global). taskTimer today is a **GJS/GTK desktop app** with **no HTTP login API** and no server-side credential store. The Playwright browser shell mocks `POST /login` for harness tests only.

If this repository later adds an API with password or token login, we must choose explicitly:

| Approach | Stops | Trade-off |
|----------|--------|-----------|
| **Account lockout** | Repeated guesses on one account | **Account DoS** — attacker can lock out a victim with failed attempts |
| **Rate limit only** | High-volume attempts from one client/path | Distributed guessing across IPs still possible without extra controls |

## Decision

**Do not implement per-account login lockout** in this project’s reference auth model. Use **rate limiting only** on authentication endpoints when an HTTP API exists.

**Today:** lockout and login rate limits are **N/A** (no login route). No lockout tests are required.

**When `POST /login` (or equivalent) is added**, implement:

1. **Rate limits** — e.g. sliding window per **client IP** and per **username** (separate buckets), returning **429** with `error_code: RATE_LIMITED` (see [`docs/api/errors.md`](../../api/errors.md) and [`src/api/api_error_messages.js`](../../../src/api/api_error_messages.js)).
2. **No lockout flag** on the user record and **no** “account locked until …” response for failed passwords.
3. **Uniform failed-login response** — same status/body for bad password vs unknown user (no account enumeration).
4. **Logging/metrics** — count failed attempts per IP/username for operator alerts; optional CAPTCHA or MFA as a later ADR.

Reference constants (not wired to a server yet): [`tooling/auth_abuse_policy.mjs`](../../../tooling/auth_abuse_policy.mjs).

## Abuse model (accepted risk)

Operators and security reviewers should understand what **rate limit only** does and does not cover.

**Mitigates reasonably well:**

- **Online password guessing** from a single host or small IP range (throttled by per-IP limit).
- **Noisy spray** on one username from one source (throttled by per-username limit).
- **Account lockout DoS** (deliberately avoided — legitimate users are not frozen out by third-party failures).

**Does not fully mitigate (residual risk — accepted for intended deployments):**

- **Distributed credential stuffing** (many IPs, few tries each) — address with WAF/CDN rules, breach-password deny lists, MFA, and monitoring—not lockout.
- **Targeted offline attack** on stolen DB hashes — out of scope for rate limits; use slow password hashes (Argon2/bcrypt), unique salts, and breach detection.
- **Stolen refresh tokens / session cookies** — session rotation and short TTLs (see CORS/cookie docs in [deployment.md](../deployment.md)), not login lockout.

**Intended deployments:** small teams, internal tools, or single-tenant installs ([production config](../development.md#production-config-validation--task-64), [file upload threat model](../file-upload-threat-model.md)). For **public multi-tenant** SaaS with high abuse exposure, reassess this ADR (add MFA, CAPTCHA, or lockout with careful unlock workflow).

**Operator accepted-risk statement (copy to runbook):**

> We use **rate limiting only** on login; we **do not** lock accounts after failed attempts. We accept residual risk of distributed guessing against weak passwords, and we mitigate with network-level controls, credential hygiene, monitoring, and optional MFA. We reject account lockout to avoid **account denial-of-service** via intentional failed logins.

## Consequences

- Checklist item “lockout after N failures” is **explicitly declined** unless a future ADR supersedes this one.
- Implementers add **rate-limit middleware/tests** when login exists; **do not** add lockout integration tests unless policy changes.
- [`docs/dev/architecture.md`](../architecture.md) and [deployment.md](../deployment.md) link here for discoverability.

## Supersedes

Nothing. If lockout is required later, add **ADR 0003** (or amend this document) with unlock/support flow and tests.
