# Resilience Rewired

A working financial resilience engine for the Tangerine track at Sheridan Datathon 2026.

The app accepts any of 4,500 anonymized account IDs, calculates benchmark financial metrics, applies editable shocks, creates grounded emergency fund and contingency plans, and compares account cohorts.

## Run locally

The `dist/` folder contains a static site. Serve it with any local static server, for example:

```bash
python -m http.server 8080 --directory dist
```

Open `http://localhost:8080`.

## Recreate the data

The challenge organizer supplied a ZIP containing nine CSV files and a README. Recreate the compact data assets with:

```bash
python scripts/build_data.py /path/to/challenge.zip
```

The script writes `dist/data/accounts.json` and `dist/data/summary.json` with values based on the provided CSVs. Account history remains in the original challenge data. The source ZIP is not needed to run the published site because the precomputed data assets are included.

## Benchmark calculations

For each account:

* `I` is the median of monthly `money_in`.
* `S` is the median of monthly `money_out`.
* `F` is the median of the monthly sum `household_bills + insurance + loan_payments`.
* `H` is the median of monthly `household_bills`.
* `B` is the mean of `avg_daily_balance` over the last six months.
* `P` is the monthly loan payment when the loan status is C or D, otherwise zero.

Under a shock, `income = I * retained_percentage`, `spending = S + bills_increase * H + additional_monthly_expenses`, and `buffer_left = B - one_time_costs`.

If `buffer_left <= 0`, runway is zero. If shocked spending is no higher than shocked income, show `no shortfall (120+)`. Otherwise, runway is `min(buffer_left / (spending - income), 120)` months rounded to one decimal.

The optional projection of Employment Insurance ending after six months is separate from the benchmark runway and does not overwrite the judge-facing formula.

## Discovery

Under an illustrative 55% income retention scenario, **285 of 448 accounts with an active loan (63.6%)** fall below six months of runway, compared with **1,293 of 4,052 without an active loan (31.9%)**. This is a correlation in historical transformed data, not causal evidence. Exact values are computed by `scripts/build_data.py` and displayed in the Discoveries section.

## Sponsor technologies

The working dashboard uses precomputed analytics so the live judging demo works offline once assets are loaded. The optional integrations are deliberately separated:

* **Gemini**: the Tech Lab builds a detailed, anonymized, scenario-specific prompt that can be pasted into Google AI Studio. A live API integration requires the team to provide a private API key and server endpoint.
* **Tiger Data**: PostgreSQL time series schema is in `integrations/tiger_data.sql`.
* **Snowflake**: warehouse setup and cohort query are in `integrations/snowflake.sql`.
* **Vultr**: `Dockerfile` runs a small containerized static web service, ready for a separately authorized deployment.
* **Solana**: optional future use for publicly timestamping a hash of a report, never customer records. No chain transaction is currently made.
* **GoDaddy Registry**: a custom domain may be configured only after acquiring a domain and updating DNS.
* **Entire**: a possible collaboration workflow for source development; no Entire session is claimed without a configured account.

Integrations require their respective services and credentials. The site shows their real status and never labels them as connected when they are not.

## Accuracy limitations

`money_in` includes transfers and pensions, so it is not confirmed employment salary. A bank account balance is only a proxy for savings. The source data originates from a Czech bank and the original district names are not Canadian locations. The EI scenario is an example, not a personal benefits eligibility decision. The plans are modeled budget scenarios and require verification before real use.

## Credits

PKDD'99 Discovery Challenge Financial dataset, CTU Prague Relational Dataset Repository: https://relational.fel.cvut.cz/dataset/Financial

Tangerine Resilience Rewired challenge instructions, Sheridan Datathon 2026.
