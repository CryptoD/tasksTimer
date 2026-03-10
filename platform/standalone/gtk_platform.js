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

    // PlatformUI-like API

    init() {
        // No-op for now; main window is created on demand in showMainWindow().
    }

    showMainWindow() {
        if (!this._window) {
            this._window = new Gtk.ApplicationWindow({
                application: this._application,
                title: 'taskTimer',
                default_width: 480,
                default_height: 320,
            });

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

            const contentVbox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 12,
                margin_top: 24,
                margin_bottom: 24,
                margin_start: 24,
                margin_end: 24,
            });

            const label = new Gtk.Label({
                label: 'taskTimer GTK application (standalone platform WIP)',
                halign: Gtk.Align.START,
            });

            const button = new Gtk.Button({
                label: 'Start 10-second test timer',
                halign: Gtk.Align.START,
            });

            button.connect('clicked', () => {
                if (this._application && typeof this._application.startSmokeTestTimer === 'function') {
                    this._application.startSmokeTestTimer();
                }
            });

            const btnTestNotif = new Gtk.Button({
                label: 'Send test notification',
                halign: Gtk.Align.START,
            });
            btnTestNotif.connect('clicked', () => {
                if (this._application && typeof this._application._sendTestNotification === 'function') {
                    this._application._sendTestNotification();
                }
            });

            const btnInApp = new Gtk.Button({
                label: 'Test in-app banner',
                halign: Gtk.Align.START,
            });
            btnInApp.connect('clicked', () => {
                if (this._application && typeof this._application.testInAppBanner === 'function') {
                    this._application.testInAppBanner();
                }
            });

            const btnPrefs = new Gtk.Button({
                label: 'Preferences…',
                halign: Gtk.Align.START,
            });
            btnPrefs.connect('clicked', () => {
                if (this._application && this._application.activate_action) {
                    this._application.activate_action('preferences', null);
                }
            });

            contentVbox.add(label);
            contentVbox.add(button);
            contentVbox.add(btnTestNotif);
            contentVbox.add(btnInApp);
            contentVbox.add(btnPrefs);
            mainVbox.pack_start(contentVbox, true, true, 0);

            this._window.add(mainVbox);
            this._window.show_all();
        }

        this._tray.show();
        this._startTrayUpdates();
        this._window.present();
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

