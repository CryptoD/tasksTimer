/*
 * StandaloneGtkPlatform
 *
 * PlatformUI implementation for the standalone GTK application.
 *
 * Responsibilities:
 *  - Manage the main GTK window lifecycle (show/hide).
 *  - Expose TrayProvider, ShortcutProvider (Gtk set_accels_for_action via
 *    platform/standalone/shortcuts_gtk.js), and NotificationProvider (Gio-based
 *    desktop notifications via platform/standalone/notification_gio.js).
 *  - Bridge between the Gtk.Application (TaskTimerApplication) and the shared
 *    Context object created at startup.
 */

imports.gi.versions.Gtk = '3.0';

const { GObject, Gtk, GLib, Gio, Pango, Gdk } = imports.gi;

const Context = imports.context;
const Branding = imports.platform.standalone.branding;
const Platform = imports.platform.interface;
const GioNotification = imports.platform.standalone.notification_gio;
const GtkShortcuts = imports.platform.standalone.shortcuts_gtk;
const TimerMenuWidgetModule = imports.platform.standalone.timer_menu_widget;
const PresetManagementWindowModule = imports.platform.standalone.preset_management_window;

const TimersCoreModule = imports['taskTimer@CryptoD'].timers_core;
const GtkA11y = imports.platform.standalone.gtk_a11y;

/** Default quick timer presets when none are stored (name, duration in seconds). */
const DEFAULT_QUICK_TIMERS = [
    { name: '5 min', duration: 300 },
    { name: '10 min', duration: 600 },
    { name: '15 min', duration: 900 },
    { name: '25 min', duration: 1500 },
];

let AppIndicatorTrayProvider = null;
let AppIndicatorAvailable = false;
try {
    const TrayAppIndicator = imports.platform.standalone.tray_appindicator;
    AppIndicatorTrayProvider = TrayAppIndicator.AppIndicatorTrayProvider;
    AppIndicatorAvailable = TrayAppIndicator.isAvailable && TrayAppIndicator.isAvailable();
} catch (e) {
    // libappindicator3 / libayatana-appindicator3 not installed or not loadable.
}

let StatusIconTrayProvider = null;
try {
    const TrayStatusIcon = imports.platform.standalone.tray_statusicon;
    StatusIconTrayProvider = TrayStatusIcon.StatusIconTrayProvider;
} catch (e) {
    // Gtk.StatusIcon may be unavailable (e.g. GTK 4); use no-op tray.
}

/**
 * TrayProvider: prefer AppIndicator/Ayatana (Wayland/modern), then StatusIcon
 * (X11/legacy), else no-op. See doc/PHASE6_TRAY_DESIGN.md.
 */
var StandaloneTrayProvider = class StandaloneTrayProvider extends Platform.TrayProvider {
    constructor(platform) {
        super();
        if (platform && AppIndicatorAvailable && AppIndicatorTrayProvider) {
            this._impl = new AppIndicatorTrayProvider(platform);
        } else if (platform && StatusIconTrayProvider) {
            this._impl = new StatusIconTrayProvider(platform);
        } else {
            this._impl = null;
        }
    }

    show() {
        if (this._impl) this._impl.show();
    }

    hide() {
        if (this._impl) this._impl.hide();
    }

    setIcon(icon) {
        if (this._impl) this._impl.setIcon(icon);
    }

    setTooltip(text) {
        if (this._impl) this._impl.setTooltip(text);
    }

    setMenu(menuModel) {
        if (this._impl) this._impl.setMenu(menuModel);
    }
};

// In-window shortcuts via Gtk.Application.set_accels_for_action().
var StandaloneShortcutProvider = GtkShortcuts.GtkAccelShortcutProvider;

// Use Gio.Notification-based provider for desktop notifications.
var StandaloneNotificationProvider = GioNotification.GioNotificationProvider;

var StandaloneGtkPlatform = GObject.registerClass(
class StandaloneGtkPlatform extends GObject.Object {
    _init(params = {}) {
        super._init();

        this._application = params.application;
        this._context = params.context instanceof Context.StandaloneContext
            ? params.context
            : new Context.StandaloneContext({
                  appId: params.appId,
                  application: this._application,
              });
        this._displayName = typeof params.displayName === 'string' && params.displayName.length > 0
            ? params.displayName
            : Branding.DISPLAY_NAME;
        this._iconName = typeof params.iconName === 'string' && params.iconName.length > 0
            ? params.iconName
            : Branding.ICON_NAME;

        this._tray = new StandaloneTrayProvider(this);
        this._shortcuts = new StandaloneShortcutProvider(this._application);
        const settings = this._application._services && this._application._services.settings;
        const defaultIcon = Gio.ThemedIcon.new(this._iconName);
        this._notifications = new StandaloneNotificationProvider(this._application, {
            fallback: (id, title, body) => this._showInAppBanner(title, body),
            settings: settings || null,
            defaultIcon: defaultIcon,
            applicationName: this.getDisplayName(),
        });

        this._window = null;
        this._bannerRevealer = null;
        this._bannerLabel = null;
        this._bannerTimeoutId = null;
        this._volumeBannerRevealer = null;
        this._volumeBannerLabel = null;
        this._trayUpdateId = null;
        this._presetManagementWindow = null;
        /** Freedesktop startup-notification: complete once after first window is ready. */
        this._startupNotifyScheduled = false;
        this._startupNotifyDone = false;
    }

    /**
     * Tell the session / launcher that startup is finished (stops “busy” cursor on
     * the taskbar icon). Paired with `Gtk.Window.set_startup_id()` from
     * `DESKTOP_STARTUP_ID`. We disable GTK’s auto notify and call
     * `Gdk.notify_startup_complete()` once ourselves so `--minimized` still completes.
     */
    _completeStartupNotificationOnce() {
        if (this._startupNotifyDone) {
            return;
        }
        this._startupNotifyDone = true;
        try {
            if (Gdk.notify_startup_complete) {
                Gdk.notify_startup_complete();
            }
        } catch (e) {
            log('taskTimer: Gdk.notify_startup_complete failed: ' + (e && e.message ? e.message : e));
        }
        try {
            GLib.unsetenv('DESKTOP_STARTUP_ID');
        } catch (_e) {}
    }

    _scheduleStartupNotificationComplete() {
        if (this._startupNotifyScheduled) {
            return;
        }
        this._startupNotifyScheduled = true;
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._completeStartupNotificationOnce();
            return false;
        });
    }

    /** Display name for window titles, tray tooltip, menu labels, and notifications. */
    getDisplayName() {
        return this._displayName || Branding.DISPLAY_NAME;
    }

    /** Theme icon name for windows, tray default state, and notifications. */
    getIconName() {
        return this._iconName || Branding.ICON_NAME;
    }

    /**
     * Show or hide the volume-below-threshold indicator. Called from main.js
     * when volume level or muted state changes (respects volume_level_warn and volume_threshold).
     *
     * @param {boolean} low - true when volume is below threshold or muted
     * @param {number} [level] - current volume percent (0–100)
     * @param {boolean} [muted] - whether the sink is muted
     */
    setVolumeWarning(low, level, muted) {
        if (!this._volumeBannerRevealer || !this._volumeBannerLabel) {
            return;
        }
        if (!low) {
            this._volumeBannerRevealer.set_reveal_child(false);
            return;
        }
        const msg = muted
            ? 'Volume muted – timer alarm may not be heard.'
            : (typeof level === 'number'
                ? `Volume low (${level}%) – timer alarm may not be heard.`
                : 'Volume below threshold – timer alarm may not be heard.');
        this._volumeBannerLabel.set_label(msg);
        this._volumeBannerRevealer.set_reveal_child(true);
    }

    _showInAppBanner(title, body) {
        if (!this._window || !this._bannerRevealer || !this._bannerLabel) {
            return;
        }
        if (this._bannerTimeoutId) {
            GLib.Source.remove(this._bannerTimeoutId);
            this._bannerTimeoutId = null;
        }
        const text = body ? `${title}\n${body}` : (title || '');
        this._bannerLabel.set_label(text);
        this._bannerRevealer.set_reveal_child(true);
        this._bannerTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
            this._bannerRevealer.set_reveal_child(false);
            this._bannerTimeoutId = null;
            return false;
        });
    }

    _hideInAppBanner() {
        if (this._bannerTimeoutId) {
            GLib.Source.remove(this._bannerTimeoutId);
            this._bannerTimeoutId = null;
        }
        if (this._bannerRevealer) {
            this._bannerRevealer.set_reveal_child(false);
        }
    }

    _formatTimerSecondary(timer) {
        // Prefer end time vs remaining time depending on settings.
        const settings = this._application && this._application._services
            ? this._application._services.settings
            : null;
        const showEnd = settings && settings.show_endtime;
        if (timer && timer.running) {
            if (showEnd && typeof timer.end_time === 'function') {
                return `Ends at ${timer.end_time()}`;
            }
            if (typeof timer.remaining_hms === 'function') {
                return timer.remaining_hms().toString(true);
            }
        }
        if (timer && typeof timer.remaining_hms === 'function') {
            return timer.remaining_hms().toString(true);
        }
        return '';
    }

    _addHeaderBar(win) {
        const hb = new Gtk.HeaderBar({
            title: this.getDisplayName(),
            show_close_button: true,
        });

        // Primary menu: New, Preferences, About (GApplication actions app.*).
        // Use Gtk.Menu + set_popup instead of Gio.Menu + popover: some GTK 3 stacks
        // hit gtk_box_pack (child already parented) when building the model popover.
        const menu = new Gtk.Menu();
        const mkItem = (label, action) => {
            const it = new Gtk.MenuItem({ label });
            it.connect('activate', () => {
                if (this._application && this._application.activate_action) {
                    this._application.activate_action(action, null);
                }
            });
            menu.append(it);
        };
        mkItem('New timer…', 'newTimer');
        mkItem('Preferences…', 'preferences');
        mkItem('About', 'about');

        const menuBtn = new Gtk.MenuButton({ direction: Gtk.ArrowType.NONE });
        try {
            menuBtn.set_popup(menu);
        } catch (_e) {
            try {
                menuBtn.set_menu(menu);
            } catch (_e2) {}
        }
        try {
            const img = Gtk.Image.new_from_icon_name('open-menu-symbolic', Gtk.IconSize.BUTTON);
            menuBtn.set_image(img);
            menuBtn.set_tooltip_text('Main menu');
            GtkA11y.setName(menuBtn, 'Main menu');
        } catch (_e) {
            menuBtn.set_label('Menu');
            GtkA11y.setName(menuBtn, 'Main menu');
        }
        hb.pack_start(menuBtn);

        const btnNew = new Gtk.Button({ label: 'New' });
        btnNew.set_tooltip_text('New timer');
        GtkA11y.setName(btnNew, 'New timer');
        btnNew.connect('clicked', () => {
            if (this._application && this._application.activate_action) {
                this._application.activate_action('newTimer', null);
            }
        });
        hb.pack_start(btnNew);

        win.set_titlebar(hb);
    }

    _getQuickTimerDefs() {
        const app = this._application;
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
        const app = this._application;
        if (!app || !app._timers) {
            return;
        }
        try {
            const TimerCore = TimersCoreModule.TimerCore;
            const timer = new TimerCore(app._timers, def.name, def.duration);
            timer.quick = true;
            const result = typeof app._timers.add_check_dupes === 'function' ? app._timers.add_check_dupes(timer) : (app._timers.add(timer) ? timer : undefined);
            if (result === timer) {
                timer.start();
                const settings = app._services ? app._services.settings : null;
                if (settings && typeof settings.pack_timers === 'function') {
                    try { settings.pack_timers(app._timers); } catch (e) {}
                }
            } else if (result !== undefined) {
                this._showInAppBanner('Duplicate timer', 'A timer with this name and duration already exists.');
            }
        } catch (e) {
            log('taskTimer: start quick timer failed: ' + (e && e.message ? e.message : e));
        }
    }

    _openPresetManagement() {
        if (this._presetManagementWindow) {
            this._presetManagementWindow.present();
            return;
        }
        const PresetManagementWindow = PresetManagementWindowModule.PresetManagementWindow;
        this._presetManagementWindow = new PresetManagementWindow(
            this._application,
            this._window
        );
        this._presetManagementWindow._window.connect('destroy', () => {
            this._presetManagementWindow = null;
        });
        this._presetManagementWindow.present();
    }

    _buildSidebarSection(title, rows) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
        });

        const label = new Gtk.Label({
            label: title,
            halign: Gtk.Align.START,
            xalign: 0,
        });
        label.get_style_context().add_class('dim-label');

        const list = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
        });
        list.set_activate_on_single_click(true);
        GtkA11y.setName(list, title);
        GtkA11y.setDescription(list, 'Press Enter to start the selected timer');

        list.connect('row-activated', (_lb, row) => {
            if (!row || !row._timer) return;
            try {
                row._timer.start();
            } catch (e) {
                log('taskTimer: failed to start timer from sidebar: ' + (e && e.message ? e.message : e));
            }
        });

        rows.forEach(r => list.add(r));

        const scroller = new Gtk.ScrolledWindow({
            vexpand: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
        });
        scroller.add(list);

        box.pack_start(label, false, false, 0);
        box.pack_start(scroller, true, true, 0);

        return { box, list };
    }

    _createTimerRow(timer, options = {}) {
        const row = new Gtk.ListBoxRow();
        row._timer = timer;

        const outer = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 12,
            margin_start: 12,
            margin_end: 12,
            margin_top: 8,
            margin_bottom: 8,
        });

        const textBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            hexpand: true,
        });

        const title = new Gtk.Label({
            label: timer.name || 'Timer',
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true,
        });
        if (timer.expired || timer.running || timer.paused) {
            title.get_style_context().add_class('timer-title-emphasis');
        }

        const secondary = new Gtk.Label({
            label: this._formatTimerSecondary(timer),
            halign: Gtk.Align.START,
            xalign: 0,
        });
        secondary.get_style_context().add_class('timer-row-secondary');
        secondary.get_style_context().add_class('dim-label');
        if (timer.expired) {
            secondary.get_style_context().remove_class('dim-label');
            secondary.get_style_context().add_class('timer-secondary-expired');
        } else if (timer.running) {
            secondary.get_style_context().remove_class('dim-label');
            secondary.get_style_context().add_class('timer-secondary-running');
        } else if (timer.paused) {
            secondary.get_style_context().remove_class('dim-label');
            secondary.get_style_context().add_class('timer-secondary-paused');
        }

        row.get_style_context().add_class('timer-list-item');
        if (timer.expired) {
            row.get_style_context().add_class('timer-expired');
        } else if (timer.running) {
            row.get_style_context().add_class('timer-running');
        } else if (timer.paused) {
            row.get_style_context().add_class('timer-paused');
        }

        row._secondaryLabel = secondary;
        textBox.pack_start(title, false, false, 0);
        textBox.pack_start(secondary, false, false, 0);

        const controls = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
        });

        // Running timer controls: +/-30s and Stop (best-effort parity with panel UI).
        if (options.showControls) {
            const btnMinus = new Gtk.Button({ label: '−30s' });
            btnMinus.connect('clicked', () => this._adjustTimer(timer, -30));
            controls.pack_start(btnMinus, false, false, 0);

            const btnStop = new Gtk.Button({ label: 'Stop' });
            btnStop.connect('clicked', () => {
                try {
                    timer.stop();
                } catch (e) {
                    log('taskTimer: stop failed: ' + (e && e.message ? e.message : e));
                }
            });
            controls.pack_start(btnStop, false, false, 0);

            const btnPlus = new Gtk.Button({ label: '+30s' });
            btnPlus.connect('clicked', () => this._adjustTimer(timer, 30));
            controls.pack_start(btnPlus, false, false, 0);
            GtkA11y.setName(btnMinus, 'Subtract thirty seconds');
            GtkA11y.setName(btnStop, 'Stop timer');
            GtkA11y.setName(btnPlus, 'Add thirty seconds');
        }

        outer.pack_start(textBox, true, true, 0);
        outer.pack_start(controls, false, false, 0);
        row.add(outer);

        const secondaryText = this._formatTimerSecondary(timer);
        GtkA11y.setName(row, `${timer.name || 'Timer'}, ${secondaryText}`);
        GtkA11y.setDescription(
            row,
            options.showControls
                ? 'Running timer; use side buttons to adjust time or stop'
                : 'Press Enter to start this timer'
        );

        return row;
    }

    _adjustTimer(timer, deltaSecs) {
        if (!timer || !timer.running || timer.alarm_timer) {
            return;
        }
        try {
            const deltaMs = deltaSecs * 1000;
            const now = Date.now();
            // If _end isn't set yet, initialize from now + duration.
            if (!timer._end || timer._end <= 0) {
                timer._end = now + (timer.duration_ms ? timer.duration_ms() : 0);
            }
            timer._end += deltaMs;
            // Ensure end stays at least 1s in the future.
            if (timer._end < now + 1000) {
                timer._end = now + 1000;
            }
        } catch (e) {
            log('taskTimer: adjust timer failed: ' + (e && e.message ? e.message : e));
        }
    }

    _rebuildSidebarLists() {
        if (!this._ui) return;
        const timers = this._application && this._application._timers
            ? this._application._timers
            : null;
        if (!timers) return;

        const quick = timers.sorted({ running: false }).filter(t => t.quick && t.enabled);
        const presets = timers.sorted({ running: false }).filter(t => !t.quick && t.enabled);

        const rebuild = (listBox, arr) => {
            const children = listBox.get_children ? listBox.get_children() : [];
            children.forEach(child => listBox.remove(child));
            arr.forEach(t => listBox.add(this._createTimerRow(t, { showControls: false })));
            listBox.show_all();
        };

        rebuild(this._ui.quickList, quick);
        rebuild(this._ui.presetList, presets);
    }

    _rebuildRunningList() {
        if (!this._ui) return;
        const timers = this._application && this._application._timers
            ? this._application._timers
            : null;
        if (!timers) return;

        const running = timers.sort_by_running();
        const list = this._ui.runningList;

        // Remove all rows; this is simple and robust for now.
        const children = list.get_children ? list.get_children() : [];
        children.forEach(child => list.remove(child));
        running.forEach(t => list.add(this._createTimerRow(t, { showControls: true })));
        list.show_all();
    }

    _startUiRefreshLoop() {
        if (this._uiUpdateId) return;
        // Throttle refresh; rebuilding lists every second can cause GTK warnings
        // on some desktops and isn't necessary for good UX.
        this._uiUpdateId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
            try {
                // Stop refreshing if the window is gone. Some GTK internals will
                // emit critical warnings if widgets are queried after destroy.
                if (!this._window) {
                    this._uiUpdateId = null;
                    return false;
                }
                // Refresh embedded timer widget when present.
                if (this._ui && this._ui.timerWidget && typeof this._ui.timerWidget.refresh === 'function') {
                    this._ui.timerWidget.setTimers(this._application ? this._application._timers : null);
                    this._ui.timerWidget.refresh();
                }
                this._rebuildSidebarLists();
            } catch (e) {
                log('taskTimer: UI refresh failed: ' + (e && e.message ? e.message : e));
            }
            return true;
        });
    }

    // PlatformUI-like API

    init() {
        // No-op for now; main window is created on demand in showMainWindow().
    }

    /**
     * Persist main window geometry to JSON config (via Settings / JSONSettingsProvider).
     * Call on close, hide-to-tray, and application shutdown so state survives tray quit.
     */
    saveWindowState() {
        this._saveWindowState();
    }

    _saveWindowState() {
        const win = this._window;
        const settings = this._application && this._application._services
            ? this._application._services.settings
            : null;
        if (!win || !settings || typeof settings.window_width === 'undefined') return;
        try {
            if (typeof win.get_in_destruction === 'function' && win.get_in_destruction()) {
                return;
            }
        } catch (_e) {}
        try {
            if (win.get_realized && win.get_realized()) {
                const [w, h] = win.get_size ? win.get_size() : [900, 560];
                const [x, y] = win.get_position ? win.get_position() : [-1, -1];
                let maximized = false;
                if (win.get_window) {
                    const gdkWin = win.get_window();
                    if (gdkWin && typeof gdkWin.get_state === 'function') {
                        maximized = Boolean(gdkWin.get_state() & Gdk.WindowState.MAXIMIZED);
                    }
                }
                settings.window_width = Math.max(400, w);
                settings.window_height = Math.max(300, h);
                settings.window_maximized = maximized;
                settings.window_x = Number.isFinite(x) ? x : -1;
                settings.window_y = Number.isFinite(y) ? y : -1;
            }
        } catch (e) {
            log('taskTimer: save window state failed: ' + (e && e.message ? e.message : e));
        }
    }

    _restoreWindowState() {
        const win = this._window;
        const settings = this._application && this._application._services
            ? this._application._services.settings
            : null;
        if (!win || !settings) return;
        try {
            const w = settings.window_width;
            const h = settings.window_height;
            if (w >= 400 && h >= 300) {
                win.resize(w, h);
            }
            const x = settings.window_x;
            const y = settings.window_y;
            if (x >= 0 && y >= 0 && typeof win.move === 'function') {
                win.move(x, y);
            }
            if (settings.window_maximized && typeof win.maximize === 'function') {
                win.maximize();
            }
        } catch (e) {
            log('taskTimer: restore window state failed: ' + (e && e.message ? e.message : e));
        }
    }

    /**
     * Create or remove the XDG autostart .desktop file so the standalone app
     * starts on login. Writes to ~/.config/autostart/tasktimer.desktop when
     * enabled, removes it when disabled.
     * @param {boolean} enabled - true to create the file, false to remove it
     */
    updateAutostartDesktop(enabled) {
        const autostartDir = GLib.build_filenamev([GLib.get_user_config_dir(), 'autostart']);
        const desktopName = 'tasktimer.desktop';
        const desktopPath = GLib.build_filenamev([autostartDir, desktopName]);
        const file = Gio.File.new_for_path(desktopPath);

        if (!enabled) {
            try {
                if (file.query_exists(null)) {
                    file.delete(null);
                }
            } catch (e) {
                log('taskTimer: failed to remove autostart desktop file: ' + (e && e.message ? e.message : e));
            }
            return;
        }

        const ctx = this._context;
        const appDir = (ctx && typeof ctx.appRoot === 'string' && ctx.appRoot.length > 0)
            ? ctx.appRoot
            : GLib.get_current_dir();
        const mainPath = (ctx && typeof ctx.mainScriptPath === 'string' && ctx.mainScriptPath.length > 0)
            ? ctx.mainScriptPath
            : GLib.build_filenamev([appDir, 'main.js']);
        const execLine = 'gjs "' + mainPath.replace(/"/g, '\\"') + '"';
        const iconName = this.getIconName();
        const lines = [
            '[Desktop Entry]',
            'Type=Application',
            'Version=1.0',
            'Name=' + this.getDisplayName(),
            'Comment=Kitchen and task timer',
            'Icon=' + iconName,
            'TryExec=gjs',
            'Exec=' + execLine,
            'Path=' + appDir,
            'Terminal=false',
            'Categories=Utility;Clock;',
            'Keywords=timer;alarm;clock;task;kitchen;',
            'StartupNotify=true',
            'StartupWMClass=' + Branding.APP_ID,
            'X-GNOME-Autostart-enabled=true',
            '',
        ];
        const contents = lines.join('\n');

        try {
            const parent = file.get_parent();
            if (parent && !parent.query_exists(null)) {
                parent.make_directory_with_parents(null);
            }
            const bytes = new TextEncoder().encode(contents);
            file.replace_contents(bytes, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        } catch (e) {
            log('taskTimer: failed to write autostart desktop file: ' + (e && e.message ? e.message : e));
        }
    }

    _createStandaloneMainWindow(settings) {
            const defW = (settings && settings.window_width >= 400) ? settings.window_width : 900;
            const defH = (settings && settings.window_height >= 300) ? settings.window_height : 560;
            this._window = new Gtk.ApplicationWindow({
                application: this._application,
                title: this.getDisplayName(),
                default_width: defW,
                default_height: defH,
            });
            GtkA11y.setName(this._window, this.getDisplayName());
            GtkA11y.setDescription(this._window, 'Kitchen and task timers');
            try {
                if (typeof this._window.set_icon_name === 'function') {
                    this._window.set_icon_name(this.getIconName());
                }
            } catch (_e) {}
            this._addHeaderBar(this._window);

            this._window.connect('delete-event', () => {
                const settings = this._application && this._application._services
                    ? this._application._services.settings
                    : null;
                if (settings && settings.minimize_to_tray) {
                    // hideMainWindow() persists geometry then hides (no quit).
                    this.hideMainWindow();
                    return true; // prevent destroy/quit
                }
                this._saveWindowState();
                return false;
            });

            this._window.connect('window-state-event', (_w, event) => {
                const settings = this._application && this._application._services
                    ? this._application._services.settings
                    : null;
                if (!settings || !settings.minimize_to_tray) {
                    return false;
                }
                try {
                    const changed = event.changed_mask;
                    const state = event.new_window_state;
                    if ((changed & Gdk.WindowState.ICONIFIED) && (state & Gdk.WindowState.ICONIFIED)) {
                        this.hideMainWindow();
                    }
                } catch (e) {
                    // ignore: different GJS/Gdk event shapes
                }
                return false;
            });
    }

    _buildMainWindowBody(settings) {
            const mainVbox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            const bannerRevealer = new Gtk.Revealer({
                transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
                transition_duration: 200,
                reveal_child: false,
            });
            this._bannerRevealer = bannerRevealer;

            const bannerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_start: 12,
                margin_end: 12,
                margin_top: 8,
                margin_bottom: 8,
            });
            bannerBox.get_style_context().add_class('toolbar');

            const bannerLabel = new Gtk.Label({
                label: '',
                wrap: true,
                wrap_mode: Pango.WrapMode.WORD_CHAR,
                hexpand: true,
                halign: Gtk.Align.START,
            });
            this._bannerLabel = bannerLabel;

            const bannerClose = new Gtk.Button({
                label: '×',
                relief: Gtk.ReliefStyle.NONE,
            });
            GtkA11y.setName(bannerClose, 'Dismiss notification');
            bannerClose.connect('clicked', () => this._hideInAppBanner());

            bannerBox.add(bannerLabel);
            bannerBox.add(bannerClose);
            bannerRevealer.add(bannerBox);
            mainVbox.pack_start(bannerRevealer, false, false, 0);

            const volumeBannerRevealer = new Gtk.Revealer({
                transition_type: Gtk.RevealerTransitionType.SLIDE_DOWN,
                transition_duration: 200,
                reveal_child: false,
            });
            this._volumeBannerRevealer = volumeBannerRevealer;
            const volumeBannerBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_start: 12,
                margin_end: 12,
                margin_top: 6,
                margin_bottom: 6,
            });
            volumeBannerBox.get_style_context().add_class('toolbar');
            try {
                volumeBannerBox.get_style_context().add_class('warning');
            } catch (_e) {}
            const volumeBannerLabel = new Gtk.Label({
                label: '',
                wrap: true,
                wrap_mode: Pango.WrapMode.WORD_CHAR,
                hexpand: true,
                halign: Gtk.Align.START,
            });
            this._volumeBannerLabel = volumeBannerLabel;
            const volumeBannerIcon = Gtk.Image.new_from_icon_name('audio-volume-muted-symbolic', Gtk.IconSize.SMALL_TOOLBAR);
            const volumeBannerClose = new Gtk.Button({
                label: '×',
                relief: Gtk.ReliefStyle.NONE,
            });
            GtkA11y.setName(volumeBannerClose, 'Dismiss volume warning');
            volumeBannerClose.connect('clicked', () => this.setVolumeWarning(false));
            volumeBannerBox.add(volumeBannerIcon);
            volumeBannerBox.add(volumeBannerLabel);
            volumeBannerBox.add(volumeBannerClose);
            volumeBannerRevealer.add(volumeBannerBox);
            mainVbox.pack_start(volumeBannerRevealer, false, false, 0);

            const root = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
                vexpand: true,
                hexpand: true,
            });

            const paned = new Gtk.Paned({
                orientation: Gtk.Orientation.HORIZONTAL,
                wide_handle: true,
            });
            GtkA11y.setName(paned, 'Main content');
            GtkA11y.setDescription(paned, 'Sidebar with presets on the left; timer lists on the right');

            // Sidebar: sort options + quick start + quick timers + presets.
            const sidebar = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
                width_request: 260,
            });

            const sortFrame = new Gtk.Frame({ label: 'Sort lists' });
            const sortBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 8,
                margin_top: 8,
                margin_bottom: 8,
                margin_start: 12,
                margin_end: 12,
            });
            const sortCombo = new Gtk.ComboBoxText();
            sortCombo.append('default', 'Default');
            sortCombo.append('duration', 'By duration');
            sortCombo.append('name', 'By name');
            sortCombo.set_active_id(settings && settings.sort_by_name ? 'name'
                : settings && settings.sort_by_duration ? 'duration'
                : 'default');
            const sortDescending = new Gtk.CheckButton({ label: 'Descending' });
            if (settings) {
                try { sortDescending.set_active(Boolean(settings.sort_descending)); } catch (e) {}
            }
            const sortApply = () => {
                if (!settings) return;
                const id = sortCombo.get_active_id();
                settings.sort_by_duration = (id === 'duration');
                settings.sort_by_name = (id === 'name');
                settings.sort_descending = sortDescending.get_active();
            };
            sortCombo.connect('changed', sortApply);
            sortDescending.connect('toggled', sortApply);
            GtkA11y.setName(sortCombo, 'Sort lists');
            GtkA11y.setDescription(sortCombo, 'Choose how preset and quick timer lists are ordered');
            GtkA11y.setName(sortDescending, 'Descending sort');
            sortBox.pack_start(sortCombo, false, false, 0);
            sortBox.pack_start(sortDescending, false, false, 0);
            const sortNote = new Gtk.Label({
                label: 'Running: next to expire',
                halign: Gtk.Align.START,
            });
            sortNote.get_style_context().add_class('dim-label');
            sortBox.pack_start(sortNote, false, false, 0);
            sortFrame.add(sortBox);
            sidebar.pack_start(sortFrame, false, false, 0);

            const quickStartFrame = new Gtk.Frame({ label: 'Quick start' });
            const quickStartBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 8,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
            });

            const entryName = new Gtk.Entry({ placeholder_text: 'Name (optional)' });
            entryName.set_text('Timer');
            GtkA11y.setName(entryName, 'Timer name');
            GtkA11y.setDescription(entryName, 'Optional label for the new timer');

            const grid = new Gtk.Grid({ column_spacing: 8, row_spacing: 8 });
            const adjMin = new Gtk.Adjustment({ lower: 0, upper: 999, step_increment: 1 });
            const adjSec = new Gtk.Adjustment({ lower: 0, upper: 59, step_increment: 1 });
            const spinMin = new Gtk.SpinButton({ adjustment: adjMin, numeric: true });
            const spinSec = new Gtk.SpinButton({ adjustment: adjSec, numeric: true });
            spinMin.set_value(5);
            spinSec.set_value(0);
            GtkA11y.setName(spinMin, 'Minutes');
            GtkA11y.setName(spinSec, 'Seconds');

            const lblName = new Gtk.Label({ label: '_Name', use_underline: true, halign: Gtk.Align.START });
            lblName.set_mnemonic_widget(entryName);
            const lblMin = new Gtk.Label({ label: '_Minutes', use_underline: true, halign: Gtk.Align.START });
            lblMin.set_mnemonic_widget(spinMin);
            const lblSec = new Gtk.Label({ label: '_Seconds', use_underline: true, halign: Gtk.Align.START });
            lblSec.set_mnemonic_widget(spinSec);
            grid.attach(lblName, 0, 0, 1, 1);
            grid.attach(entryName, 1, 0, 1, 1);
            grid.attach(lblMin, 0, 1, 1, 1);
            grid.attach(spinMin, 1, 1, 1, 1);
            grid.attach(lblSec, 0, 2, 1, 1);
            grid.attach(spinSec, 1, 2, 1, 1);

            const btnStart = new Gtk.Button({ label: 'Start' });
            GtkA11y.setName(btnStart, 'Start quick timer');
            btnStart.connect('clicked', () => {
                const total = (spinMin.get_value_as_int() * 60) + spinSec.get_value_as_int();
                if (total <= 0) return;
                const nm = (entryName.get_text() || 'Timer').trim() || 'Timer';
                const timers = this._application && this._application._timers ? this._application._timers : null;
                if (!timers) return;

                const TimerCore = TimersCoreModule.TimerCore;
                const t = new TimerCore(timers, nm, total);
                t.quick = true;
                const result = typeof timers.add_check_dupes === 'function' ? timers.add_check_dupes(t) : (timers.add(t) ? t : undefined);
                if (result === t) {
                    t.start();
                    const settings = this._application && this._application._services ? this._application._services.settings : null;
                    if (settings && typeof settings.pack_timers === 'function') {
                        try { settings.pack_timers(timers); } catch (e) {}
                    }
                } else if (result !== undefined) {
                    this._showInAppBanner('Duplicate timer', 'A timer with this name and duration already exists.');
                } else {
                    this._showInAppBanner('Could not add timer', 'Invalid name or duration.');
                }
            });

            quickStartBox.pack_start(entryName, false, false, 0);
            quickStartBox.pack_start(grid, false, false, 0);
            quickStartBox.pack_start(btnStart, false, false, 0);
            quickStartFrame.add(quickStartBox);
            sidebar.pack_start(quickStartFrame, false, false, 0);

            // One-click quick timer presets (backed by settings, same semantics as tray).
            const presetsFrame = new Gtk.Frame({ label: 'Quick timer presets' });
            const presetsFlow = new Gtk.FlowBox({
                selection_mode: Gtk.SelectionMode.NONE,
                min_children_per_line: 2,
                max_children_per_line: 4,
            });
            presetsFlow.get_style_context().add_class('preset-buttons');
            const presetsDefs = this._getQuickTimerDefs();
            for (const def of presetsDefs) {
                const btn = new Gtk.Button({ label: def.name });
                btn.set_tooltip_text(def.name + ' (' + (def.duration / 60) + ' min)');
                const d = def;
                btn.connect('clicked', () => this._startQuickTimer(d));
                GtkA11y.setName(btn, `Start ${def.name} quick timer`);
                presetsFlow.add(btn);
            }
            const presetsBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                margin_top: 8,
                margin_bottom: 8,
                margin_start: 12,
                margin_end: 12,
            });
            presetsBox.pack_start(presetsFlow, false, false, 0);
            presetsFrame.add(presetsBox);
            sidebar.pack_start(presetsFrame, false, false, 0);

            const quickSection = this._buildSidebarSection('Quick timers', []);
            const presetSection = this._buildSidebarSection('Preset timers', []);

            const btnManagePresets = new Gtk.Button({ label: 'Manage presets…' });
            GtkA11y.setName(btnManagePresets, 'Manage preset timers');
            btnManagePresets.connect('clicked', () => this._openPresetManagement());
            presetSection.box.pack_start(btnManagePresets, false, false, 0);

            sidebar.pack_start(quickSection.box, true, true, 0);
            sidebar.pack_start(presetSection.box, true, true, 0);

            // Main content: running timers list + bottom controls.
            const main = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                margin_top: 12,
                margin_bottom: 12,
                margin_start: 12,
                margin_end: 12,
            });

            const timerWidget = new TimerMenuWidgetModule.TimerMenuWidget({
                application: this._application,
                timers: this._application ? this._application._timers : null,
            });
            GtkA11y.setName(timerWidget, 'Timer lists');
            GtkA11y.setDescription(timerWidget, 'Running, quick, and preset timers');

            const actionsBar = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            actionsBar.get_style_context().add_class('toolbar');

            const mkIconBtn = (iconName, tooltip) => {
                const img = Gtk.Image.new_from_icon_name(iconName, Gtk.IconSize.BUTTON);
                const btn = new Gtk.Button({ image: img, relief: Gtk.ReliefStyle.NONE });
                if (tooltip) {
                    btn.set_tooltip_text(tooltip);
                    GtkA11y.setName(btn, tooltip);
                } else {
                    GtkA11y.setName(btn, iconName);
                }
                return btn;
            };

            const mkIconToggle = (iconName, tooltip) => {
                const img = Gtk.Image.new_from_icon_name(iconName, Gtk.IconSize.BUTTON);
                const btn = new Gtk.ToggleButton({ image: img, relief: Gtk.ReliefStyle.NONE });
                if (tooltip) {
                    btn.set_tooltip_text(tooltip);
                    GtkA11y.setName(btn, tooltip);
                } else {
                    GtkA11y.setName(btn, iconName);
                }
                return btn;
            };

            const btnQuickCreate = mkIconBtn('list-add-symbolic', 'Quick create');
            const btnPlayPause = mkIconBtn('media-playback-start-symbolic', 'Play/Pause');
            const btnReset = mkIconBtn('view-refresh-symbolic', 'Reset');
            const btnDelete = mkIconBtn('edit-delete-symbolic', 'Delete');

            const togLabel = mkIconToggle('font-x-generic-symbolic', 'Show label');
            const togTime = mkIconToggle('preferences-system-time-symbolic', 'Show time');
            const togProgress = mkIconToggle('view-list-symbolic', 'Show progress');
            const togEndTime = mkIconToggle('clock-symbolic', 'Show end time');
            if (settings) {
                try { togLabel.set_active(Boolean(settings.show_label)); } catch (e) {}
                try { togTime.set_active(Boolean(settings.show_time)); } catch (e) {}
                try { togProgress.set_active(Boolean(settings.show_progress)); } catch (e) {}
                try { togEndTime.set_active(Boolean(settings.show_endtime)); } catch (e) {}
            }

            const setPlayPauseIcon = (timer) => {
                const img = btnPlayPause.get_image();
                if (!img) return;
                if (timer && timer.running) {
                    img.set_from_icon_name('media-playback-pause-symbolic', Gtk.IconSize.BUTTON);
                } else if (timer && timer.paused) {
                    img.set_from_icon_name('media-playback-start-symbolic', Gtk.IconSize.BUTTON);
                } else {
                    img.set_from_icon_name('media-playback-start-symbolic', Gtk.IconSize.BUTTON);
                }
            };

            const updateActionsState = () => {
                const t = timerWidget.selected_timer;
                btnPlayPause.set_sensitive(Boolean(t));
                btnReset.set_sensitive(Boolean(t));
                btnDelete.set_sensitive(Boolean(t && !t.running && !t.paused));
                setPlayPauseIcon(t);
            };

            const refreshDisplayOptions = () => {
                try { timerWidget.refresh(); } catch (e) {}
            };

            btnQuickCreate.connect('clicked', () => {
                timerWidget.focusQuickEntry();
            });

            btnPlayPause.connect('clicked', () => {
                const t = timerWidget.selected_timer;
                if (!t) return;
                try {
                    if (t.running && typeof t.pause === 'function') {
                        t.pause();
                    } else if (t.paused && typeof t.resume === 'function') {
                        t.resume();
                    } else {
                        t.start();
                    }
                } catch (e) {}
                // Persist state changes (pause/resume/start) to settings.
                try {
                    const timers = this._application ? this._application._timers : null;
                    const settings = this._application && this._application._services ? this._application._services.settings : null;
                    if (timers && settings && typeof settings.pack_timers === 'function') {
                        settings.pack_timers(timers);
                    }
                } catch (e) {}
                updateActionsState();
            });

            btnReset.connect('clicked', () => {
                const t = timerWidget.selected_timer;
                if (!t) return;
                try {
                    if (typeof t.resetTimer === 'function') {
                        t.resetTimer();
                    }
                } catch (e) {}
                try {
                    const timers = this._application ? this._application._timers : null;
                    const settings = this._application && this._application._services ? this._application._services.settings : null;
                    if (timers && settings && typeof settings.pack_timers === 'function') {
                        settings.pack_timers(timers);
                    }
                    timerWidget.refresh();
                } catch (e) {}
                updateActionsState();
            });

            btnDelete.connect('clicked', () => {
                const t = timerWidget.selected_timer;
                const timers = this._application ? this._application._timers : null;
                if (!t || !timers || t.running || t.paused) return;
                try {
                    if (typeof timers.remove === 'function') {
                        timers.remove(t);
                    }
                    const settings = this._application && this._application._services ? this._application._services.settings : null;
                    if (settings && typeof settings.pack_timers === 'function') {
                        settings.pack_timers(timers);
                    }
                    timerWidget.refresh();
                } catch (e) {}
                updateActionsState();
            });

            timerWidget.connect('selected-timer-changed', updateActionsState);
            actionsBar.pack_start(btnQuickCreate, false, false, 0);
            actionsBar.pack_start(btnPlayPause, false, false, 0);
            actionsBar.pack_start(btnReset, false, false, 0);
            actionsBar.pack_start(btnDelete, false, false, 0);
            actionsBar.pack_start(new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL }), false, false, 6);
            actionsBar.pack_start(togLabel, false, false, 0);
            actionsBar.pack_start(togTime, false, false, 0);
            actionsBar.pack_start(togProgress, false, false, 0);
            actionsBar.pack_start(togEndTime, false, false, 0);

            togLabel.connect('toggled', () => {
                if (!settings) return;
                settings.show_label = togLabel.get_active();
                refreshDisplayOptions();
            });
            togTime.connect('toggled', () => {
                if (!settings) return;
                settings.show_time = togTime.get_active();
                refreshDisplayOptions();
            });
            togProgress.connect('toggled', () => {
                if (!settings) return;
                settings.show_progress = togProgress.get_active();
                refreshDisplayOptions();
            });
            togEndTime.connect('toggled', () => {
                if (!settings) return;
                settings.show_endtime = togEndTime.get_active();
                refreshDisplayOptions();
            });

            const bottomBar = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8,
                halign: Gtk.Align.FILL,
            });
            bottomBar.get_style_context().add_class('toolbar');

            const btnNewTimer = new Gtk.Button({ label: 'New timer…' });
            GtkA11y.setName(btnNewTimer, 'New timer');
            btnNewTimer.connect('clicked', () => {
                if (this._application && this._application.activate_action) {
                    this._application.activate_action('newTimer', null);
                }
            });

            const btnStopAll = new Gtk.Button({ label: 'Stop all' });
            GtkA11y.setName(btnStopAll, 'Stop all running timers');
            btnStopAll.connect('clicked', () => {
                const timers = this._application && this._application._timers ? this._application._timers : null;
                if (!timers) return;
                try {
                    timers.sort_by_running().forEach(t => t.stop());
                } catch (e) {
                    log('taskTimer: stop all failed: ' + (e && e.message ? e.message : e));
                }
            });

            const btnTest10 = new Gtk.Button({ label: 'Start 10s test' });
            GtkA11y.setName(btnTest10, 'Start ten second test timer');
            btnTest10.connect('clicked', () => {
                if (this._application && typeof this._application.startSmokeTestTimer === 'function') {
                    this._application.startSmokeTestTimer();
                }
            });

            bottomBar.pack_start(btnNewTimer, false, false, 0);
            bottomBar.pack_start(btnStopAll, false, false, 0);
            bottomBar.pack_end(btnTest10, false, false, 0);

            main.pack_start(actionsBar, false, false, 0);
            main.pack_start(timerWidget, true, true, 0);
            main.pack_end(bottomBar, false, false, 0);

            paned.add1(sidebar);
            paned.add2(main);
            root.pack_start(paned, true, true, 0);

            mainVbox.pack_start(root, true, true, 0);

            // Keep references for refresh and for syncing display toggles with preferences.
            this._ui = {
                quickList: quickSection.list,
                presetList: presetSection.list,
                timerWidget,
                displayToggles: { togLabel, togTime, togProgress, togEndTime },
            };
            this._rebuildSidebarLists();
            this._startUiRefreshLoop();
            updateActionsState();

    }

    showMainWindow() {
        if (!this._window) {
            const settings = this._application && this._application._services
                ? this._application._services.settings
                : null;
            this._createStandaloneMainWindow(settings);
            const mainVbox = this._buildMainWindowBody(settings);

            this._window.add(mainVbox);

            // Startup notification (freedesktop.org): bind this window to the launcher
            // click so the session can track focus / “starting…” state. Completion is
            // signaled once via Gdk.notify_startup_complete() in _scheduleStartupNotificationComplete
            // (after present), so `--minimized` still clears the launcher busy state.
            const startupId = GLib.getenv('DESKTOP_STARTUP_ID');
            if (startupId && typeof this._window.set_startup_id === 'function') {
                try {
                    this._window.set_startup_id(startupId);
                } catch (e) {
                    log('taskTimer: set_startup_id failed: ' + (e && e.message ? e.message : e));
                }
            }
            if (typeof this._window.set_auto_startup_notification === 'function') {
                try {
                    this._window.set_auto_startup_notification(false);
                } catch (_e) {}
            }

            this._window.show_all();
            this._restoreWindowState();

            if (this._application._volumeWarningLow) {
                this.setVolumeWarning(true, this._application._volumeWarningLevel, this._application._volumeWarningMuted);
            }
        }

        this._syncDisplayOptionsFromSettings();
        this._tray.show();
        this._startTrayUpdates();
        this._window.present();
        if (!this._startupNotifyDone) {
            this._scheduleStartupNotificationComplete();
        }
    }

    _syncDisplayOptionsFromSettings() {
        const settings = this._application && this._application._services
            ? this._application._services.settings
            : null;
        if (!settings || !this._ui || !this._ui.displayToggles) return;
        const t = this._ui.displayToggles;
        try {
            if (t.togLabel) t.togLabel.set_active(Boolean(settings.show_label));
            if (t.togTime) t.togTime.set_active(Boolean(settings.show_time));
            if (t.togProgress) t.togProgress.set_active(Boolean(settings.show_progress));
            if (t.togEndTime) t.togEndTime.set_active(Boolean(settings.show_endtime));
        } catch (e) {}
    }

    hideMainWindow() {
        if (this._window) {
            this._saveWindowState();
            this._window.hide();
        }
    }

    _startTrayUpdates() {
        if (this._trayUpdateId) {
            return;
        }
        this._trayUpdateId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            // If platform/window was torn down, stop the periodic callback.
            if (!this._window) {
                this._trayUpdateId = null;
                return false;
            }
            this._updateTrayFromTimers();
            return true;
        });
        this._updateTrayFromTimers();
    }

    _updateTrayFromTimers() {
        const app = this._application;
        const timers = app && app._timers && typeof app._timers.sort_by_running === 'function'
            ? app._timers.sort_by_running()
            : [];

        if (!timers || timers.length === 0) {
            this._tray.setIcon(this.getIconName());
            this._tray.setTooltip(this.getDisplayName());
            return;
        }

        const next = timers[0];
        const hms = next.remaining_hms ? next.remaining_hms().toString(true) : '';
        const tip = hms ? `Next: ${next.name} (${hms})` : `Next: ${next.name}`;
        this._tray.setIcon('appointment-soon-symbolic');
        this._tray.setTooltip(tip);
    }

    get tray() {
        return this._tray;
    }

    get shortcuts() {
        return this._shortcuts;
    }

    get notifications() {
        return this._notifications;
    }

    get context() {
        return this._context;
    }
});

