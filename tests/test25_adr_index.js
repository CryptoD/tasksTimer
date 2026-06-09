// Task 78: docs/adr/README.md index with five backend ADRs.
// Run: gjs tests/test25_adr_index.js

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
const index = GLib.build_filenamev([root, 'docs', 'adr', 'README.md']);

assert(Gio.File.new_for_path(index).query_exists(null), 'docs/adr/README.md must exist');

const text = readUtf8(index);
assert(text.indexOf('Task 78') >= 0 || text.indexOf('0001') >= 0, 'index must list ADRs');

const required = [
    '0001-use-sqlite-for-backend-persistence.md',
    '0002-jwt-access-with-refresh-tokens.md',
    '0003-spa-hosting-same-origin-caddy.md',
    '0004-background-job-runner-extracted-from-main.md',
    '0005-offset-pagination-defaults.md',
];

required.forEach(name => {
    const path = GLib.build_filenamev([root, 'docs', 'adr', name]);
    assert(Gio.File.new_for_path(path).query_exists(null), `missing ADR ${name}`);
    assert(text.indexOf(name.replace('.md', '')) >= 0 || text.indexOf(name) >= 0,
        `index must reference ${name}`);
});

print('test25_adr_index: OK');
