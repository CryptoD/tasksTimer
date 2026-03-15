// TEST 10 (advanced features): sorting and duplicate detection
//
// Headless smoke test for sorted(), get_dupe(), add_check_dupes().
// Run from repo root:
//   gjs tests/test10_advanced_smoke.js
//
// Pass: exits 0 and prints "TEST 10 advanced smoke: pass".

imports.searchPath.unshift('.');

const { GLib } = imports.gi;
const TimersCoreModule = imports['taskTimer@CryptoD'].timers_core;
const StorageModule = imports['taskTimer@CryptoD'].storage;

function assert(cond, msg) {
    if (!cond) {
        throw new Error('ASSERT FAILED: ' + msg);
    }
}

class SettingsStub {
    constructor(opts = {}) {
        this.debug = false;
        this.sort_by_duration = opts.sort_by_duration || false;
        this.sort_by_name = opts.sort_by_name || false;
        this.sort_descending = opts.sort_descending || false;
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

// detect_dupes for duplicate-protection tests
function makeTimers(detectDupes = true) {
    const settings = new SettingsStub();
    settings.detect_dupes = detectDupes;
    const timersPath = GLib.build_filenamev([GLib.get_tmp_dir(), `tasktimer-test10-${GLib.uuid_string_random()}.json`]);
    return new TimersCoreModule.TimersCore({
        settings,
        notifier: null,
        inhibitor: null,
        storage: {
            timersPath,
            saveJSON: (StorageModule.saveJSON || (StorageModule.StorageModule && StorageModule.StorageModule.saveJSON)) || (() => {}),
            loadJSON: (StorageModule.loadJSON || (StorageModule.StorageModule && StorageModule.StorageModule.loadJSON)) || (() => []),
        },
    });
}

const TimerCore = TimersCoreModule.TimerCore;

// ---- Sorting ----
function testSorting() {
    const settings = new SettingsStub();
    const timersPath = GLib.build_filenamev([GLib.get_tmp_dir(), `tasktimer-test10-sort-${GLib.uuid_string_random()}.json`]);
    const timers = new TimersCoreModule.TimersCore({
        settings,
        notifier: null,
        inhibitor: null,
        storage: { timersPath, saveJSON: () => {}, loadJSON: () => [] },
    });

    const t5 = new TimerCore(timers, 'Five', 300);
    const t1 = new TimerCore(timers, 'One', 60);
    const t25 = new TimerCore(timers, 'TwentyFive', 1500);
    t5.quick = true;
    t1.quick = true;
    t25.quick = true;
    assert(timers.add(t5) && timers.add(t1) && timers.add(t25), 'add three quick timers');

    let list = timers.sorted({ running: false });
    assert(list.length >= 3, 'sorted returns list');
    const namesDefault = list.map(t => t.name);
    const durationsDefault = list.map(t => t.duration);

    settings.sort_by_duration = true;
    settings.sort_descending = false;
    list = timers.sorted({ running: false });
    const durationsAsc = list.map(t => t.duration);
    assert(durationsAsc[0] <= durationsAsc[durationsAsc.length - 1], 'sort by duration ascending');

    settings.sort_descending = true;
    list = timers.sorted({ running: false });
    const durationsDesc = list.map(t => t.duration);
    assert(durationsDesc[0] >= durationsDesc[durationsDesc.length - 1], 'sort by duration descending');

    settings.sort_by_duration = false;
    settings.sort_by_name = true;
    settings.sort_descending = false;
    list = timers.sorted({ running: false });
    const namesAsc = list.map(t => t.name.toLowerCase());
    for (let i = 1; i < namesAsc.length; i++) {
        assert(namesAsc[i] >= namesAsc[i - 1], 'sort by name ascending');
    }

    settings.sort_descending = true;
    list = timers.sorted({ running: false });
    const namesDesc = list.map(t => t.name.toLowerCase());
    for (let i = 1; i < namesDesc.length; i++) {
        assert(namesDesc[i] <= namesDesc[i - 1], 'sort by name descending');
    }
}

// ---- Duplicate protection ----
function testDuplicateProtection() {
    const timers = makeTimers(true);
    const a = new TimerCore(timers, 'Same', 120);
    a.quick = true;
    assert(timers.add(a), 'add first');
    const b = new TimerCore(timers, 'Same', 120);
    b.quick = true;
    const dupe = timers.get_dupe(b);
    assert(dupe === a, 'get_dupe finds existing timer with same name/duration/quick');
    const result = timers.add_check_dupes(b);
    assert(result === a, 'add_check_dupes returns existing timer when duplicate');
    assert(timers.length === 1, 'no second timer added');
    const c = new TimerCore(timers, 'Other', 120);
    c.quick = true;
    const added = timers.add_check_dupes(c);
    assert(added === c, 'add_check_dupes returns new timer when not duplicate');
    assert(timers.length === 2, 'second timer added');
}

function testDuplicateDisabled() {
    const timers = makeTimers(false);
    const a = new TimerCore(timers, 'Same', 120);
    a.quick = true;
    assert(timers.add(a), 'add first');
    assert(timers.get_dupe(a) === undefined, 'get_dupe returns undefined when detect_dupes off');
    const b = new TimerCore(timers, 'Same', 120);
    b.quick = true;
    const result = timers.add_check_dupes(b);
    assert(result === b, 'add_check_dupes returns new timer when detect_dupes off');
    assert(timers.length === 2, 'duplicate allowed when detect_dupes off');
}

function testPresetVsQuickNoDupe() {
    const timers = makeTimers(true);
    const preset = new TimerCore(timers, 'Pizza', 900);
    preset.quick = false;
    const quick = new TimerCore(timers, 'Pizza', 900);
    quick.quick = true;
    assert(timers.add_check_dupes(preset) === preset, 'add preset');
    assert(timers.add_check_dupes(quick) === quick, 'add quick with same name/duration is not dupe (different quick flag)');
    assert(timers.length === 2, 'preset and quick coexist');
}

// ---- Run ----
testSorting();
testDuplicateProtection();
testDuplicateDisabled();
testPresetVsQuickNoDupe();

print('TEST 10 advanced smoke: pass');
