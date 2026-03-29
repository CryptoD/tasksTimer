# Building taskTimer

This repository ships **two products**:

| Product | Entry | Typical use |
|---------|--------|-------------|
| **GNOME Shell extension** | `taskTimer@CryptoD/extension.js` | Panel indicator, GSettings, global shortcuts |
| **Standalone GTK app** | `main.js` (repo root) | `gjs main.js` — any desktop with GTK 3 + GJS |

Most contributors need **GJS**, **GTK 3 GObject Introspection typelibs**, and **GStreamer** GI bindings for tests and the standalone app. The extension zip also needs **gettext** (`msgfmt`) and **`gnome-extensions`**.

---

## Requirements

Run the checker (recommended after clone):

```bash
bin/check-deps.sh
```

With no flags it checks **compile** (gettext), **runtime** (gjs + imports), and **pack** (`gnome-extensions`). Use flags to narrow checks:

| Flag | Checks |
|------|--------|
| `--compile` | `msgfmt` (`.mo` / gettext) |
| `--runtime` | `gjs`, GTK 3 + GStreamer can be imported |
| `--pack` | `gnome-extensions` (for `make pack`) |
| `--install` | `glib-compile-schemas` (for `make install`) |
| `--appimage` | gettext, gjs, `convert` (ImageMagick), `rsync`, `python3`, curl or wget; notes `appimagetool` |

**Example packages (Debian / Ubuntu):**

```text
sudo apt install gjs gettext gnome-shell libglib2.0-bin \
  gir1.2-gtk-3.0 gir1.2-gstreamer-1.0
```

Names differ on Fedora (`dnf install gjs gtk3 gtk3-devel` + GObjectIntrospection), Arch (`pacman -S gjs gtk3 gst-plugins-base`), etc. You need ** GObject Introspection typelibs** for GTK 3 and GStreamer, not only C libraries.

**Optional:**

- **`appimagetool`** — on `PATH` for AppImage builds, or `build-appimage.sh` downloads a copy (needs `curl` or `wget`).
- **`xvfb-run` + `dbus-run-session`** — closer to CI when running `make test` headless (`tests/test12_full_build_local.sh` uses them if present).

---

## Quick start (development)

From the repository root:

```bash
# Verify dependencies
bin/check-deps.sh --runtime

# Run the standalone app
gjs main.js

# Run the automated GJS tests
make test
```

---

## Make targets

| Target | Purpose |
|--------|---------|
| `make` / `make pack` | Compile `.mo` (`make mo`) then **`gnome-extensions pack`** → `taskTimer@CryptoD…shell-extension….zip` in repo root |
| `make mo` | Compile PO files via `bin/po_compile.sh` |
| `make test` | `check-deps.sh --runtime` then every `tests/test*.js` with `gjs` |
| `make lint` | gettext checks + `bin/lint.sh` |
| `make install` | Local extension install (`install_local.sh`; needs `--install` deps) |
| `make uninstall` | Remove local install |
| `make appimage` | `make mo` then `packaging/appimage/build-appimage.sh` → `packaging/appimage/dist/tasktimer-<version>-<arch>.AppImage` |
| `make sync-appdir` | Copy `main.js`, `config.js`, `platform/`, `taskTimer@CryptoD/`, … into `packaging/appimage/AppDir/` (gitignored payload; use before manual AppDir tests) |
| `make sync-version` | `bin/sync-version.py` — propagate `version.json` → `metadata.json` + AppStream |
| `make clean` | Remove generated extension zip and `packaging/appimage/dist/` |
| `make test12` | `tests/test12_full_build_local.sh` — lint, test, AppImage, pack (full local release dry run) |
| `make check-deps` | Default dependency check |
| `make check-deps-appimage` | AppImage-oriented check |

---

## Version sync (release)

Single source of truth: **`version.json`** (root). Before tagging a release:

```bash
make sync-version
# or: python3 bin/sync-version.py
```

This updates `taskTimer@CryptoD/metadata.json` and `packaging/appimage/AppDir/usr/share/metainfo/com.github.cryptod.tasktimer.appdata.xml` (when present).

Pushing a **version tag** that matches `version.json` runs **`.github/workflows/release.yml`**, which builds the AppImage, writes **SHA256** checksums, and creates a **GitHub Release** whose notes are taken from the matching `## [x.y]` section in **CHANGELOG.md** (see **CHANGELOG.md** — Release process). Tags containing **`-beta`**, **`-rc`**, or **`-alpha`** become **Pre-releases**; see **`tests/TEST14-beta-coordination.md`** to run a beta program (TEST 14) before a stable tag.

---

## Packaging

### GNOME Shell extension (`.zip`)

1. `make pack` (runs `make mo` first).
2. Output: `taskTimer@CryptoD*.zip` in the repo root (see `bin/pack.sh`).
3. Install manually or publish per [extensions.gnome.org](https://extensions.gnome.org/) guidelines.

### AppImage

1. Install AppImage build deps: `bin/check-deps.sh --appimage`.
2. `make appimage`  
   - Syncs sources into `packaging/appimage/AppDir/` (overwrites gitignored copies).  
   - Runs `bundle_appdir.sh` (icons, locales).  
   - Runs `appimagetool` → **`packaging/appimage/dist/tasktimer-<version>-<arch>.AppImage`**.

To refresh only the AppDir tree without building an image (e.g. after editing `platform/`):

```bash
make sync-appdir
```

Details: `packaging/appimage/APPDIR.md`.

---

## Tests (contributors)

| Command | What it runs |
|---------|----------------|
| `make test` | All `tests/test*.js` files with `gjs` (see table below) |
| `make lint` | gettext + project linters |
| `bash tests/test12_full_build_local.sh` or `make test12` | Lint + tests + AppImage (+ pack if `gnome-extensions` exists) |

**GitHub Actions** (`.github/workflows/ci.yml`, `release.yml`) run **`npm ci`** after **`actions/setup-node`** with **`cache: npm`**. The repo has a minimal **`package.json`** / **`package-lock.json`** only so that cache can key off the lockfile; the GJS application does not use npm packages at runtime.

**Individual scripts** (from repo root):

```bash
gjs tests/test3_core_interactions.js
gjs tests/test6_audio_smoke.js
gjs tests/test10_advanced_smoke.js
gjs tests/test11_window_autostart_polish.js
gjs tests/test12_edge_conditions.js
gjs tests/test13_performance_throttle.js
```

**Note:** `tests/_test12_config_scenarios.js` is a **helper** invoked by `test12_edge_conditions.js`, not run alone.

Manual / scenario docs live under `tests/*.md` (e.g. tray, notifications, accessibility, performance).

---

## Troubleshooting

- **`gjs` imports fail** — Install GTK 3 and GStreamer **GIR** packages for your distro; run `gjs -c 'imports.gi.versions.Gtk = "3.0"; void imports.gi.Gtk;'` to verify.
- **`make pack` fails** — Install `gnome-shell` (provides `gnome-extensions`).
- **AppImage: `appimagetool` not found** — Install it or allow the script to download it (`curl`/`wget` required).
- **Stale AppDir** — Run `make sync-appdir` or a full `make appimage` after changing application JS.

---

## See also

- `README.md` — user-facing install and CLI flags  
- `packaging/appimage/APPDIR.md` — AppImage layout and sync  
- `doc/` — design and phase notes where applicable  
