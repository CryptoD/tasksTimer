# GNOME Shell-Specific Imports Audit

## Executive Summary

This document provides a comprehensive audit of all GNOME Shell-specific imports across the taskTimer extension codebase. These imports are **critical migration points** for GNOME 45+ compatibility.

**Total GNOME Shell-specific imports found: 45**

---

## imports.misc (13 occurrences)

### imports.misc.extensionUtils (12 occurrences)

| File | Line | Usage Pattern | Migration Priority |
|------|------|---------------|-------------------|
| `extension.js:26` | `const ExtensionUtils = imports.misc.extensionUtils;` | Get extension context | **Critical** |
| `indicator.js:24` | `const ExtensionUtils = imports.misc.extensionUtils;` | Get extension context | **Critical** |
| `menus.js:29` | `const ExtensionUtils = imports.misc.extensionUtils;` | Get extension context | **Critical** |
| `menuitem.js:24` | `const ExtensionUtils = imports.misc.extensionUtils;` | Get extension context | **Critical** |
| `timers.js:22` | `const ExtensionUtils = imports.misc.extensionUtils;` | Get extension context | **Critical** |
| `notifier.js:24` | `const ExtensionUtils = imports.misc.extensionUtils;` | Get extension context | **Critical** |
| `inhibitor.js:20` | `const ExtensionUtils = imports.misc.extensionUtils;` | Get extension context | **High** |
| `keyboard_shortcuts.js:24` | `const ExtensionUtils = imports.misc.extensionUtils;` | Get extension context | **Critical** |
| `progress_icon.js:14` | `const Me = imports.misc.extensionUtils.getCurrentExtension();` | Direct Me assignment | **Medium** |
| `settings.js:25` | `const ExtensionUtils = imports.misc.extensionUtils;` | Get extension context | **High** |
| `prefs.js:28` | `const ExtensionUtils = imports.misc.extensionUtils;` | Get extension context | **Critical** |
| `alarm_timer.js:21` | `const ExtensionUtils = imports.misc.extensionUtils;` | Get extension context | **Medium** |

**Common usage patterns:**
```javascript
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
// OR
const Me = imports.misc.extensionUtils.getCurrentExtension();
```

**GNOME 45+ Migration:**
- Extension metadata accessed via `Extension.metadata` instead of `Me.metadata`
- Settings accessed via `Extension.getSettings()` instead of `ExtensionUtils.getSettings()`
- Path info via `Extension.path` or `Extension.dir`

### imports.misc.params (1 occurrence)

| File | Line | Usage Pattern | Migration Priority |
|------|------|---------------|-------------------|
| `notifier.js:23` | `const Params = imports.misc.params;` | Parameter parsing | **Medium** |

**Usage:**
```javascript
const Params = imports.misc.params;
// Used for: Params.parse(params, defaults)
```

**GNOME 45+ Migration:**
- `imports.misc.params` may be removed; implement custom parameter parsing or use Object.assign()

---

## imports.ui (18 occurrences)

### imports.ui.main (7 occurrences)

| File | Line | Usage | Migration Priority |
|------|------|-------|-------------------|
| `extension.js:40` | `const Main = imports.ui.main;` | Panel status area | **Critical** |
| `indicator.js:34` | `const Main = imports.ui.main;` | (imported, may use) | **Critical** |
| `menus.js:26` | `const Main = imports.ui.main;` | (imported, may use) | **Critical** |
| `timers.js:26` | `const Main = imports.ui.main;` | Message source, notifications | **Critical** |
| `notifier.js:28` | `const Main = imports.ui.main;` | Message tray access | **Critical** |
| `keyboard_shortcuts.js:22` | `const Main = imports.ui.main` | Window manager keybinding | **Critical** |

**Common usage patterns:**
```javascript
// Adding indicator to panel
Main.panel.addToStatusArea(uuid, indicator);

// Message tray for notifications
Main.messageTray.add(source);

// Window manager for keybindings
Main.wm.allowKeybinding(name, Shell.ActionMode.ALL);
```

**GNOME 45+ Migration:**
```javascript
// New import path
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
```

### imports.ui.panelMenu (2 occurrences)

| File | Line | Usage | Migration Priority |
|------|------|-------|-------------------|
| `extension.js:41` | `const PanelMenu = imports.ui.panelMenu;` | Button base class | **Critical** |
| `indicator.js:35` | `const PanelMenu = imports.ui.panelMenu;` | KitchenTimerIndicator extends | **Critical** |

**Usage:**
```javascript
class KitchenTimerIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('taskTimer'));
    }
}
```

**GNOME 45+ Migration:**
```javascript
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
```

### imports.ui.popupMenu (7 occurrences)

| File | Line | Usage | Migration Priority |
|------|------|-------|-------------------|
| `extension.js:42` | `const PopupMenu = imports.ui.popupMenu;` | Menu items | **Critical** |
| `indicator.js:36` | `const PopupMenu = imports.ui.popupMenu;` | Menu items | **Critical** |
| `menus.js:25` | `const PopupMenu = imports.ui.popupMenu;` | Menu building | **Critical** |
| `menuitem.js:21` | `const PopupMenu = imports.ui.popupMenu;` | Menu item classes | **Critical** |
| `timers.js:27` | `const PopupMenu = imports.ui.popupMenu;` | (imported) | **Critical** |
| `notifier.js:31` | `const PopupMenu = imports.ui.popupMenu;` | (imported, may use) | **Critical** |

**Common usage patterns:**
```javascript
// Menu items
new PopupMenu.PopupMenuItem(_("Running timers"), { reactive: false });
new PopupMenu.PopupSeparatorMenuItem();
new PopupMenu.PopupSwitchMenuItem(text, on);
new PopupMenu.PopupSubMenuMenuItem(text);
new PopupMenu.PopupImageMenuItem(text, icon);

// Base class for custom items
class KitchenTimerMenuItem extends PopupMenu.PopupMenuItem {}
class KitchenTimerCreatePreset extends PopupMenu.PopupSubMenuMenuItem {}
```

**GNOME 45+ Migration:**
```javascript
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
```

### imports.ui.messageTray (1 occurrence)

| File | Line | Usage | Migration Priority |
|------|------|-------|-------------------|
| `notifier.js:29` | `const MessageTray = imports.ui.messageTray;` | Notifications | **Critical** |

**Usage:**
```javascript
const MessageTray = imports.ui.messageTray;
const NotificationDestroyedReason = MessageTray.NotificationDestroyedReason;

// Creating notification source
var source = new MessageTray.Source("Task Timer", null);
Main.messageTray.add(source);

// Creating notification
var notifier = new MessageTray.Notification(source, title, banner, params);
```

**GNOME 45+ Migration:**
```javascript
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
```

### imports.ui.slider (2 occurrences)

| File | Line | Usage | Migration Priority |
|------|------|-------|-------------------|
| `menus.js:27` | `const Slider = imports.ui.slider;` | Time sliders | **Critical** |
| `menuitem.js:22` | `const Slider = imports.ui.slider;` | Time sliders | **Critical** |

**Usage:**
```javascript
this._slider = new Slider.Slider(min, {x_expand: true, y_expand:true});
this._slider.connect('notify::value', callback);
```

**GNOME 45+ Migration:**
```javascript
import * as Slider from 'resource:///org/gnome/shell/ui/slider.js';
```

### imports.ui.status.volume (1 occurrence)

| File | Line | Usage | Migration Priority |
|------|------|-------|-------------------|
| `timers.js:64` | `const mixerControl = imports.ui.status.volume.getMixerControl();` | Volume control | **High** |

**Usage:**
```javascript
const mixerControl = imports.ui.status.volume.getMixerControl();
// Used for checking audio volume level before playing alarm
```

**GNOME 45+ Migration:**
- Path may change to `resource:///org/gnome/shell/ui/status/volume.js`
- API may have changed; verify `getMixerControl()` still exists

---

## Other GNOME Shell Imports

### imports.format (2 occurrences)

| File | Line | Usage | Migration Priority |
|------|------|-------|-------------------|
| `utils.js:5` | `String.prototype.format = imports.format.format;` | String formatting | **Medium** |
| `logger.js:22` | `String.prototype.format = imports.format.format;` | String formatting | **Medium** |

**Usage:**
```javascript
String.prototype.format = imports.format.format;
// Enables: "Hello %s".format("World")
```

**GNOME 45+ Migration:**
- `imports.format` removed in GNOME 45+
- Replace with template literals: `` `Hello ${name}` ``
- Or implement custom format function

### imports.lang (1 occurrence)

| File | Line | Usage | Migration Priority |
|------|------|-------|-------------------|
| `keyboard_shortcuts.js:19` | `const Lang = imports.lang` | Language utilities | **High** |

**Usage:**
```javascript
const Lang = imports.lang
// Note: Not actually used in the file - can be removed
```

**GNOME 45+ Migration:**
- `imports.lang` deprecated and removed in GNOME 45+
- Remove unused import

### imports.byteArray (2 occurrences)

| File | Line | Usage | Migration Priority |
|------|------|-------|-------------------|
| `utils.js:8` | `const ByteArray = imports.byteArray;` | Byte array conversion | **Medium** |
| `prefs.js:22` | `const ByteArray = imports.byteArray;` | Byte array conversion | **Medium** |

**Usage:**
```javascript
const ByteArray = imports.byteArray;
// Used in: ByteArray.toString(data)
```

**GNOME 45+ Migration:**
- `imports.byteArray` removed in GNOME 45+
- Use `TextDecoder` instead: `new TextDecoder().decode(uint8Array)`

### imports.gettext (9 occurrences)

| File | Lines | Usage | Migration Priority |
|------|-------|-------|-------------------|
| `extension.js:30` | `const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);` | i18n | **Critical** |
| `indicator.js:19` | `const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);` | i18n | **Critical** |
| `menus.js:20` | `const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);` | i18n | **Critical** |
| `timers.js:19` | `const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);` | i18n | **Critical** |
| `notifier.js:20` | `const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);` | i18n | **Critical** |
| `progress_icon.js:12` | `const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);` | i18n | **Medium** |
| `settings.js:22` | `const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);` | i18n | **High** |
| `prefs.js:25` | `const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);` | i18n | **Critical** |
| `utils.js:2` | `const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);` | i18n | **Medium** |

**Common usage pattern:**
```javascript
const GETTEXT_DOMAIN = 'tasktimer';
const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

// Usage: _("Translated string")
```

**GNOME 45+ Migration:**
```javascript
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
// _() is provided by the Extension base class in prefs
```

---

## Summary by Migration Priority

### Critical (Must fix for GNOME 45+)
- **extension.js**: `imports.misc.extensionUtils`, `imports.ui.main`, `imports.ui.panelMenu`, `imports.ui.popupMenu`, `imports.gettext`
- **indicator.js**: `imports.misc.extensionUtils`, `imports.ui.main`, `imports.ui.panelMenu`, `imports.ui.popupMenu`, `imports.gettext`
- **menus.js**: `imports.misc.extensionUtils`, `imports.ui.main`, `imports.ui.popupMenu`, `imports.ui.slider`, `imports.gettext`
- **menuitem.js**: `imports.misc.extensionUtils`, `imports.ui.popupMenu`, `imports.ui.slider`
- **timers.js**: `imports.misc.extensionUtils`, `imports.ui.main`, `imports.ui.popupMenu`, `imports.ui.status.volume`, `imports.gettext`
- **notifier.js**: `imports.misc.extensionUtils`, `imports.misc.params`, `imports.ui.main`, `imports.ui.messageTray`, `imports.ui.popupMenu`, `imports.gettext`
- **keyboard_shortcuts.js**: `imports.misc.extensionUtils`, `imports.ui.main`, `imports.lang`
- **prefs.js**: `imports.misc.extensionUtils`, `imports.byteArray`, `imports.gettext`

### High (Important functionality)
- **inhibitor.js**: `imports.misc.extensionUtils`
- **settings.js**: `imports.misc.extensionUtils`, `imports.gettext`

### Medium (Can work around)
- **progress_icon.js**: `imports.misc.extensionUtils`, `imports.gettext`
- **alarm_timer.js**: `imports.misc.extensionUtils`
- **utils.js**: `imports.format`, `imports.byteArray`, `imports.gettext`
- **logger.js**: `imports.format`

---

## Migration Path Summary

### GNOME 45+ Import Patterns

**Before (GNOME 3.x - 44):**
```javascript
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Gettext = imports.gettext.domain('tasktimer');
const _ = Gettext.gettext;
```

**After (GNOME 45+):**
```javascript
// In extension.js
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

// In other modules
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
```

### Key Changes Required

1. **Module format**: GJS modules → ES modules
2. **Extension entry point**: Function-based → Class-based
3. **Extension context**: `Me` object → `Extension` class properties
4. **String formatting**: `imports.format` → Template literals
5. **Byte arrays**: `imports.byteArray` → `TextDecoder`
6. **Gettext**: Manual domain setup → Provided by Extension class

---

## Files Not Using GNOME Shell-Specific Imports

These files only use `imports.gi` (GObject Introspection) and will work with minimal changes:

- `hms.js` - Pure JavaScript class
- `storage.js` - Only uses `imports.gi.GLib`

These are the safest modules and can be migrated first.
