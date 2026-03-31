# Architecture (taskTimer)

This document is enough on its own to **build an accurate mental model** of the repository. You do **not** need a Go HTTP backend, **`internal/server/router.go`**, **`internal/service/`**, **`internal/db`**, SQLite, **`main.go`**, or a React **`frontend/`** tree—**none of those exist here**. If you assumed them from generic checklists, **ignore them** for this project.

---

## Done when (self-check)

After reading this file, you should be able to answer:

| Question | Short answer (spoilers—read below for detail) |
|----------|-----------------------------------------------|
| What runtime and UI stack? | **GJS** (JavaScript on SpiderMonkey) + **GTK 3** GObject Introspection; optional **GNOME Shell** extension UI (St/Clutter), not a web app. |
| How do you run two different UIs from one repo? | **Standalone:** `gjs main.js` → GTK under `platform/standalone/`. **Extension:** GNOME Shell loads `taskTimer@CryptoD/extension.js` → panel indicator + menus. |
| Where is “business logic” for timers? | Mostly **`taskTimer@CryptoD/`** (`timers_core.js`, `timer_services.js`, `alarm_timer.js`, …). |
| Where does data live? | **Standalone:** JSON files under XDG (`~/.config/tasktimer/`, `~/.local/share/tasktimer/`). **Extension:** **GSettings** + schema under `taskTimer@CryptoD/schemas/`. |

---

## Mental model in one minute

**taskTimer** is a **desktop** kitchen/task timer for Linux. All application code is **JavaScript** executed by **`gjs`**, using **GTK** for the standalone window and **GNOME Shell APIs** for the optional panel extension.

- **One shared core** (`taskTimer@CryptoD/`) implements timers, alarms, storage helpers, and settings abstractions.
- **Two UIs** sit on top: a **GTK** app (`platform/standalone/`) and/or a **Shell** extension UI (`indicator.js`, `menus.js`, `prefs.js`, …). Most users run **standalone**; the extension is for people who want a **panel** indicator on GNOME Shell only.
- **No server**: nothing listens on HTTP; there is no database server. **Persistence** is **files** (JSON) or **GSettings**, depending on the surface.
- **Tests** are **GJS scripts** in `tests/` plus **`make lint`** (gettext + shellcheck on shell scripts). **Node** (`npm run lint`, `npm run test:e2e`) is **tooling only**—ESLint and a Playwright+MSW **browser shell**, not the GTK app.

---

## Entry points (where execution starts)

| Surface | File | What happens |
|--------|------|----------------|
| **Standalone** | [`main.js`](../../main.js) at repo root | Parses CLI (`--help`, `--version`, `--minimized`, …), constructs `Gtk.Application`, loads windows and prefs from `platform/standalone/`, imports shared code from `taskTimer@CryptoD/`. |
| **GNOME Shell extension** | [`taskTimer@CryptoD/extension.js`](../../taskTimer@CryptoD/extension.js) | `enable()` / `disable()`; creates the panel indicator and wires Shell UI; uses the same shared timer modules. |

**Not** `main.go`, **not** HTTP route handlers, **not** a background job runner—just **desktop** processes.

---

## Dependency diagrams

External runbooks often assume **HTTP handlers → application services → DB**. **taskTimer** has **no** SQL database and **no** HTTP API. Persistence is **JSON** (standalone) and **GSettings** (extension).

### Reference stack (typical backend; **not** this repo)

```mermaid
flowchart LR
  H[Handlers / router] --> S[Application services]
  S --> R[Repositories]
  R --> D[(Database)]
```

### Actual stack (**taskTimer**)

```mermaid
flowchart TB
  subgraph entry[Entry]
    M[main.js]
    E[extension.js]
  end
  subgraph ui[UI]
    GTK[platform/standalone]
    SH[Shell UI: indicator, menus, prefs]
  end
  subgraph core[Core modules]
    TC[timers_core.js]
    TS[timer_services.js]
    AM[alarm_timer.js, storage.js, …]
  end
  subgraph store[Persistence]
    JSON[(JSON under XDG)]
    GS[GSettings + schema]
  end
  M --> GTK
  E --> SH
  GTK --> TC
  SH --> TC
  TC --> TS
  TS --> AM
  AM --> JSON
  SH --> GS
```

Standalone prefs and [`config.js`](../../config.js) read/write **JSON**; extension preferences use **GSettings** where the schema is installed.

---

## Repository layout (current)

| Path | What to know |
|------|----------------|
| **`main.js`**, **`config.js`**, **`context.js`**, **`i18n.js`**, **`app_version.js`** | Standalone bootstrap, XDG paths, gettext, version string. |
| **`platform/interface.js`** | Small “platform” abstractions (tray, notifications, shortcuts, config). |
| **`platform/standalone/`** | **GTK-only**: main window, preferences window, tray, notifications, shortcuts. |
| **`taskTimer@CryptoD/`** | **Shared** timer engine + **extension-only** Shell UI (`indicator.js`, `menus.js`, `prefs.js`, …), schemas, icons, PO files, `audio_manager.js`, etc. |
| **`tests/`** | GJS tests (`test*.js`); **`make test`** runs them all. |
| **`bin/`** | Scripts: `check-deps.sh`, `lint.sh`, packaging, `sync-version.py`. |
| **`packaging/appimage/`** | AppImage AppDir and build; copies/syncs app files for the image. |
| **`docs/dev/`** | Developer docs (this file, deployment, checklist mapping, [`llm-context.md`](llm-context.md)). |
| **`doc/`** | Design notes, screenshots, phase write-ups. |
| **`e2e/`** | Playwright + MSW **browser** smoke tests only—not GTK. |
| **`.github/workflows/`** | **`ci.yml`** — `make lint`, `make test`, `npm run lint`; **`e2e.yml`** — `npm run test:e2e`; **`release.yml`** — AppImage + GitHub Release on version tags. |

**Version:** [`version.json`](../../version.json) is the source of truth; `make sync-version` updates extension metadata and AppStream.

---

## Shared logic vs two surfaces

- **Timer logic** (running timers, alarms, parsing, storage helpers) lives under **`taskTimer@CryptoD/`**—used by **both** GTK and Shell.
- **GTK-specific** UI is under **`platform/standalone/`** only.
- **Shell-specific** UI is under **`taskTimer@CryptoD/`** (e.g. `indicator.js`, `menus.js`) and **`prefs.js`** for extension preferences.
- **Standalone** persists to **JSON** under `~/.config/tasktimer/` and `~/.local/share/tasktimer/` (see [README.md](../../README.md) for exact paths).
- **Extension** uses **GSettings** and **`taskTimer@CryptoD/schemas/`** when installed.

There is **no** shared SQL layer or `db.go`.

---

## Data and configuration

| Mode | Storage |
|------|---------|
| **Standalone** | JSON files under XDG (`~/.config/tasktimer/`, `~/.local/share/tasktimer/`). |
| **Extension** | GSettings + compiled schema in `taskTimer@CryptoD/schemas/`. |

---

## Testing and automation

| What | How |
|------|-----|
| GJS tests | `make test` → every `tests/test*.js` |
| gettext + shell scripts | `make lint` |
| JavaScript style | `npm run lint` (ESLint) |
| Browser-only shell | `npm run test:e2e` (Playwright + MSW in `e2e/`) |

There is **no** Go test suite (`handlers_test.go`, …).

---

## Checklist items from other stacks (not applicable)

Automation templates sometimes mention patterns that **do not apply** here:

| Checklist idea | In **this** repo |
|----------------|------------------|
| Handlers in `main.go`, DB in `db.go` | **N/A** — no Go backend. |
| `rateLimitMiddleware` on `POST /login` | **N/A** — no HTTP login API. |
| `handlers_test.go` (password reset, …) | **N/A** — no Go HTTP handlers. |
| `NewServer` / HTTP server wiring | **N/A** — `gjs main.js` / `extension.js` only. |
| `GET /users` in `internal/server/users.go` | **N/A** — no HTTP API. |
| Cross-user tasks in `main_test.go` | **N/A** — no multi-user Go API. |
| `frontend/src/...`, React tests | **N/A** — no React app. |
| `frontend/jest.config.cjs` / coverage gates | **N/A** — no Jest frontend. |
| Duplicate `ci.yml` + `tests.yml` for Go | **N/A** — workflows above are authoritative. |
| `golangci-lint` / `staticcheck` | **N/A** — no Go code. |
| **OpenAPI** in `docs/` | **N/A** — no HTTP API to document. |

---

## Further reading (optional)

Commands, dependencies, and release steps: **[BUILD.md](../../BUILD.md)**. Packaging and Docker: **[deployment.md](deployment.md)**. Long checklist mapping: **[checklist-mapping.md](checklist-mapping.md)**. AI/LLM path guardrails: **[llm-context.md](llm-context.md)**.
