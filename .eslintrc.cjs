/**
 * ESLint for GJS sources (SpiderMonkey + GObject introspection).
 * Complements `make lint` (gettext + shellcheck). CI: `npm run lint`.
 *
 * React / JSX overrides: any `eslint-disable` for hooks or jsx-a11y MUST cite a ticket
 * (for example `#123` or `KT-9`) per project policy — do not mute rules without justification.
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
    ignorePatterns: ['node_modules/**', 'packaging/appimage/AppDir/**', 'e2e/**'],
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
    overrides: [
        {
            files: ['**/*.{jsx,tsx}'],
            env: {
                browser: true,
                es2021: true,
            },
            parser: '@typescript-eslint/parser',
            parserOptions: {
                ecmaVersion: 2022,
                ecmaFeatures: { jsx: true },
                sourceType: 'module',
            },
            plugins: ['react', 'react-hooks', 'jsx-a11y'],
            extends: [
                'eslint:recommended',
                'plugin:react/recommended',
                'plugin:react/jsx-runtime',
                'plugin:jsx-a11y/recommended',
            ],
            settings: {
                react: {
                    version: 'detect',
                },
            },
            rules: {
                'react/prop-types': 'off',
                'react-hooks/rules-of-hooks': 'error',
                'react-hooks/exhaustive-deps': 'error',
                'no-unused-vars': 'off',
            },
        },
    ],
};
