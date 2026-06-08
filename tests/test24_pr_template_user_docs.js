// Task 77: PR template must include user docs parity checkbox.
// Run: gjs tests/test24_pr_template_user_docs.js

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
const template = GLib.build_filenamev([root, '.github', 'pull_request_template.md']);

assert(Gio.File.new_for_path(template).query_exists(null), 'PR template must exist');

const text = readUtf8(template);
assert(text.indexOf('User docs updated if behavior changed') >= 0,
    'PR template must include user docs parity checkbox');
assert(text.indexOf('docs/user/features.md') >= 0,
    'checkbox should link canonical user docs');

print('test24_pr_template_user_docs: OK');
