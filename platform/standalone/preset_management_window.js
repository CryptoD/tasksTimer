/*
 * PresetManagementWindow
 *
 * Standalone UI for managing preset timers: add, edit, delete, reorder.
 * Reads/writes the app's _timers collection and persists via settings.pack_preset_timers
 * (JSON-backed when using config.js provider).
 */

const { Gtk, Gdk, GLib } = imports.gi;

const TimersCoreModule = imports['taskTimer@CryptoD'].timers_core;

function _formatDuration(secs) {
    if (secs < 60) {
        return secs + ' s';
    }
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (s === 0) {
        return m + ' min';
    }
    return m + ' min ' + s + ' s';
}

/**
 * Small dialog to enter or edit preset name and duration.
 */
function _presetEditDialog(parent, title, initialName, initialDurationSecs) {
    const dialog = new Gtk.Dialog({
        title: title,
        transient_for: parent,
        modal: true,
        use_header_bar: true,
    });
    dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);
    dialog.add_button('OK', Gtk.ResponseType.OK);
    dialog.set_default_response(Gtk.ResponseType.OK);

    const content = dialog.get_content_area();
    content.set_spacing(12);
    content.set_margin_start(12);
    content.set_margin_end(12);
    content.set_margin_top(12);
    content.set_margin_bottom(12);

    const grid = new Gtk.Grid({ column_spacing: 12, row_spacing: 8 });
    const entryName = new Gtk.Entry({
        placeholder_text: 'Preset name',
        text: initialName || '',
        hexpand: true,
    });
    grid.attach(new Gtk.Label({ label: 'Name', halign: Gtk.Align.START }), 0, 0, 1, 1);
    grid.attach(entryName, 1, 0, 1, 1);

    const total = typeof initialDurationSecs === 'number' && initialDurationSecs >= 0
        ? initialDurationSecs
        : 300;
    const adjMin = new Gtk.Adjustment({
        lower: 0,
        upper: 999,
        step_increment: 1,
        value: Math.floor(total / 60),
    });
    const adjSec = new Gtk.Adjustment({
        lower: 0,
        upper: 59,
        step_increment: 1,
        value: total % 60,
    });
    const spinMin = new Gtk.SpinButton({ adjustment: adjMin, numeric: true });
    const spinSec = new Gtk.SpinButton({ adjustment: adjSec, numeric: true });
    grid.attach(new Gtk.Label({ label: 'Minutes', halign: Gtk.Align.START }), 0, 1, 1, 1);
    grid.attach(spinMin, 1, 1, 1, 1);
    grid.attach(new Gtk.Label({ label: 'Seconds', halign: Gtk.Align.START }), 0, 2, 1, 1);
    grid.attach(spinSec, 1, 2, 1, 1);

    content.pack_start(grid, true, true, 0);
    dialog.show_all();

    return new Promise((resolve) => {
        dialog.connect('response', (d, responseId) => {
            if (responseId === Gtk.ResponseType.OK) {
                const name = (entryName.get_text() || '').trim();
                const duration = spinMin.get_value_as_int() * 60 + spinSec.get_value_as_int();
                resolve({ name, duration });
            } else {
                resolve(null);
            }
            dialog.destroy();
        });
    });
}

var PresetManagementWindow = class PresetManagementWindow {
    /**
     * @param {Gtk.Application} app - Application with _timers and _services.settings.
     * @param {Gtk.Window} [transientFor] - Parent window.
     */
    constructor(app, transientFor = null) {
        this._app = app;
        this._transientFor = transientFor;
        this._window = new Gtk.Window({
            title: 'Manage preset timers',
            default_width: 420,
            default_height: 400,
            transient_for: transientFor || undefined,
        });
        try {
            this._window.get_style_context().add_class('tasktimer-preset-management');
        } catch (_e) {}

        const vbox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_start: 12,
            margin_end: 12,
            margin_top: 12,
            margin_bottom: 12,
        });

        const listLabel = new Gtk.Label({
            label: 'Preset timers',
            halign: Gtk.Align.START,
        });
        listLabel.get_style_context().add_class('dim-label');
        vbox.pack_start(listLabel, false, false, 0);

        const list = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.SINGLE,
            activate_on_single_click: false,
        });
        const scroller = new Gtk.ScrolledWindow({
            vexpand: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
        });
        scroller.add(list);
        vbox.pack_start(scroller, true, true, 0);

        const btnBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
        });
        const btnAdd = new Gtk.Button({ label: 'Add' });
        const btnEdit = new Gtk.Button({ label: 'Edit' });
        const btnDelete = new Gtk.Button({ label: 'Delete' });
        const btnUp = new Gtk.Button({ label: '↑' });
        const btnDown = new Gtk.Button({ label: '↓' });
        btnBox.pack_start(btnAdd, false, false, 0);
        btnBox.pack_start(btnEdit, false, false, 0);
        btnBox.pack_start(btnDelete, false, false, 0);
        btnBox.pack_start(new Gtk.Separator({ orientation: Gtk.Orientation.VERTICAL }), false, false, 8);
        btnBox.pack_start(btnUp, false, false, 0);
        btnBox.pack_start(btnDown, false, false, 0);
        vbox.pack_start(btnBox, false, false, 0);

        this._list = list;
        this._btnEdit = btnEdit;
        this._btnDelete = btnDelete;
        this._btnUp = btnUp;
        this._btnDown = btnDown;

        const updateButtons = () => {
            const row = list.get_selected_row();
            const timer = row && row._timer;
            const hasSelection = Boolean(timer);
            const canModify = hasSelection && !timer.running && !timer.paused;
            const presets = this._getPresets();
            const idx = row ? presets.indexOf(timer) : -1;
            this._btnEdit.set_sensitive(canModify);
            this._btnDelete.set_sensitive(canModify);
            this._btnUp.set_sensitive(hasSelection && idx > 0);
            this._btnDown.set_sensitive(hasSelection && idx >= 0 && idx < presets.length - 1);
        };

        list.connect('row-selected', () => updateButtons());

        btnAdd.connect('clicked', () => this._onAdd());
        btnEdit.connect('clicked', () => this._onEdit());
        btnDelete.connect('clicked', () => this._onDelete());
        btnUp.connect('clicked', () => this._onMove(-1));
        btnDown.connect('clicked', () => this._onMove(1));

        this._window.add(vbox);
        this._refreshList();
        updateButtons();
    }

    _getPresets() {
        const timers = this._app && this._app._timers ? this._app._timers : [];
        return timers.filter(t => !t.quick);
    }

    _refreshList() {
        const list = this._list;
        const children = list.get_children ? list.get_children() : [];
        children.forEach(c => list.remove(c));

        const presets = this._getPresets();
        for (const timer of presets) {
            const row = new Gtk.ListBoxRow();
            row._timer = timer;
            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
                margin_start: 8,
                margin_end: 8,
                margin_top: 6,
                margin_bottom: 6,
            });
            const nameText = (timer.name || 'Unnamed') +
                (timer.running ? ' (running)' : timer.paused ? ' (paused)' : '');
            const nameLabel = new Gtk.Label({
                label: nameText,
                halign: Gtk.Align.START,
                hexpand: true,
            });
            const durLabel = new Gtk.Label({
                label: _formatDuration(timer.duration),
                halign: Gtk.Align.END,
            });
            durLabel.get_style_context().add_class('dim-label');
            box.pack_start(nameLabel, true, true, 0);
            box.pack_start(durLabel, false, false, 0);
            row.add(box);
            list.add(row);
        }
        list.show_all();
    }

    _savePresets() {
        const settings = this._app._services ? this._app._services.settings : null;
        const timers = this._app._timers;
        if (settings && timers && typeof settings.pack_preset_timers === 'function') {
            try {
                settings.pack_preset_timers(timers);
            } catch (e) {
                log('taskTimer: preset management save failed: ' + (e && e.message ? e.message : e));
            }
        }
    }

    _onAdd() {
        const parent = this._window.get_transient_for() || this._window;
        _presetEditDialog(parent, 'Add preset', '', 300).then(result => {
            if (!result || !result.name || result.duration <= 0) return;
            const timers = this._app._timers;
            if (!timers) return;
            const TimerCore = TimersCoreModule.TimerCore;
            const timer = new TimerCore(timers, result.name, result.duration);
            timer.quick = false;
            const added = typeof timers.add_check_dupes === 'function' ? timers.add_check_dupes(timer) : (timers.add(timer) ? timer : undefined);
            if (added === timer) {
                this._savePresets();
                this._refreshList();
            } else if (added !== undefined) {
                this._showDuplicateBanner();
            }
        });
    }

    _showDuplicateBanner() {
        const platform = this._app && this._app._platform;
        if (platform && typeof platform._showInAppBanner === 'function') {
            platform._showInAppBanner('Duplicate preset', 'A preset with this name and duration already exists.');
        }
    }

    _onEdit() {
        const row = this._list.get_selected_row();
        if (!row || !row._timer) return;
        const timer = row._timer;
        const parent = this._window.get_transient_for() || this._window;
        _presetEditDialog(parent, 'Edit preset', timer.name, timer.duration).then(result => {
            if (!result || !result.name || result.duration <= 0) return;
            timer.name = result.name;
            timer.duration = result.duration;
            this._savePresets();
            this._refreshList();
        });
    }

    _onDelete() {
        const row = this._list.get_selected_row();
        if (!row || !row._timer) return;
        const timers = this._app._timers;
        if (timers && typeof timers.remove === 'function') {
            timers.remove(row._timer);
            this._savePresets();
            this._refreshList();
        }
    }

    _onMove(delta) {
        const row = this._list.get_selected_row();
        if (!row || !row._timer) return;
        const timers = this._app._timers;
        if (!timers || typeof timers.moveWithin !== 'function') return;
        const filter = t => !t.quick;
        if (timers.moveWithin(row._timer, delta, filter)) {
            this._savePresets();
            this._refreshList();
            const presets = this._getPresets();
            const idx = presets.indexOf(row._timer);
            if (idx >= 0) {
                const newRow = this._list.get_row_at_index(idx);
                if (newRow) this._list.select_row(newRow);
            }
        }
    }

    present() {
        if (this._window) {
            this._window.show_all();
            if (typeof this._window.present === 'function') {
                this._window.present();
            }
        }
    }

    destroy() {
        if (this._window) {
            try {
                this._window.destroy();
            } catch (_e) {}
            this._window = null;
        }
    }
};
