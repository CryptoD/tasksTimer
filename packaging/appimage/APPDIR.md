# AppDir layout and runtime (taskTimer standalone)

This document defines the [AppDir](https://docs.appimage.org/packaging-guide/directory-structure.html) used to build an AppImage for the GJS/GTK standalone app (`main.js`). It matches paths already assumed in the codebase (`$APPDIR` for locales and bundled assets; see `i18n.js`, `taskTimer@CryptoD/audio_manager.js`, and `bin/po_compile.sh`).

## Runtime decision: system GJS / GTK vs bundling

| Approach | Choice for this project |
|----------|-------------------------|
| **Interpreter & GUI stack** | **Use the host system:** `gjs`, GTK 3, GObject-Introspection, GStreamer (alarms), and typical desktop libraries (e.g. libnotify where used). |
| **Application payload** | **Ship inside the AppDir:** `main.js`, `config.js`, `context.js`, `i18n.js`, `platform/`, `taskTimer@CryptoD/`, and optional `usr/share/locale` (from `bin/po_compile.sh`). |

**Rationale:** Bundling GJS, GTK, and GI typelibs would greatly increase image size, duplicate the user’s GNOME/GTK stack, and complicate GLibc and graphics driver compatibility. A **thin bundle** that relies on distro-provided `gjs` and GTK is standard for GJS utilities on Linux; document packages so users on minimal systems know what to install.

**Optional future work:** A fully self-contained image (e.g. relocatable GTK + gjs) is possible but out of scope for this phase.

## Directory layout

```
AppDir/
├── AppRun                 # Sets APPDIR, cd, exec usr/bin/tasktimer
├── main.js                # Copied from repo root (not necessarily tracked in this template tree)
├── config.js
├── context.js
├── i18n.js
├── platform/              # Whole directory from repo
├── taskTimer@CryptoD/     # Extension tree (schemas, icons, JS, …)
└── usr/
    ├── bin/
    │   └── tasktimer      # Sets APPDIR (if unset), GJS_PATH, GI_TYPELIB_PATH, runs gjs main.js
    └── share/
        ├── applications/
        │   └── com.github.cryptod.tasktimer.desktop
        ├── icons/
        │   └── hicolor/   # See “Icons” below; maintain via bundle_appdir.sh
        ├── locale/        # <lang>/LC_MESSAGES/tasktimer.mo — bundle_appdir.sh or po_compile.sh
        └── metainfo/
            └── com.github.cryptod.tasktimer.desktop.appdata.xml
```

- **`APPDIR`:** Must point to the **mount/root directory of the squashfs** (AppImage runtime sets this when using `AppRun` from the project template).
- **Working directory:** `AppRun` and `usr/bin/tasktimer` **change directory to `$APPDIR`** before running `gjs`. Several modules resolve resources with `GLib.get_current_dir()` in standalone mode; keeping `cwd == APPDIR` matches development from the repo root and avoids path bugs.
- **GJS / GObject-Introspection paths:** `usr/bin/tasktimer` prepends `$APPDIR` to `GJS_PATH` (if not already present) so GJS can resolve modules from the bundle. If `usr/lib/girepository-1.0` exists under the AppDir (e.g. future bundled typelibs), that directory is prepended to `GI_TYPELIB_PATH`; otherwise the host system typelibs are used unchanged.
- **Flow:** `AppRun` exports `APPDIR`, `cd`s to the bundle root, then `exec`s `usr/bin/tasktimer`. The `.desktop` file’s `Exec=tasktimer` relies on the same script when `usr/bin` is on `PATH` inside the image.
- **Freedesktop ID:** `com.github.cryptod.tasktimer` — aligned with `platform/standalone/branding.js` (`APP_ID`). The `.desktop` file uses `Icon=com.github.cryptod.tasktimer` (see `usr/share/icons/hicolor/.../com.github.cryptod.tasktimer.svg`). A convenience symlink `packaging/appimage/tasktimer.desktop` points at that file.

## Icons (`usr/share/icons/hicolor`)

The AppDir ships a full **hicolor** set for `com.github.cryptod.tasktimer`:

- **PNG:** `16x16`, `22x22`, `24x24`, `32x32`, `48x48`, `64x64`, `128x128`, `256x256`, `512x512` under `hicolor/<WxH>/apps/com.github.cryptod.tasktimer.png`
- **Scalable:** `hicolor/scalable/apps/com.github.cryptod.tasktimer.svg` (from `kitchen-timer-blackjackshellac-full.svg`)
- **Symbolic:** `hicolor/symbolic/apps/com.github.cryptod.tasktimer-symbolic.svg` (from `tasktimer-symbolic.svg`)
- **Cache:** `icon-theme.cache` (from `gtk-update-icon-cache` when available)

Regenerate these files with **`packaging/appimage/bundle_appdir.sh`** (requires ImageMagick `convert` and `msgfmt`).

## Translations (`usr/share/locale`)

Compiled catalogs live at `usr/share/locale/<lang>/LC_MESSAGES/tasktimer.mo`, built from `taskTimer@CryptoD/po/*.po`. The same **`bundle_appdir.sh`** runs `bin/po_compile.sh` with `APPDIR` pointing at this AppDir. You can also run `APPDIR=/path/to/AppDir bin/po_compile.sh` alone to refresh only locales.

## Build-time notes

1. Copy or sync the **repository payload** (files at the root of `AppDir/` above) into `AppDir/` before running `appimagetool` (or your builder).
2. Run **`packaging/appimage/bundle_appdir.sh`** to refresh **icons** (all sizes + symbolic) and **locale** `.mo` files under `usr/share/`.
3. Ensure `AppRun` and `usr/bin/tasktimer` are executable (`chmod +x`).

## Host dependencies (typical package names)

Users need a desktop stack that provides at least:

- `gjs` (GObject JavaScript bindings)
- GTK 3, Gdk, Pango (GI)
- GStreamer 1.0 (GI) for alarm playback
- Optional: AppIndicator / Ayatana, `libnotify` — features degrade gracefully if missing

Exact package names differ by distribution (e.g. Debian/Ubuntu: `gjs`, `gir1.2-gtk-3.0`, `gir1.2-gstreamer-1.0`).
