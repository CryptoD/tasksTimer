/**
 * ESLint for GJS sources (SpiderMonkey + GObject introspection).
 * Complements `make lint` (gettext + shellcheck). CI: `npm run lint`.
 */
module.exports = {
    env: {
        es2021: true,
    },
    globals: {
        imports: 'readonly',
        log: 'readonly',
        logError: 'readonly',
        print: 'readonly',
        ARGV: 'readonly',
        Intl: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
    },
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'script',
    },
    extends: ['eslint:recommended'],
    ignorePatterns: ['node_modules/**', 'packaging/appimage/AppDir/**'],
    rules: {
        // GJS / GObject code uses patterns ESLint's default rules misread (imports.gi,
        // optional catch, gettext `_`, etc.). Prefer `make lint` + tests for correctness.
        'no-undef': 'off',
        'no-empty': ['warn', { allowEmptyCatch: true }],
        'no-extra-semi': 'off',
        'no-mixed-spaces-and-tabs': 'off',
        'no-constant-condition': 'warn',
        'no-inner-declarations': 'off',
        'no-dupe-keys': 'warn',
        'no-redeclare': 'warn',
        'no-unused-vars': [
            'warn',
            {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            },
        ],
    },
};
