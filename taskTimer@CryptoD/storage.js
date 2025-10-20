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
        GLib.file_set_contents(filename, jsonString);
        return true;
    } catch (e) {
        log(`Error saving JSON to ${filename}: ${e}`);
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
        log(`Error loading JSON from ${filename}: ${e}`);
        return null;
    }
}

// Export as a single object
var StorageModule = {
    saveJSON: saveJSON,
    loadJSON: loadJSON
};