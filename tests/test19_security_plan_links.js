// Task 72: docs/plan must link public security review summary.
// Run: gjs tests/test19_security_plan_links.js

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
const planReadme = GLib.build_filenamev([root, 'docs', 'plan', 'README.md']);
const summary = GLib.build_filenamev([root, 'docs', 'plan', 'security-review-summary.md']);
const worksheet = GLib.build_filenamev([root, 'docs', 'dev', 'security-self-assessment.md']);

assert(Gio.File.new_for_path(planReadme).query_exists(null), 'docs/plan/README.md must exist');
assert(Gio.File.new_for_path(summary).query_exists(null), 'docs/plan/security-review-summary.md must exist');
assert(Gio.File.new_for_path(worksheet).query_exists(null), 'docs/dev/security-self-assessment.md must exist');

const readme = readUtf8(planReadme);
assert(readme.indexOf('security-review-summary.md') >= 0, 'plan README must link summary');
assert(readme.indexOf('Task 72') >= 0, 'plan README must reference Task 72');

const summaryText = readUtf8(summary);
assert(summaryText.indexOf('security-self-assessment.md') >= 0, 'summary must link worksheet');
assert(summaryText.indexOf('Remediation') >= 0, 'summary must document remediation tracking');
assert(summaryText.indexOf('pen test') >= 0 || summaryText.indexOf('penetration') >= 0,
    'summary must state review type (self-assessment vs pen test)');

print('test19_security_plan_links: OK');
