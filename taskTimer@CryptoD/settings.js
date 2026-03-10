/*
 * taskTimer: Gnome Shell taskTimer Extension
 * Copyright (C) 2023 CryptoD
 *
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

const GETTEXT_DOMAIN = 'tasktimer';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

let ExtensionUtils = null;
try {
  ExtensionUtils = imports.misc.extensionUtils;
} catch (e) {
  ExtensionUtils = null;
}
const Gio = imports.gi.Gio;
const GioSSS = Gio.SettingsSchemaSource;
const GLib = imports.gi.GLib;

const Me = ExtensionUtils && typeof ExtensionUtils.getCurrentExtension === 'function'
  ? ExtensionUtils.getCurrentExtension()
  : {
      path: GLib.build_filenamev([GLib.get_current_dir(), 'taskTimer@CryptoD']),
      imports: imports['taskTimer@CryptoD'],
    };
const Utils = Me.imports.utils;
const Logger = Me.imports.logger.Logger;

// adapted from Bluetooth-quick-connect extension by Bartosz Jaroszewski
var Settings = class Settings {
  /**
   * @param {Object} provider - Optional ConfigProvider-like object. When
   *   supplied (e.g. JSONSettingsProvider), all scalar reads/writes are
   *   delegated to it. When omitted, a Gio.Settings instance is created
   *   and used directly (current extension behavior).
   */
  constructor(provider = null) {
    // If running as the GNOME Shell extension, schemas and GSettings are available.
    // In standalone mode we typically use a JSONSettingsProvider, so we skip schema compilation.
    let exit_status = 0;
    let stdout = '';
    let stderr = '';
    if (!provider) {
      try {
        // try to recompile the schema
        let compile_schemas = [ Me.path + "/bin/compile_schemas.sh" ];
        [ exit_status, stdout, stderr ] = Utils.execute(compile_schemas, undefined, GLib);
      } catch (e) {
        exit_status = 1;
        stderr = e && e.message ? e.message : String(e);
      }
    }

    // Under standalone, we don't have Gio.Settings; keep a reference only when available.
    this.settings = provider && provider._settings
      ? provider._settings
      : (ExtensionUtils && typeof ExtensionUtils.getSettings === 'function'
        ? ExtensionUtils.getSettings()
        : null);

    // Internal provider used for scalar keys. If none is supplied, fall back
    // to using the underlying Gio.Settings instance directly.
    this._provider = provider;

    this.logger = new Logger('kt settings', this.settings);

    if (!provider && exit_status !== 0) {
      this.logger.warn("Failed to compile schemas: %s\n%s", stdout, stderr);
    } else if (!provider) {
      this.logger.debug("compile_schemas: %s", stdout);
    }

    this._timer_defaults = {
      name: "",
      id: "",
      duration: 120,
      enabled: true,
      quick: false
    }
  }

  // Internal helpers to read/write scalar settings via the provider when
  // available, or via Gio.Settings otherwise. This is a minimal adaptation
  // to allow the standalone app to inject a JSONSettingsProvider without
  // disrupting the extension's existing behavior.

  _getBoolean(key) {
    if (this._provider && typeof this._provider.get_boolean === 'function') {
      return this._provider.get_boolean(key);
    }
    return this.settings.get_boolean(key);
  }

  _setBoolean(key, value) {
    if (this._provider && typeof this._provider.set_boolean === 'function') {
      this._provider.set_boolean(key, value);
    } else {
      this.settings.set_boolean(key, value);
    }
  }

  _getString(key) {
    if (this._provider && typeof this._provider.get_string === 'function') {
      return this._provider.get_string(key);
    }
    return this.settings.get_string(key);
  }

  _setString(key, value) {
    if (this._provider && typeof this._provider.set_string === 'function') {
      this._provider.set_string(key, value);
    } else {
      this.settings.set_string(key, value);
    }
  }

  _getInt(key) {
    if (this._provider && typeof this._provider.get_int === 'function') {
      return this._provider.get_int(key);
    }
    return this.settings.get_int(key);
  }

  _setInt(key, value) {
    if (this._provider && typeof this._provider.set_int === 'function') {
      this._provider.set_int(key, value);
    } else {
      this.settings.set_int(key, value);
    }
  }

  unpack_preset_timers(settings_timers=[]) {
    if (this._provider && typeof this._provider.get === 'function') {
      const timers = this._provider.get('timers') || [];
      timers.forEach(timerObj => settings_timers.push(this.unpack_timer(timerObj, false)));
      return settings_timers;
    }

    var timers = this.settings.get_value('timers').deep_unpack();
    timers.forEach(timer => settings_timers.push(this.unpack_timer(timer, false)));
    return settings_timers;
  }

  unpack_quick_timers(settings_timers=[]) {
    if (this._provider && typeof this._provider.get === 'function') {
      const timers = this._provider.get('quick-timers') || [];
      timers.forEach(timerObj => settings_timers.push(this.unpack_timer(timerObj, true)));
      return settings_timers;
    }

    var timers = this.settings.get_value('quick-timers').deep_unpack();
    timers.forEach(timer => settings_timers.push(this.unpack_timer(timer, true)));
    return settings_timers;
  }

  unpack_timers() {
    var settings_timers = this.unpack_preset_timers([]);
    if (this.save_quick_timers) {
      this.unpack_quick_timers(settings_timers);
    }
    //Utils.logObjectPretty(settings_timers);
    return settings_timers;
  }

  unpack_timer(timer_settings, quick) {
    var h={};
    // timer_settings is either a GVariant dict (GNOME Shell extension) or a plain object (standalone JSON provider).
    for (const [key, value] of Object.entries(timer_settings || {})) {
      h[key] = value && typeof value.unpack === 'function' ? value.unpack() : value;
    }
    h.quick = quick;

    for (const [key, value] of Object.entries(this._timer_defaults)) {
      if (h[key] === undefined) {
        h[key] = value;
      }
    }

    return h;
  }

  pack_preset_timers(timers) {
    if (this._provider && typeof this._provider.set === 'function') {
      const out = [];
      timers.forEach(timer => {
        if (!timer.quick && timer.duration > 0) {
          out.push({
            id: timer.id,
            name: timer.name,
            duration: timer.duration,
            enabled: timer.enabled,
          });
        }
      });
      this._provider.set('timers', out);
      return;
    }

    var atimers = [];
    timers.forEach(timer => {
      if (!timer.quick && timer.duration > 0) {
        this.logger.debug(`Saving preset timer ${timer.name}`);
        var atimer = GLib.Variant.new('a{sv}', this.pack_timer(timer, false));
        atimers.push(atimer);
      }
    });
    var glvtype = atimers.length == 0 ? GLib.Variant.new('a{sv}').get_type() : atimers[0].get_type();
    var pack = GLib.Variant.new_array(glvtype, atimers);
    this.settings.set_value('timers', pack);
  }

  pack_quick_timers(timers) {
    this.logger.debug(`Saving quick timers`);
    if (this._provider && typeof this._provider.set === 'function') {
      const out = [];
      timers.forEach(timer => {
        if (timer.quick && timer.duration > 0) {
          out.push({
            id: timer.id,
            name: timer.name,
            duration: timer.duration,
            enabled: timer.enabled,
          });
        }
      });
      this._provider.set('quick-timers', out);
      return;
    }

    var atimers = [];
    timers.forEach(timer => {
      if (timer.quick && timer.duration > 0) {
        this.logger.debug(`Saving quick timer ${timer.name}`);
        var atimer = GLib.Variant.new('a{sv}', this.pack_timer(timer, true));
        atimers.push(atimer);
      }
    });
    var glvtype = atimers.length == 0 ? GLib.Variant.new('a{sv}').get_type() : atimers[0].get_type();
    var pack = GLib.Variant.new_array(glvtype, atimers);
    this.settings.set_value('quick-timers', pack);
  }

  // aa{sv}
  pack_timers(timers) {
    if (this._provider && typeof this._provider.set === 'function') {
      const presets = [];
      const quick = [];
      timers.forEach(timer => {
        if (timer.duration <= 0) return;
        const obj = {
          id: timer.id,
          name: timer.name,
          duration: timer.duration,
          enabled: timer.enabled,
        };
        if (timer.quick) quick.push(obj);
        else presets.push(obj);
      });
      this._provider.set('timers', presets);
      if (this.save_quick_timers) {
        this._provider.set('quick-timers', quick);
      }
      return;
    }

    // create and array of GLib.Variant dicts with string key and GVariant values
    var atimers = [];
    timers.forEach( (timer) => {
      if (!timer.quick && timer.duration > 0) {
        this.logger.debug("Saving preset timer %s:%s", timer.name, timer.id);
        var atimer = GLib.Variant.new('a{sv}', this.pack_timer(timer, false));
        atimers.push(atimer);
      }
    });
    var glvtype = atimers.length == 0 ? GLib.Variant.new('a{sv}').get_type() : atimers[0].get_type();
    var pack = GLib.Variant.new_array(glvtype, atimers);
    this.settings.set_value('timers', pack);

    if (this.save_quick_timers) {
      this.logger.debug(`Saving quick timers`);
      var atimers = [];
      timers.forEach( (timer) => {
        if (timer.quick && timer.duration > 0) {
          this.logger.debug(`Saving quick timer ${timer.name}`);
          var atimer = GLib.Variant.new('a{sv}', this.pack_timer(timer, true));
          atimers.push(atimer);
        }
      });
      var glvtype = atimers.length == 0 ? GLib.Variant.new('a{sv}').get_type() : atimers[0].get_type();
      var pack = GLib.Variant.new_array(glvtype, atimers);
      this.settings.set_value('quick-timers', pack);
    }
  }

  pack_timer(timer, quick) {
    if (timer.quick != quick) {
      this.logger.debug(`Don't pack timer ${timer.name} ${timer.quick}`);
      return undefined;
    }
    var dict = {};
    dict.id = GLib.Variant.new_string(timer.id);
    dict.name = GLib.Variant.new_string(timer.name);
    dict.duration = GLib.Variant.new_int64(timer.duration);
    dict.enabled = GLib.Variant.new_boolean(timer.enabled);
    return dict;
  }

  export_json() {
    this.logger.info("Export settings to json");
    var h={
      accel_enable: this.accel_enable,
      accel_show_endtime: this.accel_show_endtime,
      accel_stop_next: this.accel_stop_next,
      debug: this.debug,
      detect_dupes: this.detect_dupes,
      inhibit: this.inhibit,
      inhibit_max: this.inhibit_max,
      notification_sticky: this.notification_sticky,
      notification: this.notification,
      notification_longtimeout: this.notification_longtimeout,
      play_sound: this.play_sound,
      prefer_presets: this.prefer_presets,
      save_quick_timers: this.save_quick_timers,
      show_endtime: this.show_endtime,
      show_label: this.show_label,
      show_progress: this.show_progress,
      show_time: this.show_time,
      sort_by_duration: this.sort_by_duration,
      sort_descending: this.sort_descending,
      sound_file: this.sound_file,
      sound_loops: this.sound_loops,
      volume_level_warn: this.volume_level_warn,
      volume_threshold: this.volume_threshold,
      quick_timers: this.unpack_quick_timers([]),
      timers: this.unpack_preset_timers([])
    }
    return JSON.stringify(h, null, 2);
  }

  import_json(json) {
    this.logger.info("Import json to settings");
    var obj = JSON.parse(json.replace( /[\r\n]+/gm, " "));
    for (let [key, value] of Object.entries(obj)) {
      key=key.replace(/_/g, '-');
      this.logger.info("Import setting %s=%s (%s)", key, value, value.constructor.name);
      switch(key) {
        case 'timers':
          this.pack_preset_timers(value);
          break;
        case 'quick-timers':
          this.pack_quick_timers(value);
          break;
        case 'accel-show-endtime':
        case 'accel-stop-next':
        case 'sound-file':
          this.settings.set_string(key, value);
          break;
        case 'sound-loops':
        case 'notification-longtimeout':
        case 'prefer-presets':
        case 'inhibit':
        case 'inhibit-max':
          this.settings.set_int(key, value);
          break;
        default:
          this.settings.set_boolean(key, value);
          break;
      }

    }
  }

  get_default(key) {
    return this.settings.get_default_value(key);
  }

  get accel_enable() {
    return this._getBoolean('accel-enable');
  }

  set accel_enable(bool) {
    this._setBoolean('accel-enable', bool);
  }

  get accel_show_endtime() {
    return this._getString('accel-show-endtime');
  }

  set accel_show_endtime(val) {
    this._setString('accel-show-endtime', val);
  }

  get accel_stop_next() {
    return this._getString('accel-stop-next');
  }

  set accel_stop_next(val) {
    this._setString('accel-stop-next', val);
  }

  get minimize_to_tray() {
    return this._getBoolean('minimize-to-tray');
  }

  set minimize_to_tray(bool) {
    this._setBoolean('minimize-to-tray', bool);
  }

  get inhibit() {
    return this._getInt('inhibit');
  }

  set inhibit(val) {
    this._setInt('inhibit', val);
  }

  get inhibit_max() {
    return this._getInt('inhibit-max');
  }

  set inhibit_max(val) {
    this._setInt('inhibit-max', val);
  }

  get notification() {
    return this._getBoolean('notification');
  }

  set notification(bool) {
    this._setBoolean('notification', bool);
  }

  get notification_sticky() {
    return this._getBoolean('notification-sticky');
  }

  set notification_sticky(bool) {
    this._setBoolean('notification-sticky', bool);
  }

  get notification_longtimeout() {
    return this._getInt('notification-longtimeout');
  }

  set notification_longtimeout(val) {
    this._setInt('notification-longtimeout', val);
  }

  get show_time() {
    return this._getBoolean('show-time');
  }

  set show_time(bool) {
    this._setBoolean('show-time', bool);
  }

  get show_endtime() {
    return this._getBoolean('show-endtime');
  }

  set show_endtime(bool) {
    this._setBoolean('show-endtime', bool);
  }

  get show_label() {
    return this._getBoolean('show-label');
  }

  set show_label(bool) {
    this._setBoolean('show-label', bool);
  }

  get show_progress() {
    return this._getBoolean('show-progress');
  }

  set show_progress(bool) {
    this._setBoolean('show-progress', bool);
  }

  get play_sound() {
    return this._getBoolean('play-sound');
  }

  set play_sound(bool) {
    this._setBoolean('play-sound', bool);
  }

  get sound_loops() {
    return this._getInt('sound-loops');
  }

  set sound_loops(loops) {
    this._setInt('sound-loops', loops);
  }

  get sound_file() {
    return this.settings.get_string('sound-file');
  }

  set sound_file(path) {
    this.settings.set_string('sound-file', path);
  }

  get timers() {
    if (this._provider && typeof this._provider.get === 'function') {
      return this._provider.get('timers') || [];
    }
    return this.settings.get_value('timers').deep_unpack();
  }

  get default_timer() {
    return this._getInt('default-timer');
  }

  set default_timer(val) {
    this._setInt('default-timer', val);
  }

  get sort_by_duration() {
    return this._getBoolean('sort-by-duration');
  }

  set sort_by_duration(bool) {
    this._setBoolean('sort-by-duration', bool);
  }

  get sort_descending() {
    return this._getBoolean('sort-descending');
  }

  set sort_descending(bool) {
    this._setBoolean('sort-descending', bool);
  }

  get save_quick_timers() {
    return this._getBoolean('save-quick-timers');
  }

  set save_quick_timers(bool) {
    this._setBoolean('save-quick-timers', bool);
  }

  get detect_dupes() {
    return this._getBoolean('detect-dupes');
  }

  set detect_dupes(bool) {
    this._setBoolean('detect-dupes', bool);
  }

  get running() {
    return this._getString('running');
  }

  set running(json) {
    this._setString('running', json);
  }

  get run_states() {
    try {
      const runningJson = this.settings.get_string('running');
      if (!runningJson || runningJson === '[]') {
        return [];
      }
      return JSON.parse(runningJson);
    } catch (e) {
      this.logger.warn('Failed to parse running timers JSON: %s', e.message);
      return [];
    }
  }

  get volume_level_warn() {
    return this._getBoolean('volume-level-warn');
  }

  set volume_level_warn(bool) {
    this._setBoolean('volume-level-warn', bool);
  }

  get volume_threshold() {
    return this._getInt('volume-threshold');
  }

  set volume_threshold(val) {
    this._setInt('volume-threshold', val);
  }

  get prefer_presets() {
    return this._getInt('prefer-presets');
  }

  set prefer_presets(val) {
    if (val > 10) { val = 10; }
    else if (val < -10) { val = -10; }
    this._setInt('prefer-presets', val);
  }

  get debug() {
    return this._getBoolean('debug');
  }

  set debug(bool) {
    this._setBoolean('debug', bool);
  }

};
