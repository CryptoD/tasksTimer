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

        this._settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.tasksTimer');
        this.logger = new Me.imports.logger.Logger('kt indicator', this._settings);
        this.logger.info('Initializing TasksTimerIndicator');

        try {
            // Initialize timers
            this._timers = TimersModule.timersInstance;
            if (this._timers && typeof this._timers.attach === 'function') {
                this._timers.attach(this);
                this.logger.info('Timers attached successfully');
            } else {
                throw new Error('Invalid timers instance or attach method');
            }
        } catch (error) {
            this.logger.error(`Error initializing timers: ${error}`);
            this._timers = null;
        }

        // Create icon
        let icon = new St.Icon({
            icon_name: 'preferences-system-time-symbolic', // Fallback to a standard icon
            style_class: 'system-status-icon'
        });
        this.add_child(icon);
        this.logger.info('Icon added to panel');

        // Create menu item
        let item = new PopupMenu.PopupMenuItem('Show Timer');
        item.connect('activate', () => {
            this.logger.info('Show Timer clicked');
        });
        this.menu.addMenuItem(item);
        this.logger.info('Menu item added');
    }

    get settings() {
        return this._settings;
    }

    get timers() {
        return this._timers;
    }
});