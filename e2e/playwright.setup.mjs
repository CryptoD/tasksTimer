import { test as testBase, expect } from '@playwright/test';
import { defineNetworkFixture } from '@msw/playwright';
import { handlers } from './handlers.mjs';

export const test = testBase.extend({
    handlers: [handlers, { option: true }],
    network: [
        async ({ context, handlers: h }, use) => {
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
