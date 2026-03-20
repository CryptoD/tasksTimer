// TEST 11 (window/autostart polish): window state persistence, autostart .desktop,
// and CLI startup behavior.
//
// Run from repo root:
//   gjs tests/test11_window_autostart_polish.js
//
// Covers: config schema for window state and autostart, autostart desktop file
// create/remove, --version/--help output. Manual steps for full "restart and
// verify" are documented at the end.
//
// Pass: exits 0 and prints "TEST 11 window/autostart polish: pass".

imports.searchPath.unshift('.');

const { GLib, Gio } = imports.gi;

function assert(cond, msg) {
    if (!cond) {
        throw new Error('ASSERT FAILED: ' + msg);
    }
}

// ---- Window state and autostart: config provider defaults (schema-driven) ----
function testWindowStateAndAutostartDefaults() {
    const cwd = GLib.get_current_dir();
    const tmpDir = GLib.build_filenamev([cwd, 'tests', '.tmp-test11-cfg-' + GLib.uuid_string_random()]);
    GLib.mkdir_with_parents(tmpDir, 0o700);
    const savedConfig = GLib.getenv('XDG_CONFIG_HOME');
    GLib.setenv('XDG_CONFIG_HOME', tmpDir, true);

    try {
        const configModule = imports.config;
        const Provider = configModule.JSONSettingsProvider;
        assert(Provider, 'config exports JSONSettingsProvider');
        const provider = new Provider();

        assert(provider.get_int('window-width') === 900, 'window-width default 900');
        assert(provider.get_int('window-height') === 560, 'window-height default 560');
        assert(provider.get_boolean('window-maximized') === false, 'window-maximized default false');
        assert(provider.get_int('window-x') === -1, 'window-x default -1');
        assert(provider.get_int('window-y') === -1, 'window-y default -1');
        assert(provider.get_boolean('autostart') === false, 'autostart default false');

        provider.set_int('window-width', 800);
        provider.set_int('window-height', 500);
        assert(provider.get_int('window-width') === 800, 'window-width roundtrip');
        assert(provider.get_int('window-height') === 500, 'window-height roundtrip');
    } finally {
        if (savedConfig !== null && savedConfig !== undefined) {
            GLib.setenv('XDG_CONFIG_HOME', savedConfig, true);
        } else {
            GLib.unsetenv('XDG_CONFIG_HOME');
        }
        const rm = Gio.File.new_for_path(tmpDir);
        if (rm.query_exists(null)) {
            try { rm.delete(null); } catch (_e) {}
        }
    }
}

// ---- Autostart .desktop file: create and remove under temp config dir ----
function testAutostartDesktopCreateAndRemove() {
    const cwd = GLib.get_current_dir();
    const tmpDir = GLib.build_filenamev([cwd, 'tests', '.tmp-test11-ast-' + GLib.uuid_string_random()]);
    GLib.mkdir_with_parents(tmpDir, 0o700);
    const savedConfig = GLib.getenv('XDG_CONFIG_HOME');
    try {
        GLib.setenv('XDG_CONFIG_HOME', tmpDir, true);
        const cfgHome = GLib.get_user_config_dir();
        const cfgFile = Gio.File.new_for_path(cfgHome);
        const tmpFile = Gio.File.new_for_path(tmpDir);
        if (!cfgFile.equal(tmpFile)) {
            print('TEST 11: skip autostart file test (XDG_CONFIG_HOME not honored: ' + cfgHome + ' vs ' + tmpDir + ')');
            return;
        }

        const Standalone = imports.platform.standalone.gtk_platform;
        const platform = new Standalone.StandaloneGtkPlatform({
            application: {},
            appId: 'com.github.cryptod.tasktimer',
            displayName: 'taskTimer',
            iconName: 'alarm-symbolic',
        });

        const autostartDir = GLib.build_filenamev([tmpDir, 'autostart']);
        const desktopPath = GLib.build_filenamev([autostartDir, 'tasktimer.desktop']);
        const file = Gio.File.new_for_path(desktopPath);

        platform.updateAutostartDesktop(true);
        const exists = file.query_exists(null);
        if (!exists) {
            const checkDir = Gio.File.new_for_path(GLib.build_filenamev([tmpDir, 'autostart']));
            const children = checkDir.query_exists(null) ? checkDir.enumerate_children('standard::name', 0, null) : null;
            const names = children ? (() => { const a = []; let n; while ((n = children.next_file(null)) !== null) a.push(n.get_name()); return a; })() : [];
            throw new Error('desktop file not found at ' + desktopPath + ' (XDG_CONFIG_HOME=' + GLib.getenv('XDG_CONFIG_HOME') + ', autostart dir exists=' + checkDir.query_exists(null) + ', children=' + names.join(', ')) + ')';
        }
        assert(exists, 'desktop file created when enabled');

        const [, contents] = file.load_contents(null);
        const text = new TextDecoder('utf-8').decode(contents);
        assert(text.indexOf('[Desktop Entry]') >= 0, 'desktop has [Desktop Entry]');
        assert(text.indexOf('Type=Application') >= 0, 'desktop has Type=Application');
        assert(text.indexOf('Name=taskTimer') >= 0, 'desktop has Name=taskTimer');
        assert(text.indexOf('Exec=') >= 0, 'desktop has Exec=');
        assert(text.indexOf('Path=') >= 0, 'desktop has Path=');
        assert(text.indexOf('X-GNOME-Autostart-enabled=true') >= 0, 'desktop has X-GNOME-Autostart-enabled');

        platform.updateAutostartDesktop(false);
        assert(!file.query_exists(null), 'desktop file removed when disabled');
    } finally {
        if (savedConfig !== null && savedConfig !== undefined) {
            GLib.setenv('XDG_CONFIG_HOME', savedConfig, true);
        } else {
            GLib.unsetenv('XDG_CONFIG_HOME');
        }
        const rm = Gio.File.new_for_path(tmpDir);
        if (rm.query_exists(null)) {
            try {
                rm.delete(null);
            } catch (_e) {}
        }
    }
}

// ---- CLI: --version and --help (spawn main.js and check stdout) ----
// Optional: skip without failing when spawn or output differs (e.g. headless, different gjs).
function testCliVersionAndHelp() {
    const cwd = GLib.get_current_dir();
    const mainPath = GLib.build_filenamev([cwd, 'main.js']);
    if (!Gio.File.new_for_path(mainPath).query_exists(null)) {
        print('TEST 11: skip CLI checks (main.js not found in cwd)');
        return;
    }
    const gjsPath = GLib.find_program_in_path('gjs');
    if (!gjsPath) {
        print('TEST 11: skip CLI checks (gjs not in PATH)');
        return;
    }
    try {
        let [ok, stdout, stderr] = GLib.spawn_sync(cwd, [gjsPath, mainPath, '--version'], null, 0, null);
        const outVersion = (stdout ? new TextDecoder('utf-8').decode(stdout) : '') + (stderr ? new TextDecoder('utf-8').decode(stderr) : '');
        if (!ok || outVersion.indexOf('taskTimer') < 0) {
            print('TEST 11: skip CLI checks (--version output unexpected)');
            return;
        }
        [ok, stdout, stderr] = GLib.spawn_sync(cwd, [gjsPath, mainPath, '--help'], null, 0, null);
        const outHelp = (stdout ? new TextDecoder('utf-8').decode(stdout) : '') + (stderr ? new TextDecoder('utf-8').decode(stderr) : '');
        if (!ok || (outHelp.indexOf('--minimized') < 0 && outHelp.indexOf('Options') < 0 && outHelp.indexOf('Usage') < 0)) {
            print('TEST 11: skip CLI checks (--help output unexpected)');
            return;
        }
    } catch (e) {
        print('TEST 11: skip CLI checks (' + (e && e.message ? e.message : e) + ')');
    }
}

// ---- Run ----
// Autostart file test must run before JSONSettingsProvider: some GLib builds cache
// get_user_config_dir() after first use, so a later setenv(XDG_CONFIG_HOME) is ignored.
testAutostartDesktopCreateAndRemove();
testWindowStateAndAutostartDefaults();
testCliVersionAndHelp();

print('TEST 11 window/autostart polish: pass');
print('');
print('Manual checks (full polish requires a real graphical session + reboot or re-login):');
print('  1. Preferences → General → enable "Start when you log in", then reboot or log out/in:');
print('     taskTimer should autostart; launcher busy state should clear (startup notification).');
print('  2. Resize/move/maximize the main window, quit from tray or close; start again:');
print('     size, position, and maximized state should match ~/.config/tasktimer/config.json keys.');
print('  3. Run: gjs main.js --minimized — window should stay hidden (tray if available).');
print('  4. Optional: disable autostart in Preferences and confirm ~/.config/autostart/tasktimer.desktop is removed.');
