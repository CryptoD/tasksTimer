# Phase 16: Cross-environment manual test results

This log records **core user flows** (timers, tray, notifications, audio, preferences, import/export) per **desktop environment**, plus **deviations** from expected behavior.

**How to use:** Copy the per-DE section for each QA session, fill **Pass / Fail / N/A**, and add rows under **Deviations**.

**Reference:** Flow detail lives in `tests/TEST4-tray.md`, `tests/TEST6-notifications.md`, `tests/TEST10-advanced-features.md`, and `doc/PHASE16_TEST_MATRIX.md`.

**Final pass (aggregated status + known issues):** `tests/PHASE16_FINAL_CROSS_PLATFORM_PASS.md`

---

## Host / session (automated smoke, 2025-03-25)

| Field | Value |
|-------|--------|
| Machine role | Developer workstation / CI-style run |
| `XDG_CURRENT_DESKTOP` | COSMIC |
| Standalone app | `gjs main.js` from repo root |
| GNOME Shell extension | Not exercised (no GNOME Shell session here) |

### Automated CLI smoke (non-interactive)

| Check | Result | Notes |
|-------|--------|--------|
| `gjs main.js --help` | **Pass** | Prints help and exits without initializing timers (see deviation fixed below). |
| `gjs main.js --version` | **Pass** | Prints `taskTimer` and version; no startup side effects. |
| `gjs main.js` (brief) | **Not run** | Full GUI flows require interactive session and human verification. |

### Deviations found and resolved (this pass)

| Issue | Severity | Resolution |
|-------|----------|------------|
| `--help` / `--version` ran full `vfunc_startup()` (timer restore, logs, volume wiring) before exiting | Medium | **Fixed:** early exit in `main()` before `Gtk.Application.run()` for `-h`/`--help`/`-v`/`--version`. |
| Usage line showed `Usage: --help` when `argv[0]` was a flag | Low | **Fixed:** `_printCliHelp` uses script basename when the first argument looks like an option. |
| Log: `Gvc` typelib not found; volume warning integration skipped | Info | Expected on minimal installs; app continues (see `main.js` / volume monitor). |

---

## Template — GNOME Shell (extension)

**Distribution (example):** _______________  
**Session:** Wayland / X11: _______________  
**Tester / date:** _______________

| Flow | Pass / Fail / N/A | Notes |
|------|-------------------|--------|
| Panel indicator opens; menu usable | | |
| Create / start / stop timers | | |
| Preferences (GSettings); theme & menu width | | |
| Global shortcuts (if applicable) | | |
| Notifications on timer complete | | |
| Alarm / audio | | |
| **Import / export settings** (extension `prefs.js`) | | |

**Deviations:**

---

## Template — Standalone GTK (any DE)

**Distribution:** _______________  
**DE:** _______________  
**Wayland / X11:** _______________  
**Tester / date:** _______________

| Flow | Pass / Fail / N/A | Notes |
|------|-------------------|--------|
| Main window; create / start / stop timers | | |
| Quick timers & presets (see TEST10) | | |
| Tray: icon + menu (or graceful no-tray) | | |
| `--minimized` + tray | | |
| System notification or in-app banner fallback | | |
| `--test-notification` | | |
| Alarm / audio | | |
| Preferences (JSON-backed); autostart toggle | | |
| Import / export | **N/A** in standalone GTK UI today — settings live in `~/.config/tasktimer/` JSON; extension prefs provide import/export. Confirm scope per release. |

**Deviations:**

---

## Template — KDE Plasma (standalone)

| Flow | Pass / Fail / N/A | Notes |
|------|-------------------|--------|
| StatusNotifier / tray | | |
| Notifications + actions | | |
| Audio | | |

**Deviations:**

---

## Template — Xfce (standalone)

| Flow | Pass / Fail / N/A | Notes |
|------|-------------------|--------|
| Legacy tray / AppIndicator | | |
| `xfce4-notifyd` or equivalent | | |

**Deviations:**

---

## Template — Cinnamon / MATE (standalone)

| Flow | Pass / Fail / N/A | Notes |
|------|-------------------|--------|
| Tray + notifications | | |

**Deviations:**

---

## Outstanding (not executed in this environment)

The following **target DEs from the Phase 16 matrix** were **not** run here because only a **COSMIC** graphical session was available to automation:

- Fedora / Ubuntu / Debian / Arch / openSUSE as separate installs
- GNOME Shell (extension + standalone)
- KDE Plasma, Xfce, Cinnamon, MATE (standalone interactive)

Complete the templates above on real hardware or VMs per `doc/PHASE16_TEST_MATRIX.md`, then append dated rows to **Deviations** for any regression.
