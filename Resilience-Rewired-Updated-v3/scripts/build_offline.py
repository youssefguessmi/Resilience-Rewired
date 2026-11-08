#!/usr/bin/env python3
"""Bundle the entire dashboard and all account records into one offline HTML file."""

import json
import re
import sys
from pathlib import Path


root = Path(__file__).resolve().parents[1]
dist = root / "dist"
html = (dist / "index.html").read_text(encoding="utf-8")
css = (dist / "styles.css").read_text(encoding="utf-8")
new_css = (dist / "tangerine.css").read_text(encoding="utf-8")
js = (dist / "app.js").read_text(encoding="utf-8")
extras_js = (dist / "extras.js").read_text(encoding="utf-8")
accounts = json.loads((dist / "data" / "accounts.json").read_text(encoding="utf-8"))
summary = json.loads((dist / "data" / "summary.json").read_text(encoding="utf-8"))
extras = json.loads((dist / "data" / "extras.json").read_text(encoding="utf-8"))

css = re.sub(r"@import url\([^;]+;\s*", "", css, count=1)
new_css = re.sub(r"@import url\([^;]+;\s*", "", new_css, count=1)
inline_data = json.dumps(
    {"accounts": accounts, "summary": summary, "extras": extras},
    separators=(",", ":"),
    ensure_ascii=False,
).replace("</", "<\\/")

assert '<link rel="stylesheet" href="/styles.css">' in html
assert '<script src="/app.js" defer></script>' in html
html = html.replace('<link rel="stylesheet" href="/styles.css">', f"<style>{css}</style>")
html = html.replace('<link rel="stylesheet" href="/tangerine.css">', f"<style>{new_css}</style>")
html = html.replace(
    '<script src="/app.js" defer></script>',
    f"<script>window.__REWIRED_EMBEDDED={inline_data};</script><script>{extras_js}</script><script>{js}</script>",
)
html = html.replace('<script src="/extras.js" defer></script>', '')
html = html.replace(
    "<title>Resilience Rewired | Sheridan Datathon 2026</title>",
    "<title>Resilience Rewired | Offline Edition</title>",
)

destination = dist / "offline.html"
html = "\n".join(line.rstrip() for line in html.split("\n"))
destination.write_text(html, encoding="utf-8")
if len(sys.argv) > 1:
    Path(sys.argv[1]).write_text(html, encoding="utf-8")
print(f"Created offline HTML: {destination} ({destination.stat().st_size:,} bytes)")
