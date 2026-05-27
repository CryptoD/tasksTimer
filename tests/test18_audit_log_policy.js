// Audit log policy — required actions + correlation_id on sensitive events (Task 71).
// Run: gjs tests/test18_audit_log_policy.js

imports.searchPath.unshift('.');

const Audit = imports.src.api.audit_log_policy;

function assert(cond, msg) {
    if (!cond) {
        throw new Error(msg || 'Assertion failed');
    }
}

assert(Audit.CORRELATION_ID_HEADER === 'X-Correlation-ID');

const actions = Audit.REQUIRED_AUDIT_ACTIONS;
assert(actions.indexOf('admin.password.set') >= 0, 'admin password set must be audited');
assert(actions.indexOf('admin.password.reset') >= 0, 'admin password reset must be audited');
assert(actions.indexOf('user.delete') >= 0, 'user delete must be audited');
assert(actions.indexOf('integration.create') >= 0, 'integration create must be audited');
assert(actions.indexOf('integration.update') >= 0, 'integration update must be audited');
assert(actions.indexOf('integration.delete') >= 0, 'integration delete must be audited');

assert(Audit.isRequiredAuditAction('user.delete'));
assert(!Audit.isRequiredAuditAction('timer.delete'));

const valid = Audit.validateAuditRecord({
    action: 'integration.update',
    correlation_id: 'req-550e8400-e29b-41d4-a716-446655440000',
    actor_id: 'admin-1',
    occurred_at: '2026-05-27T12:00:00.000Z',
});
assert(valid.ok, 'integration.update with correlation_id should validate');

// Spot-check gap: integration changes without correlation_id must be rejected.
const missingCorrelation = Audit.validateAuditRecord({
    action: 'integration.update',
    actor_id: 'admin-1',
    occurred_at: '2026-05-27T12:00:00.000Z',
});
assert(!missingCorrelation.ok, 'integration.update without correlation_id must fail');
assert(missingCorrelation.missing.indexOf('correlation_id') >= 0);

const missingAction = Audit.validateAuditRecord({
    action: 'integration.update',
    correlation_id: 'req-abc',
    actor_id: 'admin-1',
});
assert(!missingAction.ok);
assert(missingAction.missing.indexOf('occurred_at') >= 0);

print('test18_audit_log_policy: OK');
