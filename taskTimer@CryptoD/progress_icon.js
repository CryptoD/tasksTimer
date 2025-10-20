/*
 * taskTimer: Gnome Shell taskTimer Extension
 * Copyright (C) 2023 CryptoD
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const GETTEXT_DOMAIN = 'tasktimer';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { GLib, Gio } = imports.gi;

var ProgressIcon = class ProgressIcon {
    constructor(logger) {
        this.logger = logger;
        this._progressIconsDegrees = {};
        // Prefer using the extension's symbolic icon as a fallback if available
        try {
            // Prefer new tasktimer symbolic icon but keep legacy file as secondary fallback
            if (GLib.file_test(`${Me.path}/icons/tasktimer-symbolic.svg`, GLib.FileTest.EXISTS)) {
                this._fallbackIcon = Gio.icon_new_for_string(Me.path + '/icons/tasktimer-symbolic.svg');
            } else if (GLib.file_test(`${Me.path}/icons/kitchen-timer-symbolic.svg`, GLib.FileTest.EXISTS)) {
                this._fallbackIcon = Gio.icon_new_for_string(Me.path + '/icons/kitchen-timer-symbolic.svg');
            } else if (GLib.file_test(`${Me.path}/icons/kitchen-timer-blackjackshellac-symbolic.svg`, GLib.FileTest.EXISTS)) {
                this._fallbackIcon = Gio.icon_new_for_string(Me.path + '/icons/kitchen-timer-blackjackshellac-symbolic.svg');
            } else {
                this._fallbackIcon = Gio.icon_new_for_string('image-missing-symbolic');
            }
        } catch (e) {
            this._fallbackIcon = Gio.icon_new_for_string('image-missing-symbolic');
        }

        this._initializeProgressIcons();
    }

    _initializeProgressIcons() {
        for (let i = 0; i <= 360; i++) {
            try {
                // Try both the legacy progress folder and the flat named icons that exist in this repo
                let icon_path1 = `${Me.path}/icons/progress/${i}.svg`;
                let icon_path2 = `${Me.path}/icons/tasktimer-${i}.svg`;
                let icon_path3 = `${Me.path}/icons/kitchen-timer-${i}.svg`;

                if (GLib.file_test(icon_path1, GLib.FileTest.EXISTS)) {
                    this._progressIconsDegrees[i] = Gio.icon_new_for_string(icon_path1);
                } else if (GLib.file_test(icon_path2, GLib.FileTest.EXISTS)) {
                    this._progressIconsDegrees[i] = Gio.icon_new_for_string(icon_path2);
                } else if (GLib.file_test(icon_path3, GLib.FileTest.EXISTS)) {
                    this._progressIconsDegrees[i] = Gio.icon_new_for_string(icon_path3);
                }
            } catch (e) {
                // Log and continue; missing single-degree icons are expected in this repo
                this.logger && this.logger.error && this.logger.error(`Failed to create progress icon for degree ${i}: ${e.message}`);
            }
        }

        // Ensure we at least have an icon for degree 0
        if (!this._progressIconsDegrees[0]) {
            this.logger && this.logger.debug && this.logger.debug(`Progress icon for 0 degrees not found. Using fallback.`);
            this._progressIconsDegrees[0] = this._fallbackIcon;
        }
    }

    get(degrees) {
        // Normalize degrees to integer between 0 and 360
        let deg = Math.round(Number(degrees) || 0);
        deg = ((deg % 360) + 360) % 360;

        // Direct match
        if (this._progressIconsDegrees[deg])
            return this._progressIconsDegrees[deg];

        // Try nearest 15-degree step (icons in repo are available in 15° increments)
        const step = 15;
        let rounded = Math.round(deg / step) * step;
        rounded = ((rounded % 360) + 360) % 360;
        if (this._progressIconsDegrees[rounded])
            return this._progressIconsDegrees[rounded];

        // Fallback to 0-degree icon or the symbolic fallback
        return this._progressIconsDegrees[0] || this._fallbackIcon;
    }
};

