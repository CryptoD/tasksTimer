# TEST 13: Performance and leak smoke

## Automated (throttled disk writes)

Many concurrent running timers used to each trigger `timers.json` writes during the same short wall-clock window (`now % 30000 < interval`), multiplying I/O by **N** and hurting timer smoothness under load. Saving is now **global throttled** on `TimersCore` / `Timers` (once per 30s while ticks run; start/stop paths still save immediately).

```bash
gjs tests/test13_performance_throttle.js
```

**Pass:** `TEST 13 performance throttle: pass`

## Manual: extended run + CPU / memory

1. Start the standalone app: `gjs main.js`.
2. Create **many** presets or quick timers (e.g. 30–50) and start **as many as practical** with multi-hour durations so they stay running.
3. Let the session run **30+ minutes** while you use the machine normally.
4. In another terminal, sample the process (replace `PID`):

   ```bash
   while kill -0 PID 2>/dev/null; do
     grep ^VmRSS: /proc/PID/status
     sleep 30
   done
   ```

5. **Pass criteria (basic):**
   - **RSS** does not grow without bound (slow creep over hours may still warrant profiling; a steep climb with a stable timer count is suspicious).
   - **CPU** from `taskTimer` stays negligible between UI/tray ticks (no busy loop).
   - **Displayed remaining time** stays plausible vs wall clock (no large drift from I/O stalls).

## Manual: load

Optional: run CPU stress in the background (`stress-ng --cpu 4` or similar) while timers run; completion times should remain within a few seconds of expected (same as TEST 13 intent: no pathological save storms).

## Related code

- `taskTimer@CryptoD/timers_core.js` — `maybePeriodicSaveTimersFile`, `PERIODIC_TIMERS_FILE_SAVE_MS`
- `taskTimer@CryptoD/timers.js` — `maybePeriodicSaveTimersJson`
- `platform/standalone/gtk_platform.js` — UI refresh every 5s, tray every 1s (fixed cost, not scaled by preset count the same way disk was)
