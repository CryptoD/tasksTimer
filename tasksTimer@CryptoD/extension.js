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
        this._indicator = null;
        ExtensionUtils.initTranslations('tasksTimer-CryptoD');
    }

    enable() {
        log('Enabling extension');
        try {
            if (!this._indicator) {
                this._indicator = new Indicator.TasksTimerIndicator();
                Main.panel.addToStatusArea(this._uuid, this._indicator);
            }
            log('Extension enabled successfully');
        } catch (e) {
            logError(`Error enabling extension: ${e.message}\n${e.stack}`);
            this.disable(); // Clean up if there's an error
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