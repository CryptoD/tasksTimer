/*
 * Platform interface definitions for taskTimer.
 *
 * These “interfaces” are simple abstract base classes that define the
 * contract between core logic (timers, config, etc.) and any concrete
 * platform implementation (GNOME Shell extension, standalone GTK app, etc.).
 *
 * Each concrete environment should provide its own implementations of:
 *  - PlatformUI
 *  - TrayProvider
 *  - ShortcutProvider
 *  - NotificationProvider
 *  - ConfigProvider
 *
 * This file must not import GNOME Shell or GTK-specific modules so that it
 * can be shared between the extension and the standalone application.
 */

var PlatformUI = class PlatformUI {
    /**
     * Initialize the platform UI.
     * Called once during application startup after core services are ready.
     */
    init() {
        throw new Error('PlatformUI.init() not implemented');
    }

    /**
     * Show the main application window or primary UI surface.
     */
    showMainWindow() {
        throw new Error('PlatformUI.showMainWindow() not implemented');
    }

    /**
     * Hide the main window (if supported by the platform).
     */
    hideMainWindow() {
        throw new Error('PlatformUI.hideMainWindow() not implemented');
    }

    /**
     * Return the TrayProvider associated with this platform, if any.
     */
    get tray() {
        throw new Error('PlatformUI.tray getter not implemented');
    }

    /**
     * Return the ShortcutProvider associated with this platform, if any.
     */
    get shortcuts() {
        throw new Error('PlatformUI.shortcuts getter not implemented');
    }

    /**
     * Return the NotificationProvider associated with this platform, if any.
     */
    get notifications() {
        throw new Error('PlatformUI.notifications getter not implemented');
    }
};

var TrayProvider = class TrayProvider {
    /**
     * Show the tray icon.
     */
    show() {
        throw new Error('TrayProvider.show() not implemented');
    }

    /**
     * Hide the tray icon.
     */
    hide() {
        throw new Error('TrayProvider.hide() not implemented');
    }

    /**
     * Update the tray icon image based on an icon name or gicon handle.
     */
    setIcon(icon) {
        throw new Error('TrayProvider.setIcon() not implemented');
    }

    /**
     * Update the tray tooltip text.
     */
    setTooltip(text) {
        throw new Error('TrayProvider.setTooltip() not implemented');
    }

    /**
     * Set or update the context menu model/structure backing the tray menu.
     * The exact type is left to the implementation (e.g. GMenuModel, Gtk.Menu).
     */
    setMenu(menuModel) {
        throw new Error('TrayProvider.setMenu() not implemented');
    }
};

var ShortcutProvider = class ShortcutProvider {
    /**
     * Register an accelerator for a named action.
     *
     * @param {string} accelerator - e.g. "<Ctrl>N", "<Primary>space"
     * @param {Function} callback  - function invoked when the shortcut fires
     */
    register(accelerator, callback) {
        throw new Error('ShortcutProvider.register() not implemented');
    }

    /**
     * Remove a previously registered accelerator.
     *
     * @param {string} accelerator
     */
    unregister(accelerator) {
        throw new Error('ShortcutProvider.unregister() not implemented');
    }

    /**
     * Clear all registered accelerators.
     */
    clear() {
        throw new Error('ShortcutProvider.clear() not implemented');
    }
};

var NotificationProvider = class NotificationProvider {
    /**
     * Show a notification.
     *
     * @param {string} id       - stable identifier for this notification
     * @param {string} title    - notification title
     * @param {string} body     - notification body text
     * @param {Object} options  - optional extra data (actions, urgency, icon, etc.)
     */
    notify(id, title, body, options = {}) {
        throw new Error('NotificationProvider.notify() not implemented');
    }

    /**
     * Close/dismiss a notification by id (if still visible).
     */
    close(id) {
        throw new Error('NotificationProvider.close() not implemented');
    }
};

var ConfigProvider = class ConfigProvider {
    /**
     * Retrieve a value for the given key; returns undefined if missing.
     */
    get(key) {
        throw new Error('ConfigProvider.get() not implemented');
    }

    /**
     * Set a value for the given key.
     */
    set(key, value) {
        throw new Error('ConfigProvider.set() not implemented');
    }

    /**
     * Convenience wrappers for common types; implementations may simply call
     * through to get()/set() with type conversion.
     */
    get_boolean(key) {
        throw new Error('ConfigProvider.get_boolean() not implemented');
    }

    get_string(key) {
        throw new Error('ConfigProvider.get_string() not implemented');
    }

    get_int(key) {
        throw new Error('ConfigProvider.get_int() not implemented');
    }

    get_strv(key) {
        throw new Error('ConfigProvider.get_strv() not implemented');
    }

    set_boolean(key, value) {
        throw new Error('ConfigProvider.set_boolean() not implemented');
    }

    set_string(key, value) {
        throw new Error('ConfigProvider.set_string() not implemented');
    }

    set_int(key, value) {
        throw new Error('ConfigProvider.set_int() not implemented');
    }

    set_strv(key, value) {
        throw new Error('ConfigProvider.set_strv() not implemented');
    }
};

