# Deployment

taskTimer is a **Linux desktop** application. There is **no separate HTTP API service** in this repository; distribution targets are the **standalone AppImage**, the **GNOME Shell extension** zip, and running **from source** with GJS.

For code layout and what is **not** in this repo (Go `main.go`, `handlers_test.go`, etc.), see **[architecture.md](architecture.md)**.

## End users

| Channel | Notes |
|--------|--------|
| **AppImage** | Built with `make appimage` or downloaded from **GitHub Releases**; see [BUILD.md](../../BUILD.md). |
| **GNOME extension** | `make pack` → install the `.zip` per [README.md](../../README.md) and [BUILD.md](../../BUILD.md). |
| **From source** | `gjs main.js` after installing GObject Introspection deps ([README.md](../../README.md)). |

Release automation (tags, changelog notes, pre-releases) is described in [CHANGELOG.md](../../CHANGELOG.md) and [.github/workflows/release.yml](../../.github/workflows/release.yml).

## Release workflow artifacts (tag push)

On a version tag push, **[.github/workflows/release.yml](../../.github/workflows/release.yml)** builds and publishes the following **GitHub Release** assets:

- **AppImage (Linux “binary”)**: `packaging/appimage/dist/*.AppImage`
- **Checksums**: `packaging/appimage/dist/SHA256SUMS` (SHA-256 of the AppImage and SBOM JSON files)
- **SBOM (npm dev tooling)**: `dist/sbom/tasktimer-cyclonedx.json` (CycloneDX), `dist/sbom/tasktimer-spdx.json` (SPDX)

### Frontend `dist/` and Go binaries (checklist note)

This repository currently has **no Go module** and **no frontend build output directory** (there is no `go build` binary and no `frontend/dist/`).

If a future version of this repo adds a Go CLI and/or a built web frontend, the release workflow should additionally attach:

- A **Linux binary** built by `go build`
- Any frontend **`dist/`** bundle(s)
- Corresponding **SHA256** sums for each artifact

### SBOM (Task 65)

SBOMs describe **npm dev tooling** only (`package-lock.json` — ESLint, Playwright, webpack budget, etc.). The shipped **GJS/GTK app** has no npm runtime dependencies. If a **`go.mod`** is added later, extend [`bin/generate-sbom.sh`](../../bin/generate-sbom.sh) (e.g. `go version -m` or Syft) and attach additional SBOM assets on release.

**Generate locally (same as release workflow):**

```bash
npm ci
npm run sbom
```

**Outputs:**

| File | Format |
|------|--------|
| `dist/sbom/tasktimer-cyclonedx.json` | CycloneDX (JSON) via `@cyclonedx/cyclonedx-npm` |
| `dist/sbom/tasktimer-spdx.json` | SPDX via `npx npm@10.9.2 sbom` (npm 10 `sbom` subcommand) |

**Release:** [`.github/workflows/release.yml`](../../.github/workflows/release.yml) runs `npm run sbom` before uploading GitHub Release assets (see **Release workflow artifacts** above).

## Docker (`Dockerfile.api`)

The multi-stage **[Dockerfile.api](../../Dockerfile.api)** is **not** a REST API container. It provides:

1. **`builder`** — installs GJS/GTK/GStreamer + `xvfb`/`dbus`, copies the tree, and runs a **smoke check** (`gjs` import probe + `gjs main.js --version` under `xvfb` + `dbus-run-session`). The full **`make test`** / **`make lint`** pipeline runs in [.github/workflows/ci.yml](../../.github/workflows/ci.yml); some tests assume a normal user home and can fail in arbitrary containers.
2. **`runtime`** — slimmer image with GJS + GTK + GStreamer typelibs and the checked-out tree; default **`CMD`** runs **`gjs main.js --version`** (no GUI; validates that the app loads far enough to print the version).

### Build

From the repository root:

```bash
docker build -f Dockerfile.api -t tasktimer:dev .
```

### Run (version smoke)

```bash
docker run --rm tasktimer:dev
```

### Interactive shell (optional)

```bash
docker run --rm -it --entrypoint bash tasktimer:dev
```

A full **windowed** app in Docker requires X11/Wayland forwarding and is out of scope here; use a normal desktop install or AppImage for UI testing.

## Relation to CI

[.github/workflows/ci.yml](../../.github/workflows/ci.yml) runs the same **`make lint`** / **`make test`** steps on GitHub-hosted runners. The Docker image is optional: use it when you want a **reproducible, local** environment close to CI without installing all packages on the host.

## CSP + security headers (Task 66)

**Status in this repository:** there is **no** HTTP server or `securityHeadersMiddleware` on the shipped GTK/Shell app. Policy lives in **[`tooling/security_headers_middleware.mjs`](../../tooling/security_headers_middleware.mjs)** as the **source of truth** for a future static UI or API gateway.

### What the middleware sets

| Header | Value (default options) |
|--------|-------------------------|
| `Content-Security-Policy` | `default-src 'self'`; `script-src 'self'` (bundled assets under same origin, e.g. `/static/main.js` or `dist/webpack-budget/main.js`); `connect-src 'self' http://localhost/mock` (MSW/E2E API today); `frame-ancestors 'none'`; `upgrade-insecure-requests` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |

**Tune CSP for production:** pass `apiOrigin: 'https://api.example.com'` (and optionally `staticOrigin: "'self'"`) when calling `securityHeaders()` / `securityHeadersMiddleware`. Keep **`script-src`** on `'self'` only if the SPA is built with hashed bundles (no inline scripts). Set `allowInlineStyles: false` when CSS is fully external.

**Node (reference):**

```javascript
import { createServer } from 'node:http';
import { securityHeadersMiddleware } from '../tooling/security_headers_middleware.mjs';

createServer((req, res) => {
    securityHeadersMiddleware(req, res, () => {
        // serve static files from dist/ or frontend/dist/
    }, { apiOrigin: 'https://api.example.com' });
}).listen(8080);
```

### nginx reverse proxy (must match middleware defaults)

Use the **same** CSP string as `buildContentSecurityPolicy()` with default options (verify after changing the `.mjs` file):

```nginx
# /etc/nginx/snippets/tasktimer-security-headers.conf
# Mirror tooling/security_headers_middleware.mjs (default apiOrigin + staticOrigin).

add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' http://localhost/mock; upgrade-insecure-requests" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Resource-Policy "same-origin" always;
```

```nginx
server {
    listen 443 ssl http2;
    server_name app.example.com;

    include snippets/tasktimer-security-headers.conf;

    root /var/www/tasktimer/frontend/dist;
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass https://api.example.com/;
        proxy_set_header Host $host;
        # Re-apply snippet on upstream responses if this vhost terminates TLS for the browser.
    }
}
```

For production, replace `http://localhost/mock` in `connect-src` with your real API origin (same value as `apiOrigin` in the middleware). Static assets must be served from the **same origin** as the HTML (`'self'`) or update `staticOrigin` / CSP accordingly.

## CORS + cookie flags (Task 67)

**Status:** **N/A** for the shipped GTK app (no session cookies over HTTP). Policy for a **production SPA** is defined in **[`tooling/cors_cookie_policy.mjs`](../../tooling/cors_cookie_policy.mjs)** and implemented in **[`packaging/caddy/Caddyfile`](../../packaging/caddy/Caddyfile)** / **[`Dockerfile.caddy`](../../Dockerfile.caddy)**.

### Recommended production model (same origin)

Serve the SPA and reverse-proxy **`/api/*`** on one HTTPS host (e.g. `https://app.example.com`). The browser sees a **single origin** — no CORS preflight for typical `fetch('/api/...')` calls.

| Concern | Policy |
|---------|--------|
| **Cookies** | `Set-Cookie: session=…; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax` (see `SESSION_COOKIE_SAME_ORIGIN` in `cors_cookie_policy.mjs`) |
| **SPA `fetch`** | Same-origin requests; use `credentials: 'include'` only if the API sets cookies on that host |
| **CORS** | Not required for browser calls to `/api` on the same host |
| **CSP `connect-src`** | `'self'` only (see `packaging/caddy/Caddyfile` — matches same-origin proxy) |

**Build/run reference proxy:**

```bash
docker build -f Dockerfile.caddy -t tasktimer:caddy .
docker run --rm -p 8080:8080 -e API_UPSTREAM=host.docker.internal:3000 tasktimer:caddy
```

Open `http://127.0.0.1:8080/` (placeholder static root under `packaging/caddy/www/`).

### Cross-origin API (separate subdomain)

If the SPA stays on `https://app.example.com` and the API on `https://api.example.com`:

| Concern | Policy |
|---------|--------|
| **CORS** | `Access-Control-Allow-Origin: https://app.example.com` (exact SPA origin, **not** `*`), `Access-Control-Allow-Credentials: true`, methods/headers per `corsHeadersForCredentialedSpa()` |
| **Cookies** | `SameSite=None; Secure; HttpOnly` on the **API** host (`SESSION_COOKIE_CROSS_ORIGIN`) |
| **SPA `fetch`** | `fetch('https://api.example.com/...', { credentials: 'include' })` |

### nginx (same-origin SPA + `/api` proxy)

Matches **`Dockerfile.caddy`** / `Caddyfile` behavior (security headers from Task 66; cookies set by upstream API):

```nginx
# Upstream API should send Set-Cookie consistent with SESSION_COOKIE_SAME_ORIGIN:
#   HttpOnly; Secure; SameSite=Lax; Path=/

server {
    listen 443 ssl http2;
    server_name app.example.com;

    include snippets/tasktimer-security-headers.conf;
    # Same-origin CSP: connect-src 'self' (see packaging/caddy/Caddyfile)
    add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; upgrade-insecure-requests" always;

    root /var/www/tasktimer/frontend/dist;
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass https://api-internal:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        # Pass Set-Cookie from API; do not strip Secure/HttpOnly/SameSite=Lax
        proxy_pass_header Set-Cookie;
    }
}
```

### nginx (cross-origin API — credentialed CORS)

On **`api.example.com`** (API vhost), mirror `corsHeadersForCredentialedSpa('https://app.example.com')`:

```nginx
# /etc/nginx/snippets/tasktimer-cors-credentialed.conf
set $cors_origin "https://app.example.com";

add_header Access-Control-Allow-Origin $cors_origin always;
add_header Access-Control-Allow-Credentials "true" always;
add_header Access-Control-Allow-Methods "GET, POST, PATCH, DELETE, OPTIONS" always;
add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
add_header Access-Control-Max-Age "86400" always;
add_header Vary "Origin" always;

if ($request_method = OPTIONS) {
    return 204;
}
```

Upstream login/session handlers should emit:

`Set-Cookie: session=…; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=None`

### Caddy (cross-origin API snippet)

When not using `Dockerfile.caddy` same-origin `handle /api/*`, configure the API site explicitly:

```caddyfile
api.example.com {
    @preflight method OPTIONS
    handle @preflight {
        header Access-Control-Allow-Origin "https://app.example.com"
        header Access-Control-Allow-Credentials "true"
        header Access-Control-Allow-Methods "GET, POST, PATCH, DELETE, OPTIONS"
        header Access-Control-Allow-Headers "Content-Type, Authorization"
        header Access-Control-Max-Age "86400"
        respond 204
    }
    reverse_proxy api:3000
    header Access-Control-Allow-Origin "https://app.example.com"
    header Access-Control-Allow-Credentials "true"
    header Vary "Origin"
}
```

Keep **`packaging/caddy/Caddyfile`** (same-origin reference) and this cross-origin block aligned with [`tooling/cors_cookie_policy.mjs`](../../tooling/cors_cookie_policy.mjs) when you change origins or cookie `SameSite` mode.

## File upload threat model (Task 68)

**Today:** the shipped product has **no end-user file upload API**. Local timer/settings data is **user-owned JSON on disk** (trusted workstation model).

**If you add HTTP uploads later**, read **[`docs/dev/file-upload-threat-model.md`](file-upload-threat-model.md)** and choose an explicit operator stance:

| Stance | When | Virus scanning |
|--------|------|----------------|
| **Trusted users** | Internal/single-tenant; authenticated operators | Not required; accept parser/abuse risk with size/type limits |
| **Untrusted users** | Public or multi-tenant | **Required** before files are served; quarantine until clean |

Each stance includes an **accepted risk** statement to copy into your runbook so operators know what is (and is not) covered.

## Server / Kubernetes

There is **nothing to deploy** as a scalable HTTP API today. When a web UI is added, terminate TLS at nginx or Caddy and apply the Task 66/67 snippets so proxy behavior **matches** [`tooling/security_headers_middleware.mjs`](../../tooling/security_headers_middleware.mjs), [`tooling/cors_cookie_policy.mjs`](../../tooling/cors_cookie_policy.mjs), and [`Dockerfile.caddy`](../../Dockerfile.caddy).
