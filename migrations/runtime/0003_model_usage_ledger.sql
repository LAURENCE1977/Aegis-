PRAGMA foreign_keys = ON;

-- Quota windows are server-authored from verified provider terms/telemetry.
-- Units are explicit: tokens and Cloudflare Neurons are never interchangeable.
CREATE TABLE IF NOT EXISTS model_usage_quota_windows (
  id TEXT PRIMARY KEY NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  unit_kind TEXT NOT NULL CHECK (unit_kind IN ('tokens', 'neurons')),
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  limit_units INTEGER NOT NULL CHECK (limit_units >= 0),
  source_url TEXT NOT NULL CHECK (substr(source_url, 1, 8) = 'https://'),
  verified_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('enabled', 'disabled', 'review')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (window_end > window_start),
  UNIQUE (provider_id, model_id, unit_kind, window_start, window_end)
);

CREATE INDEX IF NOT EXISTS idx_model_usage_quota_lookup
  ON model_usage_quota_windows (provider_id, model_id, unit_kind, window_start, window_end, status);

CREATE TABLE IF NOT EXISTS model_usage_reservations (
  id TEXT PRIMARY KEY NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  principal_id TEXT NOT NULL,
  project_id TEXT,
  quota_window_id TEXT NOT NULL REFERENCES model_usage_quota_windows(id),
  reserved_units INTEGER NOT NULL CHECK (reserved_units > 0),
  actual_units INTEGER CHECK (actual_units >= 0 AND actual_units <= reserved_units),
  status TEXT NOT NULL CHECK (status IN ('reserved', 'settled', 'released')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((status = 'settled' AND actual_units IS NOT NULL) OR
         (status IN ('reserved', 'released') AND actual_units IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_model_usage_reservations_window_status
  ON model_usage_reservations (quota_window_id, status);

CREATE INDEX IF NOT EXISTS idx_model_usage_reservations_principal_created
  ON model_usage_reservations (principal_id, created_at);

CREATE TABLE IF NOT EXISTS model_usage_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  reservation_id TEXT NOT NULL REFERENCES model_usage_reservations(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('reserved', 'settled', 'released')),
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_model_usage_events_reservation_created
  ON model_usage_events (reservation_id, created_at);

CREATE TRIGGER IF NOT EXISTS model_usage_events_no_update
BEFORE UPDATE ON model_usage_events
BEGIN
  SELECT RAISE(ABORT, 'model usage events are append-only');
END;

CREATE TRIGGER IF NOT EXISTS model_usage_events_no_delete
BEFORE DELETE ON model_usage_events
BEGIN
  SELECT RAISE(ABORT, 'model usage events are append-only');
END;
