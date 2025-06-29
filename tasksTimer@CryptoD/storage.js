const GLib = imports.gi.GLib;

function saveJSON(filename, data) {
    try {
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
var Storage = {
    saveJSON: saveJSON,
    loadJSON: loadJSON
};
