# Development

This document is a small grab bag of development conventions that do not fit cleanly in the other `docs/dev/` pages.

For repo structure and how to run lint/tests, see:

- [architecture.md](architecture.md)
- [deployment.md](deployment.md)

## CI/CD: canonical workflow and policy

**Canonical PR workflow:** `.github/workflows/ci.yml`

Policy:

- **`ci.yml`** is the **single primary** workflow for PR validation (lint + GJS tests; plus optional Go quality reporting when `go.mod` exists).
- **`e2e.yml`** is **not** part of the primary PR gate; it is **path-filtered** to run only when `e2e/**` or Node tooling inputs change.
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

