// TEST 3 (core): add/start/snooze/pause/resume/stop/delete/reorder
//
// This is a headless smoke test for the standalone-friendly timer core.
// Run:
//   gjs tests/test3_core_interactions.js

imports.searchPath.unshift('.');

const TimersCoreModule = imports['taskTimer@CryptoD'].timers_core;

function assert(cond, msg) {
    if (!cond) {
        throw new Error('ASSERT FAILED: ' + msg);
    }
}

// Minimal settings stub used by TimersCore.
class SettingsStub {
    constructor() {
        this.debug = false;
        this.sort_by_duration = false;
        this.sort_descending = false;
        this.show_endtime = false;
        this.show_label = true;
        this.show_time = true;
        this.show_progress = false;
        this._running = '[]';
    }
    get running() { return this._running; }
    set running(v) { this._running = String(v); }
    get run_states() {
        try { return JSON.parse(this._running || '[]'); } catch (e) { return []; }
    }
}

const settings = new SettingsStub();
const timers = new TimersCoreModule.TimersCore({ settings, notifier: null, inhibitor: null });
const TimerCore = TimersCoreModule.TimerCore;

// Add timers
const a = new TimerCore(timers, 'A preset', 5);
a.quick = false;
const b = new TimerCore(timers, 'B preset', 5);
b.quick = false;
const q1 = new TimerCore(timers, 'Q1', 5);
q1.quick = true;
const q2 = new TimerCore(timers, 'Q2', 5);
q2.quick = true;

assert(timers.add(a), 'add preset a');
assert(timers.add(b), 'add preset b');
assert(timers.add(q1), 'add quick q1');
assert(timers.add(q2), 'add quick q2');

// Start + snooze + pause/resume
assert(a.start() === true, 'start a');
assert(a.running, 'a is running');
assert(typeof a.snooze === 'function', 'snooze exists');
a.snooze(30);
assert(a.running, 'a still running after snooze');

assert(typeof a.pause === 'function', 'pause exists');
assert(a.pause() === true, 'pause a');
assert(a.paused, 'a paused');
const rem1 = a.remaining_hms().toSeconds();
assert(rem1 > 0, 'remaining while paused');

assert(a.resume() === true, 'resume a');
assert(a.running, 'a running after resume');

// Reset
assert(typeof a.resetTimer === 'function', 'resetTimer exists');
assert(a.resetTimer() === true, 'resetTimer a');
assert(!a.running && !a.paused, 'a not running after reset');

// Delete (remove) and reorder
assert(timers.remove(q2) === true, 'remove q2');
assert(timers.indexOf(q2) === -1, 'q2 removed from array');

// Reorder presets: swap a and b within preset eligible set.
const before = timers.filter(t => !t.quick).map(t => t.name).join(',');
assert(timers.moveWithin(b, -1, t => !t.quick), 'move preset b up');
const after = timers.filter(t => !t.quick).map(t => t.name).join(',');
assert(before !== after, 'preset order changed');

print('TEST 3 core smoke test: OK');

