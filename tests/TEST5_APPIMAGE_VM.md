# TEST 5 (AppImage): Clean environment verification

Goal: confirm the **AppImage** runs on a system **without** the GNOME Shell extension and **without** a full GNOME Shell session (e.g. Xfce, KDE, or minimal desktop), with core features usable.

## Automated smoke test (CI / local)

Script: **`tests/verify_appimage_clean_env.sh`**

- Runs the built AppImage inside a **fresh Ubuntu 22.04 Docker** container (no GNOME Shell, no extension install).
- Checks **`--version`**, **`--help`**, and a **6s** headless startup under `xvfb-run` + `dbus-run-session`.
- **Last run (automated):** passed — see repository history / CI for current status.

```bash
# Build artifact first
packaging/appimage/build-appimage.sh

# Then
tests/verify_appimage_clean_env.sh
```

Exit `2` means Docker is missing (skip in that environment).

### Expected log noise on a clean system

- **GSettings migration:** A single line such as `GSettings schema not available; using JSON defaults` is **expected** when the extension schema is not installed; the app continues with **JSON** settings (`~/.config/tasktimer/`).
- **Gvc / volume:** “volume warning unavailable (Gvc not used)” is **expected** without GNOME’s volume control typelibs; timers and alarms still work.

These are **not** treated as test failures for the automated script.

---

## Manual checklist (real VM or bare metal)

Run on a **fresh VM** (or spare user account) with **no** `~/.local/share/gnome-shell/extensions/taskTimer@CryptoD` and a **non-GNOME** session if you want to match the target environment.

| Step | Action | Pass |
|------|--------|------|
| 1 | Launch `./tasktimer-*-x86_64.AppImage` (or add executable + PATH). | ☐ |
| 2 | **Timers:** Start a short timer (e.g. “Start 10-second test timer”); confirm countdown and completion. | ☐ |
| 3 | **Audio:** Alarm sound plays at end (system has audio/GStreamer working). | ☐ |
| 4 | **Notifications:** End-of-timer notification appears (desktop allows notifications for the app). Optional: `--test-notification` once. | ☐ |
| 5 | **Tray:** If a tray/status area exists (X11 or AppIndicator-capable session), icon/menu appears; on plain Wayland without tray, expect no tray (see README). | ☐ |
| 6 | **Prefs:** Open **Preferences** (button or Ctrl+,); change an option, restart app, confirm persistence. | ☐ |

### Not in scope for “clean VM” parity

- **Global** keyboard shortcuts outside the app window (extension-only on GNOME Shell).
- **Identical** behavior to the Shell extension’s GSettings keys unless you install the schema.

---

## Relation to `tests/TEST5-shortcuts.md`

`TEST5-shortcuts.md` focuses on **in-app shortcuts** for the standalone binary. This document covers **AppImage packaging + clean-environment** behavior and broader smoke checks.
