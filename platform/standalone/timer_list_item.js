/*
 * TimerListItem
 *
 * GTK ListBoxRow equivalent of `KitchenTimerMenuItem` + `KitchenTimerControlButton`
 * from `taskTimer@CryptoD/menuitem.js`.
 *
 * - Shows timer name + secondary label (remaining/end time)
 * - Provides an actions popover (start/stop/snooze/delete and adjustments)
 * - Designed to be used in `TimerMenuWidget` and other GTK lists
 */

imports.gi.versions.Gtk = '3.0';

const { GObject, Gtk, Pango } = imports.gi;

function _safeText(v, fallback = '') {
    if (v === undefined || v === null) return fallback;
    const s = String(v);
    return s.length ? s : fallback;
}

var TimerListItem = GObject.registerClass(
class TimerListItem extends Gtk.ListBoxRow {
    _init(params = {}) {
        super._init();

        this._timer = params.timer || null;
        this._timers = params.timers || null;
        this._settings = params.settings || null;
        this._kind = params.kind || 'timer'; // running|quick|preset
        this._onChanged = typeof params.onChanged === 'function' ? params.onChanged : null;

        this._buildUi();
        this.refresh();
    }

    get timer() {
        return this._timer;
    }

    refresh() {
        const t = this._timer;
        if (!t) return;

        this._title.set_label(_safeText(t.name, 'Timer'));
        this._secondary.set_label(this._formatSecondary(t));
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

    _buildUi() {
        const outer = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 10,
            margin_start: 10,
            margin_end: 10,
            margin_top: 6,
            margin_bottom: 6,
        });

        const textBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 2,
            hexpand: true,
        });

        this._title = new Gtk.Label({
            label: '',
            halign: Gtk.Align.START,
            xalign: 0,
            wrap: true,
            wrap_mode: Pango.WrapMode.WORD_CHAR,
        });

        this._secondary = new Gtk.Label({
            label: '',
            halign: Gtk.Align.START,
            xalign: 0,
        });
        this._secondary.get_style_context().add_class('dim-label');

        textBox.pack_start(this._title, false, false, 0);
        textBox.pack_start(this._secondary, false, false, 0);

        const btnMenu = new Gtk.MenuButton({ label: '⋯' });
        btnMenu.set_valign(Gtk.Align.CENTER);
        btnMenu.set_popover(this._buildPopover());

        outer.pack_start(textBox, true, true, 0);
        outer.pack_start(btnMenu, false, false, 0);
        this.add(outer);
    }

    _buildPopover() {
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
                if (this._onChanged) this._onChanged();
            });
            box.pack_start(b, false, false, 0);
        };

        const t = this._timer;
        const running = t && t.running;
        const alarm = t && t.alarm_timer;

        if (!running) {
            addAction('Start', () => t.start(), true);
        } else {
            addAction('Stop', () => t.stop(), true);
            addAction('Snooze 30s', () => (typeof t.snooze === 'function' ? t.snooze(30) : null), true);
            addAction('−30s', () => this._adjustRunningTimer(-30), running && !alarm);
            addAction('+30s', () => this._adjustRunningTimer(30), running && !alarm);
        }

        addAction(t && t.persist_alarm ? 'Disable persist' : 'Persist alarm', () => {
            if (t && typeof t.toggle_persist_alarm === 'function') t.toggle_persist_alarm();
        }, running);

        addAction('Delete', () => this._deleteTimer(), !running);

        pop.add(box);
        box.show_all();
        return pop;
    }

    _adjustRunningTimer(deltaSecs) {
        const t = this._timer;
        if (!t || !t.running || t.alarm_timer) return;

        const now = Date.now();
        const deltaMs = deltaSecs * 1000;
        if (!t._end || t._end <= 0) {
            t._end = now + (t.duration_ms ? t.duration_ms() : 0);
        }
        t._end += deltaMs;
        if (t._end < now + 1000) {
            t._end = now + 1000;
        }
    }

    _deleteTimer() {
        const t = this._timer;
        if (!t) return;
        if (this._timers && typeof this._timers.remove === 'function') {
            this._timers.remove(t);
        }
    }
});

