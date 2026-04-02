// TEST 15: Atomic JSON save (transaction-like persistence)
//
// Proves that a failure "mid-flight" does not corrupt/overwrite the original file.
//
// Run:
//   gjs tests/test15_atomic_json_save.js

imports.searchPath.unshift('.');

const { GLib } = imports.gi;
const Storage = imports['taskTimer@CryptoD'].storage;

function assert(cond, msg) {
    if (!cond) throw new Error('ASSERT FAILED: ' + msg);
}

function readText(path) {
    const [ok, contents] = GLib.file_get_contents(path);
    assert(ok, 'file_get_contents ok for ' + path);
    return new TextDecoder('utf-8').decode(contents);
}

const dir = GLib.build_filenamev([GLib.get_tmp_dir(), 'tasktimer-test15-' + GLib.uuid_string_random()]);
GLib.mkdir_with_parents(dir, 0o700);
const path = GLib.build_filenamev([dir, 'timers.json']);

// Seed a known-good file.
assert(Storage.saveJSON(path, { a: 1 }) === true, 'seed saveJSON succeeds');
const before = readText(path);
assert(before.indexOf('"a": 1') >= 0, 'seed file contains a=1');

// Simulate mid-flight failure: temp file written, but rename aborted.
GLib.setenv('TASKTIMER_TEST_FAIL_JSON_SAVE', '1', true);
const r = Storage.saveJSON(path, { a: 2 });
assert(r === false, 'saveJSON returns false on simulated failure');

const afterFail = readText(path);
assert(afterFail === before, 'file unchanged after mid-flight failure');

// Success path afterward should update contents.
GLib.unsetenv('TASKTIMER_TEST_FAIL_JSON_SAVE');
assert(Storage.saveJSON(path, { a: 3 }) === true, 'saveJSON succeeds after unsetting failure hook');
const afterOk = readText(path);
assert(afterOk.indexOf('"a": 3') >= 0, 'file updated to a=3');

print('TEST 15 atomic json save: pass');

