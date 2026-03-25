/*
 * Minimal GTK3 accessibility helpers (Atk): names/descriptions for screen readers
 * and keyboard mnemonics where labels pair with controls.
 */

imports.gi.versions.Gtk = '3.0';

/**
 * @param {Gtk.Widget} widget
 * @param {string} name - short accessible name (replaces unlabeled "button", "image", etc.)
 */
function setName(widget, name) {
    if (!widget || name === undefined || name === null) {
        return;
    }
    const s = String(name).trim();
    if (!s.length) {
        return;
    }
    try {
        const a = widget.get_accessible();
        if (a && typeof a.set_name === 'function') {
            a.set_name(s);
        }
    } catch (_e) {
        // Older ATK / sandboxed runs
    }
}

/**
 * @param {Gtk.Widget} widget
 * @param {string} description - extra context for AT (not shown visually)
 */
function setDescription(widget, description) {
    if (!widget || description === undefined || description === null) {
        return;
    }
    const s = String(description).trim();
    if (!s.length) {
        return;
    }
    try {
        const a = widget.get_accessible();
        if (a && typeof a.set_description === 'function') {
            a.set_description(s);
        }
    } catch (_e) {}
}

/**
 * Link a Gtk.Label (with use_underline and _ in label) to a focusable widget (Alt+letter).
 * @param {Gtk.Label} label
 * @param {Gtk.Widget} widget
 */
function setLabelFor(label, widget) {
    if (!label || !widget) {
        return;
    }
    try {
        label.set_mnemonic_widget(widget);
    } catch (_e) {}
}

this.setName = setName;
this.setDescription = setDescription;
this.setLabelFor = setLabelFor;
