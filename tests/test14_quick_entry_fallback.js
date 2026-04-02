// TEST 14: Quick entry duration fallback parsing
//
// Run:
//   gjs tests/test14_quick_entry_fallback.js

imports.searchPath.unshift('.');

const assert = (cond, msg) => {
    if (!cond) throw new Error('ASSERT FAILED: ' + (msg || ''));
};

const Fallback = imports.platform.standalone.quick_entry_fallback;

function t(input, expected) {
    const got = Fallback.parseDurationFallback(input);
    assert(got === expected, `parseDurationFallback(${JSON.stringify(input)}) => ${got}, expected ${expected}`);
}

// Empty / whitespace
t('', 0);
t('   ', 0);
t(null, 0);
t(undefined, 0);

// Plain seconds
t('90', 90);
t('001', 1);
t('0', 0);
t('100000', 100000);
t('12x', 0);

// mm:ss
t('5:0', 300);
t('5:59', 359);
t('0:00', 0);
t('10:60', 0);
t('10:-1', 0);
t('1:5', 65);

// Other strings
t('abc', 0);
t('1:2:3', 0);

print('TEST 14 quick entry fallback: pass');

