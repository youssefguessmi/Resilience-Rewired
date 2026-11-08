#!/usr/bin/env python3
"""Build supplemental, auditable demo insights without changing benchmark data.

Usage: python scripts/build_extras.py /path/to/original-challenge.zip
"""

import csv
import json
import math
import statistics
import sys
import zipfile
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path


def rows_from(archive, filename):
    with archive.open(f"data/{filename}") as handle:
        yield from csv.DictReader(line.decode("utf-8-sig") for line in handle)


def num(value):
    return float(value or 0)


def rounded(value):
    return round(value, 2)


def run_months(balance, income, spending):
    if balance <= 0:
        return 0.0
    gap = spending - income
    return None if gap <= 0 else min(120.0, balance / gap)


def main(path):
    base_path = Path(__file__).resolve().parents[1]
    with (base_path / "dist/data/accounts.json").open(encoding="utf-8") as f:
        base = json.load(f)

    monthly = defaultdict(list)
    standing = defaultdict(list)
    negative_dates = defaultdict(set)
    loans = {}
    with zipfile.ZipFile(path) as archive:
        for row in rows_from(archive, "monthly_summary.csv"):
            monthly[row["account_id"]].append(row)
        for row in rows_from(archive, "standing_orders.csv"):
            standing[row["account_id"]].append({"purpose": row["purpose"] or "Other standing order", "amount": rounded(num(row["amount"]))})
        for row in rows_from(archive, "loans.csv"):
            loans[row["account_id"]] = row
        for row in rows_from(archive, "transactions.csv"):
            if num(row["balance"]) < 0:
                negative_dates[row["account_id"]].add(row["date"])

    profiles = {}
    for account_id, account in base.items():
        months = sorted(monthly[account_id], key=lambda r: r["month"])
        source_totals = {
            "pension": sum(num(r["pension_in"]) for r in months),
            "transfers": sum(num(r["transfers_in"]) for r in months),
            "cash deposits": sum(num(r["cash_deposits"]) for r in months),
        }
        income_total = sum(num(r["money_in"]) for r in months)
        largest_source = max(source_totals, key=source_totals.get)
        pension_majority = income_total > 0 and source_totals["pension"] > income_total * .5
        source = "mostly pension" if pension_majority else f"mostly {largest_source}" if income_total > 0 else "unclear from records"
        spend = sorted(months, key=lambda r: num(r["money_out"]), reverse=True)
        worst = spend[0]
        monthly_income = sorted(num(r["money_in"]) for r in months)
        below = [{"month": r["month"], "days": int(num(r["days_below_zero"]))} for r in months if num(r["days_below_zero"]) > 0]
        purposes = defaultdict(float)
        for order in standing[account_id]:
            purposes[order["purpose"]] += order["amount"]
        orders = [{"purpose": p, "amount": rounded(v)} for p, v in sorted(purposes.items(), key=lambda e: -e[1])]
        calendar = defaultdict(list)
        for row in months:
            calendar[int(row["month"][5:7])].append(num(row["money_out"]))
        months_calendar = [rounded(statistics.mean(calendar[i])) if calendar[i] else None for i in range(1, 13)]
        loan = loans.get(account_id)
        first_loan_day = loan["loan_start"] if loan else None
        before_loan = len([d for d in negative_dates[account_id] if first_loan_day and d < first_loan_day]) if first_loan_day else None
        since_loan = len([d for d in negative_dates[account_id] if first_loan_day and d >= first_loan_day]) if first_loan_day else None
        profiles[account_id] = {
            "incomeSource": source,
            "pensionMajority": pension_majority,
            "lowIncome": rounded(monthly_income[max(0, int((len(monthly_income) - 1) * .25))]),
            "highIncome": rounded(monthly_income[min(len(monthly_income) - 1, int((len(monthly_income) - 1) * .75))]),
            "worstMonth": worst["month"],
            "worstSpending": rounded(num(worst["money_out"])),
            "extraWorstSpending": rounded(max(0, num(worst["money_out"]) - account["S"])),
            "daysBelowZero": sum(r["days"] for r in below),
            "negativeMonths": below,
            "beforeLoanNegativeTransactions": before_loan,
            "afterLoanNegativeTransactions": since_loan,
            "standingOrders": orders,
            "standingTotal": rounded(sum(v for v in purposes.values())),
            "recoveredBills": rounded(purposes.get("household bills", 0)) if account["H"] == 0 else 0,
            "calendar": months_calendar,
            "incomeGroup": None,
            "peerPosition": None,
        }

    non_pension = sorted((a for a in base.values() if not profiles[a["id"]]["pensionMajority"]), key=lambda a: a["I"])
    quartiles = []
    for group_id in range(4):
        members = non_pension[len(non_pension) * group_id // 4:len(non_pension) * (group_id + 1) // 4]
        under_six = sum(run_months(a["B"], .55 * a["I"], a["S"]) is not None and run_months(a["B"], .55 * a["I"], a["S"]) < 6 for a in members)
        quartiles.append({
            "n": len(members),
            "income": rounded(statistics.median(a["I"] for a in members)),
            "monthsSaved": round(statistics.median(a["B"] / a["S"] for a in members if a["S"] > 0), 1),
            "underSixPct": round(100 * under_six / len(members), 1),
        })
        for position, a in enumerate(members):
            profiles[a["id"]]["incomeGroup"] = group_id
            profiles[a["id"]]["peerPosition"] = round(100 * position / max(1, len(members) - 1), 1)

    loan_accounts = [a for a in base.values() if a["loan"]]
    loan_warning = {"preNegative": {"n": 0, "defaulted": 0}, "preNonnegative": {"n": 0, "defaulted": 0}}
    for a in loan_accounts:
        key = "preNegative" if profiles[a["id"]]["beforeLoanNegativeTransactions"] else "preNonnegative"
        loan_warning[key]["n"] += 1
        loan_warning[key]["defaulted"] += int(bool(a["loan"]["defaulted"]))

    working = [a for a in base.values() if not profiles[a["id"]]["pensionMajority"]]
    alive_six = []
    for a in working:
        buffer = a["B"] + 6 * (.55 * a["I"] - a["S"])
        if buffer > 0:
            alive_six.append((a, buffer))
    cliff = {
        "nSix": len(alive_six),
        "underNine": sum(buf + 3 * (0 - a["S"]) <= 0 for a, buf in alive_six),
        "underTwelve": sum(buf + 6 * (0 - a["S"]) <= 0 for a, buf in alive_six),
    }

    result = {
        "accounts": profiles,
        "cohorts": {"quartiles": quartiles, "loanWarning": loan_warning, "eiCliff": cliff},
        "caveats": "Historical anonymized transactions. Income includes deposits/transfers, not verified employment wages. Month labels are shifted. Observed negative balances and loan status can be definitionally related; no predictive or causal claim.",
    }
    output = base_path / "dist/data/extras.json"
    with output.open("w", encoding="utf-8") as file:
        json.dump(result, file, separators=(",", ":"))
    print(f"Wrote {len(profiles)} account extras to {output}; {output.stat().st_size / 1024 / 1024:.1f} MiB")
    print("Income cohorts:", quartiles)
    print("Pre-loan negative transaction sample:", loan_warning)
    print("EI cliff sample:", cliff)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/build_extras.py challenge.zip")
    main(sys.argv[1])
