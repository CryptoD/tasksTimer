# Phase 16: Final cross-platform test pass (incl. TEST 13)

**Document date:** 2026-03-25  
**References:** `doc/PHASE16_TEST_MATRIX.md`, `tests/TEST13-performance.md`, `tests/PHASE16_CROSS_ENV_MANUAL_RESULTS.md`, `tests/TEST12-edge-conditions.md`, `tests/TEST14-accessibility.md`

This record closes the **defined QA matrix** together with **TEST 13 (performance / leak smoke)**. It merges **what was automated on the maintainer host**, **what still requires multi-DE / multi-distro manual runs**, and **known issues** accepted for this release line.

---

## 1. Executive summary

| Area | Status |
|------|--------|
| **Automated scripts** (edge cases, perf throttle, window/autostart helpers) | **Pass** on 2026-03-25 (see §2) |
| **Full matrix** (Ubuntu / Fedora / Debian / Arch / openSUSE × GNOME / KDE / Xfce / …) | **Not fully executed** in a single CI host; templates in `PHASE16_CROSS_ENV_MANUAL_RESULTS.md` remain the authoritative per-DE log |
| **TEST 13 manual** (30+ min run, RSS/CPU sampling, stress) | **Pending** human session — criteria in `tests/TEST13-performance.md` |

---

## 2. Automated verification (this pass)

Commands run from repository root; all exited **0**.

| Script | Result | Notes |
|--------|--------|--------|
| `gjs tests/test12_edge_conditions.js` | **Pass** | Missing/corrupt config, read-only dir, notification fallback, storage edge cases |
| `gjs tests/test13_performance_throttle.js` | **Pass** | Periodic `timers.json` save globally throttled (not O(N) per running timer) |
| `gjs tests/test11_window_autostart_polish.js` | **Pass** | Window defaults, autostart `.desktop` under temp `XDG_CONFIG_HOME`, CLI smoke |
| `gjs main.js --version` | **Pass** | No accidental full startup |

Optional regression (not re-run in this document’s single batch): `gjs tests/test6_audio_smoke.js`, `gjs tests/test10_advanced_smoke.js` — run before release if timer core or audio paths change.

---

## 3. Matrix alignment checklist (manual — copy to session logs)

Use `doc/PHASE16_TEST_MATRIX.md` §4 for **Required** vs **Best effort**. For each **target DE** you care about for release:

1. **Standalone GTK** (`gjs main.js` or packaged build): core flows, tray, notifications, prefs, TEST 13 manual (§4 of `TEST13-performance.md`).
2. **GNOME Shell extension** (if shipping): panel, prefs, global shortcuts, extension import/export.
3. **Wayland and X11** where shortcuts/tray differ.

Record outcomes in `tests/PHASE16_CROSS_ENV_MANUAL_RESULTS.md` (per-DE templates).

---

## 4. TEST 13 performance — final status

| Layer | Verification |
|-------|----------------|
| **Automated** | `test13_performance_throttle.js` confirms **at most one** periodic disk save per 30s window across concurrent timer ticks (see `timers_core.js` / `timers.js`). |
| **Manual (required for “full” TEST 13 sign-off)** | Long session, many concurrent timers, **RSS** stability (`/proc/PID/status`), optional **CPU stress** — see `tests/TEST13-performance.md`. **Not substituted** by automation. |

---

## 5. Remaining known issues (accepted baseline)

These are **documented product or environment limitations**, not necessarily bugs to fix before every minor release.

| ID | Topic | Description |
|----|--------|-------------|
| K1 | **Standalone import/export** | Full settings **import/export UI** lives in **extension** `prefs.js`. Standalone uses JSON under `~/.config/tasktimer/`; users can copy/backup files manually. |
| K2 | **Global shortcuts** | Truly **global** shortcuts are tied to the **GNOME Shell extension** compositor path. Standalone is **in-app** shortcuts when the window has focus; README Wayland caveats apply. |
| K3 | **Tray on GNOME Shell** | **StatusNotifier / AppIndicator** may need a **shell extension** on stock GNOME; legacy **Gtk.StatusIcon** is X11-oriented. App falls back gracefully when no tray exists. |
| K4 | **Volume warning (Gvc)** | **Gvc** mixer integration is **optional**; if typelibs / GNOME stack pieces are missing, volume monitoring is skipped with a log line; alarms still follow user sound settings when GStreamer works. |
| K5 | **Notifications without daemon** | `Gio.Notification` may fail; **in-app banner** or `TASKTIMER_FORCE_INAPP_NOTIFICATIONS=1` path — see `tests/TEST6-notifications.md` / `notification_gio.js`. |
| K6 | **Non-GNOME DEs** | **COSMIC / Pantheon / etc.** are **best effort** per matrix unless support is expanded; focus QA on declared targets (GNOME, KDE, Xfce, Cinnamon, MATE). |
| K7 | **TEST 13 manual long-run** | **RSS drift / CPU** under load not continuously monitored in CI; perf throttle is **unit-tested**, not a substitute for §4 of `TEST13-performance.md`. |
| K8 | **Accessibility** | Standalone GTK **baseline** improvements are documented in `tests/TEST14-accessibility.md`; **extension prefs** UI was not part of that pass. |

---

## 6. Sign-off block (optional)

| Role | Name | Date | Matrix manual complete? | TEST 13 manual complete? |
|------|------|------|---------------------------|----------------------------|
| QA / Maintainer | | | ☐ | ☐ |

---

## 7. Revision history

| Date | Change |
|------|--------|
| 2026-03-25 | Initial final pass doc: automated results + known issues + TEST 13 scope |
