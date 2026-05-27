// Task 74: OpenAPI drift check script and manifest must exist; pass on current tree.
// Run: gjs tests/test21_openapi_drift_check.js

imports.searchPath.unshift('.');

const { GLib, Gio } = imports.gi;

function assert(cond, msg) {
    if (!cond) {
        throw new Error(msg || 'Assertion failed');
    }
}

function readUtf8(path) {
    const [, contents] = Gio.File.new_for_path(path).load_contents(null);
    return new TextDecoder('utf-8').decode(contents);
}

const root = GLib.get_current_dir();
const script = GLib.build_filenamev([root, 'bin', 'check-openapi-drift.sh']);
const manifest = GLib.build_filenamev([root, 'tooling', 'openapi_drift_manifest.txt']);
const contributing = GLib.build_filenamev([root, 'CONTRIBUTING.md']);

assert(Gio.File.new_for_path(script).query_exists(null), 'bin/check-openapi-drift.sh must exist');
assert(Gio.File.new_for_path(manifest).query_exists(null), 'tooling/openapi_drift_manifest.txt must exist');

const manifestText = readUtf8(manifest);
assert(manifestText.indexOf('docs/api/openapi.yaml') >= 0, 'manifest must list openapi.yaml');
assert(manifestText.indexOf('e2e/handlers.mjs') >= 0, 'manifest must list e2e/handlers.mjs');

const contrib = readUtf8(contributing);
assert(contrib.indexOf('Task 96') >= 0, 'CONTRIBUTING.md must document Task 96');
assert(contrib.indexOf('check-openapi-drift') >= 0, 'CONTRIBUTING.md must mention drift check');

const gjsPath = GLib.find_program_in_path('bash');
assert(gjsPath, 'bash required');

const argv = ['bash', script, 'HEAD~1'];
const [, , err, status] = GLib.spawn_sync(root, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
const exitCode = (status >> 8) & 0xff;
const stderr = err ? new TextDecoder('utf-8').decode(err) : '';
assert(exitCode === 0, `check-openapi-drift.sh should pass on current tree: ${stderr}`);

const selfTest = ['bash', script, '--self-test'];
const [, , err2, status2] = GLib.spawn_sync(root, selfTest, null, GLib.SpawnFlags.SEARCH_PATH, null);
const exitCode2 = (status2 >> 8) & 0xff;
const stderr2 = err2 ? new TextDecoder('utf-8').decode(err2) : '';
assert(exitCode2 === 0, `check-openapi-drift.sh --self-test failed: ${stderr2}`);

print('test21_openapi_drift_check: OK');
