/*
 * Kitchen Timer: Gnome Shell Kitchen Timer Extension
 * Copyright (C) 2021 Steeve McCauley
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

const GETTEXT_DOMAIN = 'tasksTimer-CryptoD';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

String.prototype.format = imports.format.format;

const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;

const Config = imports.misc.config;
const [major] = Config.PACKAGE_VERSION.split('.');
const shellVersion = Number.parseInt(major);

function isGnome3x() {
  return (shellVersion < 40);
}

function isGnome40() {
  return (shellVersion >= 40);
}

function logObjectPretty(obj) {
  log(JSON.stringify(obj, null, 2));
}

var clearTimeout, clearInterval;
clearTimeout = clearInterval = GLib.Source.remove;

function setTimeout(func, delay, ...args) {
  const wrappedFunc = () => {
    func.apply(this, args);
    return false;
  };
  return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, wrappedFunc);
}

function setInterval(func, delay, ...args) {
  const wrappedFunc = () => {
    return func.apply(this, args);
  };
  return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, wrappedFunc);
}

function spawn(command, callback) {
  var [status, pid] = GLib.spawn_async(
      null,
      ['/usr/bin/env', 'bash', '-c', command],
      null,
      GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
      null
  );

  if (callback) {
    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, callback);
  }
}

function execute(cmdargs, params = {}) {
  //... Rest of the function code
}

function uuid(id) {
  //... Rest of the function code
}

function isDebugModeEnabled() {
  //... Rest of the function code
}

function addSignalsHelperMethods(prototype) {
  //... Rest of the function code
}

var Utils = {
  getStoredTimers: function() {
    // Your implementation here
  },
  // other utility functions
};


const Gio = imports.gi.Gio;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

function getSettings() {
  const GioSSS = Gio.SettingsSchemaSource;
  let schemaDir = Me.dir.get_child('schemas').get_path();
  let schemaSource = GioSSS.new_from_directory(schemaDir, GioSSS.get_default(), false);
  let schemaObj = schemaSource.lookup('org.gnome.shell.extensions.tasksTimer', true);
  if (!schemaObj) {
      throw new Error("Schema not found");
  }
  return new Gio.Settings({ settings_schema: schemaObj });
}
