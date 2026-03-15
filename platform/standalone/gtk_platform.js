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

const { GObject, Gtk, GLib, Pango, Gdk } = imports.gi;

const Context = imports.context;
const Platform = imports.platform.interface;
const GioNotification = imports.platform.standalone.notification_gio;
const GtkShortcuts = imports.platform.standalone.shortcuts_gtk;
const TimerMenuWidgetModule = imports.platform.standalone.timer_menu_widget;
const PresetManagementWindowModule = imports.platform.standalone.preset_management_window;

const TimersCoreModule = imports['taskTimer@CryptoD'].timers_core;

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

        this._tray = new StandaloneTrayProvider(this);
        this._shortcuts = new StandaloneShortcutProvider(this._application);
        this._notifications = new StandaloneNotificationProvider(this._application, {
            fallback: (id, title, body) => this._showInAppBanner(title, body),
        });

        this._window = null;
        this._bannerRevealer = null;
        this._bannerLabel = null;
        this._bannerTimeoutId = null;
        this._trayUpdateId = null;
        this._presetManagementWindow = null;
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
            title: 'taskTimer',
            show_close_button: true,
        });

        const btnNew = new Gtk.Button({ label: 'New' });
        btnNew.connect('clicked', () => {
            if (this._application && this._application.activate_action) {
                this._application.activate_action('newTimer', null);
            }
        });
        hb.pack_start(btnNew);

        const btnPrefs = new Gtk.Button({ label: 'Preferences' });
        btnPrefs.connect('clicked', () => {
            if (this._application && this._application.activate_action) {
                this._application.activate_action('preferences', null);
            }
        });
        hb.pack_end(btnPrefs);

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

        const secondary = new Gtk.Label({
            label: this._formatTimerSecondary(timer),
            halign: Gtk.Align.START,
            xalign: 0,
        });
        secondary.get_style_context().add_class('dim-label');

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
        }

        outer.pack_start(textBox, true, true, 0);
        outer.pack_start(controls, false, false, 0);
        row.add(outer);

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
        this._uiUpdateId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            try {
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

    showMainWindow() {
        if (!this._window) {
            this._window = new Gtk.ApplicationWindow({
                application: this._application,
                title: 'taskTimer',
                default_width: 900,
                default_height: 560,
            });
            this._addHeaderBar(this._window);

            // When enabled, closing or minimizing the window hides it and keeps the
            // app running in the tray (if a tray backend is available).
            this._window.connect('delete-event', () => {
                const settings = this._application && this._application._services
                    ? this._application._services.settings
                    : null;
                if (settings && settings.minimize_to_tray) {
                    this.hideMainWindow();
                    return true; // prevent destroy/quit
                }
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
            bannerClose.connect('clicked', () => this._hideInAppBanner());

            bannerBox.add(bannerLabel);
            bannerBox.add(bannerClose);
            bannerRevealer.add(bannerBox);
            mainVbox.pack_start(bannerRevealer, false, false, 0);

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

            const settings = this._application && this._application._services
                ? this._application._services.settings
                : null;

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

            const grid = new Gtk.Grid({ column_spacing: 8, row_spacing: 8 });
            const adjMin = new Gtk.Adjustment({ lower: 0, upper: 999, step_increment: 1 });
            const adjSec = new Gtk.Adjustment({ lower: 0, upper: 59, step_increment: 1 });
            const spinMin = new Gtk.SpinButton({ adjustment: adjMin, numeric: true });
            const spinSec = new Gtk.SpinButton({ adjustment: adjSec, numeric: true });
            spinMin.set_value(5);
            spinSec.set_value(0);

            grid.attach(new Gtk.Label({ label: 'Minutes', halign: Gtk.Align.START }), 0, 0, 1, 1);
            grid.attach(spinMin, 1, 0, 1, 1);
            grid.attach(new Gtk.Label({ label: 'Seconds', halign: Gtk.Align.START }), 0, 1, 1, 1);
            grid.attach(spinSec, 1, 1, 1, 1);

            const btnStart = new Gtk.Button({ label: 'Start' });
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
                    const settings = this._application._services ? this._application._services.settings : null;
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

            const actionsBar = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            actionsBar.get_style_context().add_class('toolbar');

            const mkIconBtn = (iconName, tooltip) => {
                const img = Gtk.Image.new_from_icon_name(iconName, Gtk.IconSize.BUTTON);
                const btn = new Gtk.Button({ image: img, relief: Gtk.ReliefStyle.NONE });
                if (tooltip) btn.set_tooltip_text(tooltip);
                return btn;
            };

            const mkIconToggle = (iconName, tooltip) => {
                const img = Gtk.Image.new_from_icon_name(iconName, Gtk.IconSize.BUTTON);
                const btn = new Gtk.ToggleButton({ image: img, relief: Gtk.ReliefStyle.NONE });
                if (tooltip) btn.set_tooltip_text(tooltip);
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
            btnNewTimer.connect('clicked', () => {
                if (this._application && this._application.activate_action) {
                    this._application.activate_action('newTimer', null);
                }
            });

            const btnStopAll = new Gtk.Button({ label: 'Stop all' });
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

            this._window.add(mainVbox);
            this._window.show_all();
        }

        this._syncDisplayOptionsFromSettings();
        this._tray.show();
        this._startTrayUpdates();
        this._window.present();
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
            this._window.hide();
        }
    }

    _startTrayUpdates() {
        if (this._trayUpdateId) {
            return;
        }
        this._trayUpdateId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
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
            this._tray.setIcon('alarm-symbolic');
            this._tray.setTooltip('taskTimer');
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

