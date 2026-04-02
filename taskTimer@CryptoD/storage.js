const GLib = imports.gi.GLib;

/*
 * Copyright (C) 2023 CryptoD
 */
function saveJSON(filename, data) {
    try {
        let dirname = GLib.path_get_dirname(filename);
        if (!GLib.file_test(dirname, GLib.FileTest.EXISTS)) {
            GLib.mkdir_with_parents(dirname, 0o755);
        }
        let jsonString = JSON.stringify(data, null, 2);

        // Transaction-like behavior for file persistence:
        // write to a temp file then atomically rename into place.
        // This prevents partial writes and allows tests to simulate failure mid-flight.
        const tmpPath = filename + '.tmp-' + GLib.uuid_string_random();
        GLib.file_set_contents(tmpPath, jsonString);

        // Test hook: simulate a failure after writing the temp file but before
        // the atomic rename. This should leave the original file unchanged.
        const fail = GLib.getenv('TASKTIMER_TEST_FAIL_JSON_SAVE');
        if (fail === '1' || fail === 'true') {
            try { GLib.unlink(tmpPath); } catch (_e) {}
            throw new Error('simulated mid-flight JSON save failure');
        }

        GLib.rename(tmpPath, filename);
        return true;
    } catch (e) {
        log(`taskTimer: failed to save JSON to ${filename}: ${e} (permissions or disk full?)`);
        return false;
    }
}

function loadJSON(filename) {
    try {
        if (!GLib.file_test(filename, GLib.FileTest.EXISTS)) {
            return null;
        }
        let [ok, contents] = GLib.file_get_contents(filename);
        if (!ok) return null;
        return JSON.parse(contents);
    } catch (e) {
        log(`taskTimer: failed to load JSON from ${filename}: ${e}; treating as empty`);
        return null;
    }
}

// Export as a single object
var StorageModule = {
    saveJSON: saveJSON,
    loadJSON: loadJSON
};