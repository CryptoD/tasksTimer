# TEST 5 (Partial): Keyboard shortcut behavior

Verify that in-app keyboard shortcuts work for timer actions and opening preferences, and that they do not conflict with common desktop shortcuts.

## Scope

- **Standalone app**: in-app shortcuts only (window must have focus). Truly global shortcuts are not supported on Wayland/AppImage; see README.
- **Extension**: when "Keyboard shortcuts" is enabled in Options, global shortcuts work when running inside GNOME Shell.

This checklist focuses on the **standalone** build.

---

## Prerequisites

- Run from repo root: `gjs main.js`
- Main window must have **focus** for in-app shortcuts to trigger.

---

## 1. Open preferences (shortcut and button)

**Goal:** Preferences can be opened via Ctrl+, and via the Preferences button; no conflict with common desktop shortcuts.

1. Start the app:  
   `gjs main.js`
2. With the main window focused, press **Ctrl+,** (Control+Comma).  
   **Pass:** The Preferences window opens (timers, options, shortcuts, sound, about tabs).
3. Close the Preferences window. Click **"Preferences…"** in the main window.  
   **Pass:** The Preferences window opens again.
4. **Pass (no conflict):** Ctrl+, is not a common desktop binding; Ctrl+N / Ctrl+W / Ctrl+Q are typically unused by this app’s in-app shortcuts if you assign different keys (see step 2 in section 2).

---

## 2. Configure and use timer shortcuts

**Goal:** Show end time and Stop next timer shortcuts work when the main window has focus; they behave consistently and do not conflict with common shortcuts.

1. Open **Preferences** (Ctrl+, or button). In the **Options** tab, enable **"Keyboard shortcuts"**. In the **Shortcuts** tab:
   - Set **Show end time** to a key combination (e.g. **Ctrl+Super+T** via "Set…").
   - Set **Stop next timer** to another (e.g. **Ctrl+Super+K**).
2. **Restart the app** so the new shortcuts are registered: close the app and run `gjs main.js` again.
3. Open Preferences again and confirm the Shortcuts tab shows your chosen keys.
4. Start a timer: click **"Start 10-second test timer"**.
5. With the **main window focused**, press the **Show end time** shortcut.  
   **Pass:** The setting toggles (no crash); if the UI showed end time, it updates accordingly.
6. Press the **Stop next timer** shortcut.  
   **Pass:** The running test timer stops (or the next running timer in list order stops).
7. **Pass (consistency):** Repeating the shortcuts behaves the same (toggle show end time; stop next if any running).
8. **Pass (no conflict):** Using common desktop shortcuts (e.g. Ctrl+N, Ctrl+W, Alt+F4) does not trigger the timer actions when those keys are not assigned in the Shortcuts tab. If you did assign one of them, only your assigned action should fire when the window has focus.

---

## 3. Conflict check (optional)

**Goal:** Assigned shortcuts do not clash with typical desktop/editor bindings.

- Avoid assigning **Ctrl+Q** (quit), **Ctrl+W** (close window), **Ctrl+N** (new), **Ctrl+S** (save), **Alt+F4** (close) unless you intend to override them in this app only.
- Recommended: use **Ctrl+Super+…** or **Ctrl+Alt+…** for timer shortcuts so they are less likely to conflict. The default in the extension schema is `<ctrl><super>T` and `<ctrl><super>K`.

---

## Summary checklist

| Item                                      | Pass |
|-------------------------------------------|------|
| Ctrl+, opens Preferences                   | ☐    |
| "Preferences…" button opens Preferences  | ☐    |
| After enabling shortcuts and setting keys in prefs, restart app | ☐    |
| Show end time shortcut toggles setting     | ☐    |
| Stop next timer shortcut stops next timer | ☐    |
| Shortcuts work only when main window focused (in-app) | ☐    |
| No conflict with common desktop shortcuts (when using e.g. Ctrl+Super+…) | ☐    |

---

## Notes

- **Restart after changing shortcuts:** In-app shortcuts are registered at startup. After changing "Keyboard shortcuts" or the Shortcuts tab in Preferences, restart the app for the new bindings to take effect.
- **Extension:** For the GNOME Shell extension, enable "Keyboard shortcuts" in the extension’s Options and set the same keys in the Shortcuts tab; those work globally when the extension is active.
