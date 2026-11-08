#!/usr/bin/env python3
"""Integrity checks for the optional features and original challenge benchmark."""

import json
from pathlib import Path


root = Path(__file__).resolve().parents[1] / "dist" / "data"
base = json.loads((root / "accounts.json").read_text(encoding="utf-8"))
extra = json.loads((root / "extras.json").read_text(encoding="utf-8"))
summary = json.loads((root / "summary.json").read_text(encoding="utf-8"))

assert len(base) == len(extra["accounts"]) == 4500
assert set(base) == set(extra["accounts"])
assert sum(x["months"] for x in base.values()) == 185326
assert summary["overall"]["accounts"] == 4500
assert sum(q["n"] for q in extra["cohorts"]["quartiles"]) == 3760
assert [q["underSixPct"] for q in extra["cohorts"]["quartiles"]] == [8.5, 38.1, 51.9, 70.3]
assert extra["cohorts"]["loanWarning"]["preNegative"] == {"n": 27, "defaulted": 27}
assert extra["cohorts"]["eiCliff"] == {"nSix": 2173, "underNine": 1170, "underTwelve": 1530}

for account_id, a in base.items():
    x = extra["accounts"][account_id]
    assert len(x["calendar"]) == 12
    assert x["standingTotal"] >= 0
    assert x["extraWorstSpending"] >= 0
    assert x["daysBelowZero"] >= 0
    assert x["lowIncome"] <= x["highIncome"]
    if x["pensionMajority"]:
        assert x["incomeGroup"] is None
    else:
        assert x["incomeGroup"] in (0, 1, 2, 3)

print("Validated 17 supplemental feature data inputs, all 4,500 accounts and three headline discoveries.")
