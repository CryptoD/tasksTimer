/*
 * PreferencesWindow for standalone taskTimer application
 *
 * Wraps the existing PreferencesBuilder from taskTimer@CryptoD/prefs.js
 * into a dedicated Gtk.Window that can be launched from the main app.
 */

const { Gtk, GLib } = imports.gi;

const Prefs = imports['taskTimer@CryptoD'].prefs;

var PreferencesWindow = class PreferencesWindow {
    /**
     * @param {Gtk.Application} app - The main application instance.
     * @param {Object} [params]
     * @param {Gtk.Window} [params.transient_for] - Optional transient parent window.
     */
    constructor(app, params = {}) {
        this._app = app;
        this._transientFor = params.transient_for || null;

        const basePath = GLib.build_filenamev([GLib.get_current_dir(), 'taskTimer@CryptoD']);
        this._builder = new Prefs.PreferencesBuilder(app._services.settings, basePath);
        this._widget = this._builder.build();
        this._builder.show();

        this._window = new Gtk.Window({ title: 'taskTimer Preferences' });
        try {
            this._window.get_style_context().add_class('tasktimer-preferences');
        } catch (_e) {
            // ignore style errors
        }
        if (this._transientFor) {
            try {
                this._window.set_transient_for(this._transientFor);
            } catch (_e) {
                // ignore if not supported
            }
        }
        try {
            this._window.set_default_size(700, 560);
        } catch (_e) {
            // ignore size errors
        }
        try {
            this._window.add(this._widget);
        } catch (_e) {
            // GTK4 may require set_child; try that as a fallback
            try {
                this._window.set_child(this._widget);
            } catch (_e2) {}
        }
        this._window.connect('destroy', () => {
            if (this._app && typeof this._app._reapplyTheme === 'function') {
                this._app._reapplyTheme();
            }
        });
    }

    present() {
        if (!this._window)
            return;
        try {
            if (typeof this._window.present === 'function') {
                this._window.present();
            } else if (typeof this._window.show_all === 'function') {
                this._window.show_all();
            } else if (typeof this._window.show === 'function') {
                this._window.show();
            }
        } catch (_e) {
            // ignore
        }
    }

    destroy() {
        if (!this._window)
            return;
        try {
            this._window.destroy();
        } catch (_e) {
            // ignore
        }
    }
};

