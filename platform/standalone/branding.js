/*
 * Standalone application branding — single source of truth for:
 *   - Gtk.Application application_id (reverse-DNS)
 *   - User-visible name (window titles, tray, notifications, .desktop Name=)
 *   - Themed icon name (windows, tray default, Gio.Notification icon)
 *
 * Exported as top-level symbols so `imports.platform.standalone.branding.APP_ID` works in GJS.
 * Keep aligned with taskTimer@CryptoD/metadata.json (name, url) and main.js wiring.
 * Release version: version.json at repository root (synced into metadata.json via bin/sync-version.py).
 */

/** Reverse-DNS id; must match TaskTimerApplication and any .desktop StartupWMClass if set. */
var APP_ID = 'com.github.cryptod.tasktimer';

/** Shown in window titles, About, notification “application” name, tray tooltips. */
var DISPLAY_NAME = 'taskTimer';

/** Freedesktop icon name from the active theme (same family as extension panel icon). */
var ICON_NAME = 'alarm-symbolic';

/** Stable tray / StatusNotifier id (no dots; derived from APP_ID). */
function trayIndicatorId() {
    return APP_ID.replace(/\./g, '-');
}
