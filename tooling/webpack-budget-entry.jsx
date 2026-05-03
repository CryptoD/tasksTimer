/**
 * Webpack bundle-budget entry only (not used by the GJS app).
 * Imports React + the ESLint smoke component so the stat reflects a small real JSX tree.
 */
import { createElement } from 'react';
import { EslintReactHooksA11ySmoke } from '../tests/eslint-smoke/react-hooks-a11y.smoke.jsx';

// Side-effect reference so the component stays in the bundle without a DOM runtime.
void createElement(EslintReactHooksA11ySmoke, null);
