# Compatibility Layer Design Document

## Overview

This document outlines the design for a compatibility layer to decouple the taskTimer logic from GNOME Shell-specific APIs. This transition will allow the core timer logic to run in different environments (GNOME 45+, standalone app, or other desktop environments) by providing abstract interfaces for shell services.

---

## 1. Extension Information & Lifecycle

### GNOME Shell API: `imports.misc.extensionUtils`
- **Current Usage**: `ExtensionUtils.getCurrentExtension()`, `ExtensionUtils.getSettings()`, `ExtensionUtils.initTranslations()`
- **Standalone Equivalent**: **Global Context Object**
- **Design**:
    - Create a `Context` module that provides metadata (version, path, uuid).
    - Environment-specific implementations:
        - `GnomeShellContext`: Uses `ExtensionUtils` or GNOME 45+ `Extension` class.
        - `StandaloneContext`: Reads `metadata.json` directly and calculates paths relative to the executable.

### GNOME Shell API: `extension.js` (Entry Point)
- **Current Usage**: `init()`, `enable()`, `disable()`
- **Standalone Equivalent**: **Lifecycle Manager**
- **Design**:
    - Decouple the `Extension` class in `extension.js` from the UI.
    - The `enable()` method should instantiate the `Timers` manager and then request a `PlatformUI` to display it.

---

## 2. Configuration & Persistence

### GNOME Shell API: `ExtensionUtils.getSettings()` (GSettings)
- **Current Usage**: `settings.js` manages GSettings via GSChemas.
- **Standalone Equivalent**: **JSON-based Persistence** (Already partially implemented in `storage.js`)
- **Design**:
    - **ConfigProvider Interface**: `get(key)`, `set(key, value)`, `connect(changed_signal)`.
    - **GSettingsProvider**: Wraps `Gio.Settings`.
    - **JSONSettingsProvider**: Reads/Writes to `~/.config/tasktimer/settings.json`.
    - **Migration**: Update `settings.js` to use the provider pattern.

---

## 3. User Interface & Display

### GNOME Shell API: `Main.panel.addToStatusArea()`
- **Current Usage**: Adding the extension button to the top bar.
- **Standalone Equivalent**: **System Tray Icon (AppIndicator / StatusIcon)**
- **Design**:
    - **TrayProvider Interface**: `setIcon(name)`, `setLabel(text)`, `setMenu(menu)`.
    - **GnomeShellTray**: Wraps `PanelMenu.Button`.
    - **AppIndicatorTray**: USes `libappindicator` or `libayatana-appindicator` for standalone operation.

### GNOME Shell API: `imports.ui.popupMenu`
- **Current Usage**: Complex nested menus in the panel.
- **Standalone Equivalent**: **Gtk.Menu or GMenu**
- **Design**:
    - Abstract the menu building logic. Currently `menus.js` and `menuitem.js` are tightly coupled to GNOME Shell's `PopupMenu` classes.
    - Create a `BaseMenuBuilder` that generates a generic menu structure.
    - **ShellMenuRenderer**: Translates structure to `PopupMenu` items.
    - **GtkMenuRenderer**: Translates structure to `Gtk.MenuItem`.

### GNOME Shell API: `imports.ui.slider`
- **Current Usage**: Time selection in menus.
- **Standalone Equivalent**: **Gtk.Scale**
- **Design**:
    - Use a generic `SliderComponent` that resolves to Shell's `Slider` in GNOME, or `Gtk.Scale` in a standalone window.

---

## 4. Notifications & Audio

### GNOME Shell API: `Main.messageTray` / `imports.ui.messageTray`
- **Current Usage**: `notifier.js` for "Timer Expired" alerts.
- **Standalone Equivalent**: **libnotify (Gio.Notification)**
- **Design**:
    - Use `Gio.Notification` which is supported by GNOME and most other desktops.
    - Fallback to `libnotify` via DBus if `Gio.Application` is not used.

### GNOME Shell API: `imports.ui.status.volume`
- **Current Usage**: Checking/adjusting volume for the alarm.
- **Standalone Equivalent**: **GCore / PulseAudio / PipeWire directly**
- **Design**:
    - Abstract volume control into an `AudioManager` module.
    - Use `Gst` (GStreamer) for volume management where possible as it's already used for playback.

---

## 5. System Integration

### GNOME Shell API: `global.display.grab_accelerator()`
- **Current Usage**: `keyboard_shortcuts.js` for global hotkeys.
- **Standalone Equivalent**: **Keybinder / X11 Global Shortcuts**
- **Design**:
    - **ShortcutProvider Interface**: `register(accelerator, callback)`.
    - **GnomeShellShortcutProvider**: Uses `global.display` and `Main.wm`.
    - **PortalShortcutProvider**: Uses XDG Desktop Portal for keyboard shortcuts (modern way).

### GNOME Shell API: `SessionManager` DBus (via `inhibitor.js`)
- **Usage**: Preventing sleep while timer is running.
- **Status**: **Already Standalone-ready.**
- **Design**:
    - The current implementation in `inhibitor.js` uses standard DBus calls to `org.gnome.SessionManager`. This works in standalone mode as long as the session manager is present.

---

## 6. Utilities

### GNOME Shell API: `imports.format` / `imports.lang` / `imports.byteArray`
- **Usage**: String formatting, signal connections, byte conversion.
- **Standalone Equivalent**: **Modern JS / Native GJS**
- **Design**:
    - **Format**: Replace `String.prototype.format` with Template Literals or a lightweight polyfill in `utils.js`.
    - **Lang**: Replace `Lang.bind` with native `Function.prototype.bind`.
    - **ByteArray**: Replace with `new TextEncoder()` and `new TextDecoder()`.

---

## Implementation Road Map

1. **Refactor `utils.js`**: Remove dependencies on `imports.format` and `imports.byteArray`.
2. **Abstract Settings**: Implement the Provider pattern in `settings.js`.
3. **Decouple Timers**: Ensure `timers.js` does not require `imports.ui.*` directly; pass UI dependencies as injected objects.
4. **Interface Definition**: Create `platform/interface.js` defining the required methods for any platform.
5. **Shell Implementation**: Wrap current GNOME Shell logic into a `platform/gnome-shell/` directory.
6. **Standalone Implementation**: Create a `platform/standalone/` directory using GTK and AppIndicator.
