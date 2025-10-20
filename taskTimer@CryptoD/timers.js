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

const GETTEXT_DOMAIN = 'tasktimer';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {GLib, St, Clutter, Gio} = imports.gi;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

const Utils = Me.imports.utils;
const Settings = Me.imports.settings.Settings;
const Notifier = Me.imports.notifier;
const Logger = Me.imports.logger.Logger;
const HMS = Me.imports.hms.HMS;
const AlarmTimer = Me.imports.alarm_timer.AlarmTimer;
const SessionManagerInhibitor = Me.imports.inhibitor.SessionManagerInhibitor;
const KeyboardShortcuts = Me.imports.keyboard_shortcuts.KeyboardShortcuts;
const ProgressIcon = Me.imports.progress_icon.ProgressIcon;

const Storage = Me.imports.storage.Storage;
const TIMERS_SAVE_PATH = GLib.get_user_data_dir() + '/taskTimer@CryptoD/timers.json';

// Utility to save all timers
function saveAllTimers(timersInstance) {
    // Save all timers (active, expired, etc.)
    const timersData = timersInstance.map(timer => (typeof timer.toJSON === 'function' ? timer.toJSON() : timer));
    Storage.saveJSON(TIMERS_SAVE_PATH, timersData);
}

// Utility to load all timers
function loadAllTimers() {
    const timersData = Storage.loadJSON(TIMERS_SAVE_PATH);
    if (!timersData) return [];

    // Convert the loaded data back to Timer objects
    return timersData.map(timerData => {
        if (typeof timerData === 'object' && timerData !== null) {
            return Timer.fromJSON(timerData);
        }
        return timerData;
    });
}

const date_options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
const mixerControl = imports.ui.status.volume.getMixerControl();

var Timers = class Timers extends Array {
  constructor(...args) {
    super(...args);

    // id => timer
    this._lookup = {};

    this._settings = new Settings();
    this._attached = false;
    this.accel = new KeyboardShortcuts(this.settings);
    this.logger = new Logger('kt timers', this.settings);
    this._progressIcon = new ProgressIcon(this.logger);

    try {
      // Preference order for icons: tasktimer-* first, then kitchen-timer-blackjackshellac-*
      const iconFiles = [
        'tasktimer-full.png',
        'tasktimer-full.svg',
        'kitchen-timer-blackjackshellac-full.png',
        'kitchen-timer-blackjackshellac-full.svg'
      ];

      let iconFound = false;
      for (const iconFile of iconFiles) {
        const iconPath = `${Me.path}/icons/${iconFile}`;
        if (GLib.file_test(iconPath, GLib.FileTest.EXISTS)) {
          this._fullIcon = Gio.icon_new_for_string(iconPath);
          iconFound = true;
          break;
        }
      }
      if (!iconFound) {
        this.logger.warn('Failed to load icons');
        this._fullIcon = Gio.icon_new_for_string('image-missing-symbolic');
      }
    } catch (e2) {
      this.logger.warn('Failed to load icons: ' + e2.message);
      this._fullIcon = Gio.icon_new_for_string('image-missing-symbolic');
    }

    // requires this._settings
    this._notifier = new Notifier.Annoyer(this);
    this._inhibitor = new SessionManagerInhibitor(this.settings);
  }

  static attach(indicator) {
    if (!timersInstance) {
        timersInstance = new Timers();
    }
    // reload settings
    timersInstance._settings = new Settings();
    timersInstance._inhibitor.settings = timersInstance._settings;

    timersInstance.logger.settings = timersInstance._settings;

    timersInstance.logger.info("Attaching indicator");

    timersInstance.indicator = indicator;

    timersInstance.refresh();

    if (timersInstance.sort_by_running().length === 0) {
      timersInstance.set_panel_name('taskTimer');
    }
    timersInstance.settings.settings.connect('changed::accel-enable', () => {
      timersInstance.logger.debug('accel-enable has changed');
      timersInstance.toggle_keyboard_shortcuts();
    });

    if (timersInstance.settings.accel_enable) {
      timersInstance.enable_keyboard_shortcuts();
    }

    timersInstance.attached = true;

    timersInstance.warn_volume = true;

    return timersInstance;
  }

  static detach() {
    if (!timersInstance) {
        return;
    }
    timersInstance.logger.info("Detaching indicator from timers");
    timersInstance.attached = false;
    timersInstance.indicator = undefined;
  }

  static getInstance() {
    return timersInstance;
  }

  toggle_keyboard_shortcuts() {
    if (this.settings.accel_enable) {
      this.enable_keyboard_shortcuts();
    } else {
      this.disable_keyboard_shortcuts();
    }
  }

  enable_keyboard_shortcuts() {
    this.accel.listenFor(this.settings.accel_show_endtime, () => {
      let set=!this.settings.show_endtime;
      this.logger.debug("Toggling show endtime to %s", set);
      this.settings.show_endtime = set;
    });

    this.accel.listenFor(this.settings.accel_stop_next, () => {
      this.stop_next();
    });
  }

  disable_keyboard_shortcuts() {
    this.accel.remove(this.settings.accel_show_endtime);
    this.accel.remove(this.settings.accel_stop_next);
  }

  get indicator() {
    return this._indicator;
  }

  set indicator(indicator) {
    this._indicator = indicator;
  }

  get attached() {
    return this._attached;
  }

  set attached(bool) {
    this._attached = bool;
  }

  progress_gicon(degrees) {
    return this._progressIcon.get(degrees);
  }

  get fullIcon() {
    return this._fullIcon;
  }

  get notifier() {
    return this._notifier;
  }

  get inhibitor() {
    return this._inhibitor;
  }

  get settings() {
    return this._settings;
  }

  inc_prefer_presets(inc) {
    this.settings.prefer_presets += inc;
    this.logger.debug("prefer_presets=%d", this.settings.prefer_presets);
  }

  get box() {
    return this.indicator === undefined ? undefined : this.indicator._box;
  }

  get panel_name() {
    return this.indicator === undefined ? undefined : this.indicator._panel_name;
  }

  get panel_label() {
    return this.indicator === undefined ? undefined : this.indicator._panel_label;
  }

  set_panel_name(text, has_name=true) {
    var label = this.panel_name;
    if (label) {
      label.set_text((text === 'taskTimer' || (this.settings.show_label && has_name && text.length > 0)) ? text : "");
    }
  }

  set_panel_label(text) {
    var label = this.panel_label;
    if (label) {
      label.set_text(this.settings.show_time ? text : "");
    }
  }

  refresh() {
    this.logger.debug("Timers refresh");

    // First, load any saved timers from storage
    const savedTimers = loadAllTimers();
    if (savedTimers && savedTimers.length > 0) {
      this.logger.debug(`Loaded ${savedTimers.length} timers from storage`);
      savedTimers.forEach(timer => {
        if (!this.lookup(timer.id)) {
          this.add(timer);
          this.logger.debug(`Added saved timer: ${timer.name}`);
        }
      });
    }

    // Then load timers from settings
    var settings_timers = this.settings.unpack_timers();
    settings_timers.forEach( (settings_timer) => {
      var id=settings_timer.id;
      var timer = this.lookup(id);
      if (timer) {
        timer.refresh_with(settings_timer);
        this.logger.debug("Found %s timer [%s]: %s",
            (timer.quick ? "quick" : "preset"),
            timer.name,
            (timer.running ? "running" : "not running"));
      } else {
        //this.logger.debug("Timer [%s] not found, id=%s", settings_timer.name, settings_timer.id);
        timer = Timer.fromSettingsTimer(settings_timer);
        settings_timer.id = timer.id;
        this.add(timer);
      }
    });

    // Restore any running timers
    this.restoreRunningTimers();

    // Clean up any invalid timers
    for (let i = 0; i < this.length; i++) {
      var timer=this[i];
      if (timer.still_valid(settings_timers)) {
        continue;
      }
      if (this.remove(timer, i)) {
        i--;
      }
    }
  }

  saveRunningTimers() {
    var running=[];
    this.sort_by_running().forEach( (timer) => {
      if (timer.running) {
        this.logger.debug("Saving running timer state id=%s start=%d end=%d", timer.id, timer._start, timer._end);
        var run_state = {
          id: timer.id,
          start: timer._start,
          end: timer._end,  // Save the end time
          persist: timer.persist_alarm
        }
        if (timer.alarm_timer) {
          run_state.alarm_timer = timer.alarm_timer.save();
        }
        running.push(run_state);
      }
    });
    this.settings.running = JSON.stringify(running);
  }

  restoreRunningTimers() {
    let run_states = this.settings.run_states;
    if (!run_states || run_states.length === 0) {
      this.logger.debug("No running timers to restore");
      return;
    }

    for (let run_state of run_states) {
      let timer = this.lookup(run_state.id);
      if (!timer) {
        this.logger.warn(`Timer with id ${run_state.id} not found during restoreRunningTimers.`);
        continue;
      }

      timer.persist_alarm = run_state.persist;
      if (timer.alarm_timer) {
        timer.alarm_timer = AlarmTimer.restore(run_state.alarm_timer);
      }

      // Use saved _end time to determine if timer is still active
      const now = Date.now();

      // Restore the original start and end times
      timer._start = run_state.start;

      // If end time was saved, use it; otherwise calculate it from start + duration
      if (run_state.end) {
        timer._end = run_state.end;
      } else {
        timer._end = timer._start + timer.duration_ms();
      }

      if (timer._end > now) {
        // Set up volume monitoring if enabled (similar to go() method)
        if (this.settings.play_sound && this.settings.volume_level_warn) {
          let stream = mixerControl.get_default_sink();
          if (stream) {
            if (timer.notify_volume === undefined) {
              timer.notify_volume = stream.connect('notify::volume', timer.check_volume.bind(timer));
            }
            if (timer.notify_muted === undefined) {
              timer.notify_muted = stream.connect('notify::is-muted', timer.check_volume.bind(timer));
            }
          }
        }

        // Set up volume warning state
        this.warn_volume = true;
        timer.check_volume();

        // Directly restart the interval with the existing _end time
        timer._interval_id = Utils.setInterval(timer.timer_callback, timer._interval_ms, timer);
        timer._state = TimerState.RUNNING;

        // Set up session inhibitor for restored running timer
        timersInstance.inhibitor.inhibit_timer(timer);

        this.logger.debug(`Restored timer: ${timer.toString()}, remaining: ${Math.round((timer._end - now)/1000)} seconds`);
      } else {
        // Timer has expired during downtime - trigger the completion notification
        const tdiff = now - timer._end;
        timer.expired = true;
        timer._state = TimerState.EXPIRED;

        // Show notification for expired timer
        const reason = _("Timer completed %s late at").format(new HMS(tdiff/1000).toString(true));
        const time = new Date(now).toLocaleTimeString();
        const text = "%s due at %s".format(timer.name, timer.end_time());

        timersInstance.notifier.notify(timer, text, "%s %s", reason, time);

        this.logger.debug(`Timer expired during downtime: ${timer.toString()}, was late by ${Math.round(tdiff/1000)} seconds`);
      }
    }
  }

  lookup(id) {
    if (id === undefined || id.length === 0) {
      // new timer, not in lookup yet
      return undefined;
    }
    if (this._lookup[id] !== undefined) {
      return this._lookup[id];
    }
    if (this.attached) {
      this.logger.debug("timer %s not found in lookup table - shouldn't happen", id);
    }

    // this shouldn't happen

    for (let i=0; i < this.length; i++) {
      var t=this[i];
      if (t.id == id) {
        this.logger.warn("adding timer to lookup hash %s:%s", t.name, t.id);
        this._lookup[id] = t;
        return t;
      }
    }
  }

  // Called during restore after loading timers from storage, to handle expired timers
  restoreExpiredTimer(timer, now) {
    // Timer has expired during downtime - trigger the completion notification
    const tdiff = now - timer._end;
    timer.expired = true;
    timer._state = TimerState.EXPIRED;

    // Check if we already have an active notification for this timer
    if (timersInstance.notifier && timersInstance.notifier._activeNotifications &&
        timersInstance.notifier._activeNotifications.has(timer.id)) {
      this.logger.debug("Skipping duplicate notification for expired timer during restore: %s", timer.name);
      return;
    }

    // Show notification for expired timer
    const reason = _("Timer completed %s late at").format(new HMS(tdiff/1000).toString(true));
    const time = new Date(now).toLocaleTimeString();
    const text = "%s due at %s".format(timer.name, timer.end_time());

    timersInstance.notifier.notify(timer, text, "%s %s", reason, time);

    this.logger.debug(`Timer expired during downtime: ${timer.toString()}, was late by ${Math.round(tdiff/1000)} seconds`);
    if (this.attached) {
      this.logger.debug("Timer id=[%s] not found", id);
    }
    return undefined;
  }

  isEmpty() {
    return this.length === 0;
  }

  get sort_by_duration() {
    return this.settings.sort_by_duration;
  }

  get sort_descending() {
    return this.settings.sort_descending;
  }

  // list of enabled timers sorted according to the sort properties
  sorted(params={running:true}) {
    // const cloneSheepsES6 = [...sheeps];
    var timers_array = [...this];
    if (!params.running) {
      timers_array=timers_array.filter(timer => !timer.running);
    }
    if (this.sort_by_duration) {
      this.logger.debug('sort by duration');
      var direction= this.sort_descending ? -1 : 1;
      timers_array.sort( (a,b) => {
        return (a.duration-b.duration)*direction;
      });
    }
    return timers_array.filter(timer => (timer.enabled || timer.quick));
  }

  sort_by_running() {
    var running_timers = [...this].filter(timer => timer.running);

    var now=Date.now();
    return running_timers.sort( (a,b) => {
      return a._end-b._end;
    });
  }

  stop_next() {
    let timer=this.sort_by_running()[0];
    if (timer) {
      this.logger.debug("Stopping timer %s", timer.name);
      timer.stop();
    } else {
      this.logger.debug("No running timers");
    }
  }

  timer_by_id(id) {
    var tbid = this.filter(timer => timer.id == id);
    return tbid.length == 0 ? null : tbid[0];
  }

  is_dupe(timer) {
    return this.get_dupe(timer) !== undefined;
  }

  get_dupe(timer) {
    if (!this.settings.detect_dupes) {
      return undefined;
    }
    for (let i=0; i < this.length; i++) {
      var t=this[i];
      if (timer.duration == t.duration && timer.quick == t.quick && timer.name == t.name) {
        return t;
      }
    }
    return undefined;
  }

  /**
   * Add the new timer, after checking that it has no dupes
   *
   * timer is the new timer to add to timers
   *
   * @returns the new timer if it is not the original, otherwise the dupe
   *     returns undefined if the timer could not be added
  */
  add_check_dupes(timer) {
    var tdupe = this.get_dupe(timer);
    if (tdupe !== undefined) {
      if (tdupe.running) {
        tdupe.notify(_("Duplicate timer is already running"));
        return undefined;
      }
      return tdupe;
    }
    return this.add(timer) ? timer : undefined;
  }

  add(timer) {
    if (!timer.quick && timer.name.length == 0) {
      this.logger.warn('Refusing to create unnamed preset timer');
      return false;
    }
    if (timer.duration <= 0) {
      this.logger.warn(`Refusing to create zero length timer ${timer.name}`);
      return false;
    }

    //this.logger.info(`Adding timer ${timer.name} of duration ${timer.duration} seconds quick=${timer.quick}`);
    this.logger.info("Adding timer [%s] of duration %d seconds [%s], quick=%s", timer.name, timer.duration, timer.id, timer.quick);
    this.push(timer);
    this._lookup[timer.id] = timer;

    if (this.attached) {
      // don't pack timers if the indicator is attaching and refreshing timers from settings
      this.settings.pack_timers(this);
    }
    return true;
  }

  remove(timer, i=undefined) {
    if (i === undefined) {
      // we don't know index of timer
      i = this.indexOf(timer);
      if (i == -1) {
        return false;
      }
    }
    timer.disable();
    // remove from timers
    this.splice(i, 1);
    this.logger.debug("timer %s has been purged", timer.name);
    this.settings.pack_timers(this);
    delete this._lookup[timer.id];
    return true;
  }
}

// timers is a singleton class
var timersInstance = new Timers();
//Object.freeze(timersInstance);

var TimerState = {
  INIT: 0,
  RESET: 1,
  RUNNING: 2,
  EXPIRED: 3
}

var Timer = class Timer {

  constructor(name, duration_secs, id=undefined) {
    // Ensure timersInstance is defined
    if (typeof timersInstance === 'undefined' || timersInstance === null) {
      timersInstance = new Timers();
    }

    var debug = timersInstance.settings.debug;
    this._enabled = true;
    this._quick = false;
    this._interval_ms = debug ? 500 : 250;
    this._duration_secs = duration_secs;
    this._state = TimerState.INIT;
    this._id = Utils.uuid(id);
    this._label = null;
    this._gicon = null;
    this._start = 0;
    this._end = 0;
    this._persist_alarm = false;
    this._interval_id = undefined;

    // will be undefined if it's not an alarm timer
    this._alarm_timer = AlarmTimer.matchRegex(name);
    if (this._alarm_timer) {
      this._alarm_timer.debug = timersInstance.settings;
    }

    // this calls the setter
    this.name = name;
    this.logger = new Logger(`kt timer: ${this.name}`, timersInstance.settings);
    this.logger.info(`Create timer [${this.name}] duration=[${duration_secs}]`);

  }

  check_volume() {
    if (!this.timers.settings.play_sound || !this.timers.settings.volume_level_warn) {
      return;
    }
    let stream = mixerControl.get_default_sink();
    if (stream) {
      let result = {
        max: mixerControl.get_vol_max_norm(),
        vol: 0,
        level: -1,
        muted: false
      }
      result.vol = stream.volume;
      result.muted = stream.is_muted;

      result.level = Math.floor(result.vol * 100 / result.max);

      var volume_threshold = this.timers.settings.volume_threshold;

      if (result.muted || result.level < volume_threshold) {
          if (this.timers.warn_volume) {
            this.timers.warn_volume = false;
            //Utils.logObjectPretty(result);
            let msg=this.logger.warn(_('volume level is low for running timer: %d %%'), result.level);
            this.timers.notifier.warning(this, this.name, msg);
          }
      } else {
        if (!this.timers.warn_volume) {
          this.logger.debug('volume level %d above threshold %d', result.level, volume_threshold);
          this.timers.warn_volume = true;
        }
      }
    }
  }

  toString() {
    return `[${this._name}:${this._id}] state=${this._state} start=${this._start} end=${this._end} dur=${this._duration_secs} iid=${this._interval_id}`;
  }

  static fromResult(result) {
    var timer = new Timer(result.name, result.hms.toSeconds());
    timer.quick = result.quick;
    timer.alarm_timer = result.alarm_timer;
    return timer;
  }

  get timers() {
    if (typeof timersInstance === 'undefined' || timersInstance === null) {
      timersInstance = new Timers();
    }
    return timersInstance;
  }

  get id() {
    return this._id;
  }

  get enabled() {
    return this._enabled;
  }

  set enabled(bool) {
    this._enabled = bool;
  }

  disable() {
    this._enabled = false;
  }

  get quick() {
    return this._quick;
  }

  set quick(bool) {
    this._quick = bool;
  }

  // Timer.new('foo', 50).name is 'foo'
  get name() {
    return this._name;
  }

  automatic_name(hms) {
    return hms.toName();
  }

  end_time() {
    return new Date(this._end).toLocaleTimeString();
  }

  set name(name) {
    var hms = new HMS(this.duration);
    this._name = name.length > 0 ? name : this.automatic_name(hms);
    this._has_name = this._name != this.automatic_name(hms);
  }

  get has_name() {
    return this._has_name;
  }

  get duration() {
    if (this.alarm_timer) {
      var hms = this.alarm_timer.hms();
      return hms.toSeconds();
    }
    return this._duration_secs;
  }

  set duration(duration) {
    this._duration_secs = duration;
  }

  duration_ms() {
    return this.duration * 1000;
  }

  // can be null if not initialized or closed
  get label() {
    return this._label;
  }

  // menu label or null if closed
  set label(label) {
    //this.logger.debug(label ? `Timer label set to ${label}`: 'Timer label set to null');
    this._label = label;
  }

  get alarm_timer() {
    return this._alarm_timer;
  }

  set alarm_timer(val) {
    this._alarm_timer = val;
  }

  get persist_alarm() {
    return this._persist_alarm;
  }

  set persist_alarm(b) {
    this._persist_alarm = b === undefined ? false : b;
    timersInstance.saveRunningTimers();
  }

  toggle_persist_alarm() {
    this.persist_alarm = !this.persist_alarm;
  }

  get remaining_secs() {
    if (!this.running) {
      return 0;
    }

    return Math.floor((this._end - Date.now()) / 1000);
  }

  label_progress(hms=undefined) {
    if (timersInstance.indicator === undefined || timersInstance.attached === false) {
      return;
    }
    if (!this.label) {
      return;
    }
    if (hms === undefined) {
      hms=this.remaining_hms();
    }
    this.label.set_text(hms.toString());
  }

  /*
    0
    1 - 15
    2 - 30
    3 - 45
    ...
    22 - 330
    23 - 345
    24 - 360
  */
  degree_progress(chunk=15) {
    if (this.running) {
      // 360/15 = 24
      var chunks = Math.floor(360 / chunk);
      var delta = Date.now() - this._start;
      var progress = Math.floor(delta / (this._end-this._start) * chunks);
      if (progress >= chunks) {
        progress = chunks-1;
      }
      return (progress)*chunk;
    }
    return 0;
  }

  icon_progress() {
    if (timersInstance.indicator === undefined) {
      return;
    }
    if (!timersInstance.settings.show_progress) {
      return;
    }
    var key = this.degree_progress();
    // Use the progress icon instead of the PNG logo
    let progressGicon = this.timers.progress_gicon(key);

    // Create the icon with the progress icon
    var icon = new St.Icon({
      gicon: progressGicon,
      style_class: 'system-status-icon'
    });
    icon.set_icon_size(20);

    var panel_box = timersInstance.box;
    if (panel_box) {
      var current = panel_box.get_child_at_index(0);
      panel_box.replace_child(current, icon);
      current.destroy();
    }
  }

  get running() {
    return (this._state === TimerState.RUNNING);
  }

  get expired() {
    return (this._state === TimerState.EXPIRED);
  }

  get reset() {
    return (this._state == TimerState.RESET);
  }

  set running(bool) {
    if (bool) { this._state = TimerState.RUNNING };
  }

  set expired(bool) {
    if (bool) { this._state = TimerState.EXPIRED; }
  }

  set reset(bool) {
    if (bool) { this._state = TimerState.RESET; }
  }

  timer_callback(timer) {
    var now = Date.now();
    var end = timer._end;

    if (now > end) {
      timer.expired = true;
    }
    if (timer.expired || timer.reset) {
      return timer.stop_callback(now);
    }

    timersInstance.inhibitor.inhibit_timer(timer);

    let hms = timer.remaining_hms(now);

    timer.label_progress(hms);

    var running_timers = timersInstance.sort_by_running();
    if (running_timers.length > 0 && running_timers[0] == timer) {
      timer.icon_progress();

      timersInstance.set_panel_name(timer.name, timer.has_name);
      var panel_label;
      if (timersInstance.settings.show_endtime) {
        panel_label = new Date(timer._end + 1000).toLocaleTimeString();
      } else {
        panel_label = hms.toString(true);
      }
      timersInstance.set_panel_label(panel_label);
    }
    // Periodically save timer state (every 30 seconds)
    if (now % 30000 < timer._interval_ms) {
      saveAllTimers(timersInstance);
    }

    return true;
  }

  remaining_hms(now=undefined) {
    let delta;
    if (this.running) {
      if (now === undefined) {
        now = Date.now();
      }
      if (this.alarm_timer) {
        this._end = this.alarm_timer.end();
      }
      delta = Math.ceil((this._end-now) / 1000);
    } else {
      delta = this.duration;
    }
    return new HMS(delta < 0 ? 0 : delta);
  }

  stop_callback(now) {
    var tdiff = now - this._end;
    var early = tdiff < 0;
    var late = tdiff > 2000;

    // shouldn't be necessary, but we'll make sure
    if (early) {
      this.reset = true;
      tdiff = -tdiff;
    } else {
      this.expired = true;
    }

    this.logger.info('Timer has ended %s: state=%d', early ? "early" : (late ? "late" : "on time"), this._state);
    Utils.clearInterval(this._interval_id);
    this._interval_id = undefined;

    // Prevent duplicate notifications
    if (timersInstance.notifier && timersInstance.notifier._activeNotifications &&
        timersInstance.notifier._activeNotifications.has(this.id)) {
      this.logger.debug("Skipping duplicate notification for timer: %s", this.name);

      // Still perform cleanup
      var hms = new HMS(this.duration);
      this.label_progress(hms);
      this.icon_progress();

      if (timersInstance.sort_by_running().length === 0) {
        timersInstance.set_panel_name('taskTimer');
      } else {
        timersInstance.set_panel_name("");
      }
      if (!timersInstance.runningTimers || timersInstance.runningTimers.length === 0) {
        timersInstance.set_panel_name("taskTimer");
      } else {
        timersInstance.set_panel_name("");
      }
      timersInstance.set_panel_label("");
      timersInstance.saveRunningTimers();
      saveAllTimers(timersInstance);

      return false;
    }

    var stdiff = early || late ? new HMS(tdiff/1000).toString(true) : "";
    var reason;
    var text = "%s due at %s".format(this.name, this.end_time())
    if (early) {
      reason = _("Timer stopped %s early at").format(stdiff);
    } else if (late) {
      reason = _("Timer completed %s late at").format(stdiff);
    } else {
      text = this.name;
      reason = _("Timer completed on time at");

      if (timersInstance.sort_by_running().length === 0) {
        timersInstance.set_panel_name('taskTimer');
      } else {
        timersInstance.set_panel_name("");
      }
      timersInstance.set_panel_label("");
      timersInstance.saveRunningTimers();
      saveAllTimers(timersInstance); // Save all timers to persistent storage
    }

    var time=new Date(now).toLocaleTimeString();

    timersInstance.notifier.notify(this, text, "%s %s", reason, time);
    var hms = new HMS(this.duration);

    this.label_progress(hms);
    this.icon_progress();

    timersInstance.set_panel_name("");
    timersInstance.set_panel_label("");
    timersInstance.saveRunningTimers();
    saveAllTimers(timersInstance); // Save all timers to persistent storage

    if (this.notify_volume || this.notify_muted) {
      let stream = mixerControl.get_default_sink();
      if (stream) {
        if (this.notify_volume) {
          this.logger.debug('disconnect notify::volume');
          stream.disconnect(this.notify_volume);
          this.notify_volume = undefined;
        }
        if (this.notify_muted) {
          this.logger.debug('disconnect notify::is-muted');
          stream.disconnect(this.notify_muted);
          this.notify_muted = undefined;
        }
      }
    }

    // return with false to stop interval callback loop
    return false;
  }

  stop() {
    this.reset = true;
    this.uninhibit();
  }

  start() {
    if (this._enabled || this._quick) {
      if (this.running) {
        this.logger.info(`Timer is already running, resetting`);
        this.reset = true;
        return false;
      }
      return this.go();
    }
    this.logger.info(`Timer is disabled`);
    return false;
  }

  snooze(secs) {
    // the time it took to click snooze button
    let dt = (Date.now() - this._end);
    if (this.alarm_timer) {
      this.alarm_timer.snooze(secs);
      this._end = this.alarm_timer.end() + dt;
    } else {
      dt += secs*1000;
      this._start += dt;
      this._end += dt;
      // reset duration taking the new end into account
    }
    this.go(this._start, this._end);
  }

  go(start=undefined, end=undefined) {
    var action;
    if (start === undefined) {
      this._start = Date.now();
      action="Starting";
    } else {
      this._start = start;
      action="Restarting";
    }

    if (this.timers.settings.play_sound && this.timers.settings.volume_level_warn) {
      let stream = mixerControl.get_default_sink();
      if (stream) {
        if (this.notify_volume === undefined) {
          this.notify_volume = stream.connect('notify::volume', this.check_volume.bind(this));
        }
        if (this.notify_muted === undefined) {
          this.notify_muted = stream.connect('notify::is-muted', this.check_volume.bind(this));
        }
      }
    }

    this.timers.warn_volume = true;
    this.check_volume();

    this._end = end === undefined ? this._start + this.duration_ms() : end;
    this._state = TimerState.RUNNING;

    timersInstance.inhibitor.inhibit_timer(this);

    timersInstance.saveRunningTimers();
    saveAllTimers(timersInstance); // Save all timers to persistent storage

    let quick=this._quick ? ' quick ' : ' ';
    this.logger.info("%s%stimer at %d", action, quick, this._start);
    timersInstance.inc_prefer_presets(this._quick ? -1 : 1);

    this._interval_id = Utils.setInterval(this.timer_callback, this._interval_ms, this);

    return true;
  }

  static fromSettingsTimer(settings_timer) {
    var timer = new Timer(settings_timer.name, settings_timer.duration, settings_timer.id);
    timer._quick = settings_timer.quick;
    settings_timer.id = timer.id;
    return timer;
  }

  static fromJSON(timerData) {
    const timer = new Timer(timerData.name, timerData.duration_secs, timerData.id);
    timer._quick = timerData.quick || false;
    timer._state = timerData.state || TimerState.INIT;
    timer._start = timerData.start || 0;
    timer._end = timerData.end || 0;
    timer._persist_alarm = timerData.persist_alarm || false;

    if (timerData.alarm_timer) {
      timer._alarm_timer = AlarmTimer.restore(timerData.alarm_timer);
    }

    return timer;
  }

  refresh_with(settings_timer) {
    if (settings_timer.id == this.id) {
      this._name = settings_timer.name;
      this._enabled = settings_timer.enabled;
      this._duration_secs = settings_timer.duration;
      this._quick = settings_timer.quick;
      if (this._alarm_timer === undefined) {
        this._alarm_timer = AlarmTimer.matchRegex(this._name);
      }
      if (this._alarm_timer && this.running) {
        this._end = this._alarm_timer.end();
        //this.logger.debug("Alarm timer (%s) running for another %d seconds: end=%d", timer.alarm_timer.toString(), timer.duration, timer._end);
      }
      return true;
    }
    return false;
  }

  still_valid(settings_timers) {
    if (this.running || this.quick) {
      return true;
    }
    for (let i=0; i < settings_timers.length; i++) {
      var settings_timer = settings_timers[i];
      if (this._id == settings_timer.id) {
        return true;
      }
    }
    this.logger.debug(`Timer ${this.name} is no longer in settings`);
    return false;
  }

  notify(msg, ...args) {
    timersInstance.notifier.notify(this, this.name, msg, ...args);
  }

  delete() {
    this.timers.remove(this);
  }

  reduce() {
    let secs=30;
    if (this.alarm_timer) {
      //this.alarm_timer.reduce(secs);
      // don't reduce alarm timers
      return;
    }
    this._end -= secs*1000;
  }

  extend() {
    if (this.alarm_timer) {
      // don't extend alarm timers
      return;
    }
    this._end += 30*1000;
  }

  forward() {
    if (this.alarm_timer) {
      this._end = this.alarm_timer.forward(this._end, 900);
      this.name = this.alarm_timer.name_at_hms();
      timersInstance.settings.pack_timers(timersInstance);
    }
  }

  toJSON() {
    const timerData = {
      id: this._id,
      name: this._name,
      duration_secs: this._duration_secs,
      quick: this._quick,
      state: this._state,
      start: this._start,
      end: this._end,
      persist_alarm: this._persist_alarm
    };

    if (this._alarm_timer) {
      timerData.alarm_timer = this._alarm_timer.save();
    }

    return timerData;
  }

  backward() {
    if (this.alarm_timer) {
      this._end = this.alarm_timer.backward(this._end, 900);
      this.name = this.alarm_timer.name_at_hms();
      timersInstance.settings.pack_timers(timersInstance);
    }
  }

  uninhibit() {
    timersInstance.inhibitor.uninhibit(this.id);
  }
}

var exports = {
  Timers: Timers,
  Timer: Timer
};

