import { test, expect } from './playwright.setup.mjs';

function mocksDisabled() {
    const v = String(process.env.REACT_APP_USE_MOCKS || '').trim();
    return v === 'false' || v === '0';
}

test('Real-backend smoke (optional): GET /ping works when mocks are disabled', async ({ page, network }) => {
    test.skip(!mocksDisabled(), 'This spec is for real-backend runs only (REACT_APP_USE_MOCKS=false).');
    test.skip(!!network, 'MSW is enabled; this spec requires mocks disabled.');

    const base = String(process.env.E2E_BASE_URL || '').trim();
    test.skip(base.length === 0, 'Set E2E_BASE_URL to run this against a real service.');

    await page.goto('about:blank');
    await page.setContent(`
    <!doctype html>
    <html>
      <body>
        <pre id="out">loading</pre>
        <script>
          fetch('${base.replace(/'/g, '')}/ping')
            .then(r => r.json())
            .then(d => { document.getElementById('out').textContent = JSON.stringify(d); })
            .catch(e => { document.getElementById('out').textContent = 'ERR:' + e; });
        </script>
      </body>
    </html>
  `);

    await expect(page.locator('#out')).toContainText('pong', { timeout: 10_000 });
});

