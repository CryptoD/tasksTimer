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

        try {
            // Initialize timers
            this._timers = TimersModule.timersInstance;
            if (this._timers && typeof this._timers.attach === 'function') {
                this._timers.attach(this);
            } else {
                throw new Error('Invalid timers instance');
            }
        } catch (error) {
            logError(`Error initializing timers: ${error}`);
            this._timers = null;
        }

        // Initialize settings
        this._settings = ExtensionUtils.getSettings();

        let icon = new St.Icon({
            icon_name: 'preferences-system-time-symbolic',
            style_class: 'system-status-icon'
        });

        this.add_child(icon);

        let item = new PopupMenu.PopupMenuItem('Show Timer');
        item.connect('activate', () => {
            log('Show Timer clicked');
        });
        this.menu.addMenuItem(item);
    }

    get settings() {
        return this._settings;
    }

    get timers() {
        return this._timers;
    }
});