/*
 * taskTimer: Gnome Shell taskTimer Extension
 * Copyright (C) 2023 CryptoD
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

// Environment-agnostic logger:
// - Avoids direct GNOME Shell imports so it can run in standalone JS.
// - Uses GNOME/GJS facilities when available, otherwise falls back to
//   standard JS APIs (console, Node's fs when present).

let GLib = null;
if (typeof imports !== 'undefined' && imports.gi && imports.gi.GLib) {
  GLib = imports.gi.GLib;
}

const LOGID = 'logger';

if (typeof String.prototype.format !== 'function') {
  if (typeof imports !== 'undefined' && imports.format && imports.format.format) {
    String.prototype.format = imports.format.format;
  } else {
    // Basic %s / %d formatter as a fallback.
    String.prototype.format = function (...args) {
      let idx = 0;
      return this.replace(/%[sd]/g, () => {
        const val = idx < args.length ? args[idx++] : '';
        return String(val);
      });
    };
  }
}

const _log = (typeof log === 'function')
  ? log
  : (...args) => {
      // Fallback for non-GNOME environments.
      if (typeof console !== 'undefined' && console.log) {
        console.log(...args);
      }
    };

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
      _log(full);
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
        if (GLib) {
          GLib.file_set_contents(path, contents);
          return true;
        }

        // Try Node.js fs when available.
        if (typeof require === 'function') {
          try {
            const fs = require('fs');
            fs.writeFileSync(path, contents, 'utf8');
            return true;
          } catch (e) {
            // Fall through to generic error handling below.
          }
        }

        // If neither GLib nor fs is available, signal failure.
        throw new Error('No suitable file API available to export logs');
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

