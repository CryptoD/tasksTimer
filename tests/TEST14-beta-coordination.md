# TEST 14: Beta coordination (AppImages, feedback, stable release)

This document ties **beta testing** to **TEST 14** (accessibility baseline for the standalone GTK app). Use it to publish **beta AppImages**, recruit **testers on real systems**, collect **feedback and bug reports**, and **iterate** before a **stable** GitHub Release.

**Related:** [TEST14-accessibility.md](TEST14-accessibility.md) (what to verify), [BUILD.md](../BUILD.md) (builds), [CHANGELOG.md](../CHANGELOG.md) (release notes).

---

## Goals

1. **Real-world coverage** — Exercise the AppImage on several distros and desktops (GNOME, KDE, Xfce, etc.), not only CI.
2. **TEST 14 accessibility** — Screen reader / keyboard flows from [TEST14-accessibility.md](TEST14-accessibility.md) where testers can run them (Orca on Linux; NVDA on X11 if applicable).
3. **Regression signal** — Catch packaging, tray, notifications, audio, and prefs issues before a stable tag.
4. **Clear feedback loop** — Structured issues, triage, fixes, and follow-up beta builds until criteria for stable are met.

---

## For maintainers: publish a beta AppImage

Betas are **normal git tags** whose names signal a pre-release (for example `v1.2-beta.1`). The same **Release** workflow (`.github/workflows/release.yml`) builds the AppImage and uploads assets; GitHub marks the release as a **pre-release** when the tag contains `-beta`, `-rc`, or `-alpha`.

### Checklist before tagging

1. Set **`version.json`** to the exact version string you will ship (e.g. `1.2-beta.1`). Run **`make sync-version`** so metadata and AppStream stay aligned.
2. Add a **`CHANGELOG.md`** section **`## [1.2-beta.1] — YYYY-MM-DD`** with **what testers should focus on** (TEST 14, known limitations, how long the beta is expected to run).
3. Commit and push to `main` (or your release branch).
4. Tag and push (annotated tag recommended):

   ```bash
   git tag -a v1.2-beta.1 -m "taskTimer 1.2 beta 1"
   git push origin v1.2-beta.1
   ```

5. Confirm **Actions → Release** succeeds and that the new **Releases** entry shows **Pre-release** and lists the `.AppImage` and `SHA256SUMS`.

**Convention:** Prefer tags like `v1.2-beta.1`, `v1.2-rc.1`. The tag must **match `version.json`** after stripping a leading `v` (same rule as stable releases).

---

## Inviting testers

- Post the **GitHub Release** link (pre-release) in channels you use (Mastodon, Matrix, project README “beta” note, personal blog, etc.).
- Keep the ask short: **what to download**, **chmod +x**, **rough time commitment**, and **what feedback helps** (see below).
- Encourage diversity: **different distros**, **Wayland vs X11**, **with/without screen reader**.

### What to tell testers (copy-paste friendly)

- Install nothing system-wide: download the **AppImage** from the **pre-release** page, `chmod +x *.AppImage`, run it.
- Note **distro + version**, **desktop** (GNOME/KDE/…), **Wayland or X11**, and **taskTimer version** (About dialog or filename).
- If they can: follow the **TEST 14** checklist in [TEST14-accessibility.md](TEST14-accessibility.md) (screen reader / mnemonics).
- Report problems via **GitHub Issues** → **Bug report**, and mention **beta version** and **pre-release tag** in the description.

---

## Collecting feedback and bug reports

- **Primary channel:** [GitHub Issues](https://github.com/CryptoD/taskTimer/issues) using the **Bug report** template.
- Ask testers to include **product** (standalone AppImage), **version**, **OS**, and **desktop** — the template already prompts for this.
- Optionally add a **`beta`** label on the repository for beta-only issues (create the label once; automation is optional).
- **Triaging:** Reproduce when possible, distinguish **AppImage-specific** vs **general** bugs, link issues in the beta’s CHANGELOG section or a short tracking comment on the Release.

---

## Iteration loop

1. Ship **beta N** (tag, CI, pre-release).
2. Gather issues and **prioritize** (blockers vs nice-to-haves).
3. Fix on a branch, merge, update **`version.json`** / **CHANGELOG** for **beta N+1** or a **hotfix beta**.
4. Tag again and publish; link the new pre-release from the previous one if helpful.
5. Repeat until exit criteria are satisfied.

---

## Moving to a stable release

When you are ready for **stable**:

1. Resolve or explicitly defer **blocker** bugs.
2. Set **`version.json`** to the stable number (e.g. `1.2`), run **`make sync-version`**.
3. Add **`## [1.2] — YYYY-MM-DD`** in **CHANGELOG.md** (final notes; can summarize beta feedback).
4. Tag **`v1.2`** (no `-beta` / `-rc` / `-alpha` in the tag name so the workflow creates a **full** release, not a pre-release).
5. Announce the stable release; optionally keep the last beta pre-release **unlisted** or leave it for history.

Stable releases still require a matching **`## [x.y]`** section in **CHANGELOG.md** for automated release notes.

---

## Exit criteria (suggested)

Use these as a team checklist; adjust per cycle.

- [ ] TEST 14 manual steps **verified** on at least one **Wayland** and one **X11** session where feasible, or limitations documented.
- [ ] No **known crash-on-start** or **data-loss** issues open for this version line.
- [ ] **CHANGELOG** and user-facing docs updated for stable.
- [ ] CI green on **`main`** at the stable tag.

---

## Limits

- **Extension-only** UI is out of scope for TEST 14 accessibility (see [TEST14-accessibility.md](TEST14-accessibility.md)); beta feedback can still cover extension bugs, but file them clearly as **extension** vs **standalone**.
- **Translation** completeness and a full WCAG audit are **not** required for TEST 14 beta exit.
