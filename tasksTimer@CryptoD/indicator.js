'use strict';

const { GObject, St } = imports.gi;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// Import the Timers module
const TimersModule = Me.imports.timers;

var TasksTimerIndicator = GObject.registerClass(
class TasksTimerIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, 'Tasks Timer');

        log('Initializing TasksTimerIndicator');

        try {
            // Initialize timers
            this._timers = TimersModule.timersInstance;
            if (this._timers && typeof this._timers.attach === 'function') {
                this._timers.attach(this);
                log('Timers attached successfully');
            } else {
                throw new Error('Invalid timers instance or attach method');
            }
        } catch (error) {
            logError(`Error initializing timers: ${error}`);
            this._timers = null;
            return;
        }

        // Initialize settings
        try {
            this._settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.tasksTimer');
            log('Settings initialized successfully');
        } catch (error) {
            logError(`Error initializing settings: ${error}`);
            this._settings = null;
        }

        // Create icon
        let icon = new St.Icon({
            icon_name: 'preferences-system-time-symbolic',
            style_class: 'system-status-icon'
        });
        this.add_child(icon);
        log('Icon added to panel');

        // Create menu item
        let item = new PopupMenu.PopupMenuItem('Show Timer');
        item.connect('activate', () => {
            log('Show Timer clicked');
        });
        this.menu.addMenuItem(item);
        log('Menu item added');
    }

    // Add getter for settings
    get settings() {
        return this._settings;
    }

    // Add getter for timers
    get timers() {
        return this._timers;
    }
});

function log(msg) {
    print(`tasksTimer: ${msg}`);
}

function logError(msg) {
    global.logError(`tasksTimer: ${msg}`);
}