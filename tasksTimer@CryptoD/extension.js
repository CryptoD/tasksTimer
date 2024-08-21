'use strict';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Indicator = Me.imports.indicator;
const Main = imports.ui.main;

function log(msg) {
    print(`tasksTimer: ${msg}`);
}

class Extension {
    constructor(uuid) {
        this._uuid = uuid;
        ExtensionUtils.initTranslations('tasksTimer-CryptoD');
    }

    enable() {
        log('Enabling extension');
        try {
            this._indicator = new Indicator.tasksTimerIndicator();
            Main.panel.addToStatusArea(this._uuid, this._indicator);
            log('Extension enabled successfully');
        } catch (e) {
            log(`Error enabling extension: ${e.message}\n${e.stack}`);
        }
    }

    disable() {
        log('Disabling extension');
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        log('Extension disabled');
    }
}

function init(meta) {
    log('Initializing extension');
    return new Extension(meta.uuid);
}