#!/usr/bin/env python3
"""Build auditable, compact site data from the provided Tangerine challenge ZIP.

Usage: python scripts/build_data.py /path/to/challenge.zip
"""

import csv
import json
import statistics
import sys
import zipfile
from collections import defaultdict
from pathlib import Path


def read_csv(archive, filename):
    with archive.open(f"data/{filename}") as stream:
        yield from csv.DictReader(line.decode("utf-8-sig") for line in stream)


def money(value):
    return round(float(value), 2)


def median(rows, field):
    return round(statistics.median(float(row[field]) for row in rows), 2)


def runway(buffer, income, spending, one_off=0):
    left = buffer - one_off
    gap = spending - income
    if left <= 0:
        return 0.0
    if gap <= 0:
        return None
    return round(min(left / gap, 120), 1)


def build(zip_path):
    accounts = {}
    districts = {}
    loans = {}
    months = defaultdict(list)

    with zipfile.ZipFile(zip_path) as archive:
        for row in read_csv(archive, "districts.csv"):
            districts[row["district_id"]] = {
                "name": row["district_name"],
                "region": row["region"],
            }
        for row in read_csv(archive, "accounts.csv"):
            accounts[row["account_id"]] = row
        for row in read_csv(archive, "loans.csv"):
            loans[row["account_id"]] = {
                "status": row["status"],
                "payment": money(row["monthly_payment"]),
                "amount": money(row["amount"]),
                "defaulted": row["defaulted"] == "1",
            }
        for row in read_csv(archive, "monthly_summary.csv"):
            months[row["account_id"]].append(row)

    result = {}
    records = []
    for account_id, rows in months.items():
        rows.sort(key=lambda row: row["month"])
        inflow = median(rows, "money_in")
        spending = median(rows, "money_out")
        bills = median(rows, "household_bills")
        fixed = round(statistics.median(
            float(r["household_bills"]) + float(r["insurance"]) + float(r["loan_payments"])
            for r in rows
        ), 2)
        buffer = round(statistics.mean(float(r["avg_daily_balance"]) for r in rows[-6:]), 2)
        loan = loans.get(account_id)
        payment = loan["payment"] if loan and loan["status"] in ("C", "D") else 0
        base = runway(buffer, inflow, spending)
        job_loss = runway(buffer, .55 * inflow, spending)
        account = accounts.get(account_id, {})
        district = districts.get(account.get("district_id", ""), {})
        # Keep the full monthly time series for an honest customer trend view.
        series = [[
            r["month"], money(r["money_in"]), money(r["money_out"]),
            money(r["avg_daily_balance"]), money(r["household_bills"]),
        ] for r in rows]
        result[account_id] = {
            "id": account_id,
            "months": len(rows),
            "first": rows[0]["month"],
            "last": rows[-1]["month"],
            "I": inflow,
            "S": spending,
            "F": fixed,
            "H": bills,
            "B": buffer,
            "P": payment,
            "loan": loan,
            "district": district.get("name", "Unknown"),
            "region": district.get("region", "Unknown"),
            "base_runway": base,
            "job_runway": job_loss,
            "series": series,
        }
        records.append(result[account_id])

    def group_stats(items):
        scenarios = [x["job_runway"] for x in items]
        finite = [x for x in scenarios if x is not None]
        return {
            "accounts": len(items),
            "under_3": sum(v < 3 for v in finite),
            "under_6": sum(v < 6 for v in finite),
            "no_shortfall": sum(v is None for v in scenarios),
            "median_runway": round(statistics.median(finite), 1) if finite else None,
        }

    surplus = [a for a in records if a["I"] > a["S"] and a["B"] > 0]
    with_loan = [a for a in records if a["loan"]]
    without_loan = [a for a in records if not a["loan"]]
    active_loan = [a for a in records if a["P"] > 0]
    no_active_loan = [a for a in records if a["P"] == 0]
    region_summary = {}
    for region in sorted({r["region"] for r in records}):
        subgroup = [r for r in records if r["region"] == region]
        if len(subgroup) >= 15:
            region_summary[region] = group_stats(subgroup)

    summary = {
        "accounts": len(records),
        "monthly_rows": sum(x["months"] for x in records),
        "overall": group_stats(records),
        "surplus_buffer": group_stats(surplus),
        "with_loan": group_stats(with_loan),
        "without_loan": group_stats(without_loan),
        "active_loan": group_stats(active_loan),
        "no_active_loan": group_stats(no_active_loan),
        "regions": region_summary,
        "method": "README challenge benchmark: account medians and last-six-month buffer mean; job shock uses 55% of typical inflow",
    }
    destination = Path(__file__).resolve().parents[1] / "dist" / "data"
    destination.mkdir(parents=True, exist_ok=True)
    with (destination / "accounts.json").open("w", encoding="utf-8") as output:
        json.dump(result, output, separators=(",", ":"), ensure_ascii=False)
    with (destination / "summary.json").open("w", encoding="utf-8") as output:
        json.dump(summary, output, separators=(",", ":"), ensure_ascii=False)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/build_data.py /path/to/challenge.zip")
    build(sys.argv[1])
