PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS system_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    operational_mode TEXT NOT NULL DEFAULT 'NORMAL'
        CHECK (operational_mode IN ('NORMAL', 'MAINTENANCE', 'LOCKDOWN')),
    threat_level TEXT NOT NULL DEFAULT 'LOW'
        CHECK (threat_level IN ('LOW', 'GUARDED', 'HIGH', 'CRITICAL')),
    eve_state_tag TEXT NOT NULL DEFAULT 'IDLE'
        CHECK (eve_state_tag IN ('IDLE', 'ANALYZING', 'ALERT')),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO system_state (
    id, operational_mode, threat_level, eve_state_tag
) VALUES (1, 'NORMAL', 'LOW', 'IDLE');
