/*
 * Standalone application branding — single source of truth for:
 *   - Gtk.Application application_id (reverse-DNS)
 *   - User-visible name (window titles, tray, notifications, .desktop Name=)
 *   - Themed icon name (windows, tray default, Gio.Notification icon)
 *
 * Keep aligned with taskTimer@CryptoD/metadata.json (name, url) and main.js wiring.
 */

var Branding = {
    /** Reverse-DNS id; must match TaskTimerApplication and any .desktop StartupWMClass if set. */
    APP_ID: 'com.github.cryptod.tasktimer',

    /** Shown in window titles, About, notification “application” name, tray tooltips. */
    DISPLAY_NAME: 'taskTimer',

    /** Freedesktop icon name from the active theme (same family as extension panel icon). */
    ICON_NAME: 'alarm-symbolic',

    /** Stable tray / StatusNotifier id (no dots; derived from APP_ID). */
    trayIndicatorId() {
        return Branding.APP_ID.replace(/\./g, '-');
    },
};
