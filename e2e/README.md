# Playwright + MSW (shell)

This directory is a **minimal browser E2E** setup using **Playwright** and **Mock Service Worker** via [`@msw/playwright`](https://github.com/mswjs/playwright). It does **not** drive the real taskTimer **GTK / GJS** UI (that requires a desktop session).

- **`npm run test:e2e`** — runs `playwright test` with `e2e/playwright.config.mjs`.
- **`shell.spec.mjs`** — proves MSW can mock `fetch()` in Chromium under CI.

Extend with more specs or shared handlers in **`handlers.mjs`** as needed.
