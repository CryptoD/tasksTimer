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

- **Lint**: `make lint`
- **Tests**: `make test`
- **Race tests (Go only)**: `make test-race`
- **Browser E2E shell**: `make e2e`
- **Build (Go only)**: `make build`

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

