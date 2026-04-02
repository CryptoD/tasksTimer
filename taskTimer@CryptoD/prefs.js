/*
 * taskTimer: Gnome Shell taskTimer Extension
 * Copyright (C) 2023 CryptoD
 *
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

const { Gio, Gtk, Gdk, GLib } = imports.gi;
const ByteArray = imports.byteArray;

const GETTEXT_DOMAIN = 'tasktimer';
const I18n = imports.i18n;
const _ = I18n.init(GETTEXT_DOMAIN).gettext;

let ExtensionUtils = null;
try {
  ExtensionUtils = imports.misc.extensionUtils;
} catch (e) {
  ExtensionUtils = null;
}

const Me = ExtensionUtils && typeof ExtensionUtils.getCurrentExtension === 'function'
  ? ExtensionUtils.getCurrentExtension()
  : {
      path: GLib.build_filenamev([GLib.get_current_dir(), 'taskTimer@CryptoD']),
      imports: imports['taskTimer@CryptoD'],
    };
const Settings = Me.imports.settings.Settings;
const Utils = Me.imports.utils;
const Logger = Me.imports.logger.Logger;
const HMS = Me.imports.hms.HMS;
const AlarmTimer = Me.imports.alarm_timer.AlarmTimer;

const Model = {
  NAME: 0,
  ID: 1,
  DURATION: 2,
  ENABLED: 3,
  QUICK: 4,
  HMS: 5,
  TRASH: 6
};

/** Shortcut actions shown in the Shortcuts preferences tab. key = settings key (e.g. accel-show-endtime). */
const SHORTCUT_ACTIONS = [
  { key: 'accel-show-endtime', label: _('Show end time'), tooltip: _('Toggle showing end time in the panel') },
  { key: 'accel-stop-next', label: _('Stop next timer'), tooltip: _('Stop the next running timer') }
];

function prefsAddChild(container, child) {
  if (container.append) container.append(child);
  else if (container.add) container.add(child);
  else if (container.pack_start) container.pack_start(child, false, false, 0);
  else throw new Error('Unable to add child to container');
}

var PreferencesBuilder = class PreferencesBuilder {
  /**
   * @param {Settings} settings - Optional Settings instance. When provided
   *   (e.g. from the standalone application), this builder will use it
   *   directly instead of constructing its own via ExtensionUtils.
   * @param {string} [basePath] - Optional path to the extension directory (e.g. for
   *   loading settings40.ui and icons when run from standalone, where Me may be unset).
   */
  constructor(settings = null, basePath = null) {
    this._settings = settings || new Settings();
    this._basePath = basePath || (typeof Me !== 'undefined' && Me.path) || '';
    this._builder = new Gtk.Builder();
    this.logger = new Logger('kt prefs', this._settings);

    let iconPath = this._basePath
      ? GLib.build_filenamev([this._basePath, 'icons'])
      : (typeof Me !== 'undefined' && Me.dir ? Me.dir.get_child('icons').get_path() : '');
    if (iconPath) {
      let iconTheme = null;
      try {
        if (Gtk.IconTheme.get_for_display && Gdk.Display.get_default) {
          iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
        } else if (Gtk.IconTheme.get_default) {
          iconTheme = Gtk.IconTheme.get_default();
        }
      } catch (e) {
        iconTheme = null;
      }
      if (iconTheme && typeof iconTheme.add_search_path === 'function') {
        iconTheme.add_search_path(iconPath);
      }
    }
  }

  _extensionPath() {
    return this._basePath || (typeof Me !== 'undefined' && Me.path) || '';
  }

  /**
   * Helpers for remembering last-used directories in the JSON config when
   * running under the standalone app (JSONSettingsProvider). When running
   * as a GNOME Shell extension (GSettings), _provider is null so these are
   * effectively no-ops and we fall back to the given defaults.
   */
  _getLastDir(key, fallback) {
    try {
      const provider = this._settings && this._settings._provider;
      if (provider && typeof provider.get_string === 'function') {
        const val = provider.get_string(key);
        if (val && val.length > 0) {
          return val;
        }
      }
    } catch (e) {
      try { this.logger.debug('Failed to read last dir for %s: %s', key, e); } catch (_e2) {}
    }
    return fallback;
  }

  _setLastDir(key, dir) {
    if (!dir) {
      return;
    }
    try {
      const provider = this._settings && this._settings._provider;
      if (provider && typeof provider.set_string === 'function') {
        provider.set_string(key, dir);
      }
    } catch (e) {
      try { this.logger.debug('Failed to store last dir for %s: %s', key, e); } catch (_e2) {}
    }
  }

  /**
   * Apply a settings value to a GTK widget property in a generic way.
   */
  _applySettingToWidget(widget, property, value) {
    if (!widget) {
      return;
    }
    try {
      const setterName = 'set_' + property;
      if (typeof widget[setterName] === 'function') {
        widget[setterName](value);
      } else if (typeof widget.set_property === 'function') {
        widget.set_property(property, value);
      } else {
        // Last resort: assign directly if it looks like a plain property.
        try {
          widget[property] = value;
        } catch (_e) {}
      }
    } catch (_e) {
      // Ignore individual widget failures; other bindings can still work.
    }
  }

  /**
   * Show a user-friendly error dialog (or fall back to a status label)
   * when something goes wrong during import/export.
   */
  _showErrorDialog(title, message) {
    try {
      let parent = null;
      try {
        parent = this._widget && typeof this._widget.get_root === 'function'
          ? this._widget.get_root()
          : null;
      } catch (_e) {
        parent = null;
      }

      let dialog;
      try {
        dialog = new Gtk.MessageDialog({
          transient_for: parent,
          modal: true,
          buttons: Gtk.ButtonsType.CLOSE,
          message_type: Gtk.MessageType.ERROR,
          text: title,
          secondary_text: message
        });
      } catch (e) {
        // GTK3-style constructor as fallback
        dialog = new Gtk.MessageDialog(
          parent,
          Gtk.DialogFlags.MODAL,
          Gtk.MessageType.ERROR,
          Gtk.ButtonsType.CLOSE,
          title
        );
        try {
          dialog.format_secondary_text(message);
        } catch (_e2) {}
      }

      dialog.connect('response', () => {
        try { dialog.destroy(); } catch (_e3) {}
      });
      dialog.show();
    } catch (_e) {
      // As a last resort, surface the error in the preferences status label.
      try {
        this._bo('import_export_msg').set_text(message);
      } catch (_e2) {}
    }
  }

  show() {
    // In the standalone app, `main.js` is responsible for creating the
    // window, setting size, and adding our scrolled widget. Here we only
    // need to make sure the contents are visible and some extension-only
    // bits are hidden when present.
    try {
      if (this._widget && typeof this._widget.show_all === 'function') {
        this._widget.show_all();
      } else if (this._widget && typeof this._widget.show === 'function') {
        this._widget.show();
      }
    } catch (e) {
      // Ignore visibility errors; the caller will manage the window.
    }
    this._bo('timer_box').hide();
    this._bo('tv_timers').hide();
  }

  _tryLoadSettingsUiFile(basePath) {
    try {
      this._builder.add_from_file(GLib.build_filenamev([basePath, 'settings40.ui']));
      this._layoutKind = 'gtk4';
      return true;
    } catch (e) {
      try {
        this.logger.error('Failed to load settings40.ui, falling back to settings.ui: ' + e);
      } catch (_e) {}
      try {
        this._builder.add_from_file(GLib.build_filenamev([basePath, 'settings.ui']));
        this._layoutKind = 'gtk3';
        return true;
      } catch (e2) {
        try {
          this.logger.error('Failed to load both settings40.ui and settings.ui: ' + e2);
        } catch (_e2) {}
        return false;
      }
    }
  }

  _resolveTaskTimerSettingsRoot() {
    const gtk4RootIds = ['kitchenTimer_settings', 'taskTimer_settings'];
    this._taskTimer_settings = null;
    for (let rid of gtk4RootIds) {
      try {
        let obj = this._builder.get_object(rid);
        if (obj) {
          this._taskTimer_settings = obj;
          break;
        }
      } catch (e) {
        // ignore and continue
      }
    }
    if (!this._taskTimer_settings) {
      this.logger.error('Unable to find root settings widget in settings40.ui (tried ' + gtk4RootIds.join(', ') + '). Preferences may be blank.');
      try {
        let objects = this._builder.get_objects();
        if (objects && objects.length > 0) {
          this._taskTimer_settings = objects[0];
          this.logger.debug('Falling back to first builder object as root.');
        }
      } catch (e) {
        this.logger.error('Failed to fallback to first builder object: ' + e);
      }
    }
  }

  _createPrefsTopWrapperBox() {
    try {
      return new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12 });
    } catch (e) {
      const topWrapper = new Gtk.Box();
      topWrapper.set_orientation(Gtk.Orientation.VERTICAL);
      topWrapper.set_spacing(12);
      return topWrapper;
    }
  }

  _requiredPrefsWidgetIds() {
    if (this._layoutKind === 'gtk3') {
      return [
        'timers_liststore', 'timers_combo', 'spin_hours', 'spin_mins', 'spin_secs',
        'quick_radio', 'timers_add', 'timers_remove', 'timer_enabled', 'timers_combo_entry',
        'tv_timers', 'timer_box'
      ];
    }
    return [
      'version', 'description', 'timers_liststore', 'timers_combo', 'spin_hours', 'spin_mins', 'spin_secs',
      'quick_radio', 'timers_add', 'timers_remove', 'timer_enabled', 'timers_combo_entry', 'tv_timers',
      'timer_icon', 'timer_icon_button', 'link_bmac', 'audio_files_filter', 'json_files_filter', 'import_export_msg',
      'sound_path', 'label_sound_file', 'play_sound', 'play_sound2', 'sound_loops', 'show_time', 'show_progress', 'show_label',
      'sort_by_duration', 'sort_descending', 'save_quick_timers', 'detect_dupes', 'volume_level_warn', 'volume_threshold',
      'accel_enable', 'minimize_to_tray', 'autostart', 'notification', 'notification_sticky', 'theme_variant', 'menu_max_width', 'timer_validation_label',
      'shortcuts_list'
    ];
  }

  _collectMissingPrefsWidgetIds(requiredIds) {
    const missing = [];
    for (let id of requiredIds) {
      try {
        if (!this._builder.get_object(id)) {
          missing.push(id);
        }
      } catch (e) {
        missing.push(id);
      }
    }
    return missing;
  }

  _appendPrefsMissingWidgetsMessage(topWrapper, missing) {
    if (missing.length === 0) {
      return;
    }
    this.logger.error('Preferences UI missing the following widgets: ' + missing.join(', '));
    let msg;
    try {
      msg = new Gtk.Label({ halign: Gtk.Align.START });
    } catch (e) {
      msg = new Gtk.Label();
      try {
        msg.set_halign(Gtk.Align.START);
      } catch (e2) {
        try { msg.set_xalign(0); } catch (_e3) {}
      }
    }
    const textLines = [
      'Preferences failed to load correctly.',
      'The following UI elements are missing from the loaded settings file:',
      '',
      ...missing.map(x => '- ' + x),
      '',
      'Please check your extension installation or the settings file.'
    ];
    try {
      msg.set_text(textLines.join('\n'));
    } catch (e) {
      // As a last resort, ignore; the label will stay empty.
    }
    try {
      if (typeof msg.set_wrap === 'function') {
        msg.set_wrap(true);
      } else if (typeof msg.set_line_wrap === 'function') {
        msg.set_line_wrap(true);
      }
    } catch (_e) {}
    try {
      if (typeof msg.set_selectable === 'function') {
        msg.set_selectable(true);
      }
    } catch (_e) {}
    prefsAddChild(topWrapper, msg);
  }

  _attachPrefsWrapperToViewport(topWrapper) {
    try {
      this._viewport.set_child(topWrapper);
      this._widget.set_child(this._viewport);
    } catch (e) {
      try {
        this._viewport.add(topWrapper);
        this._widget.add(this._viewport);
      } catch (e2) {
        this.logger.error('Failed to attach preferences wrapper to viewport/scrolledwindow: ' + e2);
      }
    }
  }

  _connectExportLogsInBuilder() {
    try {
      let exportLogsBtn = this._builder.get_object('export_logs_button');
      if (exportLogsBtn) {
        exportLogsBtn.connect('clicked', () => { this._export_logs(); });
      }
    } catch (e) {
      this.logger.debug('export_logs_button not present or failed to connect: %s', e);
    }
  }

  _assemblePrefsFromBuilder(basePath) {
    this._tryLoadSettingsUiFile(basePath);
    this._resolveTaskTimerSettingsRoot();
    const topWrapper = this._createPrefsTopWrapperBox();
    const missing = this._collectMissingPrefsWidgetIds(this._requiredPrefsWidgetIds());
    this._appendPrefsMissingWidgetsMessage(topWrapper, missing);

    if (this._taskTimer_settings) {
      try {
        prefsAddChild(topWrapper, this._taskTimer_settings);
      } catch (e) {
        this.logger.error('Failed to attach settings widget to wrapper: ' + e);
      }
      this._attachPrefsWrapperToViewport(topWrapper);
      this._connectExportLogsInBuilder();
    } else {
      this.logger.error('No valid root widget found - returning a wrapper with an error message to avoid crash.');
      try {
        this._viewport.set_child(topWrapper);
        this._widget.set_child(this._viewport);
      } catch (e) {
        try {
          this._viewport.add(topWrapper);
          this._widget.add(this._viewport);
        } catch (e2) {
          this.logger.error('Failed to attach top wrapper in fallback: ' + e2);
        }
      }
    }
  }

  _wirePrefsTimerSection() {
    const version = (typeof Me !== 'undefined' && Me.metadata && Me.metadata.version) ? Me.metadata.version : '?';
    const description = (typeof Me !== 'undefined' && Me.metadata && Me.metadata.description) ? Me.metadata.description.split(/\n/)[0] : 'taskTimer';
    this._bo('version').set_text("Version " + version);
    this._bo('description').set_text(description);

    try {
      let exportLogsBtn = this._builder.get_object('export_logs_button');
      if (exportLogsBtn) {
        exportLogsBtn.connect('clicked', () => { this._export_logs(); });
      }
    } catch (e) {
      try { this.logger.debug('export_logs_button not present or failed to connect: %s', e); } catch (e2) {}
    }

    this.timers_liststore = this._bo('timers_liststore');
    this.timers_combo = this._bo('timers_combo');
    this.spin_hours = this._bo('spin_hours');
    this.spin_mins = this._bo('spin_mins');
    this.spin_secs = this._bo('spin_secs');
    this.quick_radio = this._bo('quick_radio');
    this.timers_add = this._bo('timers_add');
    this.timers_remove = this._bo('timers_remove');
    this.timer_enabled = this._bo('timer_enabled');
    this.timer_validation_label = this._bo('timer_validation_label');

    const onSpinChanged = () => {
      this._validate_timer_form();
      if (this._update_active_liststore_from_tab()) {
        this._save_liststore();
      }
    };
    this.spin_hours.connect('value-changed', onSpinChanged);
    this.spin_mins.connect('value-changed', onSpinChanged);
    this.spin_secs.connect('value-changed', onSpinChanged);

    this.timer_enabled.connect('toggled', () => {
      if (this._update_active_liststore_from_tab()) {
        this._save_liststore();
      }
    });

    this.quick_radio.connect('toggled', () => {
      this._populate_liststore();
    });

    try {
      let entry = this.timers_combo.get_child();
      if (entry) {
        entry.connect('changed', () => {
          this._validate_timer_form();
        });
      }
    } catch (e) {
      this.logger.debug('Could not connect to timer combo entry: %s', e);
    }

    this._populate_liststore();
    this._validate_timer_form();
    this._build_shortcuts_tab();
  }

  build() {
    this._viewport = new Gtk.Viewport();
    this._widget = new Gtk.ScrolledWindow();

    const basePath = this._basePath || (typeof Me !== 'undefined' ? Me.path : '');
    this._assemblePrefsFromBuilder(basePath);

    this._wirePrefsTimerSection();
    return this._widget;
  }

  /**
   * Validate the timer form and display inline error messages.
   * Returns true if valid, false otherwise.
   */
  _validate_timer_form() {
    let hours = this.spin_hours.get_value_as_int();
    let mins = this.spin_mins.get_value_as_int();
    let secs = this.spin_secs.get_value_as_int();
    let totalSeconds = hours * 3600 + mins * 60 + secs;

    let errors = [];

    if (totalSeconds <= 0) {
      errors.push(_("Timer duration must be greater than 0"));
    }

    // Check timer name is not empty
    try {
      let entry = this.timers_combo.get_child();
      if (entry) {
        let name = entry.get_text();
        if (!name || name.trim() === '') {
          errors.push(_("Timer name cannot be empty"));
        }
      }
    } catch (e) {
      // ignore
    }

    // Update validation label
    if (this.timer_validation_label && this.timer_validation_label.set_markup) {
      if (errors.length > 0) {
        let errorText = errors.map(e => "• " + e).join("\n");
        this.timer_validation_label.set_markup('<span color="#e74c3c">' + errorText + '</span>');
        this.timer_validation_label.show();
      } else {
        this.timer_validation_label.set_markup('<span color="#27ae60">' + _("Timer configuration is valid") + '</span>');
        this.timer_validation_label.show();
      }
    }

    // Enable/disable the add button based on validation
    if (this.timers_add && this.timers_add.set_sensitive) {
      this.timers_add.set_sensitive(errors.length === 0);
    }

    return errors.length === 0;
  }

  _spawn_dconf_config(clicks) {
    if (clicks === 2) {
      const base = this._basePath || (typeof Me !== 'undefined' && Me.path) || '';
      var cmd = base + "/bin/dconf-editor.sh";
      this.logger.debug("spawn %s", cmd);
      Utils.spawn(cmd, undefined);
      clicks = 0;
    } else {
      clicks++;
    }
    return clicks;
  }

  _populate_liststore() {
    var quick = this.quick_radio.get_active();

    var timer_settings = quick ? this._settings.unpack_quick_timers() : this._settings.unpack_preset_timers();
    timer_settings.sort( (a,b) => {
      return (a.duration-b.duration);
    });

    this._iter = undefined;
    this.timers_liststore.clear();
    timer_settings.forEach( (timer) => {
      var iter = this.timers_liststore.append();
      this.timers_liststore.set_value(iter, Model.NAME, timer.name);
      this.timers_liststore.set_value(iter, Model.ID, timer.id);
      this.timers_liststore.set_value(iter, Model.DURATION, timer.duration);
      this.timers_liststore.set_value(iter, Model.ENABLED, timer.enabled);
      this.timers_liststore.set_value(iter, Model.QUICK, timer.quick);
      this.timers_liststore.set_value(iter, Model.HMS, new HMS(timer.duration).toString());
      this.timers_liststore.set_value(iter, Model.TRASH, false);
    });

    this.timers_combo.set_active(0);
    let [ ok, iter ] = this.timers_combo.get_active_iter();
    if (ok) {
      this.logger.debug("Populate active iter %s", iter);
      this._iter = iter;
    }
    this._update_timers_tab_from_model(this.timers_combo);
  }

  _save_liststore(pack=true) {
    var model = this.timers_combo.get_model();
    var [ok, iter] = model.get_iter_first();

    var timers = [];
    while (ok) {

      var timer={};
      timer.name = model.get_value(iter, Model.NAME);
      timer.id = model.get_value(iter, Model.ID);
      timer.duration = model.get_value(iter, Model.DURATION);
      timer.enabled = model.get_value(iter, Model.ENABLED);
      timer.quick = model.get_value(iter, Model.QUICK);

      if (timer.duration <= 0) {
        this.logger.warn(`Refusing to save zero length timer ${timer.name} ${timer.duration}`);
      } else {
        this.logger.debug(`Updating ${timer.name} ${timer.duration} ${timer.enabled}`);
        timers.push(timer);
      }

      ok = model.iter_next(iter);
    }
    if (pack) {
      var quick = this.quick_radio.get_active();
      this.logger.debug('Saving updated %s timers to settings', quick ? "quick" : "preset");
      if (quick) {
        this._settings.pack_quick_timers(timers);
      } else {
        this._settings.pack_preset_timers(timers);
      }
    }

  }

  // gnome40
  sound_file_chooser() {
    // import/export settings
    let file_dialog;
    try {
      // Prefer Gtk.FileChooserNative for portal/sandbox friendliness
      file_dialog = new Gtk.FileChooserNative({
        title: _("Sound file"),
        action: Gtk.FileChooserAction.OPEN,
        transient_for: null,
        modal: true,
      });
    } catch (e) {
      // Fallback constructor signature for older GTK versions
      file_dialog = new Gtk.FileChooserNative(
        _("Sound file"),
        null,
        Gtk.FileChooserAction.OPEN,
        null,
        null
      );
    }

    let sound_file = this._settings.sound_file;
    if (GLib.basename(sound_file) == sound_file) {
      sound_file = GLib.build_filenamev([ this._extensionPath(), sound_file ]);
    }
    this.logger.debug("sound_file="+sound_file);

    try {
      file_dialog.set_filter(this._bo('audio_files_filter'));
    } catch (_e) {}
    try {
      const baseDir = this._getLastDir('last-sound-dir', this._extensionPath());
      file_dialog.set_current_folder(Gio.File.new_for_path(baseDir));
    } catch (_e) {}
    try {
      file_dialog.set_current_name(sound_file);
    } catch (_e) {}

    file_dialog.connect('response', (dialog, response_id) => {
      if (response_id === Gtk.ResponseType.ACCEPT || response_id === Gtk.ResponseType.OK) {
        // outputs "-5"
        this.logger.debug("response_id=%d", response_id);

        var sound_file = dialog.get_file().get_path();

        this.logger.debug("Selected sound file %s", sound_file);

        this._settings.sound_file = sound_file;
        this._bo('label_sound_file').set_label(GLib.basename(sound_file));
        try {
          const dir = GLib.path_get_dirname(sound_file);
          this._setLastDir('last-sound-dir', dir);
        } catch (_e) {}
      }

      // destroy the dialog regardless of the response when we're done.
      dialog.destroy();
    });

    file_dialog.show();
  }

  // https://stackoverflow.com/questions/54487052/how-do-i-add-a-save-button-to-the-gtk-filechooser-dialog
  export_settings() {
    // import/export settings
    let file_dialog;
    try {
      file_dialog = new Gtk.FileChooserNative({
        title: _("Export"),
        action: Gtk.FileChooserAction.SAVE,
        transient_for: null,
        modal: true,
      });
    } catch (e) {
      file_dialog = new Gtk.FileChooserNative(
        _("Export"),
        null,
        Gtk.FileChooserAction.SAVE,
        null,
        null
      );
    }

    let settings_json = 'tasktimer_settings.json';

    this.logger.debug("json file=%s", settings_json);
    try {
      file_dialog.set_filter(this._bo('json_files_filter'));
    } catch (_e) {}
    try {
      file_dialog.set_current_name(settings_json);
    } catch (_e) {}
    try {
      const baseDir = this._getLastDir('last-export-dir', this._extensionPath());
      file_dialog.set_current_folder(Gio.File.new_for_path(baseDir));
    } catch (_e) {}

    file_dialog.connect('response', (dialog, response_id) => {
      if (response_id === Gtk.ResponseType.ACCEPT || response_id === Gtk.ResponseType.OK) {
       // outputs "-5"
        this.logger.debug("response_id=%d", response_id);

        var file = dialog.get_file();

        this.logger.debug(file.get_path());

        var json = this._settings.export_json();
        //this.logger.debug("json=%s", json);

        file.replace_contents_bytes_async(
          new GLib.Bytes(json),
          null,
          false,
          Gio.FileCreateFlags.REPLACE_DESTINATION,
          null,
          // "shadowing" variable with the same name is another way
          // to prevent cyclic references in callbacks.
          (file, res) => {
            try {
              file.replace_contents_finish(res);
              this._bo('import_export_msg').set_text(_("Exported settings to %s".format(file.get_path())));
              try {
                const dir = GLib.path_get_dirname(file.get_path());
                this._setLastDir('last-export-dir', dir);
              } catch (_e) {}
            } catch (e) {
              this.logger.debug("Failed to export settings to %s: %s", file.get_path(), e);
            }
          }
        );
      } else {
        this.logger.debug("response_id not handled: %d", response_id);
      }

      // destroy the dialog regardless of the response when we're done.
      dialog.destroy();
    });

    file_dialog.show();
  }

  import_settings() {
    // import/export settings
    let file_dialog;
    try {
      file_dialog = new Gtk.FileChooserNative({
        title: _("Import"),
        action: Gtk.FileChooserAction.OPEN,
        transient_for: null,
        modal: true,
      });
    } catch (e) {
      file_dialog = new Gtk.FileChooserNative(
        _("Import"),
        null,
        Gtk.FileChooserAction.OPEN,
        null,
        null
      );
    }

    let settings_json = 'tasktimer_settings.json' ;

    this.logger.debug("json file=%s", settings_json);
    try {
      file_dialog.set_filter(this._bo('json_files_filter'));
    } catch (_e) {}
    try {
      file_dialog.set_current_name(settings_json);
    } catch (_e) {}
    try {
      const baseDir = this._getLastDir('last-import-dir', this._extensionPath());
      file_dialog.set_current_folder(Gio.File.new_for_path(baseDir));
    } catch (_e) {}

    file_dialog.connect('response', (dialog, response_id) => {
      if (response_id === Gtk.ResponseType.ACCEPT || response_id === Gtk.ResponseType.OK) {
        // outputs "-5"
        this.logger.debug("response_id=%d", response_id);

        var file = dialog.get_file();

        this.logger.debug(file.get_path());

        file.read_async(GLib.PRIORITY_DEFAULT, null, (file, res) => {
          try {
            var stream = file.read_finish(res);
            var size = file.query_info("standard::size", Gio.FileQueryInfoFlags.NONE, null).get_size();
            var data = stream.read_bytes(size, null).get_data();
            var json = ByteArray.toString(data);
            try {
              this._settings.import_json(json);
            } catch (e) {
              // Likely invalid or incompatible JSON; show a user-friendly error.
              logError(e, "Failed to import taskTimer settings JSON");
              const msg = _("The selected file could not be imported.\n\nDetails: %s").format(e.message || String(e));
              this._showErrorDialog(_("Import failed"), msg);
              return;
            }

            this._bo('import_export_msg').set_text(_("Imported settings from %s".format(file.get_path())));
            try {
              const dir = GLib.path_get_dirname(file.get_path());
              this._setLastDir('last-import-dir', dir);
            } catch (_e) {}
          } catch(e) {
            logError(e, "Failed to read kitchen timer settings import file");
            const msg = _("Failed to read the selected file.\n\nDetails: %s").format(e.message || String(e));
            this._showErrorDialog(_("Import failed"), msg);
          }
        });
      }

      // destroy the dialog regardless of the response when we're done.
      dialog.destroy();
    });

    file_dialog.show();
            var data = stream.read_bytes(size, null).get_data();
            var json = Utils.bytesToString ? Utils.bytesToString(data) : ByteArray.toString(data);
  }

  _update_combo_model_entry(combo, iter, entry) {
    if (!this.allow_updates) {
      this.logger.debug('Updates not allowed entry=%s', entry);
      return;
    }
    var model = combo.get_model();
    var name = model.get_value(iter, Model.NAME);
    if (name !== entry) {
      this.logger.debug(`Update model entry from ${name} to ${entry}`);
      model.set_value(iter, Model.NAME, entry);
      this._save_liststore();
    }
  }

  // return true if the liststore was updated
  _update_active_liststore_from_tab() {
    if (!this.allow_updates) {
      this.logger.debug('Updates not allowed');
      return false;
    }
    var [ ok, iter ] = this.timers_combo.get_active_iter();
    if (!ok && this._iter) {
      iter = this._iter;
      ok = true;
    }
    if (ok) {
      this.allow_updates = false;
      var model = this.timers_combo.get_model();

      var hms = new HMS();
      hms.hours = this.spin_hours.get_value_as_int();
      hms.minutes = this.spin_mins.get_value_as_int();
      hms.seconds = this.spin_secs.get_value_as_int();

      var name = this.timers_combo_entry.get_text();
      var id = model.get_value(iter, Model.ID);
      id = Utils.uuid(id);
      var enabled = this.timer_enabled.get_active();
      var quick = this.quick_radio.get_active();
      var duration = hms.toSeconds();

      ok = false;
      if (model.get_value(iter, Model.NAME) !== name) {
        this.logger.debug(`name change to ${name}`);
        ok = true;
        model.set_value(iter, Model.NAME, name);
      }
      if (model.get_value(iter, Model.ID) !== id) {
        this.logger.debug(`id changed to ${id}`);
        ok = true;
        model.set_value(iter, Model.ID, id);
      }
      var curdur=model.get_value(iter, Model.DURATION);
      if (curdur !== duration) {
        this.logger.debug(`${name} duration changed from ${curdur} to ${duration}`);
        this.logger.debug(hms.pretty());
        ok = true;
        model.set_value(iter, Model.DURATION, duration);
      }
      if (model.get_value(iter, Model.ENABLED) !== enabled) {
        this.logger.debug(`enabled changed to ${enabled}`);
        ok = true;
        model.set_value(iter, Model.ENABLED, enabled);
      }
      if (model.get_value(iter, Model.QUICK) !== quick) {
        this.logger.debug(`quick changed to ${quick}`);
        ok = true;
        model.set_value(iter, Model.QUICK, quick);
      }
      if (model.get_value(iter, Model.HMS) !== hms.toString()) {
        this.logger.debug("HMS changed to %s", hms.toString());
        ok = true;
        model.set_value(iter, Model.HMS, hms.toString());
      }
      if (ok) {
        this.logger.debug(`Updating liststore for ${name} entry`);
      }
      this.allow_updates = true;
    } else {
      this.logger.debug('cannot update liststore entry, combo has no active iter');
    }
    return ok;
  }


  _update_active_listore_entry(timer) {
    var [ ok, iter ] = this.timers_combo.get_active_iter();
    if (ok) {
      this.timers_liststore.set_value(iter, Model.NAME, timer.name);
      this.timers_liststore.set_value(iter, Model.ID, timer.id);
      this.timers_liststore.set_value(iter, Model.DURATION, timer.duration);
      this.timers_liststore.set_value(iter, Model.ENABLED, timer.enabled);
      this.timers_liststore.set_value(iter, Model.QUICK, timer.quick);
    } else {
      this.logger.debug('cannot update liststore entry, combo has no active iter');
    }
  }

  _get_active_liststore_entry() {
    var model = this.timers_combo.get_model();
    var [ ok, iter ] = this.timers_combo.get_active_iter();
    var timer = {}
    if (ok) {
      timer.name = model.get_value(iter, Model.NAME);
      timer.id = model.get_value(iter, Model.ID);
      timer.duration = model.get_value(iter, Model.DURATION);
      timer.enabled = model.get_value(iter, Model.ENABLED);
      timer.quick = model.get_value(iter, Model.QUICK);
    } else {
      this.logger.debug('cannot get active liststore entry, combo has no active iter');
    }
    return timer;
  }

  _update_timers_tab_from_model(timers_combo, entry=undefined) {
    if (!this.allow_updates) {
      return false;
    }
    var model = timers_combo.get_model();
    var [ ok, iter ] = model.get_iter_first();
    if (!ok) {
      // model is empty
      return true;
    }
    [ ok, iter ] = timers_combo.get_active_iter();
    if (ok) {
      this.allow_updates = false;
      var name = model.get_value(iter, Model.NAME);
      if (entry !== undefined && entry !== name) {
        name = entry;
        model.set_value(iter, Model.NAME, name);
        this._save_liststore(true);
      }
      var id = model.get_value(iter, Model.ID);
      var duration = model.get_value(iter, Model.DURATION);
      var enabled = model.get_value(iter, Model.ENABLED);
      var hms = new HMS(duration);
      this._update_spinners(hms);
      this.timer_enabled.set_active(enabled);
      this.allow_updates = true;
      return true;
    } else {
      this.logger.debug("cannot update combo from liststore, combo has non active iter");
    }
    return false;
  }

  _update_spinners(hms) {
    this.spin_hours.set_value(hms.hours);
    this.spin_mins.set_value(hms.minutes);
    this.spin_secs.set_value(hms.seconds);
  }

  /**
   * Get Gtk Builder object by id. If the object is missing return a "noop"
   * proxy that safely swallows method calls and returns safe defaults so
   * the preferences code does not crash; also log the missing id.
   */
  _bo(id) {
    let obj = this._builder.get_object(id);
    if (obj) return obj;

    try {
      this.logger.error(`Builder returned null for id='${id}'`);
    } catch (e) {
      // ignore
    }

    const logger = this.logger;

    const safeDefaults = {
      get_active_iter: () => [false, null],
      get_iter_first: () => [false, null],
      iter_nth_child: () => [false, null],
      iter_n_children: () => 0,
      get_model: () => null,
      get_value: () => null,
      remove: () => false,
      clear: () => {},
      set_value: () => {},
      set_active: () => {},
      set_active_iter: () => {},
      get_text: () => '',
      set_text: () => {},
      set_markup: () => {},
      set_label: () => {},
      hide: () => {},
      show_all: () => {},
      connect: () => {},
      set_child: () => {},
      add: () => {},
      append: () => {},
      pack_start: () => {},
      set_orientation: () => {},
      set_spacing: () => {},
      set_property: () => {},
      get_root: () => null,
      get_toplevel: () => null
    };

    const noop = new Proxy(function() {}, {
      get(target, prop) {
        if (prop === 'toString') return () => `<noop:${id}>`;
        if (prop in safeDefaults) return safeDefaults[prop];
        // return a generic noop function for any method
        return function() {
          try { logger.debug(`Called noop method '${String(prop)}' on missing builder object '${id}'`); } catch (e) {}
          return null;
        };
      },
      apply(target, thisArg, args) {
        return null;
      }
    });

    return noop;
  }

  // Export logs helper: shows a file chooser and writes buffered logs to the chosen path
  _export_logs() {
    try {
      let file_dialog;
      try {
        file_dialog = new Gtk.FileChooserNative({
          title: _('Export logs'),
          action: Gtk.FileChooserAction.SAVE,
          transient_for: null,
          modal: true,
        });
      } catch (e) {
        file_dialog = new Gtk.FileChooserNative(
          _('Export logs'),
          null,
          Gtk.FileChooserAction.SAVE,
          null,
          null
        );
      }

      // Prefer an XDG-appropriate default directory for log exports:
      //   ~/.local/share/tasktimer/logs/
      let default_name = 'tasktimer_logs.txt';
      let logsDir = null;
      try {
        const baseDataDir = GLib.get_user_data_dir(); // usually ~/.local/share
        logsDir = GLib.build_filenamev([baseDataDir, 'tasktimer', 'logs']);
        try {
          GLib.mkdir_with_parents(logsDir, 0o755);
        } catch (_e) {
          // ignore mkdir errors; we still let the user pick another path
        }
      } catch (_e) {
        logsDir = null;
      }
      try {
        file_dialog.set_current_name(default_name);
      } catch (_e) {}
      try {
        const remembered = this._getLastDir('last-logs-dir', null);
        const folderPath = remembered || logsDir || this._extensionPath();
        file_dialog.set_current_folder(Gio.File.new_for_path(folderPath));
      } catch (_e) {}

      file_dialog.connect('response', (dialog, response_id) => {
        if (response_id === Gtk.ResponseType.ACCEPT || response_id === Gtk.ResponseType.OK) {
          try {
            let file = dialog.get_file();
            let path = file.get_path();
            try {
              const dir = GLib.path_get_dirname(path);
              this._setLastDir('last-logs-dir', dir);
            } catch (_e) {}
            // Use logger's exportToFile if available
            let logger = this.logger;
            if (logger && typeof logger.exportToFile === 'function') {
              let ok = logger.exportToFile(path);
              if (ok) {
                try { this._bo('import_export_msg').set_text(_('Exported logs to %s'.format(path))); } catch (e) {}
              } else {
                try { this._bo('import_export_msg').set_text(_('Failed to export logs to %s'.format(path))); } catch (e) {}
              }
            } else {
              // fallback: write buffered logs using GLib
              let buffer = '';
              try { buffer = this.logger.getBufferedLogs(); } catch (e) { buffer = 'No logs available'; }
              try {
                GLib.file_set_contents(path, buffer);
                try { this._bo('import_export_msg').set_text(_('Exported logs to %s'.format(path))); } catch (e) {}
              } catch (e) {
                this.logger.error('Failed to write logs to %s: %s', path, e);
                try { this._bo('import_export_msg').set_text(_('Failed to export logs to %s'.format(path))); } catch (e) {}
              }
            }
          } catch (e) {
            this.logger.error('Exception during export logs: %s', e);
          }
        }
        dialog.destroy();
      });

      file_dialog.show();
    } catch (e) {
      this.logger.error('Failed to open export logs dialog: %s', e);
    }
  }

  /**
   * Bind setting to builder object
   */
  _ssb(key, object, property, flags=Gio.SettingsBindFlags.DEFAULT) {
    if (!object) {
      this.logger.error(`object is null for key=${key}`);
      return;
    }

    // When running as an extension (no JSON provider), use the existing
    // Gio.Settings binding so that all schema defaults and types apply.
    if (this._settings && !this._settings._provider && this._settings.settings) {
      this._settings.settings.bind(key, object, property, flags);
      return;
    }

    // When running under the standalone JSON provider, bind directly to the
    // Settings wrapper's properties (which in turn write to the provider).
    const settingProp = key.replace(/-/g, '_');
    if (!this._settings || typeof this._settings[settingProp] === 'undefined') {
      try {
        this.logger.debug('No settings property found for key=%s (prop=%s)', key, settingProp);
      } catch (_e) {}
      return;
    }

    // Initialize widget from current value.
    try {
      const current = this._settings[settingProp];
      this._applySettingToWidget(object, property, current);
    } catch (_e) {
      // ignore
    }

    // Watch for user changes and push back into Settings.
    try {
      const notifySignal = 'notify::' + property;
      object.connect(notifySignal, () => {
        try {
          const getterName = 'get_' + property;
          let v;
          if (typeof object[getterName] === 'function') {
            v = object[getterName]();
          } else {
            // Fallback: read via GObject property bag if available.
            if (typeof object.get_property === 'function') {
              v = object.get_property(property);
            } else {
              v = object[property];
            }
          }
          this._settings[settingProp] = v;
        } catch (e) {
          try {
            this.logger.error('Failed to propagate widget change for key=%s: %s', key, e);
          } catch (_e2) {}
        }
      });
    } catch (_e) {
      // ignore notify connection failures
    }
  }

  _bo_ssb(id, property, flags=Gio.SettingsBindFlags.DEFAULT) {
    let object = this._bo(id);
    let key=id.replace(/_/g, '-');
    this._ssb(key, object, property, flags);
  }

  _bind() {
    this._bo_ssb('accel_enable', 'active');
    this._bo_ssb('minimize_to_tray', 'active');
    this._bo_ssb('autostart', 'active');

    this._bo_ssb('notification', 'active');
    this._bo_ssb('notification_sticky', 'active');

    let show_time = this._bo('show_time');
    this._ssb('show-time', show_time, 'active');

    let show_progress = this._bo('show_progress');
    this._ssb('show-progress', show_progress, 'active');

    let show_label = this._bo('show_label');
    this._ssb('show-label', show_label, 'active');

    let play_sound = this._bo('play_sound');
    this._ssb('play-sound', play_sound, 'active');
    this._ssb('play-sound', this._bo('play_sound2'), 'active');

    let sound_loops = this._bo('sound_loops');
    this._ssb('sound-loops', sound_loops, 'value');

    let sort_by_duration = this._bo('sort_by_duration');
    this._ssb('sort-by-duration', sort_by_duration, 'active');

    let sort_descending = this._bo('sort_descending');
    this._ssb('sort-descending', sort_descending, 'active');

    let save_quick_timers = this._bo('save_quick_timers')
    this._ssb('save-quick-timers', save_quick_timers, 'active');

    let detect_dupes = this._bo('detect_dupes');
    this._ssb('detect-dupes', detect_dupes, 'active');

    let volume_level_warn = this._bo('volume_level_warn');
    this._ssb('volume-level-warn', volume_level_warn, 'active');

    let volume_threshold = this._bo('volume_threshold');
    this._ssb('volume-threshold', volume_threshold, 'value');

    let theme_variant = this._bo('theme_variant');
    if (theme_variant) {
      this._ssb('theme-variant', theme_variant, this._layoutKind === 'gtk3' ? 'active-id' : 'selected');
    }
    this._bo_ssb('menu_max_width', 'value');
  }

  _build_shortcuts_tab() {
    let listBox = null;
    try {
      listBox = this._builder.get_object('shortcuts_list');
    } catch (e) {
      return;
    }
    if (!listBox) return;

    const note = new Gtk.Label({
      label: _('Assign key combinations below. Enable "Keyboard shortcuts" in the Options tab to use them.'),
      wrap: true,
      xalign: 0,
      margin_bottom: 8
    });
    note.add_css_class('dim-label');
    listBox.append(note);

    const settingsKeyFromKey = (key) => key.replace(/-/g, '_');
    const getAccel = (key) => {
      const sk = settingsKeyFromKey(key);
      return (this._settings[sk] !== undefined && this._settings[sk] !== null) ? String(this._settings[sk]) : '';
    };
    const setAccel = (key, value) => {
      const sk = settingsKeyFromKey(key);
      if (typeof this._settings[sk] !== 'undefined') {
        this._settings[sk] = value || '';
      }
    };

    for (const action of SHORTCUT_ACTIONS) {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12 });
      const label = new Gtk.Label({ label: action.label, halign: Gtk.Align.START, hexpand: true });
      if (action.tooltip) label.set_tooltip_text(action.tooltip);
      const accelLabel = new Gtk.Label({ label: getAccel(action.key) || _('None'), selectable: true });
      accelLabel.add_css_class('dim-label');
      const setBtn = new Gtk.Button({ label: _('Set…') });
      const clearBtn = new Gtk.Button({ label: _('Clear') });

      const updateAccelDisplay = (val) => {
        accelLabel.set_label(val || _('None'));
      };

      setBtn.connect('clicked', () => {
        setBtn.set_sensitive(false);
        accelLabel.set_label(_('Press a key combination…'));
        const win = this._widget.get_root();
        if (!win) {
          setBtn.set_sensitive(true);
          updateAccelDisplay(getAccel(action.key));
          return;
        }
        const controller = new Gtk.EventControllerKey();
        const done = (accel) => {
          win.remove_controller(controller);
          setBtn.set_sensitive(true);
          if (accel !== null) {
            setAccel(action.key, accel);
            updateAccelDisplay(accel);
          } else {
            updateAccelDisplay(getAccel(action.key));
          }
        };
        controller.connect('key-pressed', (self, keyval, keycode, state) => {
          const accel = this._keyEventToAccelerator(keyval, state);
          if (accel) done(accel);
          return true;
        });
        controller.connect('key-released', () => { return false; });
        win.add_controller(controller);
      });

      clearBtn.connect('clicked', () => {
        setAccel(action.key, '');
        updateAccelDisplay('');
      });

      row.append(label);
      row.append(accelLabel);
      row.append(setBtn);
      row.append(clearBtn);
      listBox.append(row);
    }
  }

  /**
   * Build an accelerator string from a keyval and modifier state (e.g. from GtkEventControllerKey).
   * @returns {string} e.g. "<Control><Shift>a" or "" if invalid
   */
  _keyEventToAccelerator(keyval, state) {
    const Gdk = imports.gi.Gdk;
    const parts = [];
    if (state & Gdk.ModifierType.CONTROL_MASK) parts.push('<Control>');
    if (state & Gdk.ModifierType.SHIFT_MASK) parts.push('<Shift>');
    if (state & Gdk.ModifierType.ALT_MASK) parts.push('<Alt>');
    if (state & Gdk.ModifierType.SUPER_MASK) parts.push('<Super>');
    const name = Gdk.keyval_name(keyval);
    if (!name) return '';
    parts.push(name);
    return parts.join('');
  }
};

function init() {
}

function buildPrefsWidget() {
  ExtensionUtils.initTranslations(GETTEXT_DOMAIN);

  var preferencesBuilder = new PreferencesBuilder();
  var widget = preferencesBuilder.build();
  preferencesBuilder.show();

  widget.connect('realize', () => {
    let window = widget.get_root();
    preferencesBuilder.logger.debug('window=%s', window);
    //window.default_width = 700;
    //window.default_height = 900;
    //window.set_default_icon_name('view-paged-symbolic');
    //window.resize(700, 900);
  });

  return widget;
}
