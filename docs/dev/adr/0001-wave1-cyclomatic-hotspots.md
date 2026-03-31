# ADR 0001: Wave 1 — top-three cyclomatic hotspots (task 3)

- **Status:** Accepted  
- **Date:** 2026-03-29  

## Context

ESLint [`complexity`](https://eslint.org/docs/latest/rules/complexity) identified three dominant hotspots (see historical snapshots in [js-complexity-baseline.md](../js-complexity-baseline.md)). A refactor “wave” should satisfy:

1. **`make test`** — full GJS suite passes.  
2. **Cyclomatic complexity reduced** on those targets (or clearly split so the user-facing entry stays small), **or** a **follow-up ADR** documents why reduction is deferred.

## Decision

**Wave 1** implemented behavior-preserving splits (helpers in the same module first; see [llm-context.md](../llm-context.md)). **No exception ADR** is required: complexity **dropped** on all three primary entry points.

| Target (before) | Approx. complexity before | After (primary symbol) | Approx. after |
|-----------------|---------------------------|-------------------------|---------------|
| [`taskTimer@CryptoD/prefs.js`](../../../taskTimer@CryptoD/prefs.js) `build` | 52 | `build` | 7 |
| [`platform/standalone/gtk_platform.js`](../../../platform/standalone/gtk_platform.js) `showMainWindow` | 33 | `showMainWindow` | 13 |
| [`platform/standalone/timer_list_item.js`](../../../platform/standalone/timer_list_item.js) `_updateStateClasses` | 29 | `_updateStateClasses` | 1 |

**Note:** `showMainWindow` delegates UI construction to **`_buildMainWindowBody`** (complexity **15** at acceptance—at the project soft threshold; further splits can be a later wave). Helpers such as **`_assemblePrefsFromBuilder`** (5) and **`_wirePrefsTimerSection`** (12) carry the former `build` weight.

## Consequences

- Future waves should repeat: **tests green**, **metrics improved** or **ADR for exception**.  
- Regenerate ESLint complexity snapshots when updating [js-complexity-baseline.md](../js-complexity-baseline.md).
