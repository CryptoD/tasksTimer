# TEST 10: Advanced features behavior

Verify that quick timers, preset management, sorting, duplicate protection, and display options behave as designed in the standalone app.

## Prerequisites

- Run from repo root: `gjs main.js`
- Main window and Preferences (Options) are used for verification.

---

## 1. Quick timers

**Goal:** One-click preset buttons and Quick start form create and start timers; they appear in the sidebar and running list.

1. Start the app. In the sidebar, locate **Quick timer presets** (buttons e.g. 5 min, 10 min, 25 min).
2. **Pass:** Clicking a preset button starts a timer with that name and duration; it appears under **Running** (or in the main content list) and in the sidebar **Quick timers** list when not running.
3. Use **Quick start**: enter a name (or leave default), set minutes/seconds, click **Start**.
4. **Pass:** A new quick timer is created and started; state is persisted when “Save quick timers” is on in Preferences.

---

## 2. Preset timers (management)

**Goal:** Add, edit, delete, and reorder preset timers; changes persist and reflect in the sidebar.

1. Click **Manage presets…** in the sidebar (under Preset timers).
2. **Add:** Click **Add**, enter name (e.g. “Pizza”) and duration (e.g. 15 min). Click OK.
   - **Pass:** The new preset appears in the list and in the sidebar **Preset timers** section.
3. **Edit:** Select a preset, click **Edit**, change name or duration, OK.
   - **Pass:** The preset updates in the management list and in the sidebar.
4. **Delete:** Select a preset that is not running, click **Delete**.
   - **Pass:** The preset is removed from the list and from the sidebar.
5. **Reorder:** Add at least two presets. Select one, click **↑** or **↓**.
   - **Pass:** Order changes in the list and in the sidebar; order is preserved after restart if settings are saved.
6. **Pass:** Edit/Delete are disabled for a preset that is currently running; running presets show “(running)” in the list.

---

## 3. Sorting

**Goal:** Sort lists (Default / By duration / By name, Descending) and “Running: next to expire” apply correctly.

1. In the sidebar, open **Sort lists**.
2. Ensure there are several quick or preset timers (not running) so order is visible.
3. **Default:** Choose **Default**. Note the order (e.g. list order).
4. **By duration:** Choose **By duration**, leave **Descending** unchecked.
   - **Pass:** Non-running timers in **Quick timers** and **Preset timers** are ordered by duration ascending (shortest first).
5. Check **Descending**.
   - **Pass:** Order reverses (longest first).
6. **By name:** Choose **By name**.
   - **Pass:** Timers are ordered by name (case-insensitive); Descending reverses the order.
7. Start two or more timers with different end times.
   - **Pass:** Under **Running** (or in the main content), the soonest-to-expire timer appears first (“next to expire”).
8. Change sort and reopen the window; **Pass:** Sort choice is remembered (Default / By duration / By name and Descending).

---

## 4. Duplicate protection

**Goal:** When “Detect duplicates” is enabled, creating a duplicate timer/preset shows a clear message and does not add a second copy.

1. In **Preferences → Options** (or Timers tab if present), ensure **Detect duplicate timers** (or equivalent) is **enabled**.
2. Create a quick timer: e.g. name “Tea”, 5 minutes. Start it or leave it stopped.
3. Try to create the same again:
   - **Quick start:** Same name “Tea”, 5 min, click **Start**.
   - **Pass:** A banner appears: “Duplicate timer” / “A timer with this name and duration already exists.” No second timer is added (or the existing one is returned).
4. Open **Manage presets…**, click **Add**, enter the same name and duration as an existing preset.
   - **Pass:** Banner: “Duplicate preset” / “A preset with this name and duration already exists.” No duplicate preset.
5. From **Quick timer presets**, click the same preset button twice in a row (e.g. “5 min”).
   - **Pass:** First click starts the timer; second click shows the duplicate banner and does not start a second identical timer.
6. **New timer…** dialog: enter same name and duration as an existing timer, click Start.
   - **Pass:** Duplicate message appears; no duplicate added.
7. Disable duplicate detection in Preferences; **Pass:** Same name/duration can be added again (two entries).

---

## 5. Display options

**Goal:** Toggles for label, time, progress, and end time affect the main UI; theme variant affects appearance; options stay in sync with Preferences.

1. In the main window toolbar (next to Play/Pause), find the display toggles: **Show label**, **Show time**, **Show progress**, **Show end time**.
2. **Pass:** Each toggle turns the corresponding display on or off in the timer widget / list (e.g. labels, remaining time, progress bar, end time).
3. Open **Preferences → Options**. Change **Theme** to **Light** or **Dark**; close Preferences.
   - **Pass:** Main window (and prefs) re-apply the theme (e.g. light or dark background).
4. In Preferences, change **Sticky notification** and **Show desktop notifications**; close Preferences.
   - **Pass:** Next timer completion uses the new notification behavior (sticky vs normal; notifications on/off).
5. Change a display option in Preferences (e.g. **Animate progress icon** / show time), close Preferences, reopen the main window.
   - **Pass:** Main window toggles reflect the saved preference (or the single source of truth is prefs and main window syncs when shown).
6. Change a display toggle in the main window, then open Preferences.
   - **Pass:** The corresponding option in Preferences shows the same state (settings are shared).

---

## Pass/Fail summary

| Area              | Pass criteria |
|-------------------|----------------|
| Quick timers      | Preset buttons and Quick start create/start timers; they appear in lists and persist when enabled. |
| Preset management | Add, edit, delete, reorder work; changes persist; running presets show (running) and restrict edit/delete. |
| Sorting           | Default / By duration / By name and Descending change list order; running list is next-to-expire; choice is saved. |
| Duplicate protection | With detection on, duplicate timer/preset shows banner and no duplicate is added; with detection off, duplicates allowed. |
| Display options   | Label, time, progress, end time toggles affect UI; theme and notification options apply; main window and Preferences stay in sync. |

---

## Optional: headless smoke test

From repo root:

```bash
gjs tests/test10_advanced_smoke.js
```

This runs core logic only (sorting, duplicate detection, theme_variant string) without a display. **Pass:** script exits with code 0 and prints “TEST 10 advanced smoke: pass”.
