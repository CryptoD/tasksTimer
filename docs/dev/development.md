# Development

This document is a small grab bag of development conventions that do not fit cleanly in the other `docs/dev/` pages.

For repo structure and how to run lint/tests, see:

- [architecture.md](architecture.md)
- [deployment.md](deployment.md)

## Coverage exclusions (documented)

This repository does not currently run a code-coverage tool in CI, but we still track explicit coverage exclusions so they remain intentional and reviewable.

### Current exclusions

**None.**

No `// coverage:ignore` markers (or equivalents like `/* istanbul ignore next */`, `/* c8 ignore next */`, etc.) and no known package/module-level “skip from coverage” rules exist in the repository at this time.

### Policy (if you add one)

If you introduce a coverage exclusion anywhere in the codebase, you must add an entry here with:

- **Location**: file path and the exact directive/pattern used
- **Reason**: why excluding is correct (e.g. platform-specific code paths, hard-to-stimulate error branch, defensive crash guard)
- **Owner / follow-up** (optional): when/what would allow removing the exclusion

