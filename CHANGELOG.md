# Changelog

All notable changes to **taskTimer** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
for release tags. Version numbers come from [`version.json`](version.json) at the
repository root (`bin/sync-version.py` syncs extension and AppStream metadata).

For build, test, and packaging steps, see [BUILD.md](BUILD.md).

## [Unreleased]

### Added

- Reference HTTP API docs: OpenAPI 3 spec (`docs/api/openapi.yaml`), `/api/v1` versioning policy, OpenAPI CI drift check (Task 74 / CONTRIBUTING Task 96).
- Security self-assessment summary under `docs/plan/` (Task 72) and audit-log reference policy (Task 71).
- Contributor tests `test18`–`test22` for API contracts and policy links.

### Changed

- README documents API versioning and links reference contracts alongside the desktop app.

---

## [1.1] — 2026-03-21

First changelog release entry describing the **current shipped product** at this version.

### Added

- **Standalone GTK application** (`gjs main.js`) as the recommended desktop experience: main window, preset and quick timers, running-timer list, pause/snooze/±30s/stop, system notifications, optional tray icon, minimize-to-tray, and autostart on login (XDG `.desktop`).
- **JSON configuration** under `~/.config/tasktimer/` and timer persistence under `~/.local/share/tasktimer/` (portable, user-owned files).
- **Theme support** (System / Light / Dark) and display toggles for labels, time, progress, and end time.
- **Alarm audio** via GStreamer with optional volume warnings when the mixer (Gvc) is available.
- **Accessibility** improvements for GTK: helper utilities (`platform/standalone/gtk_a11y.js`), named controls and mnemonics on main window, preferences, and dialogs.
- **CLI** `--help` and `--version` that exit before full Gtk startup; clearer usage when `argv[0]` is not the script path.
- **Contributor docs:** [BUILD.md](BUILD.md) (dependencies, `make` targets, tests, AppImage), README focused on standalone install and features.
- **GNOME Shell extension** (`taskTimer@CryptoD`) continuing to ship alongside standalone: panel indicator, GSettings-backed preferences, shared timer core under `taskTimer@CryptoD/`.

### Changed

- README rewritten around the standalone app; extension documented as an alternate surface.
- Periodic `timers.json` saves are **globally throttled** to avoid O(N) disk writes with many running timers.
- AppImage build uses shared **`bin/sync-appdir.sh`** (`make sync-appdir`); `make test` no longer runs the TEST 12 subprocess helper as a standalone script.

### Fixed

- Expanded edge-case handling and logging for corrupt/missing config, notifications, atomic JSON save failures, and GStreamer audio errors (see `tests/` and Phase 16 notes).

### Security

- No bundled HTTP API or multi-user server in this release; local JSON follows the trusted-workstation model documented in `docs/dev/file-upload-threat-model.md`.

---

## Prior history (before Keep a Changelog)

Before **1.1**, the project evolved from the Kitchen Timer lineage into **taskTimer** with a shared timer core, a new standalone `main.js` entrypoint, dual GSettings (extension) vs JSON (standalone) configuration, and AppImage plus extension zip packaging. Per-version notes for **1.0** were not recorded in this file; **1.1** is the first structured release section above.

---

## Release process (maintainers)

1. Edit **`version.json`** (`version`, `release_date`).
2. Run **`make sync-version`** (updates `taskTimer@CryptoD/metadata.json` and AppStream metadata under the AppImage tree).
3. Move items from **`[Unreleased]`** into a new **`## [x.y] — YYYY-MM-DD`** section using Added / Changed / Deprecated / Removed / Fixed / Security headings.
4. Commit and push, then create a **git tag** matching **`version`** (optional leading `v`):
   ```bash
   git tag -a v1.2 -m "taskTimer 1.2"
   git push origin v1.2
   ```
   Pushing a matching tag runs **GitHub Actions** (`.github/workflows/release.yml`): `make lint`, `make test`, `make appimage`, **SHA256** checksums, CycloneDX/SPDX SBOM, and a **GitHub Release** whose description is extracted from the matching **`## [x.y]`** section via `bin/extract_changelog_section.py`.
5. The workflow **fails** if the tag does not match `version.json`, or if **CHANGELOG.md** has no section for that version.

### Beta (pre-release) and TEST 14

- Tags containing **`-beta`**, **`-rc`**, or **`-alpha`** (for example `v1.2-beta.1`) produce a GitHub **Pre-release**. **`version.json`** must still match the tag.
- Beta coordination (TEST 14 accessibility, tester feedback): **`tests/TEST14-beta-coordination.md`**.
