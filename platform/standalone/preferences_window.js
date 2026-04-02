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

    _setIfSettings(settings, key, value) {
        if (!settings) return;
        settings[key] = value;
    }

    _maybeReapplyTheme() {
        if (this._app && typeof this._app._reapplyTheme === 'function') {
            this._app._reapplyTheme();
        }
    }

    _maybeSyncDisplayOptions() {
        if (this._app && this._app._platform && typeof this._app._platform._syncDisplayOptionsFromSettings === 'function') {
            this._app._platform._syncDisplayOptionsFromSettings();
        }
    }

    _appendPage(notebook, title, child) {
        const lbl = new Gtk.Label({ label: title });
        notebook.append_page(child, lbl);
    }

    _mkRow(labelText, widget, helpText = null) {
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
    }

    _mkSwitch(initial, onToggle) {
        const sw = new Gtk.Switch({ active: Boolean(initial), halign: Gtk.Align.END, valign: Gtk.Align.CENTER });
        sw.connect('notify::active', () => onToggle(Boolean(sw.active)));
        return sw;
    }

    _mkSpin(initial, lower, upper, step, onChange) {
        const adj = new Gtk.Adjustment({ lower, upper, step_increment: step, page_increment: step });
        const spin = new Gtk.SpinButton({ adjustment: adj, numeric: true });
        try { spin.set_value(Number.isFinite(initial) ? initial : lower); } catch (_e) {}
        spin.connect('value-changed', () => onChange(spin.get_value_as_int()));
        return spin;
    }

    _buildGeneralPage(settings) {
        const general = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10, margin_top: 6 });

        const themeCombo = new Gtk.ComboBoxText();
        themeCombo.append('system', 'System');
        themeCombo.append('light', 'Light');
        themeCombo.append('dark', 'Dark');
        const currentTheme = settings ? (settings.theme_variant || 'system') : 'system';
        themeCombo.set_active_id(currentTheme);
        themeCombo.connect('changed', () => {
            this._setIfSettings(settings, 'theme_variant', themeCombo.get_active_id() || 'system');
            this._maybeReapplyTheme();
        });
        GtkA11y.setName(themeCombo, 'Theme variant');

        const minimize = this._mkSwitch(settings ? settings.minimize_to_tray : false, v => this._setIfSettings(settings, 'minimize_to_tray', v));
        const autostart = this._mkSwitch(settings ? settings.autostart : false, v => this._setIfSettings(settings, 'autostart', v));

        general.pack_start(this._mkRow('_Theme', themeCombo, 'Choose system/light/dark appearance for the app window.'), false, false, 0);
        general.pack_start(this._mkRow('_Minimize to tray', minimize, 'When enabled, closing/minimizing keeps the app running in the tray.'), false, false, 0);
        general.pack_start(this._mkRow('_Start when you log in', autostart, 'Create/remove an autostart entry for this app.'), false, false, 0);
        return general;
    }

    _buildNotificationsPage(settings) {
        const notifications = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10, margin_top: 6 });

        const notifEnabled = this._mkSwitch(settings ? settings.notification : true, v => this._setIfSettings(settings, 'notification', v));
        const sticky = this._mkSwitch(settings ? settings.notification_sticky : false, v => this._setIfSettings(settings, 'notification_sticky', v));

        notifications.pack_start(this._mkRow('_Enable notifications', notifEnabled), false, false, 0);
        notifications.pack_start(this._mkRow('_Sticky notifications', sticky, 'When enabled, notifications are sent with urgent priority (where supported).'), false, false, 0);
        return notifications;
    }

    _buildDisplayPage(settings) {
        const display = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10, margin_top: 6 });

        const showLabel = this._mkSwitch(settings ? settings.show_label : true, v => {
            this._setIfSettings(settings, 'show_label', v);
            this._maybeSyncDisplayOptions();
        });
        const showTime = this._mkSwitch(settings ? settings.show_time : true, v => this._setIfSettings(settings, 'show_time', v));
        const showProgress = this._mkSwitch(settings ? settings.show_progress : true, v => this._setIfSettings(settings, 'show_progress', v));
        const showEnd = this._mkSwitch(settings ? settings.show_endtime : false, v => this._setIfSettings(settings, 'show_endtime', v));

        display.pack_start(this._mkRow('_Show labels', showLabel), false, false, 0);
        display.pack_start(this._mkRow('_Show time / secondary text', showTime), false, false, 0);
        display.pack_start(this._mkRow('_Show progress bars', showProgress), false, false, 0);
        display.pack_start(this._mkRow('_Show end time (for running timers)', showEnd), false, false, 0);
        return display;
    }

    _buildBehaviorPage(settings) {
        const behavior = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10, margin_top: 6 });

        const detectDupes = this._mkSwitch(settings ? settings.detect_dupes : true, v => this._setIfSettings(settings, 'detect_dupes', v));
        const saveQuick = this._mkSwitch(settings ? settings.save_quick_timers : true, v => this._setIfSettings(settings, 'save_quick_timers', v));

        behavior.pack_start(this._mkRow('_Detect duplicates', detectDupes), false, false, 0);
        behavior.pack_start(this._mkRow('_Save quick timers', saveQuick), false, false, 0);

        const sortMode = new Gtk.ComboBoxText();
        sortMode.append('default', 'Default');
        sortMode.append('duration', 'By duration');
        sortMode.append('name', 'By name');

        let mode = 'default';
        if (settings) mode = settings.sort_by_name ? 'name' : (settings.sort_by_duration ? 'duration' : 'default');
        sortMode.set_active_id(mode);
        sortMode.connect('changed', () => {
            const id = sortMode.get_active_id();
            this._setIfSettings(settings, 'sort_by_duration', (id === 'duration'));
            this._setIfSettings(settings, 'sort_by_name', (id === 'name'));
        });
        GtkA11y.setName(sortMode, 'Default sort mode');

        const sortDesc = this._mkSwitch(settings ? settings.sort_descending : false, v => this._setIfSettings(settings, 'sort_descending', v));

        behavior.pack_start(this._mkRow('_Sort preset/quick lists', sortMode), false, false, 0);
        behavior.pack_start(this._mkRow('_Descending', sortDesc), false, false, 0);

        return behavior;
    }

    _buildVolumePage(settings) {
        const volume = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 10, margin_top: 6 });
        const volWarn = this._mkSwitch(settings ? settings.volume_level_warn : true, v => this._setIfSettings(settings, 'volume_level_warn', v));
        const threshold = this._mkSpin(settings ? settings.volume_threshold : 20, 0, 100, 1, v => this._setIfSettings(settings, 'volume_threshold', v));
        GtkA11y.setName(threshold, 'Volume threshold percent');

        volume.pack_start(this._mkRow('_Warn when volume is low', volWarn), false, false, 0);
        volume.pack_start(this._mkRow('_Volume threshold (%)', threshold), false, false, 0);
        return volume;
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

        this._appendPage(notebook, 'General', this._buildGeneralPage(settings));
        this._appendPage(notebook, 'Notifications', this._buildNotificationsPage(settings));
        this._appendPage(notebook, 'Display', this._buildDisplayPage(settings));
        this._appendPage(notebook, 'Behavior', this._buildBehaviorPage(settings));
        this._appendPage(notebook, 'Volume', this._buildVolumePage(settings));

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

