#!/usr/bin/env python3
"""Regenerate the local browser data script after editing the JSON datasets."""

from pathlib import Path


folder = Path(__file__).resolve().parents[1] / "dist/data"
accounts = (folder / "accounts.json").read_text(encoding="utf-8")
summary = (folder / "summary.json").read_text(encoding="utf-8")
extras = (folder / "extras.json").read_text(encoding="utf-8")
(folder / "embedded.js").write_text(
    f"window.__REWIRED_EMBEDDED={{accounts:{accounts},summary:{summary},extras:{extras}}};\n",
    encoding="utf-8",
)
print("Updated dist/data/embedded.js")
