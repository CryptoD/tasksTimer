# JavaScript / GJS cyclomatic complexity baseline

**Metric:** ESLint [`complexity`](https://eslint.org/docs/latest/rules/complexity) (cyclomatic complexity per function). **Scope:** same files as `npm run lint` (see `.eslintrc.cjs` `ignorePatterns`).

---

## Threshold policy

| Complexity | Policy |
|------------|--------|
| **&lt; 15** | Normal; no special justification. |
| **≥ 15** | **Must justify or split:** in a PR or commit message, briefly explain why the branching is necessary *or* refactor into smaller helpers so each function stays **below 15**. |

**Rationale:** 15 matches common ESLint defaults and the project’s historical “hot spots” (see stored list). It is a **soft gate for new work**—legacy functions may exceed it until someone touches them.

**Not enforced in CI** today (ESLint does not enable `complexity` in `.eslintrc.cjs`); reviewers and contributors use this policy manually.

---

## Stored list: top 15 (highest complexity)

Regenerate before updating this table (from repo root):

```bash
npx eslint . --rule 'complexity: ["warn", 0]' -f unix 2>&1 | node -e "
const fs=require('fs');
const t=fs.readFileSync(0,'utf8');
const r=[];
for (const line of t.split('\n')) {
  if (!line.includes('complexity of')) continue;
  const m=line.match(/^(.+?):(\d+):(\d+): (.+)$/);
  const c=m&&m[4].match(/complexity of (\d+)/);
  if (m&&c) r.push({c:+c[1], line:m[1]+':'+m[2], msg:m[4]});
}
r.sort((a,b)=>b.c-a.c);
r.slice(0,15).forEach((x,i)=>console.log((i+1)+'.',x.c,x.line,x.msg));
"
```

**Last updated:** 2026-03-29. **Wave 1 refactor** split former hotspots: [`prefs.js`](../../taskTimer@CryptoD/prefs.js) `build` (now ~7, helpers `_assemblePrefsFromBuilder`, `_wirePrefsTimerSection`, …), [`gtk_platform.js`](../../platform/standalone/gtk_platform.js) `showMainWindow` (now ~13; body in `_buildMainWindowBody`), [`timer_list_item.js`](../../platform/standalone/timer_list_item.js) `_updateStateClasses` (now ~1; helpers for row/title/secondary/progress).

| Rank | Score | Location | Function / note |
|------|------:|----------|-----------------|
| 1 | 27 | [`platform/standalone/notification_gio.js`](../../platform/standalone/notification_gio.js) `L51` | Method `notify` |
| 2 | 21 | [`platform/standalone/gtk_platform.js`](../../platform/standalone/gtk_platform.js) `L611` | Method `_saveWindowState` |
| 3 | 21 | [`platform/standalone/timer_menu_widget.js`](../../platform/standalone/timer_menu_widget.js) `L208` | Method `_startFromEntry` |
| 4 | 19 | [`main.js`](../../main.js) `L462` | Function `checkVolume` |
| 5 | 19 | [`platform/standalone/preferences_window.js`](../../platform/standalone/preferences_window.js) `L62` | Method `_buildStandalonePrefsWidget` |
| 6 | 18 | [`taskTimer@CryptoD/settings.js`](../../taskTimer@CryptoD/settings.js) `L355` | Method `import_json` |
| 7 | 17 | [`platform/standalone/gtk_platform.js`](../../platform/standalone/gtk_platform.js) `L675` | Method `updateAutostartDesktop` |
| 8 | 17 | [`taskTimer@CryptoD/audio_manager.js`](../../taskTimer@CryptoD/audio_manager.js) `L88` | Method `_buildUri` |
| 9 | 17 | [`taskTimer@CryptoD/audio_manager.js`](../../taskTimer@CryptoD/audio_manager.js) `L161` | Arrow function |
| 10 | 16 | [`main.js`](../../main.js) `L205` | Function `_applyThemeAndCss` |
| 11 | 16 | [`platform/standalone/gtk_platform.js`](../../platform/standalone/gtk_platform.js) `L975` | Arrow function |
| 12 | 16 | [`platform/standalone/timer_list_item.js`](../../platform/standalone/timer_list_item.js) `L221` | Method `_buildPopover` |
| 13 | 16 | [`taskTimer@CryptoD/indicator.js`](../../taskTimer@CryptoD/indicator.js) `L40` | Method `_init` |
| 14 | 16 | [`taskTimer@CryptoD/prefs.js`](../../taskTimer@CryptoD/prefs.js) `L78` | Constructor |
| 15 | 16 | [`taskTimer@CryptoD/timers.js`](../../taskTimer@CryptoD/timers.js) `L940` | Method `stop_callback` |

---

## Related

- Go (if added later): [`go-complexity-baseline.md`](go-complexity-baseline.md).
- Where to put extracted helpers: same file / same import root first — see **Refactoring & helpers** in [`llm-context.md`](llm-context.md).
