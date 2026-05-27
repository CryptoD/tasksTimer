/*
 * Reference audit-log contract for a future HTTP admin API (Task 71).
 *
 * taskTimer does not persist audit records today. When adding admin password,
 * user delete, or integration CRUD handlers, emit immutable audit rows that
 * include correlation_id (from X-Correlation-ID or generated per request).
 *
 * @see docs/dev/audit-log-review.md
 */

/** HTTP header carrying the correlation id (also stored on audit rows). */
var CORRELATION_ID_HEADER = 'X-Correlation-ID';

/**
 * Sensitive actions that MUST produce an audit record (spot-check Task 71).
 * @type {string[]}
 */
var REQUIRED_AUDIT_ACTIONS = [
    'admin.password.set',
    'admin.password.reset',
    'user.delete',
    'integration.create',
    'integration.update',
    'integration.delete',
];

Object.freeze(REQUIRED_AUDIT_ACTIONS);

var _REQUIRED_ACTION_SET = new Set(REQUIRED_AUDIT_ACTIONS);

/** @param {string} action */
function isRequiredAuditAction(action) {
    return _REQUIRED_ACTION_SET.has(String(action || '').trim());
}

/**
 * Minimal shape check for an audit row before persistence.
 * Returns { ok: true } or { ok: false, missing: string[] }.
 *
 * @param {Record<string, unknown>|null|undefined} record
 */
function validateAuditRecord(record) {
    const missing = [];
    if (!record || typeof record !== 'object') {
        return { ok: false, missing: ['record'] };
    }
    if (!String(record.action || '').trim()) {
        missing.push('action');
    } else if (!isRequiredAuditAction(record.action)) {
        missing.push('action:not_required');
    }
    if (!String(record.correlation_id || '').trim()) {
        missing.push('correlation_id');
    }
    if (!String(record.actor_id || '').trim()) {
        missing.push('actor_id');
    }
    if (!String(record.occurred_at || '').trim()) {
        missing.push('occurred_at');
    }
    if (missing.length) {
        return { ok: false, missing };
    }
    return { ok: true, missing: [] };
}

var exports = {
    CORRELATION_ID_HEADER,
    REQUIRED_AUDIT_ACTIONS,
    isRequiredAuditAction,
    validateAuditRecord,
};