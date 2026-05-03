/*
 * Standard API error → user-facing gettext msgid resolver.
 *
 * Contract: docs/api/errors.md
 * Callers MUST use formatApiErrorForUser(...) for toast/inline surfaces so that
 * server `details` / `message` are never shown unless dev diagnostics are on.
 */

const { GLib } = imports.gi;

/** Normalize server error_code tokens to UPPER_SNAKE_CASE. */
function normalizeErrorCode(raw) {
    if (raw === null || typeof raw === 'undefined') {
        return null;
    }
    let s = String(raw).trim();
    if (!s.length) {
        return null;
    }
    return s.replace(/-/g, '_').replace(/[^A-Za-z0-9_]/g, '_').replace(/__+/g, '_').toUpperCase();
}

const _MSG_NETWORK_TROUBLE = "Can't reach the service. Check your connection and try again.";
const _MSG_UNEXPECTED = 'Something went wrong. Try again.';

/** English gettext msgids; must stay in sync with docs/api/errors.md and PO files. */
const _BY_CODE = {
    UNAUTHORIZED: 'Sign in again; your session is no longer valid.',
    FORBIDDEN: "You don't have permission to do that.",
    NOT_FOUND: 'That item could not be found.',
    CONFLICT: 'That action conflicts with existing data.',
    VALIDATION_ERROR: 'Some inputs are invalid. Check the fields and try again.',
    RATE_LIMITED: 'Too many requests. Wait a moment and try again.',
    SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Try again later.',
    REQUEST_TIMEOUT: 'The request timed out. Try again later.',
    NETWORK_ERROR: _MSG_NETWORK_TROUBLE,
};

const _RANGE_MSG = [
    [[401], _BY_CODE.UNAUTHORIZED],
    [[403], _BY_CODE.FORBIDDEN],
    [[404], _BY_CODE.NOT_FOUND],
    [[409], _BY_CODE.CONFLICT],
    [[422], _BY_CODE.VALIDATION_ERROR],
    [[429], _BY_CODE.RATE_LIMITED],
    [[408], _BY_CODE.REQUEST_TIMEOUT],
    [[503, 502, 504], _BY_CODE.SERVICE_UNAVAILABLE],
];

function msgIdForHttpStatus(httpStatus) {
    if (typeof httpStatus !== 'number' || !(httpStatus > 0)) {
        return _MSG_NETWORK_TROUBLE;
    }
    for (let i = 0; i < _RANGE_MSG.length; i++) {
        const codes = _RANGE_MSG[i][0];
        const msg = _RANGE_MSG[i][1];
        if (codes.indexOf(httpStatus) >= 0) {
            return msg;
        }
    }
    if (httpStatus >= 500) {
        return _BY_CODE.SERVICE_UNAVAILABLE;
    }
    if (httpStatus >= 400) {
        return _MSG_UNEXPECTED;
    }
    return _MSG_UNEXPECTED;
}

/**
 * Canonical English gettext msgid for an API failure.
 *
 * @param {number|null|undefined} httpStatus - HTTP status (0/absent ⇒ network-style).
 * @param {Record<string, unknown>|null} [body] - Parsed JSON error body if any.
 * @returns {string} gettext msgid (English source string).
 */
function gettextMsgIdForApiError(httpStatus, body = null) {
    let codeKey = null;
    if (body && typeof body === 'object') {
        try {
            codeKey = normalizeErrorCode(body.error_code);
        } catch (_e) {
            codeKey = null;
        }
    }
    if (codeKey && Object.prototype.hasOwnProperty.call(_BY_CODE, codeKey)) {
        return _BY_CODE[codeKey];
    }
    return msgIdForHttpStatus(typeof httpStatus === 'number' ? httpStatus : 0);
}

/**
 * @returns {boolean}
 */
function isApiErrorDevDiagnosticsEnabled(getter) {
    const get = getter || GLib.getenv;
    try {
        return String(get('TASKTIMER_API_DEV_ERRORS') || '') === '1';
    } catch (_e) {
        return false;
    }
}

function _maybeSerialize(details) {
    if (details === null || typeof details === 'undefined') {
        return null;
    }
    if (typeof details === 'string') {
        const t = details.trim();
        return t.length > 0 ? t : null;
    }
    try {
        return JSON.stringify(details);
    } catch (_e) {
        return String(details);
    }
}

function _devSuffix(httpStatus, body) {
    const parts = [];
    const st = typeof httpStatus === 'number' && httpStatus > 0 ? httpStatus : 0;
    parts.push(st > 0 ? `HTTP ${st}` : 'no HTTP status');
    if (body && typeof body === 'object') {
        const code = normalizeErrorCode(body.error_code);
        if (code) {
            parts.push(`error_code=${code}`);
        }
        const d = _maybeSerialize(body.details);
        if (d !== null && d !== undefined && String(d).length > 0) {
            parts.push(`details=${d}`);
        } else if (typeof body.message === 'string' && body.message.trim().length > 0) {
            parts.push(`message=${body.message.trim()}`);
        }
    }
    return `\n(${parts.join(' • ')})`;
}

/**
 * User-visible string for toasts / inline errors. Applies gettext to the canonical msgid;
 * optionally appends raw server fields ONLY when dev diagnostics are enabled.
 *
 * @param {number|null|undefined} httpStatus
 * @param {Record<string, unknown>|null} [body]
 * @param {{ gettext?: function(string): string, devMode?: boolean|null, getenv?: function(string): string|null }} [options]
 * @returns {string}
 */
function formatApiErrorForUser(httpStatus, body = null, options = null) {
    const opts = options || {};
    const gettextFn = typeof opts.gettext === 'function' ? opts.gettext : (s => s);
    const msgid = gettextMsgIdForApiError(httpStatus, body);
    let text = gettextFn(msgid);
    const dev =
        opts.devMode === true ||
        (opts.devMode !== false && isApiErrorDevDiagnosticsEnabled(opts.getenv));
    if (dev) {
        text += _devSuffix(httpStatus, body);
    }
    return text;
}

var exports = {
    normalizeErrorCode,
    gettextMsgIdForApiError,
    formatApiErrorForUser,
    isApiErrorDevDiagnosticsEnabled,
};
