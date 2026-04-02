// TEST 13: Periodic timers.json save must be throttled globally (not once per running timer).
//
// Run from repo root:
//   gjs tests/test13_performance_throttle.js
//
// Pass: prints "TEST 13 performance throttle: pass".

imports.searchPath.unshift('.');

const TimersCoreModule = imports['taskTimer@CryptoD'].timers_core;
const TimerCore = TimersCoreModule.TimerCore;
const TimersCore = TimersCoreModule.TimersCore;

function assert(cond, msg) {
    if (!cond) {
        throw new Error('ASSERT FAILED: ' + msg);
    }
}

function testMaybePeriodicSaveTimersFile() {
    let saveCount = 0;
    const services = {
        settings: {
            debug: false,
            sort_by_duration: false,
            sort_descending: false,
            sort_by_name: false,
            detect_dupes: false,
            running: '[]',
            get run_states() {
                try {
                    return JSON.parse(this.running || '[]');
                } catch (e) {
                    return [];
                }
            },
        },
        notifier: { notify() {} },
        storage: {
            timersPath: '/tmp/tasktimer-test13-no-write.json',
            saveJSON(_path, _data) {
                saveCount++;
            },
            loadJSON() {
                return null;
            },
        },
        logger: {
            debug() {},
            info() {},
            warn() {},
        },
    };

    const core = new TimersCore(services);

    // Simulate 40 running timers each ticking at the same wall time (worst case).
    const nTimers = 40;
    const wallTimes = [1000, 5000, 29999, 30000, 30001, 60000];
    for (const nowMs of wallTimes) {
        for (let i = 0; i < nTimers; i++) {
            core.maybePeriodicSaveTimersFile(nowMs);
        }
    }

    // Without global throttle, old logic could fire many writes per wall window.
    // Expect one save at 30000 and one at 60000 only.
    assert(saveCount === 2, `expected 2 periodic saves, got ${saveCount}`);
}

function testTimerTicksDoNotMultiplySaves() {
    let saveCount = 0;
    const services = {
        settings: {
            debug: false,
            sort_by_duration: false,
            sort_descending: false,
            sort_by_name: false,
            detect_dupes: false,
            running: '[]',
            get run_states() {
                try {
                    return JSON.parse(this.running || '[]');
                } catch (e) {
                    return [];
                }
            },
        },
        notifier: { notify() {} },
        storage: {
            timersPath: '/tmp/tasktimer-test13-ticks.json',
            saveJSON(_path, _data) {
                saveCount++;
            },
            loadJSON() {
                return null;
            },
        },
        logger: {
            debug() {},
            info() {},
            warn() {},
        },
    };

    const core = new TimersCore(services);
    const t1 = new TimerCore(core, 'A', 3600);
    const t2 = new TimerCore(core, 'B', 3600);
    core.add(t1);
    core.add(t2);
    t1._state = TimersCoreModule.TimerState.RUNNING;
    t2._state = TimersCoreModule.TimerState.RUNNING;
    const wall = Date.now();
    t1._start = wall;
    t1._end = wall + 3600000;
    t2._start = wall;
    t2._end = wall + 3600000;

    t1.timer_callback(t1);
    t2.timer_callback(t2);

    assert(saveCount === 1, `expected 1 save from two callbacks at same now, got ${saveCount}`);
}

testMaybePeriodicSaveTimersFile();
testTimerTicksDoNotMultiplySaves();

print('TEST 13 performance throttle: pass');
