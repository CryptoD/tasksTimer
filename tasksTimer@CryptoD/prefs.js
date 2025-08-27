/*
 * taskTimer: Gnome Shell taskTimer Extension
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
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
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
}

class PreferencesBuilder {
  constructor() {
    this._settings = new Settings();
    this._builder = new Gtk.Builder();
    this.logger = new Logger('kt prefs', this._settings);

    if (Utils.isGnome40()) {
      let iconPath = Me.dir.get_child("icons").get_path();
      let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
      iconTheme.add_search_path(iconPath);
    }
  }

  show() {
    if (Utils.isGnome3x()) {
      this._widget.show_all();
    } else {
      let window = this._widget.get_root();
      if (window) {
        // why is this null?
        window.default_width = 700;
        window.default_height = 900;
      }
      // window.resize(700, 900);
    }
    this._bo('timer_box').hide();
    this.tv_timers.hide();
  }

  build() {
    this._viewport = new Gtk.Viewport();
    this._widget = new Gtk.ScrolledWindow();

    if (Utils.isGnome3x()) {
      this._builder.add_from_file(GLib.build_filenamev([Me.path, 'settings.ui']));
      this._taskTimer_settings = this._builder.get_object('taskTimer_settings');
      this._viewport.add(this._taskTimer_settings);
      this._widget.add(this._viewport);
    } else {
      this._builder.add_from_file(GLib.build_filenamev([Me.path, 'settings40.ui']));

      // settings40.ui uses a different root ID (kitchenTimer_settings) compared to
      // the GTK3 settings.ui (taskTimer_settings). Try the GTK4 root id first
      // and fall back to the GTK3 id if necessary.
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
        // As a last resort, try to use the builder's first object if available
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

      // We will wrap the settings widget into a top-level container so we can
      // display a helpful error message to the user if some UI elements are missing.
      let topWrapper;
      try {
        topWrapper = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 12});
      } catch (e) {
        // Some environments may not accept object literal constructors; fallback
        topWrapper = new Gtk.Box();
        topWrapper.set_orientation(Gtk.Orientation.VERTICAL);
        topWrapper.set_spacing(12);
      }

      function addChild(container, child) {
        // Support both GTK3 and GTK4 container child APIs
        if (container.append) container.append(child);
        else if (container.add) container.add(child);
        else if (container.pack_start) container.pack_start(child, false, false, 0);
        else throw new Error('Unable to add child to container');
      }

      // List of widget IDs that are used later in prefs.js. We'll check for their
      // existence and show a helpful message if some are missing.
      const requiredIds = [
        'version','description','timers_liststore','timers_combo','spin_hours','spin_mins','spin_secs',
        'quick_radio','timers_add','timers_remove','timer_enabled','timers_combo_entry','tv_timers',
        'timer_icon','timer_icon_button','link_bmac','audio_files_filter','json_files_filter','import_export_msg',
        'sound_path','label_sound_file','play_sound','play_sound2','sound_loops','show_time','show_progress','show_label',
        'sort_by_duration','sort_descending','save_quick_timers','detect_dupes','volume_level_warn','volume_threshold',
        'accel_enable','notification','notification_sticky'
      ];

      let missing = [];
      for (let id of requiredIds) {
        try {
          if (!this._builder.get_object(id)) {
            missing.push(id);
          }
        } catch (e) {
          missing.push(id);
        }
      }

      if (missing.length > 0) {
        this.logger.error('Preferences UI missing the following widgets: ' + missing.join(', '));

        // Create a visible message to inform the user about missing widgets
        let msg;
        try {
          msg = new Gtk.Label({use_markup: true, xalign: 0});
        } catch (e) {
          msg = new Gtk.Label();
          msg.set_xalign(0);
        }

        let text = '<b>Preferences failed to load correctly</b>\nThe following UI elements are missing from the loaded settings file:\n' + missing.map(x => '- ' + x).join('\n') + '\n\nPlease check your extension installation or the settings file.';
        // Use markup for the heading but avoid injection for the list
        let markup = '<b>Preferences failed to load correctly</b><br/><small>The following UI elements are missing from the loaded settings file:</small><br/>' + missing.map(x => '<tt>' + x + '</tt>').join('<br/>') + '<br/><br/><small>Please check your extension installation or the settings file.</small>';
        try {
          msg.set_markup(markup);
        } catch (e) {
          msg.set_text(text);
        }
        msg.set_line_wrap(true);
        msg.set_selectable(true);

        addChild(topWrapper, msg);
      }

      if (this._taskTimer_settings) {
        try {
          addChild(topWrapper, this._taskTimer_settings);
        } catch (e) {
          this.logger.error('Failed to attach settings widget to wrapper: ' + e);
        }

        // Attach wrapper to viewport / scrolled window for GTK4
        try {
          this._viewport.set_child(topWrapper);
          this._widget.set_child(this._viewport);
        } catch (e) {
          // Some older GJS/GTK4 combos may not have set_child on ScrolledWindow
          try {
            this._viewport.add(topWrapper);
            this._widget.add(this._viewport);
          } catch (e2) {
            this.logger.error('Failed to attach preferences wrapper to viewport/scrolledwindow: ' + e2);
          }
        }

        // If the export logs button exists in the builder, connect it
        try {
          let exportLogsBtn = this._builder.get_object('export_logs_button');
          if (exportLogsBtn) {
            exportLogsBtn.connect('clicked', () => { this._export_logs(); });
          }
        } catch (e) {
          this.logger.debug('export_logs_button not present or failed to connect: %s', e);
        }
      } else {
        // prevent calling set_child with null which can crash or show blank UI
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

    this._bo('version').set_text("Version "+Me.metadata.version);
    this._bo('description').set_text(Me.metadata.description.split(/\n/)[0]);

    // Connect Export Logs button if present (both GTK3 & GTK4 UI)
    try {
      let exportLogsBtn = this._builder.get_object('export_logs_button');
      if (exportLogsBtn) {
        exportLogsBtn.connect('clicked', () => { this._export_logs(); });
      }
    } catch (e) {
      try { this.logger.debug('export_logs_button not present or failed to connect: %s', e); } catch (e2) {}
    }

    // Timers

    this.timers_liststore = this._bo('timers_liststore');
    this.timers_combo = this._bo('timers_combo');

    //let entry_name = this._bo('entry_name');
    this.spin_hours = this._bo('spin_hours');
    this.spin_mins = this._bo('spin_mins');
    this.spin_secs = this._bo('spin_secs');

    this.quick_radio = this._bo('quick_radio');
    this.timers_add = this._bo('timers_add');
    this.timers_remove = this._bo('timers_remove');
    this.timer_enabled = this._bo('timer_enabled');

    this.spin_hours.connect('value-changed', (spin) => {
      if (this._update_active_liststore_from_tab()) {
        this._save_liststore();
      }
     });

    this.spin_mins.connect('value-changed', (spin) => {
      if (this._update_active_liststore_from_tab()) {
        this._save_liststore();
      }
    });

    this.spin_secs.connect('value-changed', (spin) => {
      if (this._update_active_liststore_from_tab()) {
        this._save_liststore();
      }
    });

    this.timer_enabled.connect('toggled', () => {
      if (this._update_active_liststore_from_tab()) {
        this._save_liststore();
      }
    });

    this.quick_radio.connect('toggled', (quick_radio) => {
      this._populate_liststore();
    });

  _spawn_dconf_config(clicks) {
    if (clicks === 2) {
      var cmd = Me.path+"/bin/dconf-editor.sh";
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
    var file_dialog = new Gtk.FileChooserDialog( {
      action: Gtk.FileChooserAction.OPEN,
      //local_only: false,
      create_folders: true
    });

    if (file_dialog.current_folder == undefined) {
       file_dialog.current_folder = Me.path;
    }

    let sound_file = this._settings.sound_file;
    if (GLib.basename(sound_file) == sound_file) {
      sound_file = GLib.build_filenamev([ Me.path, sound_file ]);
    }
    this.logger.debug("sound_file="+sound_file);

    file_dialog.set_filter(this._bo('audio_files_filter'));
    file_dialog.set_current_folder(Gio.File.new_for_path(Me.path));
    file_dialog.set_current_name(sound_file);
    file_dialog.title = _("Sound file");
    //file_dialog.set_do_overwrite_confirmation(true);
    file_dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);
    file_dialog.add_button('Open', Gtk.ResponseType.OK);
    this.logger.debug("action=%s", ""+file_dialog.get_action());

    file_dialog.connect('response', (dialog, response_id) => {
      if (response_id === Gtk.ResponseType.OK) {
        // outputs "-5"
        this.logger.debug("response_id=%d", response_id);

        var sound_file = dialog.get_file().get_path();

        this.logger.debug("Selected sound file %s", sound_file);

        this._settings.sound_file = sound_file;
        this._bo('label_sound_file').set_label(GLib.basename(sound_file));
      }

      // destroy the dialog regardless of the response when we're done.
      dialog.destroy();
    });

    file_dialog.show();
  }

  // https://stackoverflow.com/questions/54487052/how-do-i-add-a-save-button-to-the-gtk-filechooser-dialog
  export_settings() {
    // import/export settings
    var file_dialog = new Gtk.FileChooserDialog( {
      title: _("Export"),
      action: Gtk.FileChooserAction.SAVE,
      create_folders: true
    });

    if (file_dialog.current_folder == undefined) {
       file_dialog.current_folder = Me.path;
    }

    let settings_json = 'tasktimer_settings.json';

    this.logger.debug("json file=%s", settings_json);
    file_dialog.set_filter(this._bo('json_files_filter'));
    file_dialog.set_current_name(settings_json);
    file_dialog.title = _("Export");
    file_dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);
    file_dialog.add_button('Export', Gtk.ResponseType.OK);
    this.logger.debug("action=%s", ""+file_dialog.get_action());

    if (Utils.isGnome3x()) {
      file_dialog.set_current_folder(Me.path);
      file_dialog.set_do_overwrite_confirmation(true);
      file_dialog.set_local_only(true);
    } else {
      file_dialog.set_current_folder(Gio.File.new_for_path(Me.path));
    }

    file_dialog.connect('response', (dialog, response_id) => {
      if (response_id === Gtk.ResponseType.OK) {
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
    var file_dialog = new Gtk.FileChooserDialog( {
      action: Gtk.FileChooserAction.OPEN,
      create_folders: true
    });

    if (file_dialog.current_folder == undefined) {
       file_dialog.current_folder = Me.path;
    }

    let settings_json = 'tasktimer_settings.json' ;

    this.logger.debug("json file=%s", settings_json);
    file_dialog.set_filter(this._bo('json_files_filter'));
    file_dialog.set_current_name(settings_json);
    file_dialog.title = _("Import");
    file_dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);
    file_dialog.add_button('Import', Gtk.ResponseType.OK);
    this.logger.debug("action=%s", ""+file_dialog.get_action());

    if (Utils.isGnome3x()) {
      file_dialog.set_current_folder(Me.path);
      file_dialog.set_local_only(true);
    } else {
      file_dialog.set_current_folder(Gio.File.new_for_path(Me.path));
    }

    file_dialog.connect('response', (dialog, response_id) => {
      if (response_id === Gtk.ResponseType.OK) {
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
            //this.logger.debug("json=%s", json);
            this._settings.import_json(json);
            this._bo('import_export_msg').set_text(_("Imported settings from %s".format(file.get_path())));
          } catch(e) {
            logError(e, "Failed to read kitchen timer settings import file");
          }
        });
      }

      // destroy the dialog regardless of the response when we're done.
      dialog.destroy();
    });

    file_dialog.show();
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
      append: () => null,
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
      const file_dialog = new Gtk.FileChooserDialog({
        title: _('Export logs'),
        action: Gtk.FileChooserAction.SAVE,
        create_folders: true
      });

      if (file_dialog.current_folder == undefined) {
        file_dialog.current_folder = Me.path;
      }

      let default_name = 'tasktimer_logs.txt';
      file_dialog.set_current_name(default_name);
      file_dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);
      file_dialog.add_button('Export', Gtk.ResponseType.OK);

      if (!Utils.isGnome3x()) {
        file_dialog.set_current_folder(Gio.File.new_for_path(Me.path));
      } else {
        file_dialog.set_current_folder(Me.path);
      }

      file_dialog.connect('response', (dialog, response_id) => {
        if (response_id === Gtk.ResponseType.OK) {
          try {
            let file = dialog.get_file();
            let path = file.get_path();
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
    if (object) {
      this._settings.settings.bind(key, object, property, flags);
    } else {
      this.logger.error(`object is null for key=${key}`);
    }
  }

  _bo_ssb(id, property, flags=Gio.SettingsBindFlags.DEFAULT) {
    let object = this._bo(id);
    let key=id.replace(/_/g, '-');
    this._ssb(key, object, property, flags);
  }

  _bind() {
    this._bo_ssb('accel_enable', 'active');

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

  }
}

function init() {
}

function buildPrefsWidget() {
  ExtensionUtils.initTranslations(GETTEXT_DOMAIN);

  var preferencesBuilder = new PreferencesBuilder();
  var widget = preferencesBuilder.build();
  preferencesBuilder.show();

  widget.connect('realize', () => {
    let window = Utils.isGnome3x() ? widget.get_toplevel() : widget.get_root();
    preferencesBuilder.logger.debug('window=%s', window);
    //window.default_width = 700;
    //window.default_height = 900;
    //window.set_default_icon_name('view-paged-symbolic');
    //window.resize(700, 900);
  });

  return widget;
}
