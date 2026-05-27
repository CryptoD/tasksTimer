# Security self-assessment checklist (Task 72)

Structured review worksheet for taskTimer. **Public summary:** [`docs/plan/security-review-summary.md`](../plan/security-review-summary.md).

**Review date:** 2026-05-27  
**Method:** Maintainer self-assessment (no external pen test for desktop-only scope)  
**Re-run trigger:** annually, before major release, or when adding HTTP/API surfaces

---

## How to use

1. Walk each row; mark **Pass**, **Fail**, or **N/A**.
2. Assign **Severity** if Fail (Critical / High / Medium / Low).
3. Set **Remediation status**: Remediated | Accepted | Open | Deferred.
4. Link evidence (doc, test, CI job, ADR).
5. Update the public summary counts when status changes.

---

## Domain A — Vulnerability disclosure & response

| ID | Control | Pass/Fail | Severity | Status | Evidence / remediation |
|----|---------|-----------|----------|--------|----------------------|
| SEC-04 | Coordinated disclosure contact published | Pass | — | Remediated | [`.well-known/security.txt`](../../.well-known/security.txt); [deployment.md](deployment.md) Task 70 |
| SEC-04b | Private advisory channel documented | Pass | — | Remediated | GitHub Security Advisories URL in `security.txt`; [CONTRIBUTING.md](../../CONTRIBUTING.md) |
| SEC-04c | `Expires` in security.txt renewed yearly | Pass | — | Open | Renew by **2027-05-21** (tracked SEC-24 in summary) |

---

## Domain B — Supply chain & releases

| ID | Control | Pass/Fail | Severity | Status | Evidence / remediation |
|----|---------|-----------|----------|--------|----------------------|
| SEC-01 | No high-risk secret patterns in git | Pass | — | Remediated | `bin/check-secrets.sh`; CI job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |
| SEC-02 | Release checksums published | Pass | — | Remediated | `SHA256SUMS` in release workflow; [deployment.md](deployment.md) Task 65 |
| SEC-03 | SBOM attached to releases | Pass | — | Remediated | `npm run sbom`; CycloneDX + SPDX in release assets |
| SEC-03b | Dependabot enabled | Pass | — | Remediated | [`.github/dependabot.yml`](../../.github/dependabot.yml) |

---

## Domain C — Shipped desktop application

| ID | Control | Pass/Fail | Severity | Status | Evidence / remediation |
|----|---------|-----------|----------|--------|----------------------|
| SEC-10 | Local data scope documented (XDG paths) | Pass | — | Accepted | [README.md](../../README.md); trusted-user model in [file-upload-threat-model.md](file-upload-threat-model.md) |
| SEC-10b | Atomic JSON save on failure | Pass | — | Remediated | `tests/test15_atomic_json_save.js` |
| SEC-10c | No network listener in GTK app | Pass | — | Accepted | [architecture.md](architecture.md) |
| SEC-13 | Production secrets validated when env=production | Pass | — | Remediated | `src/config/production_config.js`; `tests/test17_production_config.js` |
| SEC-14 | API errors not leaked to users (future UI) | Pass | — | Remediated | `src/api/api_error_messages.js`; `tests/test16_api_error_messages.js` |

---

## Domain D — Future HTTP API (reference policies)

| ID | Control | Pass/Fail | Severity | Status | Evidence / remediation |
|----|---------|-----------|----------|--------|----------------------|
| SEC-11 | CSP / security headers policy defined | N/A | — | Accepted | [tooling/security_headers_middleware.mjs](../../tooling/security_headers_middleware.mjs); Task 66 |
| SEC-11b | CORS + cookie flags policy defined | N/A | — | Accepted | [tooling/cors_cookie_policy.mjs](../../tooling/cors_cookie_policy.mjs); Task 67 |
| SEC-12 | File upload threat model + operator stance | N/A | — | Accepted | [file-upload-threat-model.md](file-upload-threat-model.md); Task 68 |
| SEC-22 | Login abuse policy (rate limit, no lockout) | N/A | High | Open | [ADR 0002](adr/0002-account-lockout-rate-limit-only.md); implement when login exists |
| SEC-21 | Audit log for admin/integration actions | N/A | High | Open | [audit-log-review.md](audit-log-review.md); `tests/test18_audit_log_policy.js` |

---

## Domain E — CI & quality gates

| ID | Control | Pass/Fail | Severity | Status | Evidence / remediation |
|----|---------|-----------|----------|--------|----------------------|
| SEC-05 | Lint + unit tests on every PR | Pass | — | Remediated | `make lint`, `make test`; CI workflow |
| SEC-05b | E2E smoke (browser shell) | Pass | — | Remediated | `npm run test:e2e` |
| SEC-06 | Shellcheck on shell scripts | Pass | — | Remediated | `make lint` |

---

## Domain F — External assessment

| ID | Control | Pass/Fail | Severity | Status | Evidence / remediation |
|----|---------|-----------|----------|--------|----------------------|
| SEC-20 | Third-party penetration test | Fail | High | Deferred | Not applicable to desktop-only; schedule before public API GA |
| SEC-23 | security.txt reachable on production URL | Fail | Medium | Open | Serve via nginx/Caddy when public site exists; [deployment.md](deployment.md) |
| SEC-24 | Annual security review | Pass | Low | Deferred | Next run **2027-05**; update [security-review-summary.md](../plan/security-review-summary.md) |

---

## Remediation log (changelog)

| Date | ID | Change |
|------|-----|--------|
| 2026-05-27 | SEC-01–SEC-06, SEC-10–SEC-14 | Initial self-assessment; existing controls marked Remediated |
| 2026-05-27 | SEC-11, SEC-12 | Marked Accepted (reference policies; no HTTP API) |
| 2026-05-27 | SEC-20, SEC-21, SEC-22, SEC-23 | Open/Deferred items tracked in public summary |

---

## When adding an HTTP API

Before production launch, re-run this checklist and:

1. Change SEC-11, SEC-11b, SEC-12, SEC-21, SEC-22 from N/A to **must Pass**.
2. Commission **SEC-20** (external pen test) or document why waiving is acceptable.
3. Confirm **SEC-23** (`security.txt` live on canonical HTTPS origin).
4. Update [`docs/plan/security-review-summary.md`](../plan/security-review-summary.md) finding counts.
