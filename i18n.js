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

function _preferredFromGLib() {
    try {
        const langs = GLib.get_language_names();
        if (langs && langs.length > 0) {
            // GLib returns entries like "fr_FR.UTF-8", "fr_FR", "fr", "C".
            for (let i = 0; i < langs.length; i++) {
                const raw = langs[i];
                if (!raw || raw === 'C' || raw === 'POSIX') {
                    continue;
                }
                const noEncoding = raw.split('.')[0]; // drop .UTF-8
                if (noEncoding && noEncoding.length > 0) {
                    return noEncoding;
                }
            }
        }
    } catch (e) {
        // ignore and fall through
    }
    return null;
}

function _preferredFromIntl() {
    try {
        if (typeof Intl !== 'undefined' &&
            Intl.DateTimeFormat &&
            typeof Intl.DateTimeFormat === 'function') {
            const loc = Intl.DateTimeFormat().resolvedOptions().locale;
            if (loc && loc.length > 0) {
                return loc;
            }
        }
    } catch (e) {
        // ignore
    }
    return null;
}

function _candidateLocaleDirs() {
    const dirs = [];

    // 0. GNOME Shell extension locale directory, if available.
    try {
        const ExtensionUtils = imports.misc && imports.misc.extensionUtils;
        if (ExtensionUtils && typeof ExtensionUtils.getCurrentExtension === 'function') {
            const Me = ExtensionUtils.getCurrentExtension();
            if (Me && Me.dir && Me.dir.get_child) {
                const locDir = Me.dir.get_child('locale');
                if (locDir && locDir.query_exists(null)) {
                    dirs.push(locDir.get_path());
                }
            }
        }
    } catch (e) {
        // ignore; not running as an extension.
    }

    // 1. AppImage layout: $APPDIR/usr/share/locale, then $APPDIR/share/locale.
    const appDir = GLib.getenv('APPDIR');
    if (appDir && appDir.length > 0) {
        dirs.push(GLib.build_filenamev([appDir, 'usr', 'share', 'locale']));
        dirs.push(GLib.build_filenamev([appDir, 'share', 'locale']));
    }

    // 2. Project-relative prefixes for development / unpacked runs.
    const cwd = GLib.get_current_dir();
    dirs.push(GLib.build_filenamev([cwd, 'usr', 'share', 'locale']));
    dirs.push(GLib.build_filenamev([cwd, 'po']));

    // 3. System default.
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
 * Detect the user's preferred language using GLib and, as a secondary source,
 * the JavaScript Intl API. Returns a BCP47/locale-style string such as
 * "fr_FR" or "en-US", falling back to null if none is available.
 */
function getPreferredLanguage() {
    const glibLang = _preferredFromGLib();
    if (glibLang) {
        return glibLang;
    }
    const intlLang = _preferredFromIntl();
    if (intlLang) {
        return intlLang;
    }
    return null;
}

/**
 * Initialize gettext for the given domain and return the bound domain object,
 * after ensuring the process locale reflects the user's preferred language.
 *
 * @param {string} domainName - gettext domain, defaults to "tasktimer".
 * @returns {Object} - imports.gettext.domain(domainName) result.
 */
function init(domainName = 'tasktimer') {
    // If LANGUAGE is not explicitly set, populate it from the preferred
    // language so that gettext uses the same locale as the rest of the app.
    try {
        const current = GLib.getenv('LANGUAGE');
        if (!current || current.length === 0) {
            const lang = getPreferredLanguage();
            if (lang && lang.length > 0) {
                GLib.setenv('LANGUAGE', lang, true);
            }
        }
    } catch (e) {
        // ignore; locale variables will remain unchanged.
    }

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
    getPreferredLanguage,
};

