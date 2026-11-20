CREATE TABLE finance_smoke_assertions (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ok INTEGER NOT NULL CHECK (ok = 1)
);

INSERT INTO finance_smoke_assertions (id, ok)
SELECT 1,
  CASE WHEN
    (SELECT COUNT(*) FROM financial_accounts WHERE id = 'finance-account-smoke' AND owner_id = 'owner' AND status = 'read_only') = 1
    AND
    (SELECT COUNT(*) FROM financial_transactions WHERE id = 'finance-transaction-smoke' AND amount_minor = '-1234' AND currency = 'GBP') = 1
    AND
    (SELECT COUNT(*) FROM financial_transaction_events WHERE transaction_id = 'finance-transaction-smoke' AND event_type = 'observed') = 1
    AND
    (SELECT COUNT(*) FROM financial_sync_runs WHERE id = 'finance-sync-smoke' AND status = 'complete') = 1
  THEN 1 ELSE 0 END;
