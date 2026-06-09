#!/usr/bin/env node
/**
 * Minimal reference HTTP API for verifying docs/api/examples.md (Task 79).
 * NOT production — implements POST /api/v1/auth/login and GET /api/v1/tasks only.
 *
 * Usage: node tooling/reference_api_server.mjs
 * Env:   REFERENCE_API_PORT (default 3000), REFERENCE_API_HOST (default 127.0.0.1)
 */
import http from 'node:http';

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

function sendJson(res, status, body, extraHeaders = {}) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(payload),
        'X-Correlation-ID': extraHeaders['X-Correlation-ID'] || 'ref-server',
        ...extraHeaders,
    });
    res.end(payload);
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

function routePath(url) {
    const path = new URL(url, 'http://localhost').pathname;
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

const server = http.createServer(async (req, res) => {
    const sub = routePath(req.url || '/');
    if (sub === null) {
        sendJson(res, 404, { error_code: 'NOT_FOUND', message: 'Not found' });
        return;
    }

    try {
        if (req.method === 'POST' && sub === '/auth/login') {
            const body = await readBody(req);
            if (!body || body.email !== DEMO_EMAIL || body.password !== DEMO_PASSWORD) {
                sendJson(res, 401, { error_code: 'UNAUTHORIZED', message: 'Invalid credentials' });
                return;
            }
            sendJson(res, 200, {
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
                sendJson(res, 401, { error_code: 'UNAUTHORIZED', message: 'Missing or invalid token' });
                return;
            }
            sendJson(res, 200, DEMO_TASKS);
            return;
        }

        sendJson(res, 404, { error_code: 'NOT_FOUND', message: 'Not found' });
    } catch (e) {
        sendJson(res, 422, { error_code: 'VALIDATION_ERROR', message: String(e.message || e) });
    }
});

server.listen(PORT, HOST, () => {
    process.stdout.write(`reference_api_server listening on http://${HOST}:${PORT}${PREFIX}\n`);
});
