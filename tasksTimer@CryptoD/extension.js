const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const TimersModule = Me.imports.timers;
const Indicator = Me.imports.indicator;

let _indicator = null;

function init() {
    return new Extension();
}

function enable() {
    _indicator = new Indicator.Indicator();
}

function disable() {
    if (_indicator) {
        _indicator.destroy();
        _indicator = null;
    }
}

class Extension {
    constructor() {
        this._timers = new TimersModule.Timers();
    }
}
