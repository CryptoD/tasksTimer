/*
 * Quick entry parsing helpers (GTK-agnostic).
 *
 * This file intentionally avoids GTK imports so it can be unit-tested
 * under headless gjs runs.
 */

/**
 * Parse a fallback duration from quick-entry text.
 *
 * Accepted formats:
 * - "90" => 90 seconds
 * - "mm:ss" => minutes + seconds (seconds must be 0..59)
 *
 * @param {string} text
 * @returns {number} seconds (0 when not parseable)
 */
function parseDurationFallback(text) {
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

var QuickEntryFallback = {
    parseDurationFallback,
};

