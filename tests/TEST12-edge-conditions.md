# TEST 12: Edge conditions (graceful degradation)

Automated scenarios live in `tests/test12_edge_conditions.js` (run from repo root):

```bash
gjs tests/test12_edge_conditions.js
```

**Pass:** prints `TEST 12 edge conditions: pass` and exit code 0.

## What automation covers

| Condition | Mechanism | Expected behavior |
|-----------|-----------|-------------------|
| Missing `config.json` | Fresh `XDG_CONFIG_HOME` without `tasktimer/config.json` | Log: `no configuration file …; using defaults`; defaults load. |
| Corrupt `config.json` | Invalid JSON on disk | Log: `invalid or unreadable configuration …; using defaults`; defaults load. |
| Read-only config directory | `chmod 555` on `tasktimer` after creating `config.json` | Log: `failed to write config file … (read-only…)`; on-disk file unchanged. |
| No notification daemon | `GioNotificationProvider` with `send_notification` throwing | Log: `send_notification failed …`; in-app fallback runs when configured. |
| Missing `timers.json` | `loadJSON` on nonexistent path | Returns `null`; app uses empty state. |
| Corrupt `timers.json` | Invalid JSON file | Log: `failed to load JSON …; treating as empty`; returns `null`. |

## Manual checks (graphical / system)

### No usable audio output

1. Run `gjs main.js` on a VM with **no sound card** (or pipewire/pulse stopped), or set a broken sink if you know your stack.
2. Enable alarm sound in preferences, start a short timer.
3. **Pass:** On completion, logs include a **GStreamer ERROR** line such as `no output device, missing codec, or broken pipeline` (or similar); the app does **not** spin in a tight replay loop; notifications/UI still work.

### No notification daemon

1. In a minimal session without a notification service, or force fallback:  
   `TASKTIMER_FORCE_INAPP_NOTIFICATIONS=1 gjs main.js`
2. Trigger **Send test notification** or a timer completion.
3. **Pass:** Log mentions **in-app fallback** (or `TASKTIMER_FORCE_INAPP_NOTIFICATIONS` path); banner appears in-window when fallback is used.

### Read-only config (user-visible)

1. Same as automation but run `gjs main.js` with `XDG_CONFIG_HOME` pointing at a tree where `tasktimer/` is read-only after first save.
2. **Pass:** App starts; preference changes that persist may log write failures; no uncaught exception.

### Missing files (sanity)

1. Delete `~/.config/tasktimer/config.json` while the app is **not** running; start the app.
2. **Pass:** First log line about missing config (see automation); UI shows defaults.

## Related code

- `config.js` — load/save logging.
- `context.js` — directory creation errors.
- `taskTimer@CryptoD/storage.js` — timer JSON I/O messages.
- `platform/standalone/notification_gio.js` — `send_notification` errors and fallback.
- `taskTimer@CryptoD/audio_manager.js` — GStreamer **ERROR** bus handling (no infinite retry).
