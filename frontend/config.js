/**
 * Frontend HTTP client configuration (reference — Task 75).
 *
 * Policy: docs/api/versioning-policy.md
 * OpenAPI servers: docs/api/openapi.yaml
 *
 * This file is for a future SPA under frontend/. It is NOT used by the shipped
 * GJS/GTK desktop app. Desktop user settings live in repo-root config.js (XDG JSON).
 *
 * Default base URL `/api/v1` matches same-origin Caddy proxy (packaging/caddy/Caddyfile).
 */

/** API path version segment — must match openapi.yaml servers URL suffix. */
export const API_VERSION = 'v1';

/**
 * Default relative base for same-origin SPA (no trailing slash).
 * Override at build time: REACT_APP_API_BASE_URL=http://localhost:3000/api/v1
 */
export const API_BASE_URL = normalizeBaseUrl(
    typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_BASE_URL
        ? process.env.REACT_APP_API_BASE_URL
        : `/api/${API_VERSION}`,
);

/**
 * @param {string} [path] - Resource path starting with / (e.g. /tasks)
 * @returns {string} Absolute or root-relative URL for fetch()
 */
export function apiUrl(path = '') {
    const p = String(path || '');
    if (!p.length) {
        return API_BASE_URL;
    }
    if (p.startsWith('http://') || p.startsWith('https://')) {
        return p;
    }
    const segment = p.startsWith('/') ? p : `/${p}`;
    return `${API_BASE_URL}${segment}`;
}

/** @param {string} raw */
function normalizeBaseUrl(raw) {
    let s = String(raw || '').trim();
    if (!s.length) {
        return `/api/${API_VERSION}`;
    }
    return s.replace(/\/+$/, '');
}

/** Documented policy constants for tests and tooling. */
export const API_VERSIONING_POLICY = {
    style: 'path-prefix',
    prefix: `/api/${API_VERSION}`,
    unversionedPublicApi: false,
    policyDoc: 'docs/api/versioning-policy.md',
    openApiSpec: 'docs/api/openapi.yaml',
};
