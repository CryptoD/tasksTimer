/** Babel for webpack bundle-budget tooling only (GJS sources are not transpiled through this). */
module.exports = {
    presets: [
        ['@babel/preset-env', { targets: { browsers: 'defaults' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
    ],
};
