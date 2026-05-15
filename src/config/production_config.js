/**
 * Production environment validation (fail-fast at startup).
 *
 * When TASKTIMER_ENV or TASKMASTER_ENV is "production", required auth/integration
 * secrets must be set to non-placeholder values before the app continues.
 *
 * @module src/config/production_config
 */

const { GLib } = imports.gi;

/** Env keys that select deployment mode (TASKTIMER_ENV preferred in docs). */
var ENV_MODE_KEYS = ['TASKTIMER_ENV', 'TASKMASTER_ENV'];

/**
 * Required when mode is production (HTTP/session integrations; N/A for local GTK-only use).
 * @type {string[]}
 */
var REQUIRED_PRODUCTION_SECRETS = [
    'TASKTIMER_SESSION_SECRET',
    'TASKTIMER_JWT_SECRET',
    'TASKTIMER_CSRF_SECRET',
    'TASKTIMER_INTEGRATION_SECRET',
];

var MIN_SECRET_LENGTH = 16;

var PLACEHOLDER_PREFIXES = [
    'changeme',
    'dummy',
    'example',
    'placeholder',
    'your-',
    'replace-me',
];

/**
 * @param {function(string): (string|null)} getenv
 * @returns {string}
 */
function getDeploymentEnv(getenv) {
    const get = getenv || GLib.getenv;
    for (let i = 0; i < ENV_MODE_KEYS.length; i += 1) {
        const raw = get(ENV_MODE_KEYS[i]);
        const v = String(raw || '').trim().toLowerCase();
        if (v.length > 0) {
            return v;
        }
    }
    return '';
}

/**
 * @param {function(string): (string|null)} [getenv]
 * @returns {boolean}
 */
function isProductionDeployment(getenv) {
    return getDeploymentEnv(getenv) === 'production';
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isUsableSecret(value) {
    const v = String(value || '').trim();
    if (v.length < MIN_SECRET_LENGTH) {
        return false;
    }
    const lower = v.toLowerCase();
    for (let i = 0; i < PLACEHOLDER_PREFIXES.length; i += 1) {
        if (lower.indexOf(PLACEHOLDER_PREFIXES[i]) === 0) {
            return false;
        }
    }
    return true;
}

/**
 * @param {function(string): (string|null)} [getenv]
 * @returns {{ ok: boolean, missing: string[] }}
 */
function validateProductionSecrets(getenv) {
    const get = getenv || GLib.getenv;
    const missing = [];
    if (!isProductionDeployment(get)) {
        return { ok: true, missing };
    }
    for (let i = 0; i < REQUIRED_PRODUCTION_SECRETS.length; i += 1) {
        const name = REQUIRED_PRODUCTION_SECRETS[i];
        if (!isUsableSecret(get(name))) {
            missing.push(name);
        }
    }
    return { ok: missing.length === 0, missing };
}

/**
 * @param {function(string): (string|null)} [getenv]
 * @param {{ exitFn?: function(number): void, logFn?: function(string): void }} [options]
 * @returns {boolean} true if startup may continue
 */
function assertProductionConfigOrExit(getenv, options) {
    const result = validateProductionSecrets(getenv);
    if (result.ok) {
        return true;
    }
    const logFn = (options && options.logFn) || (msg => printerr(String(msg)));
    const exitFn = (options && options.exitFn) || (code => imports.system.exit(code));
    const modeKeys = ENV_MODE_KEYS.join(' or ');
    logFn(
        `taskTimer: ${modeKeys}=production requires non-empty secrets (min ${MIN_SECRET_LENGTH} chars, no placeholder prefixes): `
        + result.missing.join(', '),
    );
    exitFn(1);
    return false;
}

var exports = {
    ENV_MODE_KEYS,
    REQUIRED_PRODUCTION_SECRETS,
    MIN_SECRET_LENGTH,
    getDeploymentEnv,
    isProductionDeployment,
    isUsableSecret,
    validateProductionSecrets,
    assertProductionConfigOrExit,
};
