# Development

This document is a small grab bag of development conventions that do not fit cleanly in the other `docs/dev/` pages.

For repo structure and how to run lint/tests, see:

- [architecture.md](architecture.md)
- [deployment.md](deployment.md)

## Data access (no `db.go` here) — Task 60

Some backend-oriented guides say “prefer db methods in `db.go` only” and route all reads/writes through a SQL repository layer.

**In this repository:** there is **no** SQL database and **no** `db.go`. Persistence is:

- **Standalone:** JSON under XDG (`~/.config/tasktimer/`, `~/.local/share/tasktimer/`) via shared storage/settings modules (see `taskTimer@CryptoD/storage.js`, `config.js`, and platform settings wrappers).
- **Extension:** **GSettings** via the schema under `taskTimer@CryptoD/schemas/`.

If you’re following a checklist that references `db.go` / repositories, treat it as **another repo** / **N/A** for taskTimer (see [architecture.md](architecture.md) and [llm-context.md](llm-context.md)).

## CI/CD: canonical workflow and policy

**Canonical PR workflow:** `.github/workflows/ci.yml`

Policy:

- **`ci.yml`** is the **single primary** workflow for PR validation (lint + GJS tests; plus optional Go quality reporting when `go.mod` exists).
- Playwright **browser shell** (`npm run test:e2e`) runs as part of **`ci.yml`** so it is a **required** PR check on `main`. (This is not the GTK UI; it’s a checklist-ready browser harness under `e2e/`.)
- Optional “real backend” browser-shell runs are handled by `.github/workflows/e2e-real-backend.yml` (nightly + manual) and are **not required** on every PR.
- **`release.yml`** runs on **version tags only**.

### CI job order (fail fast)

`ci.yml` is ordered to fail fast: lightweight checks (ESLint and Go linters like `go vet` / `staticcheck` / `golangci-lint` when applicable) run **before** installing heavier GTK/Xvfb deps and running the longer GJS test suite.

## Standard developer commands (use `make` first)

- **Prereq (tooling only)**: Node.js **22 LTS** (matches `package.json#engines` and CI `setup-node`)
- **Lint**: `make lint`
- **Tests**: `make test`
- **Race tests (Go only)**: `make test-race`
- **Browser E2E shell**: `make e2e`
- **Build (Go only)**: `make build`
- **Webpack bundle budget (tooling)** — **`make bundle-budget`** (`npm run build:bundle-budget`): production bundle + performance budget enforced (see section below).

## Frontend test pyramid (tooling-only browser shell) — Task 59

taskTimer is a **GJS/GTK** app, not a web frontend. The only “frontend-style” tests here are the **browser shell** under `e2e/` (Playwright + MSW) used as a checklist-ready harness.

### What runs on PRs (required)

These run on every PR via the canonical workflow (`.github/workflows/ci.yml`):

- **ESLint**: `npm run lint`
- **Webpack budget (tooling)**: `npm run build:bundle-budget`
- **Playwright browser shell (mocked)**: `npm run test:e2e` (MSW on)
- **GJS lint**: `make lint`
- **GJS tests**: `make test`

### What runs nightly/manual (optional)

- **Playwright “real backend”**: `.github/workflows/e2e-real-backend.yml`
  - Runs with `REACT_APP_USE_MOCKS=false`
  - Optional input `base_url` passed as `E2E_BASE_URL`
  - Not required on every PR (can be slow/flaky depending on external services)

### Contributor commands

From repo root:

```bash
npm ci
npm run lint
npm run build:bundle-budget
npm run test:e2e
make lint
make test
```

To run the optional “real backend” smoke locally (only if you have a reachable service that exposes `/ping`):

```bash
REACT_APP_USE_MOCKS=false E2E_BASE_URL="https://example.com" npm run test:e2e
```

## Webpack bundle budget

The shipped taskTimer UX is **GJS/GTK**, not an in-browser SPA. This repo nevertheless keeps a **small webpack tooling build** (`webpack.config.cjs`, entry `tooling/webpack-budget-entry.jsx`) so we can enforce a **maximum initial / main chunk size** with `performance.hints: 'error'` (`npm run build:bundle-budget` / **`make bundle-budget`**).

### Current numbers

As of this writing:

| Output | Typical size |
|--------|----------------|
| **`dist/webpack-budget/main.js`** | **≈ 2.4 KiB** uncompressed (~**2446 B**; webpack `--mode production`, tree‑shaken React subset) |

**CI limit (both entrypoint and single asset):** **16 KiB** uncompressed each (`webpack.config.cjs`). The build **fails** if the emitted `main.js` or its entrypoint total exceeds **16 384 B**.

Webpack reports sizes as **transfer-style uncompressed** totals for budget checks—not gzip BROTLI—but that matches webpack’s documented `performance` behavior.

### How to relax the budget

1. Bump **`BUDGET_MAX_ENTRYPOINT_BYTES`** / **`BUDGET_MAX_ASSET_BYTES`** in **`webpack.config.cjs`** together (usually set them equal unless you intentionally split assets/chunks later).
2. Update the **Current numbers / CI limit** table in this doc if the negotiated limit changes.
3. Prefer a short note and **ticket ID** (`#NNN`, `KT-…`) on the committing PR explaining why growth is warranted (heavy dependencies, deliberate split-bundle change, …).

Lowering the budgets is acceptable if tooling output shrinks—as long as `npm ci` CI keeps passing.

## Go quality gates (only when `go.mod` exists)

CI runs Go quality checks only when the repository contains a Go module (`go.mod`).

- **Toolchain**: Go **1.22** (keep consistent across `go.mod`, CI, and any container tooling if Go is introduced)
- **`go vet`**: `go vet ./...` (fails CI on findings)
- **`staticcheck`**: installed with a **pinned** version and run as `staticcheck ./...`
- **`golangci-lint`**: runs with repo config (`.golangci.yml`) and blocks merges on failures
- **Race detector**: `make test-race` (runs `go test -race`; see exclusions below)

### Install locally

```bash
go install honnef.co/go/tools/cmd/staticcheck@2026.1
```

### `nolint` policy

Any `//nolint` directive must include a **ticket reference only**, for example `#1234` or `KT-42`.
CI enforces this via the `nolintlint` linter configured in `.golangci.yml`.

### Race detector scope / exclusions

The default is all packages (`./...`). If we ever need to exclude packages from race runs, they must be listed via `RACE_EXCLUDE` and justified (no silent skips).

## Coverage exclusions (documented)

**Done when:** This section matches the repository’s **`go tool cover` configuration**.

### Status in this repository

This repository currently contains **no Go code** (`*.go`, `go.mod`, or any `go tool cover` / `-coverprofile` usage). As a result, there is **no `go tool cover` configuration to match**, and there are **no Go coverage exclusions** to document.

### Current exclusions

**None.**

No `go tool cover`-driven exclusions exist because `go test -coverprofile` is not used here.

### Policy (if Go coverage is added later)

If Go code and coverage reporting are added later, document any exclusions exactly as expressed by the `go test` / `go tool cover` workflow used in the repo (typically via `go test -coverprofile=...` plus any package selection through `-coverpkg=...`, and/or any post-processing of the generated coverprofile), and list each exclusion here with:

- **Mechanism**: the exact flag/pattern/script step (e.g. `-coverpkg=...` selection or coverprofile filtering rule)
- **Scope**: which packages/files are excluded
- **Reason**: why excluding is correct (e.g. platform-specific code paths, hard-to-stimulate error branch, defensive crash guard)
- **Owner / follow-up** (optional): when/what would allow removing the exclusion

## Frontend testing (Jest coverage) — Task 51

Some checklists require Jest coverage thresholds (lines/branches) in CI, failing on coverage drops.

**Status in this repository:** **N/A today.** This repo is a **GJS/GTK desktop app** and does not contain a Jest-driven web frontend (`jest.config.*`, `__tests__/`, React app, etc.). `npm` tooling is used for **ESLint**, Playwright browser-shell E2E, and other contributor tooling—not for a shipped SPA test suite.

**Current CI quality gates (what actually fails builds):**

- `npm run lint` (ESLint for repo JS)
- `make lint` (gettext + shellcheck)
- `make test` (GJS tests under `tests/`)

**Policy (if Jest is introduced later):** Add `jest.config.*` with `collectCoverage: true` under `CI=true` and set **low initial** `coverageThreshold` for `branches`/`lines`, then raise over time. Coverage drops must fail CI.

### Frontend testing (`useApi` refresh behavior) — Task 52

Some checklists require MSW + Jest unit tests ensuring an HTTP client (`useApi`) performs **only one** token refresh on `401` and does **not** loop indefinitely on repeated `401`s (often with `localStorage` token mocks).

**Status in this repository:** **N/A today.** There is **no** `useApi` hook, no shipped HTTP client, and no browser `localStorage` runtime in the GTK/Shell app. The only MSW usage here is the Playwright **browser shell** harness in `e2e/` (proves MSW intercepts `fetch()` in CI), not a React client test suite.

**Policy (if an HTTP client is introduced later):**

- Implement the mapping/behavior in a single client module (avoid retry loops).
- Add **unit tests** that simulate:
  - `401` → **one** refresh attempt → retry original request once
  - refresh also `401` (or repeated `401`s) → **stop** and surface a user-facing auth error
- Run those tests in CI and treat regressions as failures (the “infinite loop” case must be caught).

### Task form tests (validation + API errors) — Task 53

Some checklists require component tests for a web “TaskForm” (create/edit) that assert:

- client-side validation errors render visibly
- server/API failures render **mapped** user-visible messages (Task 45) instead of raw payload
- tests are stable (no timer flakes)

**Status in this repository:** **N/A today.** There is no React “TaskForm” component tree, no tasks/projects HTTP API, and no component test runner (Jest/RTL/Cypress component tests). The product UI is GTK (standalone) and GNOME Shell menus, backed by local settings/timers.

**If a future API-backed form UI is added:** use `src/api/api_error_messages.js` (`formatApiErrorForUser`) for all toast/inline error rendering, and add deterministic unit/component tests that assert mapped gettext strings (and never `details`) are shown.

### Context tests (Auth + Theme) — Task 54

Some checklists require unit/component tests for a React app’s `AuthContext` and `ThemeContext` (e.g. login/logout clears auth state; theme choice persists).

**Status in this repository:** **N/A today.** There is no React context layer (`AuthContext`, `ThemeContext`, `DataManager` render-prop tests, etc.). The shipped UI is GTK/Shell, and settings persistence is implemented via:

- Standalone: JSON config under `~/.config/tasktimer/` (theme + display prefs)
- Extension: GSettings schema under `taskTimer@CryptoD/schemas/`

**What we test instead:** behavior is covered by **GJS tests** (`make test`) and manual UX scenarios (not React contexts). If a future web UI introduces contexts, add dedicated tests for auth state transitions and theme persistence and wire them into CI.

### Kanban failure path test (DnD rollback / toast) — Task 55

Some checklists require a Kanban board with drag-and-drop (DnD) status updates where API failures either roll UI state back or show a toast, with automated test coverage.

**Status in this repository:** **N/A today.** There is **no Kanban board** UI and no task status API. The README does not promise Kanban features; the product surfaces are countdown timer lists (GTK + Shell).

**If Kanban is introduced later:** ensure all optimistic updates have a failure strategy (rollback or mapped toast using Task 45’s `formatApiErrorForUser`), and add deterministic tests for the failure path.

## Visual regression policy — Task 58

**Decision:** **None** (no Percy, no Chromatic) for this repository today.

Rationale:

- The shipped UX is **GTK (standalone)** and **GNOME Shell** (extension), not a web UI rendered in a browser/Storybook.
- Percy/Chromatic-style snapshot tooling is optimized for DOM/CSS component libraries; it would not reflect the real GTK/Shell surfaces without a separate screenshot harness and stable headless desktop environment.

What we do instead:

- **Manual screenshots** for docs live under `doc/screenshots/` (update only when a UI change is intentional and the screenshot would otherwise mislead users).
- **Playwright browser shell** (`npm run test:e2e`) produces an HTML report in CI; it is uploaded as an artifact on failures. This is a **tooling harness**, not the GTK UI.

When snapshots update (team policy):

- **Do not** update screenshots in drive-by refactors. Update them in the same PR only when user-facing visuals changed intentionally.
- If/when a real visual regression tool is introduced later, document:
  - who can approve snapshot updates,
  - how to review diffs,
  - and when baseline updates are allowed (e.g. release branches only).

## Security and supply chain

### Dependency updates (Dependabot) — Task 61

**Tool:** [Dependabot](https://docs.github.com/en/code-security/dependabot) (native GitHub; config in **`.github/dependabot.yml`**).

**Enabled on:** default branch **`main`** (Dependabot reads the config from the default branch).

**Ecosystems:**

| Ecosystem | Directory | When it runs |
|-----------|-----------|--------------|
| **npm** | `/` (`package.json`, `package-lock.json`) | Always (dev tooling only; no npm runtime deps for the GTK app) |
| **gomod** | `/` (`go.mod`) | Once a Go module is added at the repo root |

**Grouping strategy (npm):** one PR per group when multiple packages in the group have updates in the same week:

| Group | Packages (patterns) | Rationale |
|-------|---------------------|-----------|
| `playwright-msw` | `playwright`, `@playwright/*`, `msw`, `@msw/*` | Browser E2E shell + MSW move together |
| `eslint-typescript` | `eslint*`, `@typescript-eslint/*`, `typescript` | Lint/typecheck toolchain |
| `webpack-babel` | `webpack*`, `babel-loader`, `@babel/*` | Webpack budget tooling build |
| `react-eslint-plugins` | `react`, `eslint-plugin-react*`, `eslint-plugin-jsx-a11y` | JSX lint fixture + React plugins |

Ungrouped npm updates (if any) still get individual PRs.

**Grouping strategy (Go):** when `go.mod` exists, **minor + patch** updates are grouped into `go-minor-patch`; **major** updates stay separate PRs for explicit review.

**Contributor workflow:**

1. Dependabot opens PRs against `main`.
2. CI (`ci.yml`) must pass before merge.
3. For grouped PRs, review the combined changelog; run locally: `npm ci`, `npm run lint`, `npm run test:e2e`, `make lint`, `make test` (and Go checks if applicable).

**Schedule:** weekly (Mondays). Adjust in `.github/dependabot.yml` if noise is too high.

**Renovate:** not used; Dependabot is sufficient for this GitHub-hosted repo. Switching tools would require a deliberate migration (config + disable Dependabot).

