# Contributing to taskTimer

Thanks for your interest in improving taskTimer. This project welcomes bug reports, feature ideas, documentation fixes, and code contributions.

## License

By contributing, you agree that your contributions will be licensed under the same terms as the project: **GNU General Public License v3.0** (see [LICENSE](LICENSE)).

## Before you start

- **Standalone GTK app** (`gjs main.js`) and the **GNOME Shell extension** (`taskTimer@CryptoD`) share core logic but have different UIs and settings backends. Say which surface you use when reporting issues or opening PRs.
- **[BUILD.md](BUILD.md)** is the detailed reference for dependencies, `make` targets, tests, AppImage, and packaging.

## Reporting issues

Use [GitHub Issues](https://github.com/CryptoD/taskTimer/issues). Choose the **Bug report** or **Feature request** template when it fits.

For bugs, include:

- **What you did** and **what happened** (steps to reproduce if possible).
- **Environment:** Linux distro (and version if relevant), desktop (GNOME, KDE, Xfce, …), and whether you run **standalone** or the **Shell extension**.
- **Version:** output of `gjs main.js --version` for standalone, or extension version from **Extensions** / metadata.

Security-sensitive reports should not use public issues if you believe disclosure could harm users; contact the maintainers through a private channel if one is listed on the repository.

### Beta testing

Pre-release **AppImages** are published as GitHub **Pre-releases** when maintainers push tags such as `v1.2-beta.1`. If you are trying a beta build, mention the **tag or version** in your issue. Maintainer-facing steps (inviting testers, iteration, moving to stable) live in **`tests/TEST14-beta-coordination.md`**.

## Development setup

From the repository root:

```bash
git clone https://github.com/CryptoD/taskTimer.git
cd taskTimer
bin/check-deps.sh
```

Install missing packages as described in [BUILD.md](BUILD.md). For day-to-day work you typically need at least:

```bash
bin/check-deps.sh --runtime   # gjs, GTK 3, GStreamer imports
```

## Running tests and lint

Before opening a PR, run the same checks as CI:

```bash
npm ci
npm run lint
npm run test:e2e
make lint
make test
```

(`npm run test:e2e` is optional locally; it runs Playwright + MSW — see `e2e/README.md`. It does not test the GTK application.)

CI uses `xvfb-run` and `dbus-run-session` for headless runs; locally, plain `make test` is usually enough. For a fuller local release-style pass, see `make test12` in [BUILD.md](BUILD.md).

## Pull requests

- **Keep changes focused** on one concern when possible (easier review and safer merges).
- **Describe the behavior** you changed or added; link related issues with `Fixes #123` or `Refs #123` when applicable.
- **Match existing style** in the files you touch (naming, imports, formatting).
- **Translations:** if you change user-visible strings, update or add entries in `taskTimer@CryptoD/po/` as appropriate and run `make mo` / follow [BUILD.md](BUILD.md) for gettext workflow.

Maintainers may ask for small follow-ups or tests; collaborative iteration is normal.

## Documentation

User-facing docs live in [README.md](README.md), [BUILD.md](BUILD.md), and [CHANGELOG.md](CHANGELOG.md). Design notes and test plans may live under `doc/` and `tests/`.
