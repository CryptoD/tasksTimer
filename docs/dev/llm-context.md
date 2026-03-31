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

## Wording

- **Do not** reuse vague checklist lines like **“handlers in main”** (HTTP handlers wired in `main.go`).  
- **Do** refer to **`main.js`** as the **GJS** standalone entry (`Gtk.Application`, CLI flags), and **`taskTimer@CryptoD/extension.js`** for the GNOME Shell extension.
