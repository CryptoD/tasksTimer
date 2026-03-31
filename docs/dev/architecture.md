# Architecture (taskTimer)

This document describes **this repository** as it exists today: a **GJS + GTK** desktop timer with an optional **GNOME Shell extension**. It replaces any placeholder or outdated text that assumed a **Go HTTP server** (`main.go`, `router.go`, `db.go`), `handlers_test.go`, or a **React `frontend/`** tree—**those are not part of taskTimer**.

For packaging and CI, see [deployment.md](deployment.md) and [BUILD.md](../../BUILD.md). For how a **former long checklist** (many numbered items) maps to this repo, see [checklist-mapping.md](checklist-mapping.md).

---

## Entry points

| Surface | Entry | Role |
|-----------|--------|------|
| **Standalone app** | [`main.js`](../../main.js) (repo root) | `Gtk.Application`, loads GTK UI under `platform/standalone/`, shared timer logic under `taskTimer@CryptoD/`. |
| **GNOME Shell extension** | [`taskTimer@CryptoD/extension.js`](../../taskTimer@CryptoD/extension.js) | Panel indicator, Shell UI, GSettings; same shared modules for timers. |

There is **no** server `main.go` and **no** central HTTP router: the app runs in-process on the user’s desktop.

---

## Code layout (high level)

```
main.js                    # Standalone GTK entry (CLI flags, window)
config.js, context.js, i18n.js, app_version.js
platform/
  interface.js             # Abstract interfaces
  standalone/              # GTK windows, tray, notifications, prefs
taskTimer@CryptoD/         # Core timer logic + extension UI (indicator, menus, …)
tests/test*.js             # GJS unit/smoke tests (see make test)
```

**Shared timer and storage logic** lives primarily under `taskTimer@CryptoD/` (e.g. `timers_core.js`, `settings.js`, `storage.js`) and is used by both the extension and `platform/standalone/`.

---

## Data and configuration

| Mode | Storage |
|------|---------|
| **Standalone** | JSON under `~/.config/tasktimer/` and `~/.local/share/tasktimer/` (see [README.md](../../README.md)). |
| **Extension** | GSettings + schema in `taskTimer@CryptoD/schemas/`; no SQLite `db.go` in this repo. |

---

## Testing (what exists here)

- **`make test`** — runs `tests/test*.js` with `gjs` ([BUILD.md](../../BUILD.md)).
- **`make lint`** — gettext + shellcheck (and shell scripts).
- **`npm run lint`** — ESLint on JavaScript sources (`package.json`).
- **`npm run test:e2e`** — Playwright + MSW **browser shell** only ([e2e/README.md](../../e2e/README.md)); it does **not** drive the GTK app.

There is **no** `handlers_test.go` or Go **password** / **forgot-reset** flow in this codebase.

---

## Checklist items from other stacks (not applicable)

Automation templates sometimes mention:

| Checklist idea | In **this** repo |
|----------------|------------------|
| Handlers in `main.go`, DB in `db.go` | **Does not apply** — no Go backend. |
| `rateLimitMiddleware` on `POST /login` | **Does not apply** — no HTTP login API. |
| `handlers_test.go` (password reset happy path, expired token, …) | **Does not apply** — no Go handlers; no HTTP password reset. |
| `NewServer` / constructor-style wiring for an HTTP server | **Does not apply** — no Go `Server` type; startup is `gjs main.js` / `extension.js` loading GTK/Shell modules. |
| `GET /users` admin list with `limit`/`offset` in `internal/server/users.go` | **Does not apply** — no HTTP API, no `users.go`, no admin user listing. |
| Cross-user **task** access tests vs comments/attachments (`main_test.go`) | **Does not apply** — no Go `main_test.go`, no multi-user task API; tests are GJS `tests/test*.js`. |
| `frontend/src/...`, React lazy routes, `DataManager.test.js` | **Does not apply** — no React SPA in this tree. |
| `frontend/jest.config.cjs` with `collectCoverage: false` / CI coverage thresholds | **Does not apply** — no Jest frontend; JS tooling is ESLint + GJS tests (`make test`). |
| Overlapping **`.github/workflows/ci.yml`** and **`tests.yml`** both running **Go** tests | **Does not apply** — no `tests.yml` for Go; [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs `make lint` / `make test` (GJS) + npm lint; **[`e2e.yml`](../../.github/workflows/e2e.yml)** is Playwright only. |
| **`golangci-lint`** / **`staticcheck`** in CI | **Does not apply** — no Go code; shell + gettext via `make lint`, ESLint via `npm run lint`. |

If you need a **web** or **API** service alongside taskTimer, treat it as a **separate** project; this repository stays focused on the desktop/extension experience.
