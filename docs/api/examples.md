# API examples (Task 79)

Copy-paste **`curl`** and **Node** examples for **`POST /auth/login`** → **`GET /tasks`**.

Base URL follows [versioning-policy.md](versioning-policy.md): **`/api/v1`**.

## Reference server (local verification)

The shipped GTK app has **no HTTP API**. To verify these examples locally, start the **reference server** (implements login + list tasks only):

```bash
node tooling/reference_api_server.mjs
# → http://127.0.0.1:3000/api/v1
```

Automated check (starts server, runs curl + Node script):

```bash
bin/verify-api-examples.sh
```

## Environment

```bash
export API_BASE_URL="${API_BASE_URL:-http://localhost:3000/api/v1}"
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `API_BASE_URL` | `http://localhost:3000/api/v1` | Versioned API root (no trailing slash) |

Demo credentials (reference server + OpenAPI examples):

- **Email:** `admin@example.com`
- **Password:** `secret`

## 1. Login (`curl`)

```bash
curl -sS -X POST "${API_BASE_URL}/auth/login" \
  -H 'Content-Type: application/json' \
  -H 'X-Correlation-ID: demo-curl-1' \
  -d '{"email":"admin@example.com","password":"secret"}'
```

Example response:

```json
{
  "access_token": "reference-demo-access-token",
  "token_type": "Bearer",
  "expires_in": 900,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "admin@example.com",
    "display_name": "Admin",
    "role": "admin"
  }
}
```

Save the token:

```bash
TOKEN="$(curl -sS -X POST "${API_BASE_URL}/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"secret"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).access_token))")"
```

## 2. List tasks (`curl`)

```bash
curl -sS "${API_BASE_URL}/tasks?limit=25&offset=0" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'X-Correlation-ID: demo-curl-2'
```

Example response:

```json
{
  "items": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440002",
      "title": "Example task",
      "status": "todo",
      "project_id": "770e8400-e29b-41d4-a716-446655440003",
      "created_at": "2026-05-27T12:00:00.000Z",
      "updated_at": "2026-05-27T12:00:00.000Z"
    }
  ],
  "total_count": 1,
  "limit": 25,
  "offset": 0
}
```

## 3. Login → list tasks (Node)

Script: [`examples/login_list_tasks.mjs`](examples/login_list_tasks.mjs)

```bash
node docs/api/examples/login_list_tasks.mjs
# or
API_BASE_URL=http://127.0.0.1:3000/api/v1 node docs/api/examples/login_list_tasks.mjs
```

Uses global **`fetch`** (Node 18+). Prints the paginated task list JSON to stdout.

## Errors

Failed login returns **401** with envelope per [errors.md](errors.md):

```json
{ "error_code": "UNAUTHORIZED", "message": "Invalid credentials" }
```

Map user-facing text in clients via [`src/api/api_error_messages.js`](../../src/api/api_error_messages.js).

## Related

- [openapi.yaml](openapi.yaml) — full route catalog
- [pagination-contract.md](pagination-contract.md) — `limit` / `offset` / `total_count`
