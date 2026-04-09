# Development

This document is a small grab bag of development conventions that do not fit cleanly in the other `docs/dev/` pages.

For repo structure and how to run lint/tests, see:

- [architecture.md](architecture.md)
- [deployment.md](deployment.md)

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

