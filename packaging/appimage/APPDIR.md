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
├── AppRun                 # Executable; sets APPDIR, cd to bundle root, exec gjs main.js
├── main.js                # Copied from repo root (not necessarily tracked in this template tree)
├── config.js
├── context.js
├── i18n.js
├── platform/              # Whole directory from repo
├── taskTimer@CryptoD/     # Extension tree (schemas, icons, JS, …)
└── usr/
    ├── bin/
    │   └── tasktimer      # Optional PATH helper; same behavior as AppRun
    └── share/
        ├── applications/
        │   └── com.github.cryptod.tasktimer.desktop
        ├── icons/
        │   └── hicolor/scalable/apps/com.github.cryptod.tasktimer.svg
        ├── locale/        # Optional; populated by APPDIR=… bin/po_compile.sh
        └── metainfo/
            └── com.github.cryptod.tasktimer.desktop.appdata.xml
```

- **`APPDIR`:** Must point to the **mount/root directory of the squashfs** (AppImage runtime sets this when using `AppRun` from the project template).
- **Working directory:** `AppRun` and `usr/bin/tasktimer` **change directory to `$APPDIR`** before running `gjs`. Several modules resolve resources with `GLib.get_current_dir()` in standalone mode; keeping `cwd == APPDIR` matches development from the repo root and avoids path bugs.
- **Freedesktop ID:** `com.github.cryptod.tasktimer` — aligned with `platform/standalone/branding.js` (`APP_ID`).

## Build-time notes

1. Copy or sync the **repository payload** (files at the root of `AppDir/` above) into `AppDir/` before running `appimagetool` (or your builder).
2. Run `APPDIR=/path/to/AppDir bin/po_compile.sh` to fill `usr/share/locale/` if translations are required.
3. Ensure `AppRun` and `usr/bin/tasktimer` are executable (`chmod +x`).

## Host dependencies (typical package names)

Users need a desktop stack that provides at least:

- `gjs` (GObject JavaScript bindings)
- GTK 3, Gdk, Pango (GI)
- GStreamer 1.0 (GI) for alarm playback
- Optional: AppIndicator / Ayatana, `libnotify` — features degrade gracefully if missing

Exact package names differ by distribution (e.g. Debian/Ubuntu: `gjs`, `gir1.2-gtk-3.0`, `gir1.2-gstreamer-1.0`).
