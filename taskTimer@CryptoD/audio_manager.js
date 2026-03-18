/*
 * taskTimer AudioManager
 *
 * Shared GStreamer-based audio playback for alarm sounds. This module is
 * designed to work both in the GNOME Shell extension and in the standalone
 * GTK application by avoiding direct dependence on Shell-only globals and
 * by locating the extension directory similarly to settings.js.
 */

imports.gi.versions.Gst = '1.0';

const { GLib, Gst } = imports.gi;

let Me = null;
try {
    const ExtensionUtils = imports.misc.extensionUtils;
    Me = ExtensionUtils.getCurrentExtension();
} catch (e) {
    // Standalone gjs fallback: assume we're running from the project root
    // and that the extension code lives in a taskTimer@CryptoD subdirectory.
    Me = {
        path: GLib.build_filenamev([GLib.get_current_dir(), 'taskTimer@CryptoD']),
        imports: imports['taskTimer@CryptoD'],
    };
}

const Logger = Me.imports.logger.Logger;

/**
 * Small helper that manages one GStreamer playbin instance with loop
 * semantics suitable for timer alarms. AudioManager maintains a collection
 * of these players keyed by an arbitrary id (typically timer.id).
 */
class AudioPlayer {
    constructor(params) {
        this._id = params.id;
        this._logger = params.logger;
        this._settings = params.settings;
        this._soundFile = params.soundFile;
        this._loopsTarget = params.loops; // 0 => infinite

        this._player = null;
        this._bus = null;
        this._uri = null;
        this._loopsDone = 0;
        this._isPlaying = false;
        this._destroyed = false;
    }

    /**
     * Resolve a candidate basename inside an AppImage bundle when running
     * under $APPDIR. This prefers paths under $APPDIR/taskTimer@CryptoD
     * and falls back to $APPDIR itself.
     */
    _resolveInAppDir(basename) {
        const appDir = GLib.getenv('APPDIR');
        if (!appDir || !basename || basename.length === 0) {
            return null;
        }

        const candidates = [
            GLib.build_filenamev([appDir, 'taskTimer@CryptoD', basename]),
            GLib.build_filenamev([appDir, basename]),
        ];

        for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i];
            if (GLib.file_test(candidate, GLib.FileTest.EXISTS)) {
                return candidate;
            }
        }

        return null;
    }

    /**
     * Build a file:// URI for the configured sound file.
     *
     * Resolution order:
     *   1. User-selected absolute path, if it exists.
     *   2. If running as an AppImage ($APPDIR), look for a bundled file
     *      under $APPDIR/taskTimer@CryptoD/<basename> or $APPDIR/<basename>.
     *   3. Fallback to a file in the extension directory (Me.path) using
     *      the default sound-file setting as the basename when available.
     */
    _buildUri() {
        let path = this._soundFile;
        if (!path || path.length === 0) {
            return null;
        }

        // 1. If user configured an absolute path and it exists, prefer it.
        if (GLib.path_is_absolute(path) && GLib.file_test(path, GLib.FileTest.EXISTS)) {
            return 'file://' + path;
        }

        // 2. Determine a reasonable basename, optionally using the default.
        let base = GLib.path_get_basename(path);
        // Prefer the Settings wrapper value (works under JSON provider) rather
        // than Gio.Settings default_value (not available in standalone).
        try {
            const configured = this._settings && this._settings.sound_file ? String(this._settings.sound_file) : '';
            if (configured) {
                const defBase = GLib.path_get_basename(configured);
                if (defBase && (!base || base === path)) {
                    base = defBase;
                }
            }
        } catch (_e) {
            // ignore; we'll fall back to the original basename
        }

        // 2a. If running inside an AppImage, try bundled locations first.
        const appDirPath = this._resolveInAppDir(base);
        if (appDirPath) {
            return 'file://' + appDirPath;
        }

        // 3. Fallback to the extension directory (extension or unpacked tree).
        const tryBasenames = [];
        tryBasenames.push(base);
        // Backward-compatible mapping for older default name.
        if (base === 'tasktimer-default.ogg') {
            tryBasenames.push('kitchen_timer.ogg');
        }
        for (let i = 0; i < tryBasenames.length; i++) {
            const extPath = GLib.build_filenamev([Me.path, tryBasenames[i]]);
            if (GLib.file_test(extPath, GLib.FileTest.EXISTS)) {
                return 'file://' + extPath;
            }
        }

        this._logger && this._logger.error('AudioManager: could not resolve sound file for %s (base=%s)', this._id, base);
        return null;
    }

    _ensurePlayer() {
        if (this._player) {
            return;
        }

        this._uri = this._buildUri();
        if (!this._uri) {
            this._logger && this._logger.error('AudioManager: no valid sound URI; skipping playback');
            return;
        }

        this._logger && this._logger.debug('AudioManager: init player id=%s uri=%s', this._id, this._uri);
        Gst.init(null);
        this._player = Gst.ElementFactory.make('playbin', 'tasktimer-player-' + this._id);
        if (!this._player) {
            this._logger && this._logger.error('AudioManager: failed to create playbin element');
            return;
        }

        this._bus = this._player.get_bus();
        if (this._bus) {
            this._bus.add_signal_watch();
            this._bus.connect('message', (bus, message) => {
                if (!message || !this._player) {
                    return;
                }
                const type = message.type;
                if (type === Gst.MessageType.EOS || type === Gst.MessageType.ERROR) {
                    // IMPORTANT: to reuse the player, set state to READY
                    this._player.set_state(Gst.State.READY);
                    this._isPlaying = false;

                    if (this._destroyed) {
                        this._logger && this._logger.debug('AudioManager: player %s destroyed, stopping playback', this._id);
                        return;
                    }

                    if (this._loopsTarget === 0 || this._loopsDone < this._loopsTarget) {
                        this._startPlayback();
                    } else {
                        this._logger && this._logger.debug('AudioManager: player %s reached loop limit', this._id);
                    }
                }
            });
        }
    }

    _startPlayback() {
        if (!this._player) {
            return false;
        }

        if (this._isPlaying) {
            return true;
        }

        if (this._loopsTarget > 0 && this._loopsDone >= this._loopsTarget) {
            return false;
        }

        try {
            this._player.set_property('uri', this._uri);
            this._player.set_state(Gst.State.PLAYING);
            this._loopsDone++;
            this._isPlaying = true;
            return true;
        } catch (e) {
            this._logger && this._logger.error('AudioManager: error playing sound for %s: %s', this._id, e.message);
            this._isPlaying = false;
            return false;
        }
    }

    /**
     * Begin or resume looping playback for this player.
     */
    play() {
        this._destroyed = false;
        this._loopsDone = 0;
        this._ensurePlayer();
        return this._startPlayback();
    }

    /**
     * Stop playback and mark the player as destroyed so the bus handler
     * does not restart it.
     */
    stop() {
        this._destroyed = true;
        if (this._player) {
            try {
                this._player.set_state(Gst.State.READY);
            } catch (e) {
                this._logger && this._logger.warn('AudioManager: failed to stop player %s: %s', this._id, e.message);
            }
        }
        this._isPlaying = false;
    }
}

/**
 * AudioManager orchestrates AudioPlayer instances keyed by id (usually a
 * timer id). Call playTimerAlarm() when a timer expires and stopTimerAlarm()
 * when the timer is acknowledged/dismissed.
 */
var AudioManager = class AudioManager {
    /**
     * @param {Object} params
     *   - settings: Settings instance (used for defaults like sound-file)
     *   - logger: optional Logger instance; a local one is created if omitted
     */
    constructor(params = {}) {
        this._settings = params.settings || null;
        this.logger = params.logger || new Logger('kt audio', this._settings);
        this._players = new Map(); // id -> AudioPlayer
    }

    /**
     * Compute loop count for a timer based on the persist_alarm flag and
     * global sound_loops setting. When sound_loops is 0 and notifications
     * are disabled, we fall back to 2 loops to avoid infinite playback
     * with no visible notification.
     *
     * @param {Object} timer - Timer/TimerCore instance with persist_alarm
     * @returns {number} loops (0 for infinite)
     */
    _loopsForTimer(timer) {
        if (!this._settings) {
            return 0;
        }

        let loops = timer && timer.persist_alarm ? 0 : this._settings.sound_loops;

        if (this._settings.notification === false && loops === 0) {
            loops = 2;
        }

        return loops;
    }

    /**
     * Play an alarm sound for the given timer, honoring configuration
     * like sound_loops and persist_alarm.
     *
     * @param {Object} timer - Timer/TimerCore with id, persist_alarm
     * @param {Object} [options]
     *   - soundFile: override path; defaults to settings.sound_file
     */
    playTimerAlarm(timer, options = {}) {
        if (!timer || !timer.id) {
            return;
        }
        if (!this._settings || !this._settings.play_sound) {
            return;
        }

        const id = String(timer.id);
        const soundFile = options.soundFile || (this._settings && this._settings.sound_file);
        if (!soundFile) {
            this.logger.warn('AudioManager: no sound file configured; skipping playback for %s', id);
            return;
        }

        const loops = this._loopsForTimer(timer);

        let player = this._players.get(id);
        if (!player) {
            player = new AudioPlayer({
                id,
                logger: this.logger,
                settings: this._settings,
                soundFile,
                loops,
            });
            this._players.set(id, player);
        }

        player._soundFile = soundFile;
        player._loopsTarget = loops;

        player.play();
    }

    /**
     * Stop any active alarm playback for the given timer.
     *
     * @param {Object|string} timerOrId - timer object or plain id string
     */
    stopTimerAlarm(timerOrId) {
        const id = typeof timerOrId === 'string'
            ? timerOrId
            : (timerOrId && timerOrId.id ? String(timerOrId.id) : null);
        if (!id) {
            return;
        }

        const player = this._players.get(id);
        if (!player) {
            return;
        }
        player.stop();
    }
};

