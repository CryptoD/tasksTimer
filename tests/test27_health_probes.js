// Task 80: health probe docs and verify script exist.
// Run: gjs tests/test27_health_probes.js

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
const probes = GLib.build_filenamev([root, 'docs', 'api', 'health-probes.md']);
const deployment = GLib.build_filenamev([root, 'docs', 'dev', 'deployment.md']);
const verify = GLib.build_filenamev([root, 'bin', 'verify-health-probes.sh']);

assert(Gio.File.new_for_path(probes).query_exists(null));
assert(Gio.File.new_for_path(verify).query_exists(null));

const probeText = readUtf8(probes);
assert(probeText.indexOf('/health') >= 0);
assert(probeText.indexOf('/readyz') >= 0);
assert(probeText.indexOf('503') >= 0);

const deployText = readUtf8(deployment);
assert(deployText.indexOf('Load balancer and probes') >= 0);
assert(deployText.indexOf('/readyz') >= 0);
assert(deployText.indexOf('liveness') >= 0);

print('test27_health_probes: OK (run bin/verify-health-probes.sh for live check)');
