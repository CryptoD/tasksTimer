/*
 * timers_core.js
 *
 * Core timer logic for taskTimer, decoupled from GNOME Shell-specific UI
 * APIs. This module intentionally avoids imports of St, Main, PopupMenu,
 * and volume/mixer modules. It focuses on:
 *
 *  - Timer math and state transitions
 *  - Persistence of timer state
 *  - Notification and inhibition via injected services
 */

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const { GLib } = imports.gi;

const Utils = Me.imports.utils;
const Logger = Me.imports.logger.Logger;
const HMS = Me.imports.hms.HMS;
const AlarmTimer = Me.imports.alarm_timer.AlarmTimer;
const Storage = Me.imports.storage.Storage;

// Localized strings; fall back to identity in environments without gettext.
let _ = s => s;
try {
    const Gettext = imports.gettext.domain('tasktimer');
    _ = Gettext.gettext;
} catch (e) {
    // leave _ as a no-op in non-localized runtimes
}

const DEFAULT_DATA_DIR = GLib.build_filenamev([GLib.get_user_data_dir(), 'tasktimer']);
const DEFAULT_TIMERS_FILE = 'timers.json';

function _timersPathFor(timers) {
    const services = timers && timers._services ? timers._services : {};
    if (services.storage && services.storage.timersPath) {
        return services.storage.timersPath;
    }
    const dataDir = services.dataDir || DEFAULT_DATA_DIR;
    return GLib.build_filenamev([dataDir, DEFAULT_TIMERS_FILE]);
}

function saveAllTimersCore(timers) {
    const timersData = timers.map(timer => (typeof timer.toJSON === 'function' ? timer.toJSON() : timer));
    const path = _timersPathFor(timers);
    Storage.saveJSON(path, timersData);
}

function loadAllTimersCore(TimerCore) {
    const path = _timersPathFor(null);
    const timersData = Storage.loadJSON(path);
    if (!timersData) return [];

    return timersData.map(timerData => {
        if (typeof timerData === 'object' && timerData !== null) {
            return TimerCore.fromJSON(timerData);
        }
        return timerData;
    });
}

var TimerState = {
    INIT: 0,
    RESET: 1,
    RUNNING: 2,
    EXPIRED: 3,
};

var TimersCore = class TimersCore extends Array {
    /**
     * @param {Object} services - Injected services used by the core:
     *   - settings: Settings instance
     *   - notifier: object with notify(timer, text, fmt, ...args)
     *   - inhibitor: object with inhibit_timer(timer) / uninhibit(id)
     *   - logger: optional Logger instance
     */
    constructor(services) {
        super();

        this._services = services || {};
        this._settings = this._services.settings;
        this._notifier = this._services.notifier;
        this._inhibitor = this._services.inhibitor;
        this.logger = this._services.logger || new Logger('kt timers-core', this._settings);

        this._lookup = {};
        this.warn_volume = true;
    }

    get settings() {
        return this._settings;
    }

    get notifier() {
        return this._notifier;
    }

    get inhibitor() {
        return this._inhibitor;
    }

    refreshFrom(settingsTimers) {
        settingsTimers.forEach(settings_timer => {
            const id = settings_timer.id;
            let timer = this.lookup(id);
            if (timer) {
                timer.refresh_with(settings_timer);
                this.logger.debug(
                    'Found %s timer [%s]: %s',
                    timer.quick ? 'quick' : 'preset',
                    timer.name,
                    timer.running ? 'running' : 'not running'
                );
            } else {
                timer = TimerCore.fromSettingsTimer(this, settings_timer);
                settings_timer.id = timer.id;
                this.add(timer);
            }
        });
    }

    saveRunningTimers() {
        const running = [];
        this.sort_by_running().forEach(timer => {
            if (timer.running) {
                this.logger.debug(
                    'Saving running timer state id=%s start=%d end=%d',
                    timer.id,
                    timer._start,
                    timer._end
                );
                const run_state = {
                    id: timer.id,
                    start: timer._start,
                    end: timer._end,
                    persist: timer.persist_alarm,
                };
                if (timer.alarm_timer) {
                    run_state.alarm_timer = timer.alarm_timer.save();
                }
                running.push(run_state);
            }
        });
        this.settings.running = JSON.stringify(running);
    }

    restoreRunningTimers() {
        const run_states = this.settings.run_states;
        if (!run_states || run_states.length === 0) {
            this.logger.debug('No running timers to restore');
            return;
        }

        for (const run_state of run_states) {
            const timer = this.lookup(run_state.id);
            if (!timer) {
                this.logger.warn(
                    'Timer with id %s not found during restoreRunningTimers.',
                    run_state.id
                );
                continue;
            }

            timer.persist_alarm = run_state.persist;
            if (timer.alarm_timer) {
                timer.alarm_timer = AlarmTimer.restore(run_state.alarm_timer);
            }

            const now = Date.now();
            timer._start = run_state.start;
            timer._end = run_state.end || timer._start + timer.duration_ms();

            if (timer._end > now) {
                timer._interval_id = Utils.setInterval(timer.timer_callback, timer._interval_ms, timer);
                timer._state = TimerState.RUNNING;

                if (this.inhibitor && typeof this.inhibitor.inhibit_timer === 'function') {
                    this.inhibitor.inhibit_timer(timer);
                }

                this.logger.debug(
                    'Restored timer: %s, remaining: %d seconds',
                    timer.toString(),
                    Math.round((timer._end - now) / 1000)
                );
            } else {
                const tdiff = now - timer._end;
                timer.expired = true;
                timer._state = TimerState.EXPIRED;

                if (this.notifier) {
                    const reason = _("Timer completed %s late at").format(
                        new HMS(tdiff / 1000).toString(true)
                    );
                    const time = new Date(now).toLocaleTimeString();
                    const text = '%s due at %s'.format(timer.name, timer.end_time());
                    this.notifier.notify(timer, text, '%s %s', reason, time);
                }

                this.logger.debug(
                    'Timer expired during downtime: %s, was late by %d seconds',
                    timer.toString(),
                    Math.round(tdiff / 1000)
                );
            }
        }
    }

    lookup(id) {
        if (!id) return undefined;
        if (this._lookup[id] !== undefined) {
            return this._lookup[id];
        }
        for (let i = 0; i < this.length; i++) {
            const t = this[i];
            if (t.id === id) {
                this._lookup[id] = t;
                return t;
            }
        }
        return undefined;
    }

    isEmpty() {
        return this.length === 0;
    }

    get sort_by_duration() {
        return this.settings.sort_by_duration;
    }

    get sort_descending() {
        return this.settings.sort_descending;
    }

    sorted(params = { running: true }) {
        let timers_array = [...this];
        if (!params.running) {
            timers_array = timers_array.filter(timer => !timer.running);
        }
        if (this.sort_by_duration) {
            const direction = this.sort_descending ? -1 : 1;
            timers_array.sort((a, b) => (a.duration - b.duration) * direction);
        }
        return timers_array.filter(timer => timer.enabled || timer.quick);
    }

    sort_by_running() {
        const running_timers = [...this].filter(timer => timer.running);
        return running_timers.sort((a, b) => a._end - b._end);
    }

    add(timer) {
        if (!timer.quick && timer.name.length === 0) {
            this.logger.warn('Refusing to create unnamed preset timer');
            return false;
        }
        if (timer.duration <= 0) {
            this.logger.warn('Refusing to create zero length timer %s', timer.name);
            return false;
        }

        this.logger.info(
            'Adding timer [%s] of duration %d seconds [%s], quick=%s',
            timer.name,
            timer.duration,
            timer.id,
            timer.quick
        );
        this.push(timer);
        this._lookup[timer.id] = timer;
        return true;
    }
};

var TimerCore = class TimerCore {
    constructor(timersCore, name, duration_secs, id = undefined) {
        this._timersCore = timersCore;

        const debug = timersCore && timersCore.settings
            ? timersCore.settings.debug
            : false;
        this._enabled = true;
        this._quick = false;
        this._interval_ms = debug ? 500 : 250;
        this._duration_secs = duration_secs;
        this._state = TimerState.INIT;
        this._id = Utils.uuid(id);
        this._start = 0;
        this._end = 0;
        this._persist_alarm = false;
        this._interval_id = undefined;

        this._alarm_timer = AlarmTimer.matchRegex(name);
        if (this._alarm_timer) {
            this._alarm_timer.debug = timersCore.settings;
        }

        this.name = name;
        this.logger = new Logger(`kt timer-core: ${this.name}`, timersCore.settings);
        this.logger.info('Create timer [%s] duration=[%d]', this.name, duration_secs);
    }

    get timers() {
        return this._timersCore;
    }

    get id() {
        return this._id;
    }

    get enabled() {
        return this._enabled;
    }

    set enabled(bool) {
        this._enabled = bool;
    }

    get quick() {
        return this._quick;
    }

    set quick(bool) {
        this._quick = bool;
    }

    get name() {
        return this._name;
    }

    set name(name) {
        const hms = new HMS(this.duration);
        this._name = name.length > 0 ? name : hms.toName();
        this._has_name = this._name !== hms.toName();
    }

    get has_name() {
        return this._has_name;
    }

    get duration() {
        if (this.alarm_timer) {
            const hms = this.alarm_timer.hms();
            return hms.toSeconds();
        }
        return this._duration_secs;
    }

    set duration(duration) {
        this._duration_secs = duration;
    }

    duration_ms() {
        return this.duration * 1000;
    }

    get alarm_timer() {
        return this._alarm_timer;
    }

    set alarm_timer(val) {
        this._alarm_timer = val;
    }

    get persist_alarm() {
        return this._persist_alarm;
    }

    set persist_alarm(b) {
        this._persist_alarm = b === undefined ? false : b;
        this.timers.saveRunningTimers();
    }

    toggle_persist_alarm() {
        this.persist_alarm = !this.persist_alarm;
    }

    get running() {
        return this._state === TimerState.RUNNING;
    }

    get expired() {
        return this._state === TimerState.EXPIRED;
    }

    get reset() {
        return this._state === TimerState.RESET;
    }

    set running(bool) {
        if (bool) this._state = TimerState.RUNNING;
    }

    set expired(bool) {
        if (bool) this._state = TimerState.EXPIRED;
    }

    set reset(bool) {
        if (bool) this._state = TimerState.RESET;
    }

    toString() {
        return `[${this._name}:${this._id}] state=${this._state} start=${this._start} end=${this._end} dur=${this._duration_secs} iid=${this._interval_id}`;
    }

    end_time() {
        return new Date(this._end).toLocaleTimeString();
    }

    remaining_hms(now = undefined) {
        let delta;
        if (this.running) {
            if (now === undefined) now = Date.now();
            if (this.alarm_timer) {
                this._end = this.alarm_timer.end();
            }
            delta = Math.ceil((this._end - now) / 1000);
        } else {
            delta = this.duration;
        }
        return new HMS(delta < 0 ? 0 : delta);
    }

    stop_callback(now) {
        let tdiff = now - this._end;
        const early = tdiff < 0;
        const late = tdiff > 2000;

        if (early) {
            this.reset = true;
            tdiff = -tdiff;
        } else {
            this.expired = true;
        }

        this.logger.info(
            'Timer has ended %s: state=%d',
            early ? 'early' : late ? 'late' : 'on time',
            this._state
        );
        Utils.clearInterval(this._interval_id);
        this._interval_id = undefined;

        if (this.timers.notifier) {
            const stdiff = early || late ? new HMS(tdiff / 1000).toString(true) : '';
            let reason;
            let text = '%s due at %s'.format(this.name, this.end_time());
            if (early) {
                reason = _('Timer stopped %s early at').format(stdiff);
            } else if (late) {
                reason = _('Timer completed %s late at').format(stdiff);
            } else {
                text = this.name;
                saveAllTimersCore(this.timers);
                reason = _('Timer completed on time at');
            }
            const time = new Date(now).toLocaleTimeString();
            this.timers.notifier.notify(this, text, '%s %s', reason, time);
        }

        this.timers.saveRunningTimers();
        saveAllTimersCore(this.timers);

        return false;
    }

    timer_callback(timer) {
        const now = Date.now();
        const end = timer._end;

        if (now > end) {
            timer.expired = true;
        }
        if (timer.expired || timer.reset) {
            return timer.stop_callback(now);
        }

        if (timer.timers.inhibitor && typeof timer.timers.inhibitor.inhibit_timer === 'function') {
            timer.timers.inhibitor.inhibit_timer(timer);
        }

        const hms = timer.remaining_hms(now);
        // Core does not manipulate UI elements; higher-level presenters
        // can observe timer state and update labels/icons as needed.

        if (now % 30000 < timer._interval_ms) {
            saveAllTimersCore(timer.timers);
        }

        return true;
    }

    stop() {
        this.reset = true;
        this.uninhibit();
    }

    start() {
        if (this._enabled || this._quick) {
            if (this.running) {
                this.logger.info('Timer is already running, resetting');
                this.reset = true;
                return false;
            }
            return this.go();
        }
        this.logger.info('Timer is disabled');
        return false;
    }

    snooze(secs) {
        let dt = Date.now() - this._end;
        if (this.alarm_timer) {
            this.alarm_timer.snooze(secs);
            this._end = this.alarm_timer.end() + dt;
        } else {
            dt += secs * 1000;
            this._start += dt;
            this._end += dt;
        }
        this.go(this._start, this._end);
    }

    go(start = undefined, end = undefined) {
        let action;
        if (start === undefined) {
            this._start = Date.now();
            action = 'Starting';
        } else {
            this._start = start;
            action = 'Restarting';
        }

        this._end = end === undefined ? this._start + this.duration_ms() : end;
        this._state = TimerState.RUNNING;

        if (this.timers.inhibitor && typeof this.timers.inhibitor.inhibit_timer === 'function') {
            this.timers.inhibitor.inhibit_timer(this);
        }

        this.timers.saveRunningTimers();
        saveAllTimersCore(this.timers);

        const quick = this._quick ? ' quick ' : ' ';
        this.logger.info('%s%stimer at %d', action, quick, this._start);

        this._interval_id = Utils.setInterval(this.timer_callback, this._interval_ms, this);

        return true;
    }

    static fromSettingsTimer(timersCore, settings_timer) {
        const timer = new TimerCore(timersCore, settings_timer.name, settings_timer.duration, settings_timer.id);
        timer._quick = settings_timer.quick;
        settings_timer.id = timer.id;
        return timer;
    }

    static fromJSON(timerData) {
        const timersCore = null; // caller should supply a real TimersCore if needed
        const timer = new TimerCore(timersCore, timerData.name, timerData.duration_secs, timerData.id);
        timer._quick = timerData.quick || false;
        timer._state = timerData.state || TimerState.INIT;
        timer._start = timerData.start || 0;
        timer._end = timerData.end || 0;
        timer._persist_alarm = timerData.persist_alarm || false;

        if (timerData.alarm_timer) {
            timer._alarm_timer = AlarmTimer.restore(timerData.alarm_timer);
        }

        return timer;
    }

    refresh_with(settings_timer) {
        if (settings_timer.id === this.id) {
            this._name = settings_timer.name;
            this._enabled = settings_timer.enabled;
            this._duration_secs = settings_timer.duration;
            this._quick = settings_timer.quick;
            if (this._alarm_timer === undefined) {
                this._alarm_timer = AlarmTimer.matchRegex(this._name);
            }
            if (this._alarm_timer && this.running) {
                this._end = this._alarm_timer.end();
            }
            return true;
        }
        return false;
    }

    toJSON() {
        const timerData = {
            id: this._id,
            name: this._name,
            duration_secs: this._duration_secs,
            quick: this._quick,
            state: this._state,
            start: this._start,
            end: this._end,
            persist_alarm: this._persist_alarm,
        };

        if (this._alarm_timer) {
            timerData.alarm_timer = this._alarm_timer.save();
        }

        return timerData;
    }

    uninhibit() {
        if (this.timers.inhibitor && typeof this.timers.inhibitor.uninhibit === 'function') {
            this.timers.inhibitor.uninhibit(this.id);
        }
    }
};

var exports = {
    TimersCore,
    TimerCore,
    TimerState,
    saveAllTimersCore,
    loadAllTimersCore,
};

