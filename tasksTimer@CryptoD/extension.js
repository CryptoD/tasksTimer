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

/* exported init */


const { GObject, St, Clutter } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const GETTEXT_DOMAIN = 'tasktimer';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const Utils = Me.imports.utils;
const Settings = Me.imports.settings.Settings;
const Menus = Me.imports.menus;
const Timers = Me.imports.timers.Timers;
const Timer = Me.imports.timers.Timer;
const Indicator = Me.imports.indicator;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

class Extension {
    constructor(uuid) {
      this._uuid = uuid;

      ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
      log(`taskTimer: init called for uuid=${uuid}`);
    }

    enable() {
        try {
            log('taskTimer: enabling extension');
            this._indicator = new Indicator.KitchenTimerIndicator();
            Main.panel.addToStatusArea(this._uuid, this._indicator);
            log('taskTimer: indicator added to status area');
        } catch (e) {
            logError(e, 'taskTimer: failed to enable extension');
        }
    }

    disable() {
        try {
            log('taskTimer: disabling extension');
            // Save timer state before disabling
            const Timers = Me.imports.timers.Timers;
            const timersInstance = Timers.getInstance();
            if (timersInstance) {
                const saveAllTimers = Me.imports.timers.saveAllTimers;
                saveAllTimers(timersInstance);
                log('taskTimer: timers saved during disable');
            }

            if (this._indicator) {
                this._indicator.destroy();
                this._indicator = null;
                log('taskTimer: indicator destroyed');
            } else {
                log('taskTimer: no indicator to destroy');
            }
        } catch (e) {
            logError(e, 'taskTimer: failed to disable extension');
        }
    }
}

function init(meta) {
  return new Extension(meta.uuid);
}
