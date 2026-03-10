# TEST 4: Tray functionality across desktops (X11 + Wayland)

Verify that the standalone app’s tray icon appears when supported, the tray menu works, window show/hide works, and behavior is sensible when a tray is unavailable.

## Background (what we support)

The standalone tray backend is chosen at runtime (first available):

1. **AppIndicator/Ayatana (StatusNotifier)**: preferred on modern desktops and Wayland.  
   Requires **either** `AppIndicator3` or `AyatanaAppIndicator3` GIR typelibs.
2. **Gtk.StatusIcon**: legacy tray for X11/older desktops that still show “status icons”.
3. **No tray**: if neither backend is available (or the DE/compositor does not expose a tray host).

The app must continue working even when there is **no tray** (window UI still usable).

## Prerequisites

- Run from repo root: `gjs main.js`
- For minimize-to-tray testing, enable **Preferences → Options → “Minimize to tray”**.

### Optional packages (to make the tray show up)

These vary by distro/DE. Typical package names:

- **Ayatana AppIndicator** (recommended): `gir1.2-ayatanaappindicator3-0.1`
- **Legacy AppIndicator**: `gir1.2-appindicator3-0.1`
- **Tray host** on GNOME: you may need an extension (e.g. “AppIndicator and KStatusNotifierItem Support”) since GNOME Shell does not show legacy tray icons by default.

## 1) X11 desktop test

Run this on any X11 session that supports tray icons (examples: Xfce, KDE Plasma X11, MATE, Cinnamon X11).

1. Start: `gjs main.js`
2. **Pass:** A tray icon appears.
3. Left-click behavior:
   - **StatusIcon backend**: left-click toggles **Show/Hide Window**
   - **AppIndicator backend**: left-click usually opens the menu; window toggling is available via the menu item
4. Right-click / menu open:
   - **Pass:** Menu contains: **Show/Hide taskTimer**, **New timer…**, **Running timers** (if any), **Quick timers**, **Preferences…**, **Quit**
5. Click **New timer…**, create a 1-minute timer, start it.
   - **Pass:** Timer starts (and appears under **Running timers** in the tray menu).
6. In tray menu under **Running timers**, use:
   - **Stop**: stops the timer
   - **Snooze 30s / Snooze 5m**: extends the timer
   - **Pass:** actions take effect immediately
7. Tooltip/icon update:
   - **Pass:** tooltip changes to `Next: <name> (<remaining>)` while a timer is running
8. Minimize-to-tray:
   - Enable **Minimize to tray** in prefs.
   - Close the main window (X button).
   - **Pass:** app stays running; tray icon remains; use **Show taskTimer** to restore.

## 2) Wayland desktop test

Run this on any Wayland session (examples: GNOME Wayland, KDE Plasma Wayland, Sway).

1. Start: `gjs main.js`
2. Determine tray availability:
   - If AppIndicator/Ayatana typelibs + tray host exist:
     - **Pass:** tray icon appears and menu works (same checks as X11)
   - If no tray host exists (common on GNOME Wayland without the extension):
     - **Pass:** app runs normally with its main window; no crashes; no tray icon required
3. Minimize-to-tray behavior when no tray is available:
   - Enable **Minimize to tray**
   - Close/minimize the window
   - **Expected:** window hides; if no tray exists you may not have a restore surface (this is acceptable only if you disable the setting again via config/prefs or if the DE provides a way to re-open).
   - **Recommendation:** when the tray is not available, leave **Minimize to tray** disabled.

## Pass/Fail criteria (summary)

| Scenario | Pass criteria |
|---------|---------------|
| X11 + tray available | Tray icon appears; menu contains required items; window toggles; running timer actions work; tooltip/icon updates |
| Wayland + AppIndicator host available | Tray icon appears; menu/actions work as above |
| Wayland + no tray host | App still runs; window UI works; no crashes; tray absence is handled gracefully |

