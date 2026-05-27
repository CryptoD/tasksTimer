/**
 * Reference audit-log policy for a future HTTP admin API (Task 71).
 *
 * Canonical implementation (GJS tests): src/api/audit_log_policy.js
 *
 * @see docs/dev/audit-log-review.md
 */

export const CORRELATION_ID_HEADER = 'X-Correlation-ID';

/** @type {readonly string[]} */
export const REQUIRED_AUDIT_ACTIONS = Object.freeze([
    'admin.password.set',
    'admin.password.reset',
    'user.delete',
    'integration.create',
    'integration.update',
    'integration.delete',
]);

const _REQUIRED = new Set(REQUIRED_AUDIT_ACTIONS);

/** @param {string} action */
export function isRequiredAuditAction(action) {
    return _REQUIRED.has(String(action || '').trim());
}

/**
 * @param {Record<string, unknown>|null|undefined} record
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function validateAuditRecord(record) {
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
    return missing.length ? { ok: false, missing } : { ok: true, missing: [] };
}
