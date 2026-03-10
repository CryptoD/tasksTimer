/*
 * timer_entry_parser.js
 *
 * Standalone-safe timer entry parsing extracted from `menuitem.js`.
 * This avoids GNOME Shell UI imports and can be used by GTK widgets.
 *
 * Supported inputs (same intent as extension):
 * - alarm timers: "alarm @3pm", "alarm @15:55", "@3:55pm"
 * - h:m:s / m:s / s: "1:02:03", "25:00", "90"
 * - "name 00:05:00" (well-formed)
 * - wildcard forms like "Tea 5:00", "5:00", "Tea 90"
 */

const AlarmTimer = imports['taskTimer@CryptoD'].alarm_timer.AlarmTimer;
const HMS = imports['taskTimer@CryptoD'].hms.HMS;

function _trim(s) {
    return (s === undefined || s === null) ? '' : String(s).trim();
}

function _parseInit(entry, quick) {
    return {
        entry: _trim(entry),
        name: '',
        hours: 0,
        minutes: 0,
        seconds: 0,
        hms: null,
        quick: Boolean(quick),
        has_time: false,
        alarm_timer: undefined,
    };
}

function re_alarm(parse) {
    const alarm_timer = AlarmTimer.matchRegex(parse.entry);
    if (alarm_timer === undefined) return false;

    parse.name = parse.entry;
    parse.alarm_timer = alarm_timer;
    parse.hms = parse.alarm_timer.hms();
    parse.hours = parse.hms.hours;
    parse.minutes = parse.hms.minutes;
    parse.seconds = parse.hms.seconds;
    parse.has_time = true;
    return true;
}

function re_hms(parse) {
    // h:m:s, m:s, s
    const re = /^((\d+):)?((\d+):)?(\d+)$/;
    const m = re.exec(parse.entry);
    if (!m) return false;

    parse.has_time = true;
    if (m[2] && m[4] && m[5]) {
        parse.hours = m[2];
        parse.minutes = m[4];
        parse.seconds = m[5];
    } else if (m[2] && m[5]) {
        parse.minutes = m[2];
        parse.seconds = m[5];
    } else if (m[5]) {
        parse.seconds = m[5];
    } else {
        parse.has_time = false;
    }
    return true;
}

function re_name_hms(parse) {
    const re = /^(.*?)\s+(\d+):(\d+):(\d+)$/;
    const m = re.exec(parse.entry);
    if (!m) return false;

    parse.name = m[1];
    parse.hours = m[2];
    parse.minutes = m[3];
    parse.seconds = m[4];
    parse.has_time = true;
    return true;
}

function re_wildcard(parse) {
    // name? HH:MM:SS | name? MM:SS | name? SS | name
    const re = /(([^\s]+\s)*?)?(\d+)?\s*:?\s*([\d]+)?\s*:?\s*(\d+)?$/;
    const m = re.exec(parse.entry + ' ');
    if (!m) return false;

    if (m[1]) parse.name = m[1];
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

function parseTimerEntry(entry, quick) {
    const parse = _parseInit(entry, quick);
    if (!parse.entry.length) return undefined;

    if (re_alarm(parse)) return parse;
    if (!re_hms(parse)) {
        if (!re_name_hms(parse)) {
            if (!re_wildcard(parse)) return undefined;
        }
    }

    parse.hms = HMS.create(parse.hours, parse.minutes, parse.seconds);
    return parse;
}

var exports = {
    parseTimerEntry,
};

