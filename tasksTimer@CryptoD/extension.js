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

/* exported init */


const { GObject, St, Clutter } = imports.gi;

const GETTEXT_DOMAIN = 'tasksTimer-CryptoD';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Main = imports.ui.main;
const Indicator = Me.imports.indicator;
const Logger = Me.imports.logger.Logger;

function init(meta) {
    ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
    return new Extension(meta.uuid);
}

class Extension {
    constructor(uuid) {
        this._uuid = uuid;
        this._indicator = null;
        this.logger = new Logger('Extension');
    }

    enable() {
        this.logger.info('enabling kitchen timer extension');
        this._indicator = new Indicator.Indicator();
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    }

    disable() {
        this.logger.info('disabling kitchen timer extension');
        if (this._indicator !== null) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
