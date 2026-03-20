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
        this.get_style_context().add_class('timer-list-item');
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

        const settings = this._settings;
        const showLabel = settings ? Boolean(settings.show_label) : true;
        const showTime = settings ? Boolean(settings.show_time) : true;
        const showProgress = settings ? Boolean(settings.show_progress) : false;

        this._title.set_visible(showLabel);
        this._secondary.set_visible(showTime);

        const canProgress = Boolean(showProgress && (t.running || t.paused) && typeof t.duration === 'number' && t.duration > 0);
        this._progress.set_visible(canProgress);
        if (canProgress) {
            const remaining = t.remaining_hms && typeof t.remaining_hms === 'function'
                ? t.remaining_hms().toSeconds()
                : 0;
            const frac = Math.max(0, Math.min(1, 1 - (remaining / t.duration)));
            this._progress.set_fraction(frac);
            this._progress.set_text(`${Math.round(frac * 100)}%`);
            this._progress.set_show_text(true);
        }

        this._updateStateClasses();
    }

    _updateStateClasses() {
        const t = this._timer;
        const ctx = this.get_style_context();
        const stateClasses = ['timer-running', 'timer-paused', 'timer-expired'];
        stateClasses.forEach(c => {
            try { ctx.remove_class(c); } catch (_e) {}
        });
        const expired = t && t.expired;
        const running = t && t.running;
        const paused = t && t.paused;
        if (expired) {
            ctx.add_class('timer-expired');
        } else if (running) {
            ctx.add_class('timer-running');
        } else if (paused) {
            ctx.add_class('timer-paused');
        }

        const emphasisClass = 'timer-title-emphasis';
        try {
            const titleCtx = this._title.get_style_context();
            titleCtx.remove_class(emphasisClass);
            if (expired || running || paused) {
                titleCtx.add_class(emphasisClass);
            }
        } catch (_e) {}

        const secCtx = this._secondary.get_style_context();
        ['timer-secondary-running', 'timer-secondary-expired', 'timer-secondary-paused'].forEach(c => {
            try { secCtx.remove_class(c); } catch (_e) {}
        });
        try { secCtx.add_class('dim-label'); } catch (_e2) {}
        if (expired) {
            try { secCtx.remove_class('dim-label'); } catch (_e3) {}
            secCtx.add_class('timer-secondary-expired');
        } else if (running) {
            try { secCtx.remove_class('dim-label'); } catch (_e3) {}
            secCtx.add_class('timer-secondary-running');
        } else if (paused) {
            try { secCtx.remove_class('dim-label'); } catch (_e3) {}
            secCtx.add_class('timer-secondary-paused');
        }

        const progressCtx = this._progress.get_style_context();
        ['timer-progress-active', 'timer-progress-expired'].forEach(c => {
            try { progressCtx.remove_class(c); } catch (_e2) {}
        });
        const showProgress = this._settings ? Boolean(this._settings.show_progress) : false;
        const canProgress = Boolean(t && showProgress && (t.running || t.paused) && typeof t.duration === 'number' && t.duration > 0);
        if (canProgress && t) {
            if (t.expired) {
                progressCtx.add_class('timer-progress-expired');
            } else if (t.running || t.paused) {
                progressCtx.add_class('timer-progress-active');
            }
        }
    }

    _formatSecondary(timer) {
        const settings = this._settings;
        const showEnd = settings && settings.show_endtime;
        if (timer && timer.expired) {
            return 'Time\'s up!';
        }
        if (timer && timer.paused) {
            return `Paused • ${timer.remaining_hms ? timer.remaining_hms().toString(true) : ''}`;
        }
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
        this._secondary.get_style_context().add_class('timer-row-secondary');
        this._secondary.get_style_context().add_class('dim-label');

        this._progress = new Gtk.ProgressBar({
            show_text: false,
        });
        this._progress.set_visible(false);

        textBox.pack_start(this._title, false, false, 0);
        textBox.pack_start(this._secondary, false, false, 0);
        textBox.pack_start(this._progress, false, false, 0);

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
        const paused = t && t.paused;
        const alarm = t && t.alarm_timer;
        const canReorder = (this._kind === 'quick' || this._kind === 'preset') && !running && !paused;

        if (!running && !paused) {
            addAction('Start', () => t.start(), true);
        } else if (paused) {
            addAction('Resume', () => (typeof t.resume === 'function' ? t.resume() : t.start()), true);
            addAction('Reset', () => (typeof t.resetTimer === 'function' ? t.resetTimer() : null), true);
        } else {
            addAction('Pause', () => (typeof t.pause === 'function' ? t.pause() : null), true);
            addAction('Stop', () => t.stop(), true);
            addAction('Snooze 30s', () => (typeof t.snooze === 'function' ? t.snooze(30) : null), true);
            addAction('−30s', () => this._adjustRunningTimer(-30), running && !alarm);
            addAction('+30s', () => this._adjustRunningTimer(30), running && !alarm);
            addAction('Reset', () => (typeof t.resetTimer === 'function' ? t.resetTimer() : null), true);
        }

        addAction(t && t.persist_alarm ? 'Disable persist' : 'Persist alarm', () => {
            if (t && typeof t.toggle_persist_alarm === 'function') t.toggle_persist_alarm();
        }, running || paused);

        addAction('Move up', () => this._move(-1), canReorder);
        addAction('Move down', () => this._move(1), canReorder);

        addAction('Delete', () => this._deleteTimer(), !running && !paused);

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

    _move(delta) {
        const t = this._timer;
        const timers = this._timers;
        if (!t || !timers || typeof timers.moveWithin !== 'function') return;

        const filterFn = (x) => {
            if (!x) return false;
            if (x.running || x.paused) return false;
            // Keep quick and preset ordering independent.
            if (this._kind === 'quick') return Boolean(x.quick && x.enabled);
            if (this._kind === 'preset') return Boolean(!x.quick && x.enabled);
            return false;
        };

        if (timers.moveWithin(t, delta, filterFn)) {
            if (this._onChanged) this._onChanged();
        }
    }
});

