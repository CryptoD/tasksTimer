const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const Indicator = ExtensionUtils.getCurrentExtension().imports.indicator;

function init() {
    ExtensionUtils.initTranslations('tasksTimer-CryptoD');
}

function enable() {
    this._indicator = new Indicator.TasksTimerIndicator();
    Main.panel.addToStatusArea('tasksTimer', this._indicator);
}

function disable() {
    if (this._indicator) {
        this._indicator.destroy();
        this._indicator = null;
    }
}