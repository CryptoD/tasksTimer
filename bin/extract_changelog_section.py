#!/usr/bin/env python3
"""
Extract the body of a single ## [version] section from CHANGELOG.md (Keep a Changelog style).
Used by CI to populate GitHub Release notes. Version should match version.json (no leading v).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHANGELOG = ROOT / "CHANGELOG.md"


def extract_section(text: str, version: str) -> str | None:
    ver = version.strip().lstrip("v")
    if not ver:
        return None
    # ## [1.1] — 2026-03-21  or  ## [1.1]
    header = re.compile(
        rf"^## \[{re.escape(ver)}\]\s*(?:—[^\n]*)?\s*$",
        re.MULTILINE,
    )
    m = header.search(text)
    if not m:
        return None
    start = m.end()
    rest = text[start:]
    next_h2 = re.search(r"^## ", rest, re.MULTILINE)
    section = rest[: next_h2.start()] if next_h2 else rest
    return section.strip()


def main() -> int:
    argv = sys.argv[1:]
    if not argv or argv[0] in ("-h", "--help"):
        print(
            f"Usage: {Path(sys.argv[0]).name} <version> [CHANGELOG.md]",
            file=sys.stderr,
        )
        return 0 if argv and argv[0] in ("-h", "--help") else 1
    version = argv[0]
    path = Path(argv[1]) if len(argv) > 1 else CHANGELOG
    if not path.is_file():
        print(f"extract_changelog_section: missing {path}", file=sys.stderr)
        return 1
    text = path.read_text(encoding="utf-8")
    section = extract_section(text, version)
    if section is None:
        print(
            f"extract_changelog_section: no ## [{version.lstrip('v')}] section in {path}",
            file=sys.stderr,
        )
        return 1
    print(section)
    return 0


if __name__ == "__main__":
    sys.exit(main())
