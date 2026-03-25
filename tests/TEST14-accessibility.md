# TEST 14: Accessibility baseline (standalone GTK)

## Implemented in code

- **`platform/standalone/gtk_a11y.js`** — helpers for Atk **name** / **description** and label–widget **mnemonics** (`Gtk.Label.set_mnemonic_widget`).
- **Main window** (`gtk_platform.js`): application window, paned layout, header **Main menu** / **New**, sidebar lists, quick start fields (**_Name**, **_Minutes**, **_Seconds** + accessible names), preset buttons, icon-only toolbar buttons (name = tooltip text), banners (**Dismiss**), bottom actions.
- **New timer dialog** (`main.js`): dialog name, same mnemonic grid as quick start.
- **Timer lists** (`timer_menu_widget.js`, `timer_list_item.js`): quick entry, list names, bottom bar, row names (`Name — status`), **Timer actions** (⋯) menu button.
- **Preferences** (`preferences_window.js`): notebook region, **Alt+** mnemonics on major rows (**_Theme**, **_Enable notifications**, etc.), combo/spin names where helpful.
- **Preset management** (`preset_management_window.js`): window and list names; edit dialog uses **_Name** / **_Minutes** / **_Seconds**.

## Manual verification (Orca / NVDA on X11, or Orca on Wayland)

1. Enable a screen reader and open `gjs main.js`.
2. **Tab** through the header → sidebar → main area; focus order should follow visual layout without trapping (except inside dialogs, use Esc).
3. Confirm controls are announced with **names** (not only “button” / “image”).
4. In **Preferences**, press **Alt+T** (or the underlined letter) to jump to **Theme**; repeat for other rows with mnemonics.
5. In **Manage preset timers**, open **Add** / **Edit** and verify **Name** / **Minutes** / **Seconds** labels activate the correct fields.

## Limits (reasonable baseline)

- GNOME Shell **extension** UI (`prefs.js` / `.ui`) is unchanged in this pass; GTK standalone is the focus.
- Full WCAG audit, high-contrast themes, and every string translated are out of scope here.
