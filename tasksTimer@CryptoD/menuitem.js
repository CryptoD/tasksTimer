const { Clutter, GObject, St, Gio } = imports.gi;

const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Timer = Me.imports.timers.Timer;
const AlarmTimer = Me.imports.alarm_timer.AlarmTimer;
const Utils = Me.imports.utils;
const HMS = Me.imports.hms.HMS;
const Logger = Me.imports.logger.Logger;

this.KTTypes = {
  'stop': 'media-playback-stop-symbolic',
  'delete' : 'edit-delete-symbolic',
  'reduce' : 'list-remove-symbolic',
  'extend' : 'list-add-symbolic',
  'backward' : 'media-seek-backward-symbolic',
  'forward' : 'media-seek-forward-symbolic',
  'persist' : 'alarm-symbolic',
  'progress' : null // dynamically assigned
};


var logger = new Logger('kt menuitem');

var tasksTimerCreatePreset = GObject.registerClass(
  class tasksTimerCreatePreset extends PopupMenu.PopupSubMenuMenuItem {
    _init(menu, timers) {
      super._init(_("Create Preset"));
      this._timers = timers;
      logger.settings = timers.settings;
  
      menu.addMenuItem(this);
  
      this._entry = new St.Entry({
        x_expand: true,
        x_align: St.Align.START,
        y_align: Clutter.ActorAlign.CENTER
      });
      this._entry.set_hint_text(_("Name 00:00:00"));
      this._entry.get_clutter_text().set_activatable(true);
      this._entry.set_primary_icon(tasksTimerCreatePreset.create_icon(this._timers));
  
      var name_item = new PopupMenu.PopupMenuItem("", { reactive: false });
      var bin = new St.Bin({ x_expand: true, x_align: St.Align.START });
      bin.child = this._entry;
      name_item.add(bin);
      this.menu.addMenuItem(name_item);
  
      this._name = "";
  
      this._hslider = new tasksTimerTimeSliderItem(this, "h", 0, 99);
      this._mslider = new tasksTimerTimeSliderItem(this, "m", 0, 59);
      this._sslider = new tasksTimerTimeSliderItem(this, "s", 0, 59);
  
      this._go = new PopupMenu.PopupImageMenuItem(_("Create"), this._timers.progress_gicon(0));
      this._go.label.set_y_align(Clutter.ActorAlign.CENTER);
      //this._go.label.set_y_expand(true);
  
      bin = new St.Bin({ x_expand: true, x_align: St.Align.START });
      this._time = new St.Label({ text: "00:00:00", style_class: 'popup-menu-item', x_expand: true, x_align: St.Align.START });
      bin.child = this._time;
      this._go.add(bin);
  
      this.menu.addMenuItem(this._go);
  
      this._go.connect('activate', (go) => {
        this.activate_go();
      });
  
      this._entry.get_clutter_text().connect('activate', (e) => {
        this.activate_go();
      });
  
      this._entry.get_clutter_text().connect('key-focus-out', (e) => {
        var entry = e.get_text();
        logger.debug('key out hours: ' + entry);
        var result = tasksTimerMenuItem.parseTimerEntry(entry, false);
        if (result) {
          this._name = result.name;
          if (result.has_time) {
            this._hslider.value = result.hms.hours;
            this._mslider.value = result.hms.minutes;
            this._sslider.value = result.hms.seconds;
  
            this.update_time();
          }
        }
      });
  
    }
  

    activate_go() {
      var ctext = this._entry.get_clutter_text();
      var entry = ctext.get_text();
      logger.debug('activate: ' + entry);
      var result = tasksTimerMenuItem.parseTimerEntry(entry, false);
      if (result) {
        ctext.set_text("%s %s".format(result.name, result.hms.toString()));
        var timer = tasksTimerMenuItem.addTimerStart(result, this._timers);
        if (timer === undefined) {
        } else {
          this.menu.close();
        }
      }
    }

  static create_icon(timers) {
    var icon = new St.Icon({
            gicon: timers.progress_gicon(0),
            style_class: 'system-status-icon',
        });
    icon.set_icon_size(16);
    return icon;
  }

  update_time() {
    var text="%s %02d:%02d:%02d".format(this._name, this._hslider.value, this._mslider.value, this._sslider.value);
    this._time.set_text(text);
    this._entry.get_clutter_text().set_text(text);
  }

});

var tasksTimerTimeSliderItem = GObject.registerClass(
class tasksTimerTimeSliderItem extends PopupMenu.PopupMenuItem {
  _init(parent, suffix, min, max) {
    super._init("", { reactive: true });
    parent.menu.addMenuItem(this);

    this._parent = parent;
    this._suffix = suffix;
    this._value = min;
    this._min = min;
    this._max = max;
    this._label = new St.Label({ text: this.format(min), style_class: 'tasksTimer-panel-label' });

    var bin = new St.Bin({ x_expand: false, x_align: St.Align.START });
    bin.child = this._label;
    this.add(bin);

    this._slider = new Slider.Slider(min, {x_expand: true, y_expand:true});
    this._slider._value = min;
    this._slider.connect('notify::value', (slider) => {
      this._value = Math.ceil(slider._value * this._max);
      slider.value = (this._value-this._min)/this._max;
      this._label.set_text(this.format(this._value));
      this._parent.update_time();
    });

    this.add(this._slider);
  }

  format(val) {
    return "%02d%s".format(val, this._suffix);
  }

  get value() {
    return this._value;
  }

  set value(val) {
    this._slider.value = (val-this._min)/this._max;
  }
});

var tasksTvar, TasksTimerMenuItem = GObject.registerClass(
  class TasksTimerMenuItem extends PopupMenu.PopupBaseMenuItem {  
  _init(timer, menu) {
      super._init("", { reactive: true });

      this._timer = timer;

      logger.settings = timer.timers.settings;

      var box = new St.BoxLayout({
        x_expand: true,
        x_align: St.Align.START,
        pack_start: true,
        style_class: 'tasksTimer-menu-box'
      });
      this.add(box);

      var name = new St.Label({
        style_class: 'tasksTimer-menu-name',
        x_expand: true,
        x_align: St.Align.START
      });
      name.set_text(timer.name);

      timer.label = new St.Label({
        style_class: 'tasksTimer-menu-label',
        x_expand: false,
        x_align: St.Align.END
      });

      var key = timer.degree_progress(15 /* 15 degree increments */);
      var timer_icon = new St.Icon({
        x_align: St.Align.END,
        x_expand: false,
        gicon: timer.timers.progress_gicon(key),
        style_class: 'tasksTimer-menu-icon'
      });
      timer_icon.set_icon_size(20);

      if (timer.running) {
        if (timer.alarm_timer) {
          box.add_child(new tasksTimerControlButton(timer, 'forward'));
          box.add_child(new tasksTimerControlButton(timer, 'stop'));
          box.add_child(new tasksTimerControlButton(timer, 'backward'));
        } else {
          box.add_child(new tasksTimerControlButton(timer, 'extend'));
          box.add_child(new tasksTimerControlButton(timer, 'stop'));
          box.add_child(new tasksTimerControlButton(timer, 'reduce'));
        }
      } else {
        box.add_child(new tasksTimerControlButton(timer, 'delete'));
      }

      box.add_child(timer.label);
      if (timer.running) {
        if (timer.persist_alarm) {
          box.add_child(new tasksTimerControlButton(timer, 'persist'));
        } else {
          box.add_child(new tasksTimerControlButton(timer, 'progress'));
        }
      } else {
        box.add_child(timer_icon);
      }
      box.add_child(name);

      this.connect('activate', (tmi) => {
        if (!tmi._timer.running) {
          tmi._timer.start();
        }
      });

      timer.label_progress();

      menu.addMenuItem(this);
  }

  get timer() {
    return this._timer;
  }

  static addTimerStart(result, timers) {
    if (timers === undefined) {
      logger.error('timers not specified');
      return undefined;
    }
    if (result === undefined) {
      return undefined;
    }
    if (!result.has_time) {
      return undefined;
    }
    var timer = new Timer(result.name, result.hms.toSeconds());
    timer.quick = result.quick;
    timer.alarm_timer = result.alarm_timer;
    var tt = timers.add_check_dupes(timer);
    if (tt !== undefined) {
      logger.debug("starting timer: %s", timer.name);
      tt.start();
    }
    return tt;
  }

  static re_alarm(parse) {
    var alarm_timer = AlarmTimer.matchRegex(parse.entry);
    if (alarm_timer === undefined) {
      return false;
    }

    parse.name=parse.entry;
    parse.alarm_timer = alarm_timer;
    parse.hms = parse.alarm_timer.hms();
    parse.hours = parse.hms.hours;
    parse.minutes = parse.hms.minutes;
    parse.seconds = parse.hms.seconds;
    parse.has_time = true;

    logger.debug("matched in re_alarm");

    return true;

  }

  static re_hms(parse) {
    var re = /^((\d+):)?((\d+):)?(\d+)$/;
    var m = re.exec(parse.entry);
    if (m) {
      logger.debug("matched in re_hms");
      parse.has_time = true;
      if (m[2] && m[4] && m[5]) {
        parse.hours=m[2];
        parse.minutes=m[4];
        parse.seconds=m[5];
      } else if (m[2] && m[5]) {
        parse.minutes=m[2];
        parse.seconds=m[5];
      } else if (m[5]) {
        parse.seconds=m[5];
      } else {
        parse.has_time = false;
      }
      return true;
    }
    return false;
  }

  static re_name_hms(parse) {
    var re = /^(.*?)\s+(\d+):(\d+):(\d+)$/;
    var m = re.exec(parse.entry);
    if (m) {
      logger.debug("matched in re_name_hms");

      parse.name = m[1];
      parse.hours = m[2];
      parse.minutes = m[3];
      parse.seconds = m[4];
      parse.has_time = true;
      return true;
    }
    return false;
  }

  activate_go() {
    var ctext = this._entry.get_clutter_text();
    var entry = ctext.get_text();
    logger.debug('activate: '+entry);
    var result = tasksTimerMenuItem.parseTimerEntry(entry, false);
    if (result) {
      ctext.set_text("%s %s".format(result.name, result.hms.toString()));
      var timer = tasksTimerMenuItem.addTimerStart(result, this._timers);
      if (timer === undefined) {
      } else {
        this.menu.close();

        this._hslider.value = result.hms.hours;
        this._mslider.value = result.hms.minutes;
        this._sslider.value = result.hms.seconds;

        this.update_time();
      }
    }
  }


  static create_icon(timers) {
    var icon = new St.Icon({
            gicon: timers.progress_gicon(0),
            style_class: 'system-status-icon',
        });
    icon.set_icon_size(16);
    return icon;
  }

  update_time() {
    var text="%s %02d:%02d:%02d".format(this._name, this._hslider.value, this._mslider.value, this._sslider.value);
    this._time.set_text(text);
    this._entry.get_clutter_text().set_text(text);
  }

});

var tasksTimerTimeSliderItem = GObject.registerClass(
class tasksTimerTimeSliderItem extends PopupMenu.PopupMenuItem {
  _init(parent, suffix, min, max) {
    super._init("", { reactive: true });
    parent.menu.addMenuItem(this);

    this._parent = parent;
    this._suffix = suffix;
    this._value = min;
    this._min = min;
    this._max = max;
    this._label = new St.Label({ text: this.format(min), style_class: 'tasksTimer-panel-label' });

    var bin = new St.Bin({ x_expand: false, x_align: St.Align.START });
    bin.child = this._label;
    this.add(bin);

    this._slider = new Slider.Slider(min, {x_expand: true, y_expand:true});
    this._slider._value = min;
    this._slider.connect('notify::value', (slider) => {
      this._value = Math.ceil(slider._value * this._max);
      // value goes from min to max, slider.value is 0 to 1
      // (this._value-min)/max;
      slider.value = (this._value-this._min)/this._max;
      this._label.set_text(this.format(this._value));
      this._parent.update_time();
    });

    this.add(this._slider);
  }

  format(val) {
    return "%02d%s".format(val, this._suffix);
  }

  get value() {
    return this._value;
  }

  set value(val) {
    this._slider.value = (val-this._min)/this._max;
  }
});

var tasksTimerMenuItem = GObject.registerClass(
  class tasksTimerMenuItem extends PopupMenu.PopupMenuItem {
    _init(timer, menu) {
        super._init("", { reactive: true });
  
        this._timer = timer;
  
        logger.settings = timer.timers.settings;
  
        var box = new St.BoxLayout({
          x_expand: true,
          x_align: St.Align.START,
          pack_start: true,
          style_class: 'tasksTimer-menu-box'
        });
        this.add(box);
  
        var name = new St.Label({
          style_class: 'tasksTimer-menu-name',
          x_expand: true,
          x_align: St.Align.START
        });
        name.set_text(timer.name);
  
        timer.label = new St.Label({
          style_class: 'tasksTimer-menu-label',
          x_expand: false,
          x_align: St.Align.END
        });
  
        var key = timer.degree_progress(15 /* 15 degree increments */);
        var timer_icon = new St.Icon({
          x_align: St.Align.END,
          x_expand: false,
          gicon: timer.timers.progress_gicon(key),
          style_class: 'tasksTimer-menu-icon'
        });
        timer_icon.set_icon_size(20);
  
        if (timer.running) {
          if (timer.alarm_timer) {
            box.add_child(new tasksTimerControlButton(timer, 'forward'));
            box.add_child(new tasksTimerControlButton(timer, 'stop'));
            box.add_child(new tasksTimerControlButton(timer, 'backward'));
          } else {
            box.add_child(new tasksTimerControlButton(timer, 'extend'));
            box.add_child(new tasksTimerControlButton(timer, 'stop'));
            box.add_child(new tasksTimerControlButton(timer, 'reduce'));
          }
        } else {
          box.add_child(new tasksTimerControlButton(timer, 'delete'));
        }
  
        box.add_child(timer.label);
        if (timer.running) {
          if (timer.persist_alarm) {
            box.add_child(new tasksTimerControlButton(timer, 'persist'));
          } else {
            box.add_child(new tasksTimerControlButton(timer, 'progress'));
          }
        } else {
          box.add_child(timer_icon);
        }
        box.add_child(name);
  
        this.connect('activate', (tmi) => {
          if (!tmi._timer.running) {
            tmi._timer.start();
          }
        });
  
        timer.label_progress();
  
        menu.addMenuItem(this);
    }
  
    get timer() {
      return this._timer;
    }
  
    static addTimerStart(result, timers) {
      if (timers === undefined) {
        logger.error('timers not specified');
        return undefined;
      }
      if (result === undefined) {
        return undefined;
      }M:SS
    static re_wildcard(parse) {
      var re = /(([^\s]+\s)*?)?(\d+)?\s*:?\s*([\d]+)?\s*:?\s*(\d+)?$/;
      var m=re.exec(parse.entry+' ');
      if (m) {
        if (m[1]) {
          parse.name = m[1];
        }
      parse.has_time = true;
      if (m[1] && m[3] && m[4] && m[5]) {
        parse.hours = m[3];
        parse.minutes = m[4];
        parse.seconds = m[5];
      } else if (m[1] && m[3] && m[4]) {
        parse.minutes = m[3];
        parse.seconds = m[4];
      } else if (m[1] && m[3]) {
        parse.seconds = m[3];
      } else {
        parse.has_time = false;
      }

      return true;
    }
    return false;
  }

  static parseTimerEntry(entry, quick) {
    if (entry.length === 0) {
      return undefined;
    }

    var parse = {
      entry: entry.trim(),
      name: "",
      hours: 0,
      minutes: 0,
      seconds: 0,
      hms: null,
      quick: quick,
      has_time: false,
      alarm_timer: undefined
    }

    if (tasksTimerMenuItem.re_alarm(parse)) {
      return parse;
    }
    if (!tasksTimerMenuItem.re_hms(parse)) {
      if (!tasksTimerMenuItem.re_name_hms(parse)) {
        if (!tasksTimerMenuItem.re_wildcard(parse)) {
          return undefined;
        }
      }
    }

    parse.hms = HMS.create(parse.hours, parse.minutes, parse.seconds);
    return parse;
  }
});


var tasksTimerQuickItem = GObject.registerClass(
class tasksTimerQuickItem extends PopupMenu.PopupMenuItem {
  _init(menu, timers) {
    super._init("", { reactive: false, can_focus: false });

    this._menu = menu;
    this._timers = timers;

    menu.addMenuItem(this);

    logger.settings = timers.settings;

    var layout = new St.BoxLayout({
      style_class: 'tasksTimer-quick-menu',
      x_expand: true
    });

    this.add(layout);

    this._entry = new St.Entry( {
      x_expand: true,
      can_focus: true,
      x_align: St.Align.START,
      y_align: Clutter.ActorAlign.CENTER
    });
    this._entry.set_hint_text(_("Name 00:00:00"));
    this._entry.get_clutter_text().set_activatable(true);
    this._entry.get_clutter_text().set_editable(true);


    this._add_icon = new St.Icon( {
      x_expand: false,
      y_align: Clutter.ActorAlign.CENTER,
      icon_name: 'list-add-symbolic',
      icon_size: 20,
    });

    this._add = new St.Button( {
      x_expand: false,
      y_expand: false,
      can_focus: true,
      x_align: St.Align.END,
      y_align: Clutter.ActorAlign.CENTER,
      style_class: 'tasksTimer-prefs-button',
      child: this._add_icon
    });

    this._add.connect('clicked', (btn, clicked_button) => {
      logger.debug("mouse button pressed %d", clicked_button);
      var entry = this._entry.get_clutter_text().get_text().trim();

      var result = tasksTimerMenuItem.parseTimerEntry(entry, true);
      if (!result) {
        logger.error("Invalid timer entry='%s'", entry);
        return;
      }

      var timer = tasksTimerMenuItem.addTimerStart(result, this._timers);
      if (timer) {
        this._menu.close();
        global.stage.set_key_focus(null);
      }
    });

    this._add.connect('enter_event', (btn, event) => {
      btn.get_child().icon_size = 28;
    })

    this._add.connect('leave_event', (btn, event) => {
      btn.get_child().icon_size = 20;
    })

    this._prefs_icon = new St.Icon( {
      x_expand: false,
      y_align: Clutter.ActorAlign.CENTER,
      icon_name: 'preferences-system-symbolic',
      icon_size: 20,
    });

    this._prefs = new St.Button( {
      x_expand: false,
      y_expand: false,
      can_focus: true,
      x_align: St.Align.END,
      y_align: Clutter.ActorAlign.CENTER,
      style_class: 'tasksTimer-prefs-button',
      child: this._prefs_icon
    });

    this._prefs.connect('clicked', (btn, clicked_button) => {
      logger.debug("mouse button pressed %d", clicked_button);
      ExtensionUtils.openPrefs();
      this._menu.close();
      global.stage.set_key_focus(null);
    });

    this._prefs.connect('enter_event', (btn, event) => {
      btn.get_child().icon_size = 28;
    })

    this._prefs.connect('leave_event', (btn, event) => {
      btn.get_child().icon_size = 20;
    })

    layout.add_child(this._entry);
    layout.add_child(this._add);
    layout.add_child(this._prefs);

    this._entry.get_clutter_text().connect('activate', (e) => {
      var entry = e.get_text();
      logger.debug('activate: '+entry);
      var result = tasksTimerMenuItem.parseTimerEntry(entry, true);
      if (result) {
        this._entry.get_clutter_text().set_text("%s %s".format(result.name, result.hms.toString()));
        var timer = tasksTimerMenuItem.addTimerStart(result, this._timers);
        if (timer === undefined) {
        } else {
          this._menu.close();
        }
      }
    });

    this._entry.get_clutter_text().connect('key-focus-out', (e) => {
      var entry = e.get_text();
      if (entry.length > 0) {
        logger.debug('key out hours: '+entry);
        var result = tasksTimerMenuItem.parseTimerEntry(entry, true);
        if (result) {
          this._entry.get_clutter_text().set_text("%s %s".format(result.name, result.hms.toString()));
        }
      }
    });
  }

  grab_key_focus() {
    logger.debug("grab key focus")
    this._entry.grab_key_focus();
  }
});

var tasksTimerControlButton = GObject.registerClass(
class tasksTimerControlButton extends St.Button {
    _init(timer, type) {
        super._init();

        this._type = type;
        this._timer = timer;

        let icon=null;
        let gicon=null;
        let style='tasksTimer-menu-delete-icon';
        if (type === 'progress') {
          if (!timer.persist_alarm) {
            gicon = timer.timers.progress_gicon(timer.degree_progress(15 /* 15 degree increments */));
            style='tasksTimer-menu-icon';
          }
        } else if (type === 'persist') {
          style='tasksTimer-menu-icon';
        }
        if (gicon) {
          icon = new St.Icon({
            x_align: St.Align.END,
            x_expand: false,
            gicon: gicon,
            style_class: style
          });
        } else {
          icon = new St.Icon({
            x_align: St.Align.END,
            x_expand: false,
            icon_name: KTTypes[type],
            style_class: style
          });
        }
        icon.set_icon_size(20);

        this.child = icon;

        this.connect_type();
    }

    connect_type() {
        switch(this.type) {
        case "stop":
          this.connect('clicked', (cb) => {
            this.timer.stop();
            this.rebuild();
          });
          break;
        case "delete":
          this.connect('clicked', (cb) => {
            this.timer.delete();
            this.rebuild();
          });
          break;
        case "extend":
          this.connect('clicked', (cb) => {
            this.timer.extend();
            this.rebuild();
          });
          break;
        case "reduce":
          this.connect('clicked', (cb) => {
            this.timer.reduce();
            this.rebuild();
          });
          break;
        case "forward":
          this.connect('clicked', (cb) => {
            this.timer.forward();
            this.rebuild();
          });
          break;
        case "backward":
          this.connect('clicked', (cb) => {
            this.timer.backward();
            this.rebuild();
          });
          break;
        case 'persist':
        case 'progress':
          this.connect('clicked', (cb) => {
            this.timer.toggle_persist_alarm();
            this.rebuild();
          });
          break;
        }
    }

    get timer() {
      return this._timer;
    }

    get type() {
      return this._type;
    }

    get icon() {
      return this.child;
    }

    rebuild() {
      this.timer.timers.indicator.rebuild_menu();
    }
});

