'use strict';

function log(msg) {
    print(`tasksTimer: ${msg}`);
}

function init_error(msg) {
    log("tasksTimer init error: " + msg);
    throw new Error(msg);
}

let Extension, init;

try {
    const { GObject, St, Clutter } = imports.gi;
    const ExtensionUtils = imports.misc.extensionUtils;
    const Me = ExtensionUtils.getCurrentExtension();
    const GETTEXT_DOMAIN = 'tasksTimer-CryptoD';
    const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
    const _ = Gettext.gettext;

    log('Imports successful');

    // Try importing each module separately and log any errors
    try {
        const Utils = Me.imports.utils;
        log('Utils imported successfully');
    } catch (e) {
        log('Error importing Utils: ' + e);
    }

    try {
        const Settings = Me.imports.settings.Settings;
        log('Settings imported successfully');
    } catch (e) {
        log('Error importing Settings: ' + e);
    }

    try {
        const Menus = Me.imports.menus;
        log('Menus imported successfully');
    } catch (e) {
        log('Error importing Menus: ' + e);
    }

    try {
        const Timers = Me.imports.timers.Timers;
        log('Timers imported successfully');
    } catch (e) {
        log('Error importing Timers: ' + e);
    }

    try {
        const Timer = Me.imports.timers.Timer;
        log('Timer imported successfully');
    } catch (e) {
        log('Error importing Timer: ' + e);
    }

    try {
        const Indicator = Me.imports.indicator;
        log('Indicator imported successfully');
    } catch (e) {
        log('Error importing Indicator: ' + e);
    }

    const Main = imports.ui.main;
    const PanelMenu = imports.ui.panelMenu;
    const PopupMenu = imports.ui.popupMenu;

    class ExtensionClass {
        constructor(uuid) {
            this._uuid = uuid;
            ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
        }

        enable() {
            log('tasksTimer: Extension enabled');
            this._indicator = new Indicator.tasksTimerIndicator();
            Main.panel.addToStatusArea(this._uuid, this._indicator);
        }

        disable() {
            log('tasksTimer: Extension disabled');
            this._indicator.destroy();
            this._indicator = null;
        }
    }

    Extension = ExtensionClass;
    init = function(meta) {
        log('tasksTimer: Extension initialized');
        return new Extension(meta.uuid);
    };

} catch (e) {
    init_error(e);
}