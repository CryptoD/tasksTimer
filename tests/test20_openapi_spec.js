// Task 73: OpenAPI initial slice must cover auth, tasks, projects, users, errors.
// Run: gjs tests/test20_openapi_spec.js

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
const specPath = GLib.build_filenamev([root, 'docs', 'api', 'openapi.yaml']);
assert(Gio.File.new_for_path(specPath).query_exists(null), 'docs/api/openapi.yaml must exist');

const spec = readUtf8(specPath);
assert(spec.indexOf('openapi: 3.0') >= 0, 'must be OpenAPI 3.x');
assert(spec.indexOf('ErrorResponse') >= 0, 'must define ErrorResponse schema');
assert(spec.indexOf('ErrorCode') >= 0, 'must define ErrorCode enum');

const requiredPaths = [
    '/auth/login',
    '/auth/logout',
    '/auth/me',
    '/tasks',
    '/tasks/{taskId}',
    '/projects',
    '/projects/{projectId}',
    '/users',
    '/users/{userId}',
    '/users/{userId}/password',
];

requiredPaths.forEach(p => {
    assert(spec.indexOf(p + ':') >= 0 || spec.indexOf(p + '\n') >= 0,
        `openapi.yaml must document path ${p}`);
});

const requiredTags = ['Auth', 'Tasks', 'Projects', 'Users'];
requiredTags.forEach(tag => {
    assert(spec.indexOf(`name: ${tag}`) >= 0, `openapi.yaml must include tag ${tag}`);
});

const errorCodes = [
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'VALIDATION_ERROR',
    'RATE_LIMITED',
];
errorCodes.forEach(code => {
    assert(spec.indexOf(code) >= 0, `ErrorCode enum must include ${code}`);
});

print('test20_openapi_spec: OK');
