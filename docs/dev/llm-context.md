# Notes for AI / LLM assistants

Use this when generating or editing content for **taskTimer** so answers match **this** tree (GJS + GTK desktop app), not a generic Go or React monorepo.

## Paths that do **not** exist here

The following are **not** in the repository (do not invent or “read” them as if present):

| Assumed path | Reality |
|--------------|---------|
| **`internal/server/router.go`** | **Absent** — no Go HTTP router. |
| **`internal/service/`** (or similar Go service package) | **Absent** — no Go service layer. |
| **`internal/db/`**, `db.go`, SQL migrations, **`db.InitDB`** | **Absent** — persistence is **JSON** (standalone) and **GSettings** (extension). |
| **`server.SetupRouter`**, shared **typed constructor** for `main` + tests | **Absent** — no HTTP router setup; tests are GJS scripts, not a Go test harness reusing `NewApp(...)`. |

There is **no** `main.go` with HTTP route registration, **no** explicit **server or router constructor** (`NewServer`, mux, etc.), and **no** single place that wires **HTTP stack dependencies** (`NewHTTPServer`, DB + router + middleware). Checklist patterns about **composition roots for an HTTP server** do not apply; runtime deps are **OS packages** (see [BUILD.md](../../BUILD.md)), not an in-process HTTP stack.

## Canonical sources

- **[architecture.md](architecture.md)** — layout, Mermaid diagrams, N/A checklist table.
- **[deployment.md](deployment.md)** — AppImage, Docker shell, CI overview.
- **[BUILD.md](../../BUILD.md)** — `make` targets and tests.

## Refactoring & helpers

When splitting complex functions, **prefer helpers in the same place first**, then widen only if reuse or clarity demands it:

1. **Same file** — private functions at module top level (e.g. `function prefsAddChild(...)` next to the class in `prefs.js`), or **methods on the same class** (`_foo` helpers on `PreferencesBuilder`).
2. **Same “package”** — the same import root: e.g. only **`taskTimer@CryptoD/`** modules, or only **`platform/standalone/`**, before introducing new cross-tree coupling.
3. **New files** — add only when a helper is **shared** by multiple modules or the original file would become hard to navigate.

This matches how the codebase already groups **extension** code under **`taskTimer@CryptoD/`** and **standalone GTK** under **`platform/standalone/`**.

## Wording

- **Do not** reuse vague checklist lines like **“handlers in main”** (HTTP handlers wired in `main.go`).  
- **Do** refer to **`main.js`** as the **GJS** standalone entry (`Gtk.Application`, CLI flags), and **`taskTimer@CryptoD/extension.js`** for the GNOME Shell extension.

## Do **not** apply Go “`main` + `SetupRouter`” refactors

Checklist advice such as **“minimize diff in `main.go`”** or **“keep `SetupRouter` testable”** targets a **Go HTTP** codebase. **This repo has no `main.go` and no `SetupRouter`.**

- **Do not** suggest splitting or slimming **`main.go`**, extracting **`SetupRouter`** for tests, or injecting a router for unit tests—those files and APIs **do not exist**.
- **Do** treat **[`main.js`](../../main.js)** as the real entry; prefer **small, local changes** that match existing GJS style. For testability, use **`tests/test*.js`** and shared modules under **`taskTimer@CryptoD/`**, not HTTP router extraction.
- **Do not** add **new globals** (`globalThis.foo`, stray `var` at top level) for features; keep **module scope** and **`imports`**. Keep **`main.js`** to **wiring + `Gtk.Application.run()`**—see **“Done when (thin `main` + no stray globals — GJS analogue)”** in [architecture.md](architecture.md).
