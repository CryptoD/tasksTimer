/**
 * Reference CORS + Set-Cookie policy for a production SPA + API hosting model.
 *
 * Not used by the GJS desktop app. Mirror values in nginx/Caddy (see deployment.md
 * Task 67) and packaging/caddy/Caddyfile (Dockerfile.caddy).
 */

/** @typedef {'Lax'|'Strict'|'None'} SameSiteValue */

/** Production SPA origin (browser address bar). */
export const DEFAULT_SPA_ORIGIN = 'https://app.example.com';

/** API origin when API is on a separate host (cross-origin + credentials). */
export const DEFAULT_API_ORIGIN = 'https://api.example.com';

/**
 * Session cookie for **same-origin** hosting (SPA and `/api` behind one site).
 * Browser sends cookie on navigations and same-site XHR/fetch to that host.
 */
export const SESSION_COOKIE_SAME_ORIGIN = {
    name: 'session',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: /** @type {SameSiteValue} */ ('Lax'),
    maxAgeSeconds: 60 * 60 * 24 * 7,
};

/**
 * Session cookie when SPA and API are **different origins** (requires CORS + credentials).
 * `SameSite=None` must be paired with `Secure` (HTTPS only).
 */
export const SESSION_COOKIE_CROSS_ORIGIN = {
    name: 'session',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: /** @type {SameSiteValue} */ ('None'),
    maxAgeSeconds: 60 * 60 * 24 * 7,
};

/**
 * @param {string} value
 * @param {typeof SESSION_COOKIE_SAME_ORIGIN} spec
 * @returns {string} Set-Cookie header value (single cookie)
 */
export function formatSetCookie(value, spec) {
    const parts = [
        `${spec.name}=${encodeURIComponent(value)}`,
        `Path=${spec.path}`,
        `Max-Age=${spec.maxAgeSeconds}`,
        'HttpOnly',
    ];
    if (spec.secure) {
        parts.push('Secure');
    }
    if (spec.sameSite) {
        parts.push(`SameSite=${spec.sameSite}`);
    }
    return parts.join('; ');
}

/**
 * CORS headers for credentialed SPA → API (cross-origin). Origin must **not** be `*`.
 *
 * @param {string} spaOrigin e.g. https://app.example.com
 * @returns {Record<string, string>}
 */
export function corsHeadersForCredentialedSpa(spaOrigin) {
    return {
        'Access-Control-Allow-Origin': spaOrigin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
    };
}

/**
 * Fetch from the SPA must use credentials when relying on cookies:
 * `fetch(url, { credentials: 'include' })`.
 * Prefer Authorization header + memory storage when avoiding third-party cookie limits.
 */
