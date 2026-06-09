// Task 81: observability doc, Grafana sample, /metrics verification.
// Run: gjs tests/test28_metrics.js

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
const obs = GLib.build_filenamev([root, 'docs', 'dev', 'observability.md']);
const grafana = GLib.build_filenamev([root, 'docs', 'dev', 'grafana', 'api-red-overview.json']);
const verify = GLib.build_filenamev([root, 'bin', 'verify-metrics.sh']);

assert(Gio.File.new_for_path(obs).query_exists(null));
assert(Gio.File.new_for_path(grafana).query_exists(null));
assert(Gio.File.new_for_path(verify).query_exists(null));

const obsText = readUtf8(obs);
assert(obsText.indexOf('RED') >= 0);
assert(obsText.indexOf('/metrics') >= 0);
assert(obsText.indexOf('http_requests_total') >= 0);

const dash = readUtf8(grafana);
assert(dash.indexOf('tasktimer-api-red') >= 0);
assert(dash.indexOf('http_requests_total') >= 0);

print('test28_metrics: OK (run bin/verify-metrics.sh for live check)');
