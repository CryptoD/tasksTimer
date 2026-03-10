/*
 * StandaloneGtkPlatform
 *
 * PlatformUI implementation for the standalone GTK application.
 *
 * Responsibilities:
 *  - Manage the main GTK window lifecycle (show/hide).
 *  - Expose TrayProvider, ShortcutProvider, and NotificationProvider (Gio-based
 *    desktop notifications via platform/standalone/notification_gio.js).
 *  - Bridge between the Gtk.Application (TaskTimerApplication) and the shared
 *    Context object created at startup.
 */

imports.gi.versions.Gtk = '3.0';

const { GObject, Gtk, GLib, Pango } = imports.gi;

const Context = imports.context;
const Platform = imports.platform.interface;
const GioNotification = imports.platform.standalone.notification_gio;

var StandaloneTrayProvider = class StandaloneTrayProvider extends Platform.TrayProvider {
    show() {
        // Placeholder: no tray icon yet.
    }

    hide() {
        // Placeholder: no tray icon yet.
    }

    setIcon(_icon) {
        // Placeholder: no tray icon yet.
    }

    setTooltip(_text) {
        // Placeholder: no tray icon yet.
    }

    setMenu(_menuModel) {
        // Placeholder: no tray context menu yet.
    }
};

var StandaloneShortcutProvider = class StandaloneShortcutProvider extends Platform.ShortcutProvider {
    constructor(application) {
        super();
        this._application = application;
        this._callbacks = new Map();
    }

    register(_accelerator, _callback) {
        // Placeholder: keyboard shortcuts will be implemented in a later phase.
    }

    unregister(_accelerator) {
        // Placeholder.
    }

    clear() {
        // Placeholder.
        this._callbacks.clear();
    }
};

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

        this._tray = new StandaloneTrayProvider();
        this._shortcuts = new StandaloneShortcutProvider(this._application);
        this._notifications = new StandaloneNotificationProvider(this._application, {
            fallback: (id, title, body) => this._showInAppBanner(title, body),
        });

        this._window = null;
        this._bannerRevealer = null;
        this._bannerLabel = null;
        this._bannerTimeoutId = null;
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

            contentVbox.add(label);
            contentVbox.add(button);
            mainVbox.pack_start(contentVbox, true, true, 0);

            this._window.add(mainVbox);
            this._window.show_all();
        }

        this._window.present();
    }

    hideMainWindow() {
        if (this._window) {
            this._window.hide();
        }
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

