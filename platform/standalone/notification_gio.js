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
    _forceInApp(options) {
        // TEST 6: force in-app fallback (env or per-call option).
        const forceInAppEnv = GLib.getenv('TASKTIMER_FORCE_INAPP_NOTIFICATIONS');
        return options.forceInApp || (forceInAppEnv === '1' || forceInAppEnv === 'true');
    }

    _createNotification(title, body, options = {}) {
        const notification = new Gio.Notification();
        notification.set_title(title || '');
        notification.set_body(body || '');

        if (this._applicationName && typeof notification.set_application_name === 'function') {
            try {
                notification.set_application_name(this._applicationName);
            } catch (_e) {}
        }

        const icon = options.icon && options.icon instanceof Gio.Icon
            ? options.icon
            : this._defaultIcon;
        if (icon) {
            notification.set_icon(icon);
        }

        if (this._settings && this._settings.notification_sticky &&
            typeof notification.set_priority === 'function') {
            try {
                const urgent = (typeof Gio.NotificationPriority !== 'undefined' && Gio.NotificationPriority.URGENT !== undefined)
                    ? Gio.NotificationPriority.URGENT : 3;
                notification.set_priority(urgent);
            } catch (_e) {}
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

        return notification;
    }

    _sendNotificationOrFallback(id, title, body, notification) {
        try {
            this._application.send_notification(id || null, notification);
        } catch (e) {
            logError(e, 'GioNotificationProvider: send_notification failed (no notification daemon, portal, or session bus?)');
            if (this._fallback) {
                log('GioNotificationProvider: showing in-app fallback instead of system notification');
                this._fallback(id, title, body);
            } else {
                log('GioNotificationProvider: no fallback available; timer completion may be easy to miss');
            }
        }
    }

    /**
     * @param {Gtk.Application} application - Gtk.Application (or any GApplication)
     *        with send_notification() and withdraw_notification().
     * @param {Object} options - optional; fallback(id, title, body); settings;
     *        defaultIcon (Gio.Icon) for notifications when options.icon not set.
     */
    constructor(application, options = {}) {
        super();
        this._application = application;
        this._fallback = typeof options.fallback === 'function' ? options.fallback : null;
        this._settings = options.settings || null;
        this._defaultIcon = options.defaultIcon && options.defaultIcon instanceof Gio.Icon
            ? options.defaultIcon
            : null;
        /** Shown as the notification “application” name on some desktops (matches branding). */
        this._applicationName = typeof options.applicationName === 'string' && options.applicationName.length > 0
            ? options.applicationName
            : null;
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
        if (!this._application) return;

        if (this._forceInApp(options) && this._fallback) {
            this._fallback(id, title, body);
            return;
        }

        const notification = this._createNotification(title, body, options);
        this._sendNotificationOrFallback(id, title, body, notification);
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
