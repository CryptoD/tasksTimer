/*
 * TimerMenuWidget
 *
 * GTK widget replacement for GNOME Shell popup menus (`taskTimer@CryptoD/menus.js`).
 *
 * Uses:
 * - Gtk.ListBox sections (Running / Quick / Preset)
 * - Per-row Gtk.Popover for actions (start/stop, +/-30s, delete, persist)
 *
 * Designed for the standalone GTK app, but can be embedded anywhere.
 */

imports.gi.versions.Gtk = '3.0';

const { GObject, Gtk, GLib, Pango, Gdk } = imports.gi;

const TimersCoreModule = imports['taskTimer@CryptoD'].timers_core;
const Parser = imports['taskTimer@CryptoD'].timer_entry_parser;
const TimerListItemModule = imports.platform.standalone.timer_list_item;

function _safeText(v, fallback = '') {
    if (v === undefined || v === null) return fallback;
    const s = String(v);
    return s.length ? s : fallback;
}

var TimerMenuWidget = GObject.registerClass(
class TimerMenuWidget extends Gtk.Box {
    _init(params = {}) {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            ...params,
        });

        this._application = params.application || null;
        this._timers = params.timers || null;
        this._settings = params.settings || (this._application && this._application._services ? this._application._services.settings : null);

        this._uiUpdateId = null;

        this._buildUi();
        this.refresh();
        this.startAutoRefresh();
    }

    setTimers(timers) {
        this._timers = timers;
        this.refresh();
    }

    setApplication(app) {
        this._application = app;
        this._settings = this._settings || (app && app._services ? app._services.settings : null);
        this.refresh();
    }

    destroy() {
        this.stopAutoRefresh();
        super.destroy();
    }

    _buildUi() {
        // Quick entry (replacement for KitchenTimerQuickItem)
        const quickFrame = new Gtk.Frame({ label: 'Quick timer' });
        const quickBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 10,
            margin_bottom: 10,
            margin_start: 10,
            margin_end: 10,
        });

        const entry = new Gtk.Entry({ placeholder_text: 'Name 00:05:00, 25:00, 90, alarm @3pm…' });
        this._quickEntry = entry;

        const btnStart = new Gtk.Button({ label: 'Start' });
        btnStart.connect('clicked', () => this._startFromEntry());

        entry.connect('activate', () => this._startFromEntry());

        quickBox.pack_start(entry, false, false, 0);
        quickBox.pack_start(btnStart, false, false, 0);
        quickFrame.add(quickBox);
        this.pack_start(quickFrame, false, false, 0);

        // Sections
        this._runningSection = this._buildSection('Running timers');
        this._quickSection = this._buildSection('Quick timers');
        this._presetSection = this._buildSection('Preset timers');

        // Start timers on activation from quick/preset sections.
        const startOnActivate = (_lb, row) => {
            if (!row || !row._timer) return;
            try {
                row._timer.start();
                this._persistTimers();
            } catch (e) {}
        };
        this._quickSection.list.connect('row-activated', startOnActivate);
        this._presetSection.list.connect('row-activated', startOnActivate);

        this.pack_start(this._runningSection.box, true, true, 0);
        this.pack_start(this._quickSection.box, true, true, 0);
        this.pack_start(this._presetSection.box, true, true, 0);

        // Bottom actions (optional convenience)
        const bottom = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
        bottom.get_style_context().add_class('toolbar');

        const btnNewTimer = new Gtk.Button({ label: 'New timer…' });
        btnNewTimer.connect('clicked', () => {
            if (this._application && this._application.activate_action) {
                this._application.activate_action('newTimer', null);
            }
        });

        const btnPrefs = new Gtk.Button({ label: 'Preferences…' });
        btnPrefs.connect('clicked', () => {
            if (this._application && this._application.activate_action) {
                this._application.activate_action('preferences', null);
            }
        });

        const btnStopAll = new Gtk.Button({ label: 'Stop all' });
        btnStopAll.connect('clicked', () => {
            const timers = this._timers;
            if (!timers) return;
            timers.sort_by_running().forEach(t => {
                try { t.stop(); } catch (e) {}
            });
            this._persistTimers();
        });

        const btnCreatePreset = new Gtk.Button({ label: 'Create preset…' });
        btnCreatePreset.connect('clicked', () => this._showCreatePresetDialog());

        bottom.pack_start(btnNewTimer, false, false, 0);
        bottom.pack_start(btnPrefs, false, false, 0);
        bottom.pack_start(btnCreatePreset, false, false, 0);
        bottom.pack_end(btnStopAll, false, false, 0);

        this.pack_end(bottom, false, false, 0);
    }

    _buildSection(title) {
        const outer = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
        });

        const label = new Gtk.Label({
            label: title,
            halign: Gtk.Align.START,
            xalign: 0,
        });
        label.get_style_context().add_class('dim-label');

        const list = new Gtk.ListBox({ selection_mode: Gtk.SelectionMode.NONE });

        const scroller = new Gtk.ScrolledWindow({
            vexpand: true,
            hexpand: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
        });
        scroller.add(list);

        outer.pack_start(label, false, false, 0);
        outer.pack_start(scroller, true, true, 0);

        return { box: outer, list };
    }

    _startFromEntry() {
        const timers = this._timers;
        if (!timers) return;

        const entry = (this._quickEntry && this._quickEntry.get_text) ? this._quickEntry.get_text().trim() : '';
        if (!entry) return;

        let parse = null;
        try {
            parse = Parser && typeof Parser.parseTimerEntry === 'function'
                ? Parser.parseTimerEntry(entry, true)
                : null;
        } catch (e) {
            parse = null;
        }

        if (parse && parse.has_time && parse.hms && typeof parse.hms.toSeconds === 'function') {
            const TimerCore = TimersCoreModule.TimerCore;
            const t = new TimerCore(timers, _safeText(parse.name, 'Timer'), parse.hms.toSeconds());
            t.quick = true;
            t.alarm_timer = parse.alarm_timer;
            if (timers.add(t)) {
                t.start();
                this._persistTimers();
            }
            this._quickEntry.set_text('');
            return;
        }

        // Fallback: allow plain seconds ("90") or mm:ss ("25:00").
        const seconds = this._parseDurationFallback(entry);
        if (seconds > 0) {
            const TimerCore = TimersCoreModule.TimerCore;
            const t = new TimerCore(timers, 'Timer', seconds);
            t.quick = true;
            if (timers.add(t)) {
                t.start();
                this._persistTimers();
            }
            this._quickEntry.set_text('');
        }
    }

    _parseDurationFallback(text) {
        const s = (text || '').trim();
        if (!s) return 0;
        if (/^\d+$/.test(s)) {
            return parseInt(s, 10);
        }
        const m = /^(\d+):(\d+)$/.exec(s);
        if (m) {
            const mm = parseInt(m[1], 10);
            const ss = parseInt(m[2], 10);
            if (Number.isFinite(mm) && Number.isFinite(ss) && ss >= 0 && ss < 60) {
                return (mm * 60) + ss;
            }
        }
        return 0;
    }

    _persistTimers() {
        const settings = this._settings;
        const timers = this._timers;
        if (!settings || !timers) return;
        if (typeof settings.pack_timers === 'function') {
            try { settings.pack_timers(timers); } catch (e) {}
        }
    }

    _showCreatePresetDialog() {
        const timers = this._timers;
        if (!timers) return;

        const dialog = new Gtk.Dialog({
            title: 'Create preset',
            modal: true,
            use_header_bar: true,
        });
        const toplevel = this.get_toplevel && this.get_toplevel();
        if (toplevel && toplevel instanceof Gtk.Window) {
            dialog.set_transient_for(toplevel);
        }

        dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);
        const btnCreate = dialog.add_button('Create', Gtk.ResponseType.OK);
        btnCreate.set_sensitive(false);

        const area = dialog.get_content_area();
        const grid = new Gtk.Grid({
            column_spacing: 10,
            row_spacing: 10,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });

        const nameLabel = new Gtk.Label({ label: '_Name', use_underline: true, halign: Gtk.Align.START });
        const nameEntry = new Gtk.Entry({ hexpand: true });
        nameEntry.set_text('');
        nameLabel.set_mnemonic_widget(nameEntry);

        const durationLabel = new Gtk.Label({ label: 'Duration', halign: Gtk.Align.START });
        durationLabel.get_style_context().add_class('dim-label');

        const makeScaleRow = (mnemonic, max) => {
            const label = new Gtk.Label({ label: mnemonic, use_underline: true, halign: Gtk.Align.START });
            const adj = new Gtk.Adjustment({ lower: 0, upper: max, step_increment: 1, page_increment: 5 });
            const scale = Gtk.Scale.new(Gtk.Orientation.HORIZONTAL, adj);
            scale.set_digits(0);
            scale.set_draw_value(false);
            scale.set_hexpand(true);
            scale.set_can_focus(true);
            scale.set_increments(1, 5);

            const value = new Gtk.Label({ label: '0', halign: Gtk.Align.END, xalign: 1 });
            value.set_width_chars(3);

            label.set_mnemonic_widget(scale);
            return { label, scale, value };
        };

        const h = makeScaleRow('_Hours', 99);
        const m = makeScaleRow('_Minutes', 59);
        const s = makeScaleRow('_Seconds', 59);

        const preview = new Gtk.Label({ label: '00:00:00', halign: Gtk.Align.START });
        preview.get_style_context().add_class('dim-label');

        function hmsText(hours, minutes, seconds) {
            const hh = String(hours).padStart(2, '0');
            const mm = String(minutes).padStart(2, '0');
            const ss = String(seconds).padStart(2, '0');
            return `${hh}:${mm}:${ss}`;
        }

        const update = () => {
            const hh = h.scale.get_value_as_int();
            const mm = m.scale.get_value_as_int();
            const ss = s.scale.get_value_as_int();
            h.value.set_label(String(hh));
            m.value.set_label(String(mm));
            s.value.set_label(String(ss));

            const total = (hh * 3600) + (mm * 60) + ss;
            preview.set_label(hmsText(hh, mm, ss));
            btnCreate.set_sensitive(total > 0);
        };

        h.scale.connect('value-changed', update);
        m.scale.connect('value-changed', update);
        s.scale.connect('value-changed', update);

        // Layout
        grid.attach(nameLabel, 0, 0, 1, 1);
        grid.attach(nameEntry, 1, 0, 2, 1);
        grid.attach(durationLabel, 0, 1, 3, 1);

        grid.attach(h.label, 0, 2, 1, 1);
        grid.attach(h.scale, 1, 2, 1, 1);
        grid.attach(h.value, 2, 2, 1, 1);

        grid.attach(m.label, 0, 3, 1, 1);
        grid.attach(m.scale, 1, 3, 1, 1);
        grid.attach(m.value, 2, 3, 1, 1);

        grid.attach(s.label, 0, 4, 1, 1);
        grid.attach(s.scale, 1, 4, 1, 1);
        grid.attach(s.value, 2, 4, 1, 1);

        grid.attach(new Gtk.Label({ label: 'Preview', halign: Gtk.Align.START }), 0, 5, 1, 1);
        grid.attach(preview, 1, 5, 2, 1);

        area.add(grid);
        dialog.show_all();
        update();

        dialog.connect('response', (_d, responseId) => {
            if (responseId === Gtk.ResponseType.OK) {
                const hh = h.scale.get_value_as_int();
                const mm = m.scale.get_value_as_int();
                const ss = s.scale.get_value_as_int();
                const total = (hh * 3600) + (mm * 60) + ss;
                if (total > 0) {
                    const TimerCore = TimersCoreModule.TimerCore;
                    const nm = (nameEntry.get_text() || '').trim();
                    const t = new TimerCore(timers, nm, total);
                    t.quick = false;
                    t.enabled = true;
                    if (timers.add(t)) {
                        this._persistTimers();
                        this.refresh();
                    }
                }
            }
            dialog.destroy();
        });
    }

    _formatSecondary(timer) {
        const settings = this._settings;
        const showEnd = settings && settings.show_endtime;
        if (timer && timer.running) {
            if (showEnd && typeof timer.end_time === 'function') {
                return `Ends at ${timer.end_time()}`;
            }
            return timer.remaining_hms ? timer.remaining_hms().toString(true) : '';
        }
        return timer.remaining_hms ? timer.remaining_hms().toString(true) : '';
    }

    _adjustRunningTimer(timer, deltaSecs) {
        if (!timer || !timer.running || timer.alarm_timer) return;
        const now = Date.now();
        const deltaMs = deltaSecs * 1000;
        if (!timer._end || timer._end <= 0) {
            timer._end = now + (timer.duration_ms ? timer.duration_ms() : 0);
        }
        timer._end += deltaMs;
        if (timer._end < now + 1000) {
            timer._end = now + 1000;
        }
    }

    _clearList(listBox) {
        const children = listBox.get_children ? listBox.get_children() : [];
        children.forEach(c => listBox.remove(c));
    }

    _makeRow(timer, kind) {
        return new TimerListItemModule.TimerListItem({
            timer,
            timers: this._timers,
            settings: this._settings,
            kind,
            onChanged: () => this._persistTimers(),
        });
    }

    _buildPopoverForTimer(timer, kind) {
        const pop = new Gtk.Popover();
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            margin_top: 8,
            margin_bottom: 8,
            margin_start: 10,
            margin_end: 10,
        });

        const addAction = (label, fn, enabled = true) => {
            const b = new Gtk.ModelButton({ text: label });
            b.set_sensitive(Boolean(enabled));
            b.connect('clicked', () => {
                try { fn(); } catch (e) {}
                pop.popdown();
                this.refresh();
            });
            box.pack_start(b, false, false, 0);
        };

        const isRunning = timer && timer.running;
        const isAlarm = timer && timer.alarm_timer;

        if (!isRunning) {
            addAction('Start', () => {
                timer.start();
                this._persistTimers();
            }, true);
        } else {
            addAction('Stop', () => {
                timer.stop();
                this._persistTimers();
            }, true);
            addAction('−30s', () => {
                this._adjustRunningTimer(timer, -30);
            }, isRunning && !isAlarm);
            addAction('+30s', () => {
                this._adjustRunningTimer(timer, 30);
            }, isRunning && !isAlarm);
            addAction(timer.persist_alarm ? 'Disable persist' : 'Persist alarm', () => {
                if (typeof timer.toggle_persist_alarm === 'function') {
                    timer.toggle_persist_alarm();
                }
            }, true);
        }

        addAction('Delete', () => {
            if (this._timers && typeof this._timers.remove === 'function') {
                this._timers.remove(timer);
                this._persistTimers();
            }
        }, !isRunning);

        pop.add(box);
        box.show_all();
        return pop;
    }

    refresh() {
        const timers = this._timers;
        if (!timers) {
            // Clear lists but keep UI.
            this._clearList(this._runningSection.list);
            this._clearList(this._quickSection.list);
            this._clearList(this._presetSection.list);
            return;
        }

        const running = timers.sort_by_running ? timers.sort_by_running() : [];
        const allNotRunning = timers.sorted ? timers.sorted({ running: false }) : [];
        const quick = allNotRunning.filter(t => t.quick && t.enabled);
        const presets = allNotRunning.filter(t => !t.quick && t.enabled);

        this._clearList(this._runningSection.list);
        this._clearList(this._quickSection.list);
        this._clearList(this._presetSection.list);

        running.forEach(t => this._runningSection.list.add(this._makeRow(t, 'running')));
        quick.forEach(t => this._quickSection.list.add(this._makeRow(t, 'quick')));
        presets.forEach(t => this._presetSection.list.add(this._makeRow(t, 'preset')));

        // (Re)enable row activation for quick/preset lists.
        this._quickSection.list.set_activate_on_single_click(true);
        this._presetSection.list.set_activate_on_single_click(true);

        this.show_all();
    }

    startAutoRefresh() {
        if (this._uiUpdateId) return;
        this._uiUpdateId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            try {
                // Rebuild to keep membership accurate if timers start/stop.
                this.refresh();
            } catch (e) {
                // ignore refresh failures
            }
            return true;
        });
    }

    stopAutoRefresh() {
        if (this._uiUpdateId) {
            GLib.Source.remove(this._uiUpdateId);
            this._uiUpdateId = null;
        }
    }
});

