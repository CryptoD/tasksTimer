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

// Basic schema description for validation and defaulting. This mirrors the
// current GSettings layout used in taskTimer as closely as possible.
const SCHEMA = {
    'accel-enable':           { type: 'boolean', default: false },
    'accel-show-endtime':     { type: 'string',  default: '<Control><Super>t' },
    'accel-stop-next':        { type: 'string',  default: '<Control><Super>k' },
    'minimize-to-tray':       { type: 'boolean', default: false },

    'debug':                  { type: 'boolean', default: false },
    'detect-dupes':           { type: 'boolean', default: true },
    'inhibit':                { type: 'int',     default: 0 },
    'inhibit-max':            { type: 'int',     default: 0 },

    'notification':           { type: 'boolean', default: true },
    'notification-sticky':    { type: 'boolean', default: false },
    'notification-longtimeout': { type: 'int',   default: 10000 },

    'play-sound':             { type: 'boolean', default: true },
    'sound-file':             { type: 'string',  default: 'tasktimer-default.ogg' },
    'sound-loops':            { type: 'int',     default: 1 },

    'prefer-presets':         { type: 'int',     default: 0 },
    'save-quick-timers':      { type: 'boolean', default: true },

    'show-endtime':           { type: 'boolean', default: false },
    'show-label':             { type: 'boolean', default: true },
    'show-progress':          { type: 'boolean', default: true },
    'show-time':              { type: 'boolean', default: true },

    'sort-by-duration':       { type: 'boolean', default: false },
    'sort-descending':        { type: 'boolean', default: false },

    'volume-level-warn':      { type: 'boolean', default: true },
    'volume-threshold':       { type: 'int',     default: 20 },

    'theme-variant':          { type: 'string',  default: 'system' },
    'menu-max-width':         { type: 'int',     default: 400 },

    // Running timers JSON; currently stored as a JSON-encoded string.
    'running':                { type: 'string',  default: '[]' },

    // Timer presets and quick timers (arrays of plain objects).
    'timers':                 { type: 'array',   default: [] },
    'quick-timers':           { type: 'array',   default: [] },
};

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
        return _applyDefaultsAndMigrate(data);
    } catch (e) {
        // File does not exist or cannot be parsed; start with defaults.
        return _applyDefaultsAndMigrate({});
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

function _coerceValue(schemaEntry, value) {
    if (value === undefined || value === null) {
        return schemaEntry.default;
    }

    switch (schemaEntry.type) {
        case 'boolean':
            return Boolean(value);
        case 'string':
            return String(value);
        case 'int': {
            const n = parseInt(value, 10);
            return Number.isNaN(n) ? schemaEntry.default : n | 0;
        }
        case 'array':
            return Array.isArray(value) ? value : schemaEntry.default;
        default:
            return value;
    }
}

function _migrateSchema(data) {
    // Placeholder for future schema migrations. For now, we only ensure that
    // the version field is present and bump it to CURRENT_SCHEMA_VERSION.
    if (typeof data.version !== 'number') {
        data.version = CURRENT_SCHEMA_VERSION;
    }
    if (data.version < CURRENT_SCHEMA_VERSION) {
        // Future migration steps for older versions would go here.
        data.version = CURRENT_SCHEMA_VERSION;
    }
}

function _applyDefaultsAndMigrate(raw) {
    const data = (raw && typeof raw === 'object') ? raw : {};

    if (typeof data.version !== 'number') {
        data.version = CURRENT_SCHEMA_VERSION;
    }

    _migrateSchema(data);

    // If this configuration has not yet been initialized from the legacy
    // GSettings backend, attempt a one-time migration. This allows users
    // upgrading from the GNOME Shell extension to keep their existing
    // preferences in the standalone application.
    if (!data.migrated_from_gsettings) {
        _maybeMigrateFromGSettings(data);
    }

    // Apply defaults and simple type coercion based on SCHEMA entries.
    for (let [key, schemaEntry] of Object.entries(SCHEMA)) {
        const current = Object.prototype.hasOwnProperty.call(data, key)
            ? data[key]
            : undefined;
        data[key] = _coerceValue(schemaEntry, current);
    }

    return data;
}

function _maybeMigrateFromGSettings(data) {
    try {
        const schemaId = 'org.gnome.shell.extensions.kitchen-timer-blackjackshellac';
        const gioSettings = new Gio.Settings({ schema_id: schemaId });
        const provider = new GSettingsProvider(gioSettings);

        for (let [key, schemaEntry] of Object.entries(SCHEMA)) {
            // Skip keys that are already present; user JSON wins over GSettings.
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                continue;
            }
            const value = provider.get(key);
            if (value !== undefined) {
                data[key] = _coerceValue(schemaEntry, value);
            }
        }

        data.migrated_from_gsettings = true;
        log('taskTimer: migrated settings from GSettings to JSON config');
    } catch (e) {
        // Most likely the schema is not installed, or this environment does
        // not support GSettings for the extension. In that case we simply
        // keep JSON defaults and mark migration as done to avoid retrying.
        logError(e, 'taskTimer: failed to migrate settings from GSettings; continuing with JSON defaults');
        data.migrated_from_gsettings = true;
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

/**
 * GSettingsProvider
 *
 * Wrapper around Gio.Settings that conforms to the same ConfigProvider
 * interface as JSONSettingsProvider. This allows existing code in
 * taskTimer@CryptoD/settings.js to be migrated to a provider pattern
 * without changing its public API.
 */
var GSettingsProvider = class GSettingsProvider extends Platform.ConfigProvider {
    /**
     * @param {Gio.Settings} gioSettings - existing Gio.Settings instance
     */
    constructor(gioSettings) {
        super();
        this._settings = gioSettings;
    }

    // Base get/set use the appropriate Gio.Settings typed accessors when
    // possible. For compatibility, only keys present in SCHEMA are handled
    // here; others will fall back to string lookups.

    get(key) {
        const schemaEntry = SCHEMA[key];
        if (!schemaEntry) {
            // Fall back to a generic string representation if the key is not
            // known to this schema description.
            try {
                return this._settings.get_string(key);
            } catch (e) {
                return undefined;
            }
        }

        switch (schemaEntry.type) {
            case 'boolean':
                return this._settings.get_boolean(key);
            case 'string':
                return this._settings.get_string(key);
            case 'int':
                return this._settings.get_int(key);
            case 'array': {
                // For arrays we use get_strv; callers can interpret as needed.
                return this._settings.get_strv(key);
            }
            default:
                return undefined;
        }
    }

    set(key, value) {
        const schemaEntry = SCHEMA[key];
        if (!schemaEntry) {
            // Fall back to storing as string when schema information is missing.
            this._settings.set_string(key, String(value));
            return;
        }

        switch (schemaEntry.type) {
            case 'boolean':
                this._settings.set_boolean(key, Boolean(value));
                break;
            case 'string':
                this._settings.set_string(key, value === undefined || value === null ? '' : String(value));
                break;
            case 'int': {
                const n = parseInt(value, 10);
                this._settings.set_int(key, Number.isNaN(n) ? 0 : n);
                break;
            }
            case 'array': {
                const arr = Array.isArray(value) ? value : [];
                this._settings.set_strv(key, arr.map(v => String(v)));
                break;
            }
            default:
                break;
        }
    }

    // Typed getters simply delegate to the underlying Gio.Settings when
    // possible, preserving existing semantics.

    get_boolean(key) {
        return this._settings.get_boolean(key);
    }

    get_string(key) {
        return this._settings.get_string(key);
    }

    get_int(key) {
        return this._settings.get_int(key);
    }

    get_strv(key) {
        return this._settings.get_strv(key);
    }

    // Typed setters

    set_boolean(key, value) {
        this._settings.set_boolean(key, Boolean(value));
    }

    set_string(key, value) {
        this._settings.set_string(key, value === undefined || value === null ? '' : String(value));
    }

    set_int(key, value) {
        const n = parseInt(value, 10);
        this._settings.set_int(key, Number.isNaN(n) ? 0 : n);
    }

    set_strv(key, value) {
        if (!Array.isArray(value)) {
            value = [];
        }
        this._settings.set_strv(key, value.map(v => String(v)));
    }
};


