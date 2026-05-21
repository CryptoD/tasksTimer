# File upload threat model (Task 68)

Operators and contributors need a clear **accepted risk** stance before enabling user-supplied files on a network-facing service. taskTimer today is a **local desktop** product; this document covers **what exists now** and **what to decide** if uploads are added later.

## Current product (shipped today)

| Surface | User-supplied files? | Stance |
|---------|----------------------|--------|
| **GTK / GNOME Shell app** | No HTTP upload API. Settings and timers persist as **local JSON** under the user’s XDG config (`~/.config/tasktimer/`, etc.). | **Trusted user / trusted workstation** — data is written only by the app running as the logged-in user. No virus scanning; same risk model as editing any file in `$HOME`. |
| **AppImage / extension install** | User chooses to download and run a **release artifact** from GitHub. | **Supply-chain trust** — verify checksums (`SHA256SUMS` on releases), install only from official releases. Not an “upload” path. |
| **CI / release automation** | Maintainers upload build artifacts to GitHub Releases. | **Maintainer trust** — not an end-user upload feature. |

**Operator summary (today):** there is **no end-user file upload** to scan or reject. Accepted risk is **local-user trust** for on-disk config and **release integrity** for distributed binaries.

## Future HTTP API or SPA (if introduced)

If the project adds endpoints such as `POST /attachments` or “import task pack” over the web, pick an explicit stance per deployment.

### Option A — Trusted users (default recommendation for small/internal deployments)

**Who:** known team, VPN, or single-tenant install where every account is operated by your organization.

**Controls (minimum):**

- Authenticated uploads only (session/JWT; see [production config](development.md#production-config-validation--task-64)).
- **Size cap** (e.g. 5–25 MiB per file, lower for avatars).
- **Allowlisted MIME/types** and extension checks (do not trust `Content-Type` alone).
- Store outside web root; serve via signed URLs or `Content-Disposition: attachment`.
- Optional: per-user quota and rate limits.

**Virus scanning:** **not required** by this repo’s reference policy.

**Accepted risk (operator must agree):**

> Malicious uploads could compromise **server-side parsers** (image/PDF/archive bugs) or **operators’ machines** when opened. We accept that risk because users are **trusted**, uploads are **authenticated**, and exposure is **limited to our tenant**. We rely on patching, least-privilege service accounts, and not executing uploaded content on the server.

### Option B — Untrusted or multi-tenant users

**Who:** public sign-ups, shared SaaS, or any user who is not fully trusted.

**Controls:** everything in Option A, plus:

- **Async virus/malware scanning** before marking a file “available” (e.g. ClamAV, cloud AV API, or object-store scanning on write).
- **Block until clean** — do not expose download URLs until scan passes; quarantine or delete on failure.
- Log scan results and alert on repeated failures per account.

**Accepted risk (operator must agree):**

> Scanning reduces but **does not eliminate** malware and novel payloads. We accept residual risk of **scanner bypass** and **false negatives**, and operational cost of **running and updating** AV definitions. We do **not** treat “no scanner” as acceptable for untrusted uploaders.

## Decision matrix (for operators)

| Deployment | Recommended stance | Virus scan |
|------------|-------------------|------------|
| Desktop-only (current) | N/A — no upload API | No |
| Internal API + known users | **Trusted users (A)** | Optional |
| Public or multi-tenant API | **Untrusted (B)** | **Required** |

## Implementation checklist (when uploads exist)

1. Document the chosen row in your runbook (copy the **Accepted risk** quote above into internal ops docs).
2. Wire scanning in the **async pipeline** (upload → object storage → scan → publish metadata).
3. Never run `exec` / `eval` on uploaded bytes; do not auto-extract archives on the server without isolation.
4. Link deployment hardening: [deployment.md](deployment.md) (TLS, CORS/cookies, CSP).

## Related docs

- [deployment.md](deployment.md) — how the app is distributed and proxied
- [development.md](development.md) — security tasks 63–67 (secrets, SBOM, headers, CORS)
