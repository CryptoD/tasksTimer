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

const APP_ID = 'org.cryptod.tasktimer';

var TaskTimerApplication = GObject.registerClass(
class TaskTimerApplication extends Gtk.Application {
    _init() {
        super._init({
            application_id: APP_ID,
            flags: Gio.ApplicationFlags.HANDLES_COMMAND_LINE,
        });
    }

    vfunc_startup() {
        // Place one-time application initialization here.
        // This runs before the first window is shown and is the right place
        // to initialize shared services (timers, storage, settings, etc.)
        // in future phases.
        super.vfunc_startup();
        log('taskTimer: application startup');
    }

    vfunc_activate() {
        if (!this._window) {
            this._window = new Gtk.ApplicationWindow({
                application: this,
                title: 'taskTimer',
                default_width: 480,
                default_height: 320,
            });

            const label = new Gtk.Label({
                label: 'taskTimer GTK application (WIP)',
                margin_top: 24,
                margin_bottom: 24,
                margin_start: 24,
                margin_end: 24,
            });

            this._window.add(label);
            this._window.show_all();
        }

        this._window.present();
    }

    vfunc_shutdown() {
        // This method is called once when the application is exiting.
        // Use it to flush state (e.g. save timers) and clean up resources.
        //
        // Future work: integrate with the shared timer manager and invoke a
        // "save all timers" operation here so that standalone runs can
        // persist their state similarly to the GNOME Shell extension.
        if (this._window) {
            this._window.destroy();
            this._window = null;
        }

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

