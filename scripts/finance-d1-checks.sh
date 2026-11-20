#!/usr/bin/env bash
set -euo pipefail

CONFIG=wrangler.finance-d1-test.toml
DB=aegis-finance-test
PERSIST=.wrangler/test-finance-d1

expect_rejected() {
  local description="$1"
  local sql="$2"
  if wrangler d1 execute "$DB" --local --config "$CONFIG" --persist-to "$PERSIST" --command "$sql"; then
    echo "Expected finance D1 to reject: $description"
    exit 1
  fi
}

expect_rejected "duplicate provider transaction identity" "INSERT INTO financial_transactions (id, account_id, owner_id, external_transaction_id, amount_minor, currency, occurred_at, status, first_seen_at, last_seen_at) VALUES ('finance-duplicate', 'finance-account-smoke', 'owner', 'provider-txn-001', '1', 'GBP', '2026-11-20T19:30:00.000Z', 'booked', '2026-11-20T20:00:00.000Z', '2026-11-20T20:00:00.000Z')"

expect_rejected "cross-owner account reference" "INSERT INTO financial_transactions (id, account_id, owner_id, external_transaction_id, amount_minor, currency, occurred_at, status, first_seen_at, last_seen_at) VALUES ('finance-cross-owner', 'finance-account-smoke', 'another-owner', 'provider-txn-cross-owner', '1', 'GBP', '2026-11-20T19:30:00.000Z', 'booked', '2026-11-20T20:00:00.000Z', '2026-11-20T20:00:00.000Z')"

expect_rejected "source identity mutation" "UPDATE financial_transactions SET external_transaction_id = 'provider-txn-tampered' WHERE id = 'finance-transaction-smoke'"

expect_rejected "append-only observation update" "UPDATE financial_transaction_events SET status = 'reversed' WHERE transaction_id = 'finance-transaction-smoke'"

expect_rejected "append-only observation deletion" "DELETE FROM financial_transaction_events WHERE transaction_id = 'finance-transaction-smoke'"

expect_rejected "invalid account lifecycle state" "UPDATE financial_accounts SET status = 'connected_and_writable' WHERE id = 'finance-account-smoke'"

expect_rejected "failed sync without failure code" "INSERT INTO financial_sync_runs (id, account_id, owner_id, status, started_at, completed_at) VALUES ('finance-invalid-sync', 'finance-account-smoke', 'owner', 'failed', '2026-11-20T20:00:00.000Z', '2026-11-20T20:00:01.000Z')"

wrangler d1 execute "$DB" --local --config "$CONFIG" --persist-to "$PERSIST" --command "UPDATE financial_sync_runs SET status = 'complete', pages_read = 1, records_read = 1, completed_at = '2026-11-20T20:00:01.000Z' WHERE id = 'finance-sync-smoke'"

expect_rejected "terminal sync run mutation" "UPDATE financial_sync_runs SET status = 'partial' WHERE id = 'finance-sync-smoke'"
expect_rejected "append-only sync event update" "UPDATE financial_sync_run_events SET status = 'partial' WHERE sync_run_id = 'finance-sync-smoke'"
expect_rejected "append-only sync event deletion" "DELETE FROM financial_sync_run_events WHERE sync_run_id = 'finance-sync-smoke'"

wrangler d1 execute "$DB" --local --config "$CONFIG" --persist-to "$PERSIST" --command "UPDATE financial_transactions SET amount_minor = '-1250', status = 'reversed', source_updated_at = '2026-11-20T20:05:00.000Z', last_seen_at = '2026-11-20T20:05:00.000Z' WHERE id = 'finance-transaction-smoke'"

wrangler d1 execute "$DB" --local --config "$CONFIG" --persist-to "$PERSIST" --file scripts/finance-d1-assert.sql
