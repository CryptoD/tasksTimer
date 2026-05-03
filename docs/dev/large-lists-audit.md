# Large lists UX audit (Task 48)

**Scope:** Identify every **long-lived / multi-entry** timer or preset surface and record whether lists are fed by paginated APIs, explicitly virtualized, or something else appropriate for desktop scale.

This repository is **not** a web SPA with REST collections: timer data loads from **memory + JSON/XDG**, or **GSettings** (GNOME Shell). There are **no** `fetch('/tasks?page=)`-style backends in-tree, so **“pagination from API” is N/A**.

---

## Copy-paste: PR checklist (Task 48)

Use this block in PR descriptions whenever this audit is updated.

```
### Task 48 — Large lists UX audit

API pagination: N/A (no HTTP task/project lists).

| View / surface | API pagination | Virtualization / equivalent | Decision / rationale |
|----------------|---------------|-----------------------------|-----------------------|
| Standalone GTK — main `TimerMenuWidget` (Running / Quick / Preset sections) | N/A — local model | GTK `ListBox` + `ScrolledWindow`; all rows instantiated from in-memory timers | Accepted for bounded local UX; revisit if synced remote catalogs appear |
| Standalone GTK — sidebar quick/preset sections (`GtkPlatform._buildSidebarSection`) | N/A — local model | Same as above (`ListBox` + `ScrolledWindow`) | Same |
| Standalone GTK — quick preset chips (`Gtk.FlowBox` quick timer presets area) | N/A — definitions from settings JSON | Dense button grid — no scroll splitter in frame; bounded preset count expected | Rarely large; if preset lists grow materially, reconsider layout + scroll container |
| Standalone GTK — **Manage presets** dialog (`preset_management_window.js`) | N/A — presets from JSON | `ListBox` + `ScrolledWindow`, full `_refreshList` rebuild | Accepted for bounded local presets |
| GNOME Shell — panel popup (`PanelMenuBuilder`, `menus.js`) | N/A — timers in-memory | Popup menu with one menu row per timer; rebuilt on menu open | Shell scroll/stack behavior only; revisit if roster size explodes |

- [ ] Table above verified against current UI code paths.
- [ ] Any new multi-row view documented in this file before merge.
```

---

## Details (references)

### Standalone GTK — `TimerMenuWidget`

- File: [`platform/standalone/timer_menu_widget.js`](../../platform/standalone/timer_menu_widget.js)
- Three `Gtk.ListBox` instances embedded in vertical `Gtk.ScrolledWindow`s (running / quick / preset headers).
- List contents are synced from `Timer`/`TimersCore` collections in JS; `_refresh`/rebuild clears children and attaches `TimerListItem` rows (**full materialisation**).

### Standalone GTK — sidebar lists + preset flow

- File: [`platform/standalone/gtk_platform.js`](../../platform/standalone/gtk_platform.js)
- `_buildSidebarSection` binds `Gtk.ListBox` + `ScrolledWindow` for quick timers and presets (same strategy as above).
- “Quick timer presets” uses `Gtk.FlowBox`; each `_getQuickTimerDefs()` entry renders a button.

### Standalone GTK — preset management dialog

- File: [`platform/standalone/preset_management_window.js`](../../platform/standalone/preset_management_window.js)
- `Gtk.ListBox` + `Gtk.ScrolledWindow`; `_refreshList` removes/adds rows for every persisted preset (**full materialisation**).

### GNOME Shell extension — panel menu

- File: [`taskTimer@CryptoD/menus.js`](../../taskTimer@CryptoD/menus.js)
- `PanelMenuBuilder.build()` walks `timers.sort_by_running()`, `KitchenTimerQuickItem`, and nested submenu sections (`KitchenTimerMenuItem`, etc.).
- Every menu reopen **re-builds menu items synchronously**. No paging and no recycler.

---

## Guidance if requirements change

Introduce API-backed “projects/tasks” catalogs or materially larger local stores:

| Need | Typical approach |
|------|------------------|
| Remote pages | Prefer server-driven pagination (`limit`/`cursor`) plus explicit “Load more”; document contract in [`docs/api/pagination-contract.md`](../api/pagination-contract.md). |
| Huge homogeneous lists locally | Migrate list UI to **`Gtk.TreeView`/model** or (**GTK 4**) `Gtk.ListView` with list models that implement incremental loading/virtualisation patterns; or cap visible rows behind search/filter UX. |

Update this checklist + the PR snippet whenever surfaces change.
