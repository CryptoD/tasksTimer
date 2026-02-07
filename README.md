# taskTimer

## Description
 taskTimer is a forked and rebranded version of the original Kitchen Timer project. The extension is now presented to users as "taskTimer" throughout the UI and documentation. This fork introduces updates and improvements while adhering to the same core principles.

## Features
- Timer functionality for tasks
- Customizable settings
- Theme customization (Light, Dark, Default)
- Menu width customization

## Installation (for GNOME Shell users)
1. Copy the extension folder to your local extensions directory:
   - mkdir -p ~/.local/share/gnome-shell/extensions
   - cp -r taskTimer@CryptoD ~/.local/share/gnome-shell/extensions/
2. Compile the GSettings schema (the extension includes a helper script):
   - bash ~/.local/share/gnome-shell/extensions/taskTimer@CryptoD/bin/compile_schemas.sh
3. (Optional) Compile translations if you maintain them:
   - msgfmt -o ~/.local/share/gnome-shell/extensions/taskTimer@CryptoD/locale/<lang>/LC_MESSAGES/tasktimer.mo taskTimer@CryptoD/po/<lang>.po
4. Restart GNOME Shell (Alt+F2, r, Enter) or logout/login for changes to take effect.

Alternative: package and upload to extensions.gnome.org following their packaging guidelines (ensure the UUID in metadata.json is unique and matches the directory/package name).

## Implementation details

Theme customization is handled via the `theme-variant` and `menu-max-width` GSettings keys.

### Themes
The indicator's menu actor is assigned classes `kitchentimer-dark-theme` or `kitchentimer-light-theme` based on the user's choice. These classes are defined in `stylesheet.css`.

- `default`: No additional class is applied, following the system shell theme.
- `dark`: Applies a dark background and light text.
- `light`: Applies a light background and dark text.

### Menu Width
The max-width of the menu is set dynamically on the menu's actor using the inline style property `max-width`.

### Settings
Settings are managed in `prefs.js` and defined in `settings40.ui`. These settings are bound to the GSettings keys, ensuring changes are saved and applied in real-time.

## Notes
- The gettext domain is `tasktimer` and schemas are under org.gnome.shell.extensions.kitchen-timer-blackjackshellac (no functional change to schema id unless you choose to rename it).
- If you change the schemas id or gettext domain, be sure to update translations and metadata appropriately.

## License
See the LICENSE file for license details.

## Contributing
Contributions are welcome. Please review the LICENSE file before contributing.
