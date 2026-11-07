CREATE TABLE IF NOT EXISTS account_monthly (
  account_id INTEGER NOT NULL,
  month DATE NOT NULL,
  money_in NUMERIC(18,2) NOT NULL,
  money_out NUMERIC(18,2) NOT NULL,
  household_bills NUMERIC(18,2) NOT NULL,
  insurance NUMERIC(18,2) NOT NULL,
  loan_payments NUMERIC(18,2) NOT NULL,
  avg_daily_balance NUMERIC(18,2) NOT NULL,
  PRIMARY KEY (account_id, month)
);

-- After loading monthly_summary.csv, convert month YYYY-MM to YYYY-MM-01.
-- On Tiger Data, if hypertables are enabled:
SELECT create_hypertable('account_monthly', by_range('month'), if_not_exists => TRUE);

-- Example account-level time series query.
SELECT month, money_in, money_out, avg_daily_balance
FROM account_monthly
WHERE account_id = 21109
ORDER BY month;
