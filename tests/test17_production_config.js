// Production config validation — missing secret must exit 1 at startup.
// Run: gjs tests/test17_production_config.js

imports.searchPath.unshift('.');

const { GLib, Gio } = imports.gi;

const Prod = imports.src.config.production_config;

function assert(cond, msg) {
    if (!cond) {
        throw new Error(msg || 'Assertion failed');
    }
}

function mockGetenv(map) {
    return key => (Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null);
}

assert(!Prod.isProductionDeployment(mockGetenv({})));
assert(Prod.isProductionDeployment(mockGetenv({ TASKTIMER_ENV: 'production' })));
assert(Prod.isProductionDeployment(mockGetenv({ TASKMASTER_ENV: 'production' })));

const missing = Prod.validateProductionSecrets(mockGetenv({
    TASKTIMER_ENV: 'production',
    TASKTIMER_JWT_SECRET: 'a'.repeat(Prod.MIN_SECRET_LENGTH),
}));
assert(!missing.ok);
assert(missing.missing.indexOf('TASKTIMER_SESSION_SECRET') >= 0);
assert(missing.missing.indexOf('TASKTIMER_CSRF_SECRET') >= 0);

const devOk = Prod.validateProductionSecrets(mockGetenv({ TASKTIMER_ENV: 'development' }));
assert(devOk.ok && devOk.missing.length === 0);

assert(!Prod.isUsableSecret('short'));
assert(Prod.isUsableSecret('abcdefghijklmnopqrst'));

let exitCode = null;
let exitMessage = '';
try {
    Prod.assertProductionConfigOrExit(
        mockGetenv({ TASKTIMER_ENV: 'production' }),
        {
            exitFn(code) {
                exitCode = code;
                throw new Error('exit');
            },
            logFn(msg) {
                exitMessage = String(msg);
            },
        },
    );
} catch (e) {
    if (String(e.message || e) !== 'exit') {
        throw e;
    }
}
assert(exitCode === 1, 'expected exit 1 for missing production secrets');
assert(exitMessage.indexOf('TASKTIMER_SESSION_SECRET') >= 0);

function exitCodeFromSpawnStatus(status) {
    // GLib.spawn_sync returns wait status; shift to Unix exit code.
    return (status >> 8) & 0xff;
}

function spawnScenario(mode, expectStatus) {
    const cwd = GLib.get_current_dir();
    const gjsPath = GLib.find_program_in_path('gjs');
    const script = GLib.build_filenamev([cwd, 'tests', '_test17_production_config_exit.js']);
    assert(gjsPath && Gio.File.new_for_path(script).query_exists(null), 'gjs and scenario script required');

    const argv = [gjsPath, script, mode];
    const [ok, out, err, status] = GLib.spawn_sync(cwd, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
    const stderr = err ? new TextDecoder('utf-8').decode(err) : '';
    const stdout = out ? new TextDecoder('utf-8').decode(out) : '';
    if (!ok) {
        throw new Error(`spawn failed for ${mode}: ${stderr}`);
    }
    const exitCode = exitCodeFromSpawnStatus(status);
    if (exitCode !== expectStatus) {
        throw new Error(
            `scenario ${mode}: expected exit ${expectStatus}, got ${exitCode} (wait=${status})\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        );
    }
    return { stdout, stderr };
}

const failRun = spawnScenario('missing_secret', 1);
assert(failRun.stderr.indexOf('TASKTIMER_SESSION_SECRET') >= 0);

const okRun = spawnScenario('ok_secrets', 0);
assert(okRun.stdout.indexOf('TEST17 scenario OK') >= 0);

console.log('TEST 17 production config: pass');
