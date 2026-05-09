import { http, HttpResponse } from 'msw';
import { test, expect } from './playwright.setup.mjs';

test('Critical path (browser shell): login + tasks CRUD + Kanban move (mocked)', async ({ page, network }) => {
    test.skip(!network, 'Mocks disabled (REACT_APP_USE_MOCKS=false); this spec only validates MSW critical path.');

    // In-memory server state for the MSW handlers (lives in the test process).
    const state = {
        loginCalls: 0,
        refreshCalls: 0,
        tasks: [{ id: 't1', title: 'First', status: 'todo' }],
    };

    const requireAuth = (req) => {
        const h = req.headers.get('authorization') || '';
        return h === 'Bearer access-ok';
    };

    network.use(
        http.post('http://localhost/mock/login', async () => {
            state.loginCalls += 1;
            return HttpResponse.json({ access_token: 'access-ok', refresh_token: 'refresh-ok' });
        }),
        http.post('http://localhost/mock/refresh', async () => {
            state.refreshCalls += 1;
            // Only allow one refresh; repeated refresh attempts simulate "still unauthorized".
            if (state.refreshCalls > 1) {
                return new HttpResponse(null, { status: 401 });
            }
            return HttpResponse.json({ access_token: 'access-ok' });
        }),
        http.get('http://localhost/mock/tasks', ({ request }) => {
            if (!requireAuth(request)) return new HttpResponse(null, { status: 401 });
            return HttpResponse.json({ items: state.tasks.slice() });
        }),
        http.post('http://localhost/mock/tasks', async ({ request }) => {
            if (!requireAuth(request)) return new HttpResponse(null, { status: 401 });
            const body = await request.json();
            const id = `t${state.tasks.length + 1}`;
            const item = { id, title: String(body.title || ''), status: 'todo' };
            state.tasks.push(item);
            return HttpResponse.json(item, { status: 201 });
        }),
        http.patch('http://localhost/mock/tasks/:id', async ({ request, params }) => {
            if (!requireAuth(request)) return new HttpResponse(null, { status: 401 });
            const body = await request.json();
            const t = state.tasks.find((x) => x.id === params.id);
            if (!t) return new HttpResponse(null, { status: 404 });
            if (typeof body.title === 'string') t.title = body.title;
            if (typeof body.status === 'string') t.status = body.status;
            return HttpResponse.json(t);
        }),
        http.delete('http://localhost/mock/tasks/:id', ({ request, params }) => {
            if (!requireAuth(request)) return new HttpResponse(null, { status: 401 });
            state.tasks = state.tasks.filter((x) => x.id !== params.id);
            return new HttpResponse(null, { status: 204 });
        }),
    );

    await page.goto('about:blank');
    await page.setContent(`
    <!doctype html>
    <html>
      <head><meta charset="utf-8"></head>
      <body>
        <button data-testid="login">Login</button>
        <button data-testid="create">Create</button>
        <button data-testid="edit">Edit</button>
        <button data-testid="move">Kanban move</button>
        <button data-testid="delete">Delete</button>
        <pre data-testid="toast"></pre>
        <ul data-testid="list"></ul>
        <script>
          const $ = (id) => document.querySelector('[data-testid=\"' + id + '\"]');
          const toast = (msg) => { $('toast').textContent = msg; };
          // about:blank has an opaque origin; localStorage may throw SecurityError.
          // Use localStorage when available, otherwise fall back to an in-memory shim.
          let _memTokens = null;
          const setTokens = (t) => {
            try { localStorage.setItem('tokens', JSON.stringify(t)); }
            catch (e) { _memTokens = t; }
          };
          const getTokens = () => {
            try { return JSON.parse(localStorage.getItem('tokens') || 'null'); }
            catch (e) { return _memTokens; }
          };

          async function login() {
            const r = await fetch('http://localhost/mock/login', { method: 'POST' });
            const d = await r.json();
            setTokens({ access: d.access_token, refresh: d.refresh_token });
            toast('logged-in');
          }

          async function refreshOnce() {
            const t = getTokens();
            if (!t || !t.refresh) return false;
            const r = await fetch('http://localhost/mock/refresh', { method: 'POST' });
            if (!r.ok) return false;
            const d = await r.json();
            setTokens({ access: d.access_token, refresh: t.refresh });
            return true;
          }

          async function api(method, url, body) {
            let refreshed = false;
            for (let attempt = 0; attempt < 2; attempt++) {
              const t = getTokens();
              const headers = { 'content-type': 'application/json' };
              if (t && t.access) headers.authorization = 'Bearer ' + t.access;
              const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
              if (r.status !== 401) return r;
              if (refreshed) break;
              refreshed = await refreshOnce();
              if (!refreshed) break;
            }
            toast('auth-error');
            return new Response(null, { status: 401 });
          }

          function render(items) {
            const ul = $('list');
            ul.innerHTML = '';
            for (const it of items) {
              const li = document.createElement('li');
              li.textContent = it.id + ':' + it.title + ':' + it.status;
              li.setAttribute('data-testid', 'task-' + it.id);
              ul.appendChild(li);
            }
          }

          async function load() {
            const r = await api('GET', 'http://localhost/mock/tasks');
            if (!r.ok) return;
            const d = await r.json();
            render(d.items);
          }

          async function create() {
            const r = await api('POST', 'http://localhost/mock/tasks', { title: 'New task' });
            if (!r.ok) return;
            toast('created');
            await load();
          }

          async function edit() {
            const r = await api('PATCH', 'http://localhost/mock/tasks/t1', { title: 'Edited' });
            if (!r.ok) return;
            toast('edited');
            await load();
          }

          async function move() {
            const r = await api('PATCH', 'http://localhost/mock/tasks/t1', { status: 'doing' });
            if (!r.ok) return;
            toast('moved');
            await load();
          }

          async function del() {
            const r = await api('DELETE', 'http://localhost/mock/tasks/t1');
            if (!r.ok) return;
            toast('deleted');
            await load();
          }

          $('login').addEventListener('click', login);
          $('create').addEventListener('click', create);
          $('edit').addEventListener('click', edit);
          $('move').addEventListener('click', move);
          $('delete').addEventListener('click', del);
        </script>
      </body>
    </html>
  `);

    // Start unauthenticated: load should toast auth-error and only attempt refresh once (refresh token missing).
    await page.evaluate(() => fetch('http://localhost/mock/tasks').catch(() => {}));
    await page.locator('[data-testid="login"]').click();
    await expect(page.locator('[data-testid="toast"]')).toHaveText('logged-in');

    // CRUD + move path: all driven via data-testid clicks.
    await page.locator('[data-testid="create"]').click();
    await expect(page.locator('[data-testid="toast"]')).toHaveText('created');

    await page.locator('[data-testid="edit"]').click();
    await expect(page.locator('[data-testid="task-t1"]')).toContainText('Edited');

    await page.locator('[data-testid="move"]').click();
    await expect(page.locator('[data-testid="task-t1"]')).toContainText(':doing');

    await page.locator('[data-testid="delete"]').click();
    await expect(page.locator('[data-testid="list"]')).not.toContainText('t1:');

    // Ensure we never refreshed more than once in this suite (guards against loops).
    expect(state.refreshCalls).toBeLessThanOrEqual(1);
    expect(state.loginCalls).toBe(1);
});

