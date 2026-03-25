# Phase 16: Testing, QA, and Accessibility — Distribution & desktop matrix

This document defines **target Linux distributions**, **desktop environments (DEs)**, and **which product features must work in each combination**. Use it for release QA, regression planning, and accessibility spot-checks (keyboard, contrast, screen readers) per environment.

---

## 1. Product surfaces

taskTimer ships two primary surfaces:

| Surface | Role | Typical use |
|--------|------|-------------|
| **GNOME Shell extension** | Panel indicator, popup menus, compositor-integrated shortcuts | Users on GNOME Shell |
| **Standalone GTK app** (`gjs main.js`, AppImage, packaged binary) | Full window UI, tray when available, `Gio.Notification`, JSON config | Any DE with GTK + GJS; also GNOME users who prefer a window |

Most **Linux distribution differences** affect library versions (GTK, GJS, GLib) and packaging; **feature expectations are driven mainly by the desktop environment** (Shell APIs vs standalone GTK).

---

## 2. Target distributions (reference matrix)

These are **reference targets** for automated/manual QA—not an exhaustive support list. Prioritize **current GNOME** and **one LTS** per family.

| Family | Reference releases (examples) | Notes for QA |
|--------|-------------------------------|--------------|
| **Ubuntu** | 22.04 LTS, 24.04 LTS; latest non-LTS | Default desktop is GNOME; **Xubuntu** (XFCE), **Kubuntu** (KDE) useful for standalone-only runs. |
| **Fedora** | Current Workstation, previous | GNOME is default; good for **Wayland** + recent GTK/GJS. |
| **Debian** | `stable` + `testing` (spot-check) | Older stacks on stable; catches compatibility drift. |
| **Arch Linux** | Rolling (latest week) | Bleeding-edge GTK/GJS; good smoke test for API changes. |
| **openSUSE** | Leap (fixed) + Tumbleweed (rolling) | KDE and GNOME spins both valuable. |

Optional extras (lower frequency): **Pop!_OS** (GNOME-based), **Linux Mint** (Cinnamon), **elementary OS** (Pantheon/GTK), **Alpine** (musl — only if you officially support minimal installs).

---

## 3. Target desktop environments

| DE | Extension supported? | Standalone GTK expected? | Primary QA focus |
|----|----------------------|----------------------------|------------------|
| **GNOME Shell** | Yes | Yes | Extension: panel, menus, GSettings, global shortcuts (see Wayland note). Standalone: window, tray, notifications, autostart. |
| **KDE Plasma** | No | Yes | Tray (StatusNotifier/AppIndicator), notifications, window + shortcuts when focused. |
| **Xfce** | No | Yes | Tray, notification daemon, GTK integration. |
| **Cinnamon** | No | Yes | GTK/Xapp ecosystem; tray and notifications. |
| **MATE** | No | Yes | Similar to GNOME 2 stack; tray + notify. |
| **LXQt** | No | Yes | Lightweight; verify notifications and tray behavior. |
| **COSMIC / Pantheon / others** | No | Yes (GTK stack) | Treat as “standalone GTK”; validate on a **best-effort** basis unless you expand official support. |

**Wayland vs X11:** Exercise **both** where possible (e.g. Fedora GNOME Wayland vs session with X11). Global shortcuts and some tray semantics differ; the README already notes **global shortcuts** limitations outside the GNOME Shell extension.

---

## 4. Feature × environment matrix

Legend:

- **Required** — Must work for release on that column.
- **N/A** — Not applicable (wrong product surface).
- **Best effort** — Should not crash; full behavior may depend on session (e.g. tray on minimal setups).

### 4.1 Core timer & data

| Feature | GNOME (extension) | GNOME (standalone) | KDE | Xfce | Cinnamon / MATE | Other GTK DEs |
|---------|-------------------|--------------------|-----|------|-----------------|---------------|
| Create / run / stop timers | Required | Required | Required | Required | Required | Best effort |
| Presets, quick timers, sorting, duplicates | Required | Required | Required | Required | Required | Best effort |
| Persistence (GSettings / JSON) | Required | Required | Required | Required | Required | Best effort |
| Import / export (if enabled in build) | Required | Required | Required | Required | Required | Best effort |

### 4.2 Shell-specific (extension only)

| Feature | GNOME Shell |
|---------|-------------|
| Panel indicator & popup menu | Required |
| Menu width / theme classes (stylesheet) | Required |
| Extension preferences (`prefs.js` / GSettings schema) | Required |
| **Global** keyboard shortcuts (compositor) | Required where Shell allows; document Wayland limits |

### 4.3 Standalone GTK application

| Feature | GNOME | KDE | Xfce | Cinnamon / MATE | Other |
|---------|-------|-----|------|-----------------|-------|
| Main window, preferences, sidebar flows | Required | Required | Required | Required | Best effort |
| CLI (`--help`, `--version`, `--minimized`, `--test-notification`) | Required | Required | Required | Required | Best effort |
| XDG autostart (`~/.config/autostart/…`) | Required | Required | Required | Required | Best effort |
| Startup notification (`DESKTOP_STARTUP_ID`) | Required | Required | Required | Required | Best effort |
| **In-app** keyboard shortcuts (window focused) | Required | Required | Required | Required | Best effort |

### 4.4 System integration

| Feature | GNOME (ext) | GNOME (std) | KDE | Xfce | Cinnamon / MATE |
|---------|-------------|-------------|-----|------|-----------------|
| Timer finished: audio / notifier behavior | Required | Required | Required | Required | Required |
| System notifications (`Gio.Notification` / actions) | Required | Required | Required | Required | Required |
| In-app notification fallback (`TASKTIMER_FORCE_INAPP_NOTIFICATIONS`) | N/A | Required (verify path exists) | Same | Same | Same |
| Tray / background operation (`--minimized`) | N/A (panel) | Required | Required | Required | Required |

### 4.5 Packaging & portability

| Artifact | Ubuntu | Fedora | Debian | Arch | openSUSE | Others |
|----------|--------|--------|--------|------|------------|--------|
| Run from git: `gjs main.js` | Required | Required | Required | Required | Best effort | Best effort |
| AppImage (if shipped) | Required | Required | Required | Required | Best effort | Best effort |
| Extension zip / extensions.gnome.org workflow | Required on GNOME | — | Required on GNOME | Required on GNOME | Required on GNOME | — |

---

## 5. Accessibility (cross-cutting)

Run these **on at least one GNOME and one non-Gnome GTK** configuration per major release:

- Keyboard: tab order through main window and preferences; shortcuts do not trap focus.
- Visual: light/dark/theme variants readable; no information-only-by-color for timer state where avoidable.
- Notifications: actions reachable from notification UI where the DE exposes them.
- Screen reader: spot-check labels on primary controls (if targeting ATK/GTK accessibility).

---

## 6. How to use this matrix

1. **Smoke:** One distro per family + current Arch or Fedora (latest).
2. **Full:** All **Required** cells for the DEs you claim in the README.
3. **Regression:** When changing `main.js`, platform code, or extension Shell APIs, re-run the affected rows plus **notifications** and **tray** columns.

**Final cross-platform pass:** For a consolidated sign-off checklist (automated runs, TEST 13 performance, remaining known issues), see `tests/PHASE16_FINAL_CROSS_PLATFORM_PASS.md`.

Update this document when adding features (e.g. new CLI flags, new tray backends) or when officially expanding supported DEs.
