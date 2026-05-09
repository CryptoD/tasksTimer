import { http, HttpResponse } from 'msw';
import { test, expect } from './playwright.setup.mjs';

test('MSW intercepts fetch via @msw/playwright', async ({ page, network }) => {
    test.skip(!network, 'Mocks disabled (REACT_APP_USE_MOCKS=false); this spec only validates MSW wiring.');

    network.use(
        http.get('http://localhost/mock/ping', () =>
            HttpResponse.json({ pong: 1 }),
        ),
    );

    await page.goto('about:blank');
    await page.setContent(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"></head>
    <body><pre id="out">loading</pre>
    <script>
      fetch('http://localhost/mock/ping')
        .then(function (r) { return r.json(); })
        .then(function (d) {
          document.getElementById('out').textContent = JSON.stringify(d);
        })
        .catch(function (e) {
          document.getElementById('out').textContent = 'ERR:' + e;
        });
    </script>
    </body></html>
  `);

    await expect(page.locator('#out')).toContainText('pong', { timeout: 10_000 });
});
