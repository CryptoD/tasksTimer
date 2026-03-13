## taskTimer JSON export format

This document describes the JSON structure used by taskTimer for
importing and exporting settings and timers. The **same format** is
used by both:

- the GNOME Shell extension, and
- the standalone GTK application (via the JSON settings provider).

### Top-level object

An exported file is a single JSON object with these fields:

- `accel_enable` (boolean)
- `accel_show_endtime` (string)
- `accel_stop_next` (string)
- `debug` (boolean)
- `detect_dupes` (boolean)
- `inhibit` (number, integer)
- `inhibit_max` (number, integer)
- `notification_sticky` (boolean)
- `notification` (boolean)
- `notification_longtimeout` (number, integer)
- `play_sound` (boolean)
- `prefer_presets` (number, integer)
- `save_quick_timers` (boolean)
- `show_endtime` (boolean)
- `show_label` (boolean)
- `show_progress` (boolean)
- `show_time` (boolean)
- `sort_by_duration` (boolean)
- `sort_descending` (boolean)
- `sound_file` (string, absolute or relative path)
- `sound_loops` (number, integer)
- `volume_level_warn` (boolean)
- `volume_threshold` (number, integer)
- `quick_timers` (array of timer objects, see below)
- `timers` (array of timer objects, see below)

### Timer objects

Each entry in `timers` or `quick_timers` is an object with:

- `name` (string) – human-friendly label
- `id` (string) – UUID or stable identifier
- `duration` (number, integer seconds) – timer length
- `enabled` (boolean) – whether the timer is active
- `quick` (boolean) – `true` for quick timers, `false` for presets

Notes:

- In `timers` (preset timers), `quick` is always `false`.
- In `quick_timers`, `quick` is always `true`.

### Example

```json
{
  "accel_enable": true,
  "accel_show_endtime": "<Control>e",
  "accel_stop_next": "",
  "debug": false,
  "detect_dupes": true,
  "inhibit": 0,
  "inhibit_max": 0,
  "notification_sticky": false,
  "notification": true,
  "notification_longtimeout": 120,
  "play_sound": true,
  "prefer_presets": 0,
  "save_quick_timers": true,
  "show_endtime": true,
  "show_label": true,
  "show_progress": true,
  "show_time": true,
  "sort_by_duration": true,
  "sort_descending": false,
  "sound_file": "tasktimer-default.ogg",
  "sound_loops": 2,
  "volume_level_warn": false,
  "volume_threshold": 30,
  "quick_timers": [
    {
      "name": "Tea",
      "id": "7a4d2c1a-...",
      "duration": 180,
      "enabled": true,
      "quick": true
    }
  ],
  "timers": [
    {
      "name": "Pasta",
      "id": "d9f0a1b2-...",
      "duration": 600,
      "enabled": true,
      "quick": false
    }
  ]
}
```

### Compatibility rules

- **Export**: `Settings.export_json()` always writes using the structure
  above, regardless of whether the backing store is GSettings or the
  JSON provider.
- **Import**: `Settings.import_json()` accepts exactly this layout and
  maps keys to the underlying config provider:
  - `timers` → `pack_preset_timers()`
  - `quick_timers` → `pack_quick_timers()`
  - all scalar keys are stored via the same `_setBoolean` / `_setInt`
    / `_setString` helpers used by both the extension and standalone.

As a result, a JSON file exported from the extension can be imported
into the standalone app, and vice versa, without any transformation.

