/**
 * Webpack **tooling-only** production bundle used to enforce a max initial chunk size.
 * The taskTimer app is GJS/GTK; this config exists for CI/budget discipline and docs.
 *
 * Relax budgets by editing `BUDGET_*` below (prefer a ticket reference in the commit).
 */
const path = require('path');

/**
 * Hard cap for the main (initial) entry chunk — webpack treats overage as an error (`hints: 'error'`).
 * Keep in sync with the “Webpack bundle budget” section in docs/dev/development.md.
 *
 * Latest observed production build (same entry): main ≈ **2.4 KiB** (~2446 B uncompressed).
 */
const BUDGET_MAX_ENTRYPOINT_BYTES = 16 * 1024;
/** Per-asset cap (single emitted `.js`; same limit as entrypoint here). */
const BUDGET_MAX_ASSET_BYTES = 16 * 1024;

module.exports = {
    mode: 'production',
    target: 'web',
    entry: path.resolve(__dirname, 'tooling', 'webpack-budget-entry.jsx'),
    output: {
        path: path.resolve(__dirname, 'dist', 'webpack-budget'),
        filename: '[name].js',
        clean: true,
    },
    resolve: {
        extensions: ['.jsx', '.js', '.json'],
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /node_modules/,
                use: 'babel-loader',
            },
        ],
    },
    performance: {
        hints: 'error',
        maxEntrypointSize: BUDGET_MAX_ENTRYPOINT_BYTES,
        maxAssetSize: BUDGET_MAX_ASSET_BYTES,
    },
    stats: {
        colors: true,
        assets: true,
        entrypoints: true,
        modules: false,
        chunks: false,
    },
};
