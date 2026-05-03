/**
 * Intentional minimal JSX module so `eslint-plugin-react-hooks` and
 * `eslint-plugin-jsx-a11y` run under `npm run lint` (this repo is otherwise GJS-only).
 * Do not import this from the application.
 */
import { useState } from 'react';

export function EslintReactHooksA11ySmoke() {
    const [n, setN] = useState(0);
    return (
        <main>
            <h1>ESLint fixture</h1>
            <button type="button" onClick={() => setN((c) => c + 1)}>
                Count:
                {n}
            </button>
        </main>
    );
}
