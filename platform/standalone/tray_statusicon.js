/*
 * StatusIconTrayProvider
 *
 * TrayProvider implementation for X11/legacy desktops using Gtk.StatusIcon
 * (GTK 3; deprecated in 3.14, removed in GTK 4). Use when a system tray is
 * available (e.g. X11, or desktops that still show status icons).
 *
 * - Left-click: show/hide main window
 * - Right-click: Gtk.Menu with Show/Hide, quick timer actions, Preferences, Quit
 */

const { Gtk, Gio, GLib } = imports.gi;

const Platform = imports.platform.interface;
const Branding = imports.platform.standalone.branding;

/** Default quick timer presets when none are stored (name, duration in seconds). */
const DEFAULT_QUICK_TIMERS = [
    { name: '5 min', duration: 300 },
    { name: '10 min', duration: 600 },
    { name: '15 min', duration: 900 },
    { name: '25 min', duration: 1500 },
];

/**
 * TrayProvider using Gtk.StatusIcon. Requires a reference to the platform so
 * it can show/hide the main window and (optionally) access application timers
 * for quick-start menu items.
 *
 * @param {Object} platform - StandaloneGtkPlatform instance (must have
 *   showMainWindow(), hideMainWindow(), _window, _application).
 */
var StatusIconTrayProvider = class StatusIconTrayProvider extends Platform.TrayProvider {
    constructor(platform) {
        super();
        this._platform = platform;
        this._icon = null;
        this._visible = false;
        this._tooltipText = '';
        this._menu = null;
        this._menuModel = null;

        if (typeof Gtk.StatusIcon !== 'undefined') {
            try {
                this._icon = new Gtk.StatusIcon();
                const iconName = (platform && platform._iconName) ? platform._iconName : Branding.ICON_NAME;
                this._icon.set_from_icon_name(iconName);
                this._icon.set_visible(false);
                this._icon.connect('activate', this._onActivate.bind(this));
                this._icon.connect('popup-menu', this._onPopupMenu.bind(this));
            } catch (e) {
                logError(e, 'StatusIconTrayProvider: failed to create Gtk.StatusIcon');
                this._icon = null;
            }
        }
    }

    _onActivate() {
        if (!this._platform || !this._platform._window) {
            return;
        }
        if (this._platform._window.get_visible()) {
            this._platform.hideMainWindow();
        } else {
            this._platform.showMainWindow();
        }
    }

    _onPopupMenu(icon, button, activateTime) {
        const menu = this._buildContextMenu();
        if (!menu) {
            return;
        }
        menu.show_all();
        try {
            if (menu.popup_at_pointer) {
                menu.popup_at_pointer(null);
            } else {
                menu.popup(null, null, null, null, button || 0, activateTime || 0);
            }
        } catch (e) {
            logError(e, 'StatusIconTrayProvider: menu popup failed');
        }
    }

    _buildContextMenu() {
        const menu = new Gtk.Menu();
        const app = this._platform && this._platform._application;
        const win = this._platform && this._platform._window;

        const name = typeof this._platform.getDisplayName === 'function'
            ? this._platform.getDisplayName()
            : Branding.DISPLAY_NAME;
        const showHideLabel = win && win.get_visible() ? `Hide ${name}` : `Show ${name}`;
        const showHide = new Gtk.MenuItem({ label: showHideLabel });
        showHide.connect('activate', () => this._onActivate());
        menu.append(showHide);

        const newTimer = new Gtk.MenuItem({ label: 'New timer…' });
        newTimer.connect('activate', () => {
            if (app && app.activate_action) {
                app.activate_action('newTimer', null);
            }
        });
        menu.append(newTimer);

        menu.append(new Gtk.SeparatorMenuItem());

        // Running timers (with Stop/Snooze).
        const running = app && app._timers && typeof app._timers.sort_by_running === 'function'
            ? app._timers.sort_by_running()
            : [];
        if (running.length > 0) {
            const header = new Gtk.MenuItem({ label: 'Running timers' });
            header.set_sensitive(false);
            menu.append(header);

            for (const timer of running.slice(0, 10)) {
                const hms = timer.remaining_hms ? timer.remaining_hms().toString(true) : '';
                const label = hms ? `${timer.name} (${hms})` : `${timer.name}`;
                const item = new Gtk.MenuItem({ label });

                const sub = new Gtk.Menu();
                const stop = new Gtk.MenuItem({ label: 'Stop' });
                stop.connect('activate', () => timer.stop());
                sub.append(stop);

                const snooze30 = new Gtk.MenuItem({ label: 'Snooze 30s' });
                snooze30.connect('activate', () => timer.snooze(30));
                sub.append(snooze30);

                const snooze5m = new Gtk.MenuItem({ label: 'Snooze 5m' });
                snooze5m.connect('activate', () => timer.snooze(300));
                sub.append(snooze5m);

                item.set_submenu(sub);
                menu.append(item);
            }

            menu.append(new Gtk.SeparatorMenuItem());
        }

        const quickHeader = new Gtk.MenuItem({ label: 'Quick timers' });
        quickHeader.set_sensitive(false);
        menu.append(quickHeader);

        const quickItems = this._getQuickTimerDefs();
        for (const def of quickItems) {
            const item = new Gtk.MenuItem({ label: def.name });
            item.connect('activate', () => this._startQuickTimer(def));
            menu.append(item);
        }

        menu.append(new Gtk.SeparatorMenuItem());

        const prefs = new Gtk.MenuItem({ label: 'Preferences…' });
        prefs.connect('activate', () => {
            if (app && app.activate_action) {
                app.activate_action('preferences', null);
            }
        });
        menu.append(prefs);

        const about = new Gtk.MenuItem({ label: 'About' });
        about.connect('activate', () => {
            if (app && app.activate_action) {
                app.activate_action('about', null);
            }
        });
        menu.append(about);

        const quit = new Gtk.MenuItem({ label: 'Quit' });
        quit.connect('activate', () => {
            if (app && app.quit) {
                app.quit();
            }
        });
        menu.append(quit);

        return menu;
    }

    _getQuickTimerDefs() {
        const app = this._platform && this._platform._application;
        if (!app || !app._services || !app._services.settings) {
            return DEFAULT_QUICK_TIMERS;
        }
        const provider = app._services.settings._provider;
        if (!provider || typeof provider.get !== 'function') {
            return DEFAULT_QUICK_TIMERS;
        }
        const raw = provider.get('quick-timers');
        if (!Array.isArray(raw) || raw.length === 0) {
            return DEFAULT_QUICK_TIMERS;
        }
        return raw
            .filter(entry => entry && (entry.duration > 0 || entry.name))
            .map(entry => ({
                name: String(entry.name || 'Timer'),
                duration: parseInt(entry.duration, 10) || 60,
            }))
            .slice(0, 12);
    }

    _startQuickTimer(def) {
        const app = this._platform && this._platform._application;
        if (!app || !app._timers) {
            return;
        }
        try {
            const TimersCore = imports['taskTimer@CryptoD'].timers_core;
            const TimerCore = TimersCore.TimerCore;
            const timer = new TimerCore(app._timers, def.name, def.duration);
            timer.quick = true;
            const result = typeof app._timers.add_check_dupes === 'function' ? app._timers.add_check_dupes(timer) : (app._timers.add(timer) ? timer : undefined);
            if (result === timer) {
                timer.start();
            } else if (result !== undefined && this._platform && typeof this._platform._showInAppBanner === 'function') {
                this._platform._showInAppBanner('Duplicate timer', 'A timer with this name and duration already exists.');
            }
        } catch (e) {
            logError(e, 'StatusIconTrayProvider: start quick timer failed');
        }
    }

    show() {
        if (this._icon) {
            this._icon.set_visible(true);
            this._visible = true;
        }
    }

    hide() {
        if (this._icon) {
            this._icon.set_visible(false);
            this._visible = false;
        }
    }

    setIcon(icon) {
        if (!this._icon) {
            return;
        }
        try {
            if (typeof icon === 'string') {
                this._icon.set_from_icon_name(icon || Branding.ICON_NAME);
            } else if (icon && typeof icon.to_string === 'function') {
                this._icon.set_from_gicon(icon, Gtk.IconSize.MENU);
            } else if (icon && icon.toString && icon.toString().indexOf('file://') !== -1) {
                this._icon.set_from_file(String(icon).replace('file://', ''));
            }
        } catch (e) {
            logError(e, 'StatusIconTrayProvider: setIcon failed');
        }
    }

    setTooltip(text) {
        this._tooltipText = text ? String(text) : '';
        if (this._icon) {
            this._icon.set_tooltip_text(this._tooltipText);
        }
    }

    setMenu(menuModel) {
        this._menuModel = menuModel;
        // Right-click menu is built on demand in _buildContextMenu(); we do not
        // map an external GMenuModel to Gtk.Menu here.
    }
};
