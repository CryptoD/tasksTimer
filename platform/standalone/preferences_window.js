/*
 * PreferencesWindow for standalone taskTimer application
 *
 * Standalone preferences UI (GTK3).
 *
 * NOTE: The extension preferences UI in `taskTimer@CryptoD/prefs.js` relies on
 * GtkBuilder UI files that may target GTK4 and/or use tags not supported by
 * the GTK3 runtime used by the standalone app. To ensure the standalone app
 * always has a working Preferences window, we provide a small native GTK3 UI
 * here that writes directly to the shared Settings wrapper (JSON-backed).
 */

imports.gi.versions.Gtk = '3.0';

const { Gtk, GLib } = imports.gi;

const Branding = imports.platform.standalone.branding;
const GtkA11y = imports.platform.standalone.gtk_a11y;

var PreferencesWindow = class PreferencesWindow {
    /**
     * @param {Gtk.Application} app - The main application instance.
     * @param {Object} [params]
     * @param {Gtk.Window} [params.transient_for] - Optional transient parent window.
     */
    constructor(app, params = {}) {
        this._app = app;
        this._transientFor = params.transient_for || null;
        this._settings = app && app._services ? app._services.settings : null;

        const displayName = (app._displayName && typeof app._displayName === 'string') ? app._displayName : Branding.DISPLAY_NAME;
        this._window = new Gtk.Window({ title: `${displayName} Preferences` });
        GtkA11y.setName(this._window, `${displayName} Preferences`);
        GtkA11y.setDescription(this._window, 'Standalone taskTimer settings');
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

        const widget = this._buildStandalonePrefsWidget();
        this._window.add(widget);
        this._window.connect('destroy', () => {
            if (this._app && typeof this._app._reapplyTheme === 'function') {
                this._app._reapplyTheme();
            }
        });
    }

    _buildStandalonePrefsWidget() {
        const settings = this._settings;

        const root = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_start: 12,
            margin_end: 12,
            margin_top: 12,
            margin_bottom: 12,
        });

        const note = new Gtk.Label({
            label: 'These preferences apply to the standalone app and are saved in your JSON config.',
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true,
        });
        note.get_style_context().add_class('dim-label');
        root.pack_start(note, false, false, 0);

        const notebook = new Gtk.Notebook();
        notebook.set_scrollable(true);
        GtkA11y.setName(notebook, 'Preferences');
        GtkA11y.setDescription(notebook, 'General, notifications, display, behavior, and volume');

        const mkPage = (title, child) => {
            const lbl = new Gtk.Label({ label: title });
            notebook.append_page(child, lbl);
        };

        const mkRow = (labelText, widget, helpText = null) => {
            const row = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });
            const top = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12 });
            const label = new Gtk.Label({ label: labelText, halign: Gtk.Align.START, xalign: 0, hexpand: true });
            if (labelText.indexOf('_') >= 0) {
                label.set_use_underline(true);
                try {
                    label.set_mnemonic_widget(widget);
                } catch (_e) {}
            }
            top.pack_start(label, true, true, 0);
            top.pack_end(widget, false, false, 0);
            row.pack_start(top, false, false, 0);
            if (helpText) {
                const help = new Gtk.Label({ label: helpText, halign: Gtk.Align.START, xalign: 0, wrap: true });
                help.get_style_context().add_class('dim-label');
                row.pack_start(help, false, false, 0);
            }
            return row;
        };

        const mkSwitch = (initial, onToggle) => {
            const sw = new Gtk.Switch({ active: Boolean(initial), halign: Gtk.Align.END, valign: Gtk.Align.CENTER });
            sw.connect('notify::active', () => onToggle(Boolean(sw.active)));
            return sw;
        };

        const mkSpin = (initial, lower, upper, step, onChange) => {
            const adj = new Gtk.Adjustment({ lower, upper, step_increment: step, page_increment: step });
            const spin = new Gtk.SpinButton({ adjustment: adj, numeric: true });
            try { spin.set_value(Number.isFinite(initial) ? initial : lower); } catch (_e) {}
            spin.connect('value-changed', () => onChange(spin.get_value_as_int()));
            return spin;
        };

        // --- General page (theme + tray + autostart)
        const general = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10, margin_top: 6 });

        const themeCombo = new Gtk.ComboBoxText();
        themeCombo.append('system', 'System');
        themeCombo.append('light', 'Light');
        themeCombo.append('dark', 'Dark');
        const currentTheme = settings ? (settings.theme_variant || 'system') : 'system';
        themeCombo.set_active_id(currentTheme);
        themeCombo.connect('changed', () => {
            if (!settings) return;
            settings.theme_variant = themeCombo.get_active_id() || 'system';
            if (this._app && typeof this._app._reapplyTheme === 'function') {
                this._app._reapplyTheme();
            }
        });
        GtkA11y.setName(themeCombo, 'Theme variant');
        general.pack_start(
            mkRow('_Theme', themeCombo, 'Choose system/light/dark appearance for the app window.'),
            false, false, 0
        );

        const minimize = mkSwitch(settings ? settings.minimize_to_tray : false, (v) => {
            if (!settings) return;
            settings.minimize_to_tray = v;
        });
        general.pack_start(
            mkRow('_Minimize to tray', minimize, 'When enabled, closing/minimizing keeps the app running in the tray.'),
            false, false, 0
        );

        const autostart = mkSwitch(settings ? settings.autostart : false, (v) => {
            if (!settings) return;
            settings.autostart = v;
        });
        general.pack_start(
            mkRow('_Start when you log in', autostart, 'Create/remove an autostart entry for this app.'),
            false, false, 0
        );

        mkPage('General', general);

        // --- Notifications page
        const notifications = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10, margin_top: 6 });

        const notifEnabled = mkSwitch(settings ? settings.notification : true, (v) => {
            if (!settings) return;
            settings.notification = v;
        });
        notifications.pack_start(
            mkRow('_Enable notifications', notifEnabled),
            false, false, 0
        );

        const sticky = mkSwitch(settings ? settings.notification_sticky : false, (v) => {
            if (!settings) return;
            settings.notification_sticky = v;
        });
        notifications.pack_start(
            mkRow('_Sticky notifications', sticky, 'When enabled, notifications are sent with urgent priority (where supported).'),
            false, false, 0
        );

        mkPage('Notifications', notifications);

        // --- Display page
        const display = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10, margin_top: 6 });

        const showLabel = mkSwitch(settings ? settings.show_label : true, (v) => {
            if (!settings) return;
            settings.show_label = v;
            if (this._app && this._app._platform && typeof this._app._platform._syncDisplayOptionsFromSettings === 'function') {
                this._app._platform._syncDisplayOptionsFromSettings();
            }
        });
        display.pack_start(mkRow('_Show labels', showLabel), false, false, 0);

        const showTime = mkSwitch(settings ? settings.show_time : true, (v) => {
            if (!settings) return;
            settings.show_time = v;
        });
        display.pack_start(mkRow('_Show time / secondary text', showTime), false, false, 0);

        const showProgress = mkSwitch(settings ? settings.show_progress : true, (v) => {
            if (!settings) return;
            settings.show_progress = v;
        });
        display.pack_start(mkRow('_Show progress bars', showProgress), false, false, 0);

        const showEnd = mkSwitch(settings ? settings.show_endtime : false, (v) => {
            if (!settings) return;
            settings.show_endtime = v;
        });
        display.pack_start(mkRow('_Show end time (for running timers)', showEnd), false, false, 0);

        mkPage('Display', display);

        // --- Sorting / Safety page
        const behavior = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10, margin_top: 6 });

        const detectDupes = mkSwitch(settings ? settings.detect_dupes : true, (v) => {
            if (!settings) return;
            settings.detect_dupes = v;
        });
        behavior.pack_start(mkRow('_Detect duplicates', detectDupes), false, false, 0);

        const saveQuick = mkSwitch(settings ? settings.save_quick_timers : true, (v) => {
            if (!settings) return;
            settings.save_quick_timers = v;
        });
        behavior.pack_start(mkRow('_Save quick timers', saveQuick), false, false, 0);

        const sortMode = new Gtk.ComboBoxText();
        sortMode.append('default', 'Default');
        sortMode.append('duration', 'By duration');
        sortMode.append('name', 'By name');
        let mode = 'default';
        if (settings) mode = settings.sort_by_name ? 'name' : (settings.sort_by_duration ? 'duration' : 'default');
        sortMode.set_active_id(mode);
        sortMode.connect('changed', () => {
            if (!settings) return;
            const id = sortMode.get_active_id();
            settings.sort_by_duration = (id === 'duration');
            settings.sort_by_name = (id === 'name');
        });
        GtkA11y.setName(sortMode, 'Default sort mode');
        behavior.pack_start(mkRow('_Sort preset/quick lists', sortMode), false, false, 0);

        const sortDesc = mkSwitch(settings ? settings.sort_descending : false, (v) => {
            if (!settings) return;
            settings.sort_descending = v;
        });
        behavior.pack_start(mkRow('_Descending', sortDesc), false, false, 0);

        mkPage('Behavior', behavior);

        // --- Volume warning page
        const volume = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10, margin_top: 6 });
        const volWarn = mkSwitch(settings ? settings.volume_level_warn : true, (v) => {
            if (!settings) return;
            settings.volume_level_warn = v;
        });
        volume.pack_start(mkRow('_Warn when volume is low', volWarn), false, false, 0);

        const threshold = mkSpin(settings ? settings.volume_threshold : 20, 0, 100, 1, (v) => {
            if (!settings) return;
            settings.volume_threshold = v;
        });
        GtkA11y.setName(threshold, 'Volume threshold percent');
        volume.pack_start(mkRow('_Volume threshold (%)', threshold), false, false, 0);

        mkPage('Volume', volume);

        root.pack_start(notebook, true, true, 0);

        const footer = new Gtk.Label({
            label: 'Close this window to apply theme changes immediately.',
            halign: Gtk.Align.START,
            xalign: 0,
        });
        footer.get_style_context().add_class('dim-label');
        root.pack_end(footer, false, false, 0);

        return root;
    }

    present() {
        if (!this._window)
            return;
        try {
            // Ensure child widgets are realized/visible on GTK3. Gtk.Window.present()
            // does not necessarily show the full widget hierarchy.
            if (typeof this._window.show_all === 'function') {
                this._window.show_all();
            }
            if (typeof this._window.present === 'function') {
                this._window.present();
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

