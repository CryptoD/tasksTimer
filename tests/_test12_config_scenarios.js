// Subprocess scenarios for tests/test12_edge_conditions.js — do not run alone without argv.
// Prefixed _ so tests/test*.js (make test) does not execute this file directly.
// Each run must use a fresh gjs process so imports.config picks up XDG_CONFIG_HOME.

imports.gi.versions.Gtk = '3.0';

const { GLib, Gio } = imports.gi;

const mode = ARGV[0];
const tmpRoot = ARGV[1];

function fail(msg) {
    printerr('TEST12 scenario FAIL: ' + msg);
    imports.system.exit(1);
}

function ok(msg) {
    print('TEST12 scenario OK: ' + msg);
    imports.system.exit(0);
}

const repoRoot = GLib.path_get_dirname(GLib.path_get_dirname(imports.system.programPath));
imports.searchPath.unshift(repoRoot);

if (mode === 'notification_fallback') {
    const Prov = imports.platform.standalone.notification_gio;
    let called = false;
    const app = {
        send_notification() {
            throw new Error('simulated: no notification daemon');
        },
        withdraw_notification() {},
    };
    const n = new Prov.GioNotificationProvider(app, {
        fallback() {
            called = true;
        },
    });
    n.notify('edge-test', 'Title', 'Body', {});
    if (!called) {
        fail('fallback not invoked when send_notification throws');
    }
    ok('notification_fallback');
}

if (mode === 'timers_missing') {
    const StorageModule = imports['taskTimer@CryptoD'].storage;
    const path = GLib.build_filenamev([tmpRoot, 'nope', 'timers.json']);
    const r = StorageModule.loadJSON(path);
    if (r !== null) {
        fail('loadJSON missing file should return null');
    }
    ok('timers_missing');
}

if (mode === 'timers_corrupt') {
    const StorageModule = imports['taskTimer@CryptoD'].storage;
    const path = GLib.build_filenamev([tmpRoot, 'timers.json']);
    GLib.mkdir_with_parents(GLib.path_get_dirname(path), 0o755);
    GLib.file_set_contents(path, '{ not valid json');
    const r = StorageModule.loadJSON(path);
    if (r !== null) {
        fail('loadJSON corrupt file should return null');
    }
    ok('timers_corrupt');
}

if (!tmpRoot || tmpRoot.length === 0) {
    fail('tmpRoot required for mode ' + mode);
}

GLib.setenv('XDG_CONFIG_HOME', tmpRoot, true);

if (mode === 'missing_config') {
    const cfgPath = GLib.build_filenamev([tmpRoot, 'tasktimer', 'config.json']);
    if (GLib.file_test(cfgPath, GLib.FileTest.EXISTS)) {
        fail('missing_config expects no config.json at ' + cfgPath);
    }
    const Config = imports.config;
    const p = new Config.JSONSettingsProvider();
    if (p.get_boolean('debug') !== false) {
        fail('expected default debug=false');
    }
    ok('missing_config');
}

if (mode === 'corrupt_config') {
    const taskDir = GLib.build_filenamev([tmpRoot, 'tasktimer']);
    GLib.mkdir_with_parents(taskDir, 0o755);
    const cfgPath = GLib.build_filenamev([taskDir, 'config.json']);
    GLib.file_set_contents(cfgPath, '{ "version": 1, broken');
    const Config = imports.config;
    const p = new Config.JSONSettingsProvider();
    if (p.get_int('window-width') !== 900) {
        fail('expected schema default window-width 900 after corrupt file');
    }
    ok('corrupt_config');
}

if (mode === 'readonly_config') {
    const taskDir = GLib.build_filenamev([tmpRoot, 'tasktimer']);
    GLib.mkdir_with_parents(taskDir, 0o755);
    const cfgPath = GLib.build_filenamev([taskDir, 'config.json']);
    GLib.file_set_contents(cfgPath, '{"version":1}');
    const chmodOk = GLib.spawn_sync(null, ['chmod', '555', taskDir], null, GLib.SpawnFlags.SEARCH_PATH, null);
    if (!chmodOk[0]) {
        fail('chmod 555 failed');
    }
    const Config = imports.config;
    const p = new Config.JSONSettingsProvider();
    p.set_boolean('debug', true);
    const [, contents] = Gio.File.new_for_path(cfgPath).load_contents(null);
    const text = new TextDecoder('utf-8').decode(contents);
    if (text.indexOf('"debug": true') >= 0 || text.indexOf('"debug":true') >= 0) {
        fail('config should not have persisted debug=true on read-only dir');
    }
    const chmodFix = GLib.spawn_sync(null, ['chmod', '755', taskDir], null, GLib.SpawnFlags.SEARCH_PATH, null);
    if (!chmodFix[0]) {
        printerr('TEST12 warn: chmod 755 cleanup failed');
    }
    ok('readonly_config');
}

fail('unknown mode: ' + mode);
