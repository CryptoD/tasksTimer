/*
 * taskTimer: Gnome Shell taskTimer Extension
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

const GLib = imports.gi.GLib;
const LOGID = 'logger';

String.prototype.format = imports.format.format;

var Logger = class Logger {
    constructor(logid=undefined, settings=undefined) {
        this._logid = logid === undefined ? LOGID : logid;
        this._settings = settings;
        // simple in-memory buffer of recent log messages to help with export
        if (!Logger._buffer) Logger._buffer = [];
        this._buffer = Logger._buffer;
    }

    _log(level, format, ...args) {
      var msg = (Array.isArray(args) && args.length > 0) ? format.format(...args) : format;
      var full = `${level}: [${this._logid}] ${msg}`;
      log(full);
      try {
        // keep a limited buffer (e.g. last 200 messages)
        this._buffer.push(full);
        if (this._buffer.length > 200) this._buffer.shift();
      } catch (e) {
        // ignore buffering errors
      }
      return msg;
    }

    get settings() {
      return this._settings;
    }

    set settings(settings) {
      this._settings = settings;
    }

    get debugging() {
      return this.settings === undefined ? false : this.settings.debug;
    }

    debug(format, ...args) {
      if (!this.debugging) return;
      return this._log("DEBUG", format, ...args);
    }

    warn(format, ...args) {
      return this._log("WARNING", format, ...args);
    }

    info(format, ...args) {
      return this._log("INFO", format, ...args);
    }

    error(format, ...args) {
      return this._log("ERROR", format, ...args);
    }

    // Export buffered logs to a file. Returns true on success.
    exportToFile(path) {
      try {
        let contents = this._buffer.join('\n');
        GLib.file_set_contents(path, contents);
        return true;
      } catch (e) {
        this.error('Failed to write logs to %s: %s', path, e);
        return false;
      }
    }

    // Convenience: return buffered logs as string
    getBufferedLogs() {
      return this._buffer.join('\n');
    }
};

