#!/usr/bin/env node
/**
 * Login then list tasks — copy-paste example from docs/api/examples.md (Task 79).
 *
 * Usage:
 *   node docs/api/examples/login_list_tasks.mjs
 *   API_BASE_URL=http://127.0.0.1:3000/api/v1 node docs/api/examples/login_list_tasks.mjs
 *
 * Requires Node 18+ (global fetch). Start the reference server first:
 *   node tooling/reference_api_server.mjs
 */
const base = (process.env.API_BASE_URL || 'http://localhost:3000/api/v1').replace(/\/+$/, '');

async function main() {
    const loginRes = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': 'example-login-list-tasks',
        },
        body: JSON.stringify({
            email: 'admin@example.com',
            password: 'secret',
        }),
    });

    if (!loginRes.ok) {
        const errBody = await loginRes.text();
        throw new Error(`login failed HTTP ${loginRes.status}: ${errBody}`);
    }

    const login = await loginRes.json();
    const token = login.access_token;
    if (!token) {
        throw new Error('login response missing access_token');
    }

    const tasksRes = await fetch(`${base}/tasks?limit=25&offset=0`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'X-Correlation-ID': 'example-login-list-tasks',
        },
    });

    if (!tasksRes.ok) {
        const errBody = await tasksRes.text();
        throw new Error(`list tasks failed HTTP ${tasksRes.status}: ${errBody}`);
    }

    const tasks = await tasksRes.json();
    process.stdout.write(`${JSON.stringify(tasks, null, 2)}\n`);
}

main().catch((e) => {
    process.stderr.write(`${e.message || e}\n`);
    process.exit(1);
});
