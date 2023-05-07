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

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Utils = Me.imports.utils;
const Logger = Me.imports.logger.Logger;
const HMS = Me.imports.hms.HMS;

const AmPm = {
  H24: 0,
  AM: 1,
  PM: 2,
  RE: /(p\.?m\.?)|(a\.?m\.?)/i
};

const logger = new Logger('kt alarm timer');

class AlarmTimer {
  constructor() {
    this._name = "";
    this._hour = 0;
    this._minute = 0;
    this._second = 0;
    this._ms = 0;
    this._ampm = AmPm.H24;
    this._snooze_ms = 0;
    this._alarm_date = undefined;
  }

  set debug(settings) {
    logger.settings = settings;
  }

  get hour() { return this._hour; }

  set hour(h) {
    if (h === undefined) { return; }
    this._hour = Number(h);
    if (this.ampm == AmPm.PM) {
      // 12pm is 12h00 (noon)
      //  1pm is 13h00
      if (this._hour < 12) {
        this._hour += 12;
      } else if (this._hour > 12) {
        throw 'PM hour is greater than 12 (noon)';
      }
    } else if (this.ampm == AmPm.AM) {
      // 12am is 0h00 (midnight)
      if (this._hour == 12) {
        this._hour = 0;
      } else if (this._hour > 12) {
        throw 'AM hour is greater than 12 (midnight)';
      }
    }
    this.ampm = AmPm.H24;
    if (this._hour > 23) {
      throw 'hour is greater than 23: '+this._hour;
    }
  }

  get minute() { return this._minute; }

  set minute(m) {
    if (m === undefined) { return; }
    this._minute = Number(m);
    if (this._minute > 59) {
      logger.warn("AlarmTimer minute %d > 59", this._minute);
      this._minute = 59;
    }
  }

  get second() { return this._second; }

  set second(s) {
    if (s === undefined) { return; }
    this._second = Number(s);
    if (this._second > 59) {
      logger.warn("AlarmTimer second %d > 59", this._second);
      this._second = 59;
    }
  }

  get ms() { return this._ms; }
  set ms(msecs) {
    if (msecs === undefined) { return; }
    this._ms = Number(msecs);
    if (this._ms > 999) {
      logger.warn("AlarmTimer milliseconds > 999", this._ms);
      this._ms = 999;
    }
  }

  get ampm() { return this._ampm; }

  set ampm(val) {
    if (val === undefined) { return; }
    this._ampm = val;
  }

  get name() { return this._name; }

  set name(val) {
    if (val === undefined) { return; }
    this._name = val.trim
    .replace(/[^a-zA-Z0-9]/g, '_') // Replace non-alphanumeric characters with underscores
    .toLowerCase(); // Convert to lowercase
  }

  /**
   * Check if the alarm is due to go off soon (within the given duration)
   *
   * @param {number} duration Duration in milliseconds
   * @returns {boolean} True if the alarm is due within the given duration
   */
  isDueSoon(duration) {
    let now = new Date();
    let timeDiff = this.alarm_date - now;
    return (timeDiff > 0 && timeDiff <= duration);
  }
}

var init = () => {
  logger.debug("Initializing...");
  Utils.getSettings().then(settings => {
    // Set log level
    logger.settings = settings;
    // Initialize timers
    let stored_timers = Utils.getStoredTimers();
    stored_timers.forEach(t => {
      let timer = AlarmTimer.restore(t);
      if (timer) {
        Utils.addTimer(timer);
      }
    });
    // Connect to settings changes
    settings.connect('changed::timers', () => {
      logger.debug("Timers setting changed");
      Utils.updateTimersFromSettings();
    });
    // Connect to system clock changes
    Utils.connectToClockSignal('notify::clock', () => {
      logger.debug("System clock signal received");
      Utils.checkTimers();
    });
  }).catch(error => {
    logger.error(`Failed to get settings: ${error}`);
  });
};

init();
