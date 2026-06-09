// Task 79: API examples doc + verify script exist.
// Run: gjs tests/test26_api_examples.js

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
const examples = GLib.build_filenamev([root, 'docs', 'api', 'examples.md']);
const script = GLib.build_filenamev([root, 'docs', 'api', 'examples', 'login_list_tasks.mjs']);
const verify = GLib.build_filenamev([root, 'bin', 'verify-api-examples.sh']);

assert(Gio.File.new_for_path(examples).query_exists(null));
assert(Gio.File.new_for_path(script).query_exists(null));
assert(Gio.File.new_for_path(verify).query_exists(null));

const text = readUtf8(examples);
assert(text.indexOf('curl') >= 0 && text.indexOf('/auth/login') >= 0);
assert(text.indexOf('/tasks') >= 0);
assert(text.indexOf('login_list_tasks.mjs') >= 0);
assert(text.indexOf('verify-api-examples') >= 0);

print('test26_api_examples: OK (run bin/verify-api-examples.sh for live check)');
