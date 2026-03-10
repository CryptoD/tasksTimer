# Phase 6: TrayProvider abstraction

## Purpose

Decouple core timer and menu logic from the specific tray/indicator implementation so that:

- The **GNOME Shell extension** can use the status area (panel icon + PopupMenu) without core code depending on `St`, `PanelMenu`, or `Main.panel`.
- The **standalone application** can later use a system tray (e.g. AppIndicator, libstatusnotifier) or no tray, without changing core code.

Core code talks only to `PlatformUI.tray`, which implements the `TrayProvider` interface.

## Interface

Defined in `platform/interface.js` as an abstract base class. All methods must be implemented (placeholders are valid, e.g. no-op when the platform has no tray).

| Method | Purpose |
|--------|---------|
| `show()` | Show the tray icon. No-op if already visible or no tray. |
| `hide()` | Hide the tray icon. No-op if already hidden or no tray. |
| `setIcon(icon)` | Set the icon. `icon` may be a string (icon name, e.g. `'alarm-symbolic'`) or a GIcon-like object; implementation decides. |
| `setTooltip(text)` | Set the tooltip (hover text). Empty string clears. |
| `setMenu(menuModel)` | Set the context menu. Type is implementation-defined (e.g. `GMenuModel` for GTK, PopupMenu for Shell). `null`/`undefined` to clear. |

## Implementations

### Extension (future)

A **ShellTrayProvider** (or adapter) can wrap the existing `KitchenTimerIndicator` (PanelMenu.Button):

- `show()` / `hide()` — show/hide the indicator actor.
- `setIcon(icon)` — update the indicator’s `St.Icon` (gicon or icon_name).
- `setTooltip(text)` — set the button tooltip.
- `setMenu(menuModel)` — the indicator already owns a PopupMenu; this could replace or sync with the builder’s menu.

Core would use `platform.tray` instead of `timers.indicator` for these operations; indicator-specific details (_box, _panel_label, rebuild_menu) may remain on the indicator until a fuller refactor.

### Standalone

Runtime detection chooses the first available backend (see `StandaloneTrayProvider` in `gtk_platform.js`):

1. **AppIndicator / Ayatana (StatusNotifier):** `AppIndicatorTrayProvider` in `platform/standalone/tray_appindicator.js` uses AppIndicator3 or AyatanaAppIndicator3 (libappindicator3 / libayatana-appindicator3). Works on Wayland and modern desktops with a StatusNotifier host (e.g. KDE, Xfce, Ubuntu). Same menu as StatusIcon: Show/Hide, quick timers, Preferences, Quit. Requires `gir1.2-appindicator3-0.1` or `gir1.2-ayatanaappindicator3-0.1`.
2. **X11/legacy:** `StatusIconTrayProvider` in `platform/standalone/tray_statusicon.js` uses `Gtk.StatusIcon` (GTK 3 only; deprecated in 3.14, removed in GTK 4). Left-click shows/hides the main window; right-click opens the same `Gtk.Menu`. Used when AppIndicator is not available but `Gtk.StatusIcon` is.
3. **Fallback:** If neither is available, all five methods are no-ops (no tray icon).

## Usage from core

Code that currently does:

- “update panel icon” → call `platform.tray.setIcon(icon)`.
- “update panel tooltip” → call `platform.tray.setTooltip(text)`.
- “show/hide indicator” → call `platform.tray.show()` / `platform.tray.hide()`.
- “set context menu” → call `platform.tray.setMenu(menuModel)`.

The extension would obtain `platform` from its environment; the standalone app already has `StandaloneGtkPlatform` exposing `tray`.

## Files

- **Interface:** `platform/interface.js` — `TrayProvider` class and JSDoc.
- **Standalone AppIndicator/Ayatana:** `platform/standalone/tray_appindicator.js` — `AppIndicatorTrayProvider` (StatusNotifier; preferred when available).
- **Standalone X11/legacy tray:** `platform/standalone/tray_statusicon.js` — `StatusIconTrayProvider` (Gtk.StatusIcon, left-click show/hide, right-click Gtk.Menu).
- **Standalone platform:** `platform/standalone/gtk_platform.js` — `StandaloneTrayProvider` (runtime detection: AppIndicator → StatusIcon → no-op).
- **Extension:** `taskTimer@CryptoD/indicator.js` — current panel indicator; can be wrapped by a TrayProvider adapter in a later step.
