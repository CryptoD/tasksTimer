// Subprocess for tests/test17_production_config.js — do not run via make test directly.
imports.searchPath.unshift('.');

const { GLib } = imports.gi;

const Prod = imports.src.config.production_config;

const mode = String(ARGV[0] || '');

if (mode === 'missing_secret') {
    GLib.setenv('TASKTIMER_ENV', 'production', true);
    GLib.unsetenv('TASKTIMER_SESSION_SECRET');
    GLib.unsetenv('TASKTIMER_JWT_SECRET');
    GLib.unsetenv('TASKTIMER_CSRF_SECRET');
    GLib.unsetenv('TASKTIMER_INTEGRATION_SECRET');
    Prod.assertProductionConfigOrExit(GLib.getenv);
    print('TEST17 scenario FAIL: expected exit before this line');
    imports.system.exit(2);
}

if (mode === 'ok_secrets') {
    GLib.setenv('TASKTIMER_ENV', 'production', true);
    const secret = 'x'.repeat(Prod.MIN_SECRET_LENGTH);
    GLib.setenv('TASKTIMER_SESSION_SECRET', secret, true);
    GLib.setenv('TASKTIMER_JWT_SECRET', secret, true);
    GLib.setenv('TASKTIMER_CSRF_SECRET', secret, true);
    GLib.setenv('TASKTIMER_INTEGRATION_SECRET', secret, true);
    const ok = Prod.assertProductionConfigOrExit(GLib.getenv);
    if (!ok) {
        imports.system.exit(3);
    }
    print('TEST17 scenario OK: production secrets accepted');
    imports.system.exit(0);
}

printerr('TEST17 scenario FAIL: unknown mode ' + mode);
imports.system.exit(2);
