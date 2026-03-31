# Go complexity baseline (gocyclo / staticcheck)

This repository is **GJS/JavaScript** (GTK). There is **no first-party Go** and **no `go.mod`**. This document records how to measure cyclomatic complexity and static analysis when Go code exists, and the **last measured results** for this tree.

## Tools

| Tool | Role |
|------|------|
| **[gocyclo](https://github.com/fzipp/gocyclo)** | Cyclomatic complexity per function (primary “complexity baseline”). |
| **[staticcheck](https://staticcheck.io/)** | Static analysis for Go modules (bugs, style, simplifications). It does **not** replace gocyclo for cyclomatic complexity. |

Install (Go toolchain required):

```bash
go install github.com/fzipp/gocyclo/cmd/gocyclo@latest
go install honnef.co/go/tools/cmd/staticcheck@latest
export PATH="$PATH:$(go env GOPATH)/bin"
```

## Commands (first-party Go only)

Exclude `node_modules` (npm’s `flatted` package may ship `.go` files; they are **not** this project’s code):

```bash
gocyclo -top 50 -ignore node_modules .
```

Optional: fail CI if any function exceeds a threshold (example: 15):

```bash
gocyclo -over 15 -ignore node_modules .
```

**staticcheck** needs a **Go module** at the repo root (or run from the module directory):

```bash
staticcheck ./...
```

## Last run summary (this repo)

| Check | Result |
|--------|--------|
| **First-party `*.go`** | None (excluding dependencies). |
| **`gocyclo -top 50 -ignore node_modules .`** | No output — no in-tree Go functions to score. |
| **`staticcheck ./...`** | Not applicable without `go.mod` / module root (`directory prefix . does not contain main module`). |

If you add a Go module later, re-run the commands above and refresh this section (or rely on the **CI artifact** when `go.mod` is present).

## CI

When **`go.mod`** exists at the repository root, workflow **`.github/workflows/ci.yml`** runs **gocyclo**, writes `gocyclo-report.txt`, and uploads it as the artifact **`gocyclo-complexity`**.
