// Task 75: API versioning policy — /api/v1 prefix, frontend config, OpenAPI servers aligned.
// Run: gjs tests/test22_api_versioning_policy.js

imports.searchPath.unshift('.');

const { GLib, Gio } = imports.gi;

function assert(cond, msg) {
    if (!cond) {
        throw new Error(msg || 'Assertion failed');
    }
}

function readUtf8(path) {
    const [, contents] = Gio.File.new_for_path(path).load_contents(null);
    return new TextDecoder('utf-8').decode(contents);
}

const root = GLib.get_current_dir();
const policy = GLib.build_filenamev([root, 'docs', 'api', 'versioning-policy.md']);
const openApi = GLib.build_filenamev([root, 'docs', 'api', 'openapi.yaml']);
const frontendCfg = GLib.build_filenamev([root, 'frontend', 'config.js']);
const readme = GLib.build_filenamev([root, 'README.md']);
const desktopCfg = GLib.build_filenamev([root, 'config.js']);

assert(Gio.File.new_for_path(policy).query_exists(null));
assert(Gio.File.new_for_path(frontendCfg).query_exists(null));

const policyText = readUtf8(policy);
assert(policyText.indexOf('/api/v1') >= 0, 'policy must document /api/v1');
assert(policyText.indexOf('unversioned') >= 0, 'policy must reject unversioned public API');

const openApiText = readUtf8(openApi);
assert(openApiText.indexOf('/api/v1') >= 0, 'openapi servers must use /api/v1');

const feText = readUtf8(frontendCfg);
assert(feText.indexOf("API_VERSION = 'v1'") >= 0 || feText.indexOf('API_VERSION = "v1"') >= 0);
assert(feText.indexOf('/api/${API_VERSION}') >= 0 || feText.indexOf('/api/v1') >= 0);
assert(feText.indexOf('versioning-policy.md') >= 0);

const readmeText = readUtf8(readme);
assert(readmeText.indexOf('/api/v1') >= 0, 'README must document API versioning');
assert(readmeText.indexOf('frontend/config.js') >= 0);

const desktopText = readUtf8(desktopCfg);
assert(desktopText.indexOf('frontend/config.js') >= 0, 'root config.js must point to frontend API config');

print('test22_api_versioning_policy: OK');
