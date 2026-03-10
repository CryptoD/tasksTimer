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

/**
 * Keyboard shortcuts: interface-based ShortcutProvider.
 * KeyboardShortcuts accepts an optional ShortcutProvider; if none is given,
 * the default GNOME Shell implementation (global.display + Main.wm) is used.
 * Contract: provider.register(accelerator, callback), provider.unregister(accelerator), provider.clear().
 */

const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Logger = Me.imports.logger.Logger;

/**
 * GNOME Shell implementation of the shortcut provider contract.
 * Uses global.display.grab_accelerator / ungrab_accelerator and Main.wm.allowKeybinding.
 */
var GnomeShellShortcutProvider = class GnomeShellShortcutProvider {
    constructor() {
        this._grabbers = {};
        this._onAccelerator = this._onAccelerator.bind(this);
        if (typeof global !== 'undefined' && global.display) {
            global.display.connect('accelerator-activated', (display, action, deviceId, timestamp) => {
                this._onAccelerator(action);
            });
        }
    }

    register(accelerator, callback) {
        this.unregister(accelerator);

        if (typeof global === 'undefined' || !global.display) {
            return;
        }
        const action = global.display.grab_accelerator(accelerator, 0);
        if (action === Meta.KeyBindingAction.NONE) {
            return;
        }
        const name = Meta.external_binding_name_for_action(action);
        if (typeof Main !== 'undefined' && Main.wm) {
            Main.wm.allowKeybinding(name, Shell.ActionMode.ALL);
        }
        this._grabbers[action] = { name, accelerator, callback };
    }

    unregister(accelerator) {
        for (const [action, grabber] of Object.entries(this._grabbers)) {
            if (grabber.accelerator === accelerator) {
                if (grabber.name && typeof global !== 'undefined' && global.display) {
                    global.display.ungrab_accelerator(parseInt(action, 10));
                    if (typeof Main !== 'undefined' && Main.wm) {
                        Main.wm.allowKeybinding(grabber.name, Shell.ActionMode.NONE);
                    }
                }
                delete this._grabbers[action];
                return;
            }
        }
    }

    clear() {
        const accels = [];
        for (const grabber of Object.values(this._grabbers)) {
            accels.push(grabber.accelerator);
        }
        accels.forEach(accel => this.unregister(accel));
    }

    _onAccelerator(action) {
        const grabber = this._grabbers[action];
        if (grabber && typeof grabber.callback === 'function') {
            grabber.callback();
        }
    }
};

/**
 * Generic keyboard shortcut manager that delegates to a ShortcutProvider.
 * Does not assume GNOME Shell globals; pass a provider for the current environment.
 *
 * @param {Object} settings - Settings instance (for logger).
 * @param {Object} [shortcutProvider] - Optional. Must have register(accelerator, callback),
 *        unregister(accelerator), clear(). If omitted, GnomeShellShortcutProvider is used.
 */
var KeyboardShortcuts = class KeyboardShortcuts {
    constructor(settings, shortcutProvider = null) {
        this._settings = settings;
        this._provider = shortcutProvider || new GnomeShellShortcutProvider();
        this._registered = new Set();

        this.logger = new Logger('kt kbshortcuts', settings);
    }

    listenFor(accelerator, callback) {
        if (!accelerator) {
            return;
        }
        this.logger.debug('Registering shortcut [accelerator=%s]', accelerator);
        this._provider.unregister(accelerator);
        this._provider.register(accelerator, callback);
        this._registered.add(accelerator);
    }

    remove(accelerator) {
        if (!accelerator) {
            return;
        }
        this.logger.debug('Unregistering shortcut [accelerator=%s]', accelerator);
        this._provider.unregister(accelerator);
        this._registered.delete(accelerator);
    }

    clear() {
        this.logger.debug('Clearing all shortcuts');
        this._provider.clear();
        this._registered.clear();
    }
};
