/*
 * timer_services.js
 *
 * Lightweight descriptor for the services that core timer logic depends on.
 * This is not a strict type system feature, but a shared convention that
 * clarifies what TimersCore/TimerCore expect to receive via constructor
 * injection instead of importing GNOME Shell-specific modules directly.
 *
 * Expected properties:
 *   - settings:   Settings instance
 *   - notifier:   object with notify(timer, text, fmt, ...args) and optional
 *                 warning(timer, text, fmt, ...args) for e.g. volume-level warnings
 *   - inhibitor:  object with inhibit_timer(timer) / uninhibit(id)
 *   - logger:     optional Logger instance
 *   - storage:    optional storage helper (if not using the default JSON path)
 *   - volumeMonitor: optional object for volume-level checks (standalone or shell)
 */

var TimerServices = class TimerServices {
    constructor(params = {}) {
        this.settings = params.settings || null;
        this.notifier = params.notifier || null;
        this.inhibitor = params.inhibitor || null;
        this.logger = params.logger || null;
        this.storage = params.storage || null;
        this.volumeMonitor = params.volumeMonitor || null;
    }
};
