# Changelog

All notable changes to **taskTimer** are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), with versions tied to `version.json` at the repository root (see `bin/sync-version.py`).

For build and packaging steps, see [BUILD.md](BUILD.md).

---

## [Unreleased]

Nothing yet.

---

## [1.1] — 2026-03-21

### Highlights

- **Documentation:** README rewritten around the **standalone GTK application**; added [BUILD.md](BUILD.md) for contributors (dependencies, `make` targets, tests, AppImage).
- **Standalone UX & accessibility:** GTK accessibility helpers (`platform/standalone/gtk_a11y.js`), names/mnemonics on main window, preferences, and dialogs; illustrative screenshot under `doc/screenshots/`.
- **Reliability & QA:** Periodic `timers.json` saves are **globally throttled** (avoids O(N) disk writes with many running timers); expanded edge-case handling and logging for config, notifications, storage, and GStreamer audio errors; Phase 16 test matrix and cross-platform release notes (see `tests/`, `doc/PHASE16_TEST_MATRIX.md`).
- **CLI:** `--help` / `--version` exit **before** full application startup; improved usage line when `argv[0]` is not the script path.
- **Packaging:** Shared **`bin/sync-appdir.sh`** with AppImage build (`make sync-appdir`); `make test` no longer runs the TEST 12 subprocess helper as a standalone script.

### Extension vs standalone

This release continues to ship the **GNOME Shell extension** (`taskTimer@CryptoD`) alongside the standalone app. The extension remains the path for **panel UI, GSettings, and compositor-global shortcuts**; the standalone app is the **recommended** experience for most desktops (JSON config, window + tray, `gjs main.js`). See [README.md](README.md#standalone-vs-gnome-shell-extension).

---

## [1.0] and earlier — migration to standalone

Prior to **1.1**, development focused on:

1. **Fork and rebrand** — Continued from the Kitchen Timer lineage as **taskTimer**, preserving core timer behavior while updating branding and packaging.
2. **Shared core** — Timer logic lives under `taskTimer@CryptoD/` (e.g. `timers_core.js`, `settings.js`) and is used by both the Shell extension and the standalone entrypoint.
3. **Standalone entrypoint** — **`main.js`** at the repo root (`Gtk.Application`) runs the GTK UI via `platform/standalone/` (main window, tray providers, notifications, preferences window) with **JSON** persistence under XDG paths instead of requiring GNOME Shell.
4. **Dual configuration** — Extension preferences use **GSettings** / schemas where installed; the standalone app uses **`~/.config/tasktimer/`** and related data directories. Import/export of settings is exposed in **extension** preferences; standalone users can manage JSON files directly.
5. **Packaging** — `gnome-extensions pack` for the extension zip; **AppImage** build under `packaging/appimage/` (thin bundle: system `gjs`/GTK). See [BUILD.md](BUILD.md).

Exact per-commit **1.0** release notes were not kept in this file; future releases should append sections under dated `[x.y]` headings above.

---

## Release process (maintainers)

1. Edit **`version.json`** (`version`, `release_date`).
2. Run **`make sync-version`** (updates `taskTimer@CryptoD/metadata.json` and AppStream metadata under the AppImage tree).
3. Update **CHANGELOG.md** with a new `## [x.y] — YYYY-MM-DD` section (this block is what GitHub Releases use for notes).
4. Commit and push, then create a **git tag** whose value matches **`version`** after stripping an optional leading `v` (examples: `v1.2` or `1.2`):
   ```bash
   git tag -a v1.2 -m "taskTimer 1.2"
   git push origin v1.2
   ```
   Pushing a matching tag runs **GitHub Actions** (`.github/workflows/release.yml`): `make lint`, `make test`, `make appimage`, **SHA256** checksums, and a **GitHub Release** titled `taskTimer <tag>` with the AppImage and `SHA256SUMS` attached. The release description is filled from the **`## [x.y]`** section in **CHANGELOG.md** via `bin/extract_changelog_section.py`.
5. The workflow **fails** if the tag does not match `version.json`, or if **CHANGELOG.md** has no section for that version. For other distribution channels (extensions.gnome.org, etc.), follow their usual steps.

### Beta (pre-release) and TEST 14

- Tags whose name contains **`-beta`**, **`-rc`**, or **`-alpha`** (for example `v1.2-beta.1`) produce a GitHub **Pre-release** instead of the default latest stable release. **`version.json`** must still match the tag (e.g. `1.2-beta.1`).
- To coordinate **beta AppImages**, external testers, and feedback before a stable release — including **TEST 14** (accessibility) — use **`tests/TEST14-beta-coordination.md`**.
