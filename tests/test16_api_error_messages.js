// API error catalog: mapping + dev-only leakage of server payloads.
imports.searchPath.unshift('.');

const Api = imports.src.api.api_error_messages;

function assert(cond, msg) {
    if (!cond) {
        throw new Error(msg || 'Assertion failed');
    }
}

function id(s) {
    return s;
}

function getenvEmpty() {
    return null;
}

assert(Api.normalizeErrorCode('UNAUTHORIZED') === 'UNAUTHORIZED');
assert(Api.normalizeErrorCode('not-found') === 'NOT_FOUND');

const msg401 = Api.gettextMsgIdForApiError(401, { details: 'do-not-show' });
assert(msg401.indexOf('do-not-show') < 0);
assert(Api.gettextMsgIdForApiError(403, {}) === Api.gettextMsgIdForApiError(403, { error_code: 'FORBIDDEN' }));

const benign = Api.formatApiErrorForUser(418, {
    error_code: 'UNKNOWN_SERVER_CODE',
    message: 'raw server headline',
    details: { leak: true },
}, { gettext: id, devMode: false, getenv: getenvEmpty });

assert(benign.indexOf('raw server') < 0);
assert(benign.indexOf('leak') < 0);

const leaky = Api.formatApiErrorForUser(418, {
    error_code: 'UNKNOWN_SERVER_CODE',
    message: 'raw server headline',
    details: { leak: true },
}, { gettext: id, devMode: true });

assert(leaky.indexOf('raw server') >= 0 || leaky.indexOf('leak') >= 0);

const onlyDetails = Api.formatApiErrorForUser(500, { details: 'internal secret' }, { gettext: id, devMode: true });
assert(onlyDetails.indexOf('internal secret') >= 0);

console.log('TEST 16 api error messages: pass');
