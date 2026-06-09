#!/usr/bin/env node
/**
 * Minimal reference HTTP API for verifying docs (Tasks 79–81).
 * NOT production — login, tasks, probes, Prometheus /metrics.
 */
import http from 'node:http';
import {
    normalizeRoute,
    recordHttpRequest,
    renderPrometheusText,
} from './prometheus_metrics.mjs';

const HOST = process.env.REFERENCE_API_HOST || '127.0.0.1';
const PORT = Number(process.env.REFERENCE_API_PORT || 3000);
const PREFIX = '/api/v1';

const DEMO_EMAIL = 'admin@example.com';
const DEMO_PASSWORD = 'secret';
const DEMO_TOKEN = 'reference-demo-access-token';
const DEMO_USER = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: DEMO_EMAIL,
    display_name: 'Admin',
    role: 'admin',
};

const DEMO_TASKS = {
    items: [
        {
            id: '660e8400-e29b-41d4-a716-446655440002',
            title: 'Example task',
            description: 'From reference API server',
            status: 'todo',
            project_id: '770e8400-e29b-41d4-a716-446655440003',
            due_at: null,
            created_at: '2026-05-27T12:00:00.000Z',
            updated_at: '2026-05-27T12:00:00.000Z',
        },
    ],
    total_count: 1,
    limit: 25,
    offset: 0,
    sort: 'created_at',
    order: 'desc',
};

function dbConfiguredOk() {
    const v = String(process.env.REFERENCE_API_DB_OK ?? '1').trim().toLowerCase();
    return v !== '0' && v !== 'false' && v !== 'no';
}

async function pingDatabase() {
    if (!dbConfiguredOk()) {
        throw new Error('database unreachable');
    }
    return true;
}

function sendRaw(res, status, contentType, body, extraHeaders = {}) {
    const payload = typeof body === 'string' ? body : String(body);
    res.writeHead(status, {
        'Content-Type': contentType,
        'Content-Length': Buffer.byteLength(payload),
        'Cache-Control': 'no-store',
        'X-Correlation-ID': extraHeaders['X-Correlation-ID'] || 'ref-server',
        ...extraHeaders,
    });
    res.end(payload);
}

function sendJson(res, status, body, extraHeaders = {}) {
    sendRaw(res, status, 'application/json; charset=utf-8', JSON.stringify(body), extraHeaders);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            if (!raw.trim()) {
                resolve(null);
                return;
            }
            try {
                resolve(JSON.parse(raw));
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

function pathname(url) {
    return new URL(url || '/', 'http://localhost').pathname;
}

function apiSubPath(url) {
    const path = pathname(url);
    if (!path.startsWith(PREFIX)) {
        return null;
    }
    return path.slice(PREFIX.length) || '/';
}

function bearerToken(req) {
    const h = req.headers.authorization || '';
    const m = /^Bearer\s+(.+)$/i.exec(h);
    return m ? m[1].trim() : null;
}

async function handleOps(req, res, path) {
    if (req.method === 'GET' && path === '/health') {
        sendJson(res, 200, { status: 'ok' });
        return true;
    }

    if (req.method === 'GET' && path === '/readyz') {
        try {
            await pingDatabase();
            sendJson(res, 200, {
                status: 'ready',
                checks: { database: 'ok' },
            });
        } catch (_e) {
            sendJson(res, 503, {
                status: 'not_ready',
                checks: { database: 'unreachable' },
                error_code: 'SERVICE_UNAVAILABLE',
            });
        }
        return true;
    }

    if (req.method === 'GET' && path === '/metrics') {
        sendRaw(res, 200, 'text/plain; version=0.0.4; charset=utf-8', renderPrometheusText());
        return true;
    }

    return false;
}

const server = http.createServer(async (req, res) => {
    const started = process.hrtime.bigint();
    const path = pathname(req.url);
    const route = normalizeRoute(path);
    let status = 500;

    const finish = () => {
        const elapsedNs = process.hrtime.bigint() - started;
        const durationSec = Number(elapsedNs) / 1e9;
        if (route !== '/metrics') {
            recordHttpRequest(req.method || 'GET', route, status, durationSec);
        }
    };

    res.on('finish', finish);

    try {
        if (await handleOps(req, res, path)) {
            status = res.statusCode || 200;
            return;
        }

        const sub = apiSubPath(req.url);
        if (sub === null) {
            status = 404;
            sendJson(res, status, { error_code: 'NOT_FOUND', message: 'Not found' });
            return;
        }

        if (req.method === 'POST' && sub === '/auth/login') {
            const body = await readBody(req);
            if (!body || body.email !== DEMO_EMAIL || body.password !== DEMO_PASSWORD) {
                status = 401;
                sendJson(res, status, { error_code: 'UNAUTHORIZED', message: 'Invalid credentials' });
                return;
            }
            status = 200;
            sendJson(res, status, {
                access_token: DEMO_TOKEN,
                token_type: 'Bearer',
                expires_in: 900,
                user: DEMO_USER,
            });
            return;
        }

        if (req.method === 'GET' && sub === '/tasks') {
            const token = bearerToken(req);
            if (token !== DEMO_TOKEN) {
                status = 401;
                sendJson(res, status, { error_code: 'UNAUTHORIZED', message: 'Missing or invalid token' });
                return;
            }
            status = 200;
            sendJson(res, status, DEMO_TASKS);
            return;
        }

        status = 404;
        sendJson(res, status, { error_code: 'NOT_FOUND', message: 'Not found' });
    } catch (e) {
        status = 422;
        sendJson(res, status, { error_code: 'VALIDATION_ERROR', message: String(e.message || e) });
    }
});

server.listen(PORT, HOST, () => {
    process.stdout.write(
        `reference_api_server listening on http://${HOST}:${PORT} (/health, /readyz, /metrics, ${PREFIX})\n`,
    );
});
