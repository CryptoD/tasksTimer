/*
 * Context abstraction for taskTimer.
 *
 * This module defines a minimal Context interface plus a StandaloneContext
 * implementation used by the standalone GTK application. The Context is
 * responsible for exposing application metadata (ID, version, paths) and
 * central access points for config, storage, and logging services.
 *
 * Later phases will extend this with a full provider pattern and potentially
 * additional environment-specific implementations (e.g. GnomeShellContext).
 */

const { Gio, GLib } = imports.gi;
const Config = imports.config;
const AppVersion = imports.app_version;

function _appRootDirForMetadata() {
    try {
        const p = imports.system.programPath;
        if (typeof p === 'string' && p.length > 0) {
            const base = GLib.path_get_basename(p);
            if (base === 'main.js') {
                return GLib.path_get_dirname(p);
            }
        }
    } catch (e) {
        // ignore
    }
    return GLib.get_current_dir();
}

// Path to the extension metadata (name, description, etc.). Application version
// is read from version.json via app_version.js; metadata remains a fallback.
const METADATA_PATH = GLib.build_filenamev([
    _appRootDirForMetadata(),
    'taskTimer@CryptoD',
    'metadata.json',
]);

function _loadMetadata() {
    try {
        const file = Gio.File.new_for_path(METADATA_PATH);
        const [, contents] = file.load_contents(null);
        const decoder = new TextDecoder('utf-8');
        return JSON.parse(decoder.decode(contents));
    } catch (e) {
        logError(e, 'taskTimer: failed to load metadata.json for Context');
        return {};
    }
}

const _metadata = _loadMetadata();

var Context = class Context {
    get appId() {
        throw new Error('Context.appId getter not implemented');
    }

    get version() {
        throw new Error('Context.version getter not implemented');
    }

    get configDir() {
        throw new Error('Context.configDir getter not implemented');
    }

    get dataDir() {
        throw new Error('Context.dataDir getter not implemented');
    }

    get logDir() {
        // By default, logs live under dataDir/logs; callers may override.
        return GLib.build_filenamev([this.dataDir, 'logs']);
    }

    get metadata() {
        return _metadata;
    }
};

var StandaloneContext = class StandaloneContext extends Context {
    constructor(params = {}) {
        super();

        this._appId = params.appId;
        this._application = params.application || null;

        // Install root and entry script (standalone autostart `.desktop` must not rely on cwd).
        this._appRoot = typeof params.appRoot === 'string' && params.appRoot.length > 0
            ? params.appRoot
            : GLib.get_current_dir();
        this._mainScriptPath = typeof params.mainScriptPath === 'string' && params.mainScriptPath.length > 0
            ? params.mainScriptPath
            : GLib.build_filenamev([this._appRoot, 'main.js']);

        const configHome = GLib.get_user_config_dir();
        const dataHome = GLib.get_user_data_dir();

        // Use a stable directory name that matches the project.
        this._configDir = GLib.build_filenamev([configHome, 'tasktimer']);
        this._dataDir = GLib.build_filenamev([dataHome, 'tasktimer']);

        this._ensureDirectory(this._configDir);
        this._ensureDirectory(this._dataDir);
        this._ensureDirectory(this.logDir);

        // JSON-backed settings provider for the standalone application. This
        // can be passed to higher-level settings managers so they use the
        // same ConfigProvider interface as the extension path.
        this._configProvider = params.configProvider || new Config.JSONSettingsProvider();
    }

    _ensureDirectory(path) {
        try {
            GLib.mkdir_with_parents(path, 0o755);
        } catch (e) {
            // If we cannot create the directory, log but continue; callers
            // should handle I/O failures when they occur.
            logError(e, `taskTimer: failed to create directory ${path}`);
        }
    }

    get appId() {
        return this._appId;
    }

    get version() {
        // Single source of truth: version.json (see bin/sync-version.py).
        if (AppVersion.VERSION && AppVersion.VERSION !== '0.0.0') {
            return AppVersion.VERSION;
        }
        if (_metadata && typeof _metadata.version !== 'undefined') {
            return _metadata.version;
        }
        return null;
    }

    get configDir() {
        return this._configDir;
    }

    /** Absolute directory containing `main.js` (application bundle root). */
    get appRoot() {
        return this._appRoot;
    }

    /** Absolute path to the standalone entry script (`main.js`). */
    get mainScriptPath() {
        return this._mainScriptPath;
    }

    get dataDir() {
        return this._dataDir;
    }

    get application() {
        return this._application;
    }

    get configProvider() {
        return this._configProvider;
    }
};

