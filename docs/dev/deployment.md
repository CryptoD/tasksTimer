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
- **Checksums**: `packaging/appimage/dist/SHA256SUMS` (generated from the produced AppImage)

### Frontend `dist/` and Go binaries (checklist note)

This repository currently has **no Go module** and **no frontend build output directory** (there is no `go build` binary and no `frontend/dist/`).

If a future version of this repo adds a Go CLI and/or a built web frontend, the release workflow should additionally attach:

- A **Linux binary** built by `go build`
- Any frontend **`dist/`** bundle(s)
- Corresponding **SHA256** sums for each artifact

### SBOM

SBOM generation and attaching it to releases is intentionally deferred to **task 65**; once implemented, link the SBOM file(s) from the Release assets section above.

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

## Server / Kubernetes

There is **nothing to deploy** as a scalable HTTP API. Any future “sidecar” or remote control would be a **separate** project; this document will not apply until such a component exists.
