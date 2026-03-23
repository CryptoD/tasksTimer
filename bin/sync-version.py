#!/usr/bin/env python3
"""
Propagate version.json → taskTimer@CryptoD/metadata.json and AppStream metainfo.
Edit version.json only; run this script (or: make sync-version) before release commits.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERSION_JSON = ROOT / "version.json"
METADATA_JSON = ROOT / "taskTimer@CryptoD" / "metadata.json"
APPSTREAM_XML = (
    ROOT
    / "packaging"
    / "appimage"
    / "AppDir"
    / "usr"
    / "share"
    / "metainfo"
    / "com.github.cryptod.tasktimer.appdata.xml"
)


def _coerce_metadata_version(ver: str):
    """Match prior metadata.json style (numeric when possible)."""
    s = str(ver).strip()
    if re.fullmatch(r"\d+", s):
        return int(s)
    if re.fullmatch(r"\d+\.\d+", s):
        return float(s)
    return s


def main() -> int:
    if not VERSION_JSON.is_file():
        print(f"sync-version: missing {VERSION_JSON}", file=sys.stderr)
        return 1
    data = json.loads(VERSION_JSON.read_text(encoding="utf-8"))
    ver = str(data["version"]).strip()
    if not ver:
        print("sync-version: empty version in version.json", file=sys.stderr)
        return 1
    date = str(data.get("release_date") or "2000-01-01").strip()

    meta = json.loads(METADATA_JSON.read_text(encoding="utf-8"))
    meta["version"] = _coerce_metadata_version(ver)
    METADATA_JSON.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"sync-version: wrote metadata.json version={meta['version']!r}")

    if APPSTREAM_XML.is_file():
        text = APPSTREAM_XML.read_text(encoding="utf-8")
        text2, n = re.subn(
            r'<release version="[^"]*" date="[^"]*"/>',
            f'<release version="{ver}" date="{date}"/>',
            text,
            count=1,
        )
        if n != 1:
            print(
                f"sync-version: expected one <release/> line in {APPSTREAM_XML}",
                file=sys.stderr,
            )
            return 1
        APPSTREAM_XML.write_text(text2, encoding="utf-8")
        print(f"sync-version: wrote AppStream release version={ver!r} date={date!r}")
    else:
        print(f"sync-version: skip AppStream (missing {APPSTREAM_XML})")

    return 0


if __name__ == "__main__":
    sys.exit(main())
