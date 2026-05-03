# Features (user-facing)

This file is the **canonical list of what taskTimer actually ships** in UI and behavior.  
If something is not described here, assume it is **not** a supported product feature.

taskTimer is a **desktop kitchen / task timer** (GTK standalone and/or GNOME Shell extension), not a hosted web app.

---

## “Time tracking — explicit mode” (Task 50)

Some product checklists describe an optional **time-tracking** mode gated by **`REACT_APP_*` environment variables**.

**In this repository:**

| Topic | Status |
|-------|--------|
| **`REACT_APP_*` flags** | **Not used.** There is **no** React production bundle in the shipped app; npm/Node is **developer tooling only** (ESLint, Playwright shell, webpack budget check, etc.). Users do not set `REACT_APP_*` to enable app features. |
| **Separate “time tracking / timesheet / punch clock” explicit mode** | **Not present** — not hidden behind a flag and not in Preferences. The app is built around **named countdown timers** (presets, quick timers, running list) with alarms and optional snooze—not billable-hour or project-based time tracking. |
| **Overlap with “tracking time” colloquially** | **Yes, in the ordinary sense only:** you can run multiple timers and see remaining time, pause, adjust ±30 s, etc. That is normal timer behavior, **not** an “explicit time-tracking product mode.” |

**User doc + code agreement:** there is **nothing to turn on** for “explicit time tracking”; the feature set described **below** is what exists.

---

## What you get today (matches the UI)

These apply to **standalone** (`gjs main.js`) unless noted; the **GNOME Shell extension** exposes the same timer ideas via the panel menu.

| Area | What the UI does |
|------|-------------------|
| **Timers** | Preset timers, one-click quick presets, quick entry (durations / natural language where supported), lists of **running**, **quick**, and **preset** timers with start/stop, pause, snooze, ±30 s adjustments (as shown in the window or menu). |
| **Alerts** | Notification when a timer ends; optional alarm sound (GStreamer). |
| **Tray & session** | Optional system tray; minimize to tray where supported; optional autostart on login (standalone: XDG autostart). |
| **Look & feel** | Theme choices (e.g. System / Light / Dark) and display toggles (labels, time, progress, end time) via **Preferences** where implemented. |
| **Data** | Standalone: JSON under `~/.config/tasktimer/` and `~/.local/share/tasktimer/`. Extension: GSettings + schema. |

For install paths, flags, and screenshots, see **[README.md](../../README.md)** and **[BUILD.md](../../BUILD.md)**.

---

## Explicitly not in scope (don’t expect in the UI)

- **Web-style feature flags** (`REACT_APP_*`, Vite `VITE_*`, etc.) for end users.
- **Timesheets, billing, payroll, or export to JIRA/Linear-style work logs** from this app alone.
- **A “dependency graph” window** — module maps are **[developer docs](../dev/architecture.md)** and **[doc/DEPENDENCY_GRAPH.md](../../doc/DEPENDENCY_GRAPH.md)**, not menu items.
