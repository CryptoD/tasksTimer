/**
 * Reference auth abuse controls for a future HTTP login API (Task 69 / ADR 0002).
 *
 * taskTimer does not implement login or lockout today. When adding POST /login,
 * use rate limits only — do not set per-account lockout flags.
 *
 * @see docs/dev/adr/0002-account-lockout-rate-limit-only.md
 */

/** Deliberate product policy: no account lockout after N failed passwords. */
export const ACCOUNT_LOCKOUT_ENABLED = false;

/**
 * Example rate limits for POST /login (tune per deployment).
 * @type {{ perIp: { windowSeconds: number, maxAttempts: number }, perUsername: { windowSeconds: number, maxAttempts: number } }}
 */
export const LOGIN_RATE_LIMITS = {
    perIp: { windowSeconds: 15 * 60, maxAttempts: 30 },
    perUsername: { windowSeconds: 15 * 60, maxAttempts: 10 },
};

/** HTTP status / error_code when a bucket is exceeded (matches api_error_messages.js). */
export const LOGIN_RATE_LIMIT_RESPONSE = {
    httpStatus: 429,
    errorCode: 'RATE_LIMITED',
};
