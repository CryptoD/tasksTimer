/*
 * JSONSettingsProvider / Config
 *
 * This module implements a JSON-backed configuration provider that mimics
 * the subset of the Gio.Settings API used by taskTimer. It stores data in
 * XDG_CONFIG_HOME/tasktimer/config.json and exposes:
 *
 *   - get(key), set(key, value)
 *   - get_boolean(), get_string(), get_int(), get_strv()
 *   - set_boolean(), set_string(), set_int(), set_strv()
 *
 * Higher-level modules (e.g. settings.js) can wrap this provider to match
 * their existing expectations about settings access.
 */

const { Gio, GLib } = imports.gi;
const Platform = imports.platform.interface;

const CONFIG_DIR = GLib.build_filenamev([
    GLib.get_user_config_dir(),
    'tasktimer',
]);

const CONFIG_PATH = GLib.build_filenamev([
    CONFIG_DIR,
    'config.json',
]);

const CURRENT_SCHEMA_VERSION = 1;

function _ensureConfigDir() {
    try {
        GLib.mkdir_with_parents(CONFIG_DIR, 0o755);
    } catch (e) {
        logError(e, `taskTimer: failed to create config directory ${CONFIG_DIR}`);
    }
}

function _loadRawConfig() {
    _ensureConfigDir();
    const file = Gio.File.new_for_path(CONFIG_PATH);

    try {
        const [, contents] = file.load_contents(null);
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(contents);
        const data = JSON.parse(text);
        if (typeof data.version !== 'number') {
            data.version = CURRENT_SCHEMA_VERSION;
        }
        return data;
    } catch (e) {
        // File does not exist or cannot be parsed; start with defaults.
        return { version: CURRENT_SCHEMA_VERSION };
    }
}

function _saveRawConfig(data) {
    _ensureConfigDir();
    const file = Gio.File.new_for_path(CONFIG_PATH);
    data.version = CURRENT_SCHEMA_VERSION;
    const text = JSON.stringify(data, null, 2);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);

    try {
        file.replace_contents(
            bytes,
            null,
            false,
            Gio.FileCreateFlags.REPLACE_DESTINATION,
            null
        );
    } catch (e) {
        logError(e, `taskTimer: failed to write config file ${CONFIG_PATH}`);
    }
}

var JSONSettingsProvider = class JSONSettingsProvider extends Platform.ConfigProvider {
    constructor() {
        super();
        this._data = _loadRawConfig();
    }

    // Base get/set

    get(key) {
        if (Object.prototype.hasOwnProperty.call(this._data, key)) {
            return this._data[key];
        }
        return undefined;
    }

    set(key, value) {
        this._data[key] = value;
        _saveRawConfig(this._data);
    }

    // Typed getters

    get_boolean(key) {
        const value = this.get(key);
        return Boolean(value);
    }

    get_string(key) {
        const value = this.get(key);
        return value === undefined || value === null ? '' : String(value);
    }

    get_int(key) {
        const value = this.get(key);
        if (typeof value === 'number') {
            return value | 0;
        }
        const parsed = parseInt(value, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    get_strv(key) {
        const value = this.get(key);
        if (Array.isArray(value)) {
            return value.map(v => String(v));
        }
        return [];
    }

    // Typed setters

    set_boolean(key, value) {
        this.set(key, Boolean(value));
    }

    set_string(key, value) {
        this.set(key, value === undefined || value === null ? '' : String(value));
    }

    set_int(key, value) {
        const n = parseInt(value, 10);
        this.set(key, Number.isNaN(n) ? 0 : n);
    }

    set_strv(key, value) {
        if (!Array.isArray(value)) {
            value = [];
        }
        this.set(key, value.map(v => String(v)));
    }
};

