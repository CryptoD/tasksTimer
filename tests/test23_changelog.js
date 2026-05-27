// Task 76: CHANGELOG.md — Keep a Changelog format, first release entry, README link.
// Run: gjs tests/test23_changelog.js

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
const changelog = GLib.build_filenamev([root, 'CHANGELOG.md']);
const readme = GLib.build_filenamev([root, 'README.md']);

assert(Gio.File.new_for_path(changelog).query_exists(null), 'CHANGELOG.md must exist');

const log = readUtf8(changelog);
assert(log.indexOf('keepachangelog.com') >= 0, 'must reference Keep a Changelog');
assert(log.indexOf('## [Unreleased]') >= 0, 'must have Unreleased section');
assert(log.indexOf('## [1.1]') >= 0, 'must have first release entry [1.1]');
assert(log.indexOf('### Added') >= 0, 'must use Keep a Changelog Added heading');
assert(log.indexOf('### Changed') >= 0, 'must use Keep a Changelog Changed heading');
assert(log.indexOf('First changelog release entry') >= 0,
    '[1.1] must describe current shipped product state');

const readmeText = readUtf8(readme);
assert(readmeText.indexOf('CHANGELOG.md') >= 0, 'README must link CHANGELOG.md');

const gjsPath = GLib.find_program_in_path('python3');
const extractor = GLib.build_filenamev([root, 'bin', 'extract_changelog_section.py']);
if (gjsPath && Gio.File.new_for_path(extractor).query_exists(null)) {
    const argv = ['python3', extractor, '1.1'];
    const [ok, out, err, status] = GLib.spawn_sync(root, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
    const exitCode = (status >> 8) & 0xff;
    const stdout = out ? new TextDecoder('utf-8').decode(out) : '';
    assert(ok && exitCode === 0 && stdout.indexOf('Standalone GTK') >= 0,
        'extract_changelog_section.py must extract [1.1] body');
}

print('test23_changelog: OK');
