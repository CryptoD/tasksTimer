# ADR 0002: JWT access tokens + refresh rotation

- **Status:** Accepted  
- **Date:** 2026-05-27  

## Context

The reference OpenAPI spec defines `POST /auth/login` returning a short-lived **Bearer access token** and optional session cookie ([`openapi.yaml`](../api/openapi.yaml)). Checklists ask for JWT + refresh strategy, rotation, and secure storage on the client.

Production secrets already include `TASKTIMER_JWT_SECRET` and `TASKTIMER_SESSION_SECRET` ([`production_config.js`](../../src/config/production_config.js)).

## Decision

**Access token:** signed **JWT** (HS256 or RS256 per deployment), short TTL (**15 minutes** default, configurable).

**Refresh token:** opaque random string stored **server-side** (hashed in SQLite), delivered as **HttpOnly** cookie (`tasktimer_refresh`) or JSON body for non-browser clients.

**Rotation:** each refresh use issues a **new** refresh token and **invalidates** the previous hash (detect reuse → revoke family).

**Logout:** delete refresh row; client discards access token.

**Browser SPA:** prefer **cookie refresh + memory-only access token** (or access in memory from login response); align cookie flags with [`tooling/cors_cookie_policy.mjs`](../../tooling/cors_cookie_policy.mjs).

**Rate limits:** login/refresh endpoints use rate limiting only — no account lockout ([ADR 0002 auth abuse](../dev/adr/0002-account-lockout-rate-limit-only.md) in dev/adr).

## Consequences

- **Positive:** stateless validation for API requests; refresh reuse detection limits theft window.
- **Negative:** operators must rotate signing keys carefully; JWT denylist not used for access tokens (rely on short TTL).
- **Tests (when backend exists):** refresh rotation, expired access, reuse detection, uniform login failure body.
