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

const { Gio, GLib, GObject, Gtk, Gdk } = imports.gi;

// Ensure the directory containing this script (and its submodules) is in the
// GJS search path so that standalone modules like `context` and `platform/*`
// can be imported when running `gjs main.js` directly.
imports.searchPath.unshift(GLib.get_current_dir());

// Some shared modules still rely on GNOME Shell's JS runtime modules
// (e.g. `imports.misc.extensionUtils`). When GNOME Shell is installed, make
// those modules discoverable for plain `gjs main.js` runs.
try {
    imports.searchPath.unshift('/usr/share/gnome-shell/js');
} catch (e) {
    // ignore; standalone builds may not have GNOME Shell installed
}

const Context = imports.context;
const Standalone = imports.platform.standalone.gtk_platform;

// Standalone gettext initialization for the "tasktimer" domain. This avoids
// relying on ExtensionUtils.initTranslations() so the CLI/GTK app can locate
// translations when run outside GNOME Shell (including AppImage bundles).
let _ = s => s;
try {
    const I18n = imports.i18n;
    const domain = I18n.init('tasktimer');
    _ = domain.gettext;
} catch (e) {
    // If anything goes wrong, leave _ as an identity function.
}

const ExtSettings = imports['taskTimer@CryptoD'].settings;
const TimersCoreModule = imports['taskTimer@CryptoD'].timers_core;
const TimerServicesModule = imports['taskTimer@CryptoD'].timer_services;
const StorageModule = imports['taskTimer@CryptoD'].storage;
const Logger = imports['taskTimer@CryptoD'].logger.Logger;
const AudioManagerModule = imports['taskTimer@CryptoD'].audio_manager;

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
        // Stop any active alarm sound for this timer when user dismisses it.
        if (app._services.audio) {
            app._services.audio.stopTimerAlarm(timerId);
        }
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
        if (app._services.audio) {
            app._services.audio.stopTimerAlarm(timerId);
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
        if (app._services.audio) {
            app._services.audio.stopTimerAlarm(timerId);
        }
        if (app._platform && app._platform.notifications) {
            app._platform.notifications.close(timerId);
        }
    });
    app.add_action(snoozeAction);
}

/**
 * Apply theme variant from settings (default / light / dark) to the GTK
 * application and install the app-specific CSS provider.
 *
 * - default (index 0): respect system theme, do not force dark or light
 * - light   (index 1): force light theme
 * - dark    (index 2): prefer dark theme
 */
function _applyThemeAndCss(app) {
    try {
        const settings = app._services && app._services.settings;
        const gtkSettings = Gtk.Settings.get_default();
        if (settings && gtkSettings) {
            let variant = 'system';
            try {
                variant = (settings.theme_variant || 'system').toLowerCase();
            } catch (_e) {
                variant = 'system';
            }
            try {
                if (variant === 'dark') {
                    gtkSettings.gtk_application_prefer_dark_theme = true;
                } else if (variant === 'light') {
                    gtkSettings.gtk_application_prefer_dark_theme = false;
                } else {
                    // "system" / "default": do not override
                }
            } catch (_e) {
                // ignore theme property errors
            }
        }

        // Load app-specific CSS
        try {
            const cssPath = GLib.build_filenamev([GLib.get_current_dir(), 'platform', 'standalone', 'app.css']);
            const provider = new Gtk.CssProvider();
            provider.load_from_path(cssPath);
            try {
                const display = Gdk.Display.get_default();
                if (display && Gtk.StyleContext.add_provider_for_display) {
                    Gtk.StyleContext.add_provider_for_display(display, provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
                } else {
                    const screen = Gdk.Screen.get_default();
                    if (screen && Gtk.StyleContext.add_provider_for_screen) {
                        Gtk.StyleContext.add_provider_for_screen(screen, provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
                    }
                }
            } catch (_e) {
                // ignore CSS provider registration errors
            }
        } catch (_e) {
            // ignore CSS load errors
        }
    } catch (_e) {
        // swallow everything; theme is non-critical
    }
}

/** Same message key as extension (notifier/timers) for volume warning. */
const VOLUME_LOW_MSG = 'volume level is low for running timer: %d %%';

/**
 * Register in-app keyboard shortcuts with the platform's ShortcutProvider when
 * accel_enable is true and accelerator strings are set. Call once after _timers
 * and _platform are initialized (TEST 5).
 */
function _registerShortcuts(app) {
    if (!app._platform || !app._platform.shortcuts || !app._services.settings) {
        return;
    }
    const settings = app._services.settings;
    const provider = app._platform.shortcuts;
    if (!settings.accel_enable) {
        return;
    }
    const showEndtime = (settings.accel_show_endtime || '').trim();
    const stopNext = (settings.accel_stop_next || '').trim();
    if (showEndtime) {
        provider.register(showEndtime, () => {
            const next = !settings.show_endtime;
            settings.show_endtime = next;
            log('taskTimer: shortcut toggled show_endtime to ' + next);
        });
    }
    if (stopNext) {
        provider.register(stopNext, () => {
            const running = app._timers && app._timers.sort_by_running();
            const next = running && running[0];
            if (next) {
                next.stop();
                log('taskTimer: shortcut stopped next timer: ' + next.name);
            }
        });
    }
}

/**
 * Add app.preferences action (Ctrl+,) and optional UI trigger. Opens the
 * preferences dialog in a separate window when run from standalone (TEST 5).
 */
function _addPreferencesAction(app) {
    const prefsAction = Gio.SimpleAction.new('preferences', null);
    prefsAction.connect('activate', () => {
        if (!app._services.settings) {
            return;
        }
        const PrefsWin = imports.platform.standalone.preferences_window;
        const transient = app._platform && app._platform._window ? app._platform._window : null;
        const win = new PrefsWin.PreferencesWindow(app, { transient_for: transient });
        win.present();
    });
    app.add_action(prefsAction);
    app.set_accels_for_action('app.preferences', ['<Primary>comma']);
}

/**
 * Add app.newTimer action used by tray and future UI.
 * Opens a small dialog to create and start a quick timer.
 */
function _addNewTimerAction(app) {
    const action = Gio.SimpleAction.new('newTimer', null);
    action.connect('activate', () => {
        if (!app._platform) {
            return;
        }
        app._platform.showMainWindow();

        const dialog = new Gtk.Dialog({ title: 'New timer', modal: true });
        if (app._platform._window) {
            dialog.set_transient_for(app._platform._window);
        }
        dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);
        dialog.add_button('Start', Gtk.ResponseType.OK);

        const box = dialog.get_content_area();
        const grid = new Gtk.Grid({ row_spacing: 8, column_spacing: 8, margin: 12 });

        const nameLabel = new Gtk.Label({ label: 'Name', halign: Gtk.Align.START });
        const nameEntry = new Gtk.Entry({ hexpand: true });
        nameEntry.set_text('Timer');

        const minutesLabel = new Gtk.Label({ label: 'Minutes', halign: Gtk.Align.START });
        const minutes = new Gtk.SpinButton({ adjustment: new Gtk.Adjustment({ lower: 0, upper: 999, step_increment: 1 }), numeric: true });
        minutes.set_value(5);

        const secondsLabel = new Gtk.Label({ label: 'Seconds', halign: Gtk.Align.START });
        const seconds = new Gtk.SpinButton({ adjustment: new Gtk.Adjustment({ lower: 0, upper: 59, step_increment: 1 }), numeric: true });
        seconds.set_value(0);

        grid.attach(nameLabel, 0, 0, 1, 1);
        grid.attach(nameEntry, 1, 0, 1, 1);
        grid.attach(minutesLabel, 0, 1, 1, 1);
        grid.attach(minutes, 1, 1, 1, 1);
        grid.attach(secondsLabel, 0, 2, 1, 1);
        grid.attach(seconds, 1, 2, 1, 1);

        box.add(grid);
        dialog.show_all();

        dialog.connect('response', (_d, responseId) => {
            if (responseId === Gtk.ResponseType.OK && app._timers) {
                const total = (minutes.get_value_as_int() * 60) + seconds.get_value_as_int();
                const nm = (nameEntry.get_text() || 'Timer').trim();
                if (total > 0) {
                    const TimerCore = TimersCoreModule.TimerCore;
                    const timer = new TimerCore(app._timers, nm, total);
                    timer.quick = true;
                    const result = typeof app._timers.add_check_dupes === 'function' ? app._timers.add_check_dupes(timer) : (app._timers.add(timer) ? timer : undefined);
                    if (result === timer) {
                        timer.start();
                    } else if (result !== undefined && app._platform && typeof app._platform._showInAppBanner === 'function') {
                        app._platform._showInAppBanner('Duplicate timer', 'A timer with this name and duration already exists.');
                    }
                }
            }
            dialog.destroy();
        });
    });
    app.add_action(action);
}

/**
 * If Gvc is available, connect to default sink volume/muted and call notifier.warning
 * when volume is below settings.volume_threshold and a timer is running (same semantics as extension).
 *
 * @param {Gtk.Application} app - TaskTimerApplication with _timers, _services.settings.
 * @param {Object} notifier - notifier with warning(timer, text, fmt, ...args).
 */
function _setupVolumeWarning(app, notifier) {
    if (!app._timers || !notifier || typeof notifier.warning !== 'function') {
        return;
    }
    app._volumeWarned = false;
    app._volumeWarningLow = false;
    app._volumeWarningLevel = 0;
    app._volumeWarningMuted = false;

    let Gvc = null;
    let mixerControl = null;
    try {
        const GIRepository = imports.gi.GIRepository;
        if (GIRepository.Repository.prepend_search_path) {
            GIRepository.Repository.prepend_search_path('/usr/lib/gnome-shell');
        }
        if (GIRepository.Repository.prepend_library_path) {
            GIRepository.Repository.prepend_library_path('/usr/lib/gnome-shell');
        }
        Gvc = imports.gi.Gvc;
        mixerControl = new Gvc.MixerControl({ name: 'taskTimer' });
        mixerControl.open();
    } catch (e) {
        log('taskTimer: volume warning unavailable (Gvc not used): ' + e.message);
        return;
    }

    function checkVolume() {
        if (!app._services.settings) {
            return;
        }
        const stream = mixerControl.get_default_sink();
        if (!stream) {
            if (app._platform && typeof app._platform.setVolumeWarning === 'function') {
                app._platform.setVolumeWarning(false);
            }
            return;
        }
        const max = mixerControl.get_vol_max_norm();
        const level = max > 0 ? Math.floor(stream.volume * 100 / max) : 0;
        const muted = stream.is_muted;
        const threshold = app._services.settings.volume_threshold || 0;
        const warnEnabled = app._services.settings.play_sound && app._services.settings.volume_level_warn;

        if (!warnEnabled) {
            if (app._platform && typeof app._platform.setVolumeWarning === 'function') {
                app._platform.setVolumeWarning(false);
            }
            return;
        }

        if (muted || level < threshold) {
            app._volumeWarningLow = true;
            app._volumeWarningLevel = level;
            app._volumeWarningMuted = muted;
            const running = app._timers.sort_by_running();
            if (running.length > 0 && !app._volumeWarned) {
                app._volumeWarned = true;
                const timer = running[0];
                notifier.warning(timer, timer.name, VOLUME_LOW_MSG, level);
            }
            if (app._platform && typeof app._platform.setVolumeWarning === 'function') {
                app._platform.setVolumeWarning(true, level, muted);
            }
        } else {
            app._volumeWarned = false;
            app._volumeWarningLow = false;
            if (app._platform && typeof app._platform.setVolumeWarning === 'function') {
                app._platform.setVolumeWarning(false);
            }
        }
    }

    try {
        const stream = mixerControl.get_default_sink();
        if (stream) {
            stream.connect('notify::volume', checkVolume);
            stream.connect('notify::is-muted', checkVolume);
            checkVolume();
        }
    } catch (e) {
        log('taskTimer: volume monitor connect failed: ' + e.message);
    }
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
        this._testNotification = false; // Set by --test-notification for TEST 6.
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

        // Shared audio manager for timer alarm sounds in standalone mode.
        this._services.audio = new AudioManagerModule.AudioManager({
            settings: this._services.settings,
            logger: new Logger('kt audio', this._services.settings),
        });

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
        // NotificationProvider while keeping their existing notify() / warning() shape.
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

                // Trigger alarm sound playback when a timer completes, honoring
                // user settings (play_sound, sound_loops, persist_alarm).
                if (this._services.audio && timer) {
                    this._services.audio.playTimerAlarm(timer);
                }
            },
            // Same semantics as extension notifier.warning: "Timer Warning: <name>" + formatted body.
            warning: (timer, text, fmt, ...args) => {
                const notifications = this._platform ? this._platform.notifications : null;
                if (!notifications) {
                    return;
                }

                const id = timer && timer.id ? `warning-${timer.id}` : 'warning-timer';
                const title = 'Timer Warning: ' + (text || (timer && timer.name) || '');
                const body = fmt && typeof fmt.format === 'function'
                    ? fmt.format(...args)
                    : (fmt ? String(fmt) : '');

                notifications.notify(id, title, body, { timerId: timer && timer.id ? String(timer.id) : undefined });
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

        // Load preset/quick timers from settings and restore any running state.
        try {
            const settingsTimers = this._services.settings.unpack_timers();
            this._timers.refreshFrom(settingsTimers);
            this._timers.restoreRunningTimers();
        } catch (e) {
            log('taskTimer: failed to load timers from settings: ' + (e && e.message ? e.message : e));
        }

        // Apply theme variant and app CSS once services/settings are ready.
        _applyThemeAndCss(this);
        this._reapplyTheme = () => _applyThemeAndCss(this);

        _addTimerNotificationActions(this);
        _setupVolumeWarning(this, coreNotifier);
        _registerShortcuts(this);
        _addPreferencesAction(this);
        _addNewTimerAction(this);

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
            if (this._testNotification) {
                this._sendTestNotification();
                this._testNotification = false;
            }
        }
    }

    _sendTestNotification() {
        if (!this._platform || !this._platform.notifications) {
            return;
        }
        this._platform.notifications.notify(
            'test-notification',
            'Test notification',
            'If you see this, notifications work. Use "Test in-app banner" button or TASKTIMER_FORCE_INAPP_NOTIFICATIONS=1 to test the in-app banner.',
            { timerId: 'test-id' }
        );
    }

    /** For TEST 6: show in-app banner only (simulates no notification daemon). */
    testInAppBanner() {
        if (!this._platform || !this._platform.notifications) {
            return;
        }
        this._platform.notifications.notify(
            'test-inapp',
            'In-app banner test',
            'This is the fallback banner when system notifications are unavailable.',
            { forceInApp: true }
        );
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
        // --test-notification: show one test notification (for TEST 6).
        if (args.indexOf('--test-notification') >= 0) {
            this._testNotification = true;
        }
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

