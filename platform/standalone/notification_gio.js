/*
 * GioNotificationProvider
 *
 * NotificationProvider implementation for the standalone GTK application using
 * Gio.Notification and GApplication.send_notification() for desktop notifications.
 */

const { Gio } = imports.gi;

const Platform = imports.platform.interface;

var GioNotificationProvider = class GioNotificationProvider extends Platform.NotificationProvider {
    /**
     * @param {Gtk.Application} application - Gtk.Application (or any GApplication)
     *        with send_notification() and withdraw_notification().
     */
    constructor(application) {
        super();
        this._application = application;
    }

    /**
     * Show a notification via Gio.Notification and application.send_notification().
     *
     * @param {string} id    - stable identifier (reusing replaces previous notification).
     * @param {string} title - notification title.
     * @param {string} body  - notification body text.
     * @param {Object} options - optional; icon (GIcon), urgency, etc. for future use.
     */
    notify(id, title, body, options = {}) {
        if (!this._application) {
            return;
        }
        const notification = new Gio.Notification();
        notification.set_title(title || '');
        notification.set_body(body || '');
        if (options.icon && options.icon instanceof Gio.Icon) {
            notification.set_icon(options.icon);
        }
        try {
            this._application.send_notification(id || null, notification);
        } catch (e) {
            logError(e, 'GioNotificationProvider: send_notification failed');
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
