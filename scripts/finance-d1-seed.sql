INSERT INTO financial_accounts (
  id, owner_id, provider_slug, connection_ref, external_account_ref, currency, status, created_at, updated_at
) VALUES (
  'finance-account-smoke', 'owner', 'xero', 'connection-smoke', 'tenant-account-001', 'GBP', 'read_only',
  '2026-11-20T20:00:00.000Z', '2026-11-20T20:00:00.000Z'
);

INSERT INTO financial_transactions (
  id, account_id, owner_id, external_transaction_id, amount_minor, currency,
  occurred_at, source_updated_at, status, first_seen_at, last_seen_at
) VALUES (
  'finance-transaction-smoke', 'finance-account-smoke', 'owner', 'provider-txn-001',
  '-1234', 'GBP', '2026-11-20T19:30:00.000Z', '2026-11-20T19:31:00.000Z',
  'booked', '2026-11-20T20:00:00.000Z', '2026-11-20T20:00:00.000Z'
);

INSERT INTO financial_sync_runs (
  id, account_id, owner_id, status, pages_read, records_read, started_at, completed_at
) VALUES (
  'finance-sync-smoke', 'finance-account-smoke', 'owner', 'complete', 1, 1,
  '2026-11-20T20:00:00.000Z', '2026-11-20T20:00:01.000Z'
);
