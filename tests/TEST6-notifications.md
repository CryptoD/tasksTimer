# TEST 6 (Part 1): Notifications in multiple environments

Verify that standalone taskTimer notifications appear, actions work (restart, snooze), and in-app banners show when system notifications are unavailable.

## Prerequisites

- Run the standalone app from the repo root: `gjs main.js` (or `./main.js` if executable).
- Ensure a `.desktop` file is installed or use a desktop that allows GApplication notifications (e.g. GNOME, or XFCE with notification daemon running).

---

## 1. GNOME (or other system with notification daemon)

**Goal:** Notifications appear as system toasts; Restart / Snooze / Dismiss work.

1. Start the app:  
   `gjs main.js`
2. Click **"Start 10-second test timer"**. Wait for the timer to finish (about 10 seconds).
3. **Pass:** A system notification appears (e.g. from GNOME Shell / notification daemon) with the timer name and completion message.
4. Click **"Send test notification"**.  
   **Pass:** A system notification appears with title "Test notification" and the test body.
5. Start the 10-second timer again. When the notification appears, use:
   - **Restart** (default action or button): timer restarts.  
   - **Snooze 30s** / **Snooze 5m**: timer snoozes; notification dismisses.  
   - **Dismiss**: notification closes.  
   **Pass:** Each action behaves as above (restart/snooze visible if you have a timer list or another notification).

---

## 2. In-app banner (when system notifications unavailable)

**Goal:** If the system has no notification daemon or Gio.Notification fails, the in-app banner at the top of the window is used.

**Option A – Force fallback via env (any desktop)**

1. Start with fallback forced:  
   `TASKTIMER_FORCE_INAPP_NOTIFICATIONS=1 gjs main.js`
2. Click **"Send test notification"** or **"Start 10-second test timer"** and wait for completion.
3. **Pass:** No system popup; instead a banner appears at the **top of the main window** with the notification title and body. It auto-hides after ~5 s or can be closed with **×**.

**Option B – Test in-app banner only (any desktop)**

1. Start normally:  
   `gjs main.js`
2. Click **"Test in-app banner"**.
3. **Pass:** A banner appears at the top of the window with title "In-app banner test" and the fallback message. It auto-hides or can be closed with **×**.

**Option C – Non-GNOME desktop without notification daemon**

1. On a non-GNOME desktop (e.g. minimal X11, or a session with no notification daemon), run:  
   `gjs main.js`
2. Click **"Start 10-second test timer"** and wait for completion.
3. **Pass:** Either a system notification appears (if the session has a daemon), or the in-app banner appears at the top of the window (fallback when `send_notification` fails).

---

## 3. CLI test notification

**Goal:** Confirm notification path from CLI.

1. Run:  
   `gjs main.js --test-notification`
2. **Pass:** The main window opens and one test notification is shown (system or in-app, depending on env and desktop as above).

---

## Summary checklist

| Environment / scenario              | Notifications appear | Restart / Snooze / Dismiss | In-app banner when system unavailable |
|------------------------------------|----------------------|----------------------------|---------------------------------------|
| GNOME (with daemon)                | ✓                   | ✓                          | N/A (system used)                     |
| Non-GNOME with daemon              | ✓                   | ✓                          | N/A                                   |
| Any desktop, `TASKTIMER_FORCE_INAPP_NOTIFICATIONS=1` | Via banner | N/A for banner-only test   | ✓                                     |
| Non-GNOME without daemon           | —                   | —                          | ✓ (fallback)                          |

Run at least one test on a **GNOME** desktop and one on a **non-GNOME** (or with `TASKTIMER_FORCE_INAPP_NOTIFICATIONS=1`) to satisfy TEST 6 part 1.
