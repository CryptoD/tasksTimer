/*
 * i18n.js
 *
 * Standalone-friendly gettext initialization for taskTimer.
 *
 * This module configures the "tasktimer" gettext domain without relying on
 * ExtensionUtils.initTranslations(), so it can be used by the standalone
 * GTK application and other non-extension entry points.
 *
 * Resolution order for the locale directory:
 *   1. $APPDIR/usr/share/locale
 *   2. $APPDIR/share/locale
 *   3. ./usr/share/locale (relative to current working dir)
 *   4. ./po (source tree translations)
 *   5. /usr/share/locale (system default)
 *
 * Usage:
 *   const I18n = imports.i18n;
 *   const domain = I18n.init('tasktimer');
 *   const _ = domain.gettext;
 */

const { GLib } = imports.gi;
const Gettext = imports.gettext;

function _candidateLocaleDirs() {
    const dirs = [];

    const appDir = GLib.getenv('APPDIR');
    if (appDir && appDir.length > 0) {
        dirs.push(GLib.build_filenamev([appDir, 'usr', 'share', 'locale']));
        dirs.push(GLib.build_filenamev([appDir, 'share', 'locale']));
    }

    const cwd = GLib.get_current_dir();
    dirs.push(GLib.build_filenamev([cwd, 'usr', 'share', 'locale']));
    dirs.push(GLib.build_filenamev([cwd, 'po']));

    dirs.push('/usr/share/locale');

    return dirs;
}

function _firstExistingDir(candidates) {
    for (let i = 0; i < candidates.length; i++) {
        const path = candidates[i];
        try {
            if (GLib.file_test(path, GLib.FileTest.IS_DIR)) {
                return path;
            }
        } catch (e) {
            // ignore and continue
        }
    }
    return null;
}

/**
 * Initialize gettext for the given domain and return the bound domain object.
 *
 * @param {string} domainName - gettext domain, defaults to "tasktimer".
 * @returns {Object} - imports.gettext.domain(domainName) result.
 */
function init(domainName = 'tasktimer') {
    const candidates = _candidateLocaleDirs();
    const loc = _firstExistingDir(candidates);

    if (loc) {
        try {
            Gettext.bindtextdomain(domainName, loc);
        } catch (e) {
            // Fall through; default domain will still function without a bind.
        }
    }

    try {
        Gettext.textdomain(domainName);
    } catch (e) {
        // ignore; callers can still use imports.gettext.domain()
    }

    return Gettext.domain(domainName);
}

var exports = {
    init,
};

