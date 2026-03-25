// TEST 12: Edge conditions — no audio device, no notification daemon, read-only
// config, missing/corrupt JSON. Run from repo root:
//   gjs tests/test12_edge_conditions.js
//
// Pass: exits 0 and prints "TEST 12 edge conditions: pass".
// Uses subprocesses so config.js resolves paths after XDG_CONFIG_HOME is set.

imports.searchPath.unshift('.');

const { GLib, Gio } = imports.gi;

function assert(cond, msg) {
    if (!cond) {
        throw new Error('ASSERT FAILED: ' + msg);
    }
}

function rmTree(path) {
    const f = Gio.File.new_for_path(path);
    if (!f.query_exists(null)) {
        return;
    }
    try {
        f.delete(null);
    } catch (_e) {
        try {
            const children = f.enumerate_children('standard::name', 0, null);
            let info;
            while ((info = children.next_file(null)) !== null) {
                const child = f.get_child(info.get_name());
                rmTree(child.get_path());
            }
            f.delete(null);
        } catch (_e2) {}
    }
}

function runGjsScenario(mode, tmpForConfig, expectStderrSubstring) {
    const cwd = GLib.get_current_dir();
    const gjsPath = GLib.find_program_in_path('gjs');
    const script = GLib.build_filenamev([cwd, 'tests', 'test12_config_scenarios.js']);
    assert(gjsPath && Gio.File.new_for_path(script).query_exists(null), 'gjs and scenario script required');

    const argv = [gjsPath, script, mode];
    if (tmpForConfig !== null && tmpForConfig !== undefined) {
        argv.push(tmpForConfig);
    }

    const [ok, _out, err, status] = GLib.spawn_sync(cwd, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
    const stderr = err ? new TextDecoder('utf-8').decode(err) : '';
    const stdout = _out ? new TextDecoder('utf-8').decode(_out) : '';
    if (!ok || status !== 0) {
        throw new Error(`scenario ${mode} failed (status=${status}): ${stdout} ${stderr}`);
    }
    if (expectStderrSubstring && stderr.indexOf(expectStderrSubstring) < 0) {
        throw new Error(`scenario ${mode}: expected stderr to contain "${expectStderrSubstring}"; got:\n${stderr}`);
    }
    if (stdout.indexOf('TEST12 scenario OK') < 0) {
        throw new Error(`scenario ${mode}: missing OK line in stdout:\n${stdout}`);
    }
}

function testMissingConfig() {
    const cwd = GLib.get_current_dir();
    const tmp = GLib.build_filenamev([cwd, 'tests', '.tmp-test12-missing-' + GLib.uuid_string_random()]);
    GLib.mkdir_with_parents(tmp, 0o700);
    try {
        runGjsScenario('missing_config', tmp, 'no configuration file');
    } finally {
        rmTree(tmp);
    }
}

function testCorruptConfig() {
    const cwd = GLib.get_current_dir();
    const tmp = GLib.build_filenamev([cwd, 'tests', '.tmp-test12-corrupt-' + GLib.uuid_string_random()]);
    GLib.mkdir_with_parents(tmp, 0o700);
    try {
        runGjsScenario('corrupt_config', tmp, 'invalid or unreadable configuration');
    } finally {
        rmTree(tmp);
    }
}

function testReadonlyConfig() {
    const cwd = GLib.get_current_dir();
    const tmp = GLib.build_filenamev([cwd, 'tests', '.tmp-test12-ro-' + GLib.uuid_string_random()]);
    GLib.mkdir_with_parents(tmp, 0o700);
    try {
        runGjsScenario('readonly_config', tmp, 'failed to write config file');
    } finally {
        rmTree(tmp);
    }
}

function testNotificationFallback() {
    const cwd = GLib.get_current_dir();
    runGjsScenario('notification_fallback', '_unused_', 'send_notification failed');
}

function testTimersStorage() {
    const cwd = GLib.get_current_dir();
    const tmp = GLib.build_filenamev([cwd, 'tests', '.tmp-test12-st-' + GLib.uuid_string_random()]);
    GLib.mkdir_with_parents(tmp, 0o700);
    try {
        runGjsScenario('timers_missing', tmp, null);
        runGjsScenario('timers_corrupt', tmp, 'failed to load JSON');
    } finally {
        rmTree(tmp);
    }
}

testMissingConfig();
testCorruptConfig();
testReadonlyConfig();
testNotificationFallback();
testTimersStorage();

print('TEST 12 edge conditions: pass');
