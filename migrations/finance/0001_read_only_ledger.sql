PRAGMA foreign_keys = ON;

-- Owner-scoped, read-only financial observations. No provider credentials,
-- raw payloads, payment instruments, free-text descriptions or pagination
-- cursors are stored in this schema.
CREATE TABLE IF NOT EXISTS financial_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  provider_slug TEXT NOT NULL CHECK (
    length(provider_slug) BETWEEN 1 AND 64
    AND provider_slug = lower(provider_slug)
    AND provider_slug NOT GLOB '*[^a-z0-9_-]*'
  ),
  connection_ref TEXT NOT NULL CHECK (length(connection_ref) BETWEEN 1 AND 128),
  external_account_ref TEXT NOT NULL CHECK (
    length(external_account_ref) BETWEEN 1 AND 256
    AND trim(external_account_ref) = external_account_ref
  ),
  currency TEXT CHECK (
    currency IS NULL OR (
      length(currency) = 3
      AND currency = upper(currency)
      AND currency NOT GLOB '*[^A-Z]*'
    )
  ),
  status TEXT NOT NULL CHECK (status IN ('read_only', 'disabled', 'revoked')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_id, provider_slug, external_account_ref),
  UNIQUE (id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_owner_status
  ON financial_accounts (owner_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS financial_transactions (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  external_transaction_id TEXT NOT NULL CHECK (
    length(external_transaction_id) BETWEEN 1 AND 256
    AND trim(external_transaction_id) = external_transaction_id
  ),
  amount_minor TEXT NOT NULL CHECK (
    length(amount_minor) BETWEEN 1 AND 41
    AND amount_minor NOT GLOB '*[^0-9-]*'
    AND substr(amount_minor, 2) NOT GLOB '*-*'
    AND (substr(amount_minor, 1, 1) != '-' OR length(amount_minor) > 1)
  ),
  currency TEXT NOT NULL CHECK (
    length(currency) = 3
    AND currency = upper(currency)
    AND currency NOT GLOB '*[^A-Z]*'
  ),
  occurred_at TEXT NOT NULL CHECK (
    length(occurred_at) = 24
    AND substr(occurred_at, 11, 1) = 'T'
    AND substr(occurred_at, 24, 1) = 'Z'
  ),
  source_updated_at TEXT CHECK (
    source_updated_at IS NULL OR (
      length(source_updated_at) = 24
      AND substr(source_updated_at, 11, 1) = 'T'
      AND substr(source_updated_at, 24, 1) = 'Z'
    )
  ),
  status TEXT NOT NULL CHECK (status IN ('pending', 'booked', 'reversed', 'deleted')),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (account_id, owner_id)
    REFERENCES financial_accounts (id, owner_id),
  UNIQUE (account_id, external_transaction_id),
  UNIQUE (id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_owner_time
  ON financial_transactions (owner_id, occurred_at DESC, id ASC);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_account_time
  ON financial_transactions (account_id, occurred_at DESC, id ASC);

CREATE TABLE IF NOT EXISTS financial_transaction_events (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  transaction_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('observed', 'updated')),
  amount_minor TEXT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'booked', 'reversed', 'deleted')),
  source_updated_at TEXT,
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (transaction_id, owner_id)
    REFERENCES financial_transactions (id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_transaction_events_owner_time
  ON financial_transaction_events (owner_id, occurred_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS financial_transaction_identity_immutable
BEFORE UPDATE ON financial_transactions
WHEN OLD.id <> NEW.id
  OR OLD.account_id <> NEW.account_id
  OR OLD.owner_id <> NEW.owner_id
  OR OLD.external_transaction_id <> NEW.external_transaction_id
  OR OLD.first_seen_at <> NEW.first_seen_at
BEGIN
  SELECT RAISE(ABORT, 'financial transaction source identity is immutable');
END;

CREATE TRIGGER IF NOT EXISTS financial_transaction_observed_event
AFTER INSERT ON financial_transactions
BEGIN
  INSERT INTO financial_transaction_events (
    transaction_id, owner_id, event_type, amount_minor,
    currency, status, source_updated_at, occurred_at
  ) VALUES (
    NEW.id, NEW.owner_id, 'observed', NEW.amount_minor,
    NEW.currency, NEW.status, NEW.source_updated_at, NEW.last_seen_at
  );
END;

CREATE TRIGGER IF NOT EXISTS financial_transaction_updated_event
AFTER UPDATE ON financial_transactions
WHEN OLD.amount_minor IS NOT NEW.amount_minor
  OR OLD.currency IS NOT NEW.currency
  OR OLD.status IS NOT NEW.status
  OR OLD.source_updated_at IS NOT NEW.source_updated_at
BEGIN
  INSERT INTO financial_transaction_events (
    transaction_id, owner_id, event_type, amount_minor,
    currency, status, source_updated_at, occurred_at
  ) VALUES (
    NEW.id, NEW.owner_id, 'updated', NEW.amount_minor,
    NEW.currency, NEW.status, NEW.source_updated_at, NEW.last_seen_at
  );
END;

CREATE TRIGGER IF NOT EXISTS financial_transaction_events_no_update
BEFORE UPDATE ON financial_transaction_events
BEGIN
  SELECT RAISE(ABORT, 'financial transaction events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS financial_transaction_events_no_delete
BEFORE DELETE ON financial_transaction_events
BEGIN
  SELECT RAISE(ABORT, 'financial transaction events are append-only');
END;

CREATE TABLE IF NOT EXISTS financial_sync_runs (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'complete', 'partial', 'failed')),
  pages_read INTEGER NOT NULL DEFAULT 0 CHECK (pages_read >= 0),
  records_read INTEGER NOT NULL DEFAULT 0 CHECK (records_read >= 0),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  failure_code TEXT CHECK (failure_code IS NULL OR length(failure_code) BETWEEN 1 AND 80),
  FOREIGN KEY (account_id, owner_id)
    REFERENCES financial_accounts (id, owner_id),
  CHECK (
    (status = 'running' AND completed_at IS NULL)
    OR (status IN ('complete', 'partial', 'failed') AND completed_at IS NOT NULL)
  ),
  CHECK (status != 'complete' OR failure_code IS NULL),
  CHECK (status != 'failed' OR failure_code IS NOT NULL),
  UNIQUE (id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_sync_runs_owner_time
  ON financial_sync_runs (owner_id, started_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS financial_sync_run_identity_immutable
BEFORE UPDATE ON financial_sync_runs
WHEN OLD.id <> NEW.id
  OR OLD.account_id <> NEW.account_id
  OR OLD.owner_id <> NEW.owner_id
  OR OLD.started_at <> NEW.started_at
BEGIN
  SELECT RAISE(ABORT, 'financial sync run identity is immutable');
END;


CREATE TABLE IF NOT EXISTS financial_sync_run_events (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  sync_run_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated')),
  status TEXT NOT NULL CHECK (status IN ('running', 'complete', 'partial', 'failed')),
  pages_read INTEGER NOT NULL CHECK (pages_read >= 0),
  records_read INTEGER NOT NULL CHECK (records_read >= 0),
  failure_code TEXT,
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (sync_run_id, owner_id)
    REFERENCES financial_sync_runs (id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_financial_sync_run_events_owner_time
  ON financial_sync_run_events (owner_id, occurred_at DESC, id DESC);

CREATE TRIGGER IF NOT EXISTS financial_sync_run_created_event
AFTER INSERT ON financial_sync_runs
BEGIN
  INSERT INTO financial_sync_run_events (
    sync_run_id, owner_id, event_type, status,
    pages_read, records_read, failure_code, occurred_at
  ) VALUES (
    NEW.id, NEW.owner_id, 'created', NEW.status,
    NEW.pages_read, NEW.records_read, NEW.failure_code, NEW.started_at
  );
END;

CREATE TRIGGER IF NOT EXISTS financial_sync_run_updated_event
AFTER UPDATE ON financial_sync_runs
WHEN OLD.status IS NOT NEW.status
  OR OLD.pages_read IS NOT NEW.pages_read
  OR OLD.records_read IS NOT NEW.records_read
  OR OLD.completed_at IS NOT NEW.completed_at
  OR OLD.failure_code IS NOT NEW.failure_code
BEGIN
  INSERT INTO financial_sync_run_events (
    sync_run_id, owner_id, event_type, status,
    pages_read, records_read, failure_code, occurred_at
  ) VALUES (
    NEW.id, NEW.owner_id, 'updated', NEW.status,
    NEW.pages_read, NEW.records_read, NEW.failure_code,
    COALESCE(NEW.completed_at, NEW.started_at)
  );
END;

CREATE TRIGGER IF NOT EXISTS financial_sync_run_terminal_immutable
BEFORE UPDATE ON financial_sync_runs
WHEN OLD.status IN ('complete', 'partial', 'failed')
BEGIN
  SELECT RAISE(ABORT, 'terminal financial sync runs are immutable');
END;

CREATE TRIGGER IF NOT EXISTS financial_sync_run_events_no_update
BEFORE UPDATE ON financial_sync_run_events
BEGIN
  SELECT RAISE(ABORT, 'financial sync run events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS financial_sync_run_events_no_delete
BEFORE DELETE ON financial_sync_run_events
BEGIN
  SELECT RAISE(ABORT, 'financial sync run events are append-only');
END;
