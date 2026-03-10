#!/usr/bin/gjs

/*
 * taskTimer standalone GTK application entry point.
 *
 * This file is intended to become the primary entry point for running
 * taskTimer as a standalone GTK application instead of a GNOME Shell
 * extension. It currently provides a minimal GtkApplication skeleton,
 * command-line argument handling, and a placeholder window.
 *
 * Future phases are expected to:
 * - Wire this application into the shared timer logic (timers, storage, etc.).
 * - Replace GNOME Shell-specific UI pieces with GTK widgets.
 * - Extend command-line handling to support operations like starting
 *   timers directly from the CLI.
 */

imports.gi.versions.Gtk = '3.0';

const { Gio, GLib, GObject, Gtk } = imports.gi;

// Ensure the directory containing this script (and its submodules) is in the
// GJS search path so that standalone modules like `context` and `platform/*`
// can be imported when running `gjs main.js` directly.
imports.searchPath.unshift(GLib.get_current_dir());

const Context = imports.context;
const Standalone = imports.platform.standalone.gtk_platform;

const ExtSettings = imports['taskTimer@CryptoD'].settings;
const TimersCoreModule = imports['taskTimer@CryptoD'].timers_core;
const TimerServicesModule = imports['taskTimer@CryptoD'].timer_services;
const StorageModule = imports['taskTimer@CryptoD'].storage;
const Logger = imports['taskTimer@CryptoD'].logger.Logger;

const APP_ID = 'com.github.cryptod.tasktimer';

/** Action IDs used by Gio.Notification buttons; must match names registered on GApplication. */
const TIMER_ACTION_DISMISS = 'timerDismiss';
const TIMER_ACTION_RESTART = 'timerRestart';
const TIMER_ACTION_SNOOZE = 'timerSnooze';

/**
 * Register GActions for timer notification actions (dismiss, restart, snooze).
 * Notifications use app.timerDismiss::<id>, app.timerRestart::<id>, app.timerSnooze::<id>:<secs>.
 *
 * @param {Gtk.Application} app - TaskTimerApplication instance (must have _timers and _platform).
 */
function _addTimerNotificationActions(app) {
    const stringType = new GLib.VariantType('s');

    const dismissAction = Gio.SimpleAction.new(TIMER_ACTION_DISMISS, stringType);
    dismissAction.connect('activate', (_action, param) => {
        const timerId = param.get_string()[0];
        if (app._platform && app._platform.notifications) {
            app._platform.notifications.close(timerId);
        }
    });
    app.add_action(dismissAction);

    const restartAction = Gio.SimpleAction.new(TIMER_ACTION_RESTART, stringType);
    restartAction.connect('activate', (_action, param) => {
        const timerId = param.get_string()[0];
        const timer = app._timers && app._timers.lookup(timerId);
        if (timer) {
            timer.start();
        }
        if (app._platform && app._platform.notifications) {
            app._platform.notifications.close(timerId);
        }
    });
    app.add_action(restartAction);

    const snoozeAction = Gio.SimpleAction.new(TIMER_ACTION_SNOOZE, stringType);
    snoozeAction.connect('activate', (_action, param) => {
        const target = param.get_string()[0];
        const colon = target.indexOf(':');
        const timerId = colon >= 0 ? target.substring(0, colon) : target;
        const secs = colon >= 0 ? parseInt(target.substring(colon + 1), 10) : 30;
        const timer = app._timers && app._timers.lookup(timerId);
        if (timer && !isNaN(secs) && secs > 0) {
            timer.snooze(secs);
        }
        if (app._platform && app._platform.notifications) {
            app._platform.notifications.close(timerId);
        }
    });
    app.add_action(snoozeAction);
}

var TaskTimerApplication = GObject.registerClass(
class TaskTimerApplication extends Gtk.Application {
    _init() {
        super._init({
            application_id: APP_ID,
            flags: Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
        });

        // Placeholders for future shared services; these will be
        // initialized properly in vfunc_startup() in later phases.
        this._context = null;       // Will hold environment-specific paths, metadata, config provider, etc.
        this._timers = null;        // Will be the shared Timers manager instance.
        this._services = Object.create(null); // Generic bag for other shared services (notifier, inhibitor, tray, etc.).
        this._platform = null;      // Will be the active PlatformUI implementation (StandaloneGtkPlatform).
    }

    vfunc_startup() {
        // Place one-time application initialization here.
        // This runs before the first window is shown and is the right place
        // to initialize shared services (timers, storage, settings, etc.)
        // in future phases.
        super.vfunc_startup();

        // Initialize the standalone Context so that other modules can
        // discover application metadata and common paths (config/data/logs)
        // without re-calculating them.
        this._context = new Context.StandaloneContext({
            appId: APP_ID,
            application: this,
        });

        // Create a Settings instance backed by the standalone JSON
        // configuration provider so that the standalone app and the
        // extension share the same Settings API.
        this._services.settings = new ExtSettings.Settings(this._context.configProvider);

        // Create the standalone GTK platform implementation that will own
        // the main window and (in later phases) tray, shortcuts, and
        // notifications. This keeps UI wiring separate from core logic.
        this._platform = new Standalone.StandaloneGtkPlatform({
            application: this,
            context: this._context,
            appId: APP_ID,
        });
        this._platform.init();

        // Core timer services and TimersCore instance
        const TimerServices = TimerServicesModule.TimerServices;
        const TimersCore = TimersCoreModule.TimersCore;

        // Adapter that lets TimersCore/TimerCore use the platform's
        // NotificationProvider while keeping their existing notify() shape.
        const coreNotifier = {
            notify: (timer, text, fmt, ...args) => {
                const notifications = this._platform ? this._platform.notifications : null;
                if (!notifications) {
                    return;
                }

                const id = timer && timer.id ? String(timer.id) : 'timer';
                const title = text;
                const body = fmt && typeof fmt.format === 'function'
                    ? fmt.format(...args)
                    : (fmt ? String(fmt) : '');

                notifications.notify(id, title, body, { timerId: id });
            },
        };

        // JSON-backed storage: timers file lives under the standalone dataDir.
        const timersPath = GLib.build_filenamev([this._context.dataDir, 'timers.json']);

        const services = new TimerServices({
            settings: this._services.settings,
            notifier: coreNotifier,
            // No inhibitor wiring for now; can be added later.
            logger: new Logger('kt standalone timers-core', this._services.settings),
            storage: {
                timersPath,
                saveJSON: StorageModule.saveJSON,
                loadJSON: StorageModule.loadJSON,
            },
        });

        this._timers = new TimersCore(services);
        this._services.timers = this._timers;

        _addTimerNotificationActions(this);

        log('taskTimer: application startup');
    }

    startSmokeTestTimer() {
        if (!this._timers) {
            log('taskTimer: TimersCore not initialized; cannot start smoke-test timer');
            return;
        }

        const TimerCore = TimersCoreModule.TimerCore;
        const timer = new TimerCore(this._timers, 'Smoke test 10s', 10);
        timer.quick = true;

        // Add to the shared TimersCore so it participates in persistence.
        if (this._timers.add(timer)) {
            log('taskTimer: starting 10-second smoke-test timer');
            timer.start();
        } else {
            log('taskTimer: failed to add smoke-test timer (invalid configuration)');
        }
    }

    vfunc_activate() {
        // Delegate activation to the platform implementation so that all
        // window management goes through a single surface.
        log('taskTimer: application activate');
        if (this._platform) {
            this._platform.showMainWindow();
        }
    }

    vfunc_shutdown() {
        // This method is called once when the application is exiting.
        // Use it to flush state (e.g. save timers) and clean up resources.
        //
        // Future work: integrate with the shared timer manager and invoke a
        // "save all timers" operation here so that standalone runs can
        // persist their state similarly to the GNOME Shell extension.
        log('taskTimer: application shutdown');
        super.vfunc_shutdown();
    }

    vfunc_command_line(commandLine) {
        // Raw arguments as provided by Gio.Application.
        const argv = commandLine.get_arguments();

        // Drop the program name (argv[0]) for downstream consumers.
        const args = Array.prototype.slice.call(argv, 1);

        this._handleCommandLine(args);
        this.activate();

        // Returning 0 signals successful handling.
        return 0;
    }

    _handleCommandLine(args) {
        // Placeholder implementation for now: just log arguments.
        //
        // Future developers can extend this method to support flags such as:
        //   --start-timer 25m "Write report"
        //   --list-timers
        //   --stop-all
        //
        // This keeps all CLI behavior centralized and testable.
        if (args.length > 0) {
            log(`taskTimer CLI arguments: ${JSON.stringify(args)}`);
        }
    }
});

function main(argv) {
    const app = new TaskTimerApplication();
    return app.run(argv);
}

main(ARGV);

