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

const { GObject, St, Clutter, GLib } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Logger = Me.imports.logger.Logger;
const HMS = Me.imports.hms.HMS;
const Utils = Me.imports.utils;
const TimersModule = Me.imports.timers;
const AlarmTimerModule = Me.imports.alarm_timer;

var Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, "Tasks Timer Indicator");

        this._timers = TimersModule.timersInstance;
        this._settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.tasksTimer');
        this.logger = new Logger('Indicator', this._settings);

        this._createIcon();
        this._createMenu();

        this._timers.attach(this);
        this._refresh();
    }

    _createIcon() {
        this.box = new St.BoxLayout();
        this.icon = new St.Icon({
            style_class: 'system-status-icon'
        });
        this._updateIcon();
        this.box.add_child(this.icon);
        this.add_child(this.box);
    }

    _updateIcon() {
        let icon_name = 'timer-symbolic';
        if (this._timers.some(timer => timer.running)) {
            icon_name = 'timer-running-symbolic';
        }
        this.icon.gicon = Utils.getIconPath(icon_name);
    }

    _createMenu() {
        // Add your menu creation code here
        // This will be populated based on your specific needs
    }

    _refresh() {
        this._updateIcon();
        // Add any additional refresh logic
    }

    destroy() {
        this._timers.detach();
        super.destroy();
    }
});
