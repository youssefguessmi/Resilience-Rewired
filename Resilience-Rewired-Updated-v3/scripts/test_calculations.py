#!/usr/bin/env python3
"""Regression checks for the published challenge data and judge benchmark."""

import json
import math
from pathlib import Path


folder = Path(__file__).resolve().parents[1] / "dist" / "data"
accounts = json.loads((folder / "accounts.json").read_text())
summary = json.loads((folder / "summary.json").read_text())

assert len(accounts) == 4500
assert summary["monthly_rows"] == 185326

for key, account in accounts.items():
    assert account["id"] == key
    assert account["months"] == len(account["series"])
    assert account["first"] == account["series"][0][0]
    assert account["last"] == account["series"][-1][0]
    assert all(math.isfinite(account[k]) for k in ("I", "S", "F", "H", "B", "P"))

example = accounts["21109"]
assert example["months"] == 21
assert example["I"] == 5903.81
assert example["S"] == 5920.55
assert example["F"] == 2549.8
assert example["H"] == 2549.8
assert example["B"] == 12301.55
assert round(example["B"] / (example["S"] - .55 * example["I"]), 1) == 4.6
assert round(example["B"] / (example["S"] + .15 * example["H"] - .55 * example["I"]), 1) == 4.0

active = summary["active_loan"]
other = summary["no_active_loan"]
assert active["accounts"] == 448
assert active["under_6"] == 285
assert other["accounts"] == 4052
assert other["under_6"] == 1293
assert summary["overall"]["under_6"] == 1578

print("Validated 4,500 accounts, 185,326 months, benchmark scenarios and discovery cohorts.")
