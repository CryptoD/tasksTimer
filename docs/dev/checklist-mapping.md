# Former long checklist vs this repository

Some teams keep a **numbered quality checklist** (e.g. items **18–19**, **21–25**, **26–47**, …) that was written for a **different stack** (often a **Go HTTP API**, **React `frontend/`**, shared **tasks/comments** models, etc.).

## What does *not* transfer literally

Many of those rows reference files or patterns that **do not exist** in taskTimer (`internal/server/…`, `main_test.go`, `router.go`, `frontend/src/…`). Treat them as **N/A** for this repo unless you maintain a **separate** service; see the table in **[architecture.md](architecture.md)** and **[deployment.md](deployment.md)**.

Completing “**all** IDs” here is **not** the goal when the ID maps to another codebase.

## What *does* still apply (quality bar for taskTimer)

Until work is done and maintained in **this** tree, the *spirit* of a high bar still matters—for **GJS/GTK**, **extension**, **CI**, and **docs**:

| Area | Where it lives |
|------|----------------|
| Automated checks | `make lint`, `make test`, `npm run lint`, GitHub Actions (`.github/workflows/`) |
| Releases & notes | `version.json`, `CHANGELOG.md`, release workflow |
| Contributor flow | `CONTRIBUTING.md`, issue/PR templates |
| Desktop UX / a11y | `tests/TEST14-*.md`, manual scenarios under `tests/*.md` |
| Optional browser shell | `e2e/` (Playwright + MSW — not the GTK app) |

Track concrete gaps with **GitHub Issues** and **PRs** using **taskTimer-specific** wording, not foreign checklist IDs alone.

## License at repository root

[**`LICENSE`**](../../LICENSE) (GNU **GPLv3** full text) **is** present at the repository root. [README.md](../../README.md) points to it under **License**. Any checklist or audit that claims **no** `LICENSE` at root is **stale** or referred to another fork or revision.

## Summary

- **18–19, 21–25, 26–47, …** — Many rows are **backend/frontend-specific** → **N/A** or **separate repo**.
- **Quality** for **this** app → **ongoing** work in CI, tests, docs, and accessibility **here** until those areas meet project standards.
