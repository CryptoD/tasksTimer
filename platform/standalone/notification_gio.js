/*
 * GioNotificationProvider
 *
 * NotificationProvider implementation for the standalone GTK application using
 * Gio.Notification and GApplication.send_notification() for desktop notifications.
 * Supports timer actions (dismiss, restart, snooze) via app.timerDismiss,
 * app.timerRestart, app.timerSnooze GActions when options.timerId is set.
 * If send_notification fails (e.g. no notification daemon), calls optional
 * fallback(id, title, body) for in-app display.
 */

const { Gio, GLib } = imports.gi;

const Platform = imports.platform.interface;

/** Action names registered on GApplication (main.js); used for notification buttons. */
const ACTION_DISMISS = 'app.timerDismiss';
const ACTION_RESTART = 'app.timerRestart';
const ACTION_SNOOZE = 'app.timerSnooze';

var GioNotificationProvider = class GioNotificationProvider extends Platform.NotificationProvider {
    /**
     * @param {Gtk.Application} application - Gtk.Application (or any GApplication)
     *        with send_notification() and withdraw_notification().
     * @param {Object} options - optional; fallback(id, title, body) called when
     *        send_notification throws (e.g. no notification daemon).
     */
    constructor(application, options = {}) {
        super();
        this._application = application;
        this._fallback = typeof options.fallback === 'function' ? options.fallback : null;
    }

    /**
     * Show a notification via Gio.Notification and application.send_notification().
     * If options.timerId is set, adds Restart (default), Dismiss, and Snooze 30s/5m buttons.
     *
     * @param {string} id    - stable identifier (reusing replaces previous notification).
     * @param {string} title - notification title.
     * @param {string} body  - notification body text.
     * @param {Object} options - optional; icon (GIcon), timerId (string) for action buttons.
     */
    notify(id, title, body, options = {}) {
        if (!this._application) {
            return;
        }
        // For TEST 6: force in-app fallback (env or per-call option).
        const forceInAppEnv = GLib.getenv('TASKTIMER_FORCE_INAPP_NOTIFICATIONS');
        const forceInApp = options.forceInApp || (forceInAppEnv === '1' || forceInAppEnv === 'true');
        if (forceInApp && this._fallback) {
            this._fallback(id, title, body);
            return;
        }
        const notification = new Gio.Notification();
        notification.set_title(title || '');
        notification.set_body(body || '');
        if (options.icon && options.icon instanceof Gio.Icon) {
            notification.set_icon(options.icon);
        }

        const timerId = options.timerId && String(options.timerId);
        if (timerId &&
            typeof notification.set_default_action_and_target_value === 'function' &&
            typeof notification.add_button_with_target_value === 'function') {
            const targetId = new GLib.Variant('s', timerId);
            notification.set_default_action_and_target_value(ACTION_RESTART, targetId);
            notification.add_button_with_target_value('Dismiss', ACTION_DISMISS, targetId);
            notification.add_button_with_target_value('Snooze 30s', ACTION_SNOOZE, new GLib.Variant('s', timerId + ':30'));
            notification.add_button_with_target_value('Snooze 5m', ACTION_SNOOZE, new GLib.Variant('s', timerId + ':300'));
        }

        try {
            this._application.send_notification(id || null, notification);
        } catch (e) {
            logError(e, 'GioNotificationProvider: send_notification failed');
            if (this._fallback) {
                this._fallback(id, title, body);
            }
        }
    }

    /**
     * Withdraw a notification by id (if still visible).
     *
     * @param {string} id - same id passed to notify().
     */
    close(id) {
        if (!this._application || !id) {
            return;
        }
        try {
            this._application.withdraw_notification(id);
        } catch (e) {
            logError(e, 'GioNotificationProvider: withdraw_notification failed');
        }
    }
};
