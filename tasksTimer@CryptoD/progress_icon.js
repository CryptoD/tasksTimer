const Me = imports.misc.extensionUtils.getCurrentExtension();
const { GLib, Gio } = imports.gi;
const Utils = Me.imports.utils;

var ProgressIcon = class ProgressIcon {
    constructor(logger) {
        this.logger = logger;
        this._progressIconsDegrees = {};
        this._fallbackIcon = Gio.icon_new_for_string('image-missing-symbolic');
        this._initializeProgressIcons();
    }

    _initializeProgressIcons() {
        for (let i = 0; i <= 360; i++) {
            try {
                let icon_path = `${Me.path}/icons/progress/${i}.svg`;
                if (GLib.file_test(icon_path, GLib.FileTest.EXISTS)) {
                    this._progressIconsDegrees[i] = Gio.icon_new_for_string(icon_path);
                }
            } catch (e) {
                this.logger.error(`Failed to create progress icon for degree ${i}: ${e.message}`);
            }
        }

        if (!this._progressIconsDegrees[0]) {
            this.logger.debug(`Progress icon for 0 degrees not found. Using fallback.`);
            this._progressIconsDegrees[0] = this._fallbackIcon;
        }
    }

    get(degrees) {
        return this._progressIconsDegrees[degrees] || this._progressIconsDegrees[0];
    }
};
