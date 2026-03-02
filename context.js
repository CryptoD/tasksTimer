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

// Path to the extension metadata, used as a source of name/description/version
// information until a dedicated standalone metadata file is introduced.
const METADATA_PATH = GLib.build_filenamev([
    GLib.get_current_dir(),
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

        const configHome = GLib.get_user_config_dir();
        const dataHome = GLib.get_user_data_dir();

        // Use a stable directory name that matches the project.
        this._configDir = GLib.build_filenamev([configHome, 'tasktimer']);
        this._dataDir = GLib.build_filenamev([dataHome, 'tasktimer']);

        this._ensureDirectory(this._configDir);
        this._ensureDirectory(this._dataDir);
        this._ensureDirectory(this.logDir);
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
        // Prefer version from metadata.json if available.
        if (_metadata && typeof _metadata.version !== 'undefined') {
            return _metadata.version;
        }
        return null;
    }

    get configDir() {
        return this._configDir;
    }

    get dataDir() {
        return this._dataDir;
    }

    get application() {
        return this._application;
    }
};

