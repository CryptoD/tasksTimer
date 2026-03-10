/*
 * StandaloneGtkPlatform
 *
 * PlatformUI implementation for the standalone GTK application.
 *
 * Responsibilities:
 *  - Manage the main GTK window lifecycle (show/hide).
 *  - Expose placeholder TrayProvider, ShortcutProvider, and NotificationProvider
 *    instances that will be fleshed out in later phases.
 *  - Bridge between the Gtk.Application (TaskTimerApplication) and the shared
 *    Context object created at startup.
 */

imports.gi.versions.Gtk = '3.0';

const { GObject, Gtk } = imports.gi;

const Context = imports.context;
const Platform = imports.platform.interface;

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

var StandaloneNotificationProvider = class StandaloneNotificationProvider extends Platform.NotificationProvider {
    constructor(application) {
        super();
        this._application = application;
    }

    notify(id, title, body, _options = {}) {
        // Temporary smoke-test implementation: just log notifications so
        // we can verify that core timer abstractions are calling through.
        log(`Standalone notification [${id}]: ${title} — ${body}`);
    }

    close(_id) {
        // Placeholder.
    }
};

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
        this._notifications = new StandaloneNotificationProvider(this._application);

        this._window = null;
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

            const vbox = new Gtk.Box({
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

            vbox.add(label);
            vbox.add(button);

            this._window.add(vbox);
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

