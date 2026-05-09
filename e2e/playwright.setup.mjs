import { test as testBase, expect } from '@playwright/test';
import { defineNetworkFixture } from '@msw/playwright';
import { handlers } from './handlers.mjs';

function mocksEnabled() {
    // Some checklists expect `REACT_APP_USE_MOCKS=false` for “real backend” runs.
    // This repo is not a React app, but we honor the flag for Playwright shell behavior.
    const v = String(process.env.REACT_APP_USE_MOCKS || '').trim();
    if (v.length === 0) return true;
    return v !== 'false' && v !== '0';
}

export const test = testBase.extend({
    handlers: [handlers, { option: true }],
    network: [
        async ({ context, handlers: h }, use) => {
            if (!mocksEnabled()) {
                await use(null);
                return;
            }
            const network = defineNetworkFixture({
                context,
                handlers: h || [],
                onUnhandledRequest: 'bypass',
            });
            await network.enable();
            await use(network);
            await network.disable();
        },
        { auto: true },
    ],
});

export { expect };
