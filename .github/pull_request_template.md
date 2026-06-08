## Summary

<!-- Briefly describe what this PR does and why. -->

## Type of change

<!-- Mark with an x what applies: -->

- [ ] Bug fix
- [ ] New feature / enhancement
- [ ] Documentation only
- [ ] Build / CI / tooling
- [ ] Other: <!-- describe -->

## Checklist

- [ ] I ran `make lint` and `make test` locally (or equivalent).
- [ ] If I changed HTTP handlers (`internal/`, `e2e/handlers.mjs`, …), I updated `docs/api/openapi.yaml` (see [CONTRIBUTING.md — Task 96](CONTRIBUTING.md#task-96--openapi-drift-policy-task-74)).
- [ ] **User docs updated if behavior changed** — [`docs/user/features.md`](docs/user/features.md) and/or [README.md](README.md) reflect any new, removed, or changed UI behavior (N/A for refactors with no user-visible change).
- [ ] For user-visible string changes, I updated gettext / PO files if needed (`make mo` per [BUILD.md](BUILD.md)).
- [ ] I considered standalone vs GNOME Shell extension impact where relevant.

## Related issues

<!-- Fixes #123 / Refs #456 — or "None". -->
