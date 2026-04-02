/*
 * AppIndicatorTrayProvider
 *
 * TrayProvider implementation using AppIndicator3 / AyatanaAppIndicator3
 * (StatusNotifier / Application Indicators). Works on modern desktops and
 * Wayland where a StatusNotifier host is available (e.g. KDE, Xfce, Ubuntu).
 *
 * - Left-click: typically opens the menu (implementation-defined).
 * - Menu: Show/Hide, quick timers, Preferences, Quit (same as StatusIcon).
 *
 * Requires: libappindicator3 or libayatana-appindicator3 (gir1.2-appindicator3-0.1
 * or gir1.2-ayatanaappindicator3-0.1). If unavailable, the loader returns null.
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
 * Try to load AppIndicator3 (Ubuntu/old) or AyatanaAppIndicator3 (Ayatana).
 * @returns {{ Indicator, IndicatorCategory, IndicatorStatus } | null}
 */
function _loadAppIndicator() {
    const gi = imports.gi;
    for (const name of ['AppIndicator3', 'AyatanaAppIndicator3']) {
        try {
            gi.require_version(name, '0.1');
            return gi[name];
        } catch (e) {
            continue;
        }
    }
    return null;
}

const _AppIndicator = _loadAppIndicator();

/**
 * TrayProvider using AppIndicator/Ayatana. Same contract as StatusIconTrayProvider:
 * platform reference for show/hide window and app for quick timers / actions.
 *
 * @param {Object} platform - StandaloneGtkPlatform instance.
 */
var AppIndicatorTrayProvider = class AppIndicatorTrayProvider extends Platform.TrayProvider {
    constructor(platform) {
        super();
        this._platform = platform;
        this._indicator = null;
        this._menu = null;
        this._iconName = (platform && platform._iconName) ? platform._iconName : Branding.ICON_NAME;
        this._tooltipText = '';
        this._visible = false;

        if (!_AppIndicator) {
            return;
        }
        try {
            const Indicator = _AppIndicator.Indicator;
            const Cat = _AppIndicator.IndicatorCategory;
            const category = (Cat && Cat.APPLICATION_STATUS !== undefined) ? Cat.APPLICATION_STATUS : 0;
            const indicatorId = typeof Branding.trayIndicatorId === 'function'
                ? Branding.trayIndicatorId()
                : Branding.APP_ID.replace(/\./g, '-');
            this._indicator = Indicator.new(indicatorId, this._iconName, category);
            this._indicator.set_status(_AppIndicator.IndicatorStatus.ACTIVE);
            this._rebuildAndSetMenu();
        } catch (e) {
            logError(e, 'AppIndicatorTrayProvider: failed to create indicator');
            this._indicator = null;
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

    _rebuildAndSetMenu() {
        if (!this._indicator) {
            return;
        }
        const menu = this._buildContextMenu();
        if (menu) {
            menu.show_all();
            this._indicator.set_menu(menu);
            this._menu = menu;
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

        // Running timers.
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
                try {
                    if (this._platform && typeof this._platform.saveWindowState === 'function') {
                        this._platform.saveWindowState();
                    }
                } catch (_e) {}
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
            logError(e, 'AppIndicatorTrayProvider: start quick timer failed');
        }
    }

    show() {
        if (this._indicator) {
            this._indicator.set_status(_AppIndicator.IndicatorStatus.ACTIVE);
            this._visible = true;
        }
    }

    hide() {
        if (this._indicator) {
            this._indicator.set_status(_AppIndicator.IndicatorStatus.PASSIVE);
            this._visible = false;
        }
    }

    setIcon(icon) {
        if (!this._indicator) {
            return;
        }
        try {
            const name = typeof icon === 'string' ? icon : Branding.ICON_NAME;
            this._iconName = name || Branding.ICON_NAME;
            if (this._indicator.set_icon_full) {
                this._indicator.set_icon_full(this._iconName, this._tooltipText || '');
            } else if (this._indicator.set_icon) {
                this._indicator.set_icon(this._iconName);
            }
        } catch (e) {
            logError(e, 'AppIndicatorTrayProvider: setIcon failed');
        }
    }

    setTooltip(text) {
        this._tooltipText = text ? String(text) : '';
        if (this._indicator) {
            if (this._indicator.set_label) {
                this._indicator.set_label(this._tooltipText, '');
            }
            if (this._indicator.set_icon_full && this._iconName) {
                this._indicator.set_icon_full(this._iconName, this._tooltipText);
            }
        }
    }

    setMenu(_menuModel) {
        this._rebuildAndSetMenu();
    }
};

/** True if AppIndicator/Ayatana is available at load time. */
function isAvailable() {
    return _AppIndicator !== null;
}
