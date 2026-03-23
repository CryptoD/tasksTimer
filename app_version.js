/*
 * Application release version (see version.json in the repository root).
 * Used by main.js and context.js; packaging copies version.json next to main.js (AppImage).
 */
'use strict';

const { Gio, GLib } = imports.gi;

function _appRootDir() {
    try {
        const p = imports.system.programPath;
        if (typeof p === 'string' && p.length > 0 && GLib.path_get_basename(p) === 'main.js') {
            return GLib.path_get_dirname(p);
        }
    } catch (e) {
        // ignore
    }
    return GLib.get_current_dir();
}

function _load() {
    const root = _appRootDir();
    const vPath = GLib.build_filenamev([root, 'version.json']);
    try {
        const file = Gio.File.new_for_path(vPath);
        const [, contents] = file.load_contents(null);
        return JSON.parse(new TextDecoder('utf-8').decode(contents));
    } catch (e) {
        // ignore
    }
    const mPath = GLib.build_filenamev([root, 'taskTimer@CryptoD', 'metadata.json']);
    try {
        const file = Gio.File.new_for_path(mPath);
        const [, contents] = file.load_contents(null);
        const meta = JSON.parse(new TextDecoder('utf-8').decode(contents));
        if (meta && typeof meta.version !== 'undefined') {
            return { version: meta.version, release_date: null };
        }
    } catch (e2) {
        // ignore
    }
    return null;
}

const _data = _load();
var VERSION = _data && _data.version !== undefined && _data.version !== null
    ? String(_data.version)
    : '0.0.0';
var RELEASE_DATE = _data && _data.release_date != null ? String(_data.release_date) : '';
