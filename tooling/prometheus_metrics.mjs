/**
 * Minimal in-process Prometheus metrics (reference API — Task 81).
 * Production backends should use prometheus/client_golang or OTel SDK + exporter.
 */

const START_TIME = Date.now() / 1000;

/** @type {Map<string, number>} */
const requestCounts = new Map();

/** @type {{ count: number, sum: number }} */
const durationStats = { count: 0, sum: 0 };

function key(method, route, status) {
    return `${method}|${route}|${status}`;
}

/**
 * @param {string} method
 * @param {string} route - normalized route template
 * @param {number} status
 * @param {number} durationSec
 */
export function recordHttpRequest(method, route, status, durationSec) {
    const k = key(method, route, String(status));
    requestCounts.set(k, (requestCounts.get(k) || 0) + 1);
    durationStats.count += 1;
    durationStats.sum += durationSec;
}

/** Normalize URL path to low-cardinality route label. */
export function normalizeRoute(pathname) {
    if (pathname === '/health' || pathname === '/readyz' || pathname === '/metrics') {
        return pathname;
    }
    if (pathname.startsWith('/api/v1/auth/login')) {
        return '/api/v1/auth/login';
    }
    if (pathname.startsWith('/api/v1/tasks')) {
        return '/api/v1/tasks';
    }
    if (pathname.startsWith('/api/v1/')) {
        return '/api/v1/*';
    }
    return 'other';
}

function escapeLabel(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function renderPrometheusText() {
    const lines = [
        '# HELP http_requests_total Total HTTP requests handled by the API process',
        '# TYPE http_requests_total counter',
    ];

    for (const [k, count] of requestCounts.entries()) {
        const [method, route, status] = k.split('|');
        lines.push(
            `http_requests_total{method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${escapeLabel(status)}"} ${count}`,
        );
    }

    if (requestCounts.size === 0) {
        lines.push('http_requests_total{method="GET",route="/health",status="200"} 0');
    }

    lines.push(
        '# HELP http_request_duration_seconds_sum Sum of HTTP request durations in seconds',
        '# TYPE http_request_duration_seconds_sum counter',
        `http_request_duration_seconds_sum ${durationStats.sum}`,
        '# HELP http_request_duration_seconds_count Count of HTTP requests with duration observed',
        '# TYPE http_request_duration_seconds_count counter',
        `http_request_duration_seconds_count ${durationStats.count}`,
        '# HELP process_start_time_seconds Start time of the process since unix epoch',
        '# TYPE process_start_time_seconds gauge',
        `process_start_time_seconds ${START_TIME}`,
    );

    return `${lines.join('\n')}\n`;
}
