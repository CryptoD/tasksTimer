/**
 * Reference security headers + CSP for a future static web UI or API gateway.
 *
 * taskTimer ships as GJS/GTK; this module is not wired into `main.js`. Use it when
 * serving `dist/` (or `frontend/dist/`) behind Node, or mirror the same values in
 * nginx/Caddy (see docs/dev/deployment.md — Task 66).
 */

/** @typedef {{ apiOrigin?: string, staticOrigin?: string, allowInlineStyles?: boolean }} SecurityHeaderOptions */

const DEFAULT_API_ORIGIN = 'http://localhost/mock';
const DEFAULT_STATIC_ORIGIN = "'self'";

/**
 * Build Content-Security-Policy tuned for a same-origin SPA bundle plus API calls.
 *
 * Asset URLs: scripts/styles load from the app origin (`'self'` / `staticOrigin`).
 * API: `connect-src` includes `apiOrigin` (Playwright MSW uses `http://localhost/mock` today).
 *
 * @param {SecurityHeaderOptions} [options]
 * @returns {string}
 */
export function buildContentSecurityPolicy(options = {}) {
    const apiOrigin = options.apiOrigin || DEFAULT_API_ORIGIN;
    const staticOrigin = options.staticOrigin || DEFAULT_STATIC_ORIGIN;
    const styleSrc = options.allowInlineStyles === false
        ? staticOrigin
        : `${staticOrigin} 'unsafe-inline'`;

    const directives = [
        `default-src ${staticOrigin}`,
        `base-uri ${staticOrigin}`,
        `form-action ${staticOrigin}`,
        `frame-ancestors 'none'`,
        `object-src 'none'`,
        `script-src ${staticOrigin}`,
        `style-src ${styleSrc}`,
        `img-src ${staticOrigin} data:`,
        `font-src ${staticOrigin}`,
        `connect-src ${staticOrigin} ${apiOrigin}`,
        'upgrade-insecure-requests',
    ];

    return directives.join('; ');
}

/**
 * Header map applied by {@link securityHeadersMiddleware} and documented nginx snippet.
 * @param {SecurityHeaderOptions} [options]
 * @returns {Record<string, string>}
 */
export function securityHeaders(options = {}) {
    return {
        'Content-Security-Policy': buildContentSecurityPolicy(options),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'same-origin',
    };
}

/**
 * Express-style `(req, res, next)` middleware, or call without `next` to set headers only.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {(() => void)|undefined} next
 * @param {SecurityHeaderOptions} [options]
 */
export function securityHeadersMiddleware(req, res, next, options = {}) {
    const headers = securityHeaders(options);
    for (const [name, value] of Object.entries(headers)) {
        res.setHeader(name, value);
    }
    if (typeof next === 'function') {
        next();
    }
}

/**
 * Apply headers to a ServerResponse (non-middleware call sites).
 * @param {import('http').ServerResponse} res
 * @param {SecurityHeaderOptions} [options]
 */
export function applySecurityHeaders(res, options = {}) {
    securityHeadersMiddleware(null, res, undefined, options);
}
