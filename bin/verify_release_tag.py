#!/usr/bin/env python3
"""
Ensure the pushed git tag matches version.json (after stripping a leading v).
Intended for release CI: avoids publishing builds when the tag and repo version disagree.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION_JSON = ROOT / "version.json"


def tag_from_env_or_argv() -> str | None:
    ref = os.environ.get("GITHUB_REF", "").strip()
    if ref.startswith("refs/tags/"):
        return ref[len("refs/tags/") :]
    if len(sys.argv) > 1:
        return sys.argv[1].strip()
    return None


def main() -> int:
    tag = tag_from_env_or_argv()
    if not tag:
        print(
            "verify_release_tag: set GITHUB_REF=refs/tags/<tag> or pass <tag> as argument",
            file=sys.stderr,
        )
        return 1
    if not VERSION_JSON.is_file():
        print(f"verify_release_tag: missing {VERSION_JSON}", file=sys.stderr)
        return 1
    data = json.loads(VERSION_JSON.read_text(encoding="utf-8"))
    ver = str(data.get("version", "")).strip()
    if not ver:
        print("verify_release_tag: empty version in version.json", file=sys.stderr)
        return 1
    normalized = tag.lstrip("v")
    if normalized != ver:
        print(
            f"verify_release_tag: tag {tag!r} (compare as {normalized!r}) "
            f"does not match version.json version {ver!r}",
            file=sys.stderr,
        )
        return 1
    print(f"verify_release_tag: OK — tag {tag!r} matches version.json {ver!r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
