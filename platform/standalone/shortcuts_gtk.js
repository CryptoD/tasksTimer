/*
 * GtkAccelShortcutProvider
 *
 * ShortcutProvider implementation for the standalone GTK application using
 * Gtk.Application.set_accels_for_action() and GSimpleAction. Provides in-window
 * accelerators (e.g. Ctrl+N, Space) that trigger when the app or its windows
 * have focus.
 *
 * Global hotkey limitation: Truly global shortcuts (active when the app does not
 * have focus) are limited or unavailable on Wayland and in AppImage builds.
 * The standalone app primarily supports in-app shortcuts only. See README.
 */

const { Gio, GLib } = imports.gi;

const Platform = imports.platform.interface;

const ACTION_PREFIX = 'shortcut-';

/**
 * GTK implementation of ShortcutProvider using application actions and
 * set_accels_for_action(). Accelerators are in-window only (no global grab).
 */
var GtkAccelShortcutProvider = class GtkAccelShortcutProvider extends Platform.ShortcutProvider {
    /**
     * @param {Gtk.Application} application - Gtk.Application (implements GActionMap).
     */
    constructor(application) {
        super();
        this._application = application;
        this._nextId = 0;
        /** accelerator string -> action name (e.g. 'shortcut-0') */
        this._accelToAction = new Map();
    }

    register(accelerator, callback) {
        if (!this._application || !accelerator || typeof callback !== 'function') {
            return;
        }
        this.unregister(accelerator);

        const name = ACTION_PREFIX + (this._nextId++);
        const fullName = 'app.' + name;

        const action = Gio.SimpleAction.new(name, null);
        action.connect('activate', () => {
            try {
                callback();
            } catch (e) {
                logError(e, 'GtkAccelShortcutProvider: shortcut callback failed');
            }
        });

        this._application.add_action(action);

        try {
            this._application.set_accels_for_action(fullName, [accelerator]);
        } catch (e) {
            logError(e, 'GtkAccelShortcutProvider: set_accels_for_action failed for ' + accelerator);
            this._application.remove_action(name);
            return;
        }

        this._accelToAction.set(accelerator, name);
    }

    unregister(accelerator) {
        if (!this._application || !accelerator) {
            return;
        }
        const name = this._accelToAction.get(accelerator);
        if (!name) {
            return;
        }
        try {
            this._application.set_accels_for_action('app.' + name, []);
            this._application.remove_action(name);
        } catch (e) {
            logError(e, 'GtkAccelShortcutProvider: unregister failed for ' + accelerator);
        }
        this._accelToAction.delete(accelerator);
    }

    clear() {
        const accels = Array.from(this._accelToAction.keys());
        accels.forEach(accel => this.unregister(accel));
    }
};
