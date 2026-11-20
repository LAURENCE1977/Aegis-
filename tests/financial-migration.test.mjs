import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../migrations/finance/0001_read_only_ledger.sql', import.meta.url), 'utf8');

test('financial accounts and transactions are owner-scoped and idempotently identifiable', () => {
  assert.match(migration, /UNIQUE \(owner_id, provider_slug, external_account_ref\)/);
  assert.match(migration, /UNIQUE \(account_id, external_transaction_id\)/);
  assert.match(migration, /FOREIGN KEY \(account_id, owner_id\)[\s\S]*REFERENCES financial_accounts \(id, owner_id\)/);
  assert.match(migration, /provider_slug NOT GLOB '\*\[\^a-z0-9_-\]\*'/);
});

test('ledger stores exact minor-unit strings and explicit transaction lifecycle states', () => {
  assert.match(migration, /amount_minor TEXT NOT NULL/);
  assert.match(migration, /status TEXT NOT NULL CHECK \(status IN \('pending', 'booked', 'reversed', 'deleted'\)\)/);
  assert.match(migration, /currency TEXT NOT NULL CHECK/);
  assert.doesNotMatch(migration, /REAL|FLOAT|DOUBLE/i);
});

test('source identity is immutable and transaction observations are append-only audited', () => {
  assert.match(migration, /financial_transaction_identity_immutable/);
  assert.match(migration, /financial_transaction_observed_event/);
  assert.match(migration, /financial_transaction_updated_event/);
  assert.match(migration, /financial_transaction_events_no_update/);
  assert.match(migration, /financial_transaction_events_no_delete/);
});

test('sync runs distinguish complete, partial, failed and in-progress reads', () => {
  assert.match(migration, /status IN \('running', 'complete', 'partial', 'failed'\)/);
  assert.match(migration, /status != 'complete' OR failure_code IS NULL/);
  assert.match(migration, /status != 'failed' OR failure_code IS NOT NULL/);
  assert.match(migration, /financial_sync_run_identity_immutable/);
});

test('schema deliberately excludes raw provider payloads, credentials and payment instruments', () => {
  assert.doesNotMatch(migration, /raw_payload|access_token|refresh_token|api_key|card_number|pan\b/i);
});
