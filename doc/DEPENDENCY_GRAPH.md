# TaskTimer Extension Dependency Graph

## Overview

This document maps all module dependencies and GNOME Shell-specific API usage in the taskTimer extension. This is critical for migration to future GNOME Shell versions (45+) where the extension system changed significantly.

## File Structure

```
taskTimer@CryptoD/
├── extension.js          # Main extension entry point
├── indicator.js          # Panel indicator UI component
├── menus.js              # Menu builder for popup menu
├── menuitem.js           # Individual menu item components
├── timers.js             # Timer management and logic
├── timer.js              # Individual timer class (part of timers.js)
├── notifier.js           # Notification system
├── inhibitor.js          # Session inhibition (prevent sleep)
├── keyboard_shortcuts.js # Global keyboard shortcuts
├── progress_icon.js      # Progress icon generation
├── settings.js           # Settings/preferences management
├── prefs.js              # Preferences UI
├── utils.js              # Utility functions
├── logger.js             # Logging system
├── storage.js            # JSON storage utilities
├── alarm_timer.js        # Alarm timer functionality
├── hms.js                # Hours/Minutes/Seconds utility class
```

## Dependency Graph

### Core Extension Entry Point
```
extension.js
├── imports.gi: GObject, St, Clutter
├── imports.misc.extensionUtils (ExtensionUtils, Me)
├── imports.gettext (Gettext, _)
├── imports.ui: Main, PanelMenu, PopupMenu
├── Me.imports: utils, settings.Settings, menus, timers.Timers, timers.Timer, indicator
```

### UI Components Layer

#### indicator.js
```
├── imports.gi: GObject, St, Clutter, Gio
├── imports.misc.extensionUtils (ExtensionUtils, Me)
├── imports.gettext (Gettext, _)
├── imports.ui: Main, PanelMenu, PopupMenu
├── Me.imports: utils, settings.Settings, menus, timers.Timers, timers.Timer, logger.Logger
```

#### menus.js
```
├── imports.gi: St, Clutter
├── imports.ui: PopupMenu, Main, Slider
├── imports.misc.extensionUtils (ExtensionUtils, Me)
├── imports.gettext (Gettext, _)
├── Me.imports: timers.Timer, utils, logger.Logger, hms.HMS, menuitem
```

#### menuitem.js
```
├── imports.gi: Clutter, GObject, St, Gio
├── imports.ui: PopupMenu, Slider
├── imports.misc.extensionUtils (ExtensionUtils, Me)
├── Me.imports: timers.Timer, alarm_timer.AlarmTimer, utils, hms.HMS, logger.Logger
```

### Timer Management Layer

#### timers.js
```
├── imports.gi: GLib, St, Clutter, Gio
├── imports.ui: Main, PopupMenu, status.volume (mixerControl)
├── imports.misc.extensionUtils (ExtensionUtils, Me)
├── imports.gettext (Gettext, _)
├── Me.imports: utils, settings.Settings, notifier, logger.Logger, hms.HMS, 
│                alarm_timer.AlarmTimer, inhibitor.SessionManagerInhibitor,
│                keyboard_shortcuts.KeyboardShortcuts, progress_icon.ProgressIcon,
│                storage.Storage
```

### System Integration Layer

#### notifier.js
```
├── imports.gi: GLib, GObject, Gio, St
├── imports.ui: Main, MessageTray, PopupMenu
├── imports.misc: Params, extensionUtils (ExtensionUtils, Me)
├── imports.gettext (Gettext, _)
├── Me.imports: utils, logger.Logger, hms.HMS
└── Special: Gst (GStreamer) for audio playback
```

#### inhibitor.js
```
├── imports.gi: Gio, Gtk, GLib
├── imports.misc.extensionUtils (ExtensionUtils, Me)
├── Me.imports: logger.Logger
└── Special: DBusSessionManagerProxy for session inhibition
```

#### keyboard_shortcuts.js
```
├── imports.gi: Meta, Shell
├── imports.ui: Main
├── imports.misc.extensionUtils (ExtensionUtils, Me)
├── Me.imports: logger.Logger, utils
└── Special: global.display for accelerator grabbing
```

### Utility Layer

#### progress_icon.js
```
├── imports.gi: GLib, Gio
├── imports.misc.extensionUtils (Me)
├── imports.gettext (Gettext, _)
```

#### settings.js
```
├── imports.gi: Gio, GLib
├── imports.misc.extensionUtils (ExtensionUtils, Me)
├── imports.gettext (Gettext, _)
├── Me.imports: utils, logger.Logger
```

#### prefs.js
```
├── imports.gi: Gio, Gtk, Gdk, GLib
├── imports.misc.extensionUtils (ExtensionUtils, Me)
├── imports.gettext (Gettext, _)
├── Me.imports: settings.Settings, utils, logger.Logger, hms.HMS, alarm_timer.AlarmTimer
```

#### utils.js
```
├── imports.gi: GLib
├── imports.format (String.prototype.format)
├── imports.gettext (Gettext, _)
├── imports.byteArray (ByteArray)
```

#### logger.js
```
├── imports.gi: GLib
├── imports.format (String.prototype.format)
```

#### storage.js
```
├── imports.gi: GLib
```

#### alarm_timer.js
```
├── imports.misc.extensionUtils (ExtensionUtils, Me)
├── Me.imports: utils, logger.Logger, hms.HMS
```

#### hms.js
```
(No external dependencies - pure JavaScript class)
```

## GNOME Shell-Specific API Usage

### imports.misc.extensionUtils
Used in: `extension.js`, `indicator.js`, `menus.js`, `menuitem.js`, `timers.js`, `notifier.js`, `inhibitor.js`, `keyboard_shortcuts.js`, `progress_icon.js`, `settings.js`, `prefs.js`, `alarm_timer.js`

**Critical for migration**: `ExtensionUtils.getCurrentExtension()` and `ExtensionUtils.getSettings()` changed in GNOME 45+

### imports.ui.main
Used in: `extension.js`, `indicator.js`, `menus.js`, `timers.js`, `notifier.js`, `keyboard_shortcuts.js`

**Purpose**: 
- `Main.panel.addToStatusArea()` - Add indicator to panel
- `Main.messageTray` - Display notifications
- `Main.wm.allowKeybinding()` - Register keyboard shortcuts

### imports.ui.panelMenu
Used in: `extension.js`, `indicator.js`

**Purpose**: `PanelMenu.Button` - Base class for panel indicator

### imports.ui.popupMenu
Used in: `extension.js`, `indicator.js`, `menus.js`, `menuitem.js`, `timers.js`, `notifier.js`

**Purpose**: Menu items, separators, submenus, switches

### imports.ui.messageTray
Used in: `notifier.js`

**Purpose**: `MessageTray.Source`, `MessageTray.Notification` - System notifications

### imports.ui.slider
Used in: `menus.js`, `menuitem.js`

**Purpose**: `Slider.Slider` - Time selection sliders

### imports.ui.status.volume
Used in: `timers.js`

**Purpose**: `imports.ui.status.volume.getMixerControl()` - Audio volume control

### imports.misc.params
Used in: `notifier.js`

**Purpose**: Parameter parsing utility

### imports.format
Used in: `utils.js`, `logger.js`, `alarm_timer.js`

**Purpose**: `String.prototype.format` - String formatting

### imports.byteArray
Used in: `utils.js`, `prefs.js`

**Purpose**: Byte array to string conversion

### imports.gettext
Used in: Most files

**Purpose**: Internationalization (`_()` function)

### imports.lang
Used in: `keyboard_shortcuts.js`

**Purpose**: Language utilities (deprecated in newer GNOME)

## GNOME 45+ Migration Critical Points

### 1. ExtensionUtils Changes
- **Old**: `const ExtensionUtils = imports.misc.extensionUtils;`
- **New**: Extension system uses ES modules
- **Impact**: All files using ExtensionUtils need restructuring

### 2. imports.ui and imports.misc
- **Old**: `imports.ui.*` and `imports.misc.*` 
- **New**: Must import from `resource:///org/gnome/shell/ui/*.js`
- **Impact**: All UI imports need path changes

### 3. Extension Entry Point
- **Old**: `function init() {}` returning Extension class
- **New**: `export default class Extension extends ExtensionExtension {}`
- **Impact**: `extension.js` needs complete rewrite

### 4. prefs.js Entry Point
- **Old**: `function init() {}` and `function buildPrefsWidget() {}`
- **New**: `export default class Prefs extends ExtensionPreferences {}`
- **Impact**: `prefs.js` needs complete rewrite

### 5. Global Objects
- **Old**: `global.display`, `global.window_manager`
- **New**: Access through Shell global or different APIs
- **Impact**: `keyboard_shortcuts.js` heavily affected

## Module Dependency Visualization

```
                    ┌─────────────────┐
                    │   extension.js  │
                    │   (Entry Point) │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌────────────┐  ┌──────────┐  ┌────────────┐
       │ indicator  │  │  timers  │  │   menus    │
       │    .js     │◄─┤   .js    │◄─┤    .js     │
       └────────────┘  └────┬─────┘  └────────────┘
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  notifier   │    │  inhibitor  │    │  keyboard_  │
│    .js      │    │    .js      │    │ shortcuts   │
└─────────────┘    └─────────────┘    └─────────────┘

┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   menuitem  │    │   logger    │    │   utils     │
│    .js      │    │    .js      │    │    .js      │
└─────────────┘    └─────────────┘    └─────────────┘

┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  settings   │    │    hms      │    │alarm_timer  │
│    .js      │    │    .js      │    │    .js      │
└─────────────┘    └─────────────┘    └─────────────┘

┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   prefs     │    │   storage   │    │progress_icon│
│    .js      │    │    .js      │    │    .js      │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Files with GNOME Shell-Specific Imports

| File | GNOME Shell Imports | Migration Priority |
|------|---------------------|-------------------|
| extension.js | extensionUtils, ui.main, ui.panelMenu, ui.popupMenu | Critical |
| indicator.js | extensionUtils, ui.main, ui.panelMenu, ui.popupMenu | Critical |
| menus.js | extensionUtils, ui.popupMenu, ui.main, ui.slider | Critical |
| menuitem.js | extensionUtils, ui.popupMenu, ui.slider | Critical |
| timers.js | extensionUtils, ui.main, ui.popupMenu, ui.status.volume | Critical |
| notifier.js | extensionUtils, ui.main, ui.messageTray, ui.popupMenu, misc.params | Critical |
| inhibitor.js | extensionUtils | High |
| keyboard_shortcuts.js | extensionUtils, ui.main, gi.Meta, gi.Shell | Critical |
| progress_icon.js | extensionUtils | Medium |
| settings.js | extensionUtils | High |
| prefs.js | extensionUtils | Critical |
| utils.js | format, byteArray | Medium |
| logger.js | format | Low |
| storage.js | None (gi.GLib only) | Low |
| alarm_timer.js | extensionUtils | Medium |
| hms.js | None | None |

## Notes for Next Developer

1. **Start with extension.js and prefs.js** - These are the entry points that changed most significantly in GNOME 45+

2. **UI imports pattern change**:
   - Old: `const Main = imports.ui.main;`
   - New: `import * as Main from 'resource:///org/gnome/shell/ui/main.js';`

3. **ExtensionUtils pattern change**:
   - Old: `const ExtensionUtils = imports.misc.extensionUtils; const Me = ExtensionUtils.getCurrentExtension();`
   - New: Extension metadata and settings accessed differently in class-based extensions

4. **Keyboard shortcuts** (`keyboard_shortcuts.js`) uses `global.display` which may need different access pattern in GNOME 45+

5. **Volume control** (`timers.js` line 64) uses `imports.ui.status.volume.getMixerControl()` - verify this API still exists

6. **Session inhibitor** (`inhibitor.js`) uses DBus directly - this pattern should still work but verify Gio.DBusProxy usage

7. **GStreamer** (`notifier.js` line 34-35) uses `imports.gi.Gst` - verify audio playback approach for GNOME 45+

8. **Signal connections** - The pattern `subject.connect('signal', callback)` should remain compatible but verify destroy/disconnect patterns

## Migration Strategy Recommendation

1. **Phase 1**: Update entry points (extension.js, prefs.js) to new class-based structure
2. **Phase 2**: Convert all `imports.*` to ES module imports
3. **Phase 3**: Update ExtensionUtils usage patterns
4. **Phase 4**: Test UI components (indicator, menus, menuitem)
5. **Phase 5**: Test system integration (notifier, inhibitor, keyboard_shortcuts)
6. **Phase 6**: Test utilities (settings, storage, logger)
