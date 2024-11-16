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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Logger = Me.imports.logger.Logger;
const HMS = Me.imports.hms.HMS;

/**
 * @typedef {Object} AmPm
 * @property {number} H24 - 24-hour format identifier (0)
 * @property {number} AM - AM format identifier (1)
 * @property {number} PM - PM format identifier (2)
 * @property {RegExp} RE - Regular expression to match AM/PM patterns
 */
const AmPm = {
    H24: 0,
    AM: 1,
    PM: 2,
    RE: /(p\.?m\.?)|(a\.?m\.?)/i
};

/**
 * @type {Logger}
 * @description Logger instance for kitchen timer alarm functionality
 */
const logger = new Logger('kt alarm timer');
class AlarmTimer {
    // ... same as your provided code...
}

function init() {
    logger.debug("Initializing...");
    let settings = Utils.getSettings();
    // Set log level
    logger.settings = settings;

    // Initialize timers
    let stored_timers = Utils.tasksTimer();
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
}

// Export the init function and AlarmTimer class
var AlarmTimerModule = {
    init: init,
    AlarmTimer: AlarmTimer
};